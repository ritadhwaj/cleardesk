from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

# Managed Postgres providers (Render, Heroku) hand out "postgres://" URLs;
# SQLAlchemy needs the "postgresql://" scheme.
_db_url = settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(_db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    """FastAPI dependency: yields a DB session per request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
