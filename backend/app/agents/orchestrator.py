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


async def run_pipeline(case_id: str) -> None:
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
        # TODO: sc.summary = call_agent("scorecard", json of fields+discrepancies)["summary"]
        sc.summary = "(summary generation pending)"
        db.commit()
        emit(case_id, "scorecard", "completed",
             {"message": f"Scorecard ready: {float(sc.overall_score)}% — awaiting human review",
              "overall_score": float(sc.overall_score)})
    finally:
        db.close()

    _set_status(case_id, "IN_REVIEW")
    emit(case_id, "pipeline", "completed",
         {"message": "Case queued for human review"})


def _set_status(case_id: str, status: str) -> None:
    db = SessionLocal()
    try:
        case = db.query(models.Case).get(case_id)
        if case:
            case.status = status
            db.commit()
    finally:
        db.close()
