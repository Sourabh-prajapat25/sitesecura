"""
Scanly API - Redis Rate Limiting Middleware & Helpers
Enforces rate limits on anonymous scans, authenticated endpoints, and expensive tasks.
"""
import time
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
import redis.asyncio as redis
from .config import settings

logger = logging.getLogger(__name__)

# Redis client for async rate limiting
import asyncio

_redis_client: Optional[redis.Redis] = None
_redis_loop = None


async def get_redis_client() -> redis.Redis:
    global _redis_client, _redis_loop
    current_loop = asyncio.get_running_loop()
    if _redis_client is None or _redis_loop is not current_loop:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        _redis_loop = current_loop
    return _redis_client


# In-memory fallback tracking when Redis daemon is not reachable
_memory_rate_limits: dict = {}


async def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
    fail_closed: bool = False,
) -> bool:
    """
    Rate limiter using Redis with controlled in-memory fallback.
    Returns True if permitted, raises HTTPException 429 if rate limit exceeded.
    If Redis is unavailable:
    - If fail_closed=True or settings.REDIS_RATE_LIMIT_FAIL_CLOSED=True in production:
      Fails closed with HTTP 503 to prevent distributed limit bypass.
    - Otherwise in production: Logs critical telemetry that distributed guarantees are degraded
      and applies bounded per-process in-memory limits (preventing runaway process traffic).
    - In development/test: Logs warning and applies in-memory limits.
    """
    now = time.time()
    try:
        r = await get_redis_client()
        current_count = await r.incr(key)
        if current_count == 1:
            await r.expire(key, window_seconds)

        if current_count > max_requests:
            ttl = await r.ttl(key)
            if ttl < 0:
                ttl = window_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": f"Rate limit exceeded. Maximum {max_requests} requests allowed per {window_seconds}s. Please retry in {ttl} seconds.",
                        "retry_after": ttl,
                    }
                },
            )
        return True
    except HTTPException:
        raise
    except Exception as e:
        is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")
        should_fail_closed = fail_closed or getattr(settings, "REDIS_RATE_LIMIT_FAIL_CLOSED", False)

        if is_prod:
            logger.critical(
                f"CRITICAL: Redis rate limiter unavailable in PRODUCTION ({type(e).__name__}: {e})! "
                "In-memory fallback does not provide distributed rate-limiting guarantees across multiple worker nodes."
            )
            if should_fail_closed:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={
                        "error": {
                            "code": "RATE_LIMITER_UNAVAILABLE",
                            "message": "Rate limiting service temporarily unavailable. Request blocked for security.",
                        }
                    },
                )
        else:
            logger.warning(f"Redis rate limiter unavailable ({type(e).__name__}: {e}), using in-memory fallback")

        # In-memory fallback tracking (development, test, and non-fail-closed fallback)
        record = _memory_rate_limits.get(key)
        if not record or (now - record["start_time"]) > window_seconds:
            _memory_rate_limits[key] = {"count": 1, "start_time": now}
            return True

        record["count"] += 1
        if record["count"] > max_requests:
            remaining = int(window_seconds - (now - record["start_time"]))
            ttl = max(1, remaining)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": f"Rate limit exceeded. Maximum {max_requests} requests allowed per {window_seconds}s. Please retry in {ttl} seconds.",
                        "retry_after": ttl,
                    }
                },
            )
        return True


def get_client_ip(request: Request) -> str:
    """Extracts client IP considering standard reverse-proxy headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"
