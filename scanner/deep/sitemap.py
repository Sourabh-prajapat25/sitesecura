"""
Scanly Scanner Engine - Deep Scan Sitemap Inspector
Safely checks /sitemap.xml using SafeHttpClient, extracts internal URL candidates via xml parser.
"""
from typing import List, Tuple, Set
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET
from scanner.network.http_client import SafeHttpClient
from scanner.models import Finding, CheckStatus, Severity
from .models import SitemapAnalysis


def parse_sitemap_xml(
    xml_text: str,
    sitemap_url: str = "",
    target_origin: str = "",
    max_urls: int = 100,
) -> Tuple[SitemapAnalysis, List[str]]:
    """Parses sitemap XML content and extracts page URLs."""
    discovered_urls: List[str] = []
    is_index = False

    try:
        root = ET.fromstring(xml_text)
        tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
        if tag == "sitemapindex":
            is_index = True

        for elem in root.iter():
            elem_tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
            if elem_tag == "loc" and elem.text:
                candidate = elem.text.strip()
                if candidate:
                    if target_origin:
                        from .links import is_same_origin
                        if is_same_origin(candidate, target_origin):
                            discovered_urls.append(candidate)
                    else:
                        discovered_urls.append(candidate)
                if len(discovered_urls) >= max_urls:
                    break

        analysis = SitemapAnalysis(
            url=sitemap_url,
            is_present=True,
            status_code=200,
            discovered_urls_count=len(discovered_urls),
            sample_urls=discovered_urls[:10],
            is_sitemap_index=is_index,
        )
        return analysis, discovered_urls
    except Exception:
        analysis = SitemapAnalysis(
            url=sitemap_url,
            is_present=True,
            status_code=200,
            discovered_urls_count=0,
            is_sitemap_index=False,
        )
        return analysis, []


def fetch_and_analyze_sitemap(
    base_url: str,
    client: SafeHttpClient,
    sitemap_override_url: str = None,
    max_urls: int = 100,
) -> Tuple[SitemapAnalysis, List[str], List[Finding]]:
    """
    Safely retrieves and parses /sitemap.xml (or robots-declared sitemap URL).
    Extracts internal page URLs to prime crawler discovery.
    Returns: (analysis, extracted_candidate_urls, findings)
    """
    sitemap_url = sitemap_override_url or urljoin(base_url, "/sitemap.xml")
    findings: List[Finding] = []
    discovered_urls: List[str] = []

    try:
        resp = client.get(sitemap_url, max_redirects=3, max_response_bytes=524_288)  # 512KB max
    except Exception as exc:
        analysis = SitemapAnalysis(
            url=sitemap_url,
            is_present=False,
        )
        findings.append(
            Finding(
                check_type="deep_sitemap_xml",
                name="Sitemap.xml Inspection",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Sitemap.xml Not Reachable",
                summary="The sitemap.xml file could not be retrieved from the server.",
                why_it_matters="XML sitemaps help search engines and automated crawlers discover your public canonical pages.",
                how_to_fix="Generate and publish a standard XML sitemap at /sitemap.xml.",
                estimated_fix_minutes=10,
                documentation_url="https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap",
                evidence=str(exc),
            )
        )
        return analysis, [], findings

    if not resp.is_success or not resp.text:
        analysis = SitemapAnalysis(
            url=sitemap_url,
            is_present=False,
            status_code=resp.status_code,
        )
        findings.append(
            Finding(
                check_type="deep_sitemap_xml",
                name="Sitemap.xml Inspection",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Sitemap.xml Not Found",
                summary=f"The server returned HTTP {resp.status_code} for /sitemap.xml.",
                why_it_matters="A sitemap is recommended for SEO and proper public page discovery.",
                how_to_fix="Publish a valid sitemap.xml at your website root.",
                estimated_fix_minutes=10,
                documentation_url="https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap",
                evidence=f"HTTP {resp.status_code}",
            )
        )
        return analysis, [], findings

    # Parse XML safely
    is_index = False
    try:
        root = ET.fromstring(resp.text)
        # Strip XML namespaces for simple tag matching
        tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag

        if tag == "sitemapindex":
            is_index = True
            # Sitemap index containing nested sitemaps
            for elem in root.iter():
                elem_tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
                if elem_tag == "loc" and elem.text:
                    sub_sitemap = elem.text.strip()
                    # Try to fetch first sub-sitemap if within budget
                    if len(discovered_urls) < max_urls:
                        try:
                            sub_resp = client.get(sub_sitemap, max_redirects=2, max_response_bytes=262_144)
                            if sub_resp.is_success and sub_resp.text:
                                sub_root = ET.fromstring(sub_resp.text)
                                for sub_elem in sub_root.iter():
                                    sub_tag = sub_elem.tag.split("}")[-1] if "}" in sub_elem.tag else sub_elem.tag
                                    if sub_tag == "loc" and sub_elem.text:
                                        discovered_urls.append(sub_elem.text.strip())
                                        if len(discovered_urls) >= max_urls:
                                            break
                        except Exception:
                            pass
        else:
            # Regular urlset
            for elem in root.iter():
                elem_tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag
                if elem_tag == "loc" and elem.text:
                    url_candidate = elem.text.strip()
                    if url_candidate:
                        discovered_urls.append(url_candidate)
                    if len(discovered_urls) >= max_urls:
                        break

    except Exception as parse_err:
        analysis = SitemapAnalysis(
            url=sitemap_url,
            is_present=True,
            status_code=resp.status_code,
            discovered_urls_count=0,
        )
        findings.append(
            Finding(
                check_type="deep_sitemap_xml",
                name="Sitemap.xml Inspection",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-1,
                title="Malformed Sitemap.xml",
                summary="The sitemap.xml file could not be parsed as valid XML.",
                why_it_matters="Malformed XML prevents automated search indexers from reading your URL catalog.",
                how_to_fix="Validate your sitemap.xml syntax against standard XML schema definitions.",
                estimated_fix_minutes=5,
                documentation_url="https://www.sitemaps.org/protocol.html",
                evidence=str(parse_err),
            )
        )
        return analysis, [], findings

    analysis = SitemapAnalysis(
        url=sitemap_url,
        is_present=True,
        status_code=resp.status_code,
        discovered_urls_count=len(discovered_urls),
        sample_urls=discovered_urls[:5],
        is_sitemap_index=is_index,
    )

    findings.append(
        Finding(
            check_type="deep_sitemap_xml",
            name="Sitemap.xml Inspection",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Valid Sitemap.xml Detected",
            summary=f"Sitemap parsed successfully, discovering {len(discovered_urls)} public URL candidates.",
            why_it_matters="A well-maintained XML sitemap facilitates accurate search indexing and structure discovery.",
            how_to_fix="Keep sitemap updated automatically as public pages change.",
            estimated_fix_minutes=0,
            documentation_url="https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap",
            evidence=f"Discovered {len(discovered_urls)} URL(s)",
        )
    )

    return analysis, discovered_urls, findings
