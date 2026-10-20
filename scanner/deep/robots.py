"""
Scanly Scanner Engine - Deep Scan Robots.txt Inspector
Safely checks /robots.txt using SafeHttpClient, extracts sitemaps, directives, and informs crawl scope.
"""
from typing import List, Tuple, Optional
from urllib.parse import urljoin
from scanner.network.http_client import SafeHttpClient
from scanner.models import Finding, CheckStatus, Severity
from .models import RobotsAnalysis


def parse_robots_txt(text: str, robots_url: str = "") -> RobotsAnalysis:
    """Parses robots.txt text content into a RobotsAnalysis structure."""
    sitemaps: List[str] = []
    disallowed: List[str] = []
    allowed: List[str] = []
    crawl_delay: Optional[int] = None

    lines = text.splitlines()
    applies_to_us = True

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if ":" not in line:
            continue

        field_name, field_val = line.split(":", 1)
        field_name = field_name.strip().lower()
        field_val = field_val.strip()

        if field_name == "user-agent":
            ua = field_val.lower()
            applies_to_us = (ua == "*" or "sitesecura" in ua or "bot" in ua)
        elif field_name == "sitemap":
            if field_val and field_val not in sitemaps:
                sitemaps.append(field_val)
        elif applies_to_us:
            if field_name == "disallow":
                if field_val and field_val not in disallowed:
                    disallowed.append(field_val)
            elif field_name == "allow":
                if field_val and field_val not in allowed:
                    allowed.append(field_val)
            elif field_name == "crawl-delay":
                try:
                    crawl_delay = int(field_val)
                except ValueError:
                    pass

    return RobotsAnalysis(
        url=robots_url,
        is_present=True,
        status_code=200,
        sitemap_urls=sitemaps,
        disallowed_paths=disallowed,
        allowed_paths=allowed,
        crawl_delay=crawl_delay,
        raw_content=text[:2000],
    )


def fetch_and_analyze_robots(
    base_url: str,
    client: SafeHttpClient,
) -> Tuple[RobotsAnalysis, List[Finding]]:
    """
    Safely retrieves and parses /robots.txt for the given target origin.
    Applies SSRF validation and bounded response read.
    """
    robots_url = urljoin(base_url, "/robots.txt")
    findings: List[Finding] = []

    try:
        resp = client.get(robots_url, max_redirects=3, max_response_bytes=131_072)  # 128KB max
    except Exception as exc:
        analysis = RobotsAnalysis(
            url=robots_url,
            is_present=False,
            raw_content=None,
        )
        findings.append(
            Finding(
                check_type="deep_robots_txt",
                name="Robots.txt Inspection",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Robots.txt Not Reachable",
                summary="The robots.txt file could not be retrieved from the server.",
                why_it_matters="robots.txt provides crawl guidance to search engine crawlers and web indexers.",
                how_to_fix="Optionally publish a valid /robots.txt file at the root of your domain.",
                estimated_fix_minutes=5,
                documentation_url="https://developers.google.com/search/docs/crawling-indexing/robots/intro",
                evidence=str(exc),
            )
        )
        return analysis, findings

    if not resp.is_success or not resp.text:
        analysis = RobotsAnalysis(
            url=robots_url,
            is_present=False,
            status_code=resp.status_code,
        )
        findings.append(
            Finding(
                check_type="deep_robots_txt",
                name="Robots.txt Inspection",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Robots.txt Not Present",
                summary=f"The server responded with HTTP {resp.status_code} for /robots.txt.",
                why_it_matters="A missing robots.txt means crawlers will assume all public content is available for indexing.",
                how_to_fix="Create a robots.txt file at your website root to explicitly declare indexing instructions.",
                estimated_fix_minutes=5,
                documentation_url="https://developers.google.com/search/docs/crawling-indexing/robots/intro",
                evidence=f"HTTP {resp.status_code}",
            )
        )
        return analysis, findings

    analysis = parse_robots_txt(resp.text, robots_url)
    analysis.status_code = resp.status_code

    finding_title = "Robots.txt Configured"
    finding_summary = (
        f"robots.txt detected with {len(analysis.disallowed_paths)} disallow rule(s) and {len(analysis.sitemap_urls)} sitemap reference(s)."
    )

    findings.append(
        Finding(
            check_type="deep_robots_txt",
            name="Robots.txt Inspection",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title=finding_title,
            summary=finding_summary,
            why_it_matters="robots.txt informs web crawlers which paths are indexable. Note that robots.txt is a voluntary crawler directive, not an access control security boundary.",
            how_to_fix="Ensure sensitive administrative routes rely on proper authentication rather than robots.txt disallow rules alone.",
            estimated_fix_minutes=0,
            documentation_url="https://developers.google.com/search/docs/crawling-indexing/robots/intro",
            evidence=f"Disallowed paths: {', '.join(analysis.disallowed_paths[:5]) or 'None'}",
        )
    )

    return analysis, findings


def is_path_disallowed_by_robots(path: str, disallowed_paths: List[str], allowed_paths: List[str]) -> bool:
    """
    Checks whether a relative path is disallowed based on parsed robots.txt rules.
    Standard robots.txt prefix matching semantics.
    """
    if not disallowed_paths:
        return False

    clean_path = path if path.startswith("/") else f"/{path}"

    # Explicit allow directives take precedence if more specific
    for a in allowed_paths:
        if a and clean_path.startswith(a):
            return False

    for d in disallowed_paths:
        if d == "/":
            return True
        if d and clean_path.startswith(d):
            return True

    return False
