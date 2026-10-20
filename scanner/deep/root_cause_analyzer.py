"""
Scanly Scanner Engine - Phase F8 Root Cause Analysis Engine
Performs deterministic grouping of multi-phase findings into actionable systemic root causes.
Enforces strictly evidence-based language without speculation.
"""
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field

from .finding_normalizer import SecurityEvidence


@dataclass
class RootCause:
    """Represents a systemic root cause grouping multiple related findings."""
    id: str
    title: str
    description: str
    confidence: str
    severity: str
    findings_count: int
    affected_findings: List[str]
    affected_assets: List[str]
    recommended_action: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "confidence": self.confidence,
            "severity": self.severity,
            "findings_count": self.findings_count,
            "affected_findings": self.affected_findings,
            "affected_assets": self.affected_assets,
            "recommended_action": self.recommended_action,
            "metadata": self.metadata,
        }


ROOT_CAUSE_DEFINITIONS = [
    {
        "id": "EXPOSED_DEVELOPMENT_ARTIFACT",
        "title": "Exposed Development & Build Artifacts in Production",
        "description": "Multiple observations are consistent with development artifacts (e.g. JavaScript source maps, version control repositories, or environment configuration templates) remaining accessible on public production servers.",
        "recommended_action": "Sanitize production deployment pipelines to exclude .map files, .git repositories, and local environment files before public release.",
        "keywords": ["source_map", "git", "env_file", "docker", "backup", "dev_page"],
        "canonical": ["DEVELOPMENT_ARTIFACT"],
    },
    {
        "id": "PUBLIC_DEBUG_CONFIGURATION",
        "title": "Public Debug & Error Information Disclosure",
        "description": "System responses and diagnostic endpoints display verbose stack traces, database schema errors, or internal debugging interfaces accessible to unauthenticated callers.",
        "recommended_action": "Disable debug mode, custom error disclosure, and development diagnostics in application framework settings.",
        "keywords": ["error", "stack_trace", "debug", "actuator", "trace"],
        "canonical": ["DEVELOPMENT_ARTIFACT", "INTERNAL_TOPOLOGY_EXPOSURE"],
    },
    {
        "id": "WEAK_SECURITY_HEADERS",
        "title": "Incomplete Defensive HTTP Security Headers",
        "description": "Multiple core defensive browser policy headers (such as Content-Security-Policy, HSTS, X-Frame-Options, or CORS controls) are absent or configured permissively.",
        "recommended_action": "Deploy a hardened, centrally managed HTTP response header policy across all web server and reverse proxy tiers.",
        "keywords": ["csp", "hsts", "x_frame", "x_content", "cors", "coop", "corp", "coep", "sec_header"],
        "canonical": ["SECURITY_HEADERS", "TRANSPORT_SECURITY"],
    },
    {
        "id": "WEAK_AUTHENTICATION_POSTURE",
        "title": "Permissive Session & Authentication Hygiene",
        "description": "Session identifiers and authentication workflows lack essential browser hardening flags (such as HttpOnly or Secure) or omit cross-site request forgery protection on state-changing forms.",
        "recommended_action": "Enforce the 'Secure', 'HttpOnly', and 'SameSite=Lax' attributes on all session cookies, and require cryptographic anti-CSRF tokens on all state-modifying requests.",
        "keywords": ["cookie", "session", "httponly", "csrf", "auth", "login"],
        "canonical": ["AUTHENTICATION_SURFACE"],
    },
    {
        "id": "PUBLIC_ADMIN_SURFACE",
        "title": "Unrestricted Administrative Surface Reachability",
        "description": "Internal administrative, operational, or management interfaces are reachable from the public Internet without private network or IP-restricted gateway enforcement.",
        "recommended_action": "Relocate administrative and monitoring interfaces behind an authenticated zero-trust gateway or VPN.",
        "keywords": ["admin", "management", "actuator", "metrics"],
        "canonical": ["ADMIN_SURFACE"],
    },
    {
        "id": "SENSITIVE_DATA_DISCLOSURE",
        "title": "Public Exposure of Sensitive Entity Data",
        "description": "Public HTTP responses, documents, or API endpoints contain personal identifiers, financial data, or sensitive record structures accessible without prior authentication.",
        "recommended_action": "Implement server-side response filtering to eliminate sensitive data fields from unauthenticated API and page responses.",
        "keywords": ["pii", "payment", "card", "financial", "ssn", "health", "auth_data"],
        "canonical": ["PERSONAL_DATA_EXPOSURE", "FINANCIAL_DATA_EXPOSURE"],
    },
    {
        "id": "ORIGIN_EXPOSURE",
        "title": "Direct Origin Infrastructure Discoverability",
        "description": "Direct IP resolution or IPv6 network routing allows external observers to identify the origin server address, bypassing perimeter CDN and WAF protections.",
        "recommended_action": "Configure origin firewalls to restrict inbound traffic exclusively to authorized reverse proxy / CDN IP address blocks.",
        "keywords": ["origin", "direct_ip", "ipv6_origin", "cdn_origin"],
        "canonical": ["ORIGIN_EXPOSURE"],
    },
    {
        "id": "PUBLIC_API_SURFACE",
        "title": "Publicly Reachable Unauthenticated API Surface",
        "description": "Multiple backend application APIs, GraphQL schemas, or OpenAPI specifications are publicly cataloged and responsive to unauthenticated requests.",
        "recommended_action": "Audit API routes to verify intended public access and require API key or bearer token authentication for all non-public endpoints.",
        "keywords": ["api", "graphql", "openapi", "swagger"],
        "canonical": ["API_SURFACE"],
    },
    {
        "id": "EXCESSIVE_DATA_EXPOSURE",
        "title": "Insufficient Data Minimization in Endpoints & Forms",
        "description": "Application interfaces collect excessive personal fields or return complete database entity objects rather than filtered subsets required for frontend rendering.",
        "recommended_action": "Apply data minimization principles to form field requirements and implement Data Transfer Objects (DTOs) for all API payloads.",
        "keywords": ["excessive", "minimization", "sensitive_parameter", "pii_in_url"],
        "canonical": ["PERSONAL_DATA_EXPOSURE", "API_SURFACE"],
    },
    {
        "id": "OUTDATED_SECURITY_CONFIGURATION",
        "title": "Outdated Transport & Cryptographic Configuration",
        "description": "Observed transport settings rely on legacy TLS protocol versions, deprecated cipher suites, or lack modern certificate pinning protections.",
        "recommended_action": "Upgrade web server configuration to support TLS 1.3/1.2 exclusively and disable legacy ciphers (CBC, RC4, 3DES).",
        "keywords": ["tls", "ssl", "cipher", "deprecated", "cert"],
        "canonical": ["TRANSPORT_SECURITY"],
    },
    {
        "id": "CLOUD_STORAGE_MISCONFIGURATION",
        "title": "Unrestricted Cloud Storage & Bucket Exposure",
        "description": "Public cloud storage buckets (Amazon S3, Google Cloud Storage, Azure Blob Storage) are reachable without authenticated authorization.",
        "recommended_action": "Enable cloud bucket Block Public Access policies and require IAM authentication.",
        "keywords": ["bucket", "s3", "gcs", "azure_blob", "storage"],
        "canonical": ["CLOUD_STORAGE_EXPOSURE"],
    },
]


def analyze_root_causes(
    evidence_list: List[SecurityEvidence],
    max_root_causes: int = 25,
) -> List[Dict[str, Any]]:
    """
    Groups normalized findings into systemic root causes deterministically based on evidence.
    """
    root_causes: List[RootCause] = []

    for defn in ROOT_CAUSE_DEFINITIONS:
        rc_id = defn["id"]
        matched_evidence: List[SecurityEvidence] = []

        for e in evidence_list:
            ct = e.check_type.lower()
            canon = e.canonical_category

            # Check keyword match or canonical match
            kw_match = any(kw in ct for kw in defn["keywords"])
            canon_match = canon in defn["canonical"]

            if kw_match or canon_match:
                matched_evidence.append(e)

        # Only generate root cause if evidence supports it (at least 1 finding, stronger if >= 2)
        if matched_evidence:
            affected_ids = [e.finding_id for e in matched_evidence]
            affected_assets = list(set([e.asset for e in matched_evidence if e.asset]))

            has_crit = any(e.severity == "critical" for e in matched_evidence)
            has_high = any(e.severity == "high" for e in matched_evidence)

            sev = "critical" if has_crit else ("high" if has_high else "medium")
            conf = "HIGH" if len(matched_evidence) >= 2 else "MEDIUM"

            root_causes.append(RootCause(
                id=rc_id,
                title=defn["title"],
                description=defn["description"],
                confidence=conf,
                severity=sev,
                findings_count=len(matched_evidence),
                affected_findings=affected_ids[:10],
                affected_assets=affected_assets[:5],
                recommended_action=defn["recommended_action"],
                metadata={
                    "sample_finding": matched_evidence[0].title,
                    "evidence_types": list(set([e.check_type for e in matched_evidence[:5]])),
                }
            ))

    # Sort deterministically by severity then finding count
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    root_causes.sort(key=lambda rc: (sev_order.get(rc.severity.lower(), 5), -rc.findings_count, rc.id))
    selected = root_causes[:max_root_causes]

    return [rc.to_dict() for rc in selected]
