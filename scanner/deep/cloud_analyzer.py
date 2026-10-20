"""
Scanly Scanner Engine - Phase F6 Cloud Infrastructure & Metadata Reference Analyzer
Identifies cloud provider assets, serverless platforms, and passive cloud metadata references.
Strictly passive: Zero cloud credential testing, zero metadata service querying, zero SSRF attempts.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from .models import CrawledPage


# Known cloud domains and services
CLOUD_PATTERNS = [
    {
        "provider": "Amazon Web Services (AWS)",
        "service_regex": r"(?i)(amazonaws\.com|cloudfront\.net|elb\.amazonaws\.com|execute-api|s3\.amazonaws\.com|lambda-url)",
        "services": {
            r"(?i)s3\.amazonaws\.com": "Amazon S3",
            r"(?i)cloudfront\.net": "Amazon CloudFront",
            r"(?i)elb\.amazonaws\.com": "AWS Elastic Load Balancing",
            r"(?i)execute-api": "Amazon API Gateway",
            r"(?i)lambda-url": "AWS Lambda Function URL",
        },
    },
    {
        "provider": "Google Cloud Platform (GCP)",
        "service_regex": r"(?i)(storage\.googleapis\.com|googleusercontent\.com|run\.app|appspot\.com|cloudfunctions\.net|firebaseapp\.com)",
        "services": {
            r"(?i)storage\.googleapis\.com": "Google Cloud Storage",
            r"(?i)run\.app": "Google Cloud Run",
            r"(?i)appspot\.com": "Google App Engine",
            r"(?i)cloudfunctions\.net": "Google Cloud Functions",
            r"(?i)firebaseapp\.com": "Firebase Hosting / Services",
        },
    },
    {
        "provider": "Microsoft Azure",
        "service_regex": r"(?i)(azurewebsites\.net|azurefd\.net|blob\.core\.windows\.net|cloudapp\.azure\.com|azureedge\.net)",
        "services": {
            r"(?i)blob\.core\.windows\.net": "Azure Blob Storage",
            r"(?i)azurewebsites\.net": "Azure App Services / Functions",
            r"(?i)azurefd\.net": "Azure Front Door",
            r"(?i)azureedge\.net": "Azure CDN",
        },
    },
]

# Cloud instance metadata service patterns
# NEVER requested over network - only checked as passive references in code/config/sourcemaps
METADATA_PATTERNS = [
    (r"169\.254\.169\.254", "AWS/OpenStack Instance Metadata Service IP (169.254.169.254)"),
    (r"metadata\.google\.internal", "GCP Internal Metadata DNS (metadata.google.internal)"),
    (r"169\.254\.170\.2", "AWS ECS Task Metadata IP (169.254.170.2)"),
    (r"metadata\.azure\.com", "Azure Instance Metadata Service (metadata.azure.com)"),
    (r"/latest/meta-data/", "AWS EC2 Meta-data Endpoint Path (/latest/meta-data/)"),
]


def analyze_cloud_infrastructure(
    crawled_pages: List[CrawledPage],
    dns_metadata: Optional[Dict[str, Any]] = None,
    frontend_metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits crawled pages, DNS metadata, and frontend assets for
    cloud provider adoption, serverless platforms, and sensitive cloud metadata references.
    """
    findings: List[Finding] = []
    dns_meta = dns_metadata or {}
    fe_meta = frontend_metadata or {}

    detected_providers: Set[str] = set()
    detected_services: Set[str] = set()
    cloud_evidence: List[str] = []

    # Gather search text: page bodies, URLs, resources, DNS records, inline scripts, source maps
    text_corpus: List[Tuple[str, str]] = []  # (source_label, text)

    # 1. DNS records
    for cname in (dns_meta.get("cname", []) or []):
        text_corpus.append(("DNS CNAME", cname))
    for mx in (dns_meta.get("mx", []) or []):
        host = mx.get("host", "") if isinstance(mx, dict) else str(mx)
        text_corpus.append(("DNS MX", host))

    # 2. Pages, links, and resources
    for page in crawled_pages:
        text_corpus.append((f"Page URL ({page.url})", page.url))
        if page.final_url and page.final_url != page.url:
            text_corpus.append((f"Final URL ({page.final_url})", page.final_url))
        for res in page.resources:
            text_corpus.append((f"Resource ({page.url})", res.resource_url))
        for link in page.discovered_links[:50]:
            text_corpus.append((f"Link ({page.url})", link))
        if page.body_sample:
            text_corpus.append((f"Page Content ({page.url})", page.body_sample[:4096]))
        for s in page.inline_scripts[:10]:
            text_corpus.append((f"Inline Script ({page.url})", s[:2048]))

    # 3. Source maps if present in frontend metadata
    for sm in (fe_meta.get("source_maps_analyzed", []) or []):
        url = sm.get("map_url", "")
        text_corpus.append(("Source Map", url))

    # Match cloud providers
    for cloud in CLOUD_PATTERNS:
        p_name = cloud["provider"]
        for label, text in text_corpus:
            if re.search(cloud["service_regex"], text):
                detected_providers.add(p_name)
                # Identify specific services
                for s_regex, s_name in cloud["services"].items():
                    if re.search(s_regex, text):
                        detected_services.add(s_name)
                        cloud_evidence.append(f"{s_name} referenced in {label}: {text[:120]}")

    # Serverless detection
    serverless_services = [s for s in detected_services if any(k in s.lower() for k in ("lambda", "functions", "run", "app engine"))]
    is_serverless = len(serverless_services) > 0

    # 4. Check for Cloud Metadata Service references
    metadata_references: List[Dict[str, str]] = []
    seen_meta_signals: Set[str] = set()

    for label, text in text_corpus:
        for pat, desc in METADATA_PATTERNS:
            if re.search(pat, text):
                signal_key = f"{desc}:{label}"
                if signal_key not in seen_meta_signals:
                    seen_meta_signals.add(signal_key)
                    metadata_references.append({
                        "service": desc,
                        "source": label,
                        "context": text[:150],
                    })
                break

    # Compile findings
    if detected_providers:
        prov_list = sorted(list(detected_providers))
        serv_list = sorted(list(detected_services))
        findings.append(make_infra_finding(
            check_type="deep_cloud_provider_exposure",
            title=f"Cloud Infrastructure Provider Identified: {', '.join(prov_list)}",
            description=f"Public assets, hostnames, or endpoints associate this target with {', '.join(prov_list)}.",
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence=f"Services detected: {', '.join(serv_list) if serv_list else 'Generic cloud endpoints'}",
            how_to_fix="Ensure least-privilege IAM policies and cloud security posture management (CSPM) audits are active.",
        ))

    if is_serverless:
        findings.append(make_infra_finding(
            check_type="deep_serverless_exposure",
            title=f"Serverless Architecture Observed: {', '.join(serverless_services)}",
            description="The application utilizes on-demand serverless functions or container runtime environments.",
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence=f"Serverless indicators: {', '.join(serverless_services)}",
            how_to_fix="Ensure serverless functions operate with bounded timeouts, minimal execution roles, and secure environment variable handling.",
        ))

    if metadata_references:
        # Cloud metadata IP referenced in public client code or HTML
        evidence_str = "\n".join([f"- {m['service']} in {m['source']}" for m in metadata_references[:5]])
        findings.append(make_infra_finding(
            check_type="deep_cloud_metadata_reference",
            title="Cloud Instance Metadata Service Reference in Public Code",
            description="A reference to a cloud instance metadata endpoint (e.g. 169.254.169.254 or metadata.google.internal) was discovered in publicly accessible client-side code, scripts, or configuration.",
            severity=Severity.HIGH,
            status=CheckStatus.WARNING,
            evidence=f"Discovered references:\n{evidence_str}",
            how_to_fix="Review client-side scripts and remove internal cloud metadata endpoints. Ensure backend services require IMDSv2 (session tokens) with hop limits of 1 to protect against Server-Side Request Forgery (SSRF).",
        ))

    cloud_data = {
        "providers": sorted(list(detected_providers)),
        "services": sorted(list(detected_services)),
        "is_serverless": is_serverless,
        "serverless_services": serverless_services,
        "metadata_references_count": len(metadata_references),
        "metadata_references": metadata_references,
        "evidence": cloud_evidence[:10],
    }

    return cloud_data, findings
