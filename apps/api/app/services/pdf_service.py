"""
SiteSecura API - Professional PDF Security Audit Report Generator
Generates corporate, multi-page security assessment reports using ReportLab.
Features:
- Custom two-pass NumberedCanvas with dynamic 'Page X of Y' numbering
- Running corporate headers (pages 2+) and confidential footers (all pages)
- Professional cover page with SiteSecura vector logo and deterministic score display
- Executive summary with high-level metrics scorecard and category breakdown
- Severity-grouped finding cards with impact analysis, evidence, and remediation
- Server-side plan entitlement gating (Free plan redacts findings beyond top 3)
- Prioritized remediation action table
- Technical configuration appendix and defensive posture summary
- Comprehensive methodology and legal disclaimer
- Full Agency white-labeling support (custom logo, brand name, primary color, footer text)
"""

import os
import re
import uuid
import glob
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from PIL import Image as PILImage
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
    PageBreak,
    Image,
)
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing

from app.models.scan import Scan, ScanCheck
from app.models.user import Organization

try:
    from svglib.svglib import svg2rlg
    HAS_SVGLIB = True
except ImportError:
    HAS_SVGLIB = False


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that computes total page count and prints running
    headers on pages 2+ and professional footers on all pages.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.brand_name = "SiteSecura"
        self.brand_color = colors.HexColor("#0284c7")
        self.domain = ""
        self.report_id = ""
        self.footer_text = "Website Security Should Be Simple. • Powered by SiteSecura"
        self.generation_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
        self.doc_title = "SiteSecura - Website Security Assessment Report"
        self.doc_author = "SiteSecura"
        self.doc_subject = "Website security assessment and remediation findings"
        self.doc_creator = "SiteSecura Security Scanner"

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        if hasattr(self, "doc_title") and self.doc_title:
            self.setTitle(self.doc_title)
        if hasattr(self, "doc_author") and self.doc_author:
            self.setAuthor(self.doc_author)
        if hasattr(self, "doc_subject") and self.doc_subject:
            self.setSubject(self.doc_subject)
        if hasattr(self, "doc_creator") and self.doc_creator:
            self.setCreator(self.doc_creator)
        super().save()

    def draw_page_decorations(self, page_count: int):
        self.saveState()
        page_w, page_h = letter

        # Running Header on page 2+
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(self.brand_color)
            self.drawString(40, page_h - 32, self.brand_name.upper())

            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(100, page_h - 32, "|  Website Security Assessment Report")

            target_text = f"https://{self.domain}" if self.domain else ""
            self.drawRightString(page_w - 40, page_h - 32, target_text)

            # Header separator line
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.75)
            self.line(40, page_h - 38, page_w - 40, page_h - 38)

        # Running Footer on all pages
        # Footer separator line
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(40, 42, page_w - 40, 42)

        # Footer Left: Brand & tagline
        self.setFont("Helvetica-Bold", 7.5)
        self.setFillColor(self.brand_color)
        self.drawString(40, 30, self.brand_name)

        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        tagline = f"  •  {self.footer_text}"
        self.drawString(40 + len(self.brand_name) * 5, 30, tagline)

        # Footer Right: Page X of Y & Report ID
        page_info = f"Report: {self.report_id}  |  Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_w - 40, 30, page_info)

        # Sub-footer line: Confidentiality & Date
        self.setFont("Helvetica", 6.5)
        self.setFillColor(colors.HexColor("#94a3b8"))
        self.drawString(40, 18, f"Confidential Security Audit  •  Generated {self.generation_date} UTC  •  Strictly Private")

        self.restoreState()


def _resolve_logo_flowable(org: Optional[Organization] = None) -> Optional[Any]:
    """
    Attempts to load and scale the custom agency logo (raster or SVG) or the default SiteSecura vector logo.
    Returns a scaled ReportLab Flowable (Image or Drawing), or None if unavailable.
    """
    # 1. Check if organization has custom white-label logo configured
    if org and org.logo_url:
        org_id_str = str(org.id)
        candidate_branding_dirs = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..", "storage", "branding", org_id_str)),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..", "storage", "branding", org_id_str)),
            os.path.abspath(os.path.join("storage", "branding", org_id_str)),
        ]
        custom_logo_path = None
        for b_dir in candidate_branding_dirs:
            matches = glob.glob(os.path.join(b_dir, "logo.*"))
            if matches:
                custom_logo_path = matches[0]
                break

        if custom_logo_path and os.path.exists(custom_logo_path):
            ext = os.path.splitext(custom_logo_path)[1].lower()
            if ext == ".svg" and HAS_SVGLIB:
                try:
                    drawing = svg2rlg(custom_logo_path)
                    if drawing and drawing.height > 0:
                        target_height = 40.0
                        scale = target_height / float(drawing.height)
                        drawing.width = drawing.width * scale
                        drawing.height = target_height
                        drawing.scale(scale, scale)
                        return drawing
                except Exception:
                    pass
            elif ext in (".png", ".jpg", ".jpeg", ".webp"):
                try:
                    with PILImage.open(custom_logo_path) as pil_img:
                        orig_w, orig_h = pil_img.size
                    if orig_h > 0:
                        target_h = 36.0
                        scale = target_h / float(orig_h)
                        target_w = min(orig_w * scale, 160.0)
                        return Image(custom_logo_path, width=target_w, height=target_h)
                except Exception:
                    pass

    # 2. Default fallback: Vector SiteSecura logo
    if not HAS_SVGLIB:
        return None

    # Candidate file paths for the logo asset
    possible_paths = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../apps/web/public/brand/sitesecura-logo.svg")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../web/public/brand/sitesecura-logo.svg")),
        os.path.abspath("apps/web/public/brand/sitesecura-logo.svg"),
        os.path.abspath("web/public/brand/sitesecura-logo.svg"),
    ]

    logo_path = None
    for p in possible_paths:
        if os.path.exists(p):
            logo_path = p
            break

    if not logo_path:
        return None

    try:
        drawing = svg2rlg(logo_path)
        if drawing and drawing.height > 0:
            target_height = 42.0
            scale = target_height / float(drawing.height)
            drawing.width = drawing.width * scale
            drawing.height = target_height
            drawing.scale(scale, scale)
            return drawing
    except Exception:
        pass

    return None


from dataclasses import dataclass


@dataclass
class ReportSnapshot:
    scan_id: str
    domain: str
    target_ip: Optional[str]
    created_at: Optional[datetime]
    scan_type: str
    score: int
    risk_level: str
    total_observations: int
    deterministic_count: int
    correlated_count: int
    passed_count: int
    failed_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    info_count: int
    plan: str
    is_free: bool


def _get_check_severity(c: Any) -> str:
    sev = (getattr(c, "severity", None) or "").lower()
    if sev in ("critical", "high", "medium", "low", "info"):
        return sev
    stat = (getattr(c, "status", None) or "").lower()
    if stat == "critical":
        return "critical"
    if stat == "high":
        return "high"
    if stat in ("warning", "medium"):
        return "medium"
    if stat == "low":
        return "low"
    return "info"


def build_report_snapshot(
    scan: Scan,
    checks: List[ScanCheck],
    plan: str = "free",
) -> ReportSnapshot:
    """
    Constructs a deterministic, canonical snapshot of all scan evaluation metrics.
    Guarantees consistent counting of deterministic checks vs correlated risk insights.
    """
    score = scan.score if scan.score is not None else 0
    risk_level = scan.risk_level or "Unknown"
    is_free = (str(plan).lower() == "free")

    total_obs = len(checks)
    f8_count = sum(1 for c in checks if "risk_chain" in (getattr(c, "check_type", "") or "").lower())
    deterministic = total_obs - f8_count

    passed = [c for c in checks if c.status == "pass"]
    failed = [c for c in checks if c.status != "pass"]

    critical = sum(1 for c in failed if _get_check_severity(c) == "critical")
    high = sum(1 for c in failed if _get_check_severity(c) == "high")
    medium = sum(1 for c in failed if _get_check_severity(c) == "medium")
    low = sum(1 for c in failed if _get_check_severity(c) == "low")
    info = sum(1 for c in failed if _get_check_severity(c) == "info")

    return ReportSnapshot(
        scan_id=str(scan.id),
        domain=scan.normalized_domain or scan.domain or "",
        target_ip=scan.target_ip,
        created_at=scan.created_at,
        scan_type=scan.scan_type or "standard",
        score=score,
        risk_level=risk_level,
        total_observations=total_obs,
        deterministic_count=deterministic,
        correlated_count=f8_count,
        passed_count=len(passed),
        failed_count=len(failed),
        critical_count=critical,
        high_count=high,
        medium_count=medium,
        low_count=low,
        info_count=info,
        plan=plan,
        is_free=is_free,
    )


# Backward-compatible alias
_resolve_logo_drawing = _resolve_logo_flowable


def sanitize_report_filename(
    domain: Optional[str],
    date_str: Optional[str] = None,
    brand: str = "SiteSecura",
) -> str:
    """
    Generates a safe, sanitized, meaningful report download filename.
    Removes unsafe path separators, invalid characters, credentials, ports, and query parameters.
    Example: SiteSecura-Security-Report-my-bot-gptweb-vercel-app-2026-10-09.pdf
    """
    brand_clean = re.sub(r"[^a-zA-Z0-9_-]", "", brand).strip() or "SiteSecura"
    if not domain:
        clean_target = "Target"
    else:
        # Strip scheme, path, query, fragments, credentials, port
        clean = re.sub(r"^https?://", "", str(domain).strip(), flags=re.IGNORECASE)
        clean = clean.split("/")[0].split("?")[0].split("#")[0].split(":")[0]
        if "@" in clean:
            clean = clean.split("@")[-1]
        # Replace invalid filename characters (preserving letters, numbers, dots, dashes, underscores)
        clean = re.sub(r"[^a-zA-Z0-9_.-]", "-", clean)
        # Collapse repeated hyphens or underscores
        clean = re.sub(r"[-_]{2,}", "-", clean).strip("-._")
        clean_target = clean[:80] if clean else "Target"

    date_part = f"-{date_str}" if date_str else ""
    return f"{brand_clean}-Security-Report-{clean_target}{date_part}.pdf"


def generate_pdf_report(
    scan: Scan,
    checks: List[ScanCheck],
    org: Optional[Organization] = None,
    plan: str = "free",
    output_directory: str = "/storage/reports",
) -> str:
    """
    Renders a comprehensive, corporate-grade PDF security audit report.
    Enforces server-side plan entitlements (Free tier redacts findings beyond top 3).
    Supports custom Agency white-labeling (logo, brand name, primary color, custom footer).
    """
    os.makedirs(output_directory, exist_ok=True)
    clean_domain_slug = re.sub(r"[^a-zA-Z0-9_-]", "_", scan.normalized_domain or scan.domain or "target")
    plan_slug = re.sub(r"[^a-zA-Z0-9_-]", "_", (plan or "free").strip().lower())
    report_filename = f"SiteSecura-Security-Report-{clean_domain_slug}-{scan.id.hex[:8]}-{plan_slug}.pdf"
    file_path = os.path.join(output_directory, report_filename)

    # White-labeling resolution
    brand_name = org.brand_name if (org and org.brand_name) else "SiteSecura"
    footer_text = org.footer_text if (org and org.footer_text) else "Website Security Should Be Simple."
    primary_hex = org.primary_color if (org and org.primary_color) else "#0284c7"
    try:
        brand_color = colors.HexColor(primary_hex)
    except Exception:
        brand_color = colors.HexColor("#0284c7")

    doc_title = f"{brand_name} - Website Security Assessment Report"
    doc_author = brand_name
    doc_subject = "Website security assessment and remediation findings"
    doc_creator = f"{brand_name} Security Scanner"

    # Document Geometry: Letter size with 40pt horizontal margins & explicit metadata
    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=48,
        title=doc_title,
        author=doc_author,
        subject=doc_subject,
        creator=doc_creator,
    )

    styles = getSampleStyleSheet()

    # Typography Styles
    cover_title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=brand_color,
    )
    cover_sub_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#475569"),
    )
    h1_style = ParagraphStyle(
        "H1Heading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "H2Heading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "BodyRegular",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
        wordWrap="CJK",
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
        wordWrap="CJK",
    )
    mono_style = ParagraphStyle(
        "MonoStyle",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
        wordWrap="CJK",
    )

    # Deterministic canonical report snapshot
    snapshot = build_report_snapshot(scan, checks, plan=plan)
    score = snapshot.score
    risk_level = snapshot.risk_level
    score_color_hex = "#16a34a" if score >= 80 else "#d97706" if score >= 60 else "#dc2626"
    score_color = colors.HexColor(score_color_hex)

    is_free = snapshot.is_free
    report_id = f"RPT-{scan.created_at.strftime('%Y%m%d')}-{scan.id.hex[:6].upper()}" if scan.created_at else f"RPT-{scan.id.hex[:10].upper()}"
    date_formatted = scan.created_at.strftime("%B %d, %Y") if scan.created_at else datetime.now(timezone.utc).strftime("%B %d, %Y")

    # Group and sort checks
    passed_checks = [c for c in checks if c.status == "pass"]
    failed_checks = [c for c in checks if c.status != "pass"]

    # Severity distribution
    critical_findings = [c for c in failed_checks if _get_check_severity(c) == "critical"]
    high_findings = [c for c in failed_checks if _get_check_severity(c) == "high"]
    medium_findings = [c for c in failed_checks if _get_check_severity(c) == "medium"]
    low_findings = [c for c in failed_checks if _get_check_severity(c) == "low"]
    info_findings = [c for c in failed_checks if _get_check_severity(c) == "info"]

    story = []

    # =========================================================================
    # PAGE 1: COVER PAGE
    # =========================================================================
    story.append(Spacer(1, 10))

    logo_drawing = _resolve_logo_flowable(org)
    brand_header_cells = []
    logo_w = 45.0
    if logo_drawing:
        brand_header_cells.append(logo_drawing)
        if hasattr(logo_drawing, "drawWidth"):
            logo_w = float(logo_drawing.drawWidth)
        elif hasattr(logo_drawing, "width"):
            logo_w = float(logo_drawing.width)
    brand_header_cells.append(Paragraph(f"<b>{brand_name}</b>", cover_title_style))

    col1 = max(42.0, min(logo_w + 14.0, 180.0))
    col2 = 532.0 - col1
    logo_table = Table([[cell for cell in brand_header_cells]], colWidths=[col1, col2] if logo_drawing else [532])
    logo_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(logo_table)
    story.append(Spacer(1, 15))

    story.append(Paragraph("Website Security Assessment Report", cover_title_style))
    story.append(Paragraph("Automated Defensive Posture, Infrastructure & Vulnerability Analysis", cover_sub_style))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=2.5, color=brand_color, spaceBefore=4, spaceAfter=18))

    is_deep_scan = (scan.scan_type or "").strip().lower() == "deep"
    scan_mode_label = "Deep Scan" if is_deep_scan else "Normal Scan"

    # Metadata & Target Card
    meta_data = [
        [
            Paragraph("<b>Assessed Target:</b>", body_bold),
            Paragraph(f"<font color='{primary_hex}'><b>https://{scan.normalized_domain or scan.domain}</b></font>", body_bold),
            Paragraph("<b>Target IP Address:</b>", body_bold),
            Paragraph(scan.target_ip or "Protected via CDN / Cloudflare", body_style),
        ],
        [
            Paragraph("<b>Assessment Date:</b>", body_bold),
            Paragraph(date_formatted, body_style),
            Paragraph("<b>Scan Type:</b>", body_bold),
            Paragraph(scan_mode_label, body_style),
        ],
        [
            Paragraph("<b>Report Number:</b>", body_bold),
            Paragraph(report_id, mono_style),
            Paragraph("<b>Scan Duration:</b>", body_bold),
            Paragraph(f"{scan.scan_duration_ms or 0} ms", body_style),
        ],
        [
            Paragraph("<b>Unique Scan ID:</b>", body_bold),
            Paragraph(str(scan.id), mono_style),
            Paragraph("<b>Entitlement Tier:</b>", body_bold),
            Paragraph(plan.capitalize(), body_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[110, 160, 110, 152])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 20))

    # Score Card Banner with dynamic observation terminology
    score_interpretation = (
        "Demonstrates robust defensive security posture with strong protocol enforcement."
        if score >= 85 else
        "Satisfactory baseline security with configuration gaps requiring remediation."
        if score >= 65 else
        "Significant security weaknesses detected. Immediate remediation recommended."
    )
    if snapshot.correlated_count > 0:
        obs_summary_text = f"Evaluated across {snapshot.total_observations} defensive security benchmarks ({snapshot.deterministic_count} deterministic checks + {snapshot.correlated_count} correlated insights)."
    else:
        obs_summary_text = f"Evaluated across {snapshot.total_observations} defensive security benchmarks ({snapshot.total_observations} deterministic checks)."

    score_num_style = ParagraphStyle(
        "ScoreNum",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=30,
        alignment=1,
        textColor=score_color,
    )
    score_label_style = ParagraphStyle(
        "ScoreLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        alignment=1,
        textColor=colors.HexColor("#64748b"),
        spaceBefore=2,
    )
    risk_title_style = ParagraphStyle(
        "RiskTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=score_color,
        spaceAfter=3,
    )
    risk_desc_style = ParagraphStyle(
        "RiskDesc",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
        spaceAfter=3,
        wordWrap="CJK",
    )
    risk_obs_style = ParagraphStyle(
        "RiskObs",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#64748b"),
        wordWrap="CJK",
    )

    left_cell = [
        Paragraph(f'<font size=26 color="{score_color_hex}"><b>{score}</b></font><font size=13 color="#64748b"> / 100</font>', score_num_style),
        Paragraph("OVERALL POSTURE SCORE", score_label_style),
    ]
    right_cell = [
        Paragraph(f"<b>{risk_level.upper()}</b>", risk_title_style),
        Paragraph(score_interpretation, risk_desc_style),
        Paragraph(obs_summary_text, risk_obs_style),
    ]
    score_card_data = [[left_cell, right_cell]]
    score_card_table = Table(score_card_data, colWidths=[150, 382])
    score_card_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1.25, score_color),
        ('LINEAFTER', (0, 0), (0, -1), 0.75, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (0, -1), 8),
        ('RIGHTPADDING', (0, 0), (0, -1), 8),
        ('LEFTPADDING', (1, 0), (1, -1), 12),
        ('RIGHTPADDING', (1, 0), (1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(score_card_table)
    story.append(Spacer(1, 24))

    # Executive Overview Notice
    confidential_box = [
        Paragraph("<b>CONFIDENTIAL SECURITY AUDIT REPORT</b>", ParagraphStyle("ConfTitle", parent=body_bold, textColor=colors.HexColor("#991b1b"))),
        Paragraph(
            f"This automated security evaluation contains observable technical posture details regarding https://{scan.normalized_domain or scan.domain}. "
            "This report is prepared strictly for internal risk evaluation, stakeholder review, and remediation coordination. "
            "Unauthorized distribution or duplication is strictly restricted.",
            ParagraphStyle("ConfBody", parent=body_style, fontSize=7.5, leading=10, textColor=colors.HexColor("#7f1d1d"))
        ),
    ]
    conf_table = Table([[confidential_box]], colWidths=[532])
    conf_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#fecaca")),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(conf_table)

    # End of Cover Page
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: EXECUTIVE SUMMARY & SCORECARD BREAKDOWN
    # =========================================================================
    story.append(Paragraph("1. Executive Summary & Assessment Scorecard", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=brand_color, spaceBefore=2, spaceAfter=8))

    if snapshot.correlated_count > 0:
        checks_narrative = f"A total of <b>{snapshot.total_observations}</b> security observations were recorded ({snapshot.deterministic_count} deterministic checks and {snapshot.correlated_count} correlated security insights)"
    else:
        checks_narrative = f"A total of <b>{snapshot.total_observations}</b> deterministic security checks were performed"

    exec_summary_text = (
        f"{brand_name} conducted an automated defensive security evaluation of <b>https://{scan.normalized_domain or scan.domain}</b>. "
        f"The assessment systematically inspected transport layer encryption, SSL/TLS certificates, domain DNS infrastructure, "
        f"email spoofing defenses (SPF/DMARC), HTTP security response headers, session cookie hygiene, and exposed web technologies. "
        f"{checks_narrative}, yielding an overall security posture score of "
        f"<b>{score}/100</b> ({risk_level}). The scan identified <b>{len(passed_checks)}</b> passing benchmarks and "
        f"<b>{len(failed_checks)}</b> areas for security hardening."
    )
    story.append(Paragraph(exec_summary_text, body_style))
    story.append(Spacer(1, 10))

    # Scorecard Metrics Grid
    metrics_data = [
        [
            Paragraph("<b>Overall Score</b>", body_bold),
            Paragraph("<b>Risk Rating</b>", body_bold),
            Paragraph("<b>Passed Checks</b>", body_bold),
            Paragraph("<b>Total Issues</b>", body_bold),
            Paragraph("<b>Critical / High</b>", body_bold),
        ],
        [
            Paragraph(f"<font size=12 color='{score_color_hex}'><b>{score}/100</b></font>", body_bold),
            Paragraph(f"<b>{risk_level}</b>", body_bold),
            Paragraph(f"<font color='#16a34a'><b>{len(passed_checks)}</b></font> / {snapshot.total_observations}", body_style),
            Paragraph(f"<font color='#dc2626'><b>{len(failed_checks)}</b></font>", body_style),
            Paragraph(f"<b>{len(critical_findings)}</b> Critical, <b>{len(high_findings)}</b> High", body_style),
        ]
    ]
    metrics_table = Table(metrics_data, colWidths=[100, 110, 100, 100, 122])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#ffffff")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(metrics_table)
    story.append(Spacer(1, 14))

    # Category Breakdown Scorecard Table
    story.append(Paragraph("Security Category Breakdown", h2_style))

    # Group checks into standard categories
    categories = {
        "Transport & SSL/TLS": [c for c in checks if any(k in c.check_type.lower() for k in ("ssl", "tls", "https"))],
        "DNS & Email Security": [c for c in checks if any(k in c.check_type.lower() for k in ("dns", "spf", "dmarc", "email"))],
        "HTTP Security Headers": [c for c in checks if any(k in c.check_type.lower() for k in ("header", "hsts", "csp", "frame", "content_type", "xss", "permissions"))],
        "Cookie Security Hygiene": [c for c in checks if "cookie" in c.check_type.lower()],
        "Technology & Server Exposure": [c for c in checks if any(k in c.check_type.lower() for k in ("tech", "server", "disclosure", "version"))],
        "Infrastructure & Cloud Posture": [c for c in checks if any(k in c.check_type.lower() for k in ("infra", "cloud", "cdn", "origin", "git", "deploy", "docker", "k8s", "kubernetes", "storage", "takeover", "mgmt", "management", "metric", "monitor", "actuator"))],
        "Data Security & Privacy Posture": [c for c in checks if any(k in c.check_type.lower() for k in ("data", "pii", "privacy", "gdpr", "ccpa", "consent", "tracking", "document", "financial", "card", "export", "retention", "minimization")) and "risk_chain" not in c.check_type.lower()],
        "Correlation & Risk Chains": [c for c in checks if "risk_chain" in c.check_type.lower()],
    }

    cat_rows = [
        [
            Paragraph("<b>Security Category</b>", body_bold),
            Paragraph("<b>Passed</b>", body_bold),
            Paragraph("<b>Issues</b>", body_bold),
            Paragraph("<b>Status Assessment</b>", body_bold),
        ]
    ]

    for cat_name, cat_checks in categories.items():
        if not cat_checks:
            continue
        c_passed = sum(1 for c in cat_checks if c.status == "pass")
        c_failed = len(cat_checks) - c_passed
        if c_failed == 0:
            cat_status = "<font color='#16a34a'><b>OPTIMAL (PASS)</b></font>"
        elif any(getattr(c, "severity", "") in ("critical", "high") for c in cat_checks if c.status != "pass"):
            cat_status = "<font color='#dc2626'><b>ACTION REQUIRED</b></font>"
        else:
            cat_status = "<font color='#d97706'><b>IMPROVEMENT NEEDED</b></font>"

        cat_rows.append([
            Paragraph(f"<b>{cat_name}</b>", body_style),
            Paragraph(f"<font color='#16a34a'>{c_passed}</font>", body_style),
            Paragraph(f"<font color='{('#dc2626' if c_failed > 0 else '#64748b')}'>{c_failed}</font>", body_style),
            Paragraph(cat_status, body_style),
        ])

    cat_table = Table(cat_rows, colWidths=[200, 70, 70, 192])
    cat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(cat_table)
    story.append(Spacer(1, 4))
    story.append(Paragraph("<font size=7 color='#64748b'><i>Note: Categories with high-severity findings have their category score reduced regardless of baseline passing checks. Informational observations provide technical and environmental visibility without scoring penalties.</i></font>", body_style))

    # Phase F8: Executive Risk Intelligence & Correlated Risk Chains Table
    risk_intel = scan.scan_metadata.get("risk_intelligence") if getattr(scan, "scan_metadata", None) else None
    if risk_intel and isinstance(risk_intel, dict) and risk_intel.get("status") in ("completed", "partial"):
        chains = risk_intel.get("risk_chains", [])
        if chains:
            story.append(Spacer(1, 10))
            story.append(Paragraph("<b>Correlated Risk Chains & Attack Surface Relationships</b>", h2_style))
            chain_rows = [
                [
                    Paragraph("<b>Risk Chain</b>", body_bold),
                    Paragraph("<b>Severity</b>", body_bold),
                    Paragraph("<b>Confidence</b>", body_bold),
                    Paragraph("<b>Affected Surface</b>", body_bold),
                ]
            ]
            for ch in chains[:4]:
                c_sev = (ch.get("severity") or "medium").upper()
                sev_color = "#dc2626" if c_sev == "CRITICAL" else ("#ea580c" if c_sev == "HIGH" else "#d97706")
                assets = ", ".join(ch.get("affected_assets", [])[:2]) or "Target Host"
                chain_rows.append([
                    Paragraph(f"<b>{ch.get('title', '').replace('Correlated Risk Chain: ', '')}</b>", body_style),
                    Paragraph(f"<font color='{sev_color}'><b>{c_sev}</b></font>", body_style),
                    Paragraph(ch.get("confidence", "HIGH"), body_style),
                    Paragraph(assets, mono_style),
                ])
            chain_table = Table(chain_rows, colWidths=[210, 65, 65, 192])
            chain_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ('PADDING', (0, 0), (-1, -1), 4),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(chain_table)

    story.append(Spacer(1, 12))

    # End of Page 2
    story.append(PageBreak())

    # =========================================================================
    # PAGES 3+: ITEMIZED SECURITY FINDINGS (BY SEVERITY)
    # =========================================================================
    story.append(Paragraph("2. Itemized Security Findings", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=brand_color, spaceBefore=2, spaceAfter=8))

    findings_intro = (
        "Security findings are categorized below according to risk severity. Each item details the observable evidence, "
        "potential security impact, and recommended developer remediation steps."
    )
    story.append(Paragraph(findings_intro, body_style))
    story.append(Spacer(1, 8))

    # Flatten findings ordered by score impact
    sorted_findings = sorted(checks, key=lambda c: getattr(c, "score_impact", 0) or 0)

    finding_index = 0
    for check in sorted_findings:
        is_locked_finding = (is_free and finding_index >= 3)
        finding_index += 1

        sev = (getattr(check, "severity", "") or "info").lower()
        if sev == "critical":
            badge_color = "#dc2626"
            badge_bg = "#fef2f2"
            badge_border = "#fecaca"
        elif sev == "high":
            badge_color = "#ea580c"
            badge_bg = "#fff7ed"
            badge_border = "#fed7aa"
        elif sev in ("medium", "warning"):
            badge_color = "#d97706"
            badge_bg = "#fffbeb"
            badge_border = "#fde68a"
        elif sev == "low":
            badge_color = "#0284c7"
            badge_bg = "#f0f9ff"
            badge_border = "#bae6fd"
        else:
            badge_color = "#16a34a" if check.status == "pass" else "#64748b"
            badge_bg = "#f8fafc"
            badge_border = "#e2e8f0"

        status_text = "PASS" if check.status == "pass" else (check.status or "WARN").upper()

        if is_locked_finding:
            # Free Tier Redaction
            card_rows = [
                [
                    Paragraph(f"<font color='{badge_color}'><b>[{sev.upper()}]</b></font> <b>Finding #{finding_index}: {check.title}</b>", body_bold),
                    Paragraph("<font color='#dc2626'><b>LOCKED (UPGRADE REQUIRED)</b></font>", ParagraphStyle("RAlign", parent=body_bold, alignment=2)),
                ],
                [
                    Paragraph("<b>Affected Area:</b>", body_bold),
                    Paragraph(f"{check.check_type}", body_style),
                ],
                [
                    Paragraph("<b>Summary:</b>", body_bold),
                    Paragraph("<i>Finding identified during automated scan. Technical summary and impact analysis locked on Free plan.</i>", body_style),
                ],
                [
                    Paragraph("<b>Evidence & Remediation:</b>", body_bold),
                    Paragraph(
                        "<b>[CONTENT LOCKED]</b> Remediation steps, technical evidence, and step-by-step developer guides "
                        "are locked on the Free plan. Upgrade to SiteSecura Basic, Pro, or Agency to view complete findings and automated fix guides.",
                        ParagraphStyle("LockedP", parent=body_style, textColor=colors.HexColor("#475569"))
                    ),
                ],
            ]
        else:
            # Full Unredacted Finding Content (Paid tiers or Top 3 Free)
            evidence_text = check.evidence if check.evidence else "Observed directly in target HTTP responses."
            why_it_matters = check.why_it_matters if check.why_it_matters else "Defensive security hygiene benchmark."
            how_to_fix = check.how_to_fix if check.how_to_fix else "Review configuration according to standard defensive recommendations."
            doc_url = check.documentation_url if check.documentation_url else ""

            card_rows = [
                [
                    Paragraph(f"<font color='{badge_color}'><b>[{sev.upper()}]</b></font> <b>Finding #{finding_index}: {check.title}</b>", body_bold),
                    Paragraph(f"<font color='{badge_color}'><b>{status_text}</b></font>", ParagraphStyle("RAlign", parent=body_bold, alignment=2)),
                ],
                [
                    Paragraph("<b>Affected Area:</b>", body_bold),
                    Paragraph(f"{check.check_type} &nbsp;&nbsp;|&nbsp;&nbsp; Est. Fix Time: {check.estimated_fix_minutes} min", body_style),
                ],
                [
                    Paragraph("<b>Summary:</b>", body_bold),
                    Paragraph(check.summary or "Evaluation completed.", body_style),
                ],
                [
                    Paragraph("<b>Why it Matters:</b>", body_bold),
                    Paragraph(why_it_matters, body_style),
                ],
                [
                    Paragraph("<b>Observed Evidence:</b>", body_bold),
                    Paragraph(f"<font color='#0f172a'><code>{evidence_text[:280]}</code></font>", mono_style),
                ],
                [
                    Paragraph("<b>Remediation:</b>", body_bold),
                    Paragraph(how_to_fix, body_style),
                ],
            ]
            if doc_url:
                card_rows.append([
                    Paragraph("<b>Reference URL:</b>", body_bold),
                    Paragraph(f"<font color='{primary_hex}'>{doc_url}</font>", body_style),
                ])

        card_table = Table(card_rows, colWidths=[120, 412])
        card_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(badge_bg)),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(badge_border)),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
            ('PADDING', (0, 0), (-1, -1), 4.5),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))

        story.append(KeepTogether([card_table, Spacer(1, 6)]))

    # Free plan upgrade callout block
    if is_free and len(checks) > 3:
        upgrade_box = [
            Paragraph("<b>Unlock All Findings, Automated Fix Guides & Compliance Reports</b>", body_bold),
            Paragraph(
                "Your website assessment identified additional technical findings that are locked on the Free tier. "
                f"Upgrade to a {brand_name} paid subscription (Basic, Pro, Agency) to download fully unlocked reports, "
                "schedule automated continuous monitoring, and export white-labeled executive reports.",
                body_style
            ),
        ]
        up_table = Table([[upgrade_box]], colWidths=[532])
        up_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#bfdbfe")),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(Spacer(1, 8))
        story.append(KeepTogether([up_table, Spacer(1, 8)]))

    story.append(PageBreak())

    # =========================================================================
    # PAGE: RECOMMENDED REMEDIATION PRIORITY
    # =========================================================================
    story.append(Paragraph("3. Recommended Remediation Priority", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=brand_color, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "Remediation actions are structured below by priority to assist engineering teams with efficient fix scheduling.",
        body_style
    ))
    story.append(Spacer(1, 8))

    remediation_rows = [
        [
            Paragraph("<b>Priority Level</b>", body_bold),
            Paragraph("<b>Action Item / Benchmark</b>", body_bold),
            Paragraph("<b>Affected Component</b>", body_bold),
            Paragraph("<b>Est. Time</b>", body_bold),
        ]
    ]

    # Filter actionable recommendations
    actionable_checks = [c for c in checks if c.status != "pass" and c.how_to_fix]
    if not actionable_checks:
        actionable_checks = [c for c in checks if c.status != "pass"]

    for idx, c in enumerate(actionable_checks[:14]):
        sev = (getattr(c, "severity", "") or "low").lower()
        if sev in ("critical", "high"):
            p_label = "<font color='#dc2626'><b>Immediate</b></font>"
        elif sev in ("medium", "warning"):
            p_label = "<font color='#d97706'><b>High Priority</b></font>"
        else:
            p_label = "<font color='#0284c7'><b>Medium Priority</b></font>"

        if is_free and idx >= 3:
            action_text = f"Security Hardening: {c.title} <font color='#64748b'>(Remediation details locked on Free tier)</font>"
            fix_time_text = "—"
        else:
            action_text = f"<b>{c.title}</b>: {c.how_to_fix[:110]}..." if c.how_to_fix else c.title
            fix_time_text = f"{c.estimated_fix_minutes} min" if c.estimated_fix_minutes else "15 min"

        remediation_rows.append([
            Paragraph(p_label, body_style),
            Paragraph(action_text, body_style),
            Paragraph(c.check_type, body_style),
            Paragraph(fix_time_text, body_style),
        ])

    if len(remediation_rows) == 1:
        remediation_rows.append([
            Paragraph("<font color='#16a34a'><b>Optimal</b></font>", body_style),
            Paragraph("No high-severity configuration defects identified.", body_style),
            Paragraph("All Components", body_style),
            Paragraph("0 min", body_style),
        ])

    rem_table = Table(remediation_rows, colWidths=[100, 242, 130, 60])
    rem_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(rem_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # TECHNICAL POSTURE APPENDIX
    # =========================================================================
    story.append(Paragraph("4. Technical Posture Appendix", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=brand_color, spaceBefore=2, spaceAfter=8))

    appendix_data = [
        [Paragraph("<b>Observable Parameter</b>", body_bold), Paragraph("<b>Recorded Audit Value</b>", body_bold)],
        [Paragraph("Target URL", body_bold), Paragraph(f"https://{scan.normalized_domain or scan.domain}", mono_style)],
        [Paragraph("Resolved Target IP", body_bold), Paragraph(scan.target_ip or "CDN / Protected Reverse Proxy", mono_style)],
        [Paragraph("Scan Execution Mode", body_bold), Paragraph(f"{scan_mode_label} audit pipeline", body_style)],
        [Paragraph("Assessment Date (UTC)", body_bold), Paragraph(scan.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if scan.created_at else "N/A", mono_style)],
        [Paragraph("Assessment Duration", body_bold), Paragraph(f"{scan.scan_duration_ms or 0} ms", body_style)],
        [Paragraph("Report Digest Identifier", body_bold), Paragraph(report_id, mono_style)],
    ]
    app_table = Table(appendix_data, colWidths=[180, 352])
    app_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(app_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # METHODOLOGY & LEGAL DISCLAIMER
    # =========================================================================
    story.append(Paragraph("5. Methodology & Legal Disclaimer", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=brand_color, spaceBefore=2, spaceAfter=8))

    disclaimer_text = (
        f"<b>Assessment Methodology:</b> This security evaluation was generated by the {brand_name} automated scanner. "
        "The system executes non-destructive, defensive probes against public HTTP/HTTPS interfaces and DNS configurations. "
        "Testing includes verification of TLS handshakes, certificate validity, HTTP response headers, cookie security flags, "
        "and email authentication DNS records (SPF, DMARC).<br/><br/>"
        "<b>Security Assessment Disclaimer:</b> This report was automatically generated by SiteSecura based on security checks "
        "performed against the specified target at the stated time.<br/><br/>"
        "The assessment represents a limited technical security posture assessment and does not constitute a penetration test, "
        "vulnerability assessment, security certification, compliance certification, code review, or guarantee of security.<br/><br/>"
        "Security conditions may change after the assessment. SiteSecura cannot guarantee that all vulnerabilities, weaknesses, "
        "misconfigurations, or security risks have been identified.<br/><br/>"
        "Findings and recommendations should be independently reviewed before implementation.<br/><br/>"
        "The recipient is responsible for ensuring that they are authorized to assess and use information relating to the target."
    )
    story.append(Paragraph(disclaimer_text, ParagraphStyle("DiscP", parent=body_style, fontSize=7.5, leading=10, textColor=colors.HexColor("#64748b"))))
    story.append(Spacer(1, 12))

    # Build document using NumberedCanvas
    def _canvas_factory(*args, **kwargs):
        c = NumberedCanvas(*args, **kwargs)
        c.brand_name = brand_name
        c.brand_color = brand_color
        c.domain = scan.normalized_domain or scan.domain or ""
        c.report_id = report_id
        c.footer_text = footer_text
        c.generation_date = date_formatted
        c.doc_title = doc_title
        c.doc_author = doc_author
        c.doc_subject = doc_subject
        c.doc_creator = doc_creator
        return c

    doc.build(story, canvasmaker=_canvas_factory)
    return file_path
