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

# Compact definitions for the wider bank-service catalogue.
def _t(code, display_name, fields):
    return {"code": code, "display_name": display_name, "validity_rules": [],
            "expected_fields": [{"name": n, "required": r} for n, r in fields]}

DOC_TYPES += [
    _t("ACCOUNT_FORM", "Account Opening Form",
       [("name", True), ("dob", True), ("pan_number", True), ("aadhaar_number", False),
        ("address", True), ("account_type", True), ("nominee", False)]),
    _t("SIGNATURE_CARD", "Specimen Signature Card",
       [("name", True), ("account_type", False)]),
    _t("CC_FORM", "Credit Card Application",
       [("name", True), ("pan_number", True), ("dob", False),
        ("monthly_income", True), ("employer", False), ("card_variant", True)]),
    _t("CAR_LOAN_FORM", "Car Loan Application",
       [("name", True), ("vehicle_model", True), ("on_road_price", False),
        ("loan_amount", True), ("monthly_income", True)]),
    _t("VEHICLE_QUOTE", "Vehicle Quotation / Proforma Invoice",
       [("customer", True), ("vehicle_model", True), ("on_road_price", True)]),
    _t("PL_FORM", "Personal Loan Application",
       [("name", True), ("pan_number", False), ("loan_amount", True),
        ("purpose", True), ("monthly_income", True)]),
    _t("BL_FORM", "Business Loan Application",
       [("business_name", True), ("proprietor_name", True), ("gstin", True),
        ("annual_turnover", True), ("loan_amount", True)]),
    _t("GST_CERT", "GST Registration Certificate",
       [("legal_name", True), ("trade_name", False), ("gstin", True), ("address", True)]),
    _t("LOCKER_FORM", "Locker Facility Application",
       [("name", True), ("account_number", True), ("locker_size", True), ("nominee", False)]),
    _t("DEBIT_CARD_FORM", "Debit Card Request",
       [("name", True), ("account_number", True), ("card_type", True)]),
    _t("FASTAG_FORM", "FASTag Registration",
       [("name", True), ("vehicle_number", True), ("vehicle_model", False), ("mobile", False)]),
    _t("CHEQUE_BOOK_FORM", "Cheque Book Request",
       [("name", True), ("account_number", True), ("leaves", True)]),
    _t("REACTIVATION_FORM", "Dormant Account Reactivation",
       [("name", True), ("account_number", True), ("reason", True), ("mobile", False)]),
    _t("NACH_FORM", "NACH / Standing Instruction Mandate",
       [("name", True), ("account_number", True), ("ifsc", True),
        ("payee", True), ("amount", True), ("frequency", True)]),
    _t("PASSBOOK_FORM", "Passbook Application",
       [("name", True), ("account_number", True), ("request_type", False)]),
    _t("ITR_ACK", "ITR Acknowledgement",
       [("name", True), ("pan_number", True), ("acknowledgement_number", True),
        ("assessment_year", True), ("total_income", False)]),
    _t("FORM16", "Form 16 (TDS Certificate)",
       [("name", True), ("pan_number", True), ("employer", True),
        ("gross_salary", False), ("tds_deducted", False), ("period", False)]),
    _t("PHOTO", "Applicant Photograph", [("photo_present", False)]),
]


def _p(code, name, docs, rules=None):
    return {"code": code, "name": name,
            "required_docs": [{"doc_type": d, "mandatory": m} for d, m in docs],
            "rules": rules or [
                {"rule_id": f"{code}-01",
                 "description": "Applicant name consistent across all documents",
                 "severity": "FAIL"}]}

EXTRA_PROCESSES = [
    _p("NEW_ACCOUNT", "New Account Opening",
       [("ACCOUNT_FORM", True), ("PAN", True), ("AADHAAR", True),
        ("PHOTO", False), ("SIGNATURE_CARD", False)]),
    _p("CREDIT_CARD", "Credit Card Application",
       [("CC_FORM", True), ("PAN", True), ("PAYSLIP", False)]),
    _p("CAR_LOAN", "Car Loan Application",
       [("CAR_LOAN_FORM", True), ("PAN", False), ("PAYSLIP", False), ("VEHICLE_QUOTE", False)]),
    _p("PERSONAL_LOAN", "Personal Loan Application",
       [("PL_FORM", True), ("PAN", False), ("PAYSLIP", True)]),
    _p("BUSINESS_LOAN", "Business Loan (MSME)",
       [("BL_FORM", True), ("GST_CERT", True), ("BANK_STMT", False)]),
    _p("LOCKER", "Locker Facility Request",
       [("LOCKER_FORM", True), ("PAN", False), ("PHOTO", False)]),
    _p("DEBIT_CARD", "Debit Card Issuance", [("DEBIT_CARD_FORM", True)]),
    _p("FASTAG", "FASTag Registration", [("FASTAG_FORM", True)]),
    _p("CHEQUE_BOOK", "Cheque Book Request", [("CHEQUE_BOOK_FORM", True)]),
    _p("DORMANT_REACT", "Dormant Account Reactivation",
       [("REACTIVATION_FORM", True), ("PAN", True), ("AADHAAR", False)]),
    _p("KYC_PARTIAL", "KYC Update (Partial)",
       [("KYC_FORM", True), ("UTILITY_BILL", False)]),
    _p("NACH_SI", "NACH / Standing Instruction Setup", [("NACH_FORM", True)]),
    _p("PASSBOOK", "Passbook Issue / Reissue", [("PASSBOOK_FORM", True)]),
]


def run() -> None:
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_p = {p.code for p in db.query(models.ProcessTemplate).all()}
        TAX_TEMPLATE = _p("TAX", "Tax Filing Support",
                          [("FORM16", True), ("ITR_ACK", False), ("PAN", False)])
        for t in [KYC_TEMPLATE, LOAN_TEMPLATE, TAX_TEMPLATE] + EXTRA_PROCESSES:
            if t["code"] not in existing_p:
                db.add(models.ProcessTemplate(**t))
        # upsert doc types by code, so re-running seed adds newly defined ones
        existing = {t.code for t in db.query(models.DocTypeTemplate).all()}
        for d in DOC_TYPES:
            if d["code"] not in existing:
                db.add(models.DocTypeTemplate(**d))
        # upsert demo users by email so re-running adds newly defined accounts
        demo_users = [
            ("uploader@cleardesk.dev", "Demo Uploader", "uploader"),
            ("reviewer@cleardesk.dev", "Demo Reviewer", "reviewer"),
            ("admin@cleardesk.dev", "Demo Admin", "admin"),   # superuser: can do everything
        ]
        existing_u = {u.email for u in db.query(models.User).all()}
        for email, name, role in demo_users:
            if email not in existing_u:
                db.add(models.User(email=email, full_name=name,
                                   password_hash=bcrypt.hash("demo1234"), role=role))
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
