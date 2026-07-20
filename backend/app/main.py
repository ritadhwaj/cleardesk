from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api import activity, auth, cases, documents, reviews, ws
from app.config import settings
from app.db.session import engine
from app.db import models

app = FastAPI(title="ClearDesk API", version="0.1.0")

# Auth uses Bearer tokens (no cookies), so a wildcard origin is safe. In a
# same-origin deployment (backend serves the SPA) CORS is not even exercised.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
    # auto-seed templates + demo users so a fresh deploy is ready to use
    if settings.auto_seed:
        try:
            from app.db.seed import run as seed_run
            seed_run()
        except Exception as exc:  # noqa: BLE001 — never block startup
            print(f"[startup] seed skipped: {exc}")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# ---- serve the built frontend (single-service deploy) ----------------------
# In production the Docker image copies the Vite build into ./static; when
# present we serve it same-origin so there is no CORS / cross-URL config.
_STATIC = Path(__file__).resolve().parent.parent / "static"
if _STATIC.is_dir():
    if (_STATIC / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=_STATIC / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = _STATIC / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_STATIC / "index.html")   # SPA fallback
