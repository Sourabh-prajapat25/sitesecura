"""
Scanly API - Standalone Security Tools Endpoints
Provides public, unauthenticated utility tools for developers, site owners, and security learners.
Enforces per-IP rate limiting, strict domain normalization, and bounded network operations.
"""
import logging
from fastapi import APIRouter, Request, status, HTTPException
from app.schemas.tools import (
    DnsLookupRequest,
    DnsLookupResponse,
    HttpStatusCheckRequest,
    HttpStatusCheckResponse,
    SecurityTxtValidateRequest,
    SecurityTxtValidateResponse,
    RobotsSitemapCheckRequest,
    RobotsSitemapCheckResponse,
    CspPolicyAnalyzeRequest,
    CspPolicyAnalyzeResponse,
)
from app.services.dns_lookup_service import execute_dns_lookup
from app.services.http_status_service import execute_http_status_check
from app.services.security_txt_service import execute_security_txt_validation
from app.services.robots_sitemap_service import execute_robots_sitemap_check
from app.services.csp_policy_service import execute_csp_policy_analysis
from app.core.rate_limit import get_client_ip, check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tools", tags=["Tools"])

# Rate limit for public DNS lookup: 30 requests per 60 seconds per IP
DNS_LOOKUP_RATE_LIMIT = 30
DNS_LOOKUP_WINDOW_SECONDS = 60

# Rate limit for public HTTP status check: 15 requests per 60 seconds per IP
HTTP_STATUS_RATE_LIMIT = 15
HTTP_STATUS_WINDOW_SECONDS = 60

# Rate limit for public security.txt validation: 15 requests per 60 seconds per IP
SECURITY_TXT_RATE_LIMIT = 15
SECURITY_TXT_WINDOW_SECONDS = 60

# Rate limit for public robots.txt & sitemap check: 15 requests per 60 seconds per IP
ROBOTS_SITEMAP_RATE_LIMIT = 15
ROBOTS_SITEMAP_WINDOW_SECONDS = 60

# Rate limit for public CSP policy analysis: 15 requests per 60 seconds per IP
CSP_POLICY_RATE_LIMIT = 15
CSP_POLICY_WINDOW_SECONDS = 60


@router.post(
    "/dns-lookup",
    response_model=DnsLookupResponse,
    status_code=status.HTTP_200_OK,
    summary="Standalone DNS Record Lookup",
    description="Queries and returns real-time DNS records (A, AAAA, CNAME, MX, NS, TXT, SOA, CAA) for a domain without executing a full perimeter scan.",
)
async def dns_lookup_endpoint(request: Request, body: DnsLookupRequest) -> DnsLookupResponse:
    """
    Executes a standalone DNS lookup for the requested domain.
    - Public utility: no authentication required.
    - Rate limited to 30 requests per minute per client IP.
    - Resolves requested record types in parallel with bounded timeout.
    """
    client_ip = get_client_ip(request)

    # Enforce IP-based rate limiting
    await check_rate_limit(
        key=f"ratelimit:tools:dns_lookup:{client_ip}",
        max_requests=DNS_LOOKUP_RATE_LIMIT,
        window_seconds=DNS_LOOKUP_WINDOW_SECONDS,
    )

    try:
        response = await execute_dns_lookup(
            domain=body.domain,
            record_types=body.record_types,
        )
        return response
    except Exception as exc:
        logger.error(f"DNS lookup failed for {body.domain}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "DNS_LOOKUP_FAILED",
                    "message": "An error occurred while resolving DNS records. Please try again shortly.",
                }
            },
        )


@router.post(
    "/http-status-check",
    response_model=HttpStatusCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Standalone HTTP Status & Redirect Checker",
    description="Inspects real-time HTTP response status, complete redirect hop chain, status descriptions, SSL transitions, and safe response headers without executing a full perimeter scan.",
)
async def http_status_check_endpoint(
    request: Request,
    body: HttpStatusCheckRequest,
) -> HttpStatusCheckResponse:
    """
    Executes a standalone HTTP Status and Redirect Check for the requested URL.
    - Public utility: no authentication required.
    - Rate limited to 15 requests per minute per client IP.
    - Follows redirects hop-by-hop up to 10 redirects, strictly validating every hop against SSRF rules.
    - Pins TCP sockets to approved public IPs to eliminate DNS rebinding risk.
    """
    client_ip = get_client_ip(request)

    # Enforce IP-based rate limiting
    await check_rate_limit(
        key=f"ratelimit:tools:http_status:{client_ip}",
        max_requests=HTTP_STATUS_RATE_LIMIT,
        window_seconds=HTTP_STATUS_WINDOW_SECONDS,
    )

    try:
        response = await execute_http_status_check(
            url=body.url,
            max_redirects=10,
            timeout=5.0,
        )
        return response
    except Exception as exc:
        logger.error(f"HTTP status check failed for {body.url}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "HTTP_STATUS_CHECK_FAILED",
                    "message": "An error occurred while inspecting the target URL. Please try again shortly.",
                }
            },
        )


@router.post(
    "/security-txt-validate",
    response_model=SecurityTxtValidateResponse,
    status_code=status.HTTP_200_OK,
    summary="Standalone RFC 9116 security.txt Validator",
    description="Fetches and validates a domain's security.txt file against RFC 9116 specifications over HTTPS without executing a full perimeter scan.",
)
async def security_txt_validate_endpoint(
    request: Request,
    body: SecurityTxtValidateRequest,
) -> SecurityTxtValidateResponse:
    """
    Executes a standalone RFC 9116 security.txt validation for the requested domain.
    - Public utility: no authentication required.
    - Rate limited to 15 requests per minute per client IP.
    - Retrieves file strictly over HTTPS with socket pinning and SSRF protection.
    - Checks standard location /.well-known/security.txt first, with /security.txt fallback.
    - Validates required fields (Contact, Expires), supported fields, syntax, and expiration dates.
    """
    client_ip = get_client_ip(request)

    # Enforce IP-based rate limiting
    await check_rate_limit(
        key=f"ratelimit:tools:security_txt:{client_ip}",
        max_requests=SECURITY_TXT_RATE_LIMIT,
        window_seconds=SECURITY_TXT_WINDOW_SECONDS,
    )

    try:
        response = await execute_security_txt_validation(
            domain=body.domain,
            timeout=5.0,
        )
        return response
    except Exception as exc:
        logger.error(f"security.txt validation failed for {body.domain}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "SECURITY_TXT_VALIDATION_FAILED",
                    "message": "An error occurred while validating the security.txt file. Please try again shortly.",
                }
            },
        )


@router.post(
    "/robots-sitemap-check",
    response_model=RobotsSitemapCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Standalone Robots.txt & Sitemap Checker",
    description="Fetches and parses a domain's robots.txt directives and discovers/validates accessible XML sitemaps without executing a full perimeter scan.",
)
async def robots_sitemap_check_endpoint(
    request: Request,
    body: RobotsSitemapCheckRequest,
) -> RobotsSitemapCheckResponse:
    """
    Executes a standalone Robots.txt and Sitemap check for the requested domain.
    - Public utility: no authentication required.
    - Rate limited to 15 requests per minute per client IP.
    - Fetches /robots.txt strictly over HTTPS with socket pinning and SSRF protection.
    - Parses RFC 9309 user-agent groups, allow/disallow patterns, wildcards and end-anchors.
    - Discovers declared sitemaps and tests conventional /sitemap.xml.
    - Validates accessible XML sitemaps up to index recursion depth 3 with same-host safe policy.
    """
    client_ip = get_client_ip(request)

    # Enforce IP-based rate limiting
    await check_rate_limit(
        key=f"ratelimit:tools:robots_sitemap:{client_ip}",
        max_requests=ROBOTS_SITEMAP_RATE_LIMIT,
        window_seconds=ROBOTS_SITEMAP_WINDOW_SECONDS,
    )

    try:
        response = await execute_robots_sitemap_check(
            domain=body.domain,
            timeout=5.0,
        )
        return response
    except Exception as exc:
        logger.error(f"Robots.txt & sitemap check failed for {body.domain}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "ROBOTS_SITEMAP_CHECK_FAILED",
                    "message": "An error occurred while inspecting robots.txt and sitemaps. Please try again shortly.",
                }
            },
        )


@router.post(
    "/csp-policy-analyze",
    response_model=CspPolicyAnalyzeResponse,
    status_code=status.HTTP_200_OK,
    summary="Standalone CSP Policy Analyzer",
    description="Analyzes pasted Content-Security-Policy text or inspects headers from a public website against W3C CSP Level 3 specifications without executing a full perimeter scan.",
)
async def csp_policy_analyze_endpoint(
    request: Request,
    body: CspPolicyAnalyzeRequest,
) -> CspPolicyAnalyzeResponse:
    """
    Executes a standalone Content Security Policy (CSP) analysis.
    - Public utility: no authentication required.
    - Rate limited to 15 requests per minute per client IP.
    - Supports Mode A (pasted policy) and Mode B (remote website header inspection).
    - In Mode B: connects over HTTPS with socket-level IP pinning, strictly validating redirects and rejecting SSRF destinations.
    - Resolves effective directive fallback hierarchy (W3C CSP Level 3).
    - Detects dangerous, weak, deprecated, duplicate, and unquoted directives.
    - Computes an explainable CSP Configuration Quality Score (0-100).
    """
    client_ip = get_client_ip(request)

    # Enforce IP-based rate limiting
    await check_rate_limit(
        key=f"ratelimit:tools:csp_policy:{client_ip}",
        max_requests=CSP_POLICY_RATE_LIMIT,
        window_seconds=CSP_POLICY_WINDOW_SECONDS,
    )

    try:
        response = await execute_csp_policy_analysis(
            request=body,
            timeout=5.0,
        )
        return response
    except Exception as exc:
        logger.error(f"CSP policy analysis failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "CSP_POLICY_ANALYSIS_FAILED",
                    "message": "An error occurred while analyzing the Content Security Policy. Please try again shortly.",
                }
            },
        )



