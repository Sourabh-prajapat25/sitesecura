"""
Scanly Scanner Engine - Frontend Security & JavaScript Intelligence Orchestrator (Phase F3)
Coordinates passive JavaScript asset analysis, route discovery, secret scanning,
SRI validation, client storage analysis, dangerous DOM sinks, and deep source map inspection.
"""
import hashlib
from typing import List, Dict, Any, Tuple, Set, Optional
from urllib.parse import urlparse

from scanner.network.http_client import SafeHttpClient
from scanner.models import Finding, CheckStatus, Severity
from .config import DeepScanConfig
from .models import CrawledPage, ResourceItem
from .secrets import (
    scan_text_for_secrets,
    scan_text_for_internal_ips_and_configs,
    mask_secret,
)
from .js_analyzer import (
    classify_third_party_host,
    is_cdn_host,
    extract_endpoints_from_script,
    analyze_client_storage,
    analyze_dom_security,
)
from .source_map_deep import analyze_deep_source_maps


def analyze_frontend_security(
    crawled_pages: List[CrawledPage],
    client: SafeHttpClient,
    target_domain: str,
    config: Optional[DeepScanConfig] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Executes Phase F3 Frontend, JavaScript & Client-Side Exposure Intelligence:
    1. Compiles JavaScript asset inventory (first-party vs third-party, SRI, sizes).
    2. Safely fetches script bundles with strict size/count bounds and SHA-256 caching.
    3. Scans bundles and inline scripts for sensitive secrets (AWS, Stripe, Google, JWT, Slack, private keys).
    4. Passively discovers API routes, GraphQL operations, WebSockets, and privileged admin endpoints.
    5. Analyzes client storage (localStorage tokens) and dangerous DOM sinks (eval, innerHTML, postMessage).
    6. Performs deep source map analysis for embedded source code and internal filesystem disclosure.
    7. Applies strict deduplication and anti-double-counting rules.
    8. Produces structured metadata and deterministic security findings.
    """
    cfg = config or DeepScanConfig()
    findings: List[Finding] = []

    # 1. Collect all script resources
    all_script_resources: List[ResourceItem] = []
    seen_script_urls: Set[str] = set()
    script_inventory: List[Dict[str, Any]] = []

    for page in crawled_pages:
        for res in page.resources:
            if res.resource_type == "script":
                all_script_resources.append(res)
                if res.resource_url not in seen_script_urls:
                    seen_script_urls.add(res.resource_url)
                    parsed_u = urlparse(res.resource_url)
                    host = parsed_u.hostname or ""
                    has_sri = bool(res.integrity and res.integrity.strip())
                    sri_valid = has_sri and any(
                        res.integrity.strip().startswith(algo)
                        for algo in ("sha256-", "sha384-", "sha512-")
                    )
                    script_inventory.append({
                        "url": res.resource_url,
                        "host": host,
                        "is_external": res.is_external,
                        "third_party_category": classify_third_party_host(host) if res.is_external else "first_party",
                        "is_cdn": is_cdn_host(host) if res.is_external else False,
                        "has_sri": has_sri,
                        "sri_valid": sri_valid,
                        "integrity": res.integrity,
                        "crossorigin": res.crossorigin,
                        "bytes": 0,
                    })

    # Sort scripts to prioritize same-origin / first-party scripts for analysis
    sorted_candidate_urls = sorted(
        list(seen_script_urls),
        key=lambda u: (1 if target_domain not in u else 0, u)
    )

    # 2. Bounded script fetching with single-scan SHA-256 caching
    fetched_count = 0
    total_bytes_fetched = 0
    analyzed_hashes: Set[str] = set()

    # Aggregators across all scripts and inline code
    all_raw_secrets: List[Dict[str, Any]] = []
    all_endpoints: List[Dict[str, Any]] = []
    all_storage_items: List[Dict[str, Any]] = []
    all_service_workers: List[str] = []
    all_dom_sinks: List[Dict[str, Any]] = []
    all_internal_ips: List[Dict[str, str]] = []
    all_framework_envs: List[Dict[str, str]] = []
    postmessage_origin_missing_any = False
    has_auth_tokens_in_storage = False

    for s_url in sorted_candidate_urls:
        if fetched_count >= cfg.max_scripts_to_analyze:
            break
        if total_bytes_fetched >= cfg.max_total_script_bytes:
            break

        try:
            resp = client.get(
                s_url,
                max_redirects=2,
                max_response_bytes=cfg.max_script_bytes,
            )
            if resp.status_code == 200 and resp.text:
                content = resp.text
                c_bytes = resp.bytes_read or len(content.encode("utf-8", errors="replace"))
                fetched_count += 1
                total_bytes_fetched += c_bytes

                # Update bytes in script inventory
                for item in script_inventory:
                    if item["url"] == s_url:
                        item["bytes"] = c_bytes
                        break

                content_hash = hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()
                if content_hash in analyzed_hashes:
                    # Skip duplicate bundle content
                    continue
                analyzed_hashes.add(content_hash)

                # Analyze script content
                sec_items = scan_text_for_secrets(content, source_identifier=s_url)
                all_raw_secrets.extend(sec_items)

                eps = extract_endpoints_from_script(content, source_url=s_url)
                all_endpoints.extend(eps)

                st_res = analyze_client_storage(content, source_url=s_url)
                all_storage_items.extend(st_res.get("items", []))
                all_service_workers.extend(st_res.get("service_workers", []))
                if st_res.get("has_auth_tokens"):
                    has_auth_tokens_in_storage = True

                dom_res = analyze_dom_security(content, source_url=s_url)
                all_dom_sinks.extend(dom_res.get("sinks", []))
                if dom_res.get("postmessage_origin_missing"):
                    postmessage_origin_missing_any = True

                ips, envs = scan_text_for_internal_ips_and_configs(content, source_identifier=s_url)
                all_internal_ips.extend(ips)
                all_framework_envs.extend(envs)

        except Exception:
            continue

    # 3. Analyze inline scripts from crawled pages
    inline_scripts_checked = 0
    for page in crawled_pages:
        for inline_code in getattr(page, "inline_scripts", []):
            if inline_scripts_checked >= 10:
                break
            inline_scripts_checked += 1
            source_id = f"inline_script@{page.url}"

            sec_items = scan_text_for_secrets(inline_code, source_identifier=source_id)
            all_raw_secrets.extend(sec_items)

            eps = extract_endpoints_from_script(inline_code, source_url=source_id)
            all_endpoints.extend(eps)

            st_res = analyze_client_storage(inline_code, source_url=source_id)
            all_storage_items.extend(st_res.get("items", []))
            if st_res.get("has_auth_tokens"):
                has_auth_tokens_in_storage = True

            dom_res = analyze_dom_security(inline_code, source_url=source_id)
            all_dom_sinks.extend(dom_res.get("sinks", []))
            if dom_res.get("postmessage_origin_missing"):
                postmessage_origin_missing_any = True

            ips, envs = scan_text_for_internal_ips_and_configs(inline_code, source_identifier=source_id)
            all_internal_ips.extend(ips)
            all_framework_envs.extend(envs)

    # 4. Deep Source Map Inspection
    source_map_summary: Dict[str, Any] = {}
    sourcemap_findings: List[Finding] = []
    secrets_from_maps: List[Dict[str, Any]] = []

    if cfg.check_source_maps:
        try:
            source_map_summary, secrets_from_maps, sourcemap_findings = analyze_deep_source_maps(
                crawled_pages=crawled_pages,
                client=client,
                target_domain=target_domain,
                max_map_checks=5,
                max_map_bytes=cfg.max_source_map_deep_bytes,
            )
            findings.extend(sourcemap_findings)
        except Exception:
            pass

    # 5. Deduplicate Secrets (Anti-Double-Counting across JS Bundles and Source Maps)
    canonical_secrets_map: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for sec in all_raw_secrets + secrets_from_maps:
        key = (sec["secret_type"], sec["masked_value"])
        if key not in canonical_secrets_map:
            canonical_secrets_map[key] = {
                "secret_type": sec["secret_type"],
                "category": sec["category"],
                "masked_value": sec["masked_value"],
                "confidence": sec["confidence"],
                "severity": sec["severity"],
                "sources": [sec["source"]],
            }
        else:
            if sec["source"] not in canonical_secrets_map[key]["sources"]:
                canonical_secrets_map[key]["sources"].append(sec["source"])

    canonical_secrets = list(canonical_secrets_map.values())

    # Emit Secret Finding
    if canonical_secrets:
        has_critical = any(s["severity"] == "CRITICAL" for s in canonical_secrets)
        evidence_lines = []
        for s in canonical_secrets[:6]:
            sources_str = ", ".join(s["sources"][:2])
            evidence_lines.append(
                f"- {s['secret_type']}: {s['masked_value']} (Confidence: {s['confidence']})\n  Found in: {sources_str}"
            )
        findings.append(
            Finding(
                check_type="deep_js_secret_exposed",
                name="Frontend Credential / Secret Exposure",
                status=CheckStatus.CRITICAL if has_critical else CheckStatus.HIGH,
                severity=Severity.CRITICAL if has_critical else Severity.HIGH,
                score_impact=-15,
                title="Sensitive Credential or API Secret Exposed in Client Code",
                summary=(
                    f"Detected {len(canonical_secrets)} potential sensitive secret(s) or private API key(s) "
                    f"embedded in public client-side JavaScript or source maps."
                ),
                why_it_matters=(
                    "Embedding private API credentials, cloud access keys, or secret tokens in client-accessible "
                    "code allows any visitor or adversary to extract them and access backend cloud infrastructure or billing."
                ),
                how_to_fix=(
                    "Revoke and rotate the exposed credentials immediately. Move all sensitive operations to server-side "
                    "API routes and access secrets strictly via server-side environment variables."
                ),
                estimated_fix_minutes=30,
                documentation_url="https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password",
                evidence="\n".join(evidence_lines),
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_js_secrets_none",
                name="Frontend Secret & Credential Audit",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="No Hardcoded Secrets or Cloud Credentials Detected",
                summary="Passive inspection did not detect private cloud keys, payment secrets, or tokens in client JavaScript.",
                why_it_matters="Keeping private credentials off client bundles prevents credential harvesting.",
                how_to_fix="Continue utilizing server-side environment variables and secrets managers.",
                estimated_fix_minutes=0,
                documentation_url="https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password",
                evidence=f"Audited {fetched_count} public script bundle(s) and {inline_scripts_checked} inline script(s).",
            )
        )

    # 6. Endpoints & Route Discovery Evaluation
    unique_endpoints_map: Dict[str, Dict[str, Any]] = {}
    for ep in all_endpoints:
        k = ep["endpoint"]
        if k not in unique_endpoints_map:
            unique_endpoints_map[k] = ep

    unique_endpoints = list(unique_endpoints_map.values())

    # Count categories
    ep_categories: Dict[str, int] = {}
    for ep in unique_endpoints:
        c = ep["category"]
        ep_categories[c] = ep_categories.get(c, 0) + 1

    insecure_ws_endpoints = [
        ep["endpoint"] for ep in unique_endpoints if ep["endpoint"].startswith("ws://")
    ]
    admin_endpoints = [
        ep["endpoint"] for ep in unique_endpoints if ep["category"] == "ADMIN"
    ]

    # Insecure WebSocket finding
    if insecure_ws_endpoints:
        findings.append(
            Finding(
                check_type="deep_js_insecure_websocket",
                name="Insecure WebSocket Protocol (ws://)",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-5,
                title="Unencrypted WebSocket Connection Discovered",
                summary=f"Found unencrypted cleartext WebSocket URL(s) ({insecure_ws_endpoints[0]}) in client JavaScript.",
                why_it_matters="Cleartext WebSocket connections (ws://) transmit message payloads without TLS encryption, susceptible to interception.",
                how_to_fix="Upgrade all WebSocket endpoints to secure WebSockets (wss://).",
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API",
                evidence="\n".join([f"- {u}" for u in insecure_ws_endpoints[:5]]),
            )
        )

    # Privileged / Admin route exposure finding
    if admin_endpoints:
        findings.append(
            Finding(
                check_type="deep_js_admin_endpoint_exposed",
                name="Privileged Admin Endpoint Reference in Frontend",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-2,
                title="Administrative / Internal Route Disclosed in Client Code",
                summary=f"Discovered {len(admin_endpoints)} administrative route path(s) referenced in client bundles.",
                why_it_matters="Revealing administrative paths assists attackers in mapping privileged entry points and internal interfaces.",
                how_to_fix="Ensure all administrative endpoints enforce strict server-side authorization and role validation regardless of client discovery.",
                estimated_fix_minutes=20,
                documentation_url="https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/",
                evidence="\n".join([f"- {ep}" for ep in admin_endpoints[:5]]),
            )
        )

    # General API Surface summary finding
    if unique_endpoints:
        cat_summary_str = ", ".join([f"{k}: {v}" for k, v in sorted(ep_categories.items())])
        sample_eps = [ep["endpoint"] for ep in unique_endpoints[:6]]
        findings.append(
            Finding(
                check_type="deep_js_api_surface_detected",
                name="Discovered Frontend API Surface",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Frontend API Surface Catalogued",
                summary=f"Identified {len(unique_endpoints)} client API route(s) across {len(ep_categories)} operational categories.",
                why_it_matters="Maintaining an accurate map of client-referenced APIs ensures complete security testing coverage.",
                how_to_fix="Review discovered routes to confirm all endpoints require authenticated sessions and proper CORS headers.",
                estimated_fix_minutes=0,
                documentation_url="https://owasp.org/www-project-api-security/",
                evidence=f"Breakdown: {cat_summary_str}\nSample endpoints:\n" + "\n".join([f"- {ep}" for ep in sample_eps]),
            )
        )

    # 7. Client-Side Storage Evaluation
    if has_auth_tokens_in_storage:
        auth_keys = [
            item["key"] for item in all_storage_items if item.get("is_auth_related")
        ]
        unique_auth_keys = sorted(list(set(auth_keys)))
        findings.append(
            Finding(
                check_type="deep_js_storage_auth_token",
                name="Client-Side Authentication Token Storage",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-4,
                title="Authentication Tokens Stored in Web Storage",
                summary=f"JavaScript patterns indicate authentication or session tokens ({', '.join(unique_auth_keys[:3])}) are stored in localStorage/sessionStorage.",
                why_it_matters="Data in localStorage and sessionStorage is readable by any script running on the page, leaving session tokens vulnerable to XSS exfiltration.",
                how_to_fix="Store session credentials in secure, HttpOnly, SameSite cookies rather than browser Web Storage.",
                estimated_fix_minutes=30,
                documentation_url="https://owasp.org/www-community/vulnerabilities/HTML5_Web_Storage",
                evidence="Detected storage keys:\n" + "\n".join([f"- {k}" for k in unique_auth_keys[:6]]),
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_js_storage_clean",
                name="Client-Side Storage Security",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="No Insecure Token Storage in Web Storage Detected",
                summary="Client scripts do not exhibit patterns of storing session tokens or secrets in localStorage.",
                why_it_matters="Avoiding Web Storage for sensitive tokens mitigates token exfiltration risks.",
                how_to_fix="Continue using HttpOnly session cookies.",
                estimated_fix_minutes=0,
                documentation_url="https://owasp.org/www-community/vulnerabilities/HTML5_Web_Storage",
                evidence="Audited client storage interactions across script bundles.",
            )
        )

    # 8. DOM Dangerous Sinks & postMessage Evaluation
    high_risk_sinks = [s for s in all_dom_sinks if s.get("severity") in ("HIGH", "MEDIUM")]
    if high_risk_sinks or postmessage_origin_missing_any:
        evidence_lines = []
        for s in high_risk_sinks[:4]:
            evidence_lines.append(f"- {s['sink']} ({s.get('count', 1)} call site(s)) in {s['source']}")
        if postmessage_origin_missing_any:
            evidence_lines.append("- postMessage event listener lacking event.origin validation")

        findings.append(
            Finding(
                check_type="deep_js_dangerous_dom_sink",
                name="Dangerous DOM Sinks / Cross-Window Messaging",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-2,
                title="Potentially Insecure DOM Execution Sinks Detected",
                summary="Identified usage of dynamic code execution sinks (eval/document.write) or unvalidated postMessage listeners.",
                why_it_matters="Dynamic evaluation sinks and unvalidated cross-window message listeners can allow attackers to execute arbitrary script in the context of the page.",
                how_to_fix="Replace eval() and document.write() with safe standard DOM APIs (e.g. textContent), and validate event.origin in all postMessage listeners.",
                estimated_fix_minutes=25,
                documentation_url="https://owasp.org/www-community/attacks/DOM_Based_XSS",
                evidence="\n".join(evidence_lines),
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_js_dom_security_pass",
                name="DOM Execution Sinks & Messaging Security",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Safe DOM Manipulation Patterns",
                summary="No dangerous dynamic eval sinks or unvalidated postMessage listeners were detected in inspected bundles.",
                why_it_matters="Safe DOM handling prevents DOM-based Cross-Site Scripting vulnerabilities.",
                how_to_fix="Maintain safe DOM practices and avoid dynamic code constructors.",
                estimated_fix_minutes=0,
                documentation_url="https://owasp.org/www-community/attacks/DOM_Based_XSS",
                evidence="Scanned script bundles for dangerous sinks (eval, document.write, innerHTML).",
            )
        )

    # 9. Third-Party CDN Subresource Integrity (SRI) Evaluation
    cdn_scripts_without_sri = [
        item for item in script_inventory if item.get("is_cdn") and not item.get("has_sri")
    ]
    cdn_scripts_with_sri = [
        item for item in script_inventory if item.get("is_cdn") and item.get("has_sri")
    ]

    if cdn_scripts_without_sri:
        evidence_lines = [
            f"- {item['url']} (Host: {item['host']})"
            for item in cdn_scripts_without_sri[:5]
        ]
        findings.append(
            Finding(
                check_type="deep_js_third_party_missing_sri",
                name="Subresource Integrity (SRI) on Third-Party CDN Scripts",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Missing SRI Hashes on External CDN Scripts",
                summary=(
                    f"Found {len(cdn_scripts_without_sri)} external CDN script(s) loaded without Subresource "
                    f"Integrity (integrity attribute) protection."
                ),
                why_it_matters=(
                    "Subresource Integrity (SRI) ensures browsers verify the cryptographic hash of scripts hosted on CDNs. "
                    "Without SRI, a compromised CDN or CDN caching node could inject malicious JavaScript into your site."
                ),
                how_to_fix=(
                    "Add integrity='sha384-...' and crossorigin='anonymous' attributes to all external <script> tags."
                ),
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity",
                evidence="\n".join(evidence_lines),
            )
        )
    elif cdn_scripts_with_sri:
        findings.append(
            Finding(
                check_type="deep_js_third_party_sri_good",
                name="Subresource Integrity (SRI) on CDN Dependencies",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="External CDN Dependencies Protected with SRI",
                summary="External CDN scripts enforce cryptographic Subresource Integrity (SRI) verification.",
                why_it_matters="SRI protects your visitors from supply-chain tampering if an external CDN is compromised.",
                how_to_fix="Ensure all future CDN additions continue to include integrity hashes.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity",
                evidence=f"Verified SRI on {len(cdn_scripts_with_sri)} external CDN script(s).",
            )
        )

    # 10. Internal IP / Localhost Exposure Evaluation
    unique_internal_ips = sorted(list({item["value"] for item in all_internal_ips}))
    sensitive_framework_envs = [
        item["variable"] for item in all_framework_envs if item.get("is_sensitive")
    ]

    if unique_internal_ips or sensitive_framework_envs:
        evidence_lines = []
        if unique_internal_ips:
            evidence_lines.append("Disclosed private/internal network addresses:")
            for ip in unique_internal_ips[:5]:
                evidence_lines.append(f"- {ip}")
        if sensitive_framework_envs:
            evidence_lines.append("Potentially sensitive public framework environment variables:")
            for env_var in sorted(list(set(sensitive_framework_envs)))[:5]:
                evidence_lines.append(f"- {env_var}")

        findings.append(
            Finding(
                check_type="deep_js_internal_ip_exposed",
                name="Internal IP Address or Staging Config Disclosure",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Private Network Address or Staging Variable in Production JS",
                summary="Client bundle references localhost/private RFC 1918 IP addresses or sensitive framework environment variables.",
                why_it_matters="Disclosing internal IP addresses and development configurations reveals internal network topologies to potential adversaries.",
                how_to_fix="Ensure production builds remove hardcoded localhost/internal IP addresses and do not prefix sensitive secrets with NEXT_PUBLIC_ or REACT_APP_.",
                estimated_fix_minutes=15,
                documentation_url="https://cwe.mitre.org/data/definitions/200.html",
                evidence="\n".join(evidence_lines),
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_js_config_clean",
                name="Production Frontend Configuration Audit",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Clean Production Configuration",
                summary="No hardcoded localhost, RFC 1918 private IP addresses, or sensitive frontend variables detected.",
                why_it_matters="Clean production builds avoid leaking staging backends or network topology.",
                how_to_fix="Maintain standard build pipelines.",
                estimated_fix_minutes=0,
                documentation_url="https://cwe.mitre.org/data/definitions/200.html",
                evidence="Scanned client code for private network indicators and framework config variables.",
            )
        )

    # 11. Compile Structured Metadata for scan_metadata["frontend_security"]
    third_party_scripts = [item for item in script_inventory if item.get("is_external")]
    first_party_scripts = [item for item in script_inventory if not item.get("is_external")]

    third_party_providers: Dict[str, Dict[str, Any]] = {}
    for item in third_party_scripts:
        h = item["host"]
        if h not in third_party_providers:
            third_party_providers[h] = {
                "host": h,
                "category": item["third_party_category"],
                "is_cdn": item["is_cdn"],
                "has_sri": item["has_sri"],
                "script_count": 1,
            }
        else:
            third_party_providers[h]["script_count"] += 1
            if item["has_sri"]:
                third_party_providers[h]["has_sri"] = True

    frontend_security_metadata = {
        "javascript": {
            "total_scripts": len(script_inventory),
            "first_party_scripts": len(first_party_scripts),
            "third_party_scripts": len(third_party_scripts),
            "scripts_analyzed": fetched_count,
            "inline_scripts_analyzed": inline_scripts_checked,
            "total_bytes_analyzed": total_bytes_fetched,
            "sri_enforced_count": len([i for i in script_inventory if i.get("has_sri")]),
            "cdn_scripts_count": len([i for i in script_inventory if i.get("is_cdn")]),
            "cdn_scripts_missing_sri": len(cdn_scripts_without_sri),
            "scripts": script_inventory[:25],
        },
        "endpoints": {
            "total_discovered": len(unique_endpoints),
            "categories": ep_categories,
            "insecure_websocket_count": len(insecure_ws_endpoints),
            "admin_routes_count": len(admin_endpoints),
            "items": unique_endpoints[:40],
        },
        "secrets": {
            "secrets_detected_count": len(canonical_secrets),
            "high_confidence_count": len([s for s in canonical_secrets if s["confidence"] == "HIGH"]),
            "items": canonical_secrets[:15],
        },
        "third_party": {
            "total_external_hosts": len(third_party_providers),
            "providers": list(third_party_providers.values())[:20],
        },
        "storage": {
            "has_auth_tokens": has_auth_tokens_in_storage,
            "service_workers_count": len(all_service_workers),
            "service_workers": all_service_workers[:5],
            "storage_items_count": len(all_storage_items),
            "sample_items": all_storage_items[:15],
        },
        "dom_security": {
            "sinks_count": len(all_dom_sinks),
            "postmessage_missing_origin": postmessage_origin_missing_any,
            "sinks": all_dom_sinks[:15],
        },
        "source_maps": source_map_summary,
        "configuration": {
            "internal_ips_count": len(unique_internal_ips),
            "internal_ips": unique_internal_ips[:10],
            "framework_envs_count": len(all_framework_envs),
            "sensitive_envs": sorted(list(set(sensitive_framework_envs)))[:10],
        },
    }

    return frontend_security_metadata, findings
