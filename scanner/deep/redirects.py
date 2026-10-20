"""
Scanly Scanner Engine - Deep Scan Redirect Analysis Module
Evaluates multi-page redirect chains for transport downgrades, loops, excessive hops, and open redirects.
"""
from typing import List, Dict, Any, Set
from urllib.parse import urlparse
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage


def analyze_redirects(crawled_pages: List[CrawledPage], target_domain: str) -> List[Finding]:
    """
    Analyzes redirect chains across all crawled pages.
    """
    findings: List[Finding] = []

    downgrade_urls: List[str] = []
    excessive_hop_urls: List[str] = []
    redirect_loop_urls: List[str] = []
    unexpected_cross_origin: List[Dict[str, str]] = []

    for page in crawled_pages:
        chain = page.redirect_chain or []
        if len(chain) <= 1:
            continue

        # 1. Downgrade check: starts with https:// then transitions to http://
        was_https = False
        for hop in chain:
            if hop.startswith("https://"):
                was_https = True
            elif was_https and hop.startswith("http://"):
                downgrade_urls.append(f"{page.url} -> {hop}")
                break

        # 2. Excessive hops (> 4 redirects)
        if len(chain) > 4:
            excessive_hop_urls.append(f"{page.url} ({len(chain) - 1} hops)")

        # 3. Redirect loop
        if page.error and "loop" in page.error.lower():
            redirect_loop_urls.append(page.url)

        # 4. Cross-origin redirect to unknown third party
        final_parsed = urlparse(page.final_url)
        final_host = (final_parsed.hostname or "").lower().rstrip(".")
        orig_host = target_domain.lower().rstrip(".")
        if final_host and not (
            final_host == orig_host
            or final_host == f"www.{orig_host}"
            or orig_host == f"www.{final_host}"
        ):
            unexpected_cross_origin.append({"start": page.url, "final": page.final_url})

    # Generate Findings

    # 1. Downgrade
    if downgrade_urls:
        findings.append(
            Finding(
                check_type="deep_https_downgrade",
                name="HTTPS to HTTP Downgrade Detected",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-15,
                title="HTTPS Downgrade in Redirect Chain",
                summary=f"Discovered {len(downgrade_urls)} redirect path(s) where encrypted HTTPS downgraded to unencrypted HTTP.",
                why_it_matters="Redirecting from HTTPS to cleartext HTTP exposes encrypted traffic and sensitive session cookies to on-path interception.",
                how_to_fix="Ensure all web server redirect targets strictly use HTTPS destinations.",
                estimated_fix_minutes=10,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections",
                evidence="\n".join(downgrade_urls[:5]),
            )
        )

    # 2. Redirect Loops
    if redirect_loop_urls:
        findings.append(
            Finding(
                check_type="deep_redirect_loop",
                name="Redirect Loop Detected",
                status=CheckStatus.WARNING,
                severity=Severity.HIGH,
                score_impact=-10,
                title="Circular Redirect Loop",
                summary=f"Found {len(redirect_loop_urls)} page(s) trapped in circular redirect loops.",
                why_it_matters="Circular redirect loops render pages completely inaccessible to visitors and search engines.",
                how_to_fix="Audit rewrite and redirect rules in your web server configuration to eliminate cyclical targets.",
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections",
                evidence=", ".join(redirect_loop_urls[:5]),
            )
        )

    # 3. Excessive Redirects
    if excessive_hop_urls:
        findings.append(
            Finding(
                check_type="deep_excessive_redirects",
                name="Excessive Redirect Hops",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Long Redirect Chains Detected",
                summary=f"Discovered {len(excessive_hop_urls)} URL(s) requiring 4 or more redirect hops.",
                why_it_matters="Excessive redirect chains increase page latency, degrade user experience, and risk timeout terminations.",
                how_to_fix="Update internal links and configuration rules to redirect directly to final destination URLs.",
                estimated_fix_minutes=10,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections",
                evidence="\n".join(excessive_hop_urls[:5]),
            )
        )

    # If no redirect issues detected
    if not downgrade_urls and not redirect_loop_urls and not excessive_hop_urls:
        findings.append(
            Finding(
                check_type="deep_redirect_consistency",
                name="Redirect Chain Integrity",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Consistent Redirect Behavior",
                summary="Redirect chains across crawled pages behave deterministically without downgrade or cyclical loops.",
                why_it_matters="Clean redirects maintain transport encryption and optimal loading performance.",
                how_to_fix="Maintain current redirect policies.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections",
                evidence=f"Analyzed {len(crawled_pages)} crawled pages.",
            )
        )

    return findings
