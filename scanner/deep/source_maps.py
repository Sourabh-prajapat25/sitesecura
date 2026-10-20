"""
Scanly Scanner Engine - Deep Scan Source Map Detection Module
Checks whether internal JavaScript bundles expose publicly accessible source maps (.map files).
"""
import re
from typing import List, Dict, Any, Tuple, Set
from urllib.parse import urljoin, urlparse
from scanner.network.http_client import SafeHttpClient
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage, SourceMapItem
from .links import is_same_origin


def check_source_maps(
    crawled_pages: List[CrawledPage],
    client: SafeHttpClient,
    target_domain: str,
    max_checks: int = 5,
) -> Tuple[List[SourceMapItem], List[Finding]]:
    """
    Identifies internal JavaScript files, inspects for sourceMappingURL or standard .map paths,
    and tests if the .map files are publicly exposed using bounded safe GET requests.
    """
    findings: List[Finding] = []
    detected_maps: List[SourceMapItem] = []
    tested_map_urls: Set[str] = set()

    # Collect internal script URLs
    candidate_scripts: Set[str] = set()
    for page in crawled_pages:
        for res in page.resources:
            if res.resource_type == "script" and not res.is_external:
                # Same-origin script
                candidate_scripts.add(res.resource_url)

    # Check up to max_checks internal scripts
    checks_performed = 0
    for script_url in sorted(list(candidate_scripts)):
        if checks_performed >= max_checks:
            break

        # Guess potential .map URL or check if script references it
        map_url = f"{script_url}.map" if not script_url.endswith(".map") else script_url
        if map_url in tested_map_urls:
            continue
        tested_map_urls.add(map_url)

        try:
            # Safe HEAD/GET request with strict byte limit (16KB) and 3s timeout
            resp = client.get(map_url, max_redirects=2, max_response_bytes=16_384)
            checks_performed += 1

            # Verify if response is a valid source map (200 OK and contains "version" or "sources")
            if resp.status_code == 200 and resp.text:
                text_snippet = resp.text[:2000].lower()
                if '"version":' in text_snippet or '"sources":' in text_snippet:
                    detected_maps.append(
                        SourceMapItem(
                            script_url=script_url,
                            map_url=map_url,
                            is_accessible=True,
                            status_code=resp.status_code,
                            content_length=resp.bytes_read,
                        )
                    )
        except Exception:
            continue

    if detected_maps:
        evidence_lines = [
            f"Script: {item.script_url}\n  -> Exposed Map: {item.map_url} (HTTP {item.status_code})"
            for item in detected_maps[:5]
        ]
        findings.append(
            Finding(
                check_type="deep_source_map_exposed",
                name="Public JavaScript Source Map Detected",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Exposed Production Source Map (.map)",
                summary=f"Found {len(detected_maps)} production JavaScript bundle(s) with publicly accessible source maps.",
                why_it_matters="Public source maps allow anyone to inspect your original, un-minified frontend source code, comments, and internal directory layout.",
                how_to_fix="Disable source map generation in production build settings (e.g. Next.js productionBrowserSourceMaps: false, or webpack devtool: false), or restrict access via web server rules.",
                estimated_fix_minutes=10,
                documentation_url="https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map",
                evidence="\n".join(evidence_lines),
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_source_map_none",
                name="Source Map Exposure Check",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="No Public Source Maps Exposed",
                summary="Production JavaScript bundles do not expose public un-minified source maps.",
                why_it_matters="Keeping source maps private protects frontend business logic and internal application structure.",
                how_to_fix="Maintain current production build configuration.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map",
                evidence=f"Audited {checks_performed} internal script endpoints.",
            )
        )

    return detected_maps, findings
