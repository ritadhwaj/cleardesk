import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.config import settings
from app.db.session import get_db, SessionLocal
from app.db import models
from app.agents.orchestrator import run_pipeline
from app.services.scoring import fields_map
from app.services.activity import log_activity

router = APIRouter()


@router.post("")
def create_case(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    case = models.Case(created_by=user.id, status="UPLOADED", updated_by=user.full_name)
    db.add(case)
    db.commit()
    db.refresh(case)
    log_activity(user, "CASE_CREATED", "CASE", f"Created case {case.ref_no}", case)
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
    log_activity(user, "FILES_UPLOADED", "DOCUMENT",
                 f"Uploaded {len(saved)} file(s): {', '.join(saved[:5])}", case)
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
    case.updated_by = user.full_name
    run = models.CaseRun(case_id=case_id, run_no=1, trigger="INITIAL")
    db.add(run)
    db.commit()
    db.refresh(run)
    log_activity(user, "RUN_STARTED", "CASE",
                 f"Started agent verification (run #{run.run_no})", case)
    # The whole agent pipeline runs as a background task; progress streams over WS.
    background.add_task(run_pipeline, str(case_id), str(run.id))
    return {"status": "PROCESSING"}


class ResubmitIn(BaseModel):
    note: str | None = None


@router.post("/{case_id}/resubmit")
def resubmit_case(
    case_id: uuid.UUID,
    body: ResubmitIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: models.User = Depends(current_user),
):
    """Edit-and-retry: snapshots current fields, wipes the previous analysis,
    and reruns the agents. The CaseRun row audits the retry + resulting diff."""
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if case.status == "PROCESSING":
        raise HTTPException(409, "Case is already processing")

    snapshot = fields_map(db, case_id)
    last = (db.query(models.CaseRun).filter(models.CaseRun.case_id == case_id)
            .order_by(models.CaseRun.run_no.desc()).first())
    run = models.CaseRun(case_id=case_id, run_no=(last.run_no + 1) if last else 1,
                         trigger="RETRY", note=body.note, prev_fields=snapshot)
    db.add(run)

    # wipe previous analysis (scorecards + agent_events + review_actions are KEPT as audit)
    doc_ids = [d.id for d in db.query(models.Document)
               .filter(models.Document.case_id == case_id).all()]
    if doc_ids:
        db.query(models.ExtractedField).filter(
            models.ExtractedField.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(models.Document).filter(
            models.Document.id.in_(doc_ids)).delete(synchronize_session=False)
    db.query(models.Discrepancy).filter(
        models.Discrepancy.case_id == case_id).delete(synchronize_session=False)

    case.status = "PROCESSING"
    case.updated_by = user.full_name
    db.commit()
    db.refresh(run)
    log_activity(user, "CASE_RESUBMITTED", "RETRY",
                 f"Resubmitted for retry #{run.run_no}"
                 + (f' — "{body.note}"' if body.note else ""), case)
    background.add_task(run_pipeline, str(case_id), str(run.id))
    return {"status": "PROCESSING", "run_no": run.run_no}


@router.delete("/{case_id}/uploads/{upload_id}")
def delete_upload(case_id: uuid.UUID, upload_id: uuid.UUID,
                  db: Session = Depends(get_db),
                  user: models.User = Depends(current_user)):
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if case.status == "PROCESSING":
        raise HTTPException(409, "Cannot edit while processing")
    up = db.query(models.Upload).get(upload_id)
    if not up or up.case_id != case_id:
        raise HTTPException(404, "Upload not found")
    fname = Path(up.file_path).name
    try:
        Path(up.file_path).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(up)
    db.commit()
    log_activity(user, "UPLOAD_DELETED", "DOCUMENT", f"Removed document '{fname}'", case)
    return {"ok": True}


@router.get("/{case_id}/export")
def export_case(case_id: uuid.UUID, format: str = "xlsx",
                db: Session = Depends(get_db),
                user: models.User = Depends(current_user)):
    from app.services.export import build_export, export_filename
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if format not in ("xlsx", "pdf"):
        raise HTTPException(400, "format must be xlsx or pdf")
    data, media_type = build_export(db, case, format)
    fname = f"{export_filename()}.{format}"
    log_activity(user, f"EXPORTED_{format.upper()}", "EXPORT",
                 f"Exported case scorecard as {fname}", case)
    return Response(content=data, media_type=media_type,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("")
def list_cases(status: str | None = None, q: str | None = None,
               created_by: str | None = None, updated_by: str | None = None,
               page: int = 1, page_size: int = 10,
               sort: str = "created_at", order: str = "desc",
               db: Session = Depends(get_db),
               user: models.User = Depends(current_user)):
    base = (db.query(models.Case, models.User.full_name)
            .outerjoin(models.User, models.Case.created_by == models.User.id))
    if status:
        base = base.filter(models.Case.status.ilike(f"%{status}%"))
    if q:
        base = base.filter((models.Case.name.ilike(f"%{q}%"))
                           | (models.Case.ref_no.ilike(f"%{q}%")))
    if created_by:
        base = base.filter(models.User.full_name.ilike(f"%{created_by}%"))
    if updated_by:
        base = base.filter(models.Case.updated_by.ilike(f"%{updated_by}%"))

    sort_map = {
        "name": models.Case.name, "status": models.Case.status,
        "created_at": models.Case.created_at, "updated_at": models.Case.updated_at,
        "created_by": models.User.full_name, "updated_by": models.Case.updated_by,
    }
    col = sort_map.get(sort, models.Case.created_at)
    base = base.order_by(col.desc() if order == "desc" else col.asc())

    total = base.count()
    rows = base.offset((max(page, 1) - 1) * page_size).limit(page_size).all()

    all_cases = db.query(models.Case.status).all()
    stats = {"total": len(all_cases),
             "in_review": sum(1 for (s,) in all_cases if s == "IN_REVIEW"),
             "approved": sum(1 for (s,) in all_cases if s == "APPROVED")}

    return {
        "items": [
            {"id": str(c.id), "ref_no": c.ref_no, "name": c.name,
             "status": c.status,
             "created_by": creator or "—",
             "updated_by": c.updated_by or creator or "—",
             "created_at": c.created_at.isoformat(),
             "updated_at": (c.updated_at or c.created_at).isoformat()}
            for c, creator in rows
        ],
        "total": total,
        "stats": stats,
    }


@router.get("/{case_id}")
def case_detail(case_id: uuid.UUID, db: Session = Depends(get_db),
                user: models.User = Depends(current_user)):
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    docs = db.query(models.Document).filter(models.Document.case_id == case_id).all()
    discrepancies = db.query(models.Discrepancy).filter(models.Discrepancy.case_id == case_id).all()
    type_codes = {t.id: t.code for t in db.query(models.DocTypeTemplate).all()}
    process = db.query(models.ProcessTemplate).get(case.inferred_process_id) \
        if case.inferred_process_id else None

    def latest_fields(d):
        latest = {}
        for f in d.fields:
            cur = latest.get(f.field_name)
            if cur is None or (f.extraction_round or 1) > (cur.extraction_round or 1):
                latest[f.field_name] = f
        return latest.values()

    uploads = db.query(models.Upload).filter(models.Upload.case_id == case_id).all()
    runs = (db.query(models.CaseRun).filter(models.CaseRun.case_id == case_id)
            .order_by(models.CaseRun.run_no).all())
    scorecard_count = db.query(models.Scorecard).filter(
        models.Scorecard.case_id == case_id).count()

    return {
        "id": str(case.id),
        "ref_no": case.ref_no,
        "name": case.name,
        "status": case.status,
        "inferred_process": process.code if process else None,
        "inference_confidence": float(case.inference_confidence or 0),
        "scorecard_count": scorecard_count,
        "uploads": [{"id": str(u.id), "filename": Path(u.file_path).name} for u in uploads],
        "runs": [
            {"run_no": r.run_no, "trigger": r.trigger, "note": r.note,
             "started_at": r.started_at.isoformat() if r.started_at else None,
             "finished_at": r.finished_at.isoformat() if r.finished_at else None,
             "scorecard_version": r.scorecard_version,
             "field_diff": r.field_diff}
            for r in runs
        ],
        "documents": [
            {
                "id": str(d.id), "status": d.status,
                "doc_type": type_codes.get(d.doc_type_id, "UNKNOWN"),
                "confidence": float(d.classify_confidence or 0),
                "fields": [
                    {
                        "id": str(f.id), "name": f.field_name, "value": f.value_normalized,
                        "confidence": float(f.confidence or 0),
                        "round": f.extraction_round,
                    } for f in latest_fields(d)
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
