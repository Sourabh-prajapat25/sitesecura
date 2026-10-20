"""
Scanly Scanner Engine - Deep Scan Multi-Page Header Consistency Module
Compares security headers across all discovered pages to identify inconsistent coverage or missing policies.
"""
from typing import List, Dict, Any, Tuple
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage

AUDITED_HEADERS = [
    ("strict-transport-security", "Strict-Transport-Security (HSTS)", "hsts", -8, Severity.MEDIUM),
    ("content-security-policy", "Content Security Policy (CSP)", "csp", -10, Severity.HIGH),
    ("x-frame-options", "X-Frame-Options", "x_frame_options", -5, Severity.LOW),
    ("x-content-type-options", "X-Content-Type-Options", "x_content_type_options", -4, Severity.LOW),
    ("referrer-policy", "Referrer-Policy", "referrer_policy", -3, Severity.LOW),
    ("permissions-policy", "Permissions-Policy", "permissions_policy", -3, Severity.LOW),
]


def analyze_multi_page_headers(crawled_pages: List[CrawledPage]) -> List[Finding]:
    """
    Analyzes and compares security header presence and uniformity across all crawled pages.
    """
    findings: List[Finding] = []

    # Filter to successful HTML pages
    valid_pages = [p for p in crawled_pages if p.status_code and p.status_code < 400]
    if not valid_pages:
        return findings

    total_valid = len(valid_pages)

    for header_name, display_name, check_slug, score_impact, default_sev in AUDITED_HEADERS:
        pages_with_header: List[str] = []
        pages_without_header: List[str] = []

        for p in valid_pages:
            norm_headers = {k.lower(): v for k, v in p.headers.items()}
            val = norm_headers.get(header_name)
            if val and val.strip():
                pages_with_header.append(p.url)
            else:
                pages_without_header.append(p.url)

        with_count = len(pages_with_header)
        without_count = len(pages_without_header)

        # Case 1: Header present uniformly on all pages (100% coverage)
        if without_count == 0:
            findings.append(
                Finding(
                    check_type=f"deep_{check_slug}_uniform",
                    name=f"Uniform {display_name}",
                    status=CheckStatus.PASS,
                    severity=Severity.INFO,
                    score_impact=0,
                    title=f"Consistent {display_name} Across All Pages",
                    summary=f"{display_name} is active and uniformly returned across all {total_valid} analyzed pages.",
                    why_it_matters=f"Consistent header enforcement ensures visitors remain protected as they navigate across subpages.",
                    how_to_fix=f"Maintain global web server header directives.",
                    estimated_fix_minutes=0,
                    documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers",
                    evidence=f"Present on all {total_valid} discovered pages.",
                )
            )

        # Case 2: Header present on some pages, but missing on others (Inconsistent coverage)
        elif with_count > 0 and without_count > 0:
            evidence_sample = pages_without_header[:5]
            evidence_str = f"Missing on {without_count} of {total_valid} pages:\n" + "\n".join(evidence_sample)
            if without_count > 5:
                evidence_str += f"\n...and {without_count - 5} more pages"

            findings.append(
                Finding(
                    check_type=f"deep_{check_slug}_inconsistent",
                    name=f"Inconsistent {display_name}",
                    status=CheckStatus.WARNING,
                    severity=default_sev,
                    score_impact=int(score_impact * 0.75),  # Partial deduction for partial coverage
                    title=f"Inconsistent {display_name} Across Discovered Pages",
                    summary=f"{display_name} was detected on {with_count} pages, but is missing on {without_count} subpages.",
                    why_it_matters=f"Security headers applied selectively leave unprotected routes vulnerable to exploits (e.g. clickjacking or script injection) when users visit subpages.",
                    how_to_fix=f"Define the {header_name} header in your top-level web server configuration (Nginx / Apache / Caddy) rather than per-route application handlers.",
                    estimated_fix_minutes=10,
                    documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers",
                    evidence=evidence_str,
                )
            )

        # Case 3: Missing everywhere
        else:
            findings.append(
                Finding(
                    check_type=f"deep_{check_slug}_missing",
                    name=f"Missing {display_name}",
                    status=CheckStatus.WARNING if header_name != "content-security-policy" else CheckStatus.HIGH,
                    severity=default_sev,
                    score_impact=score_impact,
                    title=f"{display_name} Missing Across All Pages",
                    summary=f"{display_name} was not detected on any of the {total_valid} crawled pages.",
                    why_it_matters=f"Without {display_name}, browsers lack instructions to enforce vital security defenses.",
                    how_to_fix=f"Add the {header_name} header in your web server or edge CDN configuration.",
                    estimated_fix_minutes=15,
                    documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers",
                    evidence=f"Audited {total_valid} pages without detecting header.",
                )
            )

    return findings
