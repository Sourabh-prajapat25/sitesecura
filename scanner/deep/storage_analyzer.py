"""
Scanly Scanner Engine - Phase F6 Cloud Storage & Sensitive Object Analyzer
Passively catalogs cloud storage buckets (S3, GCS, Azure Blob) naturally referenced in pages,
and safely checks whether sensitive backup, config, or database files are exposed.
Strictly bounded: Max 5 storage checks, zero bucket enumeration, zero file uploads, zero object listing.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set
from urllib.parse import urlparse

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from scanner.network.http_client import SafeHttpClient
from .models import CrawledPage


STORAGE_ENDPOINT_PATTERNS = [
    (r"https?://([a-zA-Z0-9.\-_]+)\.s3(?:[.-][a-zA-Z0-9-]+)?\.amazonaws\.com(?:/[^\s\"'<>]*)?", "Amazon S3"),
    (r"https?://s3(?:[.-][a-zA-Z0-9-]+)?\.amazonaws\.com/([a-zA-Z0-9.\-_]+)(?:/[^\s\"'<>]*)?", "Amazon S3"),
    (r"https?://storage\.googleapis\.com/([a-zA-Z0-9.\-_]+)(?:/[^\s\"'<>]*)?", "Google Cloud Storage"),
    (r"https?://([a-zA-Z0-9.\-_]+)\.blob\.core\.windows\.net/([a-zA-Z0-9.\-_]+)(?:/[^\s\"'<>]*)?", "Azure Blob Storage"),
    (r"https?://firebasestorage\.googleapis\.com/v0/b/([a-zA-Z0-9.\-_]+)(?:/[^\s\"'<>]*)?", "Firebase Storage"),
]

# Sensitive object filenames that should never be publicly accessible
SENSITIVE_OBJECT_PATTERNS = [
    r"(?i)\.env(?:\.[a-z0-9_-]+)?$",
    r"(?i)(?:backup|site-backup|db|database|dump)\.(?:zip|tar\.gz|tgz|sql|dump)$",
    r"(?i)(?:service-account|credentials|secrets)\.json$",
    r"(?i)id_rsa(?:\.pub)?$",
]


def analyze_cloud_storage(
    crawled_pages: List[CrawledPage],
    client: Optional[SafeHttpClient] = None,
    can_request_fn: Optional[Any] = None,
    max_checks: int = 5,
) -> Tuple[List[Dict[str, Any]], List[Finding], int]:
    """
    Passively discovers cloud storage bucket references in crawled HTML/scripts
    and safely audits naturally referenced storage assets for sensitive objects.
    """
    findings: List[Finding] = []
    requests_executed = 0

    discovered_endpoints: List[Dict[str, Any]] = []
    seen_endpoints: Set[str] = set()
    sensitive_objects: List[Dict[str, Any]] = []

    # 1. Collect all storage URLs naturally referenced in page resources and bodies
    for page in crawled_pages:
        # Check resources (images, scripts, fonts)
        for res in page.resources:
            u = res.resource_url
            for pat, prov in STORAGE_ENDPOINT_PATTERNS:
                m = re.search(pat, u)
                if m and u not in seen_endpoints:
                    seen_endpoints.add(u)
                    is_sens = any(re.search(spat, u) for spat in SENSITIVE_OBJECT_PATTERNS)
                    discovered_endpoints.append({
                        "url": u,
                        "provider": prov,
                        "bucket": m.group(1),
                        "is_sensitive": is_sens,
                        "page_url": page.url,
                    })

        # Check links & body sample
        sample = (page.body_sample or "") + " " + " ".join(page.discovered_links[:30])
        for pat, prov in STORAGE_ENDPOINT_PATTERNS:
            for match in re.finditer(pat, sample):
                full_url = match.group(0)
                if full_url not in seen_endpoints:
                    seen_endpoints.add(full_url)
                    is_sens = any(re.search(spat, full_url) for spat in SENSITIVE_OBJECT_PATTERNS)
                    discovered_endpoints.append({
                        "url": full_url,
                        "provider": prov,
                        "bucket": match.group(1),
                        "is_sensitive": is_sens,
                        "page_url": page.url,
                    })

    # 2. Check sensitive-looking storage URLs (bounded to max_checks)
    checks_performed = 0
    if client:
        for item in discovered_endpoints:
            if not item["is_sensitive"]:
                continue
            if checks_performed >= max_checks:
                break
            if can_request_fn and not can_request_fn():
                break

            checks_performed += 1
            requests_executed += 1

            try:
                resp = client.get(item["url"], max_redirects=2, max_response_bytes=262_144)
                if resp and resp.status_code == 200:
                    sensitive_objects.append({
                        "url": item["url"],
                        "provider": item["provider"],
                        "bucket": item["bucket"],
                        "content_length": len(resp.text) if resp.text else 0,
                    })

                    findings.append(make_infra_finding(
                        check_type="deep_public_storage_sensitive_object",
                        title=f"Sensitive Object Publicly Accessible in Cloud Storage ({item['provider']})",
                        description=(
                            f"A sensitive file ({item['url']}) is publicly readable in a cloud storage bucket ({item['bucket']}). "
                            "Publicly accessible backup archives, database dumps, or credentials files represent severe data leakage."
                        ),
                        severity=Severity.HIGH,
                        status=CheckStatus.HIGH,
                        evidence=f"GET {item['url']} returned HTTP 200 OK from {item['provider']}.",
                        how_to_fix="Configure cloud storage bucket policies to block public read access (e.g. enable S3 Block Public Access).",
                    ))
            except Exception:
                pass

    # 3. Informational finding for observed cloud storage buckets
    if discovered_endpoints and not sensitive_objects:
        providers = list(set([e["provider"] for e in discovered_endpoints]))
        findings.append(make_infra_finding(
            check_type="deep_public_storage_endpoint",
            title=f"Cloud Storage Asset Endpoints Observed: {', '.join(providers)}",
            description=f"Public assets are hosted on external cloud object storage ({', '.join(providers)}).",
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence=f"Observed {len(discovered_endpoints)} cloud storage asset references.",
            how_to_fix="Ensure all cloud storage buckets employ strict object ACLs and do not allow public listing of bucket contents.",
        ))

    return discovered_endpoints, findings, requests_executed
