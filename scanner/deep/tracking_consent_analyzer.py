"""
Scanly Scanner Engine - Phase F7 Third-Party Tracking & Consent Analyzer
Classifies tracking technologies (analytics, ads, session recording), audits cookie purposes,
and detects Consent Management Platforms (CMPs) and consent banner controls.
Guarantees: Strict observational privacy signals; zero legal compliance claims.
"""
import re
from typing import List, Dict, Any, Tuple, Set, Optional

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import DataCategory, Confidence
from .data_security_finding_helper import make_data_finding

# Known Third-Party Tracking Provider Signatures
TRACKING_PROVIDERS = [
    # Analytics
    {"name": "Google Analytics", "category": "analytics", "regex": r"(?i)(google-analytics\.com|googletagmanager\.com/gtag|gtag/js\?id=G-)"},
    {"name": "Mixpanel", "category": "analytics", "regex": r"(?i)cdn\.mxpnl\.com"},
    {"name": "Amplitude", "category": "analytics", "regex": r"(?i)cdn\.amplitude\.com"},
    {"name": "Segment", "category": "analytics", "regex": r"(?i)cdn\.segment\.com"},
    {"name": "Plausible", "category": "analytics", "regex": r"(?i)plausible\.io"},
    {"name": "Matomo", "category": "analytics", "regex": r"(?i)(matomo\.js|piwik\.js)"},

    # Advertising & Pixels
    {"name": "Meta Pixel (Facebook)", "category": "advertising", "regex": r"(?i)(connect\.facebook\.net/.*fbevents\.js|fbq\(['\"]init)"},
    {"name": "Google Ads", "category": "advertising", "regex": r"(?i)(googleadservices\.com|googletagservices\.com)"},
    {"name": "LinkedIn Insight Tag", "category": "advertising", "regex": r"(?i)(snap\.licdn\.com/li\.lms-analytics)"},
    {"name": "TikTok Pixel", "category": "advertising", "regex": r"(?i)(analytics\.tiktok\.com)"},
    {"name": "Twitter / X Pixel", "category": "advertising", "regex": r"(?i)(static\.ads-twitter\.com)"},

    # Session Recording
    {"name": "Microsoft Clarity", "category": "session_recording", "regex": r"(?i)www\.clarity\.ms"},
    {"name": "Hotjar", "category": "session_recording", "regex": r"(?i)static\.hotjar\.com"},
    {"name": "FullStory", "category": "session_recording", "regex": r"(?i)fullstory\.com/s/fs\.js"},
    {"name": "LogRocket", "category": "session_recording", "regex": r"(?i)cdn\.logrocket\.io"},
    {"name": "Mouseflow", "category": "session_recording", "regex": r"(?i)cdn\.mouseflow\.com"},

    # Error & Performance Monitoring
    {"name": "Sentry", "category": "error_tracking", "regex": r"(?i)browser\.sentry-cdn\.com"},
    {"name": "Datadog RUM", "category": "performance_monitoring", "regex": r"(?i)datadoghq-browser-agent"},
    {"name": "New Relic", "category": "performance_monitoring", "regex": r"(?i)js-agent\.newrelic\.com"},
]

# Consent Management Platforms (CMPs)
CMP_SIGNATURES = [
    {"name": "OneTrust", "regex": r"(?i)(cdn\.cookielaw\.org|onetrust)"},
    {"name": "Cookiebot", "regex": r"(?i)(consent\.cookiebot\.com|cookiebot)"},
    {"name": "TrustArc", "regex": r"(?i)trustarc\.com"},
    {"name": "Didomi", "regex": r"(?i)sdk\.didomi\.io"},
    {"name": "Usercentrics", "regex": r"(?i)app\.usercentrics\.eu"},
    {"name": "Quantcast Choice", "regex": r"(?i)quantcast\.mgr\.consensu\.org"},
    {"name": "Klaro", "regex": r"(?i)klaro"},
    {"name": "Osano", "regex": r"(?i)cmp\.osano\.com"},
]

# Generic Consent Control DOM Keywords
CONSENT_DOM_KEYWORDS = [
    "accept cookies", "accept all", "reject all", "manage preferences",
    "cookie settings", "privacy choices", "your privacy choices", "cookie policy",
]

# Known Cookie Name Classification
COOKIE_CLASSIFICATION_RULES = [
    (re.compile(r"^(?:_ga|_gid|_gat|_clck|_pk_)"), "analytics"),
    (re.compile(r"^(?:_fbp|_gcl_|IDE|test_cookie)"), "advertising"),
    (re.compile(r"(?i)(?:session|sessid|phpsessid|jsessionid|token|sid)"), "session"),
    (re.compile(r"(?i)(?:consent|cookie_consent|opt_in|optin)"), "consent"),
    (re.compile(r"(?i)(?:lang|theme|mode|locale)"), "preference"),
]


def _classify_cookie_name(name: str) -> str:
    """Classifies a cookie name into a privacy purpose."""
    for pattern, cat in COOKIE_CLASSIFICATION_RULES:
        if pattern.search(name):
            return cat
    return "unknown"


def analyze_tracking_and_consent(
    crawled_pages: List[CrawledPage],
    frontend_metadata: Optional[Dict[str, Any]] = None,
    max_samples: int = 5,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively identifies third-party tracking scripts, audits cookie purposes,
    and inspects pages for consent management banners or CMPs.
    """
    findings: List[Finding] = []

    detected_trackers: Dict[str, Dict[str, Any]] = {}
    detected_cmps: List[str] = []
    consent_banner_detected = False
    consent_evidence: List[str] = []

    # Gather search corpus: page bodies, scripts, resources
    text_corpus: List[Tuple[str, str]] = []

    for page in crawled_pages:
        if page.body_sample:
            text_corpus.append((page.url, page.body_sample))
        for s in getattr(page, "inline_scripts", [])[:10]:
            text_corpus.append((page.url, s))
        for res in getattr(page, "resources", [])[:50]:
            r_url = res.resource_url if hasattr(res, "resource_url") else str(res)
            text_corpus.append((page.url, r_url))

    # Also check F3 third-party scripts if present
    fe_scripts = (frontend_metadata or {}).get("third_party_scripts", []) or []
    for sc in fe_scripts:
        u = sc.get("url", "") if isinstance(sc, dict) else str(sc)
        text_corpus.append(("Frontend Metadata", u))

    # 1. Detect Tracking Providers
    for prov in TRACKING_PROVIDERS:
        for src_url, text in text_corpus:
            if re.search(prov["regex"], text):
                if prov["name"] not in detected_trackers:
                    detected_trackers[prov["name"]] = {
                        "provider": prov["name"],
                        "category": prov["category"],
                        "source": src_url,
                        "confidence": Confidence.HIGH,
                    }

    # 2. Detect CMPs
    for cmp_tool in CMP_SIGNATURES:
        for src_url, text in text_corpus:
            if re.search(cmp_tool["regex"], text):
                if cmp_tool["name"] not in detected_cmps:
                    detected_cmps.append(cmp_tool["name"])
                    consent_banner_detected = True
                    consent_evidence.append(f"CMP '{cmp_tool['name']}' detected in {src_url}")

    # 3. Detect Generic Consent Banner Controls
    if not consent_banner_detected:
        for page in crawled_pages:
            body_lower = (page.body_sample or "").lower()
            for kw in CONSENT_DOM_KEYWORDS:
                if kw in body_lower:
                    consent_banner_detected = True
                    consent_evidence.append(f"Consent control keyword '{kw}' found on {page.url}")
                    break
            if consent_banner_detected:
                break

    # 4. Classify Cookies
    classified_cookies: List[Dict[str, Any]] = []
    seen_cookie_names: Set[str] = set()

    for page in crawled_pages:
        for c_name, c_val in page.cookies.items():
            if c_name not in seen_cookie_names:
                seen_cookie_names.add(c_name)
                purpose = _classify_cookie_name(c_name)
                classified_cookies.append({
                    "name": c_name,
                    "purpose": purpose,
                    "page_url": page.url,
                })

    trackers_list = list(detected_trackers.values())
    has_session_recording = any(t["category"] == "session_recording" for t in trackers_list)
    has_advertising = any(t["category"] == "advertising" for t in trackers_list)
    has_analytics = any(t["category"] == "analytics" for t in trackers_list)

    session_rec_tools = [t.get("provider", t.get("name", "")) for t in trackers_list if t.get("category") == "session_recording"]
    ad_tools = [t.get("provider", t.get("name", "")) for t in trackers_list if t.get("category") == "advertising"]
    cmp_provider = detected_cmps[0] if detected_cmps else None

    tracking_telemetry = {
        "trackers_detected_count": len(trackers_list),
        "trackers": trackers_list[:max_samples],
        "has_session_recording": has_session_recording,
        "session_recording_detected": has_session_recording,
        "session_recording_tools": session_rec_tools,
        "has_advertising_tracking": has_advertising,
        "advertising_trackers_detected": has_advertising,
        "advertising_tools": ad_tools,
        "has_analytics_tracking": has_analytics,
        "cmp_provider": cmp_provider,
        "cmps_detected": detected_cmps,
        "consent_banner_detected": consent_banner_detected,
        "consent_evidence": consent_evidence[:max_samples],
        "cookies_classified_count": len(classified_cookies),
        "cookies": classified_cookies[:max_samples],
    }

    # Findings Generation
    if has_session_recording:
        rec_providers = [t["provider"] for t in trackers_list if t["category"] == "session_recording"]
        findings.append(make_data_finding(
            check_type="deep_session_recording_detected",
            title=f"Session Recording Technology Observed: {', '.join(rec_providers)}",
            description=(
                f"Client-side session recording tools ({', '.join(rec_providers)}) were identified on the website. "
                "Session recorders capture user interactions, keystrokes, and viewport motion. "
                "Ensure sensitive input masking is enabled in your recorder settings to prevent capturing passwords or PII."
            ),
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence=f"Observed session recording script: {', '.join(rec_providers)}",
            how_to_fix="Verify recorder data-redaction configuration to confirm sensitive input fields are automatically obscured.",
            data_category=DataCategory.PERSONAL,
        ))

    if has_advertising:
        ad_providers = [t["provider"] for t in trackers_list if t["category"] == "advertising"]
        findings.append(make_data_finding(
            check_type="deep_advertising_tracking_detected",
            title=f"Advertising & Retargeting Trackers Observed: {', '.join(ad_providers)}",
            description=(
                f"Third-party advertising pixels and retargeting scripts ({', '.join(ad_providers)}) were identified. "
                "Ad trackers collect visitor behavioral telemetry across web properties for advertising attribution."
            ),
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence=f"Observed ad pixels: {', '.join(ad_providers)}",
            how_to_fix="Ensure all advertising trackers are disclosed in your privacy policy and respect visitor consent choices.",
            data_category=DataCategory.PUBLIC,
        ))

    # Tracker-Before-Consent Signal
    if (has_session_recording or has_advertising) and not consent_banner_detected:
        active_tools = [t["provider"] for t in trackers_list if t["category"] in ("session_recording", "advertising")]
        findings.append(make_data_finding(
            check_type="deep_tracker_before_consent",
            title="Tracking Technology Observed Without Detected Consent Controls",
            description=(
                f"Tracking scripts ({', '.join(active_tools[:3])}) were observed in the initial page response "
                "while no visible consent control banner or Consent Management Platform (CMP) was identified in the analyzed content. "
                "This is an informational privacy observation and does not constitute a formal legal compliance determination."
            ),
            severity=Severity.INFO,
            status=CheckStatus.WARNING,
            evidence=f"Active trackers: {', '.join(active_tools)}; No CMP or consent banner identified in crawl.",
            how_to_fix="Consider deploying a Consent Management Platform (e.g. OneTrust, Cookiebot) to govern script execution based on visitor consent preferences.",
            data_category=DataCategory.PERSONAL,
        ))

    return tracking_telemetry, findings
