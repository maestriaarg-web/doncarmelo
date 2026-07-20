import re
import sys
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

STYLES = getSampleStyleSheet()
STYLES.add(ParagraphStyle(name="ManualTitle", fontSize=20, leading=24, spaceAfter=14, textColor=colors.HexColor("#161616")))
STYLES.add(ParagraphStyle(name="ManualIntro", fontSize=11, leading=16, spaceAfter=18, textColor=colors.HexColor("#3f3f3f")))
STYLES.add(ParagraphStyle(name="ManualHeading", fontSize=14, leading=18, spaceBefore=18, spaceAfter=8, textColor=colors.HexColor("#c0392b")))
STYLES.add(ParagraphStyle(name="ManualBody", fontSize=11, leading=16, spaceAfter=10, textColor=colors.HexColor("#161616")))
STYLES.add(ParagraphStyle(name="ManualPending", fontSize=10, leading=14, spaceAfter=10, textColor=colors.HexColor("#8a8a8a")))


def build(md_path: Path, pdf_path: Path) -> None:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    story = []
    just_saw_title = False
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith("# "):
            story.append(Paragraph(line[2:], STYLES["ManualTitle"]))
            just_saw_title = True
            story.append(Spacer(1, 2))
            continue
        if line.startswith("## "):
            story.append(Paragraph(line[3:], STYLES["ManualHeading"]))
        elif re.fullmatch(r"\*\[.*\]\*", line):
            story.append(Paragraph(line[1:-1], STYLES["ManualPending"]))
        elif just_saw_title:
            story.append(Paragraph(line, STYLES["ManualIntro"]))
        else:
            story.append(Paragraph(line, STYLES["ManualBody"]))
        just_saw_title = False
        story.append(Spacer(1, 2))

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
    )
    doc.build(story)
    print(f"OK: {pdf_path}")


if __name__ == "__main__":
    base = Path(__file__).parent
    docs_manuales = base.parent.parent.parent / "manuales"
    build(base / "manual-comercio.md", docs_manuales / "Manual del comercio.pdf")
    build(base / "manual-admin.md", docs_manuales / "Manual del administrador.pdf")
