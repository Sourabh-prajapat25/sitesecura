"""
Scanly API - AI Security Advisor Endpoints
Provides authoritative LLM explanations, remediation playbooks, prioritized plans, and chat
strictly scoped to verified tenant scan findings with multi-provider failover.
"""
import uuid
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.core.authorization import (
    AuthContext,
    get_current_auth_context,
    get_tenant_scan,
    get_tenant_website,
)
from app.core.permissions import require_feature, get_plan_config, normalize_plan_name
from app.core.rate_limit import check_rate_limit
from app.models.website import Website
from app.models.scan import Scan, ScanCheck
from app.models.billing import UsageRecord
from app.services.entitlement_service import (
    check_and_reserve_ai_quota,
    refund_ai_quota,
    get_current_usage_period,
)
from app.services.audit_service import record_audit_event
from app.services.ai.orchestrator import orchestrator
from app.services.ai.context_builder import AIContextBuilder
from app.services.ai.prompts import (
    get_explain_finding_prompt,
    get_fix_guide_prompt,
    get_security_summary_prompt,
    get_security_plan_prompt,
    get_chat_prompt,
    SYSTEM_PROMPT_VERSION,
)
from app.services.ai.base import AllProvidersFailedException
from app.schemas.ai import (
    ExplainFindingRequest,
    FixGuideRequest,
    SecuritySummaryRequest,
    SecurityPlanRequest,
    AiChatRequest,
    AIResponseModel,
    AiUsageResponse,
    AiStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Security Advisor"])


def _extract_check(scan: Scan, check_id: uuid.UUID) -> ScanCheck:
    """Finds target check within authoritative scan; raises 404 if missing."""
    for c in (scan.checks or []):
        if c.id == check_id:
            return c
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"error": {"code": "CHECK_NOT_FOUND", "message": f"Security check {check_id} not found in scan."}},
    )


async def _resolve_website_for_scan(scan: Scan, auth: AuthContext, db: AsyncSession) -> Website:
    """Safely retrieves or constructs verified website context for scan."""
    if scan.website_id:
        return await get_tenant_website(scan.website_id, auth, db)
    # Temporary shell for public scan claimed by tenant
    return Website(
        id=uuid.uuid4(),
        organization_id=auth.organization.id,
        domain=scan.domain,
        normalized_domain=scan.normalized_domain,
    )


def _check_ai_enabled():
    """Fails fast if AI Security Advisor is toggled off globally in settings."""
    if not getattr(settings, "AI_ENABLED", True):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AI_FEATURE_DISABLED", "message": "AI Security Advisor is currently disabled."}},
        )


@router.post("/explain-finding", response_model=AIResponseModel)
async def explain_finding(
    request: Request,
    body: ExplainFindingRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Generates structured explanation for a specific verified finding."""
    # 0. Global feature toggle
    _check_ai_enabled()

    # 1. Plan gating (Pro & Agency only)
    require_feature(auth.plan, "ai_security_advisor")

    # 2. Rate limiting
    await check_rate_limit(
        f"ratelimit:ai_user:{auth.user.id}",
        max_requests=settings.AI_RATE_LIMIT_PER_USER,
        window_seconds=60,
    )

    # 3. Tenant resource isolation (404 on cross-tenant access)
    scan = await get_tenant_scan(body.scan_id, auth, db)
    check = _extract_check(scan, body.check_id)
    website = await _resolve_website_for_scan(scan, auth, db)

    # 4. Check cache first before consuming quota
    cached = await orchestrator.get_cached_generation(
        db=db,
        organization_id=auth.organization.id,
        scan_id=scan.id,
        feature_type=f"explain_{body.mode}",
        finding_id=check.id,
    )
    if cached:
        return AIResponseModel(
            content=cached.content,
            structured_data=cached.structured_data,
            provider_used=cached.provider_used,
            model_used=cached.model_used,
            fallback_used=cached.fallback_used,
            latency_ms=cached.latency_ms,
            cached=True,
        )

    # 5. Reserve monthly AI quota
    await check_and_reserve_ai_quota(db, auth.organization.id, auth.plan)

    # 6. Build bounded, injection-defended context
    context_xml = AIContextBuilder.build_scan_context(
        website=website,
        scan=scan,
        target_check=check,
    )
    prompt = get_explain_finding_prompt(context_xml, mode=body.mode)

    # 7. Execute generation through failover chain
    try:
        resp = await orchestrator.generate_with_fallback(
            prompt=prompt,
            feature_type=f"explain_{body.mode}",
            db=db,
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            website_id=website.id,
            scan_id=scan.id,
            finding_id=check.id,
            check_cache=False,  # Already checked above
        )
        await record_audit_event(
            db=db,
            action="AI_EXPLAIN_FINDING",
            entity_type="AI_ADVISOR",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(check.id),
            metadata={"provider": resp.provider_used, "model": resp.model_used, "fallback": resp.fallback_used},
        )
        await db.commit()
        return AIResponseModel(

            content=resp.content,
            structured_data=resp.structured_data,
            provider_used=resp.provider_used,
            model_used=resp.model_used,
            fallback_used=resp.fallback_used,
            latency_ms=resp.latency_ms,
            cached=False,
        )
    except AllProvidersFailedException as err:
        await refund_ai_quota(db, auth.organization.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AI_SERVICE_UNAVAILABLE", "message": err.message}},
        )
    except Exception as err:
        await refund_ai_quota(db, auth.organization.id)
        logger.error(f"Unexpected error in explain_finding: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "AI_GENERATION_FAILED", "message": "Failed to generate security explanation."}},
        )


@router.post("/fix-guide", response_model=AIResponseModel)
async def generate_fix_guide(
    request: Request,
    body: FixGuideRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Generates structured step-by-step remediation guide for a specific finding."""
    _check_ai_enabled()
    require_feature(auth.plan, "ai_security_advisor")

    await check_rate_limit(
        f"ratelimit:ai_user:{auth.user.id}",
        max_requests=settings.AI_RATE_LIMIT_PER_USER,
        window_seconds=60,
    )

    scan = await get_tenant_scan(body.scan_id, auth, db)
    check = _extract_check(scan, body.check_id)
    website = await _resolve_website_for_scan(scan, auth, db)

    cached = await orchestrator.get_cached_generation(
        db=db,
        organization_id=auth.organization.id,
        scan_id=scan.id,
        feature_type=f"fix_guide_{body.target_env or 'default'}",
        finding_id=check.id,
    )
    if cached:
        return AIResponseModel(
            content=cached.content,
            structured_data=cached.structured_data,
            provider_used=cached.provider_used,
            model_used=cached.model_used,
            fallback_used=cached.fallback_used,
            latency_ms=cached.latency_ms,
            cached=True,
        )

    await check_and_reserve_ai_quota(db, auth.organization.id, auth.plan)

    context_xml = AIContextBuilder.build_scan_context(
        website=website,
        scan=scan,
        target_check=check,
    )
    prompt = get_fix_guide_prompt(context_xml, target_env=body.target_env)

    try:
        resp = await orchestrator.generate_with_fallback(
            prompt=prompt,
            feature_type=f"fix_guide_{body.target_env or 'default'}",
            db=db,
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            website_id=website.id,
            scan_id=scan.id,
            finding_id=check.id,
            check_cache=False,
        )
        await record_audit_event(
            db=db,
            action="AI_FIX_GUIDE",
            entity_type="AI_ADVISOR",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(check.id),
            metadata={"provider": resp.provider_used, "model": resp.model_used, "fallback": resp.fallback_used},
        )
        await db.commit()
        return AIResponseModel(

            content=resp.content,
            structured_data=resp.structured_data,
            provider_used=resp.provider_used,
            model_used=resp.model_used,
            fallback_used=resp.fallback_used,
            latency_ms=resp.latency_ms,
            cached=False,
        )
    except AllProvidersFailedException as err:
        await refund_ai_quota(db, auth.organization.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AI_SERVICE_UNAVAILABLE", "message": err.message}},
        )
    except Exception as err:
        await refund_ai_quota(db, auth.organization.id)
        logger.error(f"Unexpected error in generate_fix_guide: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "AI_GENERATION_FAILED", "message": "Failed to generate remediation guide."}},
        )


@router.post("/security-summary", response_model=AIResponseModel)
async def generate_security_summary(
    request: Request,
    body: SecuritySummaryRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Generates executive security brief for the scan."""
    _check_ai_enabled()
    require_feature(auth.plan, "ai_security_advisor")

    await check_rate_limit(
        f"ratelimit:ai_user:{auth.user.id}",
        max_requests=settings.AI_RATE_LIMIT_PER_USER,
        window_seconds=60,
    )

    scan = await get_tenant_scan(body.scan_id, auth, db)
    website = await _resolve_website_for_scan(scan, auth, db)

    cached = await orchestrator.get_cached_generation(
        db=db,
        organization_id=auth.organization.id,
        scan_id=scan.id,
        feature_type="security_summary",
        finding_id=None,
    )
    if cached:
        return AIResponseModel(
            content=cached.content,
            structured_data=cached.structured_data,
            provider_used=cached.provider_used,
            model_used=cached.model_used,
            fallback_used=cached.fallback_used,
            latency_ms=cached.latency_ms,
            cached=True,
        )

    await check_and_reserve_ai_quota(db, auth.organization.id, auth.plan)

    context_xml = AIContextBuilder.build_scan_context(
        website=website,
        scan=scan,
        target_check=None,
    )
    prompt = get_security_summary_prompt(context_xml)

    try:
        resp = await orchestrator.generate_with_fallback(
            prompt=prompt,
            feature_type="security_summary",
            db=db,
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            website_id=website.id,
            scan_id=scan.id,
            finding_id=None,
            check_cache=False,
        )
        await record_audit_event(
            db=db,
            action="AI_SECURITY_SUMMARY",
            entity_type="AI_ADVISOR",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(scan.id),
            metadata={"provider": resp.provider_used, "model": resp.model_used, "fallback": resp.fallback_used},
        )
        await db.commit()
        return AIResponseModel(

            content=resp.content,
            structured_data=resp.structured_data,
            provider_used=resp.provider_used,
            model_used=resp.model_used,
            fallback_used=resp.fallback_used,
            latency_ms=resp.latency_ms,
            cached=False,
        )
    except AllProvidersFailedException as err:
        await refund_ai_quota(db, auth.organization.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AI_SERVICE_UNAVAILABLE", "message": err.message}},
        )
    except Exception as err:
        await refund_ai_quota(db, auth.organization.id)
        logger.error(f"Unexpected error in security_summary: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "AI_GENERATION_FAILED", "message": "Failed to generate security summary."}},
        )


@router.post("/security-plan", response_model=AIResponseModel)
async def generate_security_plan(
    request: Request,
    body: SecurityPlanRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Generates prioritized security improvement plan."""
    _check_ai_enabled()
    require_feature(auth.plan, "ai_security_advisor")

    await check_rate_limit(
        f"ratelimit:ai_user:{auth.user.id}",
        max_requests=settings.AI_RATE_LIMIT_PER_USER,
        window_seconds=60,
    )

    scan = await get_tenant_scan(body.scan_id, auth, db)
    website = await _resolve_website_for_scan(scan, auth, db)

    cached = await orchestrator.get_cached_generation(
        db=db,
        organization_id=auth.organization.id,
        scan_id=scan.id,
        feature_type="security_plan",
        finding_id=None,
    )
    if cached:
        return AIResponseModel(
            content=cached.content,
            structured_data=cached.structured_data,
            provider_used=cached.provider_used,
            model_used=cached.model_used,
            fallback_used=cached.fallback_used,
            latency_ms=cached.latency_ms,
            cached=True,
        )

    await check_and_reserve_ai_quota(db, auth.organization.id, auth.plan)

    context_xml = AIContextBuilder.build_scan_context(
        website=website,
        scan=scan,
        target_check=None,
    )
    prompt = get_security_plan_prompt(context_xml)

    try:
        resp = await orchestrator.generate_with_fallback(
            prompt=prompt,
            feature_type="security_plan",
            db=db,
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            website_id=website.id,
            scan_id=scan.id,
            finding_id=None,
            check_cache=False,
        )
        await record_audit_event(
            db=db,
            action="AI_SECURITY_PLAN",
            entity_type="AI_ADVISOR",
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            entity_id=str(scan.id),
            metadata={"provider": resp.provider_used, "model": resp.model_used, "fallback": resp.fallback_used},
        )
        await db.commit()
        return AIResponseModel(

            content=resp.content,
            structured_data=resp.structured_data,
            provider_used=resp.provider_used,
            model_used=resp.model_used,
            fallback_used=resp.fallback_used,
            latency_ms=resp.latency_ms,
            cached=False,
        )
    except AllProvidersFailedException as err:
        await refund_ai_quota(db, auth.organization.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AI_SERVICE_UNAVAILABLE", "message": err.message}},
        )
    except Exception as err:
        await refund_ai_quota(db, auth.organization.id)
        logger.error(f"Unexpected error in security_plan: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "AI_GENERATION_FAILED", "message": "Failed to generate security plan."}},
        )


@router.post("/chat", response_model=AIResponseModel)
async def chat_with_advisor(
    request: Request,
    body: AiChatRequest,
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Interactive conversational Security Advisor scoped strictly to scan data."""
    _check_ai_enabled()
    require_feature(auth.plan, "ai_security_advisor")

    await check_rate_limit(
        f"ratelimit:ai_user:{auth.user.id}",
        max_requests=settings.AI_RATE_LIMIT_PER_USER,
        window_seconds=60,
    )

    scan = await get_tenant_scan(body.scan_id, auth, db)
    website = await _resolve_website_for_scan(scan, auth, db)

    # Chat is dynamic and interactive: do not cache across sessions
    await check_and_reserve_ai_quota(db, auth.organization.id, auth.plan)

    context_xml = AIContextBuilder.build_scan_context(
        website=website,
        scan=scan,
        target_check=None,
    )
    prompt = get_chat_prompt(
        context_xml=context_xml,
        message=body.message,
        conversation_history=body.conversation_history,
    )

    try:
        resp = await orchestrator.generate_with_fallback(
            prompt=prompt,
            feature_type="chat",
            db=db,
            organization_id=auth.organization.id,
            user_id=auth.user.id,
            website_id=website.id,
            scan_id=scan.id,
            finding_id=None,
            check_cache=False,
        )
        await db.commit()
        return AIResponseModel(
            content=resp.content,
            structured_data=resp.structured_data,

            provider_used=resp.provider_used,
            model_used=resp.model_used,
            fallback_used=resp.fallback_used,
            latency_ms=resp.latency_ms,
            cached=False,
        )
    except AllProvidersFailedException as err:
        await refund_ai_quota(db, auth.organization.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "AI_SERVICE_UNAVAILABLE", "message": err.message}},
        )
    except Exception as err:
        await refund_ai_quota(db, auth.organization.id)
        logger.error(f"Unexpected error in chat: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "AI_GENERATION_FAILED", "message": "Failed to complete AI chat turn."}},
        )


@router.get("/usage", response_model=AiUsageResponse)
async def get_ai_usage(
    auth: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current billing period's AI generation quota usage and limits."""
    norm_plan = normalize_plan_name(auth.plan)
    if norm_plan == "admin":
        limit = 99999
    elif norm_plan == "agency":
        limit = getattr(settings, "AI_MONTHLY_LIMIT_AGENCY", 500)
    elif norm_plan == "pro":
        limit = getattr(settings, "AI_MONTHLY_LIMIT_PRO", 100)
    else:
        limit = 0

    period_month, _, period_end = get_current_usage_period()
    stmt = select(UsageRecord).where(
        UsageRecord.organization_id == auth.organization.id,
        UsageRecord.period_month == period_month,
    )
    res = await db.execute(stmt)
    usage = res.scalar_one_or_none()
    used = getattr(usage, "ai_requests_count", 0) if usage else 0
    remaining = max(0, limit - used)

    return AiUsageResponse(
        plan=norm_plan,
        used=used,
        limit=limit,
        remaining=remaining,
        reset_at=period_end.isoformat(),
    )


@router.get("/status", response_model=AiStatusResponse)
async def get_ai_status():
    """Returns AI advisor system availability and provider configuration."""
    order = orchestrator.get_provider_order()
    models = {
        name: prov.model for name, prov in orchestrator.providers.items()
    }
    return AiStatusResponse(
        enabled=settings.AI_ENABLED,
        primary_provider=order[0] if order else "groq1",
        provider_order=order,
        models=models,
    )
