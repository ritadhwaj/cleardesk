"""Generate future-month salary slips for selected people.

Run:  python sample_docs/generate_future_payslips.py

Adds forward-dated payslips (July / August / September 2026) for Ritadhwaj and
Mohak into their income/ folders, reusing the same layout + salary figures as
the June slip from generate_samples.py so income stays consistent across months
(useful for loan / income-verification demos).
"""
from generate_samples import typed_form, PEOPLE, ROOT

# Future pay periods to emit: (month label, filename token, period string)
FUTURE_MONTHS = [
    ("July 2026",      "july2026",      "01/07/2026 - 31/07/2026"),
    ("August 2026",    "august2026",    "01/08/2026 - 31/08/2026"),
    ("September 2026",  "september2026", "01/09/2026 - 30/09/2026"),
]

TARGETS = {"ritadhwaj", "mohak"}


def make_payslips(p):
    base = ROOT / f"{p['key']}_docs" / "income"
    payname = p.get("payslip_name", p["NAME"])
    for label, token, period in FUTURE_MONTHS:
        typed_form(
            base / f"payslip_{token}.png",
            f"{p['employer']} - SALARY SLIP", label,
            [("Employee Name", payname), ("Employee ID", p["emp_id"]),
             ("Designation", p["designation"]), ("Pay Period", period),
             ("Basic Pay", f"Rs. {p['basic']}"), ("HRA", f"Rs. {p['hra']}"),
             ("Gross Earnings", f"Rs. {p['gross']}"),
             ("Total Deductions", f"Rs. {p['deduct']}"),
             ("NET PAY", f"Rs. {p['net_pay']}")],
            header="#2d6a4f",
        )


if __name__ == "__main__":
    for person in PEOPLE:
        if person["key"] in TARGETS:
            print(f"\n{person['name']} → {person['key']}_docs/income/ (future payslips)")
            make_payslips(person)
    print("\nDone. Future payslips generated.")
