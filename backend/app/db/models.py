import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Numeric, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def uid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="uploader")  # uploader | reviewer | admin
    created_at = Column(DateTime, default=datetime.utcnow)


class ProcessTemplate(Base):
    """Business process config: KYC / LOAN / TAX. Data, not code."""
    __tablename__ = "process_templates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    code = Column(String, unique=True, nullable=False)   # 'KYC' | 'LOAN' | 'TAX'
    name = Column(String)
    required_docs = Column(JSONB)   # [{doc_type:'PAN', mandatory:true}, ...]
    rules = Column(JSONB)           # [{rule_id, description, severity}, ...]


class DocTypeTemplate(Base):
    __tablename__ = "doc_type_templates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    code = Column(String, unique=True, nullable=False)   # 'PAN','AADHAAR','PAYSLIP',...
    display_name = Column(String)
    expected_fields = Column(JSONB)  # [{name, regex, required}, ...]
    validity_rules = Column(JSONB)


def generate_ref() -> str:
    """16-char alphanumeric case reference (unambiguous charset)."""
    import secrets
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(16))


class Case(Base):
    __tablename__ = "cases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    ref_no = Column(String(16), unique=True, index=True, default=generate_ref)
    name = Column(String, default="New Verification Case")
    updated_by = Column(String, nullable=True)  # full name of last human actor
    status = Column(String, default="UPLOADED")
    # UPLOADED | PROCESSING | SCORED | IN_REVIEW | APPROVED | REJECTED | RETURNED
    inferred_process_id = Column(UUID(as_uuid=True), ForeignKey("process_templates.id"), nullable=True)
    inference_confidence = Column(Numeric(5, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = relationship("Document", back_populates="case")


class Upload(Base):
    __tablename__ = "uploads"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    file_path = Column(String, nullable=False)
    mime_type = Column(String)
    page_count = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class Document(Base):
    """A logical document after Intake splits/classifies raw uploads."""
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    upload_id = Column(UUID(as_uuid=True), ForeignKey("uploads.id"))
    doc_type_id = Column(UUID(as_uuid=True), ForeignKey("doc_type_templates.id"), nullable=True)
    page_start = Column(Integer)
    page_end = Column(Integer)
    classify_confidence = Column(Numeric(5, 2))
    status = Column(String, default="UNIDENTIFIED")  # IDENTIFIED | UNIDENTIFIED | DUPLICATE | ILLEGIBLE

    case = relationship("Case", back_populates="documents")
    fields = relationship("ExtractedField", back_populates="document")


class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"))
    field_name = Column(String, nullable=False)
    value_raw = Column(Text)          # exactly as read from the doc
    value_normalized = Column(Text)   # cleaned: ISO dates, casefolded names
    confidence = Column(Numeric(5, 2))
    evidence_crop_path = Column(String)  # image snippet shown in review UI
    extraction_round = Column(Integer, default=1)

    document = relationship("Document", back_populates="fields")


class Discrepancy(Base):
    __tablename__ = "discrepancies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    kind = Column(String)      # FIELD_MISMATCH | MISSING_DOC | EXPIRED_DOC | FORMAT_INVALID | RULE_VIOLATION | LOW_CONFIDENCE
    severity = Column(String)  # INFO | WARN | FAIL
    title = Column(String)
    detail = Column(JSONB)     # {field:'name', values:[{doc:'PAN', value:'...'}, ...]}
    raised_by = Column(String)  # agent name
    resolution = Column(String, default="OPEN")  # OPEN | AUTO_RESOLVED | HUMAN_ACCEPTED | HUMAN_CORRECTED
    field_refs = Column(ARRAY(UUID(as_uuid=True)))


class AgentEvent(Base):
    """Full audit trail of everything every agent said/did. Streamed over WS."""
    __tablename__ = "agent_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    agent = Column(String)       # intake | classifier | extractor | verifier | cross_verifier | compliance | scorecard
    event_type = Column(String)  # started | finding | dispute | rebuttal | resolved | completed
    payload = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)


class Scorecard(Base):
    __tablename__ = "scorecards"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    version = Column(Integer, default=1)
    overall_score = Column(Numeric(5, 2))
    doc_scores = Column(JSONB)       # {'PAN': 98.0, 'PAYSLIP': 71.5}
    summary = Column(Text)           # agent-written executive summary
    auto_verified_count = Column(Integer, default=0)
    review_needed_count = Column(Integer, default=0)
    hard_fail_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewAction(Base):
    """Human-in-the-loop decisions — the compliance story."""
    __tablename__ = "review_actions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    discrepancy_id = Column(UUID(as_uuid=True), ForeignKey("discrepancies.id"), nullable=True)
    action = Column(String)  # ACCEPT | CORRECT | REJECT_DOC | REQUEST_REUPLOAD | APPROVE_CASE | REJECT_CASE
    corrected_value = Column(Text, nullable=True)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class CaseRun(Base):
    """Audit of every pipeline run for a case (initial + retries).

    prev_fields = snapshot of extracted fields BEFORE the run,
    field_diff  = added / updated / deleted vs that snapshot AFTER the run.
    """
    __tablename__ = "case_runs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"))
    run_no = Column(Integer, default=1)
    trigger = Column(String, default="INITIAL")  # INITIAL | RETRY
    note = Column(Text, nullable=True)           # uploader's reason for the retry
    prev_fields = Column(JSONB, nullable=True)   # {"PAN.name": "RITADHWAJ RAY", ...}
    field_diff = Column(JSONB, nullable=True)    # {added:[], updated:[], deleted:[]}
    scorecard_version = Column(Integer, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)


class FeedbackExample(Base):
    """Reviewer corrections recycled as few-shot examples for the Extractor."""
    __tablename__ = "feedback_examples"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uid)
    doc_type = Column(String)
    field_name = Column(String)
    wrong_value = Column(Text)
    correct_value = Column(Text)
    context_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
