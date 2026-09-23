"""Internal QA PDFs; Tahoma embedding is for this machine's testing only."""
from pathlib import Path
import subprocess
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.pdfencrypt import StandardEncryption

root = Path(__file__).resolve().parents[1]
out = root / "output/pdf/fixtures"
scratch = root / "tmp/pdfs"
out.mkdir(parents=True, exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("ThaiBoundary", "C:/Windows/Fonts/tahoma.ttf"))
w, h = A4
doc = canvas.Canvas(str(out / "thai-30.pdf"), pagesize=A4)
for page in range(6):
    doc.setFont("ThaiBoundary", 16)
    doc.drawString(36, h-42, "แบบทดสอบระบบ 30 ข้อ - ไม่ใช่ข้อสอบรับรอง")
    doc.setFont("ThaiBoundary", 11)
    doc.drawString(36, h-62, f"หน้า {page+1}/6 - ไฟล์ที่โครงการสร้างเพื่อ QA ภายใน")
    for index in range(5):
        n = page*5+index+1
        lines = [f"{n}. แรง 1 N และ {n+1} N ทิศเดียวกัน แรงลัพธ์เท่าไร",
                 f"A. {n+2} N", f"B. {n+1} N", f"C. {n} N", "D. 0 N",
                 f"เฉลย: A แรงทิศเดียวกันบวกกัน 1 + {n+1} = {n+2} N"]
        for line_index, line in enumerate(lines):
            doc.drawString(36, h-95-index*139-line_index*19, line)
    doc.showPage()
doc.save()
locked = canvas.Canvas(str(out / "password-protected.pdf"), pagesize=A4,
    encrypt=StandardEncryption("internal-qa-password", ownerPassword="internal-qa-owner", strength=128))
locked.drawString(36, h-60, "Project-owned encrypted QA fixture. Import must fail safely.")
locked.save()
poppler = Path("C:/Users/kille/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe")
for page in [1,6]:
    subprocess.run([str(poppler), "-f", str(page), "-l", str(page), "-singlefile", "-scale-to", "1300", "-png", str(out / "thai-30.pdf"), str(scratch / f"thai-30-page-{page}")], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
subprocess.run([str(poppler), "-upw", "internal-qa-password", "-singlefile", "-scale-to", "900", "-png", str(out / "password-protected.pdf"), str(scratch / "password-protected")], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
print("Created internal 30-question and password-protected PDF fixtures; rendered QA previews")
