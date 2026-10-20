"""
Scanly Scanner Engine - Phase F8 Attack Surface Graph & Exposure Concentration
Calculates high-level attack surface metrics, detects exposure concentration clusters,
and isolates high-attention assets affected by multiple independent findings.
"""
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict
from urllib.parse import urlparse

from .finding_normalizer import SecurityEvidence


def calculate_attack_surface(
    crawled_pages: List[Any],
    scan_metadata: Optional[Dict[str, Any]] = None,
    evidence_list: Optional[List[SecurityEvidence]] = None,
    max_assets: int = 100,
) -> Dict[str, Any]:
    """
    Computes attack surface inventory metrics, analyzes finding concentration,
    and ranks high-attention assets based on correlated evidence weight.
    """
    meta = scan_metadata or {}
    evidence = evidence_list or []

    # 1. Calculate Metrics from Crawl and Phase Metadata
    unique_pages: Set[str] = set()
    for p in crawled_pages:
        u = getattr(p, "url", "")
        if u:
            try:
                unique_pages.add(urlparse(u).path or "/")
            except Exception:
                unique_pages.add(u)

    # API endpoints
    appsec = meta.get("application_security") or {}
    api_count = appsec.get("endpoints_analyzed") or appsec.get("endpoints_discovered") or 0
    if not api_count:
        api_count = sum(1 for e in evidence if e.canonical_category == "API_SURFACE")

    # Admin surfaces
    admin_count = 0
    if appsec.get("admin_exposure"):
        admin_count += len(appsec.get("admin_exposure", {}).get("detected_endpoints", []))
    admin_count += sum(1 for e in evidence if e.canonical_category == "ADMIN_SURFACE")

    # Auth surfaces
    identity = meta.get("identity_security") or {}
    auth_count = identity.get("auth_surfaces_count") or 0
    if not auth_count:
        auth_count = sum(1 for e in evidence if e.canonical_category == "AUTHENTICATION_SURFACE")

    # Sensitive data surfaces
    data_sec = meta.get("data_security") or {}
    sensitive_count = (
        (data_sec.get("pii", {}).get("personal_emails_count", 0)) +
        (data_sec.get("financial", {}).get("cards_detected_count", 0)) +
        (data_sec.get("financial", {}).get("ibans_detected_count", 0)) +
        (data_sec.get("sensitive_data", {}).get("public_auth_data_count", 0))
    )
    if not sensitive_count:
        sensitive_count = sum(1 for e in evidence if e.canonical_category in ("PERSONAL_DATA_EXPOSURE", "FINANCIAL_DATA_EXPOSURE"))

    # Documents & Exports
    docs_count = (
        data_sec.get("documents", {}).get("analyzed_documents_count", 0) or
        data_sec.get("documents", {}).get("exposed_data_files_count", 0)
    )
    if not docs_count:
        docs_count = sum(1 for e in evidence if e.canonical_category == "DOCUMENT_EXPOSURE")

    # Third-party Integrations
    frontend = meta.get("frontend_security") or {}
    tracking = data_sec.get("tracking") or {}
    tp_count = (
        (frontend.get("third_party_scripts_count") or 0) +
        (tracking.get("trackers_detected_count") or 0)
    )

    # Cloud & Infrastructure
    infra = meta.get("infrastructure_security") or {}
    cloud_count = 0
    if infra.get("cloud_provider", {}).get("detected"):
        cloud_count += 1
    cloud_count += len(infra.get("storage", []))

    infra_exposure_count = (
        (1 if infra.get("origin_exposure", {}).get("origin_exposed") else 0) +
        (infra.get("operational_exposure", {}).get("surfaces_count", 0))
    )

    metrics = {
        "public_endpoints": max(len(unique_pages), len(crawled_pages)),
        "api_endpoints": api_count,
        "admin_surfaces": admin_count,
        "auth_surfaces": auth_count,
        "sensitive_data_surfaces": sensitive_count,
        "documents": docs_count,
        "third_party_integrations": tp_count,
        "cloud_components": cloud_count,
        "exposed_infrastructure": infra_exposure_count,
    }

    # 2. Exposure Concentration Analysis
    domain_counts: Dict[str, int] = defaultdict(int)
    for e in evidence:
        cat = e.canonical_category
        if cat in ("API_SURFACE",):
            domain_counts["API Surface"] += 1
        elif cat in ("ADMIN_SURFACE",):
            domain_counts["Administrative Interfaces"] += 1
        elif cat in ("AUTHENTICATION_SURFACE",):
            domain_counts["Authentication & Identity"] += 1
        elif cat in ("PERSONAL_DATA_EXPOSURE", "FINANCIAL_DATA_EXPOSURE", "DOCUMENT_EXPOSURE"):
            domain_counts["Data & Document Exposure"] += 1
        elif cat in ("ORIGIN_EXPOSURE", "CLOUD_STORAGE_EXPOSURE", "INTERNAL_TOPOLOGY_EXPOSURE"):
            domain_counts["Infrastructure & Origin"] += 1
        elif cat in ("DEVELOPMENT_ARTIFACT",):
            domain_counts["Development & Build Artifacts"] += 1
        elif cat in ("TRACKING_SURFACE",):
            domain_counts["Tracking & Governance"] += 1
        elif cat in ("TRANSPORT_SECURITY", "SECURITY_HEADERS"):
            domain_counts["Transport & Headers"] += 1

    total_ev = len(evidence)
    concentration_detected = False
    concentrated_domain = None
    concentration_pct = 0.0
    concentration_msg = "Findings are evenly distributed across analyzed attack surfaces."

    if total_ev >= 3:
        for d_name, count in domain_counts.items():
            pct = round((count / total_ev) * 100, 1)
            if pct >= 35.0 and count >= 3:
                concentration_detected = True
                concentrated_domain = d_name
                concentration_pct = pct
                concentration_msg = (
                    f"Security observations show a significant concentration in {d_name} "
                    f"({count} findings, {pct}% of total), indicating that architectural hardening "
                    f"in this domain will deliver the greatest defensive impact."
                )
                break

    concentration_data = {
        "concentration_detected": concentration_detected,
        "concentrated_domain": concentrated_domain,
        "concentration_percentage": concentration_pct,
        "message": concentration_msg,
        "domain_distribution": dict(sorted(domain_counts.items(), key=lambda x: -x[1])),
    }

    # 3. High-Attention Assets Identification
    asset_groups: Dict[str, List[SecurityEvidence]] = defaultdict(list)
    for e in evidence:
        key = e.asset or e.url
        if key:
            asset_groups[key].append(e)

    severity_weights = {"critical": 10, "high": 5, "medium": 2, "low": 1, "info": 0}
    ranked_assets: List[Dict[str, Any]] = []

    for asset_name, items in asset_groups.items():
        total_weight = sum(severity_weights.get(i.severity, 0) for i in items)
        highest_sev = "info"
        for s in ("critical", "high", "medium", "low"):
            if any(i.severity == s for i in items):
                highest_sev = s
                break

        categories = sorted(list(set(i.canonical_category for i in items)))
        phases = sorted(list(set(i.source_phase for i in items)))

        # Clean display label
        disp_label = asset_name
        if len(disp_label) > 50:
            disp_label = "..." + disp_label[-47:]

        ranked_assets.append({
            "asset": asset_name,
            "display_label": disp_label,
            "findings_count": len(items),
            "highest_severity": highest_sev,
            "categories": categories,
            "source_phases": phases,
            "risk_score_weight": total_weight,
            "sample_finding": items[0].title,
        })

    # Sort assets by risk score weight then finding count
    ranked_assets.sort(key=lambda a: (-a["risk_score_weight"], -a["findings_count"], a["asset"]))
    high_attention_assets = ranked_assets[:max_assets]

    return {
        "metrics": metrics,
        "exposure_concentration": concentration_data,
        "high_attention_assets_count": len(high_attention_assets),
        "high_attention_assets": high_attention_assets,
    }
