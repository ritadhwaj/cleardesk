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


def fields_map(db: Session, case_id) -> dict:
    """Flat snapshot of latest extracted fields: {'PAN.name': 'RITADHWAJ RAY', ...}"""
    docs = db.query(models.Document).filter(models.Document.case_id == case_id).all()
    codes = {t.id: t.code for t in db.query(models.DocTypeTemplate).all()}
    out: dict[str, str] = {}
    for d in docs:
        code = codes.get(d.doc_type_id, "UNKNOWN")
        latest: dict[str, models.ExtractedField] = {}
        for f in d.fields:
            cur = latest.get(f.field_name)
            if cur is None or (f.extraction_round or 1) > (cur.extraction_round or 1):
                latest[f.field_name] = f
        for name, f in latest.items():
            out[f"{code}.{name}"] = f.value_normalized or ""
    return out


def diff_fields(prev: dict, new: dict) -> dict:
    """added / updated / deleted between two field snapshots."""
    added = [{"field": k, "value": v} for k, v in new.items() if k not in prev]
    deleted = [{"field": k, "old": v} for k, v in prev.items() if k not in new]
    updated = [{"field": k, "old": prev[k], "new": v}
               for k, v in new.items() if k in prev and prev[k] != v]
    return {"added": added, "updated": updated, "deleted": deleted}


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
    checklist, completeness = compute_checklist(db, case_id)

    sc = models.Scorecard(
        case_id=case_id,
        version=(last.version + 1) if last else 1,
        overall_score=overall,
        doc_scores=doc_scores,
        summary=last.summary if last else "",
        auto_verified_count=auto_verified,
        review_needed_count=review_needed + len(open_discrepancies),
        hard_fail_count=hard_fails,
        completeness_score=completeness,
        checklist=checklist,
    )
    db.add(sc)
    return sc


def compute_checklist(db: Session, case_id):
    """Against the case's template, which required documents are present.
    Returns (checklist rows, completeness % over mandatory docs)."""
    case = db.query(models.Case).get(case_id)
    if not case or not case.inferred_process_id:
        return [], None
    tpl = db.query(models.ProcessTemplate).get(case.inferred_process_id)
    if not tpl or not tpl.required_docs:
        return [], None

    doc_names = {t.code: t.display_name for t in db.query(models.DocTypeTemplate).all()}
    type_by_id = {t.id: t.code for t in db.query(models.DocTypeTemplate).all()}
    present = set()
    for d in db.query(models.Document).filter(models.Document.case_id == case_id).all():
        if d.doc_type_id and d.status == "IDENTIFIED":
            present.add(type_by_id.get(d.doc_type_id))

    checklist = [
        {"code": r["doc_type"], "name": doc_names.get(r["doc_type"], r["doc_type"]),
         "mandatory": bool(r.get("mandatory")), "present": r["doc_type"] in present}
        for r in tpl.required_docs
    ]
    mand = [c for c in checklist if c["mandatory"]]
    completeness = (round(100 * sum(1 for c in mand if c["present"]) / len(mand), 2)
                    if mand else 100.0)
    return checklist, completeness
