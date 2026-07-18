"""COMPLIANCE AGENT — maps everything found so far onto the inferred
process's rulebook (ProcessTemplate.rules + required_docs).

Examples: "LOAN requires 3 months of payslips, only 1 found" (WARN),
"KYC-01 name-match rule violated" (FAIL), "ITR missing but optional" (INFO).
"""
from app.agents.state import CaseState
from app.services.events import emit
from app.db.session import SessionLocal
from app.db import models


def compliance_node(state: CaseState) -> dict:
    case_id = state["case_id"]
    emit(case_id, "compliance", "started",
         {"message": f"Checking {state['inferred_process']} process rules"})

    findings = list(state["findings"])
    # TODO:
    # - load ProcessTemplate for state["inferred_process"]
    # - check required_docs against classified documents -> MISSING_DOC findings
    # - evaluate each rule against extracted fields      -> RULE_VIOLATION findings
    # - persist all as Discrepancy rows

    emit(case_id, "compliance", "completed",
         {"message": f"Rule check done ({len(findings)} total finding(s))"})
    return {"findings": findings}
