"""
Scanly Scanner Engine - Deep Scan Deterministic Scoring Module
Computes overall security posture score (0-100) and granular category breakdowns for multi-page deep audits.
Enforces strict anti-double-counting boundaries and category caps.
"""
from typing import List, Dict, Tuple, Any
from scanner.models import Finding, RiskLevel, CheckStatus


# Category definitions with max weights totaling 100 points
CATEGORY_CONFIG = {
    "Transport Security": {
        "max_score": 25,
        "prefixes": [
            "deep_js_insecure_websocket",
            "deep_js_websocket",
            "deep_https",
            "deep_redirect",
            "deep_tls",
            "deep_ssl",
            "deep_cert",
            "https",
            "ssl",
            "tls",
        ],
    },
    "Security Headers": {
        "max_score": 25,
        "prefixes": [
            "deep_cors",
            "deep_cache",
            "deep_hsts",
            "deep_csp",
            "deep_x_frame",
            "deep_x_content",
            "deep_referrer",
            "deep_permissions",
            "deep_coop",
            "deep_corp",
            "deep_coep",
            "deep_sec_header",
            "hsts",
            "csp",
        ],
    },
    "Cookie Security": {
        "max_score": 15,
        "prefixes": [
            "deep_cookie",
            "deep_session",
            "cookie",
        ],
    },
    "Content Security": {
        "max_score": 15,
        "prefixes": [
            "deep_mixed_content",
        ],
    },
    "Forms & Input Security": {
        "max_score": 10,
        "prefixes": [
            "deep_form",
            "deep_csrf",
            "deep_password_form",
            "deep_excessive_data",
            "deep_sensitive_form",
        ],
    },
    "Website & Technology": {
        "max_score": 10,
        "prefixes": [
            "deep_error",
            "deep_server",
            "deep_http",
            "deep_api",
            "deep_graphql",
            "deep_auth",
            "deep_oauth",
            "deep_oidc",
            "deep_saml",
            "deep_mfa",
            "deep_business",
            "deep_password",
            "deep_directory",
            "deep_js",
            "deep_robots",
            "deep_sitemap",
            "deep_source_map",
            "deep_resource",
            "deep_technology",
            "deep_dns",
            "deep_caa",
            "deep_dnssec",
            "deep_spf",
            "deep_dmarc",
            "deep_dkim",
            "deep_email",
            # Phase F6: Infrastructure, Cloud, Deployment & Operational Security
            "deep_infra",
            "deep_cdn",
            "deep_origin",
            "deep_ipv6",
            "deep_cloud",
            "deep_storage",
            "deep_git",
            "deep_deployment",
            "deep_backup",
            "deep_dev",
            "deep_staging",
            "deep_internal",
            "deep_localhost",
            "deep_docker",
            "deep_kubernetes",
            "deep_serverless",
            "deep_management",
            "deep_monitoring",
            "deep_metrics",
            "deep_debug",
            "deep_actuator",
            "deep_takeover",
            "deep_logging",
            "deep_tracing",
            # Phase F7: Advanced Data Security, Privacy & Sensitive Information Exposure
            "deep_data",
            "deep_pii",
            "deep_privacy",
            "deep_financial",
            "deep_health",
            "deep_location",
            "deep_payment",
            "deep_document",
            "deep_export",
            "deep_database",
            "deep_log_data",
            "deep_log_credential",
            "deep_tracking",
            "deep_consent",
            "deep_retention",
            "deep_deletion",
            "deep_access_request",
            "deep_gdpr",
            "deep_ccpa",
            "deep_session_recording",
            "deep_advertising_tracking",
            "deep_data_minimization",
            "deep_sensitive_parameter",
            "deep_sensitive_referrer",
            "deep_sensitive_data",
            "deep_public_auth_data",
            "deep_public_pii",
            "deep_public_government_id",
            "deep_public_financial",
            "deep_public_health",
            "deep_public_location",
            "deep_public_payment",
            "deep_public_data_export",
            "deep_public_database",
            "deep_tracker_before_consent",
            # Phase F8: Correlation & Risk Chains (0 score impact)
            "deep_risk_chain",
        ],
    },
}


def calculate_deep_score(findings: List[Finding]) -> Tuple[int, RiskLevel, Dict[str, Dict[str, Any]], int, int]:
    """
    Computes a deterministic score (0 - 100), RiskLevel, category breakdown,
    passed checks count, and total checks count.
    Guarantees no negative scores and strict per-category caps.
    """
    passed_count = 0
    total_count = len(findings)

    # Initialize category counters
    breakdown: Dict[str, Dict[str, Any]] = {}
    for cat_name, cfg in CATEGORY_CONFIG.items():
        breakdown[cat_name] = {
            "score": cfg["max_score"],
            "max_score": cfg["max_score"],
            "deductions": 0,
            "passed_checks": 0,
            "total_checks": 0,
        }

    for f in findings:
        if f.status == CheckStatus.PASS:
            passed_count += 1

        impact = abs(f.score_impact or 0)
        ctype = (f.check_type or "").lower()

        # Match finding to category
        assigned_cat = "Website & Technology"
        for cat_name, cfg in CATEGORY_CONFIG.items():
            if any(ctype.startswith(prefix) for prefix in cfg["prefixes"]):
                assigned_cat = cat_name
                break

        cat_stats = breakdown[assigned_cat]
        cat_stats["total_checks"] += 1
        if f.status == CheckStatus.PASS:
            cat_stats["passed_checks"] += 1
        elif impact > 0:
            cat_stats["deductions"] += impact

    # Apply deductions within category caps
    total_score = 0
    for cat_name, cat_stats in breakdown.items():
        max_s = cat_stats["max_score"]
        ded = cat_stats["deductions"]
        category_final = max(0, max_s - ded)
        cat_stats["score"] = category_final
        total_score += category_final

    # Clamp total score between 0 and 100
    final_score = max(0, min(100, total_score))

    # Determine risk level
    if final_score >= 90:
        risk_level = RiskLevel.EXCELLENT
    elif final_score >= 75:
        risk_level = RiskLevel.GOOD
    elif final_score >= 60:
        risk_level = RiskLevel.MEDIUM
    elif final_score >= 40:
        risk_level = RiskLevel.HIGH
    else:
        risk_level = RiskLevel.CRITICAL

    return final_score, risk_level, breakdown, passed_count, total_count
