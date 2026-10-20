"""
Scanly API - Authentication & Security Module
Verifies Firebase ID tokens and provides FastAPI authentication dependencies.
Supports local development and automated testing via dev tokens in non-production environments.
"""
import logging
from typing import Optional, Dict, Any
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.services import firebase_admin as firebase_admin_service

logger = logging.getLogger(__name__)

security_scheme = HTTPBearer(auto_error=False, description="Firebase JWT ID Token")


def verify_firebase_id_token(token: str) -> Dict[str, Any]:
    """
    Verifies Firebase JWT ID token using the Firebase Admin SDK.
    In development/testing environments, supports test tokens for automated test suites.
    In production, strictly verifies cryptographic signature against Firebase public keys.
    """
    if not token or not isinstance(token, str) or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTHENTICATION_REQUIRED", "message": "Valid authentication is required."}},
            headers={"WWW-Authenticate": "Bearer"},
        )

    clean_token = token.strip()

    # Development / Testing Mock Token Support (Disabled in production)
    if settings.ENVIRONMENT.lower() not in ("production", "prod") and (clean_token.startswith("dev-token-") or clean_token.startswith("test-token-")):
        parts = clean_token.split("-")
        uid = parts[2] if len(parts) > 2 else "dev_user_123"
        role = parts[3] if len(parts) > 3 else "free"
        email = f"{uid}@example.com"
        return {
            "uid": uid,
            "email": email,
            "name": f"User {uid}",
            "email_verified": True,
            "role": role,
            "auth_time": 1700000000,
        }

    try:
        decoded_token = firebase_admin_service.verify_firebase_token_payload(clean_token)
        # Normalize fields
        uid = decoded_token.get("uid") or decoded_token.get("user_id") or decoded_token.get("sub")
        if not uid:
            raise ValueError("Decoded token is missing uid claim.")

        email = decoded_token.get("email") or f"{uid}@scanly.io"
        name = decoded_token.get("name") or decoded_token.get("display_name") or email.split("@")[0]
        email_verified = decoded_token.get("email_verified", False)

        return {
            "uid": uid,
            "email": email,
            "name": name,
            "email_verified": email_verified,
            "firebase_claims": decoded_token,
        }
    except HTTPException:
        raise
    except Exception as e:
        # Safe diagnostic logging without exposing token secrets
        error_type = type(e).__name__
        logger.warning(
            f"Firebase token verification failed [configured_project={settings.FIREBASE_PROJECT_ID}]: {error_type} - {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_AUTH_TOKEN", "message": "Invalid or expired authentication token."}},
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    FastAPI Dependency: extracts and verifies Authorization: Bearer <Firebase ID token>.
    Returns normalized token context { uid, email, name, email_verified, ... }.
    Supports standard Bearer authentication, Swagger UI OpenAPI bearer scheme,
    and cleanly handles redundant/duplicate 'Bearer Bearer' prefixes.
    """
    raw_token: Optional[str] = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif authorization:
        raw_token = authorization

    if not raw_token or not isinstance(raw_token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTHENTICATION_REQUIRED", "message": "Valid authentication is required."}},
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Clean and strip duplicate/redundant "Bearer " prefixes iteratively
    token = raw_token.strip()
    while token.lower().startswith("bearer "):
        token = token[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "AUTHENTICATION_REQUIRED", "message": "Valid authentication is required."}},
            headers={"WWW-Authenticate": "Bearer"},
        )

    return verify_firebase_id_token(token)


async def get_optional_user_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Optional[Dict[str, Any]]:
    """
    FastAPI Dependency: extracts and verifies Bearer token if provided.
    Returns None for anonymous requests without raising 401.
    """
    raw_token: Optional[str] = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif authorization:
        raw_token = authorization

    if not raw_token or not isinstance(raw_token, str):
        return None

    token = raw_token.strip()
    while token.lower().startswith("bearer "):
        token = token[7:].strip()

    if not token:
        return None

    try:
        return verify_firebase_id_token(token)
    except HTTPException:
        return None
