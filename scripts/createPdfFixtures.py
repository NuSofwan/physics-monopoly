"""Project-authored QA fixtures, never represented as teacher-certified questions."""
from pathlib import Path
import subprocess
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader

root = Path(__file__).resolve().parents[1]
out = root / "output/pdf/fixtures"
scratch = root / "tmp/pdfs"
out.mkdir(parents=True, exist_ok=True)
scratch.mkdir(parents=True, exist_ok=True)
font = Path("C:/Windows/Fonts/tahoma.ttf")
pdfmetrics.registerFont(TTFont("ThaiFixture", str(font)))
width, height = A4

def heading(doc, title):
    doc.setFont("ThaiFixture", 18)
    doc.drawString(36, height-42, title)
    doc.setFont("ThaiFixture", 10)
    doc.drawString(36, height-61, "ไฟล์ทดสอบที่โครงการสร้างเอง - ต้องให้ครูตรวจรับก่อนใช้สอน")

def question(doc, number, x, y, size=13):
    doc.setFont("ThaiFixture", size)
    lines = [f"{number}. แรง 1 N และ {number+1} N ทิศเดียวกัน แรงลัพธ์เท่าไร",
             f"A. {number+2} N", f"B. {number+1} N", f"C. {number} N", "D. 0 N",
             f"เฉลย: A แรงทิศเดียวกันบวกกัน 1 + {number+1} = {number+2} N"]
    for line in lines:
        doc.drawString(x, y, line)
        y -= 20

doc = canvas.Canvas(str(out / "thai-text.pdf"), pagesize=A4)
for page in range(2):
    heading(doc, "แบบทดสอบแรงลัพธ์ - ข้อความภาษาไทย")
    for index in range(5):
        question(doc, page*5+index+1, 36, height-100-index*140)
    doc.showPage()
doc.save()

poppler = Path("C:/Users/kille/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe")
subprocess.run([str(poppler), "-f", "1", "-singlefile", "-scale-to", "1800", "-png", str(out / "thai-text.pdf"), str(scratch / "thai-text")], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
doc = canvas.Canvas(str(out / "thai-scan.pdf"), pagesize=A4)
doc.drawImage(ImageReader(str(scratch / "thai-text.png")), 0, 0, width=width, height=height)
doc.save()

doc = canvas.Canvas(str(out / "diagram-formula.pdf"), pagesize=A4)
heading(doc, "แผนภาพแรงและสูตร - ตัวอย่างตรวจภาพ")
question(doc, 1, 36, height-110)
doc.setStrokeColorRGB(0.1, 0.3, 0.55)
doc.setFillColorRGB(0.85, 0.93, 0.96)
doc.rect(200, 350, 140, 100, fill=1)
doc.line(340, 400, 460, 400)
doc.line(460, 400, 448, 406)
doc.line(460, 400, 448, 394)
doc.setFillColorRGB(0.1, 0.2, 0.3)
doc.setFont("ThaiFixture", 16)
doc.drawString(350, 422, "F = ma")
doc.drawString(232, 390, "m = 2 kg")
doc.save()

doc = canvas.Canvas(str(out / "two-columns.pdf"), pagesize=A4)
heading(doc, "สองคอลัมน์ - ต้องตรวจการแยกข้อ")
question(doc, 1, 30, height-115, 7)
question(doc, 2, 310, height-115, 7)
doc.save()

doc = canvas.Canvas(str(out / "over-80-pages.pdf"), pagesize=A4)
for index in range(81):
    doc.setFont("Helvetica", 12)
    doc.drawString(40, height-50, f"Boundary fixture page {index+1} / 81")
    doc.showPage()
doc.save()
for name in ["thai-scan", "diagram-formula", "two-columns"]:
    subprocess.run([str(poppler), "-f", "1", "-singlefile", "-scale-to", "1400", "-png", str(out / f"{name}.pdf"), str(scratch / name)], check=True, creationflags=subprocess.CREATE_NO_WINDOW)
print("Created 5 project-authored PDF fixtures; rendered previews in tmp/pdfs")
