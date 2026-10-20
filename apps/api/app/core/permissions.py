"""
Scanly API - Central Plan Matrix & Permission Gates
Defines subscription plan entitlements, quotas, and feature gating.
"""
from enum import Enum
from typing import Dict, Any, Optional
from fastapi import HTTPException, status


class PlanTier(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    AGENCY = "agency"
    ADMIN = "admin"


class UserRole(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    AGENCY = "agency"
    ADMIN = "admin"


class OrgRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


def normalize_plan_name(plan_name: Optional[str]) -> str:
    """Normalizes any incoming plan string into canonical lowercase enum representation."""
    if not plan_name:
        return "free"
    norm = str(plan_name).strip().lower()
    if norm in ("free", "basic", "pro", "agency", "admin"):
        return norm
    # Handle possible variations
    if "agency" in norm:
        return "agency"
    if "pro" in norm:
        return "pro"
    if "basic" in norm:
        return "basic"
    if "admin" in norm:
        return "admin"
    return "free"


# Authoritative Phase B & Phase 3 Plan Limits Matrix
PLAN_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    "free": {
        "name": "Free",
        "max_websites": 1,
        "max_scans_per_month": 10,
        "monitoring_allowed": False,
        "monitoring_frequency": None,
        "pdf_reports": True,  # Free users receive preview/watermarked PDF
        "can_view_full_findings": False,
        "ai_fix_guides": False,
        "ai_security_advisor": False,
        "team_members_allowed": False,
        "max_team_members": 0,
        "white_label": False,
        "bulk_import": False,
        "priority_scanning": False,
        "history_retention_days": 7,
        "deep_scan": False,
        "deep_scan_max_pages": 0,
        "deep_scan_max_depth": 0,
    },
    "basic": {
        "name": "Basic",
        "max_websites": 2,
        "max_scans_per_month": 100,
        "monitoring_allowed": True,
        "monitoring_frequency": "weekly",
        "pdf_reports": True,
        "can_view_full_findings": True,
        "ai_fix_guides": False,
        "ai_security_advisor": False,
        "team_members_allowed": False,
        "max_team_members": 0,
        "white_label": False,
        "bulk_import": False,
        "priority_scanning": False,
        "history_retention_days": 30,
        "deep_scan": False,
        "deep_scan_max_pages": 0,
        "deep_scan_max_depth": 0,
    },
    "pro": {
        "name": "Pro",
        "max_websites": 10,
        "max_scans_per_month": 500,
        "monitoring_allowed": True,
        "monitoring_frequency": "daily",
        "pdf_reports": True,
        "can_view_full_findings": True,
        "ai_fix_guides": True,
        "ai_security_advisor": True,
        "team_members_allowed": True,
        "max_team_members": 3,
        "white_label": False,
        "bulk_import": True,
        "priority_scanning": True,
        "history_retention_days": 90,
        "deep_scan": True,
        "deep_scan_max_pages": 50,
        "deep_scan_max_depth": 2,
    },
    "agency": {
        "name": "Agency",
        "max_websites": 100,
        "max_scans_per_month": 3000,
        "monitoring_allowed": True,
        "monitoring_frequency": "daily",
        "pdf_reports": True,
        "can_view_full_findings": True,
        "ai_fix_guides": True,
        "ai_security_advisor": True,
        "team_members_allowed": True,
        "max_team_members": 15,
        "white_label": True,
        "bulk_import": True,
        "priority_scanning": True,
        "history_retention_days": 365,
        "deep_scan": True,
        "deep_scan_max_pages": 100,
        "deep_scan_max_depth": 2,
    },
    "admin": {
        "name": "Admin",
        "max_websites": 9999,
        "max_scans_per_month": 99999,
        "monitoring_allowed": True,
        "monitoring_frequency": "daily",
        "pdf_reports": True,
        "can_view_full_findings": True,
        "ai_fix_guides": True,
        "ai_security_advisor": True,
        "team_members_allowed": True,
        "max_team_members": 999,
        "white_label": True,
        "bulk_import": True,
        "priority_scanning": True,
        "history_retention_days": 3650,
        "deep_scan": True,
        "deep_scan_max_pages": 100,
        "deep_scan_max_depth": 2,
    },
}


def get_plan_config(plan_name: str) -> Dict[str, Any]:
    """Returns capabilities dictionary for given plan."""
    norm = normalize_plan_name(plan_name)
    return PLAN_CAPABILITIES.get(norm, PLAN_CAPABILITIES["free"])


def can_view_full_findings(plan_name: str) -> bool:
    """True if plan is entitled to view unredacted technical details and remediations."""
    cfg = get_plan_config(plan_name)
    return bool(cfg.get("can_view_full_findings", False))


def can_use_ai_advisor(plan_name: str) -> bool:
    """True if plan is entitled to access AI Security Advisor (Pro, Agency, Admin)."""
    cfg = get_plan_config(plan_name)
    return bool(cfg.get("ai_security_advisor", False))


def can_use_deep_scan(plan_name: str) -> bool:
    """True if plan is entitled to perform Deep Website Security Scans (Pro, Agency, Admin)."""
    cfg = get_plan_config(plan_name)
    return bool(cfg.get("deep_scan", False))


def require_feature(user_role: str, feature_key: str) -> bool:
    """
    Checks if a user role has access to a specific feature.
    Raises HTTPException 403 if unauthorized.
    """
    caps = get_plan_config(user_role)
    val = caps.get(feature_key)
    if not val:
        if feature_key == "ai_security_advisor":
            error_code = "AI_FEATURE_REQUIRED"
            message = (
                "AI Security Advisor is available exclusively on Pro and Agency plans. "
                "Upgrade your subscription to access AI explanations, remediation guides, and security analysis."
            )
        elif feature_key == "deep_scan":
            error_code = "DEEP_SCAN_FEATURE_REQUIRED"
            message = (
                "Deep Website Security Scan is available exclusively on Pro and Agency plans. "
                "Upgrade your subscription to perform deep multi-page crawling, header consistency audits, and attack-surface analysis."
            )
        else:
            error_code = "FEATURE_UPGRADE_REQUIRED"
            message = f"Feature '{feature_key}' requires an upgraded subscription plan."

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": error_code,
                    "feature": feature_key,
                    "message": message,
                }
            },
        )
    return True

