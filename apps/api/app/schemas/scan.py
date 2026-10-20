"""
Scanly API - Scan Schemas
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class ScanCreateRequest(BaseModel):
    domain: str = Field(..., min_length=3, max_length=255, description="Domain to scan e.g. example.com")
    website_id: Optional[uuid.UUID] = None


class ScanCheckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    check_type: str
    name: str
    status: str
    severity: str
    score_impact: int
    title: str
    summary: str
    why_it_matters: Optional[str] = None
    how_to_fix: Optional[str] = None
    estimated_fix_minutes: int
    documentation_url: Optional[str] = None
    evidence: Optional[str] = None
    confidence: float
    is_locked: bool = False


class ScanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    website_id: Optional[uuid.UUID] = None
    domain: str
    normalized_domain: str
    target_ip: Optional[str] = None
    status: str
    scan_type: str
    score: Optional[int] = None
    risk_level: Optional[str] = None
    score_breakdown: Optional[Dict[str, Any]] = None
    passed_checks_count: int
    total_checks_count: int
    scan_duration_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    checks: List[ScanCheckResponse] = []
    locked_findings_count: int = 0
    is_premium_locked: bool = False
    scan_metadata: Optional[Dict[str, Any]] = None


class PublicScanResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    domain: str
    normalized_domain: str
    status: str
    score: Optional[int] = None
    risk_level: Optional[str] = None
    score_breakdown: Optional[Dict[str, Any]] = None
    passed_checks_count: int
    total_checks_count: int
    scan_duration_ms: Optional[int] = None
    created_at: datetime
    unlocked_findings: List[ScanCheckResponse] = []
    locked_findings_count: int = 0
    is_premium_locked: bool = True
