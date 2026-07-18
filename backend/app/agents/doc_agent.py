"""DOC AGENT — the documenter. Full implementation.

Runs in parallel with the Audit Agent:
  1. Intakes each upload, classifies it, extracts template fields with evidence.
  2. Publishes one DOC_CLAIM per document (all fields) the moment it's read —
     the Audit Agent starts verifying while this agent moves to the next file.
  3. Answers CHALLENGEs between documents and after finishing: re-reads the
     disputed field and DEFENDs or CONCEDEs.
  4. Infers the best-fit business process from the full bundle.
"""
import asyncio
import json
from pathlib import Path

from app.agents.bus import AgentBus, Message
from app.config import settings
from app.db.session import SessionLocal
from app.db import models
from app.services.events import emit
from app.services.files import prepare_pages, crop_evidence
from app.services.llm import call_agent, image_block

ME, PEER = "doc_agent", "audit_agent"


async def run(bus: AgentBus) -> None:
    case_id = bus.case_id
    seen_doc_types: list[str] = []

    db = SessionLocal()
    try:
        uploads = db.query(models.Upload).filter(models.Upload.case_id == case_id).all()
        templates = {t.code: t for t in db.query(models.DocTypeTemplate).all()}
    finally:
        db.close()

    for up in uploads:
        fname = Path(up.file_path).name
        try:
            doc_type = await _process_upload(bus, up, fname, templates)
            if doc_type:
                seen_doc_types.append(doc_type)
        except Exception as exc:  # noqa: BLE001 — one bad file must not kill the case
            emit(case_id, ME, "error", {"message": f"Failed on '{fname}': {exc}"})
        # Answer any challenges that arrived while we were busy extracting.
        while (msg := bus.try_receive(ME)) is not None:
            await _handle(bus, msg)

    _infer_process(case_id, seen_doc_types)

    await bus.send(ME, PEER, "DOCS_COMPLETE",
                   {"message": "All documents classified and extracted — over to you"})

    # Stay alive answering challenges until the audit is finished.
    while True:
        msg = await bus.receive(ME)
        if msg.type == "AUDIT_COMPLETE":
            break
        await _handle(bus, msg)


async def _process_upload(bus: AgentBus, up: models.Upload, fname: str,
                          templates: dict) -> str | None:
    """Classify + extract one upload, persist results, publish the claim."""
    case_id = bus.case_id
    pages_dir = str(Path(settings.upload_dir) / case_id / "pages")
    pages = prepare_pages(up.file_path, pages_dir)

    db = SessionLocal()
    try:
        doc = models.Document(case_id=case_id, upload_id=up.id, status="UNIDENTIFIED")
        db.add(doc)
        db.commit()
        db.refresh(doc)
        doc_id = str(doc.id)

        if not pages:
            doc.status = "ILLEGIBLE"
            db.commit()
            emit(case_id, ME, "finding",
                 {"message": f"'{fname}': unsupported or unreadable file — marked illegible"})
            return None

        # ---- classify ----
        emit(case_id, ME, "finding", {"message": f"Reading '{fname}'…"})
        cls = await asyncio.to_thread(
            call_agent, "doc_agent_classify",
            [image_block(p) for p in pages[:3]] +
            [{"type": "text", "text": f"File name: {fname}"}],
        )
        doc_type = str(cls.get("doc_type", "OTHER")).upper()
        cls_conf = float(cls.get("confidence", 0))
        template = templates.get(doc_type)
        doc.doc_type_id = template.id if template else None
        doc.classify_confidence = cls_conf
        doc.status = "IDENTIFIED" if template else "UNIDENTIFIED"
        db.commit()
        emit(case_id, ME, "finding",
             {"message": f"'{fname}' is a {doc_type} ({cls_conf:.0f}%) — {cls.get('reason', '')}"})

        if not template:
            return doc_type

        # ---- extract ----
        few_shots = db.query(models.FeedbackExample).filter_by(doc_type=doc_type).limit(5).all()
        shots_txt = "\n".join(
            f"- Past human correction on {s.field_name}: '{s.wrong_value}' was wrong, "
            f"correct was '{s.correct_value}'. {s.context_note}" for s in few_shots
        )
        extraction = await asyncio.to_thread(
            call_agent, "doc_agent_extract",
            [image_block(p) for p in pages[:3]] + [{
                "type": "text",
                "text": "Field template:\n" + json.dumps(template.expected_fields)
                        + (f"\n\nLearn from these past corrections:\n{shots_txt}" if shots_txt else ""),
            }],
        )

        claim_fields = []
        crops_dir = Path(settings.upload_dir) / case_id / "crops"
        for f in extraction.get("fields", []):
            row = models.ExtractedField(
                document_id=doc.id,
                field_name=f.get("name", "?"),
                value_raw=f.get("value_raw"),
                value_normalized=f.get("value_normalized"),
                confidence=float(f.get("confidence", 0)),
                extraction_round=1,
            )
            db.add(row)
            db.flush()
            crop = crop_evidence(pages[0], f.get("bbox"), str(crops_dir / f"{row.id}.png"))
            row.evidence_crop_path = crop
            claim_fields.append({
                "field_id": str(row.id), "name": row.field_name,
                "value": row.value_normalized, "value_raw": row.value_raw,
                "confidence": float(row.confidence),
            })
        db.commit()

        readable = ", ".join(f"{c['name']}='{c['value']}' ({c['confidence']:.0f}%)"
                             for c in claim_fields)
        await bus.send(ME, PEER, "DOC_CLAIM", {
            "message": f"CLAIM [{doc_type}] {readable}",
            "document_id": doc_id, "doc_type": doc_type,
            "page_image": pages[0], "fields": claim_fields,
        })
        return doc_type
    finally:
        db.close()


def _infer_process(case_id: str, doc_types: list[str]) -> None:
    """Best-fit business process from what was uploaded — the user never told us.

    Data-driven: scores every ProcessTemplate by how well the seen document
    types cover its required docs (mandatory docs weigh most). Adding a new
    bank service = adding a template row, no code changes.
    """
    types = set(doc_types)
    db = SessionLocal()
    try:
        best, best_score = None, 0.0
        for t in db.query(models.ProcessTemplate).all():
            req = [r["doc_type"] for r in (t.required_docs or [])]
            mand = [r["doc_type"] for r in (t.required_docs or []) if r.get("mandatory")]
            if not req:
                continue
            overlap = len(types & set(req)) / len(req)
            mand_hit = (len(types & set(mand)) / len(mand)) if mand else 0.5
            # distinctive application forms are strong evidence
            distinctive = 0.15 if any(d in types for d in mand if d.endswith("_FORM")) else 0.0
            score = 0.55 * mand_hit + 0.30 * overlap + distinctive
            if score > best_score:
                best, best_score = t, score
        conf = round(min(best_score * 100, 99.0), 1)
        case = db.query(models.Case).get(case_id)
        if case and best:
            case.inferred_process_id = best.id
            case.inference_confidence = conf
            db.commit()
        label = best.code if best else "UNKNOWN"
    finally:
        db.close()
    emit(case_id, ME, "finding",
         {"message": f"This bundle best fits: {label} ({conf:.0f}% confidence)"})


async def _handle(bus: AgentBus, msg: Message) -> None:
    """Answer one CHALLENGE from the Audit Agent: re-read, then defend or concede."""
    if msg.type != "CHALLENGE":
        return
    case_id = bus.case_id
    p = msg.payload
    field_id, field_name = p.get("field_id"), p.get("field")

    db = SessionLocal()
    try:
        orig = db.query(models.ExtractedField).get(field_id)
        if not orig:
            return
        evidence = orig.evidence_crop_path or p.get("page_image")
        content = [{
            "type": "text",
            "text": f"Field: {field_name}\nYour original reading: '{orig.value_normalized}' "
                    f"({float(orig.confidence):.0f}%)\nChallenge: {p.get('reason', '')}",
        }]
        if evidence:
            content.insert(0, image_block(evidence))
        result = await asyncio.to_thread(call_agent, "doc_agent_reread", content)

        decision = str(result.get("decision", "DEFEND")).upper()
        new_value = result.get("value", orig.value_normalized)
        new_conf = float(result.get("confidence", orig.confidence or 0))

        if decision == "CONCEDE":
            revised = models.ExtractedField(
                document_id=orig.document_id, field_name=orig.field_name,
                value_raw=new_value, value_normalized=new_value,
                confidence=new_conf, evidence_crop_path=orig.evidence_crop_path,
                extraction_round=(orig.extraction_round or 1) + 1,
            )
            db.add(revised)
            db.commit()
            await bus.send(ME, PEER, "CONCEDE", {
                "message": f"You're right on {field_name}: revising to '{new_value}' — "
                           f"{result.get('reasoning', '')}",
                "field_id": field_id, "field": field_name,
                "value": new_value, "confidence": new_conf,
            })
        else:
            await bus.send(ME, PEER, "DEFEND", {
                "message": f"Standing by {field_name}='{orig.value_normalized}': "
                           f"{result.get('reasoning', '')}",
                "field_id": field_id, "field": field_name,
                "value": orig.value_normalized, "confidence": new_conf,
            })
    finally:
        db.close()
