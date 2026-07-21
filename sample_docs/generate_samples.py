"""Generate a rich library of demo bank documents for several people.

Run once:   python sample_docs/generate_samples.py
Output:     sample_docs/<person>_docs/<service>/<files>

Each person gets identity, income, address and service-specific documents,
with deliberate scenario variety (clean, name-variance, DOB-mismatch, messy
handwriting) so you can test many verification paths. Requires Pillow +
reportlab (already in the backend requirements).
"""
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
FONTDIR = "/usr/share/fonts/truetype/dejavu"


def font(sz, style=""):
    names = {"": "DejaVuSans", "b": "DejaVuSans-Bold", "i": "DejaVuSans-Oblique",
             "serif-i": "DejaVuSerif-Italic"}
    try:
        return ImageFont.truetype(f"{FONTDIR}/{names[style]}.ttf", sz)
    except Exception:
        return ImageFont.load_default()


def handwrite(img, pos, text, size=26, jitter=2, slant=0.0, ink="#1a2a6e"):
    x, y = pos
    f = font(size, "serif-i")
    d0 = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    for ch in text:
        if ch == " ":
            x += size * 0.45
            continue
        w, h = int(size * 1.6), int(size * 1.8)
        cimg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(cimg)
        d.text((size * 0.2, size * 0.2), ch, font=f, fill=ink)
        cimg = cimg.rotate(random.uniform(-jitter * 1.5, jitter * 1.5) + slant, resample=Image.BICUBIC)
        img.paste(cimg, (int(x), int(y + random.uniform(-jitter, jitter))), cimg)
        x += d0.textlength(ch, font=f) + random.uniform(-jitter * 0.4, jitter * 0.9)


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if str(path).endswith(".jpg"):
        img.save(path, quality=85)
    elif str(path).endswith(".webp"):
        img.save(path, quality=85)
    else:
        img.save(path)
    print("  ", path.relative_to(ROOT))


# ---------------------------------------------------------------- documents

def pan_card(p, path):
    img = Image.new("RGB", (860, 540), "#e8f0fe"); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 860, 90], fill="#1a3c8f")
    d.text((30, 25), "INCOME TAX DEPARTMENT", font=font(30, "b"), fill="white")
    d.text((560, 25), "GOVT. OF INDIA", font=font(24, "b"), fill="white")
    d.text((30, 120), "Permanent Account Number", font=font(22), fill="#333")
    d.text((30, 165), p["pan"], font=font(46, "b"), fill="#111")
    d.text((30, 250), "Name", font=font(20), fill="#666")
    d.text((30, 280), p["NAME"], font=font(34, "b"), fill="#111")
    d.text((30, 345), "Father's Name", font=font(20), fill="#666")
    d.text((30, 375), p["father"], font=font(26), fill="#111")
    d.text((30, 435), "Date of Birth", font=font(20), fill="#666")
    d.text((30, 465), p["dob"], font=font(30, "b"), fill="#111")
    d.rectangle([640, 200, 820, 420], outline="#999", width=2)
    d.text((690, 300), "PHOTO", font=font(22), fill="#999")
    d.text((600, 500), "SPECIMEN - DEMO ONLY", font=font(16), fill="#c00")
    save(img, path)


def aadhaar_card(p, path, dob=None, blur_dob=False):
    dob = dob or p["dob"]
    img = Image.new("RGB", (860, 540), "#fff8ee"); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 860, 70], fill="#ff9933"); d.rectangle([0, 470, 860, 540], fill="#138808")
    d.text((250, 18), "AADHAAR - UNIQUE ID", font=font(30, "b"), fill="white")
    d.rectangle([40, 110, 220, 330], outline="#999", width=2)
    d.text((95, 210), "PHOTO", font=font(22), fill="#999")
    d.text((260, 120), p["NAME"], font=font(34, "b"), fill="#111")
    d.text((260, 180), f"DOB: {dob}", font=font(28, "b"), fill="#111")
    d.text((260, 230), f"Gender: {p['gender']}", font=font(26), fill="#111")
    d.text((260, 285), "Address:", font=font(20), fill="#333")
    d.text((260, 312), p["addr"], font=font(20), fill="#333")
    d.text((260, 340), p["city"], font=font(20), fill="#333")
    d.text((260, 395), p["aadhaar"], font=font(42, "b"), fill="#111")
    d.text((320, 490), "SPECIMEN - DEMO ONLY", font=font(18), fill="white")
    if blur_dob:
        reg = img.crop((255, 175, 560, 215)).filter(ImageFilter.GaussianBlur(1.6))
        img.paste(reg, (255, 175))
    save(img, path)


def photo(p, path):
    img = Image.new("RGB", (300, 380), "#dfe8f0"); d = ImageDraw.Draw(img)
    d.ellipse([90, 60, 210, 180], fill="#8fa8c0")
    d.ellipse([50, 200, 250, 420], fill=p["shirt"])
    d.text((60, 344), "SPECIMEN PHOTO", font=font(20, "b"), fill="#c00")
    save(img, path)


def typed_form(path, title, subtitle, rows, header="#1e3a5f"):
    h = 200 + len(rows) * 60 + 60
    img = Image.new("RGB", (900, h), "#fdfdfa"); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 900, 80], fill=header)
    d.text((30, 16), title, font=font(26, "b"), fill="white")
    d.text((30, 50), subtitle + " | SPECIMEN - DEMO ONLY", font=font(15), fill="#d5dfe8")
    y = 120
    for label, value in rows:
        d.text((40, y), label, font=font(18), fill="#555")
        d.text((430, y), str(value), font=font(20, "b"), fill="#111")
        d.line([40, y + 34, 860, y + 34], fill="#eee", width=1)
        y += 56
    d.text((560, y + 8), "Authorised Signatory", font=font(15), fill="#888")
    save(img, path)


def handwritten_form(path, title, subtitle, rows, header="#1e3a5f", messy=False, sig_name="Sign"):
    h = 200 + len(rows) * 92 + 100
    img = Image.new("RGB", (900, h), "#fdfdfa"); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 900, 80], fill=header)
    d.text((30, 16), title, font=font(26, "b"), fill="white")
    d.text((30, 50), subtitle + " | SPECIMEN - DEMO ONLY", font=font(15), fill="#d5dfe8")
    y = 120
    for label, value in rows:
        d.text((60, y), label, font=font(17), fill="#444")
        d.line([60, y + 46, 830, y + 46], fill="#999", width=1)
        handwrite(img, (360, y - (12 if messy else 6)), str(value),
                  size=29 if messy else 26, jitter=4.5 if messy else 1.5,
                  slant=random.uniform(-6, 6) if messy else 0)
        y += 92
    d.text((60, y + 8), "Signature:", font=font(17), fill="#444")
    handwrite(img, (200, y - 10), sig_name,
              size=32, jitter=6 if messy else 3, slant=-9)
    if messy:
        img = img.rotate(-1.1, resample=Image.BICUBIC, fillcolor="#e8e8e2").filter(ImageFilter.GaussianBlur(0.6))
    save(img, path)


def bank_statement(p, path):
    img = Image.new("RGB", (1000, 1120), "white"); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1000, 90], fill="#7a1f1f")
    d.text((30, 20), "DEMOBANK", font=font(32, "b"), fill="white")
    d.text((30, 60), "Account Statement - June 2026", font=font(17), fill="#f0d5d5")
    info = [("Account Holder", p["NAME"]), ("Account Number", p["acct"]),
            ("IFSC", p["ifsc"]), ("Period", "01/06/2026 - 30/06/2026")]
    y = 118
    for k, v in info:
        d.text((30, y), k, font=font(17), fill="#666"); d.text((320, y), v, font=font(19, "b"), fill="#111"); y += 40
    d.line([30, y + 8, 970, y + 8], fill="#ccc", width=2)
    sal = p["net_pay"].replace(",", "")
    rows = [("01/06/2026", "Opening Balance", "", "", "1,42,350.00"),
            ("01/06/2026", f"SALARY CREDIT - {p['employer_short']}", "", p["net_pay"] + ".00", "2,17,350.00"),
            ("05/06/2026", "RENT PAYMENT - UPI", "22,000.00", "", "1,95,350.00"),
            ("15/06/2026", "MUTUAL FUND SIP", "10,000.00", "", "1,85,350.00"),
            ("28/06/2026", "CREDIT CARD PAYMENT", "18,500.00", "", "1,66,850.00"),
            ("30/06/2026", "Closing Balance", "", "", "1,66,850.00")]
    y += 30; xs = [30, 170, 540, 700, 840]
    for x, htxt in zip(xs, ["Date", "Description", "Debit", "Credit", "Balance"]):
        d.text((x, y), htxt, font=font(16, "b"), fill="#7a1f1f")
    y += 34
    for row in rows:
        for x, cell in zip(xs, row):
            d.text((x, y), cell, font=font(15), fill="#222")
        d.line([30, y + 26, 970, y + 26], fill="#eee", width=1); y += 36
    d.text((620, y + 30), "SPECIMEN - DEMO ONLY", font=font(18), fill="#c00")
    save(img, path)


def utility_bill(p, path):
    img = Image.new("RGB", (900, 700), "#fffef5"); d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 900, 80], fill="#0b5e2e")
    d.text((30, 22), "STATE POWER DISTRIBUTION", font=font(26, "b"), fill="white")
    lines = [("Bill No", f"SPD/2026/06/{random.randint(100000,999999)}"), ("Consumer Name", p["NAME"]),
             ("Service Address", p["addr"] + ", " + p["city"]), ("Billing Period", "June 2026"),
             ("Units Consumed", f"{random.randint(120,320)} kWh"),
             ("Amount Payable", f"Rs. {random.randint(800,2200)}.00"), ("Due Date", "25/07/2026")]
    y = 120
    for k, v in lines:
        d.text((40, y), k, font=font(18), fill="#555"); d.text((320, y), v, font=font(20, "b"), fill="#111"); y += 62
    d.text((560, y + 20), "SPECIMEN - DEMO ONLY", font=font(18), fill="#c00")
    save(img, path)


def pdf_doc(path, title, sub, rows):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(path), pagesize=A4, topMargin=18 * mm, title=title, author="ClearDesk Demo")
    s = getSampleStyleSheet()
    story = [Paragraph(title, s["Title"]), Paragraph(sub + " | SPECIMEN - DEMO ONLY", s["Normal"]), Spacer(1, 8 * mm)]
    t = Table(rows, colWidths=[62 * mm, 108 * mm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                           ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e2e8f0")),
                           ("FONTSIZE", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 6),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.append(t); doc.build(story)
    print("  ", path.relative_to(ROOT))


# ---------------------------------------------------------------- per person

def generate(p):
    base = ROOT / f"{p['key']}_docs"
    hw = p.get("handwriting", "good")
    messy = hw == "bad"
    parts = p["name"].split()
    sig = f"{parts[0][0]}. {parts[-1]}"   # e.g. "R. Ray"

    # identity
    pan_card(p, base / "identity" / "pan_card.png")
    aadhaar_card(p, base / "identity" / "aadhaar_card.png",
                 dob=p.get("aadhaar_dob"), blur_dob=p.get("blur_dob", False))
    photo(p, base / "identity" / "applicant_photo.png")

    # income details
    payname = p.get("payslip_name", p["NAME"])
    typed_form(base / "income" / "payslip_june2026.png", f"{p['employer']} - SALARY SLIP", "June 2026",
               [("Employee Name", payname), ("Employee ID", p["emp_id"]), ("Designation", p["designation"]),
                ("Pay Period", "01/06/2026 - 30/06/2026"), ("Basic Pay", f"Rs. {p['basic']}"),
                ("HRA", f"Rs. {p['hra']}"), ("Gross Earnings", f"Rs. {p['gross']}"),
                ("Total Deductions", f"Rs. {p['deduct']}"), ("NET PAY", f"Rs. {p['net_pay']}")], header="#2d6a4f")
    bank_statement(p, base / "income" / "bank_statement_june2026.jpg")
    handwritten_form(base / "income" / "income_declaration.jpg", "INCOME DECLARATION FORM",
                     "Self-declaration", [("Applicant Name", p["name"]), ("Employer", p["employer"]),
                                          ("Monthly Net Income (Rs.)", p["net_pay"]),
                                          ("Other Income (Rs.)", p["other_income"])],
                     header="#14205a", messy=messy, sig_name=sig)
    pdf_doc(base / "income" / "form16_fy2025_26.pdf", "FORM 16 - TDS CERTIFICATE", "FY 2025-26 / AY 2026-27",
            [["Employee Name", p["NAME"]], ["Employee PAN", p["pan"]], ["Employer", p["employer"]],
             ["Employer TAN", p["tan"]], ["Gross Salary", f"Rs. {p['annual_income']}"],
             ["Standard Deduction", "Rs. 50,000"], ["TDS Deducted", f"Rs. {p['tds']}"],
             ["Period", "01/04/2025 - 31/03/2026"]])
    typed_form(base / "income" / "itr_acknowledgement.png", "INCOME TAX DEPT - ITR-V", "AY 2026-27",
               [("Name", p["NAME"]), ("PAN", p["pan"]), ("Acknowledgement No.", str(random.randint(10**14, 10**15))),
                ("Assessment Year", "2026-27"), ("Total Income (Rs.)", p["annual_income"]),
                ("Tax Payable (Rs.)", p["tds"]), ("Filing Date", "12/07/2026")], header="#4a3b12")

    # address proof
    utility_bill(p, base / "address" / "utility_bill.webp")

    # full KYC
    handwritten_form(base / "kyc_full" / "kyc_application_form.png", "DEMOBANK - KYC APPLICATION",
                     "Form KYC-01", [("Full Name", p["name"]), ("Date of Birth", p["dob"]),
                                     ("PAN Number", p["pan"]), ("Aadhaar Number", p["aadhaar"]),
                                     ("Mobile", p["mobile"]), ("Address", p["addr"])], messy=messy, sig_name=sig)
    pan_card(p, base / "kyc_full" / "pan_card.png")
    aadhaar_card(p, base / "kyc_full" / "aadhaar_card.png", dob=p.get("aadhaar_dob"), blur_dob=p.get("blur_dob", False))
    photo(p, base / "kyc_full" / "applicant_photo.png")

    # new account
    typed_form(base / "new_account" / "account_opening_form.png", "DEMOBANK - SAVINGS ACCOUNT OPENING", "Form AOF-01",
               [("Full Name", p["NAME"]), ("Date of Birth", p["dob"]), ("PAN", p["pan"]),
                ("Aadhaar", p["aadhaar"]), ("Mobile", p["mobile"]), ("Address", p["addr"]),
                ("Account Type", "SAVINGS - REGULAR"), ("Nominee", p["father"])])
    pan_card(p, base / "new_account" / "pan_card.png")
    aadhaar_card(p, base / "new_account" / "aadhaar_card.png", dob=p.get("aadhaar_dob"))
    photo(p, base / "new_account" / "applicant_photo.png")

    # home loan (identity + income + application)
    pdf_doc(base / "home_loan" / "loan_application.pdf", "DEMOBANK - HOME LOAN APPLICATION", "Form HL-2026",
            [["Applicant Name", p["NAME"]], ["Date of Birth", p["dob"]], ["PAN Number", p["pan"]],
             ["Aadhaar Number", p["aadhaar"]], ["Employer", p["employer"]], ["Monthly Net Income", f"Rs. {p['net_pay']}"],
             ["Loan Amount Requested", f"Rs. {p['loan_amount']}"], ["Loan Tenure", "20 years"]])
    pan_card(p, base / "home_loan" / "pan_card.png")
    aadhaar_card(p, base / "home_loan" / "aadhaar_card.png", dob=p.get("aadhaar_dob"), blur_dob=p.get("blur_dob", False))
    typed_form(base / "home_loan" / "payslip_june2026.png", f"{p['employer']} - SALARY SLIP", "June 2026",
               [("Employee Name", payname), ("Net Pay", f"Rs. {p['net_pay']}"), ("Designation", p["designation"])], header="#2d6a4f")
    bank_statement(p, base / "home_loan" / "bank_statement.jpg")

    # car loan
    handwritten_form(base / "car_loan" / "car_loan_application.jpg", "DEMOBANK - CAR LOAN APPLICATION", "Form CL-2026",
                     [("Applicant Name", p["name"]), ("PAN", p["pan"]), ("Vehicle Model", p["vehicle"]),
                      ("Loan Amount (Rs.)", p["car_loan"]), ("Monthly Income (Rs.)", p["net_pay"])],
                     header="#1f4e5f", messy=messy, sig_name=sig)
    pdf_doc(base / "car_loan" / "vehicle_quotation.pdf", "DEMO MOTORS - PROFORMA INVOICE", "Quotation",
            [["Customer", p["NAME"]], ["Vehicle", p["vehicle"]], ["On-road Price", f"Rs. {p['car_price']}"],
             ["Valid Till", "31/08/2026"]])
    pan_card(p, base / "car_loan" / "pan_card.png")
    typed_form(base / "car_loan" / "payslip.png", f"{p['employer']} - SALARY SLIP", "June 2026",
               [("Employee Name", payname), ("Net Pay", f"Rs. {p['net_pay']}")], header="#2d6a4f")

    # personal loan
    typed_form(base / "personal_loan" / "personal_loan_application.png", "DEMOBANK - PERSONAL LOAN", "Form PL-2026",
               [("Full Name", p["NAME"]), ("PAN", p["pan"]), ("Loan Amount (Rs.)", "5,00,000"),
                ("Purpose", "HOME RENOVATION"), ("Monthly Net Income (Rs.)", p["net_pay"]), ("Employer", p["employer"])], header="#7a1f1f")
    pan_card(p, base / "personal_loan" / "pan_card.png")
    aadhaar_card(p, base / "personal_loan" / "aadhaar_card.png", dob=p.get("aadhaar_dob"))
    typed_form(base / "personal_loan" / "payslip.png", f"{p['employer']} - SALARY SLIP", "June 2026",
               [("Employee Name", payname), ("Net Pay", f"Rs. {p['net_pay']}")], header="#2d6a4f")

    # credit card
    typed_form(base / "credit_card" / "credit_card_application.png", "DEMOBANK - CREDIT CARD", "Platinum Rewards",
               [("Full Name", p["NAME"]), ("PAN", p["pan"]), ("Aadhaar", p["aadhaar"]),
                ("Monthly Net Income (Rs.)", p["net_pay"]), ("Employer", p["employer"]), ("Card Variant", "PLATINUM")], header="#5b2160")
    pan_card(p, base / "credit_card" / "pan_card.png")
    aadhaar_card(p, base / "credit_card" / "aadhaar_card.png", dob=p.get("aadhaar_dob"))
    typed_form(base / "credit_card" / "payslip.png", f"{p['employer']} - SALARY SLIP", "June 2026",
               [("Employee Name", payname), ("Net Pay", f"Rs. {p['net_pay']}")], header="#2d6a4f")


PEOPLE = [
    dict(key="ritadhwaj", name="Ritadhwaj Ray", NAME="RITADHWAJ RAY", father="Sample Father Ray",
         pan="ABCDE1234F", aadhaar="4444 5555 6666", dob="12/04/1999", aadhaar_dob="21/04/1999",
         blur_dob=True, gender="MALE", mobile="9876543210", addr="12 Demo Street, Sample Nagar",
         city="Kolkata, West Bengal - 700001", employer="Democorp Technologies Pvt Ltd",
         employer_short="DEMOCORP", emp_id="DC-4821", designation="Software Engineer", tan="CALD01234E",
         acct="50100123457890", ifsc="DEMO0001234",
         basic="55,000", hra="22,000", gross="90,000", deduct="15,000", net_pay="75,000",
         annual_income="10,80,000", tds="98,400", other_income="5,000", loan_amount="25,00,000",
         vehicle="Maruti Grand Vitara ZX", car_loan="13,50,000", car_price="16,80,000",
         shirt="#5c7a99", payslip_name="R. Ray", handwriting="good"),   # DOB mismatch + name variance
    dict(key="priya", name="Priya Sharma", NAME="PRIYA SHARMA", father="Rajesh Sharma",
         pan="PQRSX5678L", aadhaar="7777 8888 9999", dob="03/09/1993", gender="FEMALE",
         mobile="9811122233", addr="45 Green Park, Sector 18", city="Noida, Uttar Pradesh - 201301",
         employer="Nova Analytics Ltd", employer_short="NOVA", emp_id="NA-2210", designation="Data Scientist",
         acct="50100987654321", ifsc="DEMO0005678",
         tan="DELN04521B", basic="70,000", hra="28,000", gross="1,12,000", deduct="18,000", net_pay="94,000",
         annual_income="13,44,000", tds="1,24,000", other_income="8,000", loan_amount="40,00,000",
         vehicle="Hyundai Creta SX", car_loan="16,00,000", car_price="19,50,000",
         shirt="#7c5cb0", handwriting="good"),   # clean / happy path
    dict(key="mohak", name="Mohak Kumar", NAME="MOHAK KUMAR", father="Suresh Kumar",
         pan="LMNOP9012K", aadhaar="1212 3434 5656", dob="27/11/1988", gender="MALE",
         mobile="9700055500", addr="8 Lake View Road, Banjara Hills", city="Hyderabad, Telangana - 500034",
         employer="Skyline Constructions", employer_short="SKYLINE", emp_id="SC-0098", designation="Site Manager",
         acct="50100555566667", ifsc="DEMO0003344",
         tan="HYDS08832C", basic="48,000", hra="19,000", gross="78,000", deduct="13,000", net_pay="65,000",
         annual_income="9,36,000", tds="72,000", other_income="12,000", loan_amount="18,00,000",
         vehicle="Tata Nexon XZ", car_loan="9,00,000", car_price="11,20,000",
         shirt="#4a7c59", payslip_name="M. Kumar", handwriting="bad"),   # messy handwriting + name variance
    dict(key="meera", name="Meera Nair", NAME="MEERA NAIR", father="Krishnan Nair",
         pan="RSTUV3456M", aadhaar="2323 4545 6767", dob="15/06/1996", gender="FEMALE",
         mobile="9633014785", addr="21 Marine Drive, Fort Kochi", city="Kochi, Kerala - 682001",
         employer="Coastal Fintech Pvt Ltd", employer_short="COASTAL", emp_id="CF-5567", designation="Product Manager",
         acct="50100112233445", ifsc="DEMO0009900",
         tan="COKC02290D", basic="62,000", hra="25,000", gross="99,000", deduct="16,000", net_pay="83,000",
         annual_income="11,88,000", tds="1,05,000", other_income="6,000", loan_amount="32,00,000",
         vehicle="Kia Seltos HTX", car_loan="14,50,000", car_price="17,90,000",
         shirt="#b0685c", handwriting="good"),   # clean
]


if __name__ == "__main__":
    for person in PEOPLE:
        print(f"\n{person['name']} → {person['key']}_docs/")
        random.seed(hash(person["key"]) & 0xffff)
        generate(person)
    print("\nDone. Sample documents generated under sample_docs/<person>_docs/.")
