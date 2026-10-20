"""
Scanly API - Groq AI Provider
Integrates with Groq's high-speed inference API with structured JSON output and error normalization.
"""
import time
import json
import logging
from typing import Optional, Dict, Any
import httpx
from app.services.ai.base import (
    AIProvider,
    AIResponse,
    AIProviderException,
    AITimeoutException,
    AIRateLimitException,
    AIUnavailableException,
)

logger = logging.getLogger(__name__)


class GroqProvider(AIProvider):
    """Adapter for Groq Cloud LLM endpoints."""

    def __init__(
        self,
        name: str,
        model: str,
        api_key: Optional[str] = None,
        base_url: str = "https://api.groq.com/openai/v1",
        timeout_seconds: float = 30.0,
    ):
        super().__init__(name=name, model=model, api_key=api_key, timeout_seconds=timeout_seconds)
        self.base_url = base_url.rstrip("/")

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        response_format_json: bool = True,
    ) -> AIResponse:
        if not self.api_key:
            raise AIUnavailableException(f"Groq API key not configured for provider '{self.name}'", provider=self.name)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if response_format_json:
            payload["response_format"] = {"type": "json_object"}

        start_time = time.monotonic()
        endpoint = f"{self.base_url}/chat/completions"

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(endpoint, json=payload, headers=headers)
                latency_ms = int((time.monotonic() - start_time) * 1000)

                if res.status_code == 429:
                    raise AIRateLimitException(
                        f"Groq rate limit exceeded: {res.text}",
                        provider=self.name,
                        status_code=429,
                    )
                elif res.status_code >= 500:
                    raise AIUnavailableException(
                        f"Groq service unavailable ({res.status_code}): {res.text}",
                        provider=self.name,
                        status_code=res.status_code,
                    )
                elif res.status_code >= 400:
                    raise AIProviderException(
                        f"Groq client error ({res.status_code}): {res.text}",
                        provider=self.name,
                        status_code=res.status_code,
                    )

                data = res.json()
                choices = data.get("choices", [])
                if not choices:
                    raise AIProviderException("Empty response choices from Groq", provider=self.name)

                content = choices[0].get("message", {}).get("content", "").strip()

                usage = data.get("usage", {})
                tokens_in = usage.get("prompt_tokens")
                tokens_out = usage.get("completion_tokens")

                structured = None
                if response_format_json:
                    try:
                        structured = json.loads(content)
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse JSON response from Groq ({self.name})")

                return AIResponse(
                    content=content,
                    structured_data=structured,
                    provider_used=self.name,
                    model_used=self.model,
                    fallback_used=False,
                    latency_ms=latency_ms,
                    tokens_input=tokens_in,
                    tokens_output=tokens_out,
                )

        except httpx.TimeoutException as e:
            latency_ms = int((time.monotonic() - start_time) * 1000)
            logger.warning(f"Groq timeout after {latency_ms}ms ({self.name}): {e}")
            raise AITimeoutException(f"Groq request timed out after {self.timeout_seconds}s", provider=self.name)
        except httpx.RequestError as e:
            logger.warning(f"Groq connection error ({self.name}): {e}")
            raise AIUnavailableException(f"Network error contacting Groq: {str(e)}", provider=self.name)

    async def health_check(self) -> bool:
        """Simple health ping via model list or tiny prompt."""
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                return res.status_code == 200
        except Exception:
            return False
