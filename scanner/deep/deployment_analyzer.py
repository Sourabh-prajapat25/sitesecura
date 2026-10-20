"""
Scanly Scanner Engine - Phase F6 Deployment Platform & Artifact Exposure Analyzer
Passively fingerprints deployment platforms and safely audits for exposed deployment artifacts (.git, Dockerfile, package.json).
Strictly bounded: Max 5 artifact probes, 256 KB response limit, zero repository cloning.
"""
import re
from typing import Dict, List, Optional, Any, Tuple, Set
from urllib.parse import urljoin

from scanner.models import Finding, Severity, CheckStatus
from .infra_finding_helper import make_infra_finding
from scanner.network.http_client import SafeHttpClient
from .models import CrawledPage


# Deployment platform fingerprints
DEPLOYMENT_PLATFORMS = [
    {
        "platform": "Vercel",
        "header": "x-vercel-id",
        "server_val": r"(?i)^vercel$",
        "cname": r"(?i)\.vercel-dns\.com",
    },
    {
        "platform": "Netlify",
        "header": "x-nf-request-id",
        "server_val": r"(?i)^netlify$",
        "cname": r"(?i)\.netlify\.app",
    },
    {
        "platform": "Render",
        "header": "x-render-origin-server",
        "server_val": r"(?i)^render$",
        "cname": r"(?i)\.onrender\.com",
    },
    {
        "platform": "Railway",
        "header": "x-railway-",
        "server_val": r"(?i)railway",
        "cname": r"(?i)\.up\.railway\.app",
    },
    {
        "platform": "Fly.io",
        "header": "fly-request-id",
        "server_val": r"(?i)^fly$",
        "cname": r"(?i)\.fly\.dev",
    },
    {
        "platform": "Cloudflare Pages",
        "header": "cf-ray",
        "server_val": r"(?i)cloudflare",
        "cname": r"(?i)\.pages\.dev",
    },
    {
        "platform": "GitHub Pages",
        "header": "x-github-request-id",
        "server_val": r"(?i)^github\.com$",
        "cname": r"(?i)\.github\.io",
    },
]

# Candidate high-value deployment artifacts for bounded testing
DEPLOYMENT_ARTIFACT_CANDIDATES = [
    {
        "path": "/.git/HEAD",
        "type": "GIT_METADATA",
        "validator": lambda text: bool(re.match(r"^(ref:\s+refs/[^\r\n]+|[0-9a-fA-F]{40})", text.strip())),
        "description": "Exposed Git repository metadata (.git/HEAD)",
    },
    {
        "path": "/package.json",
        "type": "PACKAGE_JSON",
        "validator": lambda text: '"name"' in text and ('"version"' in text or '"dependencies"' in text),
        "description": "Public package.json configuration file",
    },
    {
        "path": "/docker-compose.yml",
        "type": "DOCKER_COMPOSE",
        "validator": lambda text: "services:" in text and ("version:" in text or "image:" in text),
        "description": "Public docker-compose.yml container orchestration file",
    },
    {
        "path": "/Dockerfile",
        "type": "DOCKERFILE",
        "validator": lambda text: bool(re.search(r"(?m)^FROM\s+[a-zA-Z0-9_:.-]+", text)),
        "description": "Public Dockerfile container build specification",
    },
    {
        "path": "/composer.lock",
        "type": "COMPOSER_LOCK",
        "validator": lambda text: '"packages"' in text and '"hash"' in text,
        "description": "Public PHP Composer lockfile (composer.lock)",
    },
]


def analyze_deployment(
    crawled_pages: List[CrawledPage],
    client: Optional[SafeHttpClient] = None,
    target_domain: str = "",
    base_url: str = "",
    dns_metadata: Optional[Dict[str, Any]] = None,
    can_request_fn: Optional[Any] = None,
    max_checks: int = 5,
    max_doc_bytes: int = 262_144,
) -> Tuple[Dict[str, Any], List[Finding], int]:
    """
    Passively fingerprints the deployment platform and performs bounded
    audits for exposed version control (.git) and container/build artifacts.
    """
    findings: List[Finding] = []
    dns_meta = dns_metadata or {}
    cnames = dns_meta.get("cname", []) or []
    requests_executed = 0

    # 1. Deployment Platform Fingerprinting
    detected_platform = None
    platform_evidence: List[str] = []
    confidence = "low"

    all_headers: Dict[str, Set[str]] = {}
    for page in crawled_pages:
        for k, v in page.headers.items():
            k_lower = k.lower()
            if k_lower not in all_headers:
                all_headers[k_lower] = set()
            all_headers[k_lower].add(v)

    for p in DEPLOYMENT_PLATFORMS:
        ev: List[str] = []
        p_name = p["platform"]

        # Header check
        for h_k in all_headers:
            if h_k == p["header"] or h_k.startswith(p["header"]):
                ev.append(f"Header '{h_k}' present")

        # Server header
        if "server" in all_headers:
            for s_val in all_headers["server"]:
                if re.search(p["server_val"], s_val):
                    ev.append(f"Server header '{s_val}' matches {p_name}")

        # CNAME check
        for cname in cnames:
            if re.search(p["cname"], cname):
                ev.append(f"CNAME '{cname}' matches {p_name}")

        if ev and not detected_platform:
            detected_platform = p_name
            platform_evidence = ev
            confidence = "high" if any("Header" in e or "CNAME" in e for e in ev) or len(ev) >= 2 else "medium"

    # 2. Bounded Deployment Artifact Verification
    artifacts_found: List[Dict[str, str]] = []
    git_exposed = False
    checked_count = 0

    if client and base_url:
        for cand in DEPLOYMENT_ARTIFACT_CANDIDATES:
            if checked_count >= max_checks:
                break
            if can_request_fn and not can_request_fn():
                break

            cand_url = urljoin(base_url, cand["path"])
            checked_count += 1
            requests_executed += 1

            try:
                resp = client.get(cand_url, max_redirects=2, max_response_bytes=max_doc_bytes)
                if resp and resp.status_code == 200 and resp.text:
                    body_sample = resp.text[:max_doc_bytes]
                    if cand["validator"](body_sample):
                        artifacts_found.append({
                            "url": cand_url,
                            "type": cand["type"],
                            "description": cand["description"],
                            "sample": body_sample[:100].strip(),
                        })

                        if cand["type"] == "GIT_METADATA":
                            git_exposed = True
                            findings.append(make_infra_finding(
                                check_type="deep_git_metadata_exposure",
                                title="Public Git Repository Metadata Exposed (.git/HEAD)",
                                description=(
                                    "The web server permits public access to Git repository metadata (.git/HEAD). "
                                    "This exposure may allow attackers to reconstruct the entire source code repository, "
                                    "commit history, developer comments, and embedded credentials."
                                ),
                                severity=Severity.CRITICAL,
                                status=CheckStatus.CRITICAL,
                                evidence=f"GET {cand_url} returned 200 OK with valid Git ref: '{body_sample[:60]}'",
                                how_to_fix="Block public HTTP access to .git directories in web server rules (e.g., 'location ~ /\\.git { deny all; }' in nginx).",
                            ))
                        elif cand["type"] in ("DOCKER_COMPOSE", "DOCKERFILE"):
                            findings.append(make_infra_finding(
                                check_type="deep_docker_artifact_exposure",
                                title=f"Container Specification File Exposed: {cand['path']}",
                                description=f"A public container build or orchestration file ({cand['description']}) was discovered accessible over HTTP.",
                                severity=Severity.HIGH,
                                status=CheckStatus.WARNING,
                                evidence=f"GET {cand_url} returned 200 OK with container configuration content.",
                                how_to_fix="Ensure deployment files, Dockerfiles, and compose manifests are excluded from web server document roots.",
                            ))
                        else:
                            findings.append(make_infra_finding(
                                check_type="deep_deployment_artifact_exposure",
                                title=f"Deployment Artifact Exposed: {cand['path']}",
                                description=f"The build dependency or project configuration file ({cand['description']}) is publicly accessible.",
                                severity=Severity.MEDIUM,
                                status=CheckStatus.WARNING,
                                evidence=f"GET {cand_url} returned 200 OK with project manifest structure.",
                                how_to_fix="Configure web server to deny access to manifest and dependency files (package.json, composer.lock, requirements.txt).",
                            ))
            except Exception:
                pass

    deployment_data = {
        "platform": detected_platform,
        "confidence": confidence,
        "evidence": platform_evidence,
        "git_exposed": git_exposed,
        "artifacts_count": len(artifacts_found),
        "artifacts": artifacts_found,
    }

    return deployment_data, findings, requests_executed
