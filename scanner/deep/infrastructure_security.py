"""
Scanly Scanner Engine - Phase F6 Infrastructure & Operational Security Orchestrator
Master coordinator for Phase F6: Advanced Infrastructure, Cloud, Deployment & Operational Security Intelligence.
Coordinates infrastructure fingerprinting, cloud services, CDN detection, origin exposure signals,
deployment platforms, exposed artifacts, environment disclosure, operational endpoints,
DNS relationships, cloud storage, containerization, and takeover indicators.

Enforces strict request budgets, timeout limits, response caps, and resilient failure isolation.
Strictly passive: Zero port scanning, zero active brute-forcing, zero destructive probing.
"""
from typing import Dict, List, Optional, Any, Tuple, Set
from urllib.parse import urlparse
import logging

from scanner.models import Finding
from scanner.network.http_client import SafeHttpClient

from .config import DeepScanConfig
from .models import CrawledPage
from .infrastructure_analyzer import analyze_infrastructure
from .cloud_analyzer import analyze_cloud_infrastructure
from .origin_analyzer import analyze_origin_exposure
from .deployment_analyzer import analyze_deployment
from .environment_analyzer import analyze_environments
from .operational_analyzer import analyze_operational_surfaces
from .dns_infrastructure_analyzer import analyze_dns_infrastructure
from .storage_analyzer import analyze_cloud_storage
from .container_analyzer import analyze_containers_and_kubernetes

logger = logging.getLogger(__name__)


def analyze_infrastructure_security(
    crawled_pages: List[CrawledPage],
    client: SafeHttpClient,
    target_domain: str,
    config: Optional[DeepScanConfig] = None,
    dns_metadata: Optional[Dict[str, Any]] = None,
    tls_metadata: Optional[Dict[str, Any]] = None,
    frontend_metadata: Optional[Dict[str, Any]] = None,
    appsec_metadata: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Executes Phase F6 Infrastructure, Cloud, Deployment & Operational Security Intelligence.
    Guarantees:
    - Strictly bounded request budget (max 20 external requests).
    - Failure isolated: single sub-analyzer exceptions do not terminate F6 or Deep Scan.
    - Zero port scanning, zero cloud exploitation, zero takeover attempts.
    - All evidence is cryptographically sanitized/masked.
    """
    cfg = config or DeepScanConfig()
    all_findings: List[Finding] = []

    # Request budget tracking
    max_requests = getattr(cfg, "max_f6_requests", 20)
    requests_executed = 0

    def can_request() -> bool:
        return requests_executed < max_requests

    # Establish target base URL
    base_url = f"https://{target_domain}"
    if crawled_pages and crawled_pages[0].url:
        parsed_first = urlparse(crawled_pages[0].url)
        base_url = f"{parsed_first.scheme}://{parsed_first.netloc}"

    # Default output data structures for failure resiliency
    infra_data: Dict[str, Any] = {}
    cdn_data: Dict[str, Any] = {}
    cloud_data: Dict[str, Any] = {}
    origin_data: Dict[str, Any] = {}
    deployment_data: Dict[str, Any] = {}
    environments_list: List[Dict[str, Any]] = []
    env_summary: Dict[str, Any] = {}
    operational_data: Dict[str, Any] = {}
    dns_rel_data: Dict[str, Any] = {}
    storage_endpoints: List[Dict[str, Any]] = []
    container_data: Dict[str, Any] = {}

    # 1. Infrastructure & CDN Fingerprinting
    try:
        infra_data, cdn_data, infra_findings = analyze_infrastructure(
            crawled_pages=crawled_pages,
            dns_metadata=dns_metadata,
            target_domain=target_domain,
        )
        all_findings.extend(infra_findings)
    except Exception as exc:
        logger.warning(f"[F6] Infrastructure analyzer failed gracefully: {exc}")
        infra_data = {"error": str(exc)}
        cdn_data = {"detected": False}

    # 2. Cloud Provider & Metadata Reference Analysis
    try:
        cloud_data, cloud_findings = analyze_cloud_infrastructure(
            crawled_pages=crawled_pages,
            dns_metadata=dns_metadata,
            frontend_metadata=frontend_metadata,
        )
        all_findings.extend(cloud_findings)
    except Exception as exc:
        logger.warning(f"[F6] Cloud analyzer failed gracefully: {exc}")
        cloud_data = {"error": str(exc)}

    # 3. Origin Exposure Signals
    try:
        origin_data, origin_findings = analyze_origin_exposure(
            crawled_pages=crawled_pages,
            cdn_data=cdn_data,
            dns_metadata=dns_metadata,
            tls_metadata=tls_metadata,
            target_domain=target_domain,
        )
        all_findings.extend(origin_findings)
    except Exception as exc:
        logger.warning(f"[F6] Origin analyzer failed gracefully: {exc}")
        origin_data = {"error": str(exc)}

    # 4. Deployment Platform & Exposed Artifacts
    remaining_dep = min(getattr(cfg, "max_deployment_artifact_checks", 5), max(0, max_requests - requests_executed))
    try:
        deployment_data, deploy_findings, dep_reqs = analyze_deployment(
            crawled_pages=crawled_pages,
            client=client,
            target_domain=target_domain,
            base_url=base_url,
            dns_metadata=dns_metadata,
            can_request_fn=can_request,
            max_checks=remaining_dep,
            max_doc_bytes=getattr(cfg, "max_document_bytes_f6", 262_144),
        )
        requests_executed += dep_reqs
        all_findings.extend(deploy_findings)
    except Exception as exc:
        logger.warning(f"[F6] Deployment analyzer failed gracefully: {exc}")
        deployment_data = {"error": str(exc)}

    # 5. Environments (Staging, Dev, Internal IPs, Localhost)
    try:
        environments_list, env_summary, env_findings = analyze_environments(
            crawled_pages=crawled_pages,
            target_domain=target_domain,
            dns_metadata=dns_metadata,
            f3_metadata=frontend_metadata,
        )
        all_findings.extend(env_findings)
    except Exception as exc:
        logger.warning(f"[F6] Environment analyzer failed gracefully: {exc}")
        env_summary = {"error": str(exc)}

    # 6. Operational Surfaces, Metrics & Spring Actuator
    remaining_op = min(getattr(cfg, "max_operational_endpoints", 10), max(0, max_requests - requests_executed))
    try:
        operational_data, op_findings, op_reqs = analyze_operational_surfaces(
            crawled_pages=crawled_pages,
            client=client,
            target_domain=target_domain,
            base_url=base_url,
            can_request_fn=can_request,
            max_probes=remaining_op,
            max_doc_bytes=getattr(cfg, "max_document_bytes_f6", 262_144),
        )
        requests_executed += op_reqs
        all_findings.extend(op_findings)
    except Exception as exc:
        logger.warning(f"[F6] Operational analyzer failed gracefully: {exc}")
        operational_data = {"error": str(exc)}

    # 7. DNS Relationships, IPv4/IPv6 Dual-Stack & Takeover Signals
    try:
        dns_rel_data, dns_findings = analyze_dns_infrastructure(
            dns_metadata=dns_metadata,
            target_domain=target_domain,
            cdn_data=cdn_data,
        )
        all_findings.extend(dns_findings)
    except Exception as exc:
        logger.warning(f"[F6] DNS infrastructure analyzer failed gracefully: {exc}")
        dns_rel_data = {"error": str(exc)}

    # 8. Cloud Storage & Sensitive Objects
    remaining_stor = min(getattr(cfg, "max_storage_checks", 5), max(0, max_requests - requests_executed))
    try:
        storage_endpoints, storage_findings, stor_reqs = analyze_cloud_storage(
            crawled_pages=crawled_pages,
            client=client,
            can_request_fn=can_request,
            max_checks=remaining_stor,
        )
        requests_executed += stor_reqs
        all_findings.extend(storage_findings)
    except Exception as exc:
        logger.warning(f"[F6] Storage analyzer failed gracefully: {exc}")

    # 9. Containers & Kubernetes Signals
    try:
        container_data, container_findings = analyze_containers_and_kubernetes(
            crawled_pages=crawled_pages,
            deployment_artifacts=deployment_data.get("artifacts", []),
        )
        all_findings.extend(container_findings)
    except Exception as exc:
        logger.warning(f"[F6] Container analyzer failed gracefully: {exc}")
        container_data = {"error": str(exc)}

    # 10. Deduplicate Findings to avoid duplicate score penalties
    deduped_findings: List[Finding] = []
    seen_finding_keys: Set[Tuple[str, str]] = set()
    for f in all_findings:
        key = (f.check_type, f.title)
        if key not in seen_finding_keys:
            seen_finding_keys.add(key)
            deduped_findings.append(f)

    # Master metadata summary
    f6_metadata = {
        "status": "completed",
        "requests_executed": requests_executed,
        "infrastructure": infra_data,
        "cdn": cdn_data,
        "cloud": cloud_data,
        "origin": origin_data,
        "deployment": deployment_data,
        "environments": environments_list,
        "environment_summary": env_summary,
        "storage": storage_endpoints,
        "containers": container_data,
        "operational_exposure": operational_data,
        "dns_relationships": dns_rel_data,
        "subdomain_relationships": dns_rel_data.get("subdomain_relationships", []),
        "takeover_signals": dns_rel_data.get("takeover_signals", []),
        "summary": {
            "total_findings": len(deduped_findings),
            "primary_provider": infra_data.get("primary_provider"),
            "cdn_detected": cdn_data.get("detected", False),
            "cdn_provider": cdn_data.get("provider"),
            "deployment_platform": deployment_data.get("platform"),
            "git_exposed": deployment_data.get("git_exposed", False),
            "environments_detected_count": len(environments_list),
            "storage_endpoints_count": len(storage_endpoints),
            "operational_surfaces_count": operational_data.get("surfaces_count", 0),
        },
    }

    return f6_metadata, deduped_findings
