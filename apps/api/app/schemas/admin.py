"""
Scanly API - Admin Schemas
Pydantic schemas for platform administrative management endpoints.
"""
import re
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, ConfigDict


class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    new_users_30d: int
    users_by_plan: Dict[str, int]
    total_organizations: int
    total_websites: int
    monitored_websites: int
    total_scans: int
    scans_today: int
    scans_this_month: int
    scan_success_rate: float
    scans_by_status: Dict[str, int]
    active_subscriptions: int
    total_ai_generations: int
    open_support_tickets: int
    new_contact_messages: int


class AdminUserItem(BaseModel):
    id: uuid.UUID
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool
    organization_id: Optional[uuid.UUID] = None
    organization_name: Optional[str] = None
    plan: str
    websites_count: int
    scans_count: int
    created_at: datetime


class AdminUserDetail(BaseModel):
    id: uuid.UUID
    email: str
    name: Optional[str] = None
    role: str
    is_active: bool
    organization_id: Optional[uuid.UUID] = None
    organization: Optional[Dict[str, Any]] = None
    subscription: Optional[Dict[str, Any]] = None
    usage: Optional[Dict[str, Any]] = None
    websites: List[Dict[str, Any]] = Field(default_factory=list)
    recent_scans: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AdminUserStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


class AdminOrgItem(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    owner_id: Optional[uuid.UUID] = None
    owner_email: Optional[str] = None
    plan: str
    members_count: int
    websites_count: int
    scans_count: int
    ai_requests_count: int
    created_at: datetime


class AdminWebsiteItem(BaseModel):
    id: uuid.UUID
    domain: str
    normalized_domain: str
    organization_id: uuid.UUID
    organization_name: Optional[str] = None
    plan: str
    status: str
    last_scan_score: Optional[int] = None
    last_scan_at: Optional[datetime] = None
    monitoring_enabled: bool = False
    monitoring_frequency: Optional[str] = None
    scans_count: int = 0
    created_at: datetime


class AdminScanItem(BaseModel):
    id: uuid.UUID
    domain: str
    organization_id: uuid.UUID
    organization_name: Optional[str] = None
    status: str
    score: Optional[int] = None
    risk_level: Optional[str] = None
    scan_duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    safe_error_code: Optional[str] = None
    findings_count: int = 0
    critical_count: int = 0
    high_count: int = 0
    created_at: datetime


class AdminSubscriptionItem(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    plan: str
    status: str
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    scans_used: int = 0
    scans_limit: int = 10
    created_at: datetime


class AdminPlanOverrideRequest(BaseModel):
    organization_id: uuid.UUID
    new_plan: str  # free, basic, pro, agency
    reason: str  # Mandatory audit justification


class AdminSupportTicketItem(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    organization_id: Optional[uuid.UUID] = None
    subject: str
    message: str
    status: str  # open, pending, closed
    priority: str  # low, normal, high, urgent
    created_at: datetime
    updated_at: datetime


class AdminSupportTicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


class AdminContactItem(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    subject: str
    message: str
    status: str  # new, reviewed, resolved
    created_at: datetime


class AdminContactUpdate(BaseModel):
    status: Optional[str] = None


class AdminAuditLogItem(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    organization_id: Optional[uuid.UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime


class AdminSystemHealth(BaseModel):
    database: Dict[str, Any]
    redis: Dict[str, Any]
    celery: Dict[str, Any]
    ai_providers: Dict[str, Any]
    api: Dict[str, Any]


class AdminAnalyticsResponse(BaseModel):
    users_growth: List[Dict[str, Any]]
    scans_timeline: List[Dict[str, Any]]
    plan_distribution: Dict[str, int]
    ai_metrics: Dict[str, Any]


class AdminEmailTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recipient_email: str
    template_id: Optional[str] = "welcome"
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None

    @field_validator("recipient_email")
    @classmethod
    def validate_recipient_email(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if not clean:
            raise ValueError("Recipient email address cannot be empty.")
        if "\r" in clean or "\n" in clean:
            raise ValueError("Recipient address contains prohibited newline or carriage return characters.")
        email_regex = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
        if not email_regex.match(clean) or len(clean) > 254:
            raise ValueError(f"Invalid recipient email format: '{clean}'")
        return clean

    @field_validator("custom_subject")
    @classmethod
    def validate_custom_subject(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if "\r" in v or "\n" in v:
                raise ValueError("Subject contains prohibited newline or carriage return characters.")
        return v


class AdminEmailTestResponse(BaseModel):
    success: bool
    status: str
    provider: str
    provider_message_id: Optional[str] = None
    recipient: str
    error: Optional[str] = None
    correlation_id: str
