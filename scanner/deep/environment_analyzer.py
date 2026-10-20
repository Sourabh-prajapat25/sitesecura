"""
Scanly Scanner Engine - Phase F6 Environment & Internal Network Exposure Analyzer
Detects public exposures of staging, development, preview, and test environments,
as well as internal private IP addresses, cluster domains, and localhost references.
Strictly passive: Zero connection attempts to internal or private addresses.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from .models import CrawledPage


# Environment classification patterns
ENV_PATTERNS = [
    {
        "type": "staging",
        "regex": r"(?i)\b(staging|stage|qa|uat|testenv)\b",
        "hostname_regex": r"(?i)^([a-z0-9-]+\.)*(staging|stage|qa|uat)\.",
        "title": "Public Staging / QA Environment Discovered",
        "check_type": "deep_staging_env_exposure",
        "description": "A publicly accessible hostname or route appears to represent a staging or QA environment.",
        "severity": Severity.MEDIUM,
    },
    {
        "type": "development",
        "regex": r"(?i)\b(dev|development|sandbox|preview)\b",
        "hostname_regex": r"(?i)^([a-z0-9-]+\.)*(dev|sandbox|preview)\.",
        "title": "Public Development / Sandbox Environment Discovered",
        "check_type": "deep_dev_env_exposure",
        "description": "A publicly accessible hostname or route represents a development or preview environment.",
        "severity": Severity.MEDIUM,
    },
]

# Internal network patterns
INTERNAL_PATTERNS = [
    (r"\b10\.(?:[0-9]{1,3}\.){2}[0-9]{1,3}\b", "Private Class A Network (10.0.0.0/8)"),
    (r"\b172\.(?:1[6-9]|2[0-9]|3[0-1])\.(?:[0-9]{1,3}\.)[0-9]{1,3}\b", "Private Class B Network (172.16.0.0/12)"),
    (r"\b192\.168\.(?:[0-9]{1,3}\.)[0-9]{1,3}\b", "Private Class C Network (192.168.0.0/16)"),
    (r"\b169\.254\.(?:[0-9]{1,3}\.)[0-9]{1,3}\b", "Link-Local / Metadata Network (169.254.0.0/16)"),
    (r"(?i)\b[a-z0-9_-]+\.(?:cluster\.local|internal|corp|lan|localdomain)\b", "Internal Cluster / Corporate Domain"),
]

LOCALHOST_PATTERNS = [
    r"\b127\.0\.0\.1(?::\d+)?\b",
    r"(?i)\blocalhost(?::\d+)?\b",
]


def analyze_environments(
    crawled_pages: List[CrawledPage],
    target_domain: str = "",
    dns_metadata: Optional[Dict[str, Any]] = None,
    f3_metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Finding]]:
    """
    Passively scans discovered hostnames, links, and page source for
    non-production environment signals, internal network references, and localhost references.
    """
    findings: List[Finding] = []
    dns_meta = dns_metadata or {}
    f3_meta = f3_metadata or {}

    detected_environments: List[Dict[str, Any]] = []
    internal_references: List[Dict[str, Any]] = []
    seen_envs: Set[str] = set()
    seen_internals: Set[str] = set()

    # Collect hostnames and URLs to evaluate
    candidate_hostnames: Set[str] = set()
    candidate_urls: Set[str] = set()

    if target_domain:
        candidate_hostnames.add(target_domain.lower())

    for page in crawled_pages:
        candidate_urls.add(page.url)
        if page.final_url:
            candidate_urls.add(page.final_url)
        for link in page.discovered_links[:50]:
            candidate_urls.add(link)
            m = re.search(r"https?://([^/:]+)", link)
            if m:
                candidate_hostnames.add(m.group(1).lower())

    for cname in (dns_meta.get("cname", []) or []):
        candidate_hostnames.add(cname.lower())

    # 1. Environment Evaluation (Staging, Dev, Sandbox)
    for env_cfg in ENV_PATTERNS:
        matches_found: List[str] = []
        for host in candidate_hostnames:
            if re.search(env_cfg["hostname_regex"], host):
                matches_found.append(f"Hostname: {host}")

        # Also check URLs with explicit path patterns
        for u in list(candidate_urls)[:50]:
            if re.search(r"(?i)/(" + env_cfg["type"] + r")(/|$)", u):
                matches_found.append(f"Route: {u}")

        if matches_found:
            env_key = f"{env_cfg['type']}"
            if env_key not in seen_envs:
                seen_envs.add(env_key)
                detected_environments.append({
                    "type": env_cfg["type"],
                    "confidence": "high",
                    "evidence": matches_found[:3],
                })

                findings.append(make_infra_finding(
                    check_type=env_cfg["check_type"],
                    title=env_cfg["title"],
                    description=(
                        f"{env_cfg['description']} Non-production environments often contain unhardened debug configurations, "
                        "test user credentials, incomplete authentication boundaries, or draft features."
                    ),
                    severity=env_cfg["severity"],
                    status=CheckStatus.WARNING,
                    evidence="Discovered matches:\n" + "\n".join([f"- {m}" for m in matches_found[:4]]),
                    how_to_fix="Restrict non-production environments using IP allowlisting, VPN access controls, or HTTP Basic/SSO authentication.",
                ))

    # 2. Internal Network References & Localhost Detection
    text_corpus: List[Tuple[str, str]] = []
    for page in crawled_pages:
        for script in page.inline_scripts[:10]:
            text_corpus.append((f"Script on {page.url}", script[:2048]))
        if page.body_sample:
            text_corpus.append((f"HTML on {page.url}", page.body_sample[:4096]))

    localhost_matches: List[str] = []

    for label, text in text_corpus:
        # Check Localhost
        for lh_pat in LOCALHOST_PATTERNS:
            for lh_match in re.findall(lh_pat, text):
                if lh_match not in localhost_matches:
                    localhost_matches.append(lh_match)

        # Check Private IPs and Internal Domains
        for pat, desc in INTERNAL_PATTERNS:
            for int_match in re.findall(pat, text):
                if int_match not in seen_internals:
                    # Ignore harmless documentation zeros like 0.0.0.0
                    seen_internals.add(int_match)
                    internal_references.append({
                        "value": int_match,
                        "type": desc,
                        "source": label,
                    })

    # Deduplicate with F3 internal IP check if F3 already emitted it
    f3_has_internal = f3_meta.get("internal_ips_count", 0) > 0

    if internal_references and not f3_has_internal:
        sample_refs = "\n".join([f"- {r['value']} ({r['type']}) in {r['source']}" for r in internal_references[:5]])
        findings.append(make_infra_finding(
            check_type="deep_internal_hostname_exposure",
            title="Private IP or Internal Network Reference Disclosed",
            description="Client-accessible HTML, scripts, or configurations expose RFC 1918 private IP addresses or internal cluster domain names.",
            severity=Severity.LOW,
            status=CheckStatus.WARNING,
            evidence=f"Internal network references identified:\n{sample_refs}",
            how_to_fix="Review client-side bundles and replace internal network references with environment-specific external proxy paths or relative endpoints.",
        ))

    if localhost_matches:
        sample_lh = ", ".join(localhost_matches[:4])
        findings.append(make_infra_finding(
            check_type="deep_localhost_reference",
            title="Localhost Development References Exposed in Public Code",
            description="References to 'localhost' or '127.0.0.1' were discovered in publicly served HTML or JavaScript assets.",
            severity=Severity.LOW,
            status=CheckStatus.WARNING,
            evidence=f"Discovered localhost references: {sample_lh}",
            how_to_fix="Configure build pipelines and environment variables to ensure development URLs (http://localhost:3000) are replaced with production domains.",
        ))

    environment_summary = {
        "detected_count": len(detected_environments),
        "environments": detected_environments,
        "internal_references_count": len(internal_references),
        "localhost_references_count": len(localhost_matches),
    }

    return detected_environments, environment_summary, findings
