"""
Scanly API - Gemini AI Provider
Integrates with Google Gemini REST API as a robust final fallback with JSON mode and normalized error handling.
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


class GeminiProvider(AIProvider):
    """Adapter for Google Gemini API."""

    def __init__(
        self,
        name: str = "gemini",
        model: str = "gemini-1.5-flash",
        api_key: Optional[str] = None,
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
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
            raise AIUnavailableException("Gemini API key not configured", provider=self.name)

        endpoint = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"

        payload: Dict[str, Any] = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        if response_format_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        start_time = time.monotonic()

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(endpoint, json=payload)
                latency_ms = int((time.monotonic() - start_time) * 1000)

                if res.status_code == 429:
                    raise AIRateLimitException(
                        f"Gemini rate limit exceeded: {res.text}",
                        provider=self.name,
                        status_code=429,
                    )
                elif res.status_code >= 500:
                    raise AIUnavailableException(
                        f"Gemini service unavailable ({res.status_code}): {res.text}",
                        provider=self.name,
                        status_code=res.status_code,
                    )
                elif res.status_code >= 400:
                    raise AIProviderException(
                        f"Gemini client error ({res.status_code}): {res.text}",
                        provider=self.name,
                        status_code=res.status_code,
                    )

                data = res.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise AIProviderException("No generation candidates returned by Gemini", provider=self.name)

                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise AIProviderException("Empty response parts from Gemini", provider=self.name)

                content = parts[0].get("text", "").strip()

                usage = data.get("usageMetadata", {})
                tokens_in = usage.get("promptTokenCount")
                tokens_out = usage.get("candidatesTokenCount")

                structured = None
                if response_format_json:
                    try:
                        structured = json.loads(content)
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse JSON response from Gemini ({self.name})")

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
            logger.warning(f"Gemini timeout after {latency_ms}ms: {e}")
            raise AITimeoutException(f"Gemini request timed out after {self.timeout_seconds}s", provider=self.name)
        except httpx.RequestError as e:
            logger.warning(f"Gemini connection error: {e}")
            raise AIUnavailableException(f"Network error contacting Gemini: {str(e)}", provider=self.name)

    async def health_check(self) -> bool:
        """Ping Gemini models endpoint."""
        if not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{self.base_url}/models/{self.model}?key={self.api_key}")
                return res.status_code == 200
        except Exception:
            return False
