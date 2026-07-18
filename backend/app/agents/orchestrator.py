"""Orchestrator: launches both agents IN PARALLEL on one case, waits for them
to converge, then produces the scorecard for human review.

    doc_task   = doc_agent.run(bus)     ─┐
                                         ├── asyncio.gather (true concurrency,
    audit_task = audit_agent.run(bus)   ─┘    conversing over the AgentBus)
                    │
                    ▼
    deterministic scorecard  ->  case status IN_REVIEW  ->  human decides
"""
import asyncio

from app.agents.bus import AgentBus
from app.agents import doc_agent, audit_agent
from app.db.session import SessionLocal
from app.db import models
from app.services.events import emit
from app.services.scoring import recompute_scorecard


async def run_pipeline(case_id: str, run_id: str | None = None) -> None:
    """Entry point — FastAPI BackgroundTask (async, runs on the server loop)."""
    emit(case_id, "pipeline", "started",
         {"message": "Doc Agent and Audit Agent starting in parallel"})

    bus = AgentBus(case_id)
    try:
        await asyncio.gather(doc_agent.run(bus), audit_agent.run(bus))
    except Exception as exc:  # noqa: BLE001
        emit(case_id, "pipeline", "error", {"message": str(exc)})
        _set_status(case_id, "UPLOADED")
        raise

    # Agents have converged -> compute the scorecard (deterministic math;
    # see services/scoring.py — the LLM never produces the number).
    emit(case_id, "scorecard", "started", {"message": "Agents converged — computing scorecard"})
    db = SessionLocal()
    try:
        sc = recompute_scorecard(db, case_id)
        sc.summary = await _write_summary(case_id, db)
        db.commit()
        emit(case_id, "scorecard", "completed",
             {"message": f"Scorecard ready: {float(sc.overall_score)}% — awaiting human review",
              "overall_score": float(sc.overall_score)})
        _finalize_run(db, case_id, run_id, sc.version)
        _name_case(db, case_id)
        db.commit()
    finally:
        db.close()

    _set_status(case_id, "IN_REVIEW")
    emit(case_id, "pipeline", "completed",
         {"message": "Case queued for human review"})


async def _write_summary(case_id: str, db) -> str:
    """LLM writes the human-readable summary; never the number."""
    import json
    from app.services.llm import call_agent
    try:
        discrepancies = db.query(models.Discrepancy).filter(
            models.Discrepancy.case_id == case_id).all()
        docs = db.query(models.Document).filter(models.Document.case_id == case_id).all()
        payload = {
            "documents": len(docs),
            "discrepancies": [
                {"severity": d.severity, "title": d.title, "resolution": d.resolution}
                for d in discrepancies
            ],
        }
        result = await asyncio.to_thread(call_agent, "scorecard", json.dumps(payload))
        return result.get("summary", "")
    except Exception:  # noqa: BLE001 — summary is nice-to-have, never fatal
        return "Summary unavailable — see discrepancy list below."


def _finalize_run(db, case_id: str, run_id: str | None, scorecard_version: int) -> None:
    """Close out the run audit row: diff new fields vs the pre-run snapshot."""
    from datetime import datetime
    from app.services.scoring import fields_map, diff_fields
    if not run_id:
        return
    run = db.query(models.CaseRun).get(run_id)
    if not run:
        return
    run.finished_at = datetime.utcnow()
    run.scorecard_version = scorecard_version
    new_fields = fields_map(db, case_id)
    if run.prev_fields is not None:
        run.field_diff = diff_fields(run.prev_fields, new_fields)
        changes = sum(len(v) for v in run.field_diff.values())
        emit(case_id, "pipeline", "finding",
             {"message": f"Retry #{run.run_no} audit: {len(run.field_diff['added'])} added, "
                         f"{len(run.field_diff['updated'])} updated, "
                         f"{len(run.field_diff['deleted'])} deleted "
                         f"({changes} change(s) vs previous run)"})


def _name_case(db, case_id: str) -> None:
    """Give the case a human name fitting the inferred use case + applicant."""
    from app.services.scoring import fields_map
    case = db.query(models.Case).get(case_id)
    if not case:
        return
    process = db.query(models.ProcessTemplate).get(case.inferred_process_id) \
        if case.inferred_process_id else None
    fields = fields_map(db, case_id)
    applicant = next((v.title() for k, v in fields.items()
                      if k.endswith(".name") and v), None)
    base = process.name if process else "Document Verification"
    case.name = f"{base} — {applicant}" if applicant else base


def _set_status(case_id: str, status: str) -> None:
    db = SessionLocal()
    try:
        case = db.query(models.Case).get(case_id)
        if case:
            case.status = status
            db.commit()
    finally:
        db.close()
