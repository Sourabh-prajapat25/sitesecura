"""
Scanly API - Main Application Entrypoint
FastAPI application factory, CORS setup, exception handlers, and API routing.
"""
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, Depends, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure scanner package is on python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.core.config import settings
from app.db.base import Base
from app.db.session import async_engine, get_db
from app.models import *  # import all models for metadata

# Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.scans import router as scans_router
from app.api.v1.websites import router as websites_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.billing import router as billing_router
from app.api.v1.agency import router as agency_router
from app.api.v1.admin import router as admin_router
from app.api.v1.cms import router as cms_router
from app.api.v1.health import router as health_router
from app.api.v1.ai import router as ai_router
from app.api.v1.badges import router as badges_router, serve_badge_svg_response
from app.api.v1.onboarding import router as onboarding_router
from app.api.v1.tools import router as tools_router


import uuid
import logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate production configuration fail-fast
    warnings = settings.validate_production_configuration()
    for w in warnings:
        logging.getLogger("uvicorn.error").warning(f"[Production Config Warning] {w}")

    # Startup: Ensure database schema exists for smooth development
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await async_engine.dispose()


app = FastAPI(
    title="Scanly Cybersecurity API",
    description=(
        "Production-grade defensive cybersecurity scanning API. "
        "Provides website vulnerability & configuration assessments, continuous monitoring, and automated alerts."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware with explicit origins (strips loopback in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Enforces standard defensive HTTP security headers and correlation ID on all API responses."""
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:16]}"
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
        "magnetometer=(), microphone=(), payment=(), usb=()"
    )
    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response



# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    logging.getLogger("uvicorn.error").exception(f"Unhandled error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred. Please try again later.",
            }
        },
    )

# Include Routers under /api/v1
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(scans_router, prefix="/api/v1")
app.include_router(websites_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(agency_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(cms_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(badges_router, prefix="/api/v1")
app.include_router(onboarding_router, prefix="/api/v1")
app.include_router(tools_router, prefix="/api/v1")

# Root redirect to docs or health
@app.get("/")
def root():
    return {"message": "Welcome to Scanly API. Visit /docs for OpenAPI documentation."}


# Dynamic SiteSecura Verified Badge SVG Root Endpoint (VB-4)
@app.get("/badges/{public_token}.svg", include_in_schema=False)
async def get_root_badge_svg(
    public_token: str,
    request: Request,
    style: str = Query("standard", description="Badge style: 'standard' or 'compact'"),
    db: AsyncSession = Depends(get_db),
):
    """Dynamic vector SVG badge endpoint at root path for public embed codes."""
    return await serve_badge_svg_response(public_token=public_token, style=style, db=db, request=request)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
