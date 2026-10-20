"""
Scanly Scanner Engine - Phase F6 Origin Exposure Signal Analyzer
Passively analyzes potential origin server exposure behind CDNs or edge security gateways.
Strictly passive: Zero CDN bypass attempts, zero direct IP attacks, zero host-header injection.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from .models import CrawledPage


# Subdomain keywords typically indicating direct origin or bypass routes
ORIGIN_SUBDOMAIN_PATTERNS = [
    (r"(?i)^origin\.", "Direct Origin Hostname"),
    (r"(?i)^origin-", "Direct Origin Prefix"),
    (r"(?i)^direct\.", "Direct Gateway Hostname"),
    (r"(?i)^direct-connect\.", "Direct Connect Hostname"),
    (r"(?i)^backend\.", "Backend Origin Hostname"),
    (r"(?i)^cpanel\.", "Hosting Control Panel Hostname"),
    (r"(?i)^mail\.", "Mail Server Hostname (Potential Shared Origin)"),
    (r"(?i)^ssh\.", "Direct SSH Hostname"),
]

# Headers that sometimes leak origin server identifiers
ORIGIN_LEAK_HEADERS = [
    "x-origin-server",
    "x-origin-host",
    "x-backend-host",
    "x-backend-server",
    "x-upstream-server",
    "x-server-ip",
    "x-real-server",
]


def analyze_origin_exposure(
    crawled_pages: List[CrawledPage],
    cdn_data: Dict[str, Any],
    dns_metadata: Optional[Dict[str, Any]] = None,
    tls_metadata: Optional[Dict[str, Any]] = None,
    target_domain: str = "",
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively evaluates whether origin server signals or hostnames are observable
    behind a detected CDN or edge reverse proxy.
    """
    findings: List[Finding] = []
    dns_meta = dns_metadata or {}
    tls_meta = tls_metadata or {}

    cdn_detected = cdn_data.get("detected", False)
    cdn_provider = cdn_data.get("provider", "CDN")

    origin_signals: List[Dict[str, str]] = []
    origin_hostnames: Set[str] = set()
    origin_ips: Set[str] = set()
    evidence_items: List[str] = []

    # 1. Inspect response headers across crawled pages for origin leak headers
    for page in crawled_pages:
        for k, v in page.headers.items():
            k_lower = k.lower()
            if k_lower in ORIGIN_LEAK_HEADERS:
                evidence_items.append(f"Header '{k}: {v}' on {page.url}")
                origin_signals.append({
                    "type": "HEADER_DISCLOSURE",
                    "header": k,
                    "value": v,
                    "page_url": page.url,
                })
                # If value looks like an IP or hostname
                if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", v):
                    origin_ips.add(v)
                else:
                    origin_hostnames.add(v)

    # 2. Inspect certificate SANs from F2 TLS metadata for origin hostnames
    san_list = tls_meta.get("san_list") or tls_meta.get("san_names") or tls_meta.get("subject_alt_names") or []
    for san in san_list:
        for pat, desc in ORIGIN_SUBDOMAIN_PATTERNS:
            if re.search(pat, san):
                origin_hostnames.add(san)
                evidence_items.append(f"Certificate SAN '{san}' matches {desc}")
                origin_signals.append({
                    "type": "CERTIFICATE_SAN",
                    "hostname": san,
                    "description": desc,
                })

    # 3. Inspect discovered subdomains in links and DNS
    discovered_subdomains: Set[str] = set()
    for page in crawled_pages:
        for link in page.discovered_links[:50]:
            # Extract host
            match = re.search(r"https?://([^/:]+)", link)
            if match:
                discovered_subdomains.add(match.group(1).lower())

    for cname in (dns_meta.get("cname", []) or []):
        discovered_subdomains.add(cname.lower())

    for sub in discovered_subdomains:
        if target_domain and sub.endswith(target_domain):
            sub_part = sub[:-len(target_domain)].rstrip(".")
            for pat, desc in ORIGIN_SUBDOMAIN_PATTERNS:
                if re.search(pat, sub_part + "."):
                    origin_hostnames.add(sub)
                    evidence_items.append(f"Discovered hostname '{sub}' matches {desc}")
                    origin_signals.append({
                        "type": "SUBDOMAIN_CORRELATION",
                        "hostname": sub,
                        "description": desc,
                    })

    # 4. Construct Findings
    signal_detected = len(origin_signals) > 0
    confidence = "medium" if len(evidence_items) >= 2 else "low"

    if cdn_detected and signal_detected:
        evidence_str = "\n".join([f"- {e}" for e in evidence_items[:5]])
        findings.append(make_infra_finding(
            check_type="deep_origin_exposure_signal",
            title="Potential Origin Server Infrastructure Signal Detected",
            description=(
                f"A potential origin infrastructure signal was observed behind the detected {cdn_provider}. "
                "Direct origin exposure can reduce the effectiveness of edge security controls (WAF, DDoS mitigation) "
                "if the origin web server accepts direct connections from arbitrary public IP addresses."
            ),
            severity=Severity.HIGH if origin_ips else Severity.LOW,
            status=CheckStatus.WARNING,
            evidence=f"Observed origin signals:\n{evidence_str}",
            how_to_fix=(
                "Ensure edge security gateway bypass is prevented by configuring origin web servers and firewalls "
                f"to only accept incoming HTTP/HTTPS traffic from authorized {cdn_provider} IP ranges."
            ),
        ))

    if origin_hostnames:
        hostnames_str = ", ".join(sorted(list(origin_hostnames))[:5])
        findings.append(make_infra_finding(
            check_type="deep_origin_hostname_exposure",
            title=f"Origin Hostname Reference Discovered: {hostnames_str}",
            description="Specific origin-indicating hostnames were identified in response headers, certificate SANs, or discovered links.",
            severity=Severity.INFO,
            status=CheckStatus.PASS if not cdn_detected else CheckStatus.WARNING,
            evidence=f"Identified hostnames: {hostnames_str}",
            how_to_fix="Remove public DNS records or certificate SAN references to direct origin hostnames that bypass edge security tiers.",
        ))

    origin_data = {
        "signal_detected": signal_detected,
        "origin_hostnames": sorted(list(origin_hostnames)),
        "origin_ips": sorted(list(origin_ips)),
        "confidence": confidence,
        "signals_count": len(origin_signals),
        "signals": origin_signals,
        "evidence": evidence_items[:8],
    }

    return origin_data, findings
