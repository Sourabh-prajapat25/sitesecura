"""
Scanly Scanner Engine - Phase F6 Container & Kubernetes Exposure Signal Analyzer
Passively detects public containerization and Kubernetes orchestration references
in client-accessible HTML comments, scripts, headers, and documentation.
Strictly passive: Zero cluster querying, zero Docker API commands, zero pod interaction.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from .models import CrawledPage


# Container and Kubernetes regex patterns
K8S_PATTERNS = [
    (r"(?i)\bk8s-[a-z0-9-]+\b", "Kubernetes Resource Identifier"),
    (r"(?i)\b[a-z0-9_-]+\.svc\.cluster\.local\b", "Kubernetes In-Cluster Service DNS"),
    (r"(?i)\bingress\.kubernetes\.io\b", "Kubernetes Ingress Annotation"),
    (r"(?i)\bkubernetes\.default\.svc\b", "Kubernetes Default Service Reference"),
    (r"(?i)\bpod-[a-z0-9-]{5,}\b", "Kubernetes Pod Identifier"),
]

DOCKER_REGISTRY_PATTERNS = [
    (r"(?i)\b(?:docker\.io|gcr\.io|quay\.io|[0-9]+\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com)/[a-z0-9_.-]+/[a-z0-9_.-]+(?::[a-z0-9_.-]+)?\b", "Container Registry Image Tag"),
]


def analyze_containers_and_kubernetes(
    crawled_pages: List[CrawledPage],
    deployment_artifacts: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits crawled pages and discovered deployment artifacts
    for container and Kubernetes orchestration signals.
    """
    findings: List[Finding] = []
    artifacts = deployment_artifacts or []

    k8s_signals: List[Dict[str, str]] = []
    docker_signals: List[Dict[str, str]] = []
    seen_signals: Set[str] = set()

    # 1. Search text across pages (HTML, scripts, comments)
    text_corpus: List[Tuple[str, str]] = []
    for page in crawled_pages:
        for s in page.inline_scripts[:5]:
            text_corpus.append((f"Script on {page.url}", s[:2048]))
        if page.body_sample:
            text_corpus.append((f"HTML on {page.url}", page.body_sample[:4096]))

    for label, text in text_corpus:
        # Check Kubernetes signals
        for pat, desc in K8S_PATTERNS:
            for match in re.findall(pat, text):
                sig_key = f"{desc}:{match}"
                if sig_key not in seen_signals:
                    seen_signals.add(sig_key)
                    k8s_signals.append({
                        "type": desc,
                        "match": match,
                        "source": label,
                    })

        # Check Docker Registry image tags
        for pat, desc in DOCKER_REGISTRY_PATTERNS:
            for match in re.findall(pat, text):
                sig_key = f"{desc}:{match}"
                if sig_key not in seen_signals:
                    seen_signals.add(sig_key)
                    docker_signals.append({
                        "type": desc,
                        "match": match,
                        "source": label,
                    })

    # 2. Check if Dockerfile / Compose was discovered in artifacts
    has_docker_artifact = any(a.get("type") in ("DOCKERFILE", "DOCKER_COMPOSE") for a in artifacts)
    if has_docker_artifact:
        docker_signals.append({
            "type": "Container Manifest Artifact",
            "match": "Public Dockerfile or docker-compose.yml accessible",
            "source": "Deployment Artifact Audit",
        })

    # 3. Create Findings
    if k8s_signals:
        ev_str = "\n".join([f"- {s['type']}: '{s['match']}' in {s['source']}" for s in k8s_signals[:4]])
        findings.append(make_infra_finding(
            check_type="deep_kubernetes_exposure_signal",
            title="Kubernetes Cluster Orchestration Signal Disclosed",
            description="Client-facing HTML, scripts, or comments expose internal Kubernetes resource naming or cluster DNS patterns.",
            severity=Severity.LOW,
            status=CheckStatus.WARNING,
            evidence=f"Discovered Kubernetes signals:\n{ev_str}",
            how_to_fix="Ensure internal cluster service names (*.svc.cluster.local) and pod annotations are stripped from production client bundles.",
        ))

    container_data = {
        "kubernetes_detected": len(k8s_signals) > 0,
        "kubernetes_signals_count": len(k8s_signals),
        "kubernetes_signals": k8s_signals,
        "docker_signals_count": len(docker_signals),
        "docker_signals": docker_signals,
    }

    return container_data, findings
