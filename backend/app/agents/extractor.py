"""EXTRACTOR AGENT (LLM vision) — pulls template fields from each document
with a confidence score and an evidence bounding box.

Also handles RE-EXTRACTION: when the Cross-Verifier disputes a field, this
agent re-reads just that field (round 2, 3...) with the dispute as context.
Reviewer corrections (feedback_examples) are injected as few-shot examples.
"""
from app.agents.state import CaseState
from app.services.events import emit
from app.services.llm import call_agent, image_block
from app.db.session import SessionLocal
from app.db import models


def extractor_node(state: CaseState) -> dict:
    case_id = state["case_id"]
    new_round = state["round"] + 1
    disputes = state["disputes"]

    if disputes:
        emit(case_id, "extractor", "started",
             {"message": f"Round {new_round}: re-reading {len(disputes)} disputed field(s)"})
        # TODO: for each dispute -> call_agent("extractor", [page image + dispute context])
        # Save result with extraction_round=new_round; compare against previous value.
        for d in disputes:
            emit(case_id, "extractor", "rebuttal",
                 {"message": f"Re-read '{d['field_name']}': (pending implementation)",
                  "dispute": d})
    else:
        emit(case_id, "extractor", "started", {"message": "Extracting fields from all documents"})
        # TODO: for each document ->
        #   template = expected_fields for doc_type
        #   few_shots = db.query(FeedbackExample).filter_by(doc_type=...)
        #   result = call_agent("extractor", [image blocks] + template + few_shots)
        #   persist ExtractedField rows (value, confidence, bbox -> evidence crop)

    emit(case_id, "extractor", "completed", {"message": f"Extraction round {new_round} done"})
    return {"round": new_round, "disputes": [], "fields": state["fields"]}
