"""
Scanly Scanner Engine - Phase F6 Infrastructure & CDN Analyzer
Passively fingerprints hosting infrastructure, reverse proxies, CDNs, and edge networks
from HTTP response headers, DNS correlations, and observable network metadata.
Strictly passive: Zero port scanning, zero active probing.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from .models import CrawledPage


# Provider detection signatures mapping header names, header value patterns, and DNS keywords
INFRA_SIGNATURES = [
    {
        "provider": "Cloudflare",
        "category": "CDN / Edge Network",
        "header_patterns": {
            "cf-ray": r".+",
            "cf-cache-status": r".+",
            "server": r"(?i)cloudflare",
        },
        "dns_patterns": [r"(?i)\.cloudflare\.net", r"(?i)\.cloudflare\.com"],
        "confidence": "high",
    },
    {
        "provider": "Amazon CloudFront",
        "category": "CDN / Edge Network",
        "header_patterns": {
            "x-amz-cf-id": r".+",
            "x-amz-cf-pop": r".+",
            "via": r"(?i)cloudfront\.net",
        },
        "dns_patterns": [r"(?i)\.cloudfront\.net"],
        "confidence": "high",
    },
    {
        "provider": "AWS Application Load Balancer",
        "category": "Load Balancer",
        "header_patterns": {
            "awselb": r".+",
            "server": r"(?i)awselb",
        },
        "dns_patterns": [r"(?i)\.elb\.amazonaws\.com"],
        "confidence": "high",
    },
    {
        "provider": "Google Cloud Load Balancing",
        "category": "Load Balancer",
        "header_patterns": {
            "via": r"(?i)google",
            "server": r"(?i)^(gws|gse|Google Frontend)$",
            "x-cloud-trace-context": r".+",
        },
        "dns_patterns": [r"(?i)\.googleusercontent\.com"],
        "confidence": "high",
    },
    {
        "provider": "Azure Front Door",
        "category": "CDN / Edge Network",
        "header_patterns": {
            "x-azure-ref": r".+",
            "x-azure-fdid": r".+",
            "x-fd-": r".+",
        },
        "dns_patterns": [r"(?i)\.azurefd\.net", r"(?i)\.azureedge\.net"],
        "confidence": "high",
    },
    {
        "provider": "Fastly",
        "category": "CDN / Edge Network",
        "header_patterns": {
            "x-fastly-request-id": r".+",
            "fastly-restarts": r".+",
            "x-served-by": r"(?i)cache-",
        },
        "dns_patterns": [r"(?i)\.fastly\.net"],
        "confidence": "high",
    },
    {
        "provider": "Akamai",
        "category": "CDN / Edge Network",
        "header_patterns": {
            "x-akamai-transformed": r".+",
            "x-akamai-request-id": r".+",
            "server": r"(?i)AkamaiGHost",
        },
        "dns_patterns": [r"(?i)\.akamaiedge\.net", r"(?i)\.edgekey\.net", r"(?i)\.akamai\.net"],
        "confidence": "high",
    },
    {
        "provider": "Vercel",
        "category": "Serverless Deployment Platform",
        "header_patterns": {
            "x-vercel-id": r".+",
            "x-vercel-cache": r".+",
            "server": r"(?i)^vercel$",
        },
        "dns_patterns": [r"(?i)\.vercel-dns\.com", r"(?i)\.vercel\.app"],
        "confidence": "high",
    },
    {
        "provider": "Netlify",
        "category": "Serverless Deployment Platform",
        "header_patterns": {
            "x-nf-request-id": r".+",
            "server": r"(?i)^netlify$",
        },
        "dns_patterns": [r"(?i)\.netlify\.app"],
        "confidence": "high",
    },
    {
        "provider": "Render",
        "category": "Cloud Hosting Platform",
        "header_patterns": {
            "x-render-origin-server": r".+",
            "server": r"(?i)^render$",
        },
        "dns_patterns": [r"(?i)\.onrender\.com"],
        "confidence": "high",
    },
    {
        "provider": "Railway",
        "category": "Cloud Hosting Platform",
        "header_patterns": {
            "x-railway-": r".+",
            "server": r"(?i)railway",
        },
        "dns_patterns": [r"(?i)\.up\.railway\.app"],
        "confidence": "high",
    },
    {
        "provider": "Fly.io",
        "category": "Edge Computing Platform",
        "header_patterns": {
            "fly-request-id": r".+",
            "server": r"(?i)^fly$",
        },
        "dns_patterns": [r"(?i)\.fly\.dev"],
        "confidence": "high",
    },
    {
        "provider": "Heroku",
        "category": "Cloud Hosting Platform",
        "header_patterns": {
            "via": r"(?i)vegur",
        },
        "dns_patterns": [r"(?i)\.herokudns\.com", r"(?i)\.herokuapp\.com"],
        "confidence": "high",
    },
    {
        "provider": "Firebase Hosting",
        "category": "Cloud Hosting Platform",
        "header_patterns": {
            "x-firebase-": r".+",
        },
        "dns_patterns": [r"(?i)\.firebaseapp\.com", r"(?i)\.web\.app"],
        "confidence": "high",
    },
    {
        "provider": "GitHub Pages",
        "category": "Static Hosting Platform",
        "header_patterns": {
            "x-github-request-id": r".+",
            "server": r"(?i)^github\.com$",
        },
        "dns_patterns": [r"(?i)\.github\.io"],
        "confidence": "high",
    },
]

CDN_PROVIDERS = {
    "Cloudflare",
    "Amazon CloudFront",
    "Fastly",
    "Akamai",
    "Azure Front Door",
    "Google Cloud Load Balancing",
}


@dataclass
class InfrastructureEvidence:
    provider: Optional[str]
    category: str
    confidence: str
    evidence: List[str] = field(default_factory=list)
    source: str = "headers"


@dataclass
class CdnEvidence:
    detected: bool
    provider: Optional[str]
    confidence: str
    cache_behavior: Optional[str] = None
    edge_headers: List[str] = field(default_factory=list)
    evidence: List[str] = field(default_factory=list)


def analyze_infrastructure(
    crawled_pages: List[CrawledPage],
    dns_metadata: Optional[Dict[str, Any]] = None,
    target_domain: str = "",
) -> Tuple[Dict[str, Any], Dict[str, Any], List[Finding]]:
    """
    Passively inspects crawled pages and DNS metadata to fingerprint
    hosting infrastructure, reverse proxies, CDNs, and version disclosures.
    """
    findings: List[Finding] = []
    dns_meta = dns_metadata or {}
    cnames = dns_meta.get("cname", []) or []

    # Aggregate all observed HTTP headers across responses
    all_headers: Dict[str, Set[str]] = {}
    sample_page_url = f"https://{target_domain}" if target_domain else ""

    for page in crawled_pages:
        if not sample_page_url and page.url:
            sample_page_url = page.url
        for k, v in page.headers.items():
            k_lower = k.lower()
            if k_lower not in all_headers:
                all_headers[k_lower] = set()
            all_headers[k_lower].add(v)

    # 1. Provider Fingerprinting
    detected_providers: List[Dict[str, Any]] = []
    seen_provider_names: Set[str] = set()

    for sig in INFRA_SIGNATURES:
        p_name = sig["provider"]
        evidence_items: List[str] = []

        # Check HTTP headers
        for h_key, pattern in sig["header_patterns"].items():
            for obs_k, obs_vals in all_headers.items():
                if obs_k == h_key or obs_k.startswith(h_key):
                    for val in obs_vals:
                        if re.search(pattern, val):
                            evidence_items.append(f"Header '{obs_k}: {val}' matches {p_name} signature")

        # Check DNS CNAMEs
        for cname in cnames:
            for d_pat in sig["dns_patterns"]:
                if re.search(d_pat, cname):
                    evidence_items.append(f"DNS CNAME target '{cname}' matches {p_name} domain pattern")

        if evidence_items and p_name not in seen_provider_names:
            seen_provider_names.add(p_name)
            detected_providers.append({
                "provider": p_name,
                "category": sig["category"],
                "confidence": sig["confidence"] if len(evidence_items) >= 2 else "medium",
                "evidence": evidence_items,
            })

    # Primary infrastructure provider
    primary_provider = detected_providers[0] if detected_providers else None

    # 2. CDN & Edge Detection
    cdn_detected = False
    cdn_provider = None
    cdn_confidence = "low"
    cdn_evidence: List[str] = []
    cache_behavior = None
    edge_headers_observed: List[str] = []

    # Check for specific CDN providers in detected list
    for p in detected_providers:
        if p["provider"] in CDN_PROVIDERS:
            cdn_detected = True
            cdn_provider = p["provider"]
            cdn_confidence = p["confidence"]
            cdn_evidence.extend(p["evidence"])
            break

    # Look for generic CDN cache headers
    for h in ["cf-cache-status", "x-cache", "x-cache-hits", "x-served-by", "age", "via"]:
        if h in all_headers:
            cdn_detected = True
            vals = list(all_headers[h])
            edge_headers_observed.append(f"{h}: {', '.join(vals)}")
            if h in ("cf-cache-status", "x-cache") and not cache_behavior:
                cache_behavior = vals[0]

    if cdn_detected and not cdn_provider:
        cdn_provider = "Generic Reverse Proxy / CDN"
        cdn_confidence = "medium"
        cdn_evidence.append("Observed caching/edge headers: " + ", ".join(edge_headers_observed[:3]))

    cdn_data = {
        "detected": cdn_detected,
        "provider": cdn_provider,
        "confidence": cdn_confidence,
        "cache_behavior": cache_behavior,
        "edge_headers": edge_headers_observed,
        "evidence": cdn_evidence,
    }

    infra_data = {
        "primary_provider": primary_provider["provider"] if primary_provider else None,
        "category": primary_provider["category"] if primary_provider else "Standard Web Server",
        "confidence": primary_provider["confidence"] if primary_provider else "low",
        "all_detected_providers": detected_providers,
        "evidence": primary_provider["evidence"] if primary_provider else [],
    }

    # 3. Create Informational / Posture Findings
    if primary_provider:
        findings.append(make_infra_finding(
            check_type="deep_infra_provider_exposure",
            title=f"Infrastructure Provider Observed: {primary_provider['provider']}",
            description=f"Passive analysis identified hosting infrastructure provided by {primary_provider['provider']} ({primary_provider['category']}).",
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence="; ".join(primary_provider["evidence"][:3]),
            how_to_fix="Ensure cloud and hosting provider security baselines (MFA on console, least privilege, isolated IAM) are enforced.",
        ))

    if cdn_detected and cdn_provider:
        findings.append(make_infra_finding(
            check_type="deep_cdn_exposure",
            title=f"Content Delivery Network Detected: {cdn_provider}",
            description=f"The target origin is protected or accelerated by {cdn_provider}.",
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence="; ".join(cdn_evidence[:3]) if cdn_evidence else "Edge caching headers detected.",
            how_to_fix="Maintain strict origin access control lists (ACLs) so that the origin web server only accepts traffic originating from legitimate CDN edge IP ranges.",
        ))

    # 4. Check for Verbose Infrastructure Version Disclosure
    server_headers = all_headers.get("server", set())
    for s_hdr in server_headers:
        # Detect verbose version disclosures like Apache/2.4.41 (Ubuntu) or nginx/1.18.0
        if re.search(r"(?i)(apache|nginx|iis|caddy|litespeed)/\d+\.\d+.*?(ubuntu|debian|centos|redhat|alpine|win64)", s_hdr):
            findings.append(make_infra_finding(
                check_type="deep_infra_version_disclosure",
                title=f"Detailed Infrastructure Version and OS Disclosed: {s_hdr}",
                description="The HTTP Server response header exposes detailed software versions and operating system distributions.",
                severity=Severity.LOW,
                status=CheckStatus.WARNING,
                evidence=f"Server: {s_hdr}",
                how_to_fix="Configure web server to suppress banner versions (e.g. 'ServerTokens Prod' in Apache or 'server_tokens off;' in nginx).",
            ))
            break

    return infra_data, cdn_data, findings
