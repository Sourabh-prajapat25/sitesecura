"""
Scanly Scanner Engine - Phase F6 DNS Infrastructure Correlation & Takeover Analyzer
Analyzes DNS infrastructure relationships, IPv4/IPv6 dual-stack consistency,
and passive subdomain takeover signals from existing DNS records.
Strictly passive: Zero takeover attempts, zero domain claiming, zero DNS poisoning.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding


# Known SaaS / hosting CNAME targets prone to dangling takeover when abandoned
DANGLING_CNAME_PROVIDERS = [
    {
        "provider": "GitHub Pages",
        "pattern": r"(?i)\.github\.io$",
        "cname_keyword": "github.io",
    },
    {
        "provider": "Heroku",
        "pattern": r"(?i)\.(herokudns|herokuapp)\.com$",
        "cname_keyword": "herokudns.com",
    },
    {
        "provider": "Amazon S3 Website",
        "pattern": r"(?i)\.s3(-website-[a-z0-9-]+)?\.amazonaws\.com$",
        "cname_keyword": "s3.amazonaws.com",
    },
    {
        "provider": "Microsoft Azure App Service",
        "pattern": r"(?i)\.(azurewebsites\.net|cloudapp\.net)$",
        "cname_keyword": "azurewebsites.net",
    },
    {
        "provider": "Surge.sh",
        "pattern": r"(?i)\.surge\.sh$",
        "cname_keyword": "surge.sh",
    },
    {
        "provider": "Zendesk",
        "pattern": r"(?i)\.zendesk\.com$",
        "cname_keyword": "zendesk.com",
    },
    {
        "provider": "ReadMe",
        "pattern": r"(?i)\.readme\.io$",
        "cname_keyword": "readme.io",
    },
    {
        "provider": "Shopify",
        "pattern": r"(?i)\.myshopify\.com$",
        "cname_keyword": "myshopify.com",
    },
    {
        "provider": "Ghost",
        "pattern": r"(?i)\.ghost\.io$",
        "cname_keyword": "ghost.io",
    },
    {
        "provider": "WordPress Engine",
        "pattern": r"(?i)\.wpengine\.com$",
        "cname_keyword": "wpengine.com",
    },
]


def analyze_dns_infrastructure(
    dns_metadata: Optional[Dict[str, Any]],
    target_domain: str = "",
    cdn_data: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Correlates DNS records from Phase F2: IPv4/IPv6 dual-stack consistency,
    subdomain infrastructure mappings, and passive dangling CNAME takeover signals.
    """
    findings: List[Finding] = []
    dns_meta = dns_metadata or {}
    cdn = cdn_data or {}

    ipv4_list = dns_meta.get("a", []) or []
    ipv6_list = dns_meta.get("aaaa", []) or []
    cname_list = dns_meta.get("cname", []) or []
    ns_list = dns_meta.get("ns", []) or []
    mx_list = dns_meta.get("mx", []) or []

    ipv6_enabled = len(ipv6_list) > 0
    inconsistencies: List[str] = []
    subdomain_relationships: List[Dict[str, Any]] = []
    takeover_signals: List[Dict[str, Any]] = []

    # 1. IPv4 vs IPv6 Infrastructure Analysis
    if not ipv6_enabled and len(ipv4_list) > 0:
        inconsistencies.append("IPv6 (AAAA) record missing: domain operates on IPv4-only transport.")

    # Check for potential IPv6 origin bypass when IPv4 is behind CDN
    is_cdn = cdn.get("detected", False)
    if is_cdn and ipv6_enabled:
        # Check if IPv6 points to known non-CDN or private/custom prefix while IPv4 is on CDN
        cdn_provider = cdn.get("provider", "").lower()
        if "cloudflare" in cdn_provider:
            # Cloudflare IPv6 addresses typically start with 2606:4700:
            cf_ipv6 = any(ip.lower().startswith("2606:4700:") for ip in ipv6_list)
            if not cf_ipv6:
                inconsistencies.append(
                    "IPv4 resolves through Cloudflare CDN, but IPv6 (AAAA) addresses appear non-Cloudflare, "
                    "which may permit direct origin bypass over IPv6."
                )
                findings.append(make_infra_finding(
                    check_type="deep_ipv6_configuration_inconsistency",
                    title="Potential IPv6 Origin Security Bypass Inconsistency",
                    description=(
                        "IPv4 traffic is routed through a CDN/WAF proxy, but IPv6 (AAAA) records do not appear to match "
                        "the edge provider's network. Clients connecting over IPv6 may reach the origin server directly, "
                        "bypassing edge WAF rules."
                    ),
                    severity=Severity.MEDIUM,
                    status=CheckStatus.WARNING,
                    evidence=f"IPv4: {', '.join(ipv4_list[:2])} | IPv6: {', '.join(ipv6_list[:2])}",
                    how_to_fix="Ensure IPv6 (AAAA) records are routed through your CDN/WAF proxy alongside IPv4.",
                ))

    # 2. Subdomain Relationships & Passive Dangling CNAME Check
    for cname in cname_list:
        cname_clean = cname.rstrip(".")
        subdomain_entry = {
            "cname_target": cname,
            "provider": "Custom",
        }

        # Check against known SaaS providers for takeover signal
        for prov in DANGLING_CNAME_PROVIDERS:
            if re.search(prov["pattern"], cname_clean):
                subdomain_entry["provider"] = prov["provider"]
                takeover_signals.append({
                    "provider": prov["provider"],
                    "cname_target": cname,
                    "target_domain": target_domain,
                    "reason": f"CNAME points to third-party hosted SaaS provider ({prov['provider']})",
                })
                break

        subdomain_relationships.append(subdomain_entry)

    # If dangling CNAME patterns exist
    if takeover_signals:
        signal_providers = list(set([s["provider"] for s in takeover_signals]))
        evidence_str = "\n".join([f"- CNAME -> {s['cname_target']} ({s['provider']})" for s in takeover_signals[:4]])
        findings.append(make_infra_finding(
            check_type="deep_subdomain_takeover_signal",
            title=f"Potential Dangling Infrastructure Signal: {', '.join(signal_providers)}",
            description=(
                "The domain or subdomain exhibits a CNAME configuration pattern pointing to a third-party hosted service. "
                "If the corresponding service, bucket, or application slot has been deleted or unclaimed in the hosting provider, "
                "it may represent a dangling DNS configuration. Further administrative verification is required."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.WARNING,
            evidence=f"Observed CNAME targets:\n{evidence_str}",
            how_to_fix="Potential dangling infrastructure signal detected. Further administrative verification is required in your hosting provider console to confirm whether the target service resource is actively claimed. If decommissioned, remove the orphaned CNAME record.",
            remediation="Potential dangling infrastructure signal detected. Further administrative verification is required to confirm whether the target resource is unallocated on the service provider.",
        ))

    dns_rel_data = {
        "ipv4_addresses": ipv4_list,
        "ipv6_addresses": ipv6_list,
        "ipv6_enabled": ipv6_enabled,
        "inconsistencies": inconsistencies,
        "cname_targets": cname_list,
        "subdomain_relationships": subdomain_relationships,
        "takeover_signals_count": len(takeover_signals),
        "takeover_signals": takeover_signals,
    }

    return dns_rel_data, findings
