"""Activity log APIs: user-scoped and case-scoped, with server-side
pagination / filtering / sorting, plus Excel & PDF export."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.db.session import get_db
from app.db import models

router = APIRouter()

SORTABLE = {
    "when": models.ActivityLog.created_at,
    "category": models.ActivityLog.category,
    "action": models.ActivityLog.action,
    "details": models.ActivityLog.details,
    "user": models.ActivityLog.user_name,
    "case": models.ActivityLog.case_ref,
}


def _query(db: Session, *, user_id=None, case_id=None, category=None, action=None,
           q=None, sort="when", order="desc"):
    base = db.query(models.ActivityLog)
    if user_id is not None:
        base = base.filter(models.ActivityLog.user_id == user_id)
    if case_id is not None:
        base = base.filter(models.ActivityLog.case_id == case_id)
    if category:
        base = base.filter(models.ActivityLog.category.ilike(f"%{category}%"))
    if action:
        base = base.filter(models.ActivityLog.action.ilike(f"%{action}%"))
    if q:
        base = base.filter(models.ActivityLog.details.ilike(f"%{q}%"))
    col = SORTABLE.get(sort, models.ActivityLog.created_at)
    return base.order_by(col.desc() if order == "desc" else col.asc())


def _serialize(rows):
    return [
        {"id": r.id, "when": r.created_at.isoformat(), "category": r.category,
         "action": r.action, "details": r.details, "user": r.user_name,
         "case": r.case_ref, "case_id": str(r.case_id) if r.case_id else None}
        for r in rows
    ]


def _paginate(base, page: int, page_size: int):
    total = base.count()
    rows = base.offset((max(page, 1) - 1) * page_size).limit(page_size).all()
    return rows, total


def _export(rows, title: str, fmt: str) -> Response:
    from app.services.export import build_table_export, export_filename_for
    headers = ["When (UTC)", "Category", "Action", "Details", "User", "Case"]
    data = [[r.created_at.strftime("%d-%b-%Y %H:%M:%S"), r.category, r.action,
             r.details or "", r.user_name or "", r.case_ref or ""] for r in rows]
    content, media = build_table_export(title, headers, data, fmt)
    fname = f"{export_filename_for('activity_log')}.{fmt}"
    return Response(content=content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/me")
def my_activity(page: int = 1, page_size: int = 10, sort: str = "when",
                order: str = "desc", category: str | None = None,
                action: str | None = None, q: str | None = None,
                db: Session = Depends(get_db),
                user: models.User = Depends(current_user)):
    base = _query(db, user_id=user.id, category=category, action=action,
                  q=q, sort=sort, order=order)
    rows, total = _paginate(base, page, page_size)
    return {"items": _serialize(rows), "total": total}


@router.get("/me/export")
def my_activity_export(format: str = "xlsx", sort: str = "when", order: str = "desc",
                       category: str | None = None, action: str | None = None,
                       q: str | None = None, db: Session = Depends(get_db),
                       user: models.User = Depends(current_user)):
    if format not in ("xlsx", "pdf"):
        raise HTTPException(400, "format must be xlsx or pdf")
    rows = _query(db, user_id=user.id, category=category, action=action,
                  q=q, sort=sort, order=order).limit(2000).all()
    return _export(rows, f"Activity Log — {user.full_name}", format)


@router.get("/cases/{case_id}")
def case_activity(case_id: uuid.UUID, page: int = 1, page_size: int = 10,
                  sort: str = "when", order: str = "desc",
                  category: str | None = None, action: str | None = None,
                  q: str | None = None, db: Session = Depends(get_db),
                  user: models.User = Depends(current_user)):
    base = _query(db, case_id=case_id, category=category, action=action,
                  q=q, sort=sort, order=order)
    rows, total = _paginate(base, page, page_size)
    return {"items": _serialize(rows), "total": total}


@router.get("/cases/{case_id}/export")
def case_activity_export(case_id: uuid.UUID, format: str = "xlsx",
                         sort: str = "when", order: str = "desc",
                         category: str | None = None, action: str | None = None,
                         q: str | None = None, db: Session = Depends(get_db),
                         user: models.User = Depends(current_user)):
    if format not in ("xlsx", "pdf"):
        raise HTTPException(400, "format must be xlsx or pdf")
    case = db.query(models.Case).get(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    rows = _query(db, case_id=case_id, category=category, action=action,
                  q=q, sort=sort, order=order).limit(2000).all()
    return _export(rows, f"Case Activity — {case.ref_no}", format)
