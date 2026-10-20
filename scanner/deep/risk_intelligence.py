"""
Scanly Scanner Engine - Phase F8 Security Correlation, Attack-Surface Risk Graph & Executive Posture
Master orchestrator integrating normalization, graph modeling, attack surface metrics,
risk chain analysis, root cause grouping, and executive posture synthesis.
"""
from typing import List, Dict, Any, Optional, Tuple

from scanner.models import Finding
from .config import DeepScanConfig
from .finding_normalizer import normalize_findings, SecurityEvidence
from .risk_graph import build_security_graph
from .attack_surface_graph import calculate_attack_surface
from .risk_chain_analyzer import analyze_risk_chains
from .root_cause_analyzer import analyze_root_causes
from .remediation_analyzer import analyze_remediation
from .posture_analyzer import analyze_executive_posture


def analyze_risk_intelligence(
    findings: List[Finding],
    crawled_pages: Optional[List[Any]] = None,
    scan_metadata: Optional[Dict[str, Any]] = None,
    config: Optional[DeepScanConfig] = None,
    score: int = 100,
    risk_level: str = "Good",
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Executes the complete Phase F8 intelligence layer across phases F1–F7:
    - Normalizes evidence and identifies originating phases.
    - Generates bounded Security Relationship Graph.
    - Computes attack-surface inventory & exposure concentration.
    - Identifies compound security risk chains.
    - Synthesizes systemic root-cause groupings.
    - Produces a prioritized remediation roadmap.
    - Compiles executive security posture and surfaces positive defensive signals.
    """
    cfg = config or DeepScanConfig()
    pages = crawled_pages or []
    meta = scan_metadata or {}

    if not getattr(cfg, "enable_f8_risk_intelligence", True) or not getattr(cfg, "check_risk_intelligence", True):
        return {
            "status": "disabled",
            "deep_scan_version": 8,
            "executive_posture": {"overall_score": score, "risk_level": risk_level, "score_explanation": "Risk intelligence disabled by configuration.", "posture_dimensions": {}, "positive_signals": [], "limitations": []},
            "attack_surface": {"metrics": {}, "exposure_concentration": {}, "high_attention_assets": [], "high_attention_assets_count": 0},
            "risk_chains": [],
            "risk_chains_count": 0,
            "root_causes": [],
            "root_causes_count": 0,
            "priority_actions": [],
            "priority_actions_count": 0,
            "remediation_roadmap": {},
            "remediation_groups": {},
            "graph": {"nodes": [], "edges": [], "node_count": 0, "edge_count": 0, "graph_truncated": False},
            "positive_signals": [],
            "score_context": {"score": score, "risk_level": risk_level, "explanation": "Risk intelligence disabled by configuration."},
            "errors": None,
        }, []

    max_findings = getattr(cfg, "max_f8_findings", 500)
    max_nodes = getattr(cfg, "max_graph_nodes", 250)
    max_edges = getattr(cfg, "max_graph_edges", 500)
    max_chains = getattr(cfg, "max_f8_risk_chains", 25)
    max_root_causes = getattr(cfg, "max_f8_root_causes", 25)
    max_assets = getattr(cfg, "max_f8_assets", 100)
    max_actions = getattr(cfg, "max_priority_actions", 15)

    status = "completed"
    error_notes: List[str] = []

    # 1. Normalization
    try:
        evidence_list = normalize_findings(findings, meta, max_findings=max_findings)
    except Exception as exc:
        status = "partial"
        error_notes.append(f"Normalization error: {str(exc)}")
        evidence_list = []

    # 2. Security Relationship Graph
    try:
        graph_data = build_security_graph(evidence_list, meta, max_nodes=max_nodes, max_edges=max_edges)
    except Exception as exc:
        status = "partial"
        error_notes.append(f"Graph construction error: {str(exc)}")
        graph_data = {"nodes": [], "edges": [], "node_count": 0, "edge_count": 0, "graph_truncated": False}

    # 3. Attack Surface & High-Attention Assets
    try:
        attack_surface_data = calculate_attack_surface(pages, meta, evidence_list, max_assets=max_assets)
    except Exception as exc:
        status = "partial"
        error_notes.append(f"Attack surface error: {str(exc)}")
        attack_surface_data = {"metrics": {}, "exposure_concentration": {}, "high_attention_assets": [], "high_attention_assets_count": 0}

    # 4. Risk Chains Analysis
    chain_findings: List[Finding] = []
    try:
        risk_chains_data, chain_findings = analyze_risk_chains(evidence_list, meta, max_chains=max_chains)
    except Exception as exc:
        status = "partial"
        error_notes.append(f"Risk chain analysis error: {str(exc)}")
        risk_chains_data = []

    # 5. Root Cause Grouping
    try:
        root_causes_data = analyze_root_causes(evidence_list, max_root_causes=max_root_causes)
    except Exception as exc:
        status = "partial"
        error_notes.append(f"Root cause analysis error: {str(exc)}")
        root_causes_data = []

    # 6. Remediation Roadmap & Thematic Groups
    try:
        remediation_data = analyze_remediation(evidence_list, risk_chains_data, root_causes_data, max_priority_actions=max_actions)
    except Exception as exc:
        status = "partial"
        error_notes.append(f"Remediation analysis error: {str(exc)}")
        remediation_data = {"priority_actions": [], "priority_actions_count": 0, "roadmap": {}, "remediation_groups": {}}

    # 7. Executive Posture & Score Context
    try:
        posture_data = analyze_executive_posture(score, risk_level, evidence_list, meta, risk_chains_data, root_causes_data)
    except Exception as exc:
        status = "partial"
        error_notes.append(f"Executive posture error: {str(exc)}")
        posture_data = {"overall_score": score, "risk_level": risk_level, "score_explanation": "", "posture_dimensions": {}, "positive_signals": [], "limitations": []}

    # Compile compact telemetry for scan_metadata["risk_intelligence"]
    risk_intelligence_data: Dict[str, Any] = {
        "status": status,
        "deep_scan_version": 8,
        "executive_posture": posture_data,
        "attack_surface": attack_surface_data,
        "risk_chains": risk_chains_data,
        "risk_chains_count": len(risk_chains_data),
        "root_causes": root_causes_data,
        "root_causes_count": len(root_causes_data),
        "priority_actions": remediation_data.get("priority_actions", []),
        "priority_actions_count": remediation_data.get("priority_actions_count", 0),
        "remediation_roadmap": remediation_data.get("roadmap", {}),
        "remediation_groups": remediation_data.get("remediation_groups", {}),
        "graph": graph_data,
        "positive_signals": posture_data.get("positive_signals", []),
        "score_context": {
            "score": score,
            "risk_level": risk_level,
            "explanation": posture_data.get("score_explanation", ""),
        },
        "errors": error_notes if error_notes else None,
    }

    return risk_intelligence_data, chain_findings
