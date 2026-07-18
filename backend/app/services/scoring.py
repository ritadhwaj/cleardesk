"""Deterministic scorecard math.

CRITICAL DESIGN DECISION: the LLM never produces the score. Agents produce
*facts* (fields, confidences, discrepancies); this module produces the number.
The AI cannot inflate its own grade.
"""
import uuid

from sqlalchemy.orm import Session

from app.db import models

SEVERITY_PENALTY = {"INFO": 0.0, "WARN": 5.0, "FAIL": 15.0}
REVIEW_THRESHOLD = 75.0  # field confidence below this => needs human review


def recompute_scorecard(db: Session, case_id: uuid.UUID) -> models.Scorecard:
    docs = db.query(models.Document).filter(models.Document.case_id == case_id).all()
    open_discrepancies = (
        db.query(models.Discrepancy)
        .filter(models.Discrepancy.case_id == case_id,
                models.Discrepancy.resolution == "OPEN")
        .all()
    )

    doc_scores: dict[str, float] = {}
    auto_verified = review_needed = 0

    for doc in docs:
        # latest extraction round wins per field (re-reads supersede originals)
        latest: dict[str, object] = {}
        for f in doc.fields:
            cur = latest.get(f.field_name)
            if cur is None or (f.extraction_round or 1) > (cur.extraction_round or 1):
                latest[f.field_name] = f
        fields = list(latest.values())
        if not fields:
            doc_scores[str(doc.id)] = 0.0
            continue
        confidences = [float(f.confidence or 0) for f in fields]
        doc_scores[str(doc.id)] = round(sum(confidences) / len(confidences), 2)
        for c in confidences:
            if c >= REVIEW_THRESHOLD:
                auto_verified += 1
            else:
                review_needed += 1

    base = sum(doc_scores.values()) / len(doc_scores) if doc_scores else 0.0
    penalty = sum(SEVERITY_PENALTY.get(d.severity, 0) for d in open_discrepancies)
    hard_fails = sum(1 for d in open_discrepancies if d.severity == "FAIL")
    overall = max(0.0, round(base - penalty, 2))

    last = (
        db.query(models.Scorecard)
        .filter(models.Scorecard.case_id == case_id)
        .order_by(models.Scorecard.version.desc())
        .first()
    )
    sc = models.Scorecard(
        case_id=case_id,
        version=(last.version + 1) if last else 1,
        overall_score=overall,
        doc_scores=doc_scores,
        summary=last.summary if last else "",
        auto_verified_count=auto_verified,
        review_needed_count=review_needed + len(open_discrepancies),
        hard_fail_count=hard_fails,
    )
    db.add(sc)
    return sc
