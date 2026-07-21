"""Seed process & doc-type templates + two demo users.

Run:  python -m app.db.seed
"""
from passlib.hash import bcrypt

from app.db.session import SessionLocal, engine
from app.db import models


KYC_TEMPLATE = {
    "code": "KYC",
    "name": "Full KYC Verification",
    "description": "Complete Know-Your-Customer identity + address verification.",
    "required_docs": [
        {"doc_type": "PAN", "mandatory": True},
        {"doc_type": "AADHAAR", "mandatory": True},
        {"doc_type": "PHOTO", "mandatory": True},
        {"doc_type": "UTILITY_BILL", "mandatory": False},
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
    "description": "Secured home loan — identity, income and banking proof.",
    "required_docs": [
        {"doc_type": "LOAN_FORM", "mandatory": True},
        {"doc_type": "PAN", "mandatory": True},
        {"doc_type": "AADHAAR", "mandatory": True},
        {"doc_type": "PAYSLIP", "mandatory": True},
        {"doc_type": "BANK_STMT", "mandatory": True},
        {"doc_type": "FORM16", "mandatory": False},
        {"doc_type": "ITR_ACK", "mandatory": False},
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


def _p(code, name, description, docs, rules=None):
    return {"code": code, "name": name, "description": description,
            "required_docs": [{"doc_type": d, "mandatory": m} for d, m in docs],
            "rules": rules or [
                {"rule_id": f"{code}-01",
                 "description": "Applicant name consistent across all documents",
                 "severity": "FAIL"}]}

# Real-world bank workflows requiring document verification, each with its
# mandatory + optional document checklist.
EXTRA_PROCESSES = [
    _p("NEW_ACCOUNT", "Savings Account Opening",
       "Open a new savings account — identity, address & photo.",
       [("ACCOUNT_FORM", True), ("PAN", True), ("AADHAAR", True),
        ("PHOTO", True), ("SIGNATURE_CARD", False), ("UTILITY_BILL", False)]),
    _p("CREDIT_CARD", "Credit Card Application",
       "Apply for a credit card — identity + income eligibility.",
       [("CC_FORM", True), ("PAN", True), ("AADHAAR", True),
        ("PAYSLIP", True), ("BANK_STMT", False)]),
    _p("CAR_LOAN", "Car Loan Application",
       "Vehicle loan — identity, income and the vehicle quotation.",
       [("CAR_LOAN_FORM", True), ("PAN", True), ("AADHAAR", True),
        ("PAYSLIP", True), ("VEHICLE_QUOTE", True), ("BANK_STMT", False)]),
    _p("PERSONAL_LOAN", "Personal Loan Application",
       "Unsecured personal loan — identity + income proof.",
       [("PL_FORM", True), ("PAN", True), ("AADHAAR", True),
        ("PAYSLIP", True), ("BANK_STMT", True)]),
    _p("BUSINESS_LOAN", "MSME / Business Loan",
       "Business loan — proprietor KYC, GST and bank statements.",
       [("BL_FORM", True), ("PAN", True), ("GST_CERT", True),
        ("BANK_STMT", True), ("ITR_ACK", False)]),
    _p("LOCKER", "Locker Facility Request",
       "Safe-deposit locker — account holder KYC + photo.",
       [("LOCKER_FORM", True), ("PAN", True), ("AADHAAR", True), ("PHOTO", False)]),
    _p("DEBIT_CARD", "Debit Card Issuance",
       "Issue / reissue a debit card for an existing account.",
       [("DEBIT_CARD_FORM", True), ("AADHAAR", False)]),
    _p("FASTAG", "FASTag Registration",
       "NETC FASTag — owner KYC + vehicle details.",
       [("FASTAG_FORM", True), ("PAN", False), ("AADHAAR", False)]),
    _p("CHEQUE_BOOK", "Cheque Book Request",
       "Request a new cheque book on an existing account.",
       [("CHEQUE_BOOK_FORM", True)]),
    _p("DORMANT_REACT", "Dormant Account Reactivation",
       "Reactivate an inactive account — fresh KYC required.",
       [("REACTIVATION_FORM", True), ("PAN", True), ("AADHAAR", True)]),
    _p("KYC_PARTIAL", "Partial KYC Update",
       "Update a single KYC field (e.g. address) with proof.",
       [("KYC_FORM", True), ("UTILITY_BILL", True)]),
    _p("NACH_SI", "NACH / Standing Instruction",
       "Set up an auto-debit mandate (SIP, EMI, utility).",
       [("NACH_FORM", True), ("BANK_STMT", False)]),
    _p("PASSBOOK", "Passbook Issue / Reissue",
       "Issue or reprint an account passbook.",
       [("PASSBOOK_FORM", True)]),
    _p("MOBILE_BANKING", "Mobile / Net Banking Registration",
       "Enrol an existing customer for digital banking.",
       [("PAN", True), ("AADHAAR", True), ("DEBIT_CARD_FORM", False)]),
]


def run() -> None:
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        by_code = {p.code: p for p in db.query(models.ProcessTemplate).all()}
        TAX_TEMPLATE = _p("TAX", "Tax Filing Support",
                          "Income-tax filing support — Form 16 / ITR.",
                          [("FORM16", True), ("ITR_ACK", True), ("PAN", True),
                           ("BANK_STMT", False)])
        for t in [KYC_TEMPLATE, LOAN_TEMPLATE, TAX_TEMPLATE] + EXTRA_PROCESSES:
            existing = by_code.get(t["code"])
            if existing:   # refresh checklist/description on re-seed
                existing.name = t["name"]
                existing.description = t.get("description")
                existing.required_docs = t["required_docs"]
                existing.rules = t["rules"]
            else:
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
