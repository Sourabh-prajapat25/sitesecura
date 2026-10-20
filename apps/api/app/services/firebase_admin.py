"""
Scanly API - Firebase Admin SDK Service
Centralized singleton initialization for Firebase Admin SDK.
Supports Google Application Default Credentials, service account credentials, and project verification.
"""
import os
import logging
import threading
from typing import Optional, Dict, Any
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from app.core.config import settings

logger = logging.getLogger(__name__)

_init_lock = threading.Lock()
_firebase_app: Optional[firebase_admin.App] = None


def get_firebase_app() -> Optional[firebase_admin.App]:
    """
    Returns the initialized Firebase Admin App singleton, initializing it once if needed.
    Thread-safe and resilient to Uvicorn code reloading.
    """
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    with _init_lock:
        if _firebase_app is not None:
            return _firebase_app

        # Check if default app is already registered in firebase_admin
        if firebase_admin._apps and "[DEFAULT]" in firebase_admin._apps:
            _firebase_app = firebase_admin.get_app()
            return _firebase_app

        try:
            # 1. Explicit Service Account Credentials (from env variables)
            if settings.FIREBASE_CLIENT_EMAIL and settings.FIREBASE_PRIVATE_KEY:
                private_key = settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n")
                cred = credentials.Certificate({
                    "type": "service_account",
                    "project_id": settings.FIREBASE_PROJECT_ID,
                    "private_key": private_key,
                    "client_email": settings.FIREBASE_CLIENT_EMAIL,
                    "token_uri": "https://oauth2.googleapis.com/token",
                })
                _firebase_app = firebase_admin.initialize_app(cred, {
                    "projectId": settings.FIREBASE_PROJECT_ID
                })
                logger.info(f"Firebase Admin initialized with service account for project '{settings.FIREBASE_PROJECT_ID}'.")
                return _firebase_app

            # 2. Google Application Default Credentials file if specified
            if settings.GOOGLE_APPLICATION_CREDENTIALS and os.path.isfile(settings.GOOGLE_APPLICATION_CREDENTIALS):
                cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
                _firebase_app = firebase_admin.initialize_app(cred, {
                    "projectId": settings.FIREBASE_PROJECT_ID
                })
                logger.info(f"Firebase Admin initialized with GOOGLE_APPLICATION_CREDENTIALS file for '{settings.FIREBASE_PROJECT_ID}'.")
                return _firebase_app

            # 3. Default Application Default Credentials / Project-level initialization
            try:
                _firebase_app = firebase_admin.initialize_app(options={
                    "projectId": settings.FIREBASE_PROJECT_ID
                })
                logger.info(f"Firebase Admin initialized with project ID '{settings.FIREBASE_PROJECT_ID}'.")
                return _firebase_app
            except ValueError as e:
                # App already exists
                if firebase_admin._apps:
                    _firebase_app = firebase_admin.get_app()
                    return _firebase_app
                raise e

        except Exception as e:
            logger.warning(f"Firebase Admin initialization note: {e}")
            # If default app exists, return it
            if firebase_admin._apps:
                _firebase_app = firebase_admin.get_app()
                return _firebase_app
            return None


def verify_firebase_token_payload(token: str) -> Dict[str, Any]:
    """
    Verifies a Firebase ID token using the Firebase Admin SDK.
    Checks signature, expiration, issuer, and audience.
    """
    app = get_firebase_app()
    if not app:
        # Re-attempt initialization
        app = get_firebase_app()

    return firebase_auth.verify_id_token(token, app=app, check_revoked=False)
