"""AUDIT AGENT — the adversary. Full implementation.

Audits claims AS THEY ARRIVE, in parallel with the Doc Agent's extraction:
  1. Deterministic template checks: regex formats, required fields.
  2. BLIND read of the same page (it never sees the claimed values first),
     then field-by-field comparison.
  3. Disagreement -> CHALLENGE back to the Doc Agent; judges the DEFEND /
     CONCEDE response. Unresolved -> Discrepancy -> human review.
  4. After DOCS_COMPLETE and all disputes settled: cross-document sweep +
     process-rule checks, then AUDIT_COMPLETE.
"""
import asyncio
import json
import re

from app.agents.bus import AgentBus
from app.db.session import SessionLocal
from app.db import models
from app.services.events import emit
from app.services.llm import call_agent, image_block

ME, PEER = "audit_agent", "doc_agent"


def _norm(v) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip().upper()


async def run(bus: AgentBus) -> None:
    case_id = bus.case_id
    open_challenges: set[str] = set()   # field_ids awaiting DEFEND/CONCEDE
    docs_complete = False

    db = SessionLocal()
    try:
        templates = {t.code: t for t in db.query(models.DocTypeTemplate).all()}
    finally:
        db.close()

    while not (docs_complete and not open_challenges):
        msg = await bus.receive(ME)

        if msg.type == "DOC_CLAIM":
            await _audit_claim(bus, msg.payload, templates, open_challenges)

        elif msg.type in ("DEFEND", "CONCEDE"):
            p = msg.payload
            open_challenges.discard(p.get("field_id"))
            await _judge_response(bus, msg.type, p)

        elif msg.type == "DOCS_COMPLETE":
            docs_complete = True

    await _cross_document_sweep(bus)
    await bus.send(ME, PEER, "AUDIT_COMPLETE",
                   {"message": "Audit finished — handing over to scorecard"})


async def _audit_claim(bus: AgentBus, p: dict, templates: dict,
                       open_challenges: set) -> None:
    """Verify one document's claimed fields: format checks + blind read."""
    case_id = bus.case_id
    doc_type, fields = p.get("doc_type", ""), p.get("fields", [])
    page_image = p.get("page_image")
    template = templates.get(doc_type)

    # ---- 1. deterministic format checks (no LLM needed) ----
    expected = {f["name"]: f for f in (template.expected_fields if template else [])}
    for f in fields:
        spec = expected.get(f["name"], {})
        regex = spec.get("regex")
        if regex and f.get("value") and not re.match(regex, str(f["value"])):
            _persist_discrepancy(case_id, "FORMAT_INVALID", "FAIL",
                                 f"{doc_type}.{f['name']} fails format check",
                                 {"doc_type": doc_type, "field": f["name"],
                                  "value": f["value"], "regex": regex}, [f["field_id"]])
            emit(case_id, ME, "finding",
                 {"message": f"FORMAT FAIL: {doc_type}.{f['name']}='{f['value']}' "
                             f"does not match {regex}"})
    missing = [n for n, s in expected.items()
               if s.get("required") and not any(c["name"] == n and c.get("value") for c in fields)]
    for name in missing:
        _persist_discrepancy(case_id, "MISSING_DOC", "WARN",
                             f"{doc_type}: required field '{name}' not extracted",
                             {"doc_type": doc_type, "field": name}, [])

    # ---- 2. blind read: my own reading of the same page, claims unseen ----
    if not page_image or not fields:
        return
    blind = await asyncio.to_thread(
        call_agent, "audit_agent_blind_read",
        [image_block(page_image),
         {"type": "text", "text": "Read these fields blind: "
                                  + json.dumps([f["name"] for f in fields])}],
    )
    my_reads = {b.get("name"): b for b in blind.get("fields", [])}

    verified = 0
    for f in fields:
        mine = my_reads.get(f["name"])
        if mine is None:
            continue
        if _norm(mine.get("value")) == _norm(f.get("value")):
            verified += 1
        else:
            open_challenges.add(f["field_id"])
            await bus.send(ME, PEER, "CHALLENGE", {
                "message": f"Doubting {doc_type}.{f['name']}: my blind read says "
                           f"'{mine.get('value')}' but you claimed '{f.get('value')}' — re-read it",
                "field_id": f["field_id"], "field": f["name"],
                "document_id": p.get("document_id"), "page_image": page_image,
                "reason": f"Independent blind read produced '{mine.get('value')}' "
                          f"({float(mine.get('confidence', 0)):.0f}%)",
                "auditor_value": mine.get("value"),
            })
    if verified:
        await bus.send(ME, PEER, "VERDICT", {
            "message": f"{doc_type}: {verified}/{len(fields)} field(s) independently "
                       "verified by blind read",
            "document_id": p.get("document_id"), "status": "VERIFIED",
        })


async def _judge_response(bus: AgentBus, kind: str, p: dict) -> None:
    """Judge a DEFEND or CONCEDE. One challenge round, then humans decide."""
    case_id = bus.case_id
    field, field_id = p.get("field"), p.get("field_id")

    if kind == "CONCEDE":
        await bus.send(ME, PEER, "VERDICT", {
            "message": f"Accepted revised {field}='{p.get('value')}' — dispute resolved",
            "field_id": field_id, "status": "VERIFIED",
        })
        return

    # DEFEND: the Doc Agent stands by its reading against my blind read.
    # Neither of us gets to win by insisting — a human gets the final call.
    _persist_discrepancy(
        case_id, "LOW_CONFIDENCE", "WARN",
        f"Agents disagree on '{field}' after re-read",
        {"field": field, "values": [
            {"agent": "doc_agent", "value": p.get("value")},
            {"agent": "audit_agent", "value": p.get("auditor_value", "(blind read)")},
        ]},
        [field_id] if field_id else [],
    )
    await bus.send(ME, PEER, "VERDICT", {
        "message": f"'{field}' stays disputed after defense — flagging for human review",
        "field_id": field_id, "status": "DISPUTED",
    })


async def _cross_document_sweep(bus: AgentBus) -> None:
    """Whole-bundle consistency + process rules, after all claims settled."""
    case_id = bus.case_id
    emit(case_id, ME, "finding",
         {"message": "Running cross-document consistency and process-rule checks"})

    db = SessionLocal()
    try:
        docs = db.query(models.Document).filter(models.Document.case_id == case_id).all()
        type_by_id = {t.id: t.code for t in db.query(models.DocTypeTemplate).all()}
        case = db.query(models.Case).get(case_id)
        process = db.query(models.ProcessTemplate).get(case.inferred_process_id) \
            if case and case.inferred_process_id else None

        # latest round per (document, field)
        bundle = {}
        present_types = set()
        for d in docs:
            code = type_by_id.get(d.doc_type_id, "UNKNOWN")
            present_types.add(code)
            latest: dict[str, models.ExtractedField] = {}
            for f in d.fields:
                cur = latest.get(f.field_name)
                if cur is None or (f.extraction_round or 1) > (cur.extraction_round or 1):
                    latest[f.field_name] = f
            bundle[f"{code}:{str(d.id)[:8]}"] = {
                n: {"value": f.value_normalized, "confidence": float(f.confidence or 0)}
                for n, f in latest.items()
            }

        # deterministic: mandatory documents present?
        if process:
            for req in (process.required_docs or []):
                if req.get("mandatory") and req["doc_type"] not in present_types:
                    _persist_discrepancy(case_id, "MISSING_DOC", "FAIL",
                                         f"{process.code}: mandatory document "
                                         f"{req['doc_type']} not provided",
                                         {"doc_type": req["doc_type"]}, [])
                    emit(case_id, ME, "finding",
                         {"message": f"MISSING: {process.code} requires {req['doc_type']}"})
    finally:
        db.close()

    # LLM: fuzzy cross-document consistency (names, DOBs, incomes, dates)
    if bundle:
        try:
            result = await asyncio.to_thread(
                call_agent, "audit_agent_cross_check",
                json.dumps({
                    "extracted": bundle,
                    "process_rules": (process.rules if process else []),
                }),
            )
            for issue in result.get("issues", []):
                _persist_discrepancy(
                    case_id,
                    issue.get("kind", "RULE_VIOLATION"),
                    issue.get("severity", "WARN"),
                    issue.get("title", "Cross-document issue"),
                    issue.get("detail", {}), [],
                )
                emit(case_id, ME, "finding",
                     {"message": f"[{issue.get('severity')}] {issue.get('title')}"})
        except Exception as exc:  # noqa: BLE001
            emit(case_id, ME, "error", {"message": f"Cross-check failed: {exc}"})


def _persist_discrepancy(case_id: str, kind: str, severity: str, title: str,
                         detail: dict, field_refs: list) -> None:
    db = SessionLocal()
    try:
        db.add(models.Discrepancy(case_id=case_id, kind=kind, severity=severity,
                                  title=title, detail=detail, raised_by=ME,
                                  field_refs=field_refs or None))
        db.commit()
    finally:
        db.close()
