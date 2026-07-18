"""INTAKE AGENT — turns raw messy uploads into clean per-page images.

Not an LLM step (mostly): renders PDF pages to images, detects blank/illegible
pages, splits multi-document files at obvious boundaries.
"""
from app.agents.state import CaseState
from app.services.events import emit
from app.db.session import SessionLocal
from app.db import models


def intake_node(state: CaseState) -> dict:
    case_id = state["case_id"]
    emit(case_id, "intake", "started", {"message": "Reading uploaded files"})

    db = SessionLocal()
    try:
        uploads = db.query(models.Upload).filter(models.Upload.case_id == case_id).all()
        documents = []
        for up in uploads:
            # TODO: render_pages_to_images(up.file_path), detect blanks,
            # split multi-doc PDFs. For now: 1 upload = 1 document.
            doc = models.Document(case_id=case_id, upload_id=up.id, status="UNIDENTIFIED")
            db.add(doc)
            db.flush()
            documents.append({
                "document_id": str(doc.id),
                "doc_type": "UNKNOWN",
                "page_images": [up.file_path],  # TODO: real page images
                "confidence": 0.0,
            })
        db.commit()
    finally:
        db.close()

    emit(case_id, "intake", "completed",
         {"message": f"Prepared {len(documents)} document(s) for classification"})
    return {"documents": documents}
