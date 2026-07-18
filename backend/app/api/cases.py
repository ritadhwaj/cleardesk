import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.config import settings
from app.db.session import get_db, SessionLocal
from app.db import models
from app.agents.orchestrator import run_pipeline

router = APIRouter()


@router.post("")
def create_case(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    case = models.Case(created_by=user.id, status="UPLOADED")
    db.add(case)
    db.commit()
    db.refresh(case)
    return {"id": str(case.id), "status": case.status}


@router.post("/{case_id}/uploads")
async def upload_files(
    case_id: uuid.UUID,
    files: list[UploadFile],
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")

    dest_dir = Path(settings.upload_dir) / str(case_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    saved = []
    for f in files:
        dest = dest_dir / f.filename
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        upload = models.Upload(case_id=case_id, file_path=str(dest), mime_type=f.content_type)
        db.add(upload)
        saved.append(f.filename)
    db.commit()
    return {"saved": saved}


@router.post("/{case_id}/run")
def run_case(
    case_id: uuid.UUID,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    case.status = "PROCESSING"
    db.commit()
    # The whole agent pipeline runs as a background task; progress streams over WS.
    background.add_task(run_pipeline, str(case_id))
    return {"status": "PROCESSING"}


@router.get("")
def list_cases(status: str | None = None, db: Session = Depends(get_db),
               user: models.User = Depends(current_user)):
    q = db.query(models.Case)
    if status:
        q = q.filter(models.Case.status == status)
    return [
        {"id": str(c.id), "status": c.status, "created_at": c.created_at.isoformat()}
        for c in q.order_by(models.Case.created_at.desc()).all()
    ]


@router.get("/{case_id}")
def case_detail(case_id: uuid.UUID, db: Session = Depends(get_db),
                user: models.User = Depends(current_user)):
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    docs = db.query(models.Document).filter(models.Document.case_id == case_id).all()
    discrepancies = db.query(models.Discrepancy).filter(models.Discrepancy.case_id == case_id).all()
    return {
        "id": str(case.id),
        "status": case.status,
        "inference_confidence": float(case.inference_confidence or 0),
        "documents": [
            {
                "id": str(d.id), "status": d.status,
                "confidence": float(d.classify_confidence or 0),
                "fields": [
                    {
                        "name": f.field_name, "value": f.value_normalized,
                        "confidence": float(f.confidence or 0),
                        "round": f.extraction_round,
                    } for f in d.fields
                ],
            } for d in docs
        ],
        "discrepancies": [
            {
                "id": str(x.id), "kind": x.kind, "severity": x.severity,
                "title": x.title, "detail": x.detail, "resolution": x.resolution,
            } for x in discrepancies
        ],
    }


@router.get("/{case_id}/scorecard")
def get_scorecard(case_id: uuid.UUID, db: Session = Depends(get_db),
                  user: models.User = Depends(current_user)):
    sc = (
        db.query(models.Scorecard)
        .filter(models.Scorecard.case_id == case_id)
        .order_by(models.Scorecard.version.desc())
        .first()
    )
    if not sc:
        raise HTTPException(404, "No scorecard yet")
    return {
        "version": sc.version,
        "overall_score": float(sc.overall_score),
        "doc_scores": sc.doc_scores,
        "summary": sc.summary,
        "auto_verified": sc.auto_verified_count,
        "review_needed": sc.review_needed_count,
        "hard_fail": sc.hard_fail_count,
    }


@router.get("/{case_id}/events")
def get_events(case_id: uuid.UUID, after: int = 0, db: Session = Depends(get_db),
               user: models.User = Depends(current_user)):
    events = (
        db.query(models.AgentEvent)
        .filter(models.AgentEvent.case_id == case_id, models.AgentEvent.id > after)
        .order_by(models.AgentEvent.id)
        .limit(200)
        .all()
    )
    return [
        {"id": e.id, "agent": e.agent, "type": e.event_type,
         "payload": e.payload, "at": e.created_at.isoformat()}
        for e in events
    ]
