"""LangGraph pipeline wiring.

Intake -> Classifier -> Extractor -> Verifier -> Cross-Verifier
                            ^                          |
                            |___ dispute loop (max N) _|
                                                       v
                                        Compliance -> Scorecard
"""
from langgraph.graph import StateGraph, END

from app.agents.state import CaseState
from app.agents.intake import intake_node
from app.agents.classifier import classifier_node
from app.agents.extractor import extractor_node
from app.agents.verifier import verifier_node
from app.agents.cross_verifier import cross_verifier_node
from app.agents.compliance import compliance_node
from app.agents.scorecard import scorecard_node
from app.config import settings
from app.db.session import SessionLocal
from app.db import models
from app.services.events import emit


def _route_after_cross_verify(state: CaseState) -> str:
    """The to-and-fro: open disputes go back to the Extractor for re-reads,
    until rounds run out — then unresolved disputes become human-review flags."""
    if state["disputes"] and state["round"] < settings.max_cross_verify_rounds:
        return "extractor"
    return "compliance"


def build_graph():
    g = StateGraph(CaseState)
    g.add_node("intake", intake_node)
    g.add_node("classifier", classifier_node)
    g.add_node("extractor", extractor_node)
    g.add_node("verifier", verifier_node)
    g.add_node("cross_verifier", cross_verifier_node)
    g.add_node("compliance", compliance_node)
    g.add_node("scorecard", scorecard_node)

    g.set_entry_point("intake")
    g.add_edge("intake", "classifier")
    g.add_edge("classifier", "extractor")
    g.add_edge("extractor", "verifier")
    g.add_edge("verifier", "cross_verifier")
    g.add_conditional_edges("cross_verifier", _route_after_cross_verify,
                            {"extractor": "extractor", "compliance": "compliance"})
    g.add_edge("compliance", "scorecard")
    g.add_edge("scorecard", END)
    return g.compile()


pipeline = build_graph()


def run_pipeline(case_id: str) -> None:
    """Entry point called as a FastAPI BackgroundTask."""
    emit(case_id, "pipeline", "started", {"message": "Verification pipeline started"})
    initial: CaseState = {
        "case_id": case_id,
        "documents": [],
        "fields": {},
        "disputes": [],
        "round": 0,
        "findings": [],
        "inferred_process": "",
        "process_confidence": 0.0,
    }
    try:
        pipeline.invoke(initial)
        _set_case_status(case_id, "IN_REVIEW")
        emit(case_id, "pipeline", "completed", {"message": "Case scored and queued for human review"})
    except Exception as exc:  # noqa: BLE001
        emit(case_id, "pipeline", "error", {"message": str(exc)})
        _set_case_status(case_id, "UPLOADED")
        raise


def _set_case_status(case_id: str, status: str) -> None:
    db = SessionLocal()
    try:
        case = db.query(models.Case).get(case_id)
        if case:
            case.status = status
            db.commit()
    finally:
        db.close()
