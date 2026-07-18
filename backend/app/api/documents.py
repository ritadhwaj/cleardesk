import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.db.session import get_db
from app.db import models

router = APIRouter()


@router.get("/{document_id}/file")
def serve_document(document_id: uuid.UUID, db: Session = Depends(get_db),
                   user: models.User = Depends(current_user)):
    doc = db.query(models.Document).get(document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    upload = db.query(models.Upload).get(doc.upload_id)
    return FileResponse(upload.file_path)


@router.get("/fields/{field_id}/evidence")
def serve_evidence_crop(field_id: uuid.UUID, db: Session = Depends(get_db),
                        user: models.User = Depends(current_user)):
    field = db.query(models.ExtractedField).get(field_id)
    if not field or not field.evidence_crop_path:
        raise HTTPException(404, "Evidence not found")
    return FileResponse(field.evidence_crop_path)
