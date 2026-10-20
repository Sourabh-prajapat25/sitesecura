"""
Scanly Scanner Engine - Deterministic Scoring Engine
Calculates security scores (0–100) and maps them to clear risk levels based on verified check results.
"""
from typing import Dict, Any, List, Tuple
from .models import Finding, RiskLevel, CheckStatus


# Configurable category weights summing to 100
DEFAULT_CATEGORY_WEIGHTS = {
    "https_ssl": 30,         # HTTPS & SSL/TLS validity and expiration
    "security_headers": 25,  # HSTS, CSP, X-Frame-Options, X-Content-Type-Options
    "dns_email": 20,         # SPF, DMARC, DNSSEC
    "cookie_security": 10,   # Secure, HttpOnly, SameSite
    "server_hygiene": 15,    # Redirections, info exposure, timeouts
}


def calculate_score(findings: List[Finding]) -> Tuple[int, RiskLevel, Dict[str, Dict[str, Any]], int, int]:
    """
    Computes deterministic security score:
    - Base score = 100
    - Deductions applied from each finding's score_impact
    - Clamped strictly between 0 and 100
    - Categorized into exact risk levels
    Returns: (score, risk_level, breakdown, passed_checks, total_checks)
    """
    base_score = 100
    total_deduction = 0

    category_scores = {
        "https_ssl": {"deductions": 0, "findings_count": 0, "passed": 0},
        "security_headers": {"deductions": 0, "findings_count": 0, "passed": 0},
        "dns_email": {"deductions": 0, "findings_count": 0, "passed": 0},
        "cookie_security": {"deductions": 0, "findings_count": 0, "passed": 0},
        "server_hygiene": {"deductions": 0, "findings_count": 0, "passed": 0},
    }

    passed_count = 0
    total_count = 0

    for finding in findings:
        # Ignore NOT_APPLICABLE and informational UNKNOWN from strict pass/fail stats
        if finding.status == CheckStatus.NOT_APPLICABLE:
            continue

        total_count += 1
        if finding.status == CheckStatus.PASS:
            passed_count += 1

        # Map to category for detailed reporting
        cat = "server_hygiene"
        if finding.check_type in ("https_availability", "ssl_validity", "ssl_expiration", "ssl_verification", "ssl_connection"):
            cat = "https_ssl"
        elif finding.check_type in ("hsts", "csp", "x_frame_options", "x_content_type_options", "referrer_policy"):
            cat = "security_headers"
        elif finding.check_type in ("spf_record", "dmarc_record", "dnssec", "dkim_status"):
            cat = "dns_email"
        elif finding.check_type in ("cookie_security",):
            cat = "cookie_security"

        category_scores[cat]["findings_count"] += 1
        if finding.status == CheckStatus.PASS:
            category_scores[cat]["passed"] += 1

        if finding.score_impact < 0:
            deduction = abs(finding.score_impact)
            total_deduction += deduction
            category_scores[cat]["deductions"] += deduction

    final_score = max(0, min(100, base_score - total_deduction))

    # Map deterministic risk level
    if final_score >= 90:
        risk = RiskLevel.EXCELLENT
    elif final_score >= 75:
        risk = RiskLevel.GOOD
    elif final_score >= 60:
        risk = RiskLevel.MEDIUM
    elif final_score >= 40:
        risk = RiskLevel.HIGH
    else:
        risk = RiskLevel.CRITICAL

    breakdown = {
        k: {
            "score": max(0, DEFAULT_CATEGORY_WEIGHTS.get(k, 20) - v["deductions"]),
            "max_score": DEFAULT_CATEGORY_WEIGHTS.get(k, 20),
            "deductions": v["deductions"],
            "passed_checks": v["passed"],
            "total_checks": v["findings_count"],
        }
        for k, v in category_scores.items()
    }

    return final_score, risk, breakdown, passed_count, total_count
