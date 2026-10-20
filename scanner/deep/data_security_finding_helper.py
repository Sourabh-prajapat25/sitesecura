"""
Scanly Scanner Engine - Phase F7 Data Security Finding Helper
Provides helper for constructing Finding objects with standard defaults for Phase F7.
"""
from typing import Optional, Dict, Any
from scanner.models import Finding, Severity, CheckStatus


def make_data_finding(
    check_type: str,
    title: str,
    summary: str = "",
    description: str = "",
    severity: Severity = Severity.INFO,
    status: CheckStatus = CheckStatus.PASS,
    score_impact: int = 0,
    name: str = "",
    why_it_matters: str = "",
    how_to_fix: str = "",
    estimated_fix_minutes: int = 15,
    documentation_url: str = "",
    technical_details: Optional[Dict[str, Any]] = None,
    evidence: Optional[str] = None,
    confidence: float = 1.0,
    remediation: str = "",
    data_category: str = "PUBLIC",
) -> Finding:
    """Constructs a valid Finding with robust fallbacks for all required positional and keyword arguments."""
    actual_summary = summary or description or title
    actual_name = name or title
    actual_why = why_it_matters or actual_summary
    actual_fix = how_to_fix or remediation or "Review and sanitize public data exposure according to privacy and data minimization principles."
    
    # Normalize status if default PASS was passed with a failure severity
    actual_status = status
    if status == CheckStatus.PASS and severity in (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW):
        if severity == Severity.CRITICAL:
            actual_status = CheckStatus.CRITICAL
        elif severity == Severity.HIGH:
            actual_status = CheckStatus.HIGH
        else:
            actual_status = CheckStatus.WARNING

    # Calculate sensible score impacts if not provided
    if score_impact == 0 and actual_status in (CheckStatus.WARNING, CheckStatus.HIGH, CheckStatus.CRITICAL):
        if severity == Severity.CRITICAL:
            score_impact = -10
        elif severity == Severity.HIGH:
            score_impact = -6
        elif severity == Severity.MEDIUM:
            score_impact = -4
        elif severity == Severity.LOW:
            score_impact = -2

    details = technical_details or {}
    if "data_category" not in details:
        details["data_category"] = data_category
    if "category" not in details:
        details["category"] = "Data & Privacy Security"

    return Finding(
        check_type=check_type,
        name=actual_name,
        status=actual_status,
        severity=severity,
        score_impact=score_impact,
        title=title,
        summary=actual_summary,
        why_it_matters=actual_why,
        how_to_fix=actual_fix,
        estimated_fix_minutes=estimated_fix_minutes,
        documentation_url=documentation_url or "https://sitesecura.com/docs/data-privacy",
        technical_details=details,
        evidence=evidence or "",
    )
