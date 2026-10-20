"""
Scanly Scanner Engine - Deep Source Map Inspection Module (Phase F3)
Performs deep passive analysis of exposed JavaScript source maps (.map files):
- Verifies sources array and identifies original source file tree.
- Detects embedded unminified source code in sourcesContent.
- Identifies internal build directory paths and developer filesystem layouts.
- Scans embedded sources for leaked credentials and API keys.
"""
import json
import re
from typing import List, Dict, Any, Tuple, Set, Optional
from urllib.parse import urlparse

from scanner.network.http_client import SafeHttpClient
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage, SourceMapItem
from .secrets import scan_text_for_secrets, scan_text_for_internal_ips_and_configs


INTERNAL_BUILD_PATH_RE = re.compile(
    r"(?:/(?:home|Users|var|workspace|build|app|runner|agent)/[a-zA-Z0-9_\-\./]+|"
    r"[A-Za-z]:\\[a-zA-Z0-9_\-\.\\]+)",
    re.I
)


def analyze_deep_source_maps(
    crawled_pages: List[CrawledPage],
    client: SafeHttpClient,
    target_domain: str,
    max_map_checks: int = 5,
    max_map_bytes: int = 262_144,  # 256 KB safety limit
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Finding]]:
    """
    Safely inspects accessible production source maps for embedded source code,
    sensitive internal file trees, and hardcoded credentials.

    Returns:
    - metadata_summary: Dict[str, Any]
    - secrets_from_maps: List[Dict[str, Any]] (Masked secrets)
    - findings: List[Finding]
    """
    findings: List[Finding] = []
    secrets_from_maps: List[Dict[str, Any]] = []

    # Collect unique internal script URLs from crawled pages
    candidate_scripts: Set[str] = set()
    for page in crawled_pages:
        for res in page.resources:
            if res.resource_type == "script" and not res.is_external:
                candidate_scripts.add(res.resource_url)

    map_details: List[Dict[str, Any]] = []
    all_internal_paths: Set[str] = set()
    all_sample_sources: List[str] = []
    total_embedded_files = 0
    any_has_embedded_code = False
    maps_checked = 0
    exposed_count = 0

    checked_map_urls: Set[str] = set()

    for script_url in sorted(list(candidate_scripts)):
        if maps_checked >= max_map_checks:
            break

        map_url = f"{script_url}.map" if not script_url.endswith(".map") else script_url
        if map_url in checked_map_urls:
            continue
        checked_map_urls.add(map_url)
        maps_checked += 1

        try:
            resp = client.get(
                map_url,
                max_redirects=2,
                max_response_bytes=max_map_bytes,
            )
            if resp.status_code != 200 or not resp.text:
                continue

            # Attempt safe JSON parse
            try:
                map_json = json.loads(resp.text)
            except Exception:
                # Incomplete or non-JSON response
                continue

            if not isinstance(map_json, dict):
                continue

            # Verify it's a valid source map
            if "version" not in map_json and "sources" not in map_json:
                continue

            exposed_count += 1
            sources = map_json.get("sources", [])
            if not isinstance(sources, list):
                sources = []

            sources_content = map_json.get("sourcesContent", [])
            if not isinstance(sources_content, list):
                sources_content = []

            # Check for embedded source code
            non_empty_content = [c for c in sources_content if isinstance(c, str) and len(c.strip()) > 0]
            has_embedded_code = len(non_empty_content) > 0
            if has_embedded_code:
                any_has_embedded_code = True
                total_embedded_files += len(non_empty_content)

            # Detect internal build filesystem paths
            detected_paths = set()
            for src_path in sources:
                if isinstance(src_path, str):
                    for match in INTERNAL_BUILD_PATH_RE.finditer(src_path):
                        detected_paths.add(match.group(0))
                        all_internal_paths.add(match.group(0))

            # Sample sources
            str_sources = [str(s) for s in sources if isinstance(s, str)]
            all_sample_sources.extend(str_sources[:5])

            # Scan embedded source content for secrets (up to first 5 embedded files)
            map_secrets: List[Dict[str, Any]] = []
            for idx, file_content in enumerate(non_empty_content[:5]):
                found_sec = scan_text_for_secrets(
                    file_content,
                    source_identifier=f"{map_url} (embedded: {sources[idx] if idx < len(sources) else 'unknown'})",
                )
                map_secrets.extend(found_sec)
                secrets_from_maps.extend(found_sec)

            map_details.append({
                "script_url": script_url,
                "map_url": map_url,
                "status_code": resp.status_code,
                "sources_count": len(sources),
                "has_embedded_code": has_embedded_code,
                "embedded_files_count": len(non_empty_content),
                "internal_paths": sorted(list(detected_paths))[:5],
                "sample_sources": str_sources[:5],
                "secrets_detected_count": len(map_secrets),
            })

        except Exception:
            continue

    summary_metadata = {
        "maps_checked": maps_checked,
        "exposed_maps_count": exposed_count,
        "has_embedded_source_code": any_has_embedded_code,
        "embedded_files_count": total_embedded_files,
        "internal_paths": sorted(list(all_internal_paths))[:10],
        "sample_sources": all_sample_sources[:15],
        "details": map_details,
    }

    # Generate Findings
    if any_has_embedded_code or all_internal_paths:
        evidence_lines = []
        if any_has_embedded_code:
            evidence_lines.append(f"Exposed embedded source code across {total_embedded_files} original file(s).")
        if all_internal_paths:
            evidence_lines.append("Disclosed build system paths:")
            for p in sorted(list(all_internal_paths))[:5]:
                evidence_lines.append(f"  - {p}")
        if all_sample_sources:
            evidence_lines.append("Original source files identified:")
            for s in all_sample_sources[:5]:
                evidence_lines.append(f"  - {s}")

        findings.append(
            Finding(
                check_type="deep_js_sourcemap_code_exposed",
                name="Source Map Unminified Code Disclosure",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-5,
                title="Public Source Map Discloses Original Source Code",
                summary=(
                    f"Production source maps expose full unminified source code ({total_embedded_files} embedded files) "
                    f"and internal build environment paths."
                ),
                why_it_matters=(
                    "Publicly exposing original TypeScript/JavaScript source code reveals proprietary frontend business logic, "
                    "internal comments, developer system directories, and internal routing structures to anyone."
                ),
                how_to_fix=(
                    "Disable public source maps in your production bundler (e.g. Next.js productionBrowserSourceMaps: false, "
                    "or webpack devtool: false), or restrict .map file access via reverse proxy / web server rules."
                ),
                estimated_fix_minutes=10,
                documentation_url="https://developer.mozilla.org/en-US/docs/Tools/Debugger/How_to/Use_a_source_map",
                evidence="\n".join(evidence_lines),
            )
        )

    return summary_metadata, secrets_from_maps, findings
