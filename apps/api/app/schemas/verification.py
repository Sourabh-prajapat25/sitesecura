"""
Scanly API - Security Verification & Badge Policy Schemas
"""
import uuid
from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class EligibilityReasonCode(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    WEBSITE_NOT_FOUND = "WEBSITE_NOT_FOUND"
    UNAUTHORIZED_WEBSITE = "UNAUTHORIZED_WEBSITE"
    SCAN_NOT_FOUND = "SCAN_NOT_FOUND"
    SCAN_NOT_COMPLETED = "SCAN_NOT_COMPLETED"
    SCAN_TOO_OLD = "SCAN_TOO_OLD"
    SCAN_COMPLETION_TIME_UNAVAILABLE = "SCAN_COMPLETION_TIME_UNAVAILABLE"
    SCORE_UNAVAILABLE = "SCORE_UNAVAILABLE"
    SCORE_BELOW_THRESHOLD = "SCORE_BELOW_THRESHOLD"
    CRITICAL_FINDING_PRESENT = "CRITICAL_FINDING_PRESENT"
    HIGH_FINDING_PRESENT = "HIGH_FINDING_PRESENT"
    SCAN_WEBSITE_MISMATCH = "SCAN_WEBSITE_MISMATCH"
    DOMAIN_MISMATCH = "DOMAIN_MISMATCH"
    POLICY_NOT_FOUND = "POLICY_NOT_FOUND"
    INVALID_SCAN_DATA = "INVALID_SCAN_DATA"
    MONITORING_REQUIRED = "MONITORING_REQUIRED"


class EligibilityChecks(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    website_exists: bool = False
    authorized_website: bool = False
    scan_exists: bool = False
    scan_completed: bool = False
    scan_recent: bool = False
    score_available: bool = False
    minimum_score: bool = False
    critical_findings: bool = False
    high_findings: bool = False
    website_scan_match: bool = False
    domain_match: bool = False
    monitoring_match: bool = True


class PolicySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    minimum_score: int
    maximum_scan_age_days: int
    verification_validity_days: int
    disallow_critical_findings: bool
    disallow_high_findings: bool
    require_successful_scan: bool
    require_authorized_website: bool
    require_monitoring: bool


class BadgeEligibilityResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    eligible: bool
    website_id: Optional[uuid.UUID] = None
    scan_id: Optional[uuid.UUID] = None
    score: Optional[int] = None
    risk_level: Optional[str] = None
    reasons: List[str] = Field(default_factory=list)
    checks: EligibilityChecks
    policy: PolicySummary
    evaluated_at: datetime


class BadgePolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_active: bool
    minimum_score: int
    maximum_scan_age_days: int
    verification_validity_days: int
    disallow_critical_findings: bool
    disallow_high_findings: bool
    require_successful_scan: bool
    require_authorized_website: bool
    require_monitoring: bool
    created_at: datetime
    updated_at: datetime


class BadgePolicyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    minimum_score: Optional[int] = Field(None, ge=0, le=100, description="Minimum security score between 0 and 100")
    maximum_scan_age_days: Optional[int] = Field(None, gt=0, le=365, description="Maximum scan age in days (must be > 0)")
    verification_validity_days: Optional[int] = Field(None, gt=0, le=365, description="Verification validity in days (must be > 0)")
    disallow_critical_findings: Optional[bool] = None
    disallow_high_findings: Optional[bool] = None
    require_successful_scan: Optional[bool] = None
    require_authorized_website: Optional[bool] = None
    require_monitoring: Optional[bool] = None
    is_active: Optional[bool] = None


class BadgeEmbedSnippets(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    html: str
    markdown: str


class SecurityVerificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    website_id: uuid.UUID
    scan_id: uuid.UUID
    policy_id: Optional[uuid.UUID] = None
    status: str
    public_token: str
    score: int
    risk_level: Optional[str] = None
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    eligibility_reason: Optional[Dict[str, Any]] = None
    monitoring_enabled: bool = False
    badge_settings: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    verification_url: Optional[str] = None
    badge_url: Optional[str] = None
    embed_snippets: Optional[BadgeEmbedSnippets] = None


class WebsiteBadgeStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    website_id: uuid.UUID
    domain: str
    status: str
    public_token: Optional[str] = None
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    verification_url: Optional[str] = None
    badge_url: Optional[str] = None
    embed_snippets: Optional[BadgeEmbedSnippets] = None
    last_scan_id: Optional[uuid.UUID] = None
    score: Optional[int] = None
    risk_level: Optional[str] = None


class BadgeRevocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message: str
    website_id: uuid.UUID
    status: str = "revoked"
    revoked_at: datetime


class PublicVerificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    domain: str
    status: str
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    verification_tier: str = "Security Check Verified"
    badge_url: str
    verification_url: str
    disclaimer: str

