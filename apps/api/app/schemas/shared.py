"""
Scanly API - Report, Alert, Billing, Agency, Admin & Auth Schemas
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ==========================================
# Auth & User Schemas
# ==========================================
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    firebase_uid: str
    email: str
    name: Optional[str] = None
    role: str
    organization_id: Optional[uuid.UUID] = None
    avatar_url: Optional[str] = None
    is_active: bool
    notification_preferences: Optional[Dict[str, Any]] = None
    created_at: datetime


class NotificationPreferencesUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email_alerts: Optional[bool] = None
    weekly_digest: Optional[bool] = None
    ssl_expiry: Optional[bool] = None
    score_drop: Optional[bool] = None
    critical_finding: Optional[bool] = None


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str
    owner_id: Optional[uuid.UUID] = None
    logo_url: Optional[str] = None
    brand_name: Optional[str] = None
    primary_color: Optional[str] = None
    footer_text: Optional[str] = None
    created_at: datetime


# ==========================================
# Report Schemas
# ==========================================
class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    scan_id: uuid.UUID
    website_id: Optional[uuid.UUID] = None
    report_number: str
    pdf_path: str
    file_size_bytes: Optional[int] = None
    created_at: datetime


# ==========================================
# Alert Schemas
# ==========================================
class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    website_id: Optional[uuid.UUID] = None
    scan_id: Optional[uuid.UUID] = None
    type: str
    severity: str
    title: str
    message: str
    status: str
    sent_at: Optional[datetime] = None
    created_at: datetime


class AlertUpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(unread|read|dismissed)$")


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime


# ==========================================
# Billing & Subscription Schemas
# ==========================================
class CreateCheckoutRequest(BaseModel):
    plan: str = Field(..., pattern="^(basic|pro|agency)$")
    interval: str = Field("month", pattern="^(month|year|monthly|yearly)$")
    currency: Optional[str] = Field("inr", pattern="^(inr|usd)$")
    provider: Optional[str] = Field(None, pattern="^(razorpay|stripe)$")
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: Optional[str] = None
    session_id: Optional[str] = None
    provider: str = "razorpay"
    subscription_id: Optional[str] = None
    key_id: Optional[str] = None
    amount: Optional[int] = None
    currency: Optional[str] = None
    plan: Optional[str] = None
    interval: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


class VerifyPaymentResponse(BaseModel):
    status: str
    plan: str
    is_active: bool
    subscription_id: str


class CancelSubscriptionRequest(BaseModel):
    cancel_at_period_end: bool = True


class CancelSubscriptionResponse(BaseModel):
    status: str
    message: str
    cancel_at_period_end: bool


class CustomerPortalResponse(BaseModel):
    portal_url: str


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plan: str
    status: str
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    max_websites: int
    max_scans_per_month: int
    used_scans: int = 0
    used_websites: int = 0
    provider: Optional[str] = "stripe"
    currency: Optional[str] = "usd"
    amount_cents: Optional[int] = None
    billing_interval: Optional[str] = "month"
    razorpay_subscription_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None


class PaymentTransactionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    provider: str
    provider_payment_id: str
    provider_subscription_id: Optional[str] = None
    amount: int
    currency: str
    status: str
    plan: Optional[str] = None
    billing_interval: Optional[str] = None
    payment_method: Optional[str] = None
    invoice_url: Optional[str] = None
    receipt_url: Optional[str] = None


class PaymentHistoryResponse(BaseModel):
    items: List[PaymentTransactionItem]
    total: int


# ==========================================
# Agency & Team Schemas
# ==========================================
class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: str = Field("member", pattern="^(admin|member|viewer)$")


class TeamMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    name: Optional[str] = None
    role: str
    created_at: datetime


class WhiteLabelSettingsUpdate(BaseModel):
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    footer_text: Optional[str] = None


# ==========================================
# CMS, Support & Contact Schemas
# ==========================================
class BlogCategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)


class BlogCategoryUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)


class BlogCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    created_at: datetime


# ==========================================
# Blog Author & Tag Schemas (Phase E5)
# ==========================================
class BlogAuthorCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = None
    avatar_url: Optional[str] = Field(None, max_length=500)
    user_id: Optional[uuid.UUID] = None


class BlogAuthorUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = None
    avatar_url: Optional[str] = Field(None, max_length=500)
    user_id: Optional[uuid.UUID] = None


class BlogAuthorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None


class BlogTagCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)


class BlogTagUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)


class BlogTagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    post_count: Optional[int] = None
    created_at: Optional[datetime] = None


# ==========================================
# Media Asset Schemas
# ==========================================
class MediaAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    original_filename: str
    storage_key: str
    public_url: str
    mime_type: str
    file_size: int
    width: int
    height: int
    alt_text: Optional[str] = None
    caption: Optional[str] = None
    checksum: Optional[str] = None
    checksum_sha256: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class MediaAssetUpdateRequest(BaseModel):
    alt_text: Optional[str] = Field(None, max_length=500)
    caption: Optional[str] = None


class MediaAssetListResponse(BaseModel):
    items: List[MediaAssetResponse]
    total: int
    page: int
    page_size: int
    pages: int


class BlogPostFAQCreateRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    answer: str = Field(..., min_length=1)
    display_order: int = 0


class BlogPostFAQResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    blog_post_id: uuid.UUID
    question: str
    answer: str
    display_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class BlogRedirectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    blog_post_id: uuid.UUID
    old_slug: str
    target_slug: str
    status_code: int
    created_at: datetime


class BlogPostSitemapItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    published_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    featured_image: Optional[str] = None
    featured_media_url: Optional[str] = None


class BlogPostSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    slug: str
    excerpt: str
    published_at: Optional[datetime] = None
    category: Optional[BlogCategoryResponse] = None
    featured_image: Optional[str] = None
    featured_media: Optional[MediaAssetResponse] = None
    author: Optional[BlogAuthorResponse] = None
    tags: Optional[List[BlogTagResponse]] = None
    is_featured: bool = False


class BlogPostCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255)
    excerpt: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    category_id: Optional[uuid.UUID] = None
    author_id: Optional[uuid.UUID] = None
    tag_ids: Optional[List[uuid.UUID]] = None
    is_featured: bool = False
    featured_image: Optional[str] = Field(None, max_length=500)
    featured_media_id: Optional[uuid.UUID] = None
    seo_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=500)
    canonical_url: Optional[str] = Field(None, max_length=500)
    og_image: Optional[str] = Field(None, max_length=500)
    status: str = Field("draft", pattern=r"^(draft|published|scheduled|archived)$")
    published_at: Optional[datetime] = None
    faqs: Optional[List[BlogPostFAQCreateRequest]] = None


class BlogPostUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255)
    excerpt: Optional[str] = None
    content: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    author_id: Optional[uuid.UUID] = None
    tag_ids: Optional[List[uuid.UUID]] = None
    is_featured: Optional[bool] = None
    featured_image: Optional[str] = Field(None, max_length=500)
    featured_media_id: Optional[uuid.UUID] = None
    seo_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=500)
    canonical_url: Optional[str] = Field(None, max_length=500)
    og_image: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, pattern=r"^(draft|published|scheduled|archived)$")
    published_at: Optional[datetime] = None
    faqs: Optional[List[BlogPostFAQCreateRequest]] = None


class BlogPostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    slug: str
    excerpt: str
    content: str
    category_id: Optional[uuid.UUID] = None
    category: Optional[BlogCategoryResponse] = None
    author_id: Optional[uuid.UUID] = None
    author: Optional[BlogAuthorResponse] = None
    tags: List[BlogTagResponse] = []
    is_featured: bool = False
    featured_image: Optional[str] = None
    featured_media_id: Optional[uuid.UUID] = None
    featured_media: Optional[MediaAssetResponse] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    canonical_url: Optional[str] = None
    og_image: Optional[str] = None
    status: str
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    faqs: Optional[List[BlogPostFAQResponse]] = None
    related_posts: Optional[List[BlogPostSummaryResponse]] = None


class BlogPostListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[BlogPostResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    priority: str = "normal"


class SupportTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subject: str
    message: str
    status: str
    priority: str
    created_at: datetime


class ContactMessageCreate(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str


# ==========================================
# Admin Metrics Schema
# ==========================================
class AdminMetricsResponse(BaseModel):
    total_users: int
    active_users: int
    paid_users: int
    total_websites: int
    total_scans: int
    scan_success_rate: float
    recent_scans_count: int
    unread_tickets_count: int


# ==========================================
# Phase E7: Resources Schemas
# ==========================================
class ResourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    slug: str
    description: str
    resource_type: str
    category: Optional[str] = None
    featured_image: Optional[str] = None
    featured_media_id: Optional[uuid.UUID] = None
    featured_media: Optional[MediaAssetResponse] = None
    file_url: Optional[str] = None
    external_url: Optional[str] = None
    content: Optional[str] = None
    status: str
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ResourceCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    description: str = Field(..., min_length=1)
    resource_type: str = Field(..., max_length=50)  # guide, checklist, template, tool, ebook, pdf
    category: Optional[str] = Field(None, max_length=100)
    featured_image: Optional[str] = Field(None, max_length=500)
    featured_media_id: Optional[uuid.UUID] = None
    file_url: Optional[str] = Field(None, max_length=500)
    external_url: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    status: Optional[str] = Field("draft", max_length=50)


class ResourceUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    resource_type: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=100)
    featured_image: Optional[str] = Field(None, max_length=500)
    featured_media_id: Optional[uuid.UUID] = None
    file_url: Optional[str] = Field(None, max_length=500)
    external_url: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    status: Optional[str] = Field(None, max_length=50)


class ResourceListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[ResourceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ResourceSitemapItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    published_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ==========================================
# Phase E7: Newsletter Schemas
# ==========================================
class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    source: Optional[str] = Field("blog", max_length=100)


class NewsletterUnsubscribeRequest(BaseModel):
    email: EmailStr


class NewsletterSubscriberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    status: str
    source: str
    subscribed_at: datetime
    unsubscribed_at: Optional[datetime] = None
    created_at: datetime


class NewsletterSubscriberListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[NewsletterSubscriberResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==========================================
# Phase E7: Content Analytics Schemas
# ==========================================
class ContentAnalyticsEventCreate(BaseModel):
    event_name: str = Field(..., max_length=100)
    content_type: Optional[str] = Field(None, max_length=50)
    content_id: Optional[str] = Field(None, max_length=255)
    path: Optional[str] = Field(None, max_length=500)
    referrer: Optional[str] = Field(None, max_length=500)
    source: Optional[str] = Field(None, max_length=100)
    campaign: Optional[str] = Field(None, max_length=100)


class TopContentMetric(BaseModel):
    content_id: str
    content_type: str
    views: int


class ContentAnalyticsSummaryResponse(BaseModel):
    time_window_days: int
    total_article_views: int
    total_resource_views: int
    total_cta_clicks: int
    total_newsletter_signups: int
    top_articles: List[TopContentMetric]
    top_resources: List[TopContentMetric]


# ==========================================
# Phase D3: Documentation Feedback Schemas
# ==========================================
class DocFeedbackCreateRequest(BaseModel):
    article_slug: str = Field(..., max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    helpful: bool
    reason: Optional[str] = Field(
        None,
        max_length=50,
        pattern=r"^(unclear|missing_example|outdated|instructions_failed|other)$",
    )
    path: Optional[str] = Field(None, max_length=500)


class DocFeedbackResponse(BaseModel):
    status: str
    message: str
    helpful: bool

