"""
Scanly API - Website & Monitoring Schemas
"""
import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class WebsiteCreateRequest(BaseModel):
    domain: str = Field(..., min_length=3, max_length=255)
    name: Optional[str] = None
    monitoring_enabled: bool = False
    monitoring_frequency: str = "weekly"


class WebsiteUpdateRequest(BaseModel):
    name: Optional[str] = None
    monitoring_enabled: Optional[bool] = None
    monitoring_frequency: Optional[str] = None


class MonitoringEnableRequest(BaseModel):
    frequency: str = Field(default="weekly", pattern="^(weekly|daily)$")


class MonitoringUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    frequency: Optional[str] = Field(default=None, pattern="^(weekly|daily)$")


class MonitoringResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    website_id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    enabled: bool
    is_active: bool = True
    frequency: str
    status: str = "active"
    last_scan_id: Optional[uuid.UUID] = None
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class WebsiteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    domain: str
    normalized_domain: str
    status: str
    last_scan_id: Optional[uuid.UUID] = None
    last_scan_score: Optional[int] = None
    last_scan_risk: Optional[str] = None
    monitoring_enabled: bool
    monitoring_frequency: Optional[str] = None
    monitoring: Optional[MonitoringResponse] = None
    created_at: datetime
    updated_at: datetime


class BulkImportRowResult(BaseModel):
    domain: str
    name: str
    status: str  # imported, duplicate, invalid, limit_reached
    reason: Optional[str] = None


class BulkImportResponse(BaseModel):
    total_processed: int
    imported_count: int
    skipped_count: int
    results: List[BulkImportRowResult]
