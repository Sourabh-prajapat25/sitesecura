"""
Scanly API - AI Schemas & Validation Models
Validates user requests and guarantees consistent API responses.
"""
import uuid
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class ExplainFindingRequest(BaseModel):
    scan_id: uuid.UUID
    check_id: uuid.UUID
    mode: str = Field(default="standard", description="standard | business | technical | developer")


class FixGuideRequest(BaseModel):
    scan_id: uuid.UUID
    check_id: uuid.UUID
    target_env: Optional[str] = Field(default=None, description="e.g. nginx, apache, cloudflare, express, generic")


class SecuritySummaryRequest(BaseModel):
    scan_id: uuid.UUID


class SecurityPlanRequest(BaseModel):
    scan_id: uuid.UUID


class AiChatRequest(BaseModel):
    scan_id: uuid.UUID
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_history: Optional[List[Dict[str, str]]] = None


class AIResponseModel(BaseModel):
    content: str
    structured_data: Optional[Dict[str, Any]] = None
    provider_used: str
    model_used: str
    fallback_used: bool = False
    latency_ms: int = 0
    cached: bool = False


class AiUsageResponse(BaseModel):
    plan: str
    used: int
    limit: int
    remaining: int
    reset_at: str


class AiStatusResponse(BaseModel):
    enabled: bool
    primary_provider: str
    provider_order: List[str]
    models: Dict[str, str]
