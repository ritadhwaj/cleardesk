"""SCORECARD AGENT — aggregates the case into the final scorecard.

Split of responsibilities:
- services/scoring.py computes the NUMBER (deterministic math — LLM can't
  inflate its own grade).
- The LLM writes only the human-readable executive SUMMARY of what was
  found, with references to discrepancy IDs.
"""
from app.agents.state import CaseState
from app.services.events import emit
from app.services.scoring import recompute_scorecard
from app.services.llm import call_agent
from app.db.session import SessionLocal


def scorecard_node(state: CaseState) -> dict:
    case_id = state["case_id"]
    emit(case_id, "scorecard", "started", {"message": "Computing correctness scorecard"})

    db = SessionLocal()
    try:
        sc = recompute_scorecard(db, case_id)
        # TODO: summary = call_agent("scorecard", json.dumps({fields, findings}))
        sc.summary = "(summary generation pending)"
        db.commit()
        overall = float(sc.overall_score)
        counts = (sc.auto_verified_count, sc.review_needed_count, sc.hard_fail_count)
    finally:
        db.close()

    emit(case_id, "scorecard", "completed",
         {"message": f"Scorecard ready: {overall}% "
                     f"(auto-verified {counts[0]}, review {counts[1]}, fail {counts[2]})",
          "overall_score": overall})
    return {}
