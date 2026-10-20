"""
Scanly API - Health & Readiness Checks
"""
import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok", "service": "Scanly API", "environment": settings.ENVIRONMENT}


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Deep readiness check verifying database and Redis connectivity."""
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Readiness check failed during database probe: {e}")
        db_status = "unhealthy" if settings.ENVIRONMENT == "production" else f"unhealthy: {type(e).__name__}"

    redis_status = "healthy"
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
    except Exception as e:
        logger.error(f"Readiness check failed during Redis probe: {e}")
        redis_status = "unhealthy" if settings.ENVIRONMENT == "production" else f"unhealthy: {type(e).__name__}"

    overall_ready = (db_status == "healthy") and (redis_status == "healthy")

    return {
        "status": "ready" if overall_ready else "degraded",
        "database": db_status,
        "redis": redis_status,
        "environment": settings.ENVIRONMENT,
    }

