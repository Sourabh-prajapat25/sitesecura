"""
Scanly Scanner Engine - Phase F6 Operational & Management Surface Analyzer
Audits public operational surfaces: health endpoints, Prometheus metrics, Spring Actuator,
management consoles, and observability tools (Grafana, Kibana, Jaeger).
Strictly bounded: Max 10 operational probes, 256 KB response limit, zero brute forcing.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set
from urllib.parse import urljoin

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from scanner.network.http_client import SafeHttpClient
from .models import CrawledPage


# Standard operational endpoints to verify safely
OPERATIONAL_CANDIDATES = [
    {
        "path": "/actuator/env",
        "type": "SPRING_ACTUATOR_ENV",
        "description": "Spring Boot Actuator Environment Endpoint",
        "is_sensitive": True,
        "validator": lambda text: "propertySources" in text or "activeProfiles" in text,
    },
    {
        "path": "/actuator",
        "type": "SPRING_ACTUATOR_INDEX",
        "description": "Spring Boot Actuator Discovery Index",
        "is_sensitive": False,
        "validator": lambda text: "_links" in text and "actuator" in text,
    },
    {
        "path": "/metrics",
        "type": "PROMETHEUS_METRICS",
        "description": "Prometheus Plaintext Metrics Endpoint",
        "is_sensitive": False,
        "validator": lambda text: bool(re.search(r"(?m)^#\s+HELP\s+[a-zA-Z0-9_]+", text)),
    },
    {
        "path": "/debug/vars",
        "type": "GO_EXPVAR",
        "description": "Go Runtime Debug Variables Endpoint (/debug/vars)",
        "is_sensitive": True,
        "validator": lambda text: "cmdline" in text and "memstats" in text,
    },
    {
        "path": "/healthz",
        "type": "K8S_HEALTH",
        "description": "Kubernetes Service Health Endpoint (/healthz)",
        "is_sensitive": False,
        "validator": lambda text: text.strip().lower() in ("ok", "true", "healthy") or '"status"' in text,
    },
    {
        "path": "/admin/",
        "type": "MANAGEMENT_ROUTE",
        "description": "Administrative Control Panel (/admin/)",
        "is_sensitive": False,
        "validator": lambda text: bool(re.search(r"(?i)(admin|administration|control\s+panel)", text)),
    },
]

# Signatures for third-party monitoring & observability tools
MONITORING_TOOL_SIGNATURES = [
    (r"(?i)\bgrafana\b", "Grafana"),
    (r"(?i)\bprometheus\b", "Prometheus"),
    (r"(?i)\bkibana\b", "Kibana"),
    (r"(?i)\bjaeger\b", "Jaeger Tracing"),
    (r"(?i)\bdatadoghq\b", "Datadog"),
    (r"(?i)\bnewrelic\b", "New Relic"),
    (r"(?i)\bsentry\.io\b", "Sentry"),
]

MANAGEMENT_PATH_REGEX = r"(?i)/(admin|manager|management|console|control|ops)(/|$)"


def analyze_operational_surfaces(
    crawled_pages: List[CrawledPage],
    client: SafeHttpClient,
    target_domain: str,
    base_url: str,
    can_request_fn: Optional[Any] = None,
    max_probes: int = 10,
    max_doc_bytes: int = 262_144,
) -> Tuple[Dict[str, Any], List[Finding], int]:
    """
    Evaluates public operational surfaces, Spring Actuator, metrics endpoints,
    and monitoring interfaces.
    """
    findings: List[Finding] = []
    requests_executed = 0

    operational_surfaces: List[Dict[str, Any]] = []
    monitoring_tools_observed: Set[str] = set()
    management_routes: List[str] = []

    # 1. Classify discovered pages for management routes and monitoring mentions
    for page in crawled_pages:
        if re.search(MANAGEMENT_PATH_REGEX, page.url):
            management_routes.append(page.url)

        # Look for monitoring tool mentions in scripts or HTML
        sample = (page.body_sample or "") + " " + " ".join(page.inline_scripts[:5])
        for pat, name in MONITORING_TOOL_SIGNATURES:
            if re.search(pat, sample):
                monitoring_tools_observed.add(name)

    # 2. Bounded Probes of Operational Candidates
    probes_run = 0
    sensitive_actuators = 0
    metrics_exposed = False
    debug_exposed = False

    for cand in OPERATIONAL_CANDIDATES:
        if probes_run >= max_probes:
            break
        if can_request_fn and not can_request_fn():
            break

        cand_url = urljoin(base_url, cand["path"])
        probes_run += 1
        requests_executed += 1

        try:
            resp = client.get(cand_url, max_redirects=2, max_response_bytes=max_doc_bytes)
            if resp and resp.status_code == 200 and resp.text:
                body_sample = resp.text[:max_doc_bytes]
                if cand["validator"](body_sample):
                    surface_item = {
                        "url": cand_url,
                        "type": cand["type"],
                        "description": cand["description"],
                        "is_sensitive": cand["is_sensitive"],
                    }
                    operational_surfaces.append(surface_item)

                    if cand["type"] == "SPRING_ACTUATOR_ENV":
                        sensitive_actuators += 1
                        findings.append(make_infra_finding(
                            check_type="deep_actuator_sensitive_exposure",
                            title="Sensitive Spring Boot Actuator Environment Exposed (/actuator/env)",
                            description=(
                                "The Spring Boot Actuator '/actuator/env' endpoint is publicly accessible without authentication. "
                                "This endpoint exposes active application profiles, configuration properties, and environment variables."
                            ),
                            severity=Severity.HIGH,
                            status=CheckStatus.HIGH,
                            evidence=f"GET {cand_url} returned HTTP 200 with propertySources data.",
                            how_to_fix="Restrict Spring Boot Actuators by setting 'management.endpoints.web.exposure.include=health,info' and requiring Spring Security authentication.",
                        ))
                    elif cand["type"] == "PROMETHEUS_METRICS":
                        metrics_exposed = True
                        findings.append(make_infra_finding(
                            check_type="deep_public_metrics_exposure",
                            title="Public Prometheus Metrics Endpoint Exposed (/metrics)",
                            description="Application operational metrics, request counters, and memory statistics are publicly exposed.",
                            severity=Severity.MEDIUM,
                            status=CheckStatus.WARNING,
                            evidence=f"GET {cand_url} returned 200 OK with Prometheus metrics format.",
                            how_to_fix="Restrict public access to Prometheus /metrics endpoints behind internal network boundaries or reverse-proxy authentication.",
                        ))
                    elif cand["type"] == "GO_EXPVAR":
                        debug_exposed = True
                        findings.append(make_infra_finding(
                            check_type="deep_public_debug_infrastructure",
                            title="Go Runtime Debug Endpoint Exposed (/debug/vars)",
                            description="Go runtime expvar debugging metrics (command line arguments, memory allocator statistics) are publicly accessible.",
                            severity=Severity.MEDIUM,
                            status=CheckStatus.WARNING,
                            evidence=f"GET {cand_url} returned 200 OK with memstats JSON data.",
                            how_to_fix="Restrict Go debug/vars endpoints using an internal HTTP server mux or reverse proxy blocking.",
                        ))
                    elif cand["type"] == "SPRING_ACTUATOR_INDEX":
                        findings.append(make_infra_finding(
                            check_type="deep_actuator_discovery_exposed",
                            title="Public Spring Boot Actuator Index Discovered (/actuator)",
                            description="The Spring Boot Actuator discovery index is exposed publicly.",
                            severity=Severity.LOW,
                            status=CheckStatus.WARNING,
                            evidence=f"GET {cand_url} returned HTTP 200 with HAL actuator link catalog.",
                            how_to_fix="Ensure unauthenticated actuator exposure is disabled in application properties.",
                        ))
                    elif cand["type"] == "MANAGEMENT_ROUTE":
                        management_routes.append(cand_url)
        except Exception:
            pass

    # 3. Public Management Route Findings
    if len(management_routes) > 0:
        clean_routes = list(set(management_routes))[:5]
        findings.append(make_infra_finding(
            check_type="deep_public_management_interface",
            title=f"Public Administrative / Management Interface Discovered: {clean_routes[0]}",
            description="Administrative management interfaces or back-office login portals were identified on standard public paths.",
            severity=Severity.INFO,
            status=CheckStatus.PASS,
            evidence="Discovered management routes:\n" + "\n".join([f"- {r}" for r in clean_routes]),
            how_to_fix="Enforce strong multi-factor authentication (MFA), rate limiting, and consider restricting admin portals to internal VPNs or IP allowlists.",
        ))

    operational_data = {
        "surfaces_count": len(operational_surfaces),
        "surfaces": operational_surfaces,
        "management_routes_count": len(management_routes),
        "management_routes": list(set(management_routes))[:10],
        "monitoring_tools": sorted(list(monitoring_tools_observed)),
        "metrics_exposed": metrics_exposed,
        "debug_exposed": debug_exposed,
        "sensitive_actuators_count": sensitive_actuators,
    }

    return operational_data, findings, requests_executed
