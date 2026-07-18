import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.db.session import get_db
from app.db import models
from app.services.scoring import recompute_scorecard

router = APIRouter()


class ReviewActionIn(BaseModel):
    action: str  # ACCEPT | CORRECT | REJECT_DOC | REQUEST_REUPLOAD | APPROVE_CASE | REJECT_CASE
    discrepancy_id: uuid.UUID | None = None
    corrected_value: str | None = None
    note: str | None = None


@router.post("/{case_id}/actions")
def review_action(case_id: uuid.UUID, body: ReviewActionIn,
                  db: Session = Depends(get_db),
                  user: models.User = Depends(current_user)):
    if user.role not in ("reviewer", "admin"):
        raise HTTPException(403, "Reviewer role required")
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")

    db.add(models.ReviewAction(
        case_id=case_id, reviewer_id=user.id,
        discrepancy_id=body.discrepancy_id,
        action=body.action, corrected_value=body.corrected_value, note=body.note,
    ))

    if body.discrepancy_id:
        disc = db.query(models.Discrepancy).get(body.discrepancy_id)
        if disc:
            if body.action == "ACCEPT":
                disc.resolution = "HUMAN_ACCEPTED"
            elif body.action == "CORRECT":
                disc.resolution = "HUMAN_CORRECTED"
                # Recycle the correction as a few-shot example for the Extractor.
                detail = disc.detail or {}
                db.add(models.FeedbackExample(
                    doc_type=detail.get("doc_type", ""),
                    field_name=detail.get("field", ""),
                    wrong_value=str(detail.get("values", "")),
                    correct_value=body.corrected_value or "",
                    context_note=body.note or "",
                ))

    if body.action == "APPROVE_CASE":
        case.status = "APPROVED"
    elif body.action == "REJECT_CASE":
        case.status = "REJECTED"
    elif body.action == "REQUEST_REUPLOAD":
        case.status = "RETURNED"

    db.commit()

    # Human corrections change the score -> new scorecard version.
    if body.action in ("ACCEPT", "CORRECT"):
        recompute_scorecard(db, case_id)
        db.commit()

    return {"ok": True, "case_status": case.status}
