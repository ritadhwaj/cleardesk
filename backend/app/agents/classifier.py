"""CLASSIFIER AGENT (LLM) — two jobs:
1. Identify each document's type (PAN vs Aadhaar vs payslip ...).
2. Infer the best-fit business process for the WHOLE bundle (KYC vs LOAN vs TAX)
   — the user never tells us; the agent works it out from what was uploaded.
"""
from app.agents.state import CaseState
from app.services.events import emit
from app.services.llm import call_agent, image_block
from app.db.session import SessionLocal
from app.db import models


def classifier_node(state: CaseState) -> dict:
    case_id = state["case_id"]
    emit(case_id, "classifier", "started", {"message": "Identifying document types"})

    documents = state["documents"]
    for doc in documents:
        # LLM vision call: "what document is this?"
        # result = call_agent("classifier", [image_block(p) for p in doc["page_images"]])
        # doc["doc_type"], doc["confidence"] = result["doc_type"], result["confidence"]
        # TODO: wire the real call; stubbed for skeleton
        emit(case_id, "classifier", "finding",
             {"message": f"Document {doc['document_id'][:8]}: type detection pending",
              "document_id": doc["document_id"]})

    # Best-fit process inference from the set of detected types.
    # result = call_agent("classifier_process", str([d["doc_type"] for d in documents]))
    inferred, confidence = "KYC", 0.0  # TODO: real inference

    db = SessionLocal()
    try:
        case = db.query(models.Case).get(case_id)
        template = db.query(models.ProcessTemplate).filter_by(code=inferred).first()
        if case and template:
            case.inferred_process_id = template.id
            case.inference_confidence = confidence
            db.commit()
    finally:
        db.close()

    emit(case_id, "classifier", "completed",
         {"message": f"Best-fit process: {inferred} ({confidence:.0f}%)"})
    return {"documents": documents, "inferred_process": inferred,
            "process_confidence": confidence}
