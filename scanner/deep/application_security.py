"""
Scanly Scanner Engine - Phase F4 Application Security Orchestrator
Master coordinator for Phase F4: Advanced Web Application, API & HTTP Security Intelligence.
Integrates CORS analysis, HTTP method inspection, error/stack trace scanning,
cache security, OpenAPI/Swagger analysis, GraphQL inspection, and passive auth signals.
Enforces strict request budgets, timeout bounds, and resilient failure isolation.
"""
from typing import Dict, List, Optional, Any, Tuple, Set
from urllib.parse import urlparse, urljoin
import logging

from scanner.models import Finding
from scanner.network.http_client import SafeHttpClient
from .links import is_same_origin

from .config import DeepScanConfig
from .models import CrawledPage
from .cors_analyzer import (
    evaluate_cors_configuration,
    probe_cors_reflection_safe,
    build_cors_findings,
)
from .error_analyzer import (
    inspect_response_for_errors,
    build_error_findings,
)
from .cache_analyzer import (
    evaluate_cache_security,
    build_cache_findings,
)
from .http_security import (
    analyze_http_methods,
    analyze_server_headers,
    detect_soft_404,
    detect_directory_listing,
    extract_redirect_parameters,
    build_http_security_findings,
    SENSITIVE_BACKUP_EXTENSIONS,
)
from .api_security import (
    classify_api_endpoint,
    parse_openapi_spec_safely,
    inspect_json_response_for_sensitive_fields,
    parse_security_txt,
    extract_rate_limit_headers,
    build_api_security_findings,
    DOCS_PATHS,
    WELL_KNOWN_PATHS,
    HEALTH_METRICS_PATHS,
)

logger = logging.getLogger(__name__)


def analyze_application_security(
    crawled_pages: List[CrawledPage],
    client: SafeHttpClient,
    target_domain: str,
    config: Optional[DeepScanConfig] = None,
    frontend_metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Executes Phase F4 Application, API & HTTP Security Intelligence.
    Guarantees:
    - Reuses crawl data where possible (0 extra requests).
    - Respects strict bounded request budget (max 30 requests total).
    - Failure isolated: single module exceptions do not abort the scan.
    - Zero raw secrets stored or emitted.
    """
    cfg = config or DeepScanConfig()
    findings: List[Finding] = []

    # Request budget tracking
    max_requests = cfg.max_f4_requests
    request_count = 0
    executed_requests: Set[Tuple[str, str]] = set()

    def can_request() -> bool:
        return request_count < max_requests

    base_url = f"https://{target_domain}"
    if crawled_pages and crawled_pages[0].url:
        parsed_first = urlparse(crawled_pages[0].url)
        base_url = f"{parsed_first.scheme}://{parsed_first.netloc}"

    # Aggregators across all inspected endpoints
    analyzed_endpoints: List[Dict[str, Any]] = []
    cors_evaluations: List[Dict[str, Any]] = []
    error_inspections: List[Dict[str, Any]] = []
    cache_evaluations: List[Dict[str, Any]] = []
    method_analyses: List[Dict[str, Any]] = []
    server_disclosure_data: Dict[str, Any] = {}
    soft_404s: List[str] = []
    directory_listings: List[str] = []
    redirect_params: List[Dict[str, str]] = []
    sensitive_backup_files: List[str] = []
    api_docs_analyses: List[Dict[str, Any]] = []
    sensitive_json_fields: List[Dict[str, Any]] = []
    health_metrics_data: Dict[str, Any] = {"endpoints": [], "disclosed_info": []}
    graphql_data: Dict[str, Any] = {"is_public": False, "url": None}
    rate_limit_obs: Dict[str, Any] = {"observed": False}
    auth_data: Dict[str, Any] = {
        "detected": False,
        "login_endpoints": [],
        "session_cookie_detected": False,
        "bearer_auth_detected": False,
        "oauth_detected": False,
    }
    authorization_signals: List[Dict[str, str]] = []
    security_txt_data: Optional[Dict[str, Any]] = None

    # =========================================================================
    # STAGE 1: Passive Analysis of Already-Crawled Pages (0 New Requests)
    # =========================================================================
    all_discovered_links: List[str] = []

    for page in crawled_pages:
        # Error & Debug inspection
        try:
            err_res = inspect_response_for_errors(
                url=page.url,
                status_code=page.status_code,
                body_text=page.body_sample,
                headers=page.headers,
            )
            error_inspections.append(err_res)
        except Exception as exc:
            logger.debug(f"Error inspecting page {page.url} for tracebacks: {exc}")

        # Server Header inspection
        if not server_disclosure_data and page.headers:
            try:
                server_disclosure_data = analyze_server_headers(page.headers)
            except Exception:
                pass

        # Rate Limit observation
        if not rate_limit_obs.get("observed") and page.headers:
            try:
                rl = extract_rate_limit_headers(page.headers)
                if rl.get("observed"):
                    rate_limit_obs = rl
            except Exception:
                pass

        # Cache directives
        if page.headers:
            try:
                c_eval = evaluate_cache_security(
                    url=page.url,
                    headers=page.headers,
                    status_code=page.status_code,
                    cookies_present=bool(page.cookies or page.set_cookie_headers),
                )
                cache_evaluations.append(c_eval)
            except Exception:
                pass

        # CORS on crawled pages
        if page.headers and any("access-control-" in k.lower() for k in page.headers):
            try:
                cors_res = evaluate_cors_configuration(page.headers, url=page.url)
                cors_evaluations.append(cors_res)
            except Exception:
                pass

        # Soft-404 detection
        try:
            if detect_soft_404(page.url, page.status_code, page.title, page.body_sample):
                soft_404s.append(page.url)
        except Exception:
            pass

        # Directory listing detection
        try:
            if detect_directory_listing(page.body_sample):
                directory_listings.append(page.url)
        except Exception:
            pass

        # Allow header inspection
        lower_hdrs = {k.lower(): v for k, v in page.headers.items()}
        if "allow" in lower_hdrs:
            try:
                method_analyses.append(analyze_http_methods(lower_hdrs["allow"], url=page.url))
            except Exception:
                pass

        # Collect discovered links
        all_discovered_links.extend(page.discovered_links)

        # Check for auth signals in crawled cookies/headers
        if page.cookies or page.set_cookie_headers:
            auth_data["session_cookie_detected"] = True
            auth_data["detected"] = True
        if "www-authenticate" in lower_hdrs:
            auth_data["bearer_auth_detected"] = "bearer" in lower_hdrs["www-authenticate"].lower()
            auth_data["detected"] = True

        # Endpoint categorization
        ep_category = classify_api_endpoint(page.url)
        if ep_category == "AUTH":
            auth_data["login_endpoints"].append(page.url)
            auth_data["detected"] = True
        elif ep_category == "ADMIN":
            authorization_signals.append({"type": "admin_endpoint", "url": page.url})

        # Record endpoint profile
        analyzed_endpoints.append({
            "url": page.url,
            "method": "GET",
            "status_code": page.status_code,
            "category": ep_category,
            "has_cors": any("access-control-" in k.lower() for k in page.headers),
            "is_sensitive": ep_category in ("AUTH", "ADMIN", "USER", "PAYMENT"),
            "source": "crawl",
        })

    # Redirect parameter and sensitive file discovery from crawl links
    try:
        redirect_params = extract_redirect_parameters(all_discovered_links)
    except Exception:
        redirect_params = []

    for link in all_discovered_links:
        path_lower = urlparse(link).path.lower()
        if any(path_lower.endswith(ext) for ext in SENSITIVE_BACKUP_EXTENSIONS):
            sensitive_backup_files.append(link)

    # =========================================================================
    # STAGE 2: F3-Discovered Endpoints Correlation & Safe Probing
    # =========================================================================
    f3_endpoints: List[str] = []
    if frontend_metadata and "endpoints" in frontend_metadata:
        f3_items = frontend_metadata["endpoints"].get("items", [])
        for item in f3_items:
            ep = item.get("endpoint", "")
            if ep and ep.startswith("/"):
                f3_endpoints.append(urljoin(base_url, ep))
            elif ep and is_same_origin(ep, target_domain):
                f3_endpoints.append(ep)

    # Prioritize sensitive / admin / auth routes
    sorted_candidates = sorted(
        list(set(f3_endpoints)),
        key=lambda u: (0 if classify_api_endpoint(u) in ("AUTH", "ADMIN", "USER", "PAYMENT") else 1, u)
    )

    cors_tests_count = 0
    options_count = 0

    for ep_url in sorted_candidates:
        if not can_request() or len(analyzed_endpoints) >= cfg.max_f4_endpoints:
            break

        # A. Safe OPTIONS request for Allow & CORS
        if options_count < cfg.max_f4_options_requests:
            req_key = (ep_url, "OPTIONS")
            if req_key not in executed_requests:
                executed_requests.add(req_key)
                request_count += 1
                options_count += 1
                try:
                    resp = client.options(ep_url, max_redirects=1)
                    if resp.headers:
                        low_hdrs = {k.lower(): v for k, v in resp.headers.items()}
                        if "allow" in low_hdrs:
                            method_analyses.append(analyze_http_methods(low_hdrs["allow"], url=ep_url))
                except Exception:
                    pass

        # B. Safe synthetic CORS reflection test
        if cors_tests_count < cfg.max_f4_cors_tests:
            req_key = (ep_url, "CORS_TEST")
            if req_key not in executed_requests:
                executed_requests.add(req_key)
                request_count += 1
                cors_tests_count += 1
                try:
                    cors_eval, _ = probe_cors_reflection_safe(ep_url, client)
                    if cors_eval.get("has_cors"):
                        cors_evaluations.append(cors_eval)
                except Exception:
                    pass

        # C. Safe GET for JSON responses
        req_key = (ep_url, "GET")
        if req_key not in executed_requests:
            executed_requests.add(req_key)
            request_count += 1
            try:
                resp = client.get(ep_url, max_redirects=2, max_response_bytes=cfg.max_f4_response_bytes)
                if resp.status_code is not None:
                    cat = classify_api_endpoint(ep_url)
                    analyzed_endpoints.append({
                        "url": ep_url,
                        "method": "GET",
                        "status_code": resp.status_code,
                        "category": cat,
                        "has_cors": any("access-control-" in k.lower() for k in resp.headers),
                        "is_sensitive": cat in ("AUTH", "ADMIN", "USER", "PAYMENT"),
                        "source": "f3_discovered",
                    })

                    # Check sensitive JSON fields
                    if resp.text and (resp.headers.get("content-type") or "").lower().startswith("application/json"):
                        fields_leak = inspect_json_response_for_sensitive_fields(resp.text, ep_url)
                        sensitive_json_fields.extend(fields_leak)

                    # Check for errors in response
                    if resp.text:
                        err_res = inspect_response_for_errors(ep_url, resp.status_code, resp.text, resp.headers)
                        error_inspections.append(err_res)

                    # Check cache headers
                    if resp.headers:
                        c_eval = evaluate_cache_security(
                            ep_url,
                            resp.headers,
                            resp.status_code,
                            cookies_present=bool(resp.cookies or resp.set_cookie_headers),
                        )
                        cache_evaluations.append(c_eval)
            except Exception:
                pass

    # =========================================================================
    # STAGE 3: Bounded Targeted Inquiries (Documentation, Schemas, GraphQL)
    # =========================================================================
    
    # 3.1 API Documentation & Schemas
    docs_checked = 0
    for doc_path in DOCS_PATHS:
        if not can_request() or docs_checked >= cfg.max_api_docs_checks:
            break
        doc_url = urljoin(base_url, doc_path)
        req_key = (doc_url, "GET")
        if req_key in executed_requests:
            continue
        executed_requests.add(req_key)
        request_count += 1
        docs_checked += 1

        try:
            resp = client.get(doc_url, max_redirects=2, max_response_bytes=cfg.max_f4_response_bytes)
            if resp.status_code and resp.status_code < 400 and resp.text:
                if doc_path.endswith(".json") or "openapi" in doc_path or "swagger" in doc_path:
                    spec_info, err = parse_openapi_spec_safely(
                        resp.text,
                        max_depth=cfg.max_f4_json_depth,
                        max_keys=cfg.max_f4_json_keys,
                    )
                    if spec_info.get("is_valid"):
                        spec_info["url"] = doc_url
                        api_docs_analyses.append(spec_info)
                elif "html" in (resp.headers.get("content-type") or "").lower():
                    # HTML documentation (Swagger UI or ReDoc)
                    if any(m in resp.text.lower() for m in ("swagger", "redoc", "openapi")):
                        api_docs_analyses.append({
                            "is_valid": True,
                            "url": doc_url,
                            "title": "Interactive Documentation UI",
                            "openapi_version": "UI",
                            "servers": [],
                            "internal_server_urls": [],
                            "declared_security_schemes": [],
                            "total_paths": 0,
                            "discovered_routes": [],
                            "sensitive_paths_missing_security": [],
                        })
        except Exception as exc:
            logger.debug(f"Failed querying docs path {doc_url}: {exc}")

    # 3.2 GraphQL Endpoint Probe (Safe GET Only)
    if can_request():
        gql_url = urljoin(base_url, "/graphql")
        req_key = (gql_url, "GET")
        if req_key not in executed_requests:
            executed_requests.add(req_key)
            request_count += 1
            try:
                resp = client.get(gql_url, max_redirects=1)
                if resp.status_code in (200, 400, 405):
                    ct = (resp.headers.get("content-type") or "").lower()
                    text_lower = (resp.text or "").lower()
                    if "graphql" in ct or "graphql" in text_lower or "query" in text_lower:
                        graphql_data = {
                            "is_public": True,
                            "url": gql_url,
                            "status_code": resp.status_code,
                            "content_type": ct,
                        }
            except Exception:
                pass

    # 3.3 Well-Known Security.txt
    if can_request():
        sec_url = urljoin(base_url, "/.well-known/security.txt")
        req_key = (sec_url, "GET")
        if req_key not in executed_requests:
            executed_requests.add(req_key)
            request_count += 1
            try:
                resp = client.get(sec_url, max_redirects=2)
                if resp.status_code == 200 and resp.text and "contact:" in resp.text.lower():
                    security_txt_data = parse_security_txt(resp.text, sec_url)
            except Exception:
                pass

    # 3.4 Health & Metrics
    for hm_path in HEALTH_METRICS_PATHS:
        if not can_request():
            break
        hm_url = urljoin(base_url, hm_path)
        req_key = (hm_url, "GET")
        if req_key in executed_requests:
            continue
        executed_requests.add(req_key)
        request_count += 1
        try:
            resp = client.get(hm_url, max_redirects=1)
            if resp.status_code == 200 and resp.text:
                health_metrics_data["endpoints"].append(hm_url)
                text_lower = resp.text.lower()
                disclosed = []
                for infra_term in ("database", "redis", "postgres", "mysql", "mongodb", "rabbitmq", "uptime", "version"):
                    if infra_term in text_lower:
                        disclosed.append(infra_term)
                if disclosed:
                    health_metrics_data["disclosed_info"].append({
                        "url": hm_url,
                        "disclosed_technologies": disclosed,
                    })
        except Exception:
            pass

    # =========================================================================
    # STAGE 4: Compile Findings with Anti-Double-Counting Rules
    # =========================================================================
    
    # 4.1 CORS Findings
    try:
        cors_findings = build_cors_findings(cors_evaluations)
        findings.extend(cors_findings)
    except Exception as exc:
        logger.error(f"Error compiling CORS findings: {exc}")

    # 4.2 Error Disclosure Findings
    try:
        error_findings = build_error_findings(error_inspections)
        findings.extend(error_findings)
    except Exception as exc:
        logger.error(f"Error compiling error findings: {exc}")

    # 4.3 Cache Security Findings
    try:
        cache_findings = build_cache_findings(cache_evaluations)
        findings.extend(cache_findings)
    except Exception as exc:
        logger.error(f"Error compiling cache findings: {exc}")

    # 4.4 HTTP Methods & Server Disclosures Findings
    try:
        http_findings = build_http_security_findings(
            method_analyses=method_analyses,
            server_disclosure=server_disclosure_data,
            soft_404s=soft_404s,
            directory_listings=directory_listings,
            redirect_params=redirect_params,
            sensitive_files=sensitive_backup_files,
        )
        findings.extend(http_findings)
    except Exception as exc:
        logger.error(f"Error compiling HTTP security findings: {exc}")

    # 4.5 API Security & Documentation Findings
    try:
        admin_urls = [ep["url"] for ep in analyzed_endpoints if ep.get("category") == "ADMIN"]
        api_findings = build_api_security_findings(
            docs_analyses=api_docs_analyses,
            sensitive_json_fields=sensitive_json_fields,
            health_disclosures=health_metrics_data.get("disclosed_info", []),
            graphql_info=graphql_data,
            admin_endpoints=list(set(admin_urls)),
        )
        findings.extend(api_findings)
    except Exception as exc:
        logger.error(f"Error compiling API security findings: {exc}")

    # =========================================================================
    # STAGE 5: Structured Application Security Metadata
    # =========================================================================
    appsec_metadata: Dict[str, Any] = {
        "status": "completed",
        "requests_executed": request_count,
        "endpoints": analyzed_endpoints[:25],
        "endpoints_count": len(analyzed_endpoints),
        "cors": {
            "configurations_count": len(cors_evaluations),
            "evaluations": cors_evaluations[:10],
        },
        "http_methods": {
            "analyses": method_analyses[:10],
            "dangerous_methods_observed": any(ma.get("has_trace") for ma in method_analyses),
        },
        "authentication": auth_data,
        "authorization_signals": authorization_signals[:10],
        "api_docs": {
            "discovered_count": len(api_docs_analyses),
            "specs": api_docs_analyses[:5],
        },
        "errors": {
            "inspected_responses_count": len(error_inspections),
            "stack_traces_count": len([i for i in error_inspections if i.get("stack_traces")]),
            "database_errors_count": len([i for i in error_inspections if i.get("database_errors")]),
            "debug_pages_count": len([i for i in error_inspections if i.get("debug_pages")]),
            "internal_paths_count": len([i for i in error_inspections if i.get("internal_paths")]),
        },
        "cache": {
            "observations_count": len(cache_evaluations),
            "sensitive_cached_count": len([
                c for c in cache_evaluations
                if "sensitive_public_cache" in c.get("issues", [])
            ]),
        },
        "server_disclosure": server_disclosure_data,
        "redirects": {
            "parameters_detected_count": len(redirect_params),
            "parameters": redirect_params[:10],
        },
        "directory_exposure": {
            "listings_count": len(directory_listings),
            "listings": directory_listings[:5],
            "backup_files_count": len(sensitive_backup_files),
            "backup_files": sensitive_backup_files[:5],
        },
        "health_metrics": health_metrics_data,
        "graphql": graphql_data,
        "rate_limiting": rate_limit_obs,
        "security_txt": security_txt_data,
    }

    return appsec_metadata, findings
