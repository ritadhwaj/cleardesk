"""Seed process & doc-type templates + two demo users.

Run:  python -m app.db.seed
"""
from passlib.hash import bcrypt

from app.db.session import SessionLocal, engine
from app.db import models


KYC_TEMPLATE = {
    "code": "KYC",
    "name": "KYC Verification",
    "required_docs": [
        {"doc_type": "PAN", "mandatory": True},
        {"doc_type": "AADHAAR", "mandatory": True},
        {"doc_type": "PHOTO", "mandatory": False},
    ],
    "rules": [
        {"rule_id": "KYC-01", "description": "Name must match across PAN and Aadhaar", "severity": "FAIL"},
        {"rule_id": "KYC-02", "description": "DOB must match across identity documents", "severity": "FAIL"},
        {"rule_id": "KYC-03", "description": "Aadhaar address must be present and legible", "severity": "WARN"},
    ],
}

LOAN_TEMPLATE = {
    "code": "LOAN",
    "name": "Home Loan Application",
    "required_docs": [
        {"doc_type": "PAN", "mandatory": True},
        {"doc_type": "AADHAAR", "mandatory": True},
        {"doc_type": "PAYSLIP", "mandatory": True},
        {"doc_type": "BANK_STMT", "mandatory": True},
        {"doc_type": "ITR", "mandatory": False},
    ],
    "rules": [
        {"rule_id": "LOAN-01", "description": "Declared income on payslip must match bank credits within 10%", "severity": "FAIL"},
        {"rule_id": "LOAN-02", "description": "Payslips must cover last 3 months", "severity": "WARN"},
        {"rule_id": "LOAN-03", "description": "Name consistent across all documents", "severity": "FAIL"},
    ],
}

DOC_TYPES = [
    {
        "code": "PAN", "display_name": "PAN Card",
        "expected_fields": [
            {"name": "pan_number", "regex": "^[A-Z]{5}[0-9]{4}[A-Z]$", "required": True},
            {"name": "name", "required": True},
            {"name": "dob", "required": True},
        ],
        "validity_rules": [],
    },
    {
        "code": "AADHAAR", "display_name": "Aadhaar Card",
        "expected_fields": [
            {"name": "aadhaar_number", "regex": "^[0-9]{4}\\s?[0-9]{4}\\s?[0-9]{4}$", "required": True},
            {"name": "name", "required": True},
            {"name": "dob", "required": True},
            {"name": "address", "required": True},
        ],
        "validity_rules": [],
    },
    {
        "code": "PAYSLIP", "display_name": "Salary Slip",
        "expected_fields": [
            {"name": "name", "required": True},
            {"name": "employer", "required": True},
            {"name": "month", "required": True},
            {"name": "net_pay", "required": True},
        ],
        "validity_rules": [{"rule": "month_within_last_n", "n": 3}],
    },
    {
        "code": "BANK_STMT", "display_name": "Bank Statement",
        "expected_fields": [
            {"name": "name", "required": True},
            {"name": "account_number", "required": True},
            {"name": "ifsc", "regex": "^[A-Z]{4}0[A-Z0-9]{6}$", "required": True},
            {"name": "period", "required": True},
            {"name": "salary_credits", "required": False},
        ],
        "validity_rules": [],
    },
    {
        "code": "KYC_FORM", "display_name": "KYC Application Form (filled)",
        "expected_fields": [
            {"name": "name", "required": True},
            {"name": "dob", "required": True},
            {"name": "pan_number", "regex": "^[A-Z]{5}[0-9]{4}[A-Z]$", "required": True},
            {"name": "aadhaar_number", "required": False},
            {"name": "mobile", "required": False},
            {"name": "address", "required": True},
        ],
        "validity_rules": [],
    },
    {
        "code": "LOAN_FORM", "display_name": "Loan Application Form (filled)",
        "expected_fields": [
            {"name": "name", "required": True},
            {"name": "dob", "required": False},
            {"name": "pan_number", "required": False},
            {"name": "employer", "required": True},
            {"name": "monthly_income", "required": True},
            {"name": "loan_amount", "required": True},
        ],
        "validity_rules": [],
    },
    {
        "code": "INCOME_DECL", "display_name": "Income Declaration (self-declared)",
        "expected_fields": [
            {"name": "name", "required": True},
            {"name": "employer", "required": True},
            {"name": "monthly_income", "required": True},
            {"name": "loan_amount", "required": False},
        ],
        "validity_rules": [],
    },
    {
        "code": "UTILITY_BILL", "display_name": "Utility Bill (address proof)",
        "expected_fields": [
            {"name": "name", "required": True},
            {"name": "address", "required": True},
            {"name": "billing_period", "required": False},
            {"name": "amount", "required": False},
        ],
        "validity_rules": [],
    },
]


def run() -> None:
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.ProcessTemplate).count() == 0:
            for t in (KYC_TEMPLATE, LOAN_TEMPLATE):
                db.add(models.ProcessTemplate(**t))
        # upsert doc types by code, so re-running seed adds newly defined ones
        existing = {t.code for t in db.query(models.DocTypeTemplate).all()}
        for d in DOC_TYPES:
            if d["code"] not in existing:
                db.add(models.DocTypeTemplate(**d))
        if db.query(models.User).count() == 0:
            db.add(models.User(email="uploader@cleardesk.dev", full_name="Demo Uploader",
                               password_hash=bcrypt.hash("demo1234"), role="uploader"))
            db.add(models.User(email="reviewer@cleardesk.dev", full_name="Demo Reviewer",
                               password_hash=bcrypt.hash("demo1234"), role="reviewer"))
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
