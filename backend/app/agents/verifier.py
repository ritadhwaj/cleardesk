"""VERIFIER AGENT — per-document template checks. Mostly deterministic:
regex formats (PAN/IFSC/Aadhaar), required-field presence, expiry dates.
LLM only for fuzzy checks (signature presence, tampering signs).
"""
import re

from app.agents.state import CaseState
from app.services.events import emit


def verifier_node(state: CaseState) -> dict:
    case_id = state["case_id"]
    emit(case_id, "verifier", "started", {"message": "Running per-document template checks"})

    findings = list(state["findings"])
    # TODO: for each document:
    #   - load DocTypeTemplate.expected_fields
    #   - regex-validate each extracted field  -> FORMAT_INVALID finding
    #   - check required fields present        -> MISSING field finding
    #   - check validity_rules (expiry, month) -> EXPIRED_DOC finding
    #   persist findings as Discrepancy rows

    emit(case_id, "verifier", "completed",
         {"message": f"Template checks done ({len(findings)} finding(s) so far)"})
    return {"findings": findings}
