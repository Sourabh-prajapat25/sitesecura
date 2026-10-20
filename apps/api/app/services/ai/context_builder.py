"""
Scanly API - AI Context Builder & Injection Defense Fencing
Converts authoritative scan records into sanitized, structured context with strict untrusted data boundaries.
"""
import html
import re
import json
from typing import Optional, List, Dict, Any
from app.models.website import Website
from app.models.scan import Scan, ScanCheck
from app.core.config import settings

# Sensitive headers and tokens that should be scrubbed before passing to LLMs
REDACT_KEY_PATTERNS = [
    re.compile(r"bearer\s+[a-zA-Z0-9_\-\.]+", re.IGNORECASE),
    re.compile(r"api[-_]?key", re.IGNORECASE),
    re.compile(r"password|secret|token", re.IGNORECASE),
]


def sanitize_text(val: Any, max_len: int = 2000) -> str:
    """Sanitizes text, applies length truncation, and redacts obvious sensitive tokens."""
    if val is None:
        return ""
    if isinstance(val, (dict, list)):
        try:
            text = json.dumps(val, ensure_ascii=False)
        except Exception:
            text = str(val)
    else:
        text = str(val)

    # Basic scrubbing of bearer tokens
    text = re.sub(r"(Bearer\s+)[A-Za-z0-9_\-\.]{15,}", r"\1[REDACTED]", text, flags=re.IGNORECASE)

    # Escape XML delimiters to avoid prompt-injection breakout
    escaped = html.escape(text)
    if len(escaped) > max_len:
        return escaped[:max_len] + " [TRUNCATED]"
    return escaped


class AIContextBuilder:
    """Builds bounded, injection-defended context payloads from authoritative database objects."""

    @classmethod
    def build_scan_context(
        cls,
        website: Website,
        scan: Scan,
        target_check: Optional[ScanCheck] = None,
        max_chars: Optional[int] = None,
    ) -> str:
        limit = max_chars or getattr(settings, "AI_MAX_CONTEXT_CHARS", 16000)

        checks: List[ScanCheck] = scan.checks or []
        passed = sum(1 for c in checks if (c.status or "").lower() == "pass")
        warnings = sum(1 for c in checks if (c.status or "").lower() in ("warning", "fail"))
        critical = sum(1 for c in checks if (c.severity or "").lower() == "critical")
        unknown = sum(1 for c in checks if (c.status or "").lower() == "unknown")

        context_lines = [
            "<site_security_scan_data>",
            f'  <website domain="{sanitize_text(website.domain)}" normalized="{sanitize_text(website.normalized_domain)}" />',
            f'  <scan id="{scan.id}" score="{scan.score or 0}" risk="{sanitize_text(scan.risk_level or "unknown")}" date="{scan.completed_at or scan.created_at}" />',
            f'  <summary total_checks="{len(checks)}" passed="{passed}" warnings="{warnings}" critical="{critical}" unknown="{unknown}" />',
        ]

        if target_check:
            context_lines.append("  <target_finding_to_analyze>")
            context_lines.append(f'    <check_id>{target_check.id}</check_id>')
            context_lines.append(f'    <check_type>{sanitize_text(target_check.check_type)}</check_type>')
            context_lines.append(f'    <title>{sanitize_text(target_check.title)}</title>')
            context_lines.append(f'    <status>{sanitize_text(target_check.status)}</status>')
            context_lines.append(f'    <severity>{sanitize_text(target_check.severity)}</severity>')
            context_lines.append(f'    <score_impact>{target_check.score_impact or 0}</score_impact>')
            context_lines.append(f'    <summary>{sanitize_text(target_check.summary)}</summary>')
            context_lines.append(f'    <why_it_matters>{sanitize_text(target_check.why_it_matters)}</why_it_matters>')
            context_lines.append(f'    <baseline_fix>{sanitize_text(target_check.how_to_fix)}</baseline_fix>')
            context_lines.append("    <untrusted_scan_evidence>")
            evidence_str = sanitize_text(target_check.evidence, max_len=4000)
            context_lines.append(f"      {evidence_str}")
            context_lines.append("    </untrusted_scan_evidence>")
            context_lines.append("  </target_finding_to_analyze>")

        # Include other findings overview
        context_lines.append("  <all_findings_overview>")
        for c in checks:
            is_target = target_check and c.id == target_check.id
            if not is_target:
                context_lines.append(
                    f'    <finding type="{sanitize_text(c.check_type)}" status="{sanitize_text(c.status)}" severity="{sanitize_text(c.severity)}" title="{sanitize_text(c.title)}" />'
                )
        context_lines.append("  </all_findings_overview>")
        context_lines.append("</site_security_scan_data>")

        full_context = "\n".join(context_lines)
        if len(full_context) > limit:
            full_context = full_context[:limit] + "\n</site_security_scan_data> [CONTEXT_TRUNCATED]"

        return full_context
