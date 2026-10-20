"""
Scanly Scanner Engine - Phase F5 Identity & Access Security Orchestrator
Master coordinator for Phase F5: Advanced Authentication, Session, Authorization & Business-Logic Security Intelligence.
Integrates passive authentication endpoint auditing, password form safety, credential leak detection,
session cookie security, token-in-URL detection, CSRF protection evaluation, OAuth/OIDC/SAML inspection,
authorization architecture discovery, and business-logic transaction surface inventory.

Enforces strict request budgets, timeout bounds, and resilient failure isolation.
Zero active exploitation, zero credential stuffing, zero session hijacking.
"""
from typing import Dict, List, Optional, Any, Tuple, Set
from urllib.parse import urlparse, urljoin
import logging
import json

from scanner.models import Finding
from scanner.network.http_client import SafeHttpClient
from .links import is_same_origin

from .config import DeepScanConfig
from .models import CrawledPage
from .auth_analyzer import (
    classify_auth_endpoint,
    analyze_password_forms,
    detect_password_in_urls,
    analyze_account_recovery,
    detect_mfa_signals,
)
from .session_analyzer import (
    analyze_session_security,
    detect_session_tokens_in_urls,
)
from .csrf_analyzer import (
    analyze_csrf_protection,
)
from .oauth_analyzer import (
    parse_oidc_configuration,
    analyze_oauth_redirect_uris,
    analyze_saml_metadata,
    OIDC_CANDIDATE_PATHS,
    SAML_CANDIDATE_PATHS,
)
from .authorization_analyzer import (
    analyze_authorization_architecture,
)
from .business_logic_analyzer import (
    analyze_business_logic_surface,
)

logger = logging.getLogger(__name__)


def analyze_identity_security(
    crawled_pages: List[CrawledPage],
    client: SafeHttpClient,
    target_domain: str,
    config: Optional[DeepScanConfig] = None,
    frontend_metadata: Optional[Dict[str, Any]] = None,
    appsec_metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Executes Phase F5 Identity, Authentication, Session & Authorization Intelligence.
    Guarantees:
    - Reuses crawl data where possible (0 extra requests).
    - Respects strict bounded request budget (max 20 requests total).
    - Failure isolated: single sub-module exceptions do not abort the scan.
    - Zero raw credentials or tokens stored or emitted.
    """
    cfg = config or DeepScanConfig()
    findings: List[Finding] = []

    # Request budget tracking
    max_requests = getattr(cfg, "max_f5_requests", 20)
    request_count = 0
    executed_requests: Set[Tuple[str, str]] = set()

    def can_request() -> bool:
        return request_count < max_requests

    base_url = f"https://{target_domain}"
    if crawled_pages and crawled_pages[0].url:
        parsed_first = urlparse(crawled_pages[0].url)
        base_url = f"{parsed_first.scheme}://{parsed_first.netloc}"

    # Collect all discovered URLs and endpoints
    all_discovered_urls: List[str] = []
    seen_urls: Set[str] = set()

    def add_url(u: Optional[str]):
        if not u or not isinstance(u, str):
            return
        clean = u.strip()
        if clean and clean not in seen_urls:
            seen_urls.add(clean)
            all_discovered_urls.append(clean)

    # 1. From crawled pages and their links / forms
    for page in crawled_pages:
        add_url(page.url)
        if page.final_url:
            add_url(page.final_url)
        for link in getattr(page, "links", []):
            if isinstance(link, str):
                add_url(link)
            elif isinstance(link, dict) and "url" in link:
                add_url(link["url"])
        for form in getattr(page, "forms", []):
            action = getattr(form, "resolved_action_url", None)
            if action:
                add_url(action)

    # 2. From F3 frontend metadata
    if frontend_metadata:
        for ep in frontend_metadata.get("api_endpoints", []):
            if isinstance(ep, str):
                add_url(urljoin(base_url, ep))
            elif isinstance(ep, dict) and "url" in ep:
                add_url(urljoin(base_url, ep["url"]))

    # 3. From F4 application security metadata
    if appsec_metadata:
        for ep in appsec_metadata.get("endpoints", []):
            if isinstance(ep, str):
                add_url(urljoin(base_url, ep))
            elif isinstance(ep, dict) and "url" in ep:
                add_url(ep["url"])

    # =========================================================================
    # SUB-MODULE 1: Authentication & Password Surface
    # =========================================================================
    categorized_auth_endpoints: List[Dict[str, Any]] = []
    password_forms_data: List[Dict[str, Any]] = []
    password_url_leaks: List[Dict[str, Any]] = []
    recovery_data: Dict[str, Any] = {"reset_endpoints": [], "reset_tokens_found": [], "password_policy": {}}
    mfa_signals_data: Dict[str, Any] = {"mfa_detected": False, "methods_observed": []}

    try:
        # Classify auth endpoints
        for u in all_discovered_urls:
            cat = classify_auth_endpoint(u)
            if cat != "UNKNOWN":
                categorized_auth_endpoints.append({
                    "url": u,
                    "category": cat,
                })
        # Limit stored auth endpoints
        max_auth_ep = getattr(cfg, "max_auth_endpoints", 8)
        categorized_auth_endpoints = categorized_auth_endpoints[:max_auth_ep]
    except Exception as exc:
        logger.debug(f"Auth endpoint classification error: {exc}")

    try:
        pw_forms, pw_form_findings = analyze_password_forms(crawled_pages)
        password_forms_data = pw_forms
        findings.extend(pw_form_findings)
    except Exception as exc:
        logger.debug(f"Password form analysis error: {exc}")

    try:
        pw_leaks, pw_leak_findings = detect_password_in_urls(crawled_pages)
        password_url_leaks = pw_leaks
        findings.extend(pw_leak_findings)
    except Exception as exc:
        logger.debug(f"Password in URL detection error: {exc}")

    try:
        rec_data, rec_findings = analyze_account_recovery(crawled_pages, all_discovered_urls)
        recovery_data = rec_data
        findings.extend(rec_findings)
    except Exception as exc:
        logger.debug(f"Account recovery analysis error: {exc}")

    try:
        mfa_data, mfa_findings = detect_mfa_signals(crawled_pages)
        mfa_signals_data = mfa_data
        findings.extend(mfa_findings)
    except Exception as exc:
        logger.debug(f"MFA signals detection error: {exc}")

    # =========================================================================
    # SUB-MODULE 2: Session Security & Token Transport
    # =========================================================================
    session_data: Dict[str, Any] = {
        "session_cookies": [],
        "insecure_session_cookies_count": 0,
        "missing_httponly_count": 0,
        "missing_secure_count": 0,
    }
    session_token_leaks: List[Dict[str, Any]] = []

    auth_urls = [ep["url"] for ep in categorized_auth_endpoints]
    try:
        s_data, s_findings = analyze_session_security(crawled_pages, auth_urls)
        session_data = s_data
        findings.extend(s_findings)
    except Exception as exc:
        logger.debug(f"Session security analysis error: {exc}")

    try:
        s_leaks, s_leak_findings = detect_session_tokens_in_urls(crawled_pages)
        session_token_leaks = s_leaks
        findings.extend(s_leak_findings)
    except Exception as exc:
        logger.debug(f"Session token in URL detection error: {exc}")

    # =========================================================================
    # SUB-MODULE 3: CSRF Protection & Workflow Security
    # =========================================================================
    csrf_data: Dict[str, Any] = {
        "evaluated_forms_count": 0,
        "protected_forms_count": 0,
        "unprotected_sensitive_forms_count": 0,
        "forms": [],
    }
    try:
        observed_session_cookies = session_data.get("session_cookies", [])
        c_data, c_findings = analyze_csrf_protection(crawled_pages, observed_session_cookies)
        csrf_data = c_data
        findings.extend(c_findings)
    except Exception as exc:
        logger.debug(f"CSRF protection analysis error: {exc}")

    # =========================================================================
    # SUB-MODULE 4: OAuth 2.0, OpenID Connect & SAML Identity Flows
    # =========================================================================
    oidc_info: Optional[Dict[str, Any]] = None
    saml_info: Optional[Dict[str, Any]] = None
    oauth_redirects: List[Dict[str, Any]] = []

    try:
        r_obs, r_findings = analyze_oauth_redirect_uris(all_discovered_urls)
        oauth_redirects = r_obs
        findings.extend(r_findings)
    except Exception as exc:
        logger.debug(f"OAuth redirect URI analysis error: {exc}")

    # Check already crawled pages for OIDC or SAML
    for page in crawled_pages:
        p_path = urlparse(page.url).path.lower()
        if "openid-configuration" in p_path and page.body_sample:
            try:
                doc = json.loads(page.body_sample)
                if isinstance(doc, dict):
                    o_info, o_findings = parse_oidc_configuration(doc, page.url)
                    oidc_info = o_info
                    findings.extend(o_findings)
                    break
            except Exception:
                pass
        elif ("saml/metadata" in p_path or "saml2" in p_path or "federationmetadata" in p_path) and page.body_sample:
            try:
                s_info, s_findings = analyze_saml_metadata(page.body_sample, page.url)
                if s_info:
                    saml_info = s_info
                    findings.extend(s_findings)
                    break
            except Exception:
                pass

    # If OIDC not found in crawl and budget allows, probe well-known OIDC endpoints safely
    if not oidc_info and can_request() and client:
        for path in OIDC_CANDIDATE_PATHS:
            if not can_request():
                break
            probe_url = urljoin(base_url, path)
            req_key = ("GET", probe_url)
            if req_key in executed_requests:
                continue
            executed_requests.add(req_key)
            request_count += 1

            try:
                resp = client.get(probe_url)
                if resp.status_code == 200 and resp.text:
                    try:
                        doc = json.loads(resp.text[:getattr(cfg, "max_oidc_document_size", 262144)])
                        if isinstance(doc, dict) and "issuer" in doc:
                            o_info, o_findings = parse_oidc_configuration(doc, probe_url)
                            oidc_info = o_info
                            findings.extend(o_findings)
                            break
                    except Exception:
                        pass
            except Exception as exc:
                logger.debug(f"OIDC probe failed for {probe_url}: {exc}")

    # If SAML not found in crawl and budget allows, probe well-known SAML endpoints safely
    if not saml_info and can_request() and client:
        for path in SAML_CANDIDATE_PATHS:
            if not can_request():
                break
            probe_url = urljoin(base_url, path)
            req_key = ("GET", probe_url)
            if req_key in executed_requests:
                continue
            executed_requests.add(req_key)
            request_count += 1

            try:
                resp = client.get(probe_url)
                if resp.status_code == 200 and resp.text:
                    body_sample = resp.text[:getattr(cfg, "max_saml_metadata_size", 262144)]
                    s_info, s_findings = analyze_saml_metadata(body_sample, probe_url)
                    if s_info:
                        saml_info = s_info
                        findings.extend(s_findings)
                        break
            except Exception as exc:
                logger.debug(f"SAML probe failed for {probe_url}: {exc}")

    # =========================================================================
    # SUB-MODULE 5: Authorization Architecture & Access Control Surfaces
    # =========================================================================
    authz_data: Dict[str, Any] = {
        "roles_identified": [],
        "admin_routes_count": 0,
        "object_routes_count": 0,
        "tenant_parameters_observed": [],
    }
    try:
        crawled_texts = [p.body_sample for p in crawled_pages if p.body_sample]
        api_specs = []
        if appsec_metadata and "api_docs" in appsec_metadata:
            api_specs = appsec_metadata["api_docs"].get("specs", [])

        az_data, az_findings = analyze_authorization_architecture(
            discovered_endpoints=all_discovered_urls,
            crawled_texts=crawled_texts,
            api_specs=api_specs,
        )
        authz_data = az_data
        findings.extend(az_findings)
    except Exception as exc:
        logger.debug(f"Authorization architecture analysis error: {exc}")

    # =========================================================================
    # SUB-MODULE 6: Business-Logic Surfaces & Transaction Workflows
    # =========================================================================
    business_logic_data: Dict[str, Any] = {
        "categorized_workflows": {},
        "magic_links_found": [],
    }
    try:
        bl_data, bl_findings = analyze_business_logic_surface(all_discovered_urls)
        business_logic_data = bl_data
        findings.extend(bl_findings)
    except Exception as exc:
        logger.debug(f"Business logic surface analysis error: {exc}")

    # =========================================================================
    # STAGE 7: Finding Deduplication
    # =========================================================================
    unique_findings: List[Finding] = []
    seen_fingerprints: Set[str] = set()
    for f in findings:
        fp = f"{f.check_type}:{f.title}:{f.evidence[:60] if f.evidence else ''}"
        if fp not in seen_fingerprints:
            seen_fingerprints.add(fp)
            unique_findings.append(f)

    # =========================================================================
    # STAGE 8: Compile Structured Identity Security Metadata
    # =========================================================================
    identity_metadata: Dict[str, Any] = {
        "status": "completed",
        "requests_executed": request_count,
        "auth_endpoints": categorized_auth_endpoints,
        "auth_endpoints_count": len(categorized_auth_endpoints),
        "password_forms": password_forms_data,
        "password_forms_count": len(password_forms_data),
        "passwords_in_urls": password_url_leaks,
        "passwords_in_urls_count": len(password_url_leaks),
        "account_recovery": recovery_data,
        "mfa_signals": mfa_signals_data,
        "session_security": session_data,
        "session_tokens_in_urls": session_token_leaks,
        "session_tokens_in_urls_count": len(session_token_leaks),
        "csrf": csrf_data,
        "oauth_oidc": {
            "oidc_discovered": bool(oidc_info),
            "oidc_configuration": oidc_info,
            "oauth_redirects": oauth_redirects[:10],
            "saml_discovered": bool(saml_info),
            "saml_metadata": saml_info,
        },
        "authorization": authz_data,
        "business_logic": business_logic_data,
    }

    return identity_metadata, unique_findings
