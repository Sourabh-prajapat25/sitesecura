"""
Scanly API - AI Provider Abstraction & Data Models
Defines the base provider interface, normalized responses, and error categories.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List


class AIProviderException(Exception):
    """Base exception for all AI provider errors."""
    def __init__(self, message: str, provider: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.status_code = status_code


class AITimeoutException(AIProviderException):
    """Raised when an AI provider request times out."""
    pass


class AIRateLimitException(AIProviderException):
    """Raised when an AI provider rate limits the request (HTTP 429)."""
    pass


class AIUnavailableException(AIProviderException):
    """Raised when an AI provider is unreachable or returns 5xx."""
    pass


class AllProvidersFailedException(Exception):
    """Raised by the orchestrator when all providers in the fallback chain fail."""
    def __init__(self, message: str = "Security Advisor is temporarily unavailable. Your scan results remain accessible.", provider_errors: Optional[Dict[str, str]] = None):
        super().__init__(message)
        self.message = message
        self.provider_errors = provider_errors or {}


@dataclass
class AIResponse:
    """Normalized response container produced by any LLM provider."""
    content: str
    structured_data: Optional[Dict[str, Any]] = None
    provider_used: str = ""
    model_used: str = ""
    fallback_used: bool = False
    latency_ms: int = 0
    tokens_input: Optional[int] = None
    tokens_output: Optional[int] = None
    cached: bool = False


class AIProvider(ABC):
    """Abstract interface that all LLM provider adapters must implement."""

    def __init__(self, name: str, model: str, api_key: Optional[str] = None, timeout_seconds: float = 30.0):
        self.name = name
        self.model = model
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2000,
        response_format_json: bool = True,
    ) -> AIResponse:
        """Executes a single generation request against the provider."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Quick connectivity probe."""
        pass
