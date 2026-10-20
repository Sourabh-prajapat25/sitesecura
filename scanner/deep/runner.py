"""
Scanly Scanner Engine - Deep Scan Orchestrator & Runner
Executes multi-page passive crawling, multi-page security inspections,
advanced TLS, DNS, email security, and builds structured audit results.
"""
from datetime import datetime, timezone
import time
from typing import List, Optional, Dict, Any

from scanner.models import Finding, RiskLevel, CheckStatus, Severity
from scanner.domain import resolve_and_validate_target, SSRFValidationError, normalize_domain
from scanner.network.models import SafeNetworkConfig
from scanner.network.resolver import BaseResolver, SafeResolver
from scanner.network.http_client import SafeHttpClient

from .config import DeepScanConfig
from .models import DeepScanResult, CrawledPage
from .robots import fetch_and_analyze_robots
from .sitemap import fetch_and_analyze_sitemap
from .crawler import crawl_website
from .redirects import analyze_redirects
from .headers import analyze_multi_page_headers
from .cookies import analyze_multi_page_cookies
from .mixed_content import analyze_mixed_content
from .forms import analyze_public_forms
from .resources import inventory_resources
from .source_maps import check_source_maps
from .technology import aggregate_technologies
from .tls import analyze_deep_tls
from .dns import analyze_deep_dns
from .email_security import analyze_deep_email_security
from .hsts import analyze_deep_hsts
from .csp import analyze_deep_csp
from .security_headers import analyze_deep_security_headers_quality
from .frontend_security import analyze_frontend_security
from .application_security import analyze_application_security
from .identity_security import analyze_identity_security
from .infrastructure_security import analyze_infrastructure_security
from .data_security import analyze_data_security
from .risk_intelligence import analyze_risk_intelligence
from .scoring import calculate_deep_score


def run_deep_security_scan(
    target_domain: str,
    plan: str = "pro",
    config: Optional[DeepScanConfig] = None,
    resolver: Optional[BaseResolver] = None,
    client: Optional[SafeHttpClient] = None,
) -> DeepScanResult:
    """
    Executes a complete passive Deep Website Security Scan on target_domain:
    1. Strict SSRF validation and public IP resolution.
    2. Discovery of robots.txt and sitemap.xml.
    3. Bounded same-origin crawl (max_depth=2, max_pages from plan: 50 Pro / 100 Agency).
    4. Multi-page security header consistency analysis.
    5. Multi-page cookie security audit.
    6. Mixed content detection across all HTTPS pages.
    7. Public form passive security inspection.
    8. JavaScript & resource inventory.
    9. Public source map exposure check.
    10. Multi-page technology stack identification.
    11. Phase F2: Advanced TLS & Certificate verification (SANs, ciphers, ALPN/HTTP2, key sizes).
    12. Phase F2: Advanced DNS & Infrastructure analysis (A, AAAA, MX, NS redundancy, CAA, DNSSEC).
    13. Phase F2: Advanced Email Security (SPF mechanisms, lookup limits, DMARC policies, alignment).
    14. Phase F2: Advanced Semantic HSTS & CSP deep inspection.
    15. Phase F2: Security headers quality & Cross-origin isolation policies (COOP, CORP, COEP).
    16. Deterministic scoring and structured result compilation.
    """
    start_time = datetime.now(timezone.utc)
    t0 = time.time()

    cfg = config or DeepScanConfig()
    # Apply plan page limit defaults if not explicitly configured
    if plan == "agency":
        cfg.max_pages = max(cfg.max_pages, 100)
    else:
        cfg.max_pages = min(cfg.max_pages, 50)

    all_findings: List[Finding] = []
    target_ip: Optional[str] = None
    normalized_domain = target_domain
    error_message: Optional[str] = None
    is_partial = False

    net_config = SafeNetworkConfig(
        connect_timeout=cfg.connect_timeout,
        read_timeout=cfg.read_timeout,
        write_timeout=cfg.write_timeout,
        pool_timeout=cfg.pool_timeout,
        total_timeout=cfg.total_scan_timeout_seconds,
        max_redirects=cfg.max_redirects,
        max_response_bytes=cfg.max_response_bytes,
        user_agent=cfg.user_agent,
    )
    safe_resolver = resolver or SafeResolver(timeout=cfg.connect_timeout)

    # 1. Validation & SSRF Check
    try:
        normalized_domain, target_ip = resolve_and_validate_target(target_domain, resolver=safe_resolver)
    except SSRFValidationError as e:
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((time.time() - t0) * 1000)
        return DeepScanResult(
            domain=target_domain,
            normalized_domain=target_domain,
            target_ip=None,
            score=0,
            risk_level=RiskLevel.CRITICAL,
            score_breakdown={},
            findings=[
                Finding(
                    check_type="domain_validation",
                    name="Target Validation Failed",
                    status=CheckStatus.CRITICAL,
                    severity=Severity.CRITICAL,
                    score_impact=-100,
                    title="Validation / SSRF Rejection",
                    summary=str(e),
                    why_it_matters="SiteSecura only scans valid public hostnames.",
                    how_to_fix="Please provide a valid public domain (e.g. example.com).",
                    estimated_fix_minutes=1,
                    documentation_url="https://scanly.io/docs/faq",
                    evidence=str(e),
                )
            ],
            passed_checks_count=0,
            total_checks_count=1,
            scan_duration_ms=duration_ms,
            started_at=start_time,
            completed_at=completed_at,
            pages_discovered=0,
            pages_crawled=0,
            pages_skipped=0,
            crawl_depth=0,
            error_message=str(e),
            is_partial=False,
        )

    # Initialize SafeHttpClient
    http_client = client or SafeHttpClient(config=net_config, resolver=safe_resolver)

    # Start URL defaults to https://{normalized_domain}
    start_url = f"https://{normalized_domain}"

    # 2. Stage: Website Discovery (Robots & Sitemaps)
    robots_analysis, robots_findings = fetch_and_analyze_robots(start_url, http_client)
    all_findings.extend(robots_findings)

    sitemap_seeds: List[str] = []
    # If robots declares sitemaps, use the first; otherwise check default /sitemap.xml
    sitemap_target = robots_analysis.sitemap_urls[0] if robots_analysis.sitemap_urls else None
    sitemap_analysis, sitemap_urls, sitemap_findings = fetch_and_analyze_sitemap(
        start_url,
        http_client,
        sitemap_override_url=sitemap_target,
        max_urls=cfg.max_pages,
    )
    all_findings.extend(sitemap_findings)
    sitemap_seeds.extend(sitemap_urls)

    # 3. Stage: Public Page Crawling
    crawled_pages, skipped_urls, discovered_count = crawl_website(
        target_domain=normalized_domain,
        start_url=start_url,
        client=http_client,
        config=cfg,
        disallowed_paths=robots_analysis.disallowed_paths if cfg.respect_robots_txt else [],
        allowed_paths=robots_analysis.allowed_paths if cfg.respect_robots_txt else [],
        seed_urls=sitemap_seeds,
    )

    # Fallback to http:// if https returned 0 pages or connection error
    if not crawled_pages or (len(crawled_pages) == 1 and crawled_pages[0].error):
        try:
            http_start = f"http://{normalized_domain}"
            http_pages, http_skipped, http_disc = crawl_website(
                target_domain=normalized_domain,
                start_url=http_start,
                client=http_client,
                config=cfg,
                disallowed_paths=robots_analysis.disallowed_paths if cfg.respect_robots_txt else [],
                allowed_paths=robots_analysis.allowed_paths if cfg.respect_robots_txt else [],
            )
            if http_pages and any(p.status_code for p in http_pages):
                crawled_pages = http_pages
                skipped_urls = http_skipped
                discovered_count = http_disc
        except Exception:
            pass

    # 4. Stage: Multi-Page Security Analyses
    # Redirects
    try:
        redirect_findings = analyze_redirects(crawled_pages, normalized_domain)
        all_findings.extend(redirect_findings)
    except Exception:
        is_partial = True

    # Security Headers Consistency
    try:
        header_findings = analyze_multi_page_headers(crawled_pages)
        all_findings.extend(header_findings)
    except Exception:
        is_partial = True

    # Cookies Security
    try:
        cookie_findings = analyze_multi_page_cookies(crawled_pages)
        all_findings.extend(cookie_findings)
    except Exception:
        is_partial = True

    # Mixed Content
    try:
        mixed_findings = analyze_mixed_content(crawled_pages)
        all_findings.extend(mixed_findings)
    except Exception:
        is_partial = True

    # Public Forms
    try:
        form_findings = analyze_public_forms(crawled_pages)
        all_findings.extend(form_findings)
    except Exception:
        is_partial = True

    # Resource & Dependency Inventory
    resource_summary = {}
    try:
        resource_summary, resource_findings = inventory_resources(crawled_pages)
        all_findings.extend(resource_findings)
    except Exception:
        is_partial = True

    # Source Map Exposure Check
    source_maps_detected = []
    if cfg.check_source_maps:
        try:
            source_maps_detected, sm_findings = check_source_maps(
                crawled_pages, http_client, normalized_domain
            )
            all_findings.extend(sm_findings)
        except Exception:
            is_partial = True

    # Multi-Page Technology Aggregation
    technologies_detected = []
    try:
        technologies_detected, tech_findings = aggregate_technologies(crawled_pages)
        all_findings.extend(tech_findings)
    except Exception:
        is_partial = True

    # =========================================================================
    # 5. Phase F2: Advanced Transport, TLS, DNS & Security Configuration
    # =========================================================================

    # 5.1 Advanced TLS & Certificate Analysis
    tls_analysis_data: Dict[str, Any] = {}
    try:
        tls_analysis_data, tls_findings = analyze_deep_tls(
            domain=normalized_domain,
            timeout_seconds=cfg.connect_timeout,
            resolver=safe_resolver,
        )
        all_findings.extend(tls_findings)
    except Exception:
        is_partial = True

    # 5.2 Advanced DNS & Infrastructure Analysis (CAA, DNSSEC, NS, IPv6)
    dns_analysis_data: Dict[str, Any] = {}
    try:
        dns_analysis_data, dns_findings = analyze_deep_dns(
            domain=normalized_domain,
            timeout_seconds=min(cfg.connect_timeout, 2.5),
        )
        all_findings.extend(dns_findings)
    except Exception:
        is_partial = True

    # 5.3 Advanced Email Security Analysis (SPF & DMARC)
    email_sec_data: Dict[str, Any] = {}
    try:
        email_sec_data, email_findings = analyze_deep_email_security(
            domain=normalized_domain,
            timeout_seconds=min(cfg.connect_timeout, 2.5),
        )
        all_findings.extend(email_findings)
    except Exception:
        is_partial = True

    # 5.4 Semantic HSTS Analysis
    hsts_analysis_data: Dict[str, Any] = {}
    try:
        hsts_analysis_data, hsts_findings = analyze_deep_hsts(crawled_pages)
        all_findings.extend(hsts_findings)
    except Exception:
        is_partial = True

    # 5.5 Semantic CSP Analysis
    csp_analysis_data: Dict[str, Any] = {}
    try:
        csp_analysis_data, csp_findings = analyze_deep_csp(crawled_pages)
        all_findings.extend(csp_findings)
    except Exception:
        is_partial = True

    # 5.6 Advanced Security Headers Quality & Cross-Origin Isolation
    headers_quality_data: Dict[str, Any] = {}
    try:
        headers_quality_data, sec_headers_findings = analyze_deep_security_headers_quality(crawled_pages)
        all_findings.extend(sec_headers_findings)
    except Exception:
        is_partial = True

    # 5.7 HTTP Protocol Summary
    http_protocol_data = {
        "alpn_selected": tls_analysis_data.get("alpn_selected"),
        "supports_http2": tls_analysis_data.get("supports_http2", False),
        "tls_version": tls_analysis_data.get("tls_version"),
        "cipher_name": tls_analysis_data.get("cipher_name"),
    }

    # =========================================================================
    # 6. Phase F3: Advanced Frontend, JavaScript & Client-Side Exposure Intelligence
    # =========================================================================
    frontend_sec_data: Dict[str, Any] = {}
    if cfg.check_frontend_security:
        try:
            frontend_sec_data, frontend_findings = analyze_frontend_security(
                crawled_pages=crawled_pages,
                client=http_client,
                target_domain=normalized_domain,
                config=cfg,
            )
            all_findings.extend(frontend_findings)
        except Exception:
            is_partial = True

    # =========================================================================
    # 7. Phase F4: Advanced Web Application, API & HTTP Security Intelligence
    # =========================================================================
    appsec_data: Dict[str, Any] = {}
    if cfg.check_application_security:
        try:
            appsec_data, appsec_findings = analyze_application_security(
                crawled_pages=crawled_pages,
                client=http_client,
                target_domain=normalized_domain,
                config=cfg,
                frontend_metadata=frontend_sec_data,
            )
            all_findings.extend(appsec_findings)
        except Exception as exc:
            is_partial = True
            appsec_data = {"status": "failed", "error": str(exc)}

    # =========================================================================
    # 8. Phase F5: Advanced Authentication, Session, Authorization & Business-Logic Security Intelligence
    # =========================================================================
    identity_sec_data: Dict[str, Any] = {}
    if getattr(cfg, "check_identity_security", True):
        try:
            identity_sec_data, identity_findings = analyze_identity_security(
                crawled_pages=crawled_pages,
                client=http_client,
                target_domain=normalized_domain,
                config=cfg,
                frontend_metadata=frontend_sec_data,
                appsec_metadata=appsec_data,
            )
            all_findings.extend(identity_findings)
        except Exception as exc:
            is_partial = True
            identity_sec_data = {"status": "failed", "error": str(exc)}

    # =========================================================================
    # 9. Phase F6: Advanced Infrastructure, Cloud, Deployment & Operational Security
    # =========================================================================
    infra_sec_data: Dict[str, Any] = {}
    if getattr(cfg, "check_infrastructure_security", True):
        try:
            infra_sec_data, infra_findings = analyze_infrastructure_security(
                crawled_pages=crawled_pages,
                client=http_client,
                target_domain=normalized_domain,
                config=cfg,
                dns_metadata=dns_analysis_data,
                tls_metadata=tls_analysis_data,
                frontend_metadata=frontend_sec_data,
                appsec_metadata=appsec_data,
            )
            all_findings.extend(infra_findings)
        except Exception as exc:
            is_partial = True
            infra_sec_data = {"status": "failed", "error": str(exc)}

    # =========================================================================
    # 10. Phase F7: Advanced Data Security, Privacy & Sensitive Information Exposure
    # =========================================================================
    data_sec_data: Dict[str, Any] = {}
    if getattr(cfg, "check_data_security", True):
        try:
            data_sec_data, data_findings = analyze_data_security(
                crawled_pages=crawled_pages,
                client=http_client,
                target_domain=normalized_domain,
                config=cfg,
                frontend_metadata=frontend_sec_data,
                appsec_metadata=appsec_data,
                identity_metadata=identity_sec_data,
                infra_metadata=infra_sec_data,
            )
            all_findings.extend(data_findings)
        except Exception as exc:
            is_partial = True
            data_sec_data = {"status": "failed", "error": str(exc)}

    # =========================================================================
    # 11. Deterministic Composite Scoring (F1-F7 Findings)
    # =========================================================================
    score, risk_level, breakdown, passed_count, total_count = calculate_deep_score(all_findings)

    # =========================================================================
    # 12. Phase F8: Advanced Security Correlation, Attack-Surface Risk Graph & Executive Posture
    # =========================================================================
    risk_intelligence_data: Dict[str, Any] = {}
    if getattr(cfg, "check_risk_intelligence", True) and getattr(cfg, "enable_f8_risk_intelligence", True):
        try:
            risk_intelligence_data, f8_findings = analyze_risk_intelligence(
                findings=all_findings,
                crawled_pages=crawled_pages,
                scan_metadata={
                    "domain": normalized_domain,
                    "target_ip": target_ip,
                    "tls": tls_analysis_data,
                    "dns": dns_analysis_data,
                    "hsts": hsts_analysis_data,
                    "security_headers_quality": headers_quality_data,
                    "technologies": technologies_detected,
                    "frontend_security": frontend_sec_data,
                    "application_security": appsec_data,
                    "identity_security": identity_sec_data,
                    "infrastructure_security": infra_sec_data,
                    "data_security": data_sec_data,
                },
                config=cfg,
                score=score,
                risk_level=risk_level.value if hasattr(risk_level, "value") else str(risk_level),
            )
            all_findings.extend(f8_findings)
        except Exception as exc:
            is_partial = True
            risk_intelligence_data = {"status": "failed", "error": str(exc)}

    completed_at = datetime.now(timezone.utc)
    duration_ms = int((time.time() - t0) * 1000)

    # Compile page summaries for dashboard
    pages_summary: List[Dict[str, Any]] = []
    for p in crawled_pages:
        pages_summary.append({
            "url": p.url,
            "final_url": p.final_url,
            "depth": p.depth,
            "status_code": p.status_code,
            "content_type": p.content_type,
            "elapsed_ms": p.elapsed_ms,
            "is_https": p.is_https,
            "title": p.title,
            "headers_count": len(p.headers),
            "cookies_count": len(p.cookies),
            "forms_count": len(p.forms),
            "resources_count": len(p.resources),
            "error": p.error,
        })

    # Summary by severity for the dashboard
    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in all_findings:
        s_val = (f.severity.value if hasattr(f.severity, "value") else str(f.severity)).lower()
        if s_val in sev_counts:
            sev_counts[s_val] += 1

    scan_metadata = {
        "deep_scan_version": 8,
        "pages_discovered": discovered_count,
        "pages_crawled": len(crawled_pages),
        "pages_skipped": len(skipped_urls),
        "crawl_depth": cfg.max_depth,
        "severity_counts": sev_counts,
        "skipped_urls": skipped_urls[:25],
        "pages": pages_summary,
        "robots_txt": {
            "is_present": robots_analysis.is_present,
            "status_code": robots_analysis.status_code,
            "disallow_rules_count": len(robots_analysis.disallowed_paths),
            "sitemaps_declared": robots_analysis.sitemap_urls,
        },
        "sitemap_xml": {
            "is_present": sitemap_analysis.is_present,
            "status_code": sitemap_analysis.status_code,
            "discovered_urls_count": sitemap_analysis.discovered_urls_count,
            "is_index": sitemap_analysis.is_sitemap_index,
        },
        "resources": resource_summary,
        "source_maps_detected": [
            {"script_url": sm.script_url, "map_url": sm.map_url, "status_code": sm.status_code}
            for sm in source_maps_detected
        ],
        "technologies": technologies_detected,
        # Phase F2 Structured Sections
        "tls": tls_analysis_data,
        "dns": dns_analysis_data,
        "email_security": email_sec_data,
        "hsts": hsts_analysis_data,
        "csp": csp_analysis_data,
        "security_headers_quality": headers_quality_data,
        "http_protocol": http_protocol_data,
        # Phase F3 Structured Section
        "frontend_security": frontend_sec_data,
        # Phase F4 Structured Section
        "application_security": appsec_data,
        # Phase F5 Structured Section
        "identity_security": identity_sec_data,
        # Phase F6 Structured Section
        "infrastructure_security": infra_sec_data,
        # Phase F7 Structured Section
        "data_security": data_sec_data,
        # Phase F8 Structured Section
        "risk_intelligence": risk_intelligence_data,
    }

    return DeepScanResult(
        domain=target_domain,
        normalized_domain=normalized_domain,
        target_ip=target_ip,
        score=score,
        risk_level=risk_level,
        score_breakdown=breakdown,
        findings=all_findings,
        passed_checks_count=passed_count,
        total_checks_count=len(all_findings),
        scan_duration_ms=duration_ms,
        started_at=start_time,
        completed_at=completed_at,
        pages_discovered=discovered_count,
        pages_crawled=len(crawled_pages),
        pages_skipped=len(skipped_urls),
        crawl_depth=cfg.max_depth,
        skipped_urls=skipped_urls,
        pages=pages_summary,
        categories_summary=breakdown,
        scan_metadata=scan_metadata,
        error_message=error_message,
        is_partial=is_partial,
    )
