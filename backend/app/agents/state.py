"""Shared state passed between all agents in the LangGraph pipeline."""
from typing import TypedDict


class DocMeta(TypedDict):
    document_id: str
    doc_type: str          # 'PAN', 'AADHAAR', ... or 'UNKNOWN'
    page_images: list[str]
    confidence: float


class Dispute(TypedDict):
    """A cross-verification challenge sent back to the Extractor."""
    document_id: str
    field_name: str
    reason: str            # e.g. "name differs from PAN: 'RITADHWAJ RAY' vs 'RITADWAJ RAY'"
    raised_by: str


class Finding(TypedDict):
    kind: str              # FIELD_MISMATCH | MISSING_DOC | ...
    severity: str          # INFO | WARN | FAIL
    title: str
    detail: dict


class CaseState(TypedDict):
    case_id: str
    documents: list[DocMeta]
    fields: dict           # document_id -> {field_name: {value, confidence, round}}
    disputes: list[Dispute]
    round: int             # extractor <-> cross-verifier round counter
    findings: list[Finding]
    inferred_process: str  # 'KYC' | 'LOAN' | 'TAX'
    process_confidence: float
