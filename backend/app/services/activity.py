"""Human activity logger — one call per user action, own session (never
fails the main request)."""
from app.db.session import SessionLocal
from app.db import models


def log_activity(user, action: str, category: str, details: str, case=None) -> None:
    db = SessionLocal()
    try:
        db.add(models.ActivityLog(
            user_id=getattr(user, "id", None),
            user_name=getattr(user, "full_name", "system") or "system",
            case_id=getattr(case, "id", None),
            case_ref=getattr(case, "ref_no", None),
            category=category, action=action, details=details,
        ))
        db.commit()
    except Exception:  # noqa: BLE001 — logging must never break the request
        db.rollback()
    finally:
        db.close()
