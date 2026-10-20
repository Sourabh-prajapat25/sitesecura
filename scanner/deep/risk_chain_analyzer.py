"""
Scanly Scanner Engine - Phase F8 Deterministic Security Risk Chains Engine
Correlates multi-phase evidence to identify compound risk relationships (attack chains)
without active exploitation, providing actionable architectural context.
"""
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field

from scanner.models import Finding, Severity, CheckStatus
from .finding_normalizer import SecurityEvidence


@dataclass
class RiskChain:
    """Represents a correlated security risk chain linking multiple observations."""
    chain_id: str
    check_type: str
    title: str
    description: str
    severity: str
    confidence: str
    source_phases: List[str]
    affected_assets: List[str]
    evidence_findings: List[str]
    recommendation: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chain_id": self.chain_id,
            "check_type": self.check_type,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "confidence": self.confidence,
            "source_phases": self.source_phases,
            "affected_assets": self.affected_assets,
            "evidence_findings": self.evidence_findings,
            "evidence_count": len(self.evidence_findings),
            "recommendation": self.recommendation,
            "metadata": self.metadata,
        }


def make_chain_finding(chain: RiskChain) -> Finding:
    """Creates a standard Finding record for a risk chain with zero score deduction."""
    sev_enum = Severity.INFO
    s_lower = chain.severity.lower()
    if s_lower == "critical":
        sev_enum = Severity.CRITICAL
    elif s_lower == "high":
        sev_enum = Severity.HIGH
    elif s_lower == "medium":
        sev_enum = Severity.MEDIUM
    elif s_lower == "low":
        sev_enum = Severity.LOW

    conf_num = 1.0 if chain.confidence == "HIGH" else (0.8 if chain.confidence == "MEDIUM" else 0.5)

    return Finding(
        check_type=chain.check_type,
        name=chain.title,
        status=CheckStatus.WARNING if chain.severity in ("critical", "high") else CheckStatus.INFO,
        severity=sev_enum,
        score_impact=0,  # Zero deduction to prevent double-penalizing underlying findings
        title=chain.title,
        summary=chain.description,
        why_it_matters=(
            "Individual security observations in isolation may appear moderate, but when correlated "
            "across architectural layers, they indicate compounding exposure that increases overall attack surface."
        ),
        how_to_fix=chain.recommendation,
        estimated_fix_minutes=45,
        documentation_url="https://sitesecura.com/docs/security-intelligence/risk-chains",
        technical_details={
            "chain_id": chain.chain_id,
            "source_phases": chain.source_phases,
            "affected_assets": chain.affected_assets,
            "evidence_findings": chain.evidence_findings,
            "category": "Risk Intelligence & Correlation",
        },
        evidence=f"Correlated {len(chain.evidence_findings)} observations across {', '.join(chain.source_phases)}: {', '.join(chain.affected_assets[:3])}",
        confidence=conf_num,
    )


def analyze_risk_chains(
    evidence_list: List[SecurityEvidence],
    scan_metadata: Optional[Dict[str, Any]] = None,
    max_chains: int = 25,
) -> Tuple[List[Dict[str, Any]], List[Finding]]:
    """
    Evaluates normalized evidence to identify compound risk chains across phases F1–F7.
    """
    meta = scan_metadata or {}
    chains: List[RiskChain] = []

    # Build lookup indices for fast, deterministic evaluation
    ev_by_canonical: Dict[str, List[SecurityEvidence]] = {}
    ev_by_phase: Dict[str, List[SecurityEvidence]] = {}
    ev_by_check: Dict[str, List[SecurityEvidence]] = {}

    for e in evidence_list:
        ev_by_canonical.setdefault(e.canonical_category, []).append(e)
        ev_by_phase.setdefault(e.source_phase, []).append(e)
        ev_by_check.setdefault(e.check_type, []).append(e)

    def has_check(prefix: str) -> bool:
        return any(ct.startswith(prefix) or prefix in ct for ct in ev_by_check)

    def get_ev_by_prefix(prefix: str) -> List[SecurityEvidence]:
        res: List[SecurityEvidence] = []
        for ct, items in ev_by_check.items():
            if ct.startswith(prefix) or prefix in ct:
                res.extend(items)
        return res

    # -------------------------------------------------------------------------
    # CHAIN 1: PUBLIC API + SENSITIVE DATA
    # -------------------------------------------------------------------------
    api_ev = ev_by_canonical.get("API_SURFACE", [])
    data_ev = ev_by_canonical.get("PERSONAL_DATA_EXPOSURE", []) + ev_by_canonical.get("FINANCIAL_DATA_EXPOSURE", [])
    if api_ev and data_ev:
        assets = list(set([e.asset for e in (api_ev + data_ev) if e.asset]))
        all_ids = [e.finding_id for e in (api_ev + data_ev)]
        has_crit = any(e.severity == "critical" for e in data_ev)
        chains.append(RiskChain(
            chain_id="chain_api_data",
            check_type="deep_risk_chain_public_api_data",
            title="Correlated Risk Chain: Public API & Sensitive Data Disclosure",
            description=(
                "A publicly accessible API endpoint was observed returning response payloads containing "
                "unmasked or unminimized personal, financial, or identifier fields."
            ),
            severity="critical" if has_crit else "high",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in (api_ev + data_ev)]))),
            affected_assets=assets[:5],
            evidence_findings=all_ids[:8],
            recommendation="Implement response data minimization and enforce strict authentication/authorization on API routes.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 2: ADMIN SURFACE + AUTH SIGNAL
    # -------------------------------------------------------------------------
    admin_ev = ev_by_canonical.get("ADMIN_SURFACE", [])
    auth_ev = ev_by_canonical.get("AUTHENTICATION_SURFACE", [])
    if admin_ev and auth_ev:
        assets = list(set([e.asset for e in (admin_ev + auth_ev) if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_admin_auth",
            check_type="deep_risk_chain_admin_auth",
            title="Correlated Risk Chain: Exposed Administrative & Authentication Surface",
            description=(
                "Administrative management endpoints were detected alongside public authentication surfaces, "
                "indicating administrative access paths are reachable from untrusted network perimeters."
            ),
            severity="high",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in (admin_ev + auth_ev)]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in (admin_ev + auth_ev)][:8],
            recommendation="Restrict administrative interfaces to VPN, private bastion, or IP-restricted networks with mandatory MFA.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 3: ADMIN + API + ROLE/AUTHORIZATION SIGNAL
    # -------------------------------------------------------------------------
    authz_ev = get_ev_by_prefix("deep_business") + get_ev_by_prefix("deep_role") + get_ev_by_prefix("deep_auth")
    if admin_ev and api_ev and authz_ev:
        assets = list(set([e.asset for e in (admin_ev + api_ev + authz_ev) if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_admin_api_authz",
            check_type="deep_risk_chain_admin_api_authz",
            title="Correlated Risk Chain: Administrative API Surface & Role Exposure",
            description=(
                "Administrative API endpoints and role/authorization metadata signals were both identified, "
                "increasing the risk of unauthorized privilege escalation if fine-grained authorization is misconfigured."
            ),
            severity="high",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in (admin_ev + api_ev + authz_ev)]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in (admin_ev + api_ev + authz_ev)][:8],
            recommendation="Audit server-side authorization checks on all administrative API endpoints; never rely solely on client-side role checks.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 4: SOURCE MAP + INTERNAL TOPOLOGY DISCLOSURE
    # -------------------------------------------------------------------------
    sm_ev = get_ev_by_prefix("deep_source_map") + get_ev_by_prefix("deep_js_source_map")
    internal_ev = get_ev_by_prefix("deep_js_internal_url") + get_ev_by_prefix("deep_environment_internal_ip")
    if sm_ev and internal_ev:
        assets = list(set([e.asset for e in (sm_ev + internal_ev) if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_frontend_internal",
            check_type="deep_risk_chain_frontend_internal_disclosure",
            title="Correlated Risk Chain: Frontend Source Map & Internal Network Disclosure",
            description=(
                "Public JavaScript source maps and internal hostnames or IP addresses were both identified, "
                "allowing external observers to reconstruct internal architecture and endpoint paths."
            ),
            severity="medium",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in (sm_ev + internal_ev)]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in (sm_ev + internal_ev)][:8],
            recommendation="Exclude .map source map files from production deployment artifacts and sanitize internal network hostnames.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 5: SOURCE MAP + SECRET
    # -------------------------------------------------------------------------
    secret_ev = get_ev_by_prefix("deep_js_secret") + get_ev_by_prefix("deep_js_api_key") + get_ev_by_prefix("deep_secret_in_url")
    if sm_ev and secret_ev:
        assets = list(set([e.asset for e in (sm_ev + secret_ev) if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_frontend_secret",
            check_type="deep_risk_chain_frontend_secret",
            title="Correlated Risk Chain: Source Map & Hardcoded Secret Exposure",
            description=(
                "Production source maps were identified in proximity to client-side API secrets, "
                "facilitating secret extraction and reverse engineering of frontend communication."
            ),
            severity="high",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in (sm_ev + secret_ev)]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in (sm_ev + secret_ev)][:8],
            recommendation="Revoke and rotate exposed credentials, remove production source maps, and proxy third-party API calls via backend services.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 6: ORIGIN EXPOSURE + CDN + DNS INCONSISTENCY
    # -------------------------------------------------------------------------
    origin_ev = ev_by_canonical.get("ORIGIN_EXPOSURE", [])
    cdn_present = meta.get("infrastructure_security", {}).get("cdn", {}).get("detected")
    if origin_ev and (cdn_present or any("cdn" in e.check_type for e in origin_ev)):
        assets = list(set([e.asset for e in origin_ev if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_origin_bypass",
            check_type="deep_risk_chain_origin_bypass",
            title="Correlated Risk Chain: Potential CDN Protection Bypass via Direct Origin",
            description=(
                "Evidence of origin server IP addresses or direct infrastructure exposure was observed "
                "despite CDN protection, suggesting attackers may bypass CDN WAF and DDoS defenses by targeting the origin directly."
            ),
            severity="high",
            confidence="MEDIUM",
            source_phases=sorted(list(set([e.source_phase for e in origin_ev] + ["F6"]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in origin_ev][:8],
            recommendation="Configure origin firewall security groups to accept traffic exclusively from published CDN IP ranges.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 7: CLOUD STORAGE + PUBLIC SENSITIVE DATA
    # -------------------------------------------------------------------------
    storage_ev = ev_by_canonical.get("CLOUD_STORAGE_EXPOSURE", [])
    if storage_ev and (data_ev or ev_by_canonical.get("DOCUMENT_EXPOSURE")):
        doc_data_ev = data_ev + ev_by_canonical.get("DOCUMENT_EXPOSURE", [])
        assets = list(set([e.asset for e in (storage_ev + doc_data_ev) if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_cloud_data",
            check_type="deep_risk_chain_public_cloud_data",
            title="Correlated Risk Chain: Public Cloud Storage & Sensitive Data Asset",
            description=(
                "Public cloud storage resources (e.g. S3, GCS, Azure Blobs) and sensitive data or documents "
                "were both observed, presenting a direct data exfiltration pathway if bucket permissions are open."
            ),
            severity="critical",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in (storage_ev + doc_data_ev)]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in (storage_ev + doc_data_ev)][:8],
            recommendation="Enforce S3 Block Public Access and IAM role-based authorization on all cloud storage buckets.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 8: PII IN URL + EXTERNAL REFERRER PROPAGATION
    # -------------------------------------------------------------------------
    url_pii_ev = get_ev_by_prefix("deep_pii_in_url") + get_ev_by_prefix("deep_sensitive_parameter")
    ref_ev = get_ev_by_prefix("deep_sensitive_referrer") + get_ev_by_prefix("deep_referrer")
    if url_pii_ev and (ref_ev or has_check("deep_referrer_leak")):
        all_pii_ref = url_pii_ev + ref_ev
        assets = list(set([e.asset for e in all_pii_ref if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_pii_propagation",
            check_type="deep_risk_chain_pii_propagation",
            title="Correlated Risk Chain: URL Parameter PII & Cross-Origin Referrer Leakage",
            description=(
                "Personal data was identified in URL query parameters on pages with permissive Referrer-Policy "
                "settings, creating a propagation vector where sensitive user attributes leak to third-party endpoints."
            ),
            severity="medium",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in all_pii_ref]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in all_pii_ref][:8],
            recommendation="Transmit sensitive parameters via HTTP request bodies instead of query strings, and enforce 'Referrer-Policy: strict-origin-when-cross-origin'.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 9: TRACKING + SENSITIVE FORM
    # -------------------------------------------------------------------------
    track_ev = ev_by_canonical.get("TRACKING_SURFACE", [])
    form_ev = get_ev_by_prefix("deep_sensitive_form") + get_ev_by_prefix("deep_form") + get_ev_by_prefix("deep_excessive_data")
    if track_ev and form_ev:
        assets = list(set([e.asset for e in (track_ev + form_ev) if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_tracking_form",
            check_type="deep_risk_chain_tracking_data_collection",
            title="Correlated Risk Chain: Third-Party Tracking Active on Sensitive Input Forms",
            description=(
                "Third-party tracking or session recording scripts were detected on pages containing sensitive data forms, "
                "creating risk of inadvertent keystroke or form telemetry harvesting."
            ),
            severity="medium",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in (track_ev + form_ev)]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in (track_ev + form_ev)][:8],
            recommendation="Configure strict input masking in session recording tools and isolate sensitive transaction pages from third-party advertising scripts.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 10: PUBLIC DOCUMENT + PII/INTERNAL METADATA
    # -------------------------------------------------------------------------
    doc_ev = ev_by_canonical.get("DOCUMENT_EXPOSURE", [])
    if doc_ev and any("metadata" in e.check_type or "export" in e.check_type for e in doc_ev):
        assets = list(set([e.asset for e in doc_ev if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_public_document_data",
            check_type="deep_risk_chain_public_document_data",
            title="Correlated Risk Chain: Public Documents with Embedded Metadata or Customer Records",
            description=(
                "Public documents or data exports were identified containing internal paths, author identities, "
                "or sensitive record structures accessible without authentication."
            ),
            severity="high" if any(e.severity in ("critical", "high") for e in doc_ev) else "medium",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in doc_ev]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in doc_ev][:8],
            recommendation="Sanitize document metadata prior to publication and store user data exports in authenticated object storage.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 11: PUBLIC LOG + AUTHENTICATION DATA
    # -------------------------------------------------------------------------
    log_ev = get_ev_by_prefix("deep_public_log_data") + get_ev_by_prefix("deep_log")
    if log_ev and (auth_ev or get_ev_by_prefix("deep_public_auth_data")):
        combined = log_ev + auth_ev + get_ev_by_prefix("deep_public_auth_data")
        assets = list(set([e.asset for e in combined if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_log_auth",
            check_type="deep_risk_chain_log_auth_data",
            title="Correlated Risk Chain: Accessible Application Logs with Authentication Data",
            description=(
                "Unauthenticated application log files were observed disclosing system telemetry alongside "
                "authentication tokens or credential reset contexts."
            ),
            severity="critical",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in combined]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in combined][:8],
            recommendation="Block public HTTP access to .log files immediately and rotate any credentials or session tokens appearing in logs.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 12: DEVELOPMENT & DEBUG ARTIFACT EXPOSURE
    # -------------------------------------------------------------------------
    dev_ev = ev_by_canonical.get("DEVELOPMENT_ARTIFACT", [])
    if len(dev_ev) >= 2 or (dev_ev and internal_ev):
        combined = dev_ev + internal_ev
        assets = list(set([e.asset for e in combined if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_development_exposure",
            check_type="deep_risk_chain_development_exposure",
            title="Correlated Risk Chain: Multiple Development & Debug Artifacts Exposed in Production",
            description=(
                "Multiple development artifacts (e.g. source maps, git repositories, debug pages, stack traces) "
                "were identified on public endpoints, providing blueprint reconnaissance material to attackers."
            ),
            severity="high",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in combined]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in combined][:8],
            recommendation="Enforce a production build policy that strips development configuration files, sourcemaps, and debug flags.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 13: PUBLIC API + DOCUMENTATION + SENSITIVE DATA
    # -------------------------------------------------------------------------
    docs_api_ev = get_ev_by_prefix("deep_openapi_spec") + get_ev_by_prefix("deep_swagger_ui") + get_ev_by_prefix("deep_api_docs")
    if docs_api_ev and data_ev:
        combined = docs_api_ev + data_ev
        assets = list(set([e.asset for e in combined if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_documented_data_surface",
            check_type="deep_risk_chain_documented_data_surface",
            title="Correlated Risk Chain: Publicly Cataloged API with Sensitive Data Exposure",
            description=(
                "Public interactive API documentation (Swagger/OpenAPI) was discovered describing endpoints "
                "that also exhibit sensitive data disclosure or lack of authorization controls."
            ),
            severity="medium",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in combined]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in combined][:8],
            recommendation="Protect API documentation behind internal authentication and verify data sanitization on all documented schemas.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 14: WEAK TRANSPORT + AUTHENTICATION SURFACE
    # -------------------------------------------------------------------------
    transport_ev = ev_by_canonical.get("TRANSPORT_SECURITY", [])
    if transport_ev and auth_ev:
        combined = transport_ev + auth_ev
        assets = list(set([e.asset for e in combined if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_auth_transport",
            check_type="deep_risk_chain_auth_transport",
            title="Correlated Risk Chain: Authentication Surface Accessible Over Inadequate Transport",
            description=(
                "Authentication workflows were observed on hosts exhibiting weak transport configurations, "
                "missing HSTS preloading, or deprecated cipher suites, creating potential credential interception vectors."
            ),
            severity="high",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in combined]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in combined][:8],
            recommendation="Enforce strict HSTS with max-age >= 31536000 and disable legacy TLS 1.0/1.1 protocols across all login domains.",
        ))

    # -------------------------------------------------------------------------
    # CHAIN 15: TRACKING + COOKIE + CONSENT GOVERNANCE
    # -------------------------------------------------------------------------
    consent_missing = get_ev_by_prefix("deep_tracker_before_consent") + get_ev_by_prefix("deep_privacy_policy_missing")
    if track_ev and consent_missing:
        combined = track_ev + consent_missing
        assets = list(set([e.asset for e in combined if e.asset]))
        chains.append(RiskChain(
            chain_id="chain_tracking_governance",
            check_type="deep_risk_chain_tracking_governance",
            title="Correlated Risk Chain: Behavioral Tracking Active Without Consent Governance",
            description=(
                "Advertising pixels or session recording scripts were observed firing prior to visitor consent interaction, "
                "indicating an incomplete or unverified Consent Management Platform (CMP) integration."
            ),
            severity="low",
            confidence="HIGH",
            source_phases=sorted(list(set([e.source_phase for e in combined]))),
            affected_assets=assets[:5],
            evidence_findings=[e.finding_id for e in combined][:8],
            recommendation="Integrate a Consent Management Platform (e.g. OneTrust, Cookiebot) and gate third-party tracking execution until visitor consent is granted.",
        ))

    # Deduplicate and sort deterministically
    unique_chains: List[RiskChain] = []
    seen_chain_types: Set[str] = set()
    for c in chains:
        if c.check_type not in seen_chain_types:
            seen_chain_types.add(c.check_type)
            unique_chains.append(c)

    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    unique_chains.sort(key=lambda c: (sev_order.get(c.severity.lower(), 5), c.check_type))
    selected_chains = unique_chains[:max_chains]

    chain_dicts = [c.to_dict() for c in selected_chains]
    chain_findings = [make_chain_finding(c) for c in selected_chains]

    return chain_dicts, chain_findings
