"""
Scanly Scanner Engine - Phase F8 Remediation Prioritization & Roadmap Engine
Calculates deterministic remediation priority scores, synthesizes root-cause-first actions,
and organizes findings into a phased Security Improvement Roadmap.
"""
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field

from .finding_normalizer import SecurityEvidence


@dataclass
class PriorityAction:
    """Represents a prioritized security improvement action."""
    action_id: str
    title: str
    reason: str
    priority: str  # IMMEDIATE, HIGH_PRIORITY, NORMAL, IMPROVEMENT
    confidence: str  # HIGH, MEDIUM, LOW
    affected_findings: List[str]
    affected_assets: List[str]
    article_slug: Optional[str] = None
    estimated_minutes: int = 30
    priority_score: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action_id": self.action_id,
            "title": self.title,
            "reason": self.reason,
            "priority": self.priority,
            "confidence": self.confidence,
            "affected_findings": self.affected_findings,
            "affected_assets": self.affected_assets,
            "article_slug": self.article_slug,
            "estimated_minutes": self.estimated_minutes,
            "priority_score": self.priority_score,
        }


# Mapping of canonical / check types to published educational blog slugs
ARTICLE_SLUG_MAP = {
    "DEEP_RISK_CHAIN_PUBLIC_API_DATA": "api-data-exposure",
    "DEEP_RISK_CHAIN_ADMIN_AUTH": "admin-portal-security",
    "DEEP_RISK_CHAIN_ORIGIN_BYPASS": "origin-ip-protection",
    "DEEP_RISK_CHAIN_FRONTEND_SECRET": "frontend-api-key-exposure",
    "DEEP_RISK_CHAIN_FRONTEND_INTERNAL_DISCLOSURE": "javascript-source-map-security",
    "DEEP_RISK_CHAIN_PUBLIC_CLOUD_DATA": "cloud-storage-bucket-security",
    "DEEP_RISK_CHAIN_PII_PROPAGATION": "referrer-policy-pii-leakage",
    "DEEP_RISK_CHAIN_TRACKING_DATA_COLLECTION": "session-recording-pii-masking",
    "DEEP_RISK_CHAIN_PUBLIC_DOCUMENT_DATA": "document-metadata-sanitization",
    "DEEP_RISK_CHAIN_LOG_AUTH_DATA": "log-file-exposure-hardening",
    "DEEP_RISK_CHAIN_DEVELOPMENT_EXPOSURE": "production-build-artifact-hardening",
    "DEEP_RISK_CHAIN_DOCUMENTED_DATA_SURFACE": "api-documentation-security",
    "DEEP_RISK_CHAIN_AUTH_TRANSPORT": "hsts-preload-transport-security",
    "DEEP_RISK_CHAIN_TRACKING_GOVERNANCE": "consent-management-compliance-guide",
    # Root causes
    "EXPOSED_DEVELOPMENT_ARTIFACT": "production-build-artifact-hardening",
    "PUBLIC_DEBUG_CONFIGURATION": "disable-production-debug-mode",
    "WEAK_SECURITY_HEADERS": "http-security-headers-guide",
    "WEAK_AUTHENTICATION_POSTURE": "cookie-security-flags-httponly-secure",
    "PUBLIC_ADMIN_SURFACE": "admin-portal-security",
    "SENSITIVE_DATA_DISCLOSURE": "api-data-exposure",
    "ORIGIN_EXPOSURE": "origin-ip-protection",
    "PUBLIC_API_SURFACE": "rest-api-security-best-practices",
    "EXCESSIVE_DATA_EXPOSURE": "data-minimization-best-practices",
    "OUTDATED_SECURITY_CONFIGURATION": "https-vs-ssl-vs-tls-difference",
    "CLOUD_STORAGE_MISCONFIGURATION": "cloud-storage-bucket-security",
}


def analyze_remediation(
    evidence_list: List[SecurityEvidence],
    risk_chains: Optional[List[Dict[str, Any]]] = None,
    root_causes: Optional[List[Dict[str, Any]]] = None,
    max_priority_actions: int = 15,
) -> Dict[str, Any]:
    """
    Computes priority actions, organizes findings into thematic groups,
    and maps them into a 4-tier remediation roadmap.
    """
    chains = risk_chains or []
    rcs = root_causes or []

    actions: List[PriorityAction] = []
    seen_action_ids: Set[str] = set()

    # 1. Generate Priority Actions from Root Causes First
    for rc in rcs:
        rc_id = rc["id"]
        findings_count = rc.get("findings_count", 0)
        sev = rc.get("severity", "medium").lower()

        # Score calculation: severity weight + finding count bonus
        sev_weight = 40 if sev == "critical" else (30 if sev == "high" else 15)
        score = sev_weight + min(findings_count * 5, 30)

        # Priority tier
        if sev == "critical" or (sev == "high" and findings_count >= 3):
            prio = "IMMEDIATE"
        elif sev == "high" or findings_count >= 2:
            prio = "HIGH_PRIORITY"
        elif sev == "medium":
            prio = "NORMAL"
        else:
            prio = "IMPROVEMENT"

        action_id = f"act_rc_{rc_id.lower()}"
        if action_id not in seen_action_ids:
            seen_action_ids.add(action_id)
            actions.append(PriorityAction(
                action_id=action_id,
                title=f"Address Root Cause: {rc['title']}",
                reason=f"Addresses {findings_count} correlated observations with a single architectural remediation.",
                priority=prio,
                confidence=rc.get("confidence", "HIGH"),
                affected_findings=rc.get("affected_findings", [])[:5],
                affected_assets=rc.get("affected_assets", [])[:3],
                article_slug=ARTICLE_SLUG_MAP.get(rc_id),
                estimated_minutes=45,
                priority_score=score,
            ))

    # 2. Generate Priority Actions from High-Severity Risk Chains
    for ch in chains:
        ch_id = ch["chain_id"]
        ch_type = ch.get("check_type", "")
        sev = ch.get("severity", "medium").lower()
        if sev in ("critical", "high"):
            score = 50 if sev == "critical" else 35
            prio = "IMMEDIATE" if sev == "critical" else "HIGH_PRIORITY"
            act_id = f"act_{ch_id}"
            if act_id not in seen_action_ids:
                seen_action_ids.add(act_id)
                actions.append(PriorityAction(
                    action_id=act_id,
                    title=f"Break Attack Chain: {ch['title'].replace('Correlated Risk Chain: ', '')}",
                    reason="Disrupts compounding multi-phase security relationship across affected assets.",
                    priority=prio,
                    confidence=ch.get("confidence", "HIGH"),
                    affected_findings=ch.get("evidence_findings", [])[:5],
                    affected_assets=ch.get("affected_assets", [])[:3],
                    article_slug=ARTICLE_SLUG_MAP.get(ch_type.upper()),
                    estimated_minutes=60,
                    priority_score=score,
                ))

    # 3. Generate Actions for Unlinked High-Impact Individual Findings
    for e in evidence_list:
        if e.severity in ("critical", "high") and not any(e.finding_id in a.affected_findings for a in actions):
            act_id = f"act_ev_{e.check_type}"
            if act_id not in seen_action_ids:
                seen_action_ids.add(act_id)
                actions.append(PriorityAction(
                    action_id=act_id,
                    title=f"Remediate: {e.title}",
                    reason=f"High-severity observation in {e.category} affecting {e.asset or 'target'}.",
                    priority="IMMEDIATE" if e.severity == "critical" else "HIGH_PRIORITY",
                    confidence=e.confidence,
                    affected_findings=[e.finding_id],
                    affected_assets=[e.asset] if e.asset else [],
                    article_slug=None,
                    estimated_minutes=30,
                    priority_score=40 if e.severity == "critical" else 25,
                ))

    # Sort actions deterministically by priority score
    prio_order = {"IMMEDIATE": 0, "HIGH_PRIORITY": 1, "NORMAL": 2, "IMPROVEMENT": 3}
    actions.sort(key=lambda a: (prio_order.get(a.priority, 4), -a.priority_score, a.action_id))
    selected_actions = actions[:max_priority_actions]

    # 4. Synthesize Thematic Remediation Groups
    theme_buckets: Dict[str, List[Dict[str, Any]]] = {
        "Security Headers": [],
        "Authentication & Session": [],
        "Administrative Surfaces": [],
        "API Security": [],
        "Frontend & JavaScript": [],
        "Infrastructure & Cloud": [],
        "Data & Privacy Exposure": [],
        "Build & Deployment": [],
    }

    for e in evidence_list:
        ed = e.to_dict()
        canon = e.canonical_category
        if canon in ("SECURITY_HEADERS", "TRANSPORT_SECURITY"):
            theme_buckets["Security Headers"].append(ed)
        elif canon in ("AUTHENTICATION_SURFACE",):
            theme_buckets["Authentication & Session"].append(ed)
        elif canon in ("ADMIN_SURFACE",):
            theme_buckets["Administrative Surfaces"].append(ed)
        elif canon in ("API_SURFACE",):
            theme_buckets["API Security"].append(ed)
        elif canon in ("DEVELOPMENT_ARTIFACT",) and "source_map" in e.check_type:
            theme_buckets["Frontend & JavaScript"].append(ed)
        elif canon in ("ORIGIN_EXPOSURE", "CLOUD_STORAGE_EXPOSURE", "INTERNAL_TOPOLOGY_EXPOSURE"):
            theme_buckets["Infrastructure & Cloud"].append(ed)
        elif canon in ("PERSONAL_DATA_EXPOSURE", "FINANCIAL_DATA_EXPOSURE", "TRACKING_SURFACE", "DOCUMENT_EXPOSURE"):
            theme_buckets["Data & Privacy Exposure"].append(ed)
        elif canon in ("DEVELOPMENT_ARTIFACT",):
            theme_buckets["Build & Deployment"].append(ed)

    remediation_groups = {k: v[:5] for k, v in theme_buckets.items() if v}

    # 5. Build 4-Tier Remediation Roadmap
    roadmap = {
        "immediate": [a.to_dict() for a in selected_actions if a.priority == "IMMEDIATE"],
        "short_term": [a.to_dict() for a in selected_actions if a.priority == "HIGH_PRIORITY"],
        "medium_term": [a.to_dict() for a in selected_actions if a.priority == "NORMAL"],
        "long_term": [a.to_dict() for a in selected_actions if a.priority == "IMPROVEMENT"],
    }

    return {
        "priority_actions": [a.to_dict() for a in selected_actions],
        "priority_actions_count": len(selected_actions),
        "roadmap": roadmap,
        "remediation_groups": remediation_groups,
    }
