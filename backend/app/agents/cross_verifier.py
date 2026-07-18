"""CROSS-VERIFIER AGENT (LLM) — the adversarial star of the pipeline.

Checks consistency ACROSS documents: name on PAN vs Aadhaar vs payslip,
income on payslip vs bank credits, dates and addresses lining up.

When it doubts a value it raises a Dispute -> LangGraph routes back to the
Extractor for a re-read (the to-and-fro). After max rounds, unresolved
disputes become LOW_CONFIDENCE discrepancies flagged for human review.
"""
from app.agents.state import CaseState
from app.services.events import emit
from app.services.llm import call_agent
from app.db.session import SessionLocal
from app.db import models


def cross_verifier_node(state: CaseState) -> dict:
    case_id = state["case_id"]
    emit(case_id, "cross_verifier", "started",
         {"message": f"Cross-checking documents (round {state['round']})"})

    disputes = []
    findings = list(state["findings"])

    # TODO:
    # result = call_agent("cross_verifier", json.dumps(state["fields"]))
    # for issue in result["issues"]:
    #     if issue["action"] == "re_extract" and state["round"] < max_rounds:
    #         disputes.append(Dispute(...))          -> loops back to Extractor
    #         emit(..., "dispute", {...})
    #     else:
    #         findings.append(Finding(...))          -> persisted as Discrepancy
    #         emit(..., "finding", {...})

    if disputes:
        emit(case_id, "cross_verifier", "dispute",
             {"message": f"{len(disputes)} field(s) challenged — sending back to Extractor"})
    else:
        emit(case_id, "cross_verifier", "completed",
             {"message": "Cross-verification complete, no open disputes"})

    return {"disputes": disputes, "findings": findings}
