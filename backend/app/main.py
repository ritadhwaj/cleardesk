from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import activity, auth, cases, documents, reviews, ws
from app.db.session import engine
from app.db import models

app = FastAPI(title="ClearDesk API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(cases.router, prefix="/cases", tags=["cases"])
app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
app.include_router(activity.router, prefix="/activity", tags=["activity"])
app.include_router(ws.router, tags=["ws"])


@app.on_event("startup")
def on_startup() -> None:
    # Hackathon shortcut: create tables directly. Switch to alembic for real migrations.
    models.Base.metadata.create_all(bind=engine)
    # mini-migration: add new columns to existing installs + backfill refs
    from sqlalchemy import text
    from app.db.session import SessionLocal
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS ref_no VARCHAR(16)"))
        conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS name VARCHAR"))
        conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS updated_by VARCHAR"))
    db = SessionLocal()
    try:
        for case in db.query(models.Case).filter(models.Case.ref_no.is_(None)).all():
            case.ref_no = models.generate_ref()
            case.name = case.name or "Verification Case"
        db.commit()
    finally:
        db.close()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
