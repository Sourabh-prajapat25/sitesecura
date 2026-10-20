"""
Scanly API - Multi-Provider AI Orchestrator
Coordinates dynamic LLM provider execution, failover (Groq1 -> Groq2 -> Gemini),
health cooldowns, prompt versioning, deterministic caching, and persistence.
"""
import time
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ai import AIGeneration
from app.services.ai.base import (
    AIProvider,
    AIResponse,
    AIProviderException,
    AllProvidersFailedException,
)
from app.services.ai.groq_provider import GroqProvider
from app.services.ai.gemini_provider import GeminiProvider
from app.services.ai.prompts import BASE_SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION

logger = logging.getLogger(__name__)


class AIOrchestrator:
    """Manages multi-provider failover, caching, and generation persistence."""

    def __init__(self, custom_providers: Optional[Dict[str, AIProvider]] = None):
        self.providers: Dict[str, AIProvider] = custom_providers or self._init_default_providers()
        self._provider_failure_cooldown: Dict[str, float] = {}  # provider_name -> timestamp of last failure
        self.cooldown_seconds = 30.0

    def _init_default_providers(self) -> Dict[str, AIProvider]:
        providers = {}

        # 1. Primary Groq Provider
        providers["groq1"] = GroqProvider(
            name="groq1",
            model=settings.GROQ1_MODEL,
            api_key=settings.GROQ1_API_KEY,
            base_url=settings.GROQ1_BASE_URL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )

        # 2. Secondary Groq Provider
        providers["groq2"] = GroqProvider(
            name="groq2",
            model=settings.GROQ2_MODEL,
            api_key=settings.GROQ2_API_KEY,
            base_url=settings.GROQ2_BASE_URL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )

        # 3. Gemini Fallback Provider
        providers["gemini"] = GeminiProvider(
            name="gemini",
            model=settings.GEMINI_MODEL,
            api_key=settings.GEMINI_API_KEY,
            base_url=settings.GEMINI_BASE_URL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )

        return providers

    def get_provider_order(self) -> List[str]:
        """Resolves configured provider priority order from settings."""
        raw_order = getattr(settings, "AI_PROVIDER_ORDER", "groq1,groq2,gemini")
        order = [p.strip() for p in raw_order.split(",") if p.strip()]
        return order or ["groq1", "groq2", "gemini"]

    async def get_cached_generation(
        self,
        db: AsyncSession,
        organization_id: uuid.UUID,
        scan_id: uuid.UUID,
        feature_type: str,
        finding_id: Optional[uuid.UUID] = None,
        prompt_version: str = SYSTEM_PROMPT_VERSION,
    ) -> Optional[AIResponse]:
        """Looks up a previously generated deterministic response from the database."""
        stmt = (
            select(AIGeneration)
            .where(
                AIGeneration.organization_id == organization_id,
                AIGeneration.scan_id == scan_id,
                AIGeneration.finding_id == finding_id,
                AIGeneration.feature_type == feature_type,
                AIGeneration.prompt_version == prompt_version,
                AIGeneration.request_status == "success",
            )
            .order_by(AIGeneration.created_at.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        record = res.scalar_one_or_none()
        if record:
            return AIResponse(
                content=record.response_content,
                structured_data=record.structured_response,
                provider_used=record.provider,
                model_used=record.model,
                fallback_used=record.fallback_used,
                latency_ms=0,
                tokens_input=record.tokens_input,
                tokens_output=record.tokens_output,
                cached=True,
            )
        return None

    async def generate_with_fallback(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        feature_type: str = "general",
        db: Optional[AsyncSession] = None,
        organization_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
        website_id: Optional[uuid.UUID] = None,
        scan_id: Optional[uuid.UUID] = None,
        finding_id: Optional[uuid.UUID] = None,
        check_cache: bool = True,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_format_json: bool = True,
    ) -> AIResponse:
        """
        Executes generation through the provider fallback chain.
        Persists result in database if db and metadata are provided.
        """
        sys_prompt = system_prompt or BASE_SYSTEM_PROMPT
        temp = temperature if temperature is not None else settings.AI_TEMPERATURE
        max_t = max_tokens or settings.AI_MAX_OUTPUT_TOKENS

        # 1. Deterministic Cache Check
        if check_cache and db and organization_id and scan_id:
            cached_resp = await self.get_cached_generation(
                db=db,
                organization_id=organization_id,
                scan_id=scan_id,
                feature_type=feature_type,
                finding_id=finding_id,
                prompt_version=SYSTEM_PROMPT_VERSION,
            )
            if cached_resp:
                logger.info(f"AI cache hit for {feature_type} (scan={scan_id}, finding={finding_id})")
                return cached_resp

        # 2. Iterate Provider Fallback Order
        provider_order = self.get_provider_order()
        primary_provider_name = provider_order[0] if provider_order else "groq1"

        provider_errors: Dict[str, str] = {}
        now = time.monotonic()

        for idx, provider_name in enumerate(provider_order):
            provider = self.providers.get(provider_name)
            if not provider:
                logger.warning(f"Configured provider '{provider_name}' not found in registered providers")
                continue

            # Check cooldown if previously failed (unless it's the only provider left)
            last_failed = self._provider_failure_cooldown.get(provider_name, 0)
            if (now - last_failed) < self.cooldown_seconds and idx < (len(provider_order) - 1):
                logger.info(f"Skipping provider '{provider_name}' due to cooldown ({int(self.cooldown_seconds - (now - last_failed))}s remaining)")
                continue

            try:
                retries = settings.AI_MAX_RETRIES
                attempt = 0
                while attempt <= retries:
                    try:
                        logger.info(f"Dispatching AI request '{feature_type}' to provider '{provider_name}' (model={provider.model})")
                        response = await provider.generate(
                            prompt=prompt,
                            system_prompt=sys_prompt,
                            temperature=temp,
                            max_tokens=max_t,
                            response_format_json=response_format_json,
                        )

                        is_fallback = (provider_name != primary_provider_name)
                        response.fallback_used = is_fallback

                        if is_fallback:
                            logger.warning(
                                f"AI Fallback succeeded: Used '{provider_name}' instead of primary '{primary_provider_name}'. Latency: {response.latency_ms}ms"
                            )

                        # Clear cooldown on success
                        self._provider_failure_cooldown.pop(provider_name, None)

                        # 3. Persist Generation in DB
                        if db and organization_id and user_id and website_id and scan_id:
                            generation_record = AIGeneration(
                                id=uuid.uuid4(),
                                organization_id=organization_id,
                                user_id=user_id,
                                website_id=website_id,
                                scan_id=scan_id,
                                finding_id=finding_id,
                                feature_type=feature_type,
                                provider=provider_name,
                                model=provider.model,
                                prompt_version=SYSTEM_PROMPT_VERSION,
                                request_status="fallback_success" if is_fallback else "success",
                                response_content=response.content,
                                structured_response=response.structured_data,
                                tokens_input=response.tokens_input,
                                tokens_output=response.tokens_output,
                                latency_ms=response.latency_ms,
                                fallback_used=is_fallback,
                            )
                            db.add(generation_record)
                            await db.flush()

                        return response

                    except Exception as err:
                        attempt += 1
                        if attempt > retries:
                            raise err
                        logger.info(f"Retrying provider '{provider_name}' (attempt {attempt}/{retries}) after error: {err}")

            except Exception as e:
                err_msg = str(e)
                logger.warning(f"AI Provider '{provider_name}' failed: {err_msg}")
                self._provider_failure_cooldown[provider_name] = time.monotonic()
                provider_errors[provider_name] = err_msg

                # Record failure in DB if possible
                if db and organization_id and user_id and website_id and scan_id:
                    try:
                        failed_rec = AIGeneration(
                            id=uuid.uuid4(),
                            organization_id=organization_id,
                            user_id=user_id,
                            website_id=website_id,
                            scan_id=scan_id,
                            finding_id=finding_id,
                            feature_type=feature_type,
                            provider=provider_name,
                            model=provider.model,
                            prompt_version=SYSTEM_PROMPT_VERSION,
                            request_status="failed",
                            response_content=f"Error: {err_msg}",
                            latency_ms=0,
                            fallback_used=(provider_name != primary_provider_name),
                        )
                        db.add(failed_rec)
                        await db.flush()
                    except Exception:
                        pass

                # Proceed to next provider in fallback chain
                continue

        # All providers exhausted
        logger.error(f"All configured AI providers failed for feature '{feature_type}': {provider_errors}")
        raise AllProvidersFailedException(
            message="Security Advisor is temporarily unavailable. Your scan results remain accessible.",
            provider_errors=provider_errors,
        )


# Global default orchestrator instance
orchestrator = AIOrchestrator()
