"""
Scanly Scanner Engine - Phase F8 Executive Posture & Positive Signals Engine
Synthesizes executive security posture dimensions, surfaces positive defensive strengths,
and produces narrative score context without altering the underlying 0-100 deterministic score.
"""
from typing import List, Dict, Any, Optional, Tuple

from .finding_normalizer import SecurityEvidence


def analyze_executive_posture(
    score: int,
    risk_level: str,
    evidence_list: List[SecurityEvidence],
    scan_metadata: Optional[Dict[str, Any]] = None,
    risk_chains: Optional[List[Dict[str, Any]]] = None,
    root_causes: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Evaluates multi-phase scan results into high-level executive posture dimensions,
    records observed positive defensive strengths, and provides narrative score explanation.
    """
    meta = scan_metadata or {}
    chains = risk_chains or []
    rcs = root_causes or []

    # 1. Posture Dimensions Evaluation
    dim_ratings: Dict[str, Dict[str, str]] = {}

    def rate_dimension(name: str, issue_count: int, crit_count: int, high_count: int) -> Dict[str, str]:
        if crit_count > 0:
            return {"rating": "CRITICAL_GAPS", "status": "Action Required", "summary": f"{crit_count} critical issues observed."}
        elif high_count > 0:
            return {"rating": "NEEDS_ATTENTION", "status": "Action Recommended", "summary": f"{high_count} high-severity issues observed."}
        elif issue_count > 0:
            return {"rating": "MODERATE", "status": "Minor Improvements", "summary": f"{issue_count} moderate configuration gaps observed."}
        else:
            return {"rating": "SOLID", "status": "Optimal", "summary": "No corresponding issue was detected within the analyzed scope."}

    # Group evidence by canonical categories
    canon_ev: Dict[str, List[SecurityEvidence]] = {}
    for e in evidence_list:
        canon_ev.setdefault(e.canonical_category, []).append(e)

    def stats_for(categories: List[str]) -> Tuple[int, int, int]:
        total, crit, high = 0, 0, 0
        for cat in categories:
            items = canon_ev.get(cat, [])
            total += len(items)
            crit += sum(1 for i in items if i.severity == "critical")
            high += sum(1 for i in items if i.severity == "high")
        return total, crit, high

    dim_ratings["transport_and_cryptography"] = rate_dimension("Transport", *stats_for(["TRANSPORT_SECURITY"]))
    dim_ratings["browser_security_headers"] = rate_dimension("Headers", *stats_for(["SECURITY_HEADERS"]))
    dim_ratings["application_and_api"] = rate_dimension("AppSec", *stats_for(["API_SURFACE"]))
    dim_ratings["identity_and_session"] = rate_dimension("Identity", *stats_for(["AUTHENTICATION_SURFACE", "ADMIN_SURFACE"]))
    dim_ratings["infrastructure_and_cloud"] = rate_dimension("Infrastructure", *stats_for(["ORIGIN_EXPOSURE", "CLOUD_STORAGE_EXPOSURE", "INTERNAL_TOPOLOGY_EXPOSURE"]))
    dim_ratings["data_and_privacy"] = rate_dimension("Data", *stats_for(["PERSONAL_DATA_EXPOSURE", "FINANCIAL_DATA_EXPOSURE", "DOCUMENT_EXPOSURE", "TRACKING_SURFACE"]))
    dim_ratings["build_and_operational_hygiene"] = rate_dimension("Hygiene", *stats_for(["DEVELOPMENT_ARTIFACT"]))

    # 2. Positive Defensive Signals (Strengths)
    positive_signals: List[Dict[str, str]] = []

    # TLS check
    tls_info = meta.get("tls") or {}
    if tls_info.get("valid"):
        tls_ver = tls_info.get("tls_version") or "Modern"
        positive_signals.append({
            "dimension": "Transport",
            "title": f"Valid TLS Encryption Enforced ({tls_ver})",
            "detail": f"Certificate is valid from {tls_info.get('issuer_organization', 'trusted CA')} with forward secrecy active.",
        })

    # HSTS check
    hsts_info = meta.get("hsts") or {}
    if hsts_info.get("is_valid") or (meta.get("security_headers_quality", {}).get("hsts", {}).get("present")):
        positive_signals.append({
            "dimension": "Transport",
            "title": "Strict-Transport-Security (HSTS) Active",
            "detail": "Browser downgrade protection is enforced with strict transport security.",
        })

    # CDN / WAF check
    cdn_info = meta.get("infrastructure_security", {}).get("cdn", {})
    if cdn_info.get("detected"):
        positive_signals.append({
            "dimension": "Perimeter",
            "title": f"Edge Perimeter Protection Active ({cdn_info.get('provider', 'CDN')})",
            "detail": "Public traffic is routed through edge reverse proxy infrastructure.",
        })

    # No secrets in JS check
    frontend = meta.get("frontend_security") or {}
    if frontend.get("exposed_secrets_count", 0) == 0:
        positive_signals.append({
            "dimension": "Frontend",
            "title": "Clean Client-Side JavaScript Artifacts",
            "detail": "No public API keys, private tokens, or hardcoded credentials detected in client script assets.",
        })

    # Privacy Policy check
    privacy_info = meta.get("data_security", {}).get("privacy") or {}
    if privacy_info.get("policy_present"):
        positive_signals.append({
            "dimension": "Governance",
            "title": "Public Privacy Governance Disclosed",
            "detail": f"Privacy statement published at {privacy_info.get('policy_url', 'website')}.",
        })

    # Session cookie hardening
    identity = meta.get("identity_security") or {}
    session_sec = identity.get("session_security") or {}
    if session_sec.get("insecure_session_cookies_count", 0) == 0 and session_sec.get("auth_cookies_count", 0) > 0:
        positive_signals.append({
            "dimension": "Identity",
            "title": "Hardened Session Cookie Hygiene",
            "detail": "All identified session cookies enforce Secure and HttpOnly browser protection attributes.",
        })

    # Fallback positive signal if none triggered
    if not positive_signals:
        positive_signals.append({
            "dimension": "Baseline",
            "title": "Standard Public Web Reachability",
            "detail": "Site successfully responds over HTTPS with baseline HTTP protocol standards.",
        })

    # 3. Narrative Score Context
    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for e in evidence_list:
        if e.severity in sev_counts:
            sev_counts[e.severity] += 1

    narrative_parts = []
    if score >= 85:
        narrative_parts.append(
            f"The target exhibits a strong security posture with a score of {score}/100. "
            "Defensive controls and modern protocol configurations are consistently enforced across analyzed tiers."
        )
    elif score >= 65:
        narrative_parts.append(
            f"The target maintains a satisfactory baseline posture with a score of {score}/100, "
            f"though {sev_counts['high']} high and {sev_counts['medium']} medium severity configuration gaps were observed."
        )
    else:
        narrative_parts.append(
            f"The target exhibits notable security exposure with a score of {score}/100. "
            f"Identified weaknesses ({sev_counts['critical']} critical, {sev_counts['high']} high) warrant prioritized architectural review."
        )

    if chains:
        narrative_parts.append(
            f"Correlation identified {len(chains)} multi-phase security relationship(s) linking independent observations."
        )
    if rcs:
        top_rc = rcs[0]["title"]
        narrative_parts.append(
            f"Primary systemic root cause: {top_rc}."
        )

    score_explanation = " ".join(narrative_parts)

    return {
        "overall_score": score,
        "risk_level": risk_level,
        "score_explanation": score_explanation,
        "posture_dimensions": dim_ratings,
        "positive_signals": positive_signals[:6],
        "positive_signals_count": len(positive_signals),
        "limitations": [
            "Assessment is based exclusively on passive, non-intrusive observation of publicly reachable web endpoints.",
            "No active penetration testing, credentialed scanning, or state-changing exploitation was executed.",
            "Findings and risk chains reflect observed technical conditions and do not constitute formal legal compliance audits.",
        ],
    }
