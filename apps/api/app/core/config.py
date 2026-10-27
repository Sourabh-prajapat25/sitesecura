"""
Scanly API - Core Settings & Configuration
Loads environment variables using Pydantic Settings with secure defaults.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    APP_NAME: str = "SiteSecura"
    API_URL: str = "http://localhost:8000"
    NEXT_PUBLIC_APP_URL: str = "http://localhost:3000"
    SECRET_KEY: str = "development-secret-key-scanly-replace-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # PostgreSQL Database URL
    DATABASE_URL: str = "postgresql+asyncpg://scanly:scanly_dev_password@localhost:5432/scanly"
    DATABASE_URL_SYNC: str = "postgresql://scanly:scanly_dev_password@localhost:5432/scanly"

    # Redis & Background Workers
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    REDIS_RATE_LIMIT_FAIL_CLOSED: bool = False

    # Scanner Settings
    SCANNER_MODE: str = "real"  # "real" or "fixture"
    SCANNER_TIMEOUT_SECONDS: float = 10.0
    SCANNER_CONNECT_TIMEOUT: float = 5.0
    SCANNER_READ_TIMEOUT: float = 5.0
    SCANNER_WRITE_TIMEOUT: float = 5.0
    SCANNER_POOL_TIMEOUT: float = 5.0
    SCANNER_MAX_REDIRECTS: int = 5
    SCANNER_MAX_RESPONSE_BYTES: int = 1048576
    ENABLE_NMAP: bool = False

    # Security Badge Settings
    SECURITY_BADGE_MINIMUM_SCORE: int = 70

    # Firebase Authentication
    FIREBASE_PROJECT_ID: str = "scanly-user"
    FIREBASE_AUTH_DOMAIN: Optional[str] = "scanly-user.firebaseapp.com"
    GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None

    # Stripe Payments
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_BASIC_PRICE_ID: str = "price_basic_monthly"
    STRIPE_PRO_PRICE_ID: str = "price_pro_monthly"
    STRIPE_AGENCY_PRICE_ID: str = "price_agency_monthly"
    STRIPE_BASIC_YEARLY_PRICE_ID: str = "price_basic_yearly"
    STRIPE_PRO_YEARLY_PRICE_ID: str = "price_pro_yearly"
    STRIPE_AGENCY_YEARLY_PRICE_ID: str = "price_agency_yearly"

    # Stripe environment variable overrides
    STRIPE_PRICE_BASIC_MONTHLY: Optional[str] = None
    STRIPE_PRICE_BASIC_YEARLY: Optional[str] = None
    STRIPE_PRICE_PRO_MONTHLY: Optional[str] = None
    STRIPE_PRICE_PRO_YEARLY: Optional[str] = None
    STRIPE_PRICE_AGENCY_MONTHLY: Optional[str] = None
    STRIPE_PRICE_AGENCY_YEARLY: Optional[str] = None

    # Gateway Routing & Multi-Provider Settings
    DEFAULT_PAYMENT_PROVIDER: str = "razorpay"  # "razorpay" or "stripe"
    ENABLE_STRIPE: bool = True
    ENABLE_RAZORPAY: bool = True

    # Razorpay Payments & Billing
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    RAZORPAY_WEBHOOK_SECRET: Optional[str] = None

    # Razorpay Plan IDs (Managed in Razorpay Dashboard)
    RAZORPAY_PLAN_BASIC_MONTHLY: str = "plan_basic_monthly_inr"
    RAZORPAY_PLAN_BASIC_YEARLY: str = "plan_basic_yearly_inr"
    RAZORPAY_PLAN_PRO_MONTHLY: str = "plan_pro_monthly_inr"
    RAZORPAY_PLAN_PRO_YEARLY: str = "plan_pro_yearly_inr"
    RAZORPAY_PLAN_AGENCY_MONTHLY: str = "plan_agency_monthly_inr"
    RAZORPAY_PLAN_AGENCY_YEARLY: str = "plan_agency_yearly_inr"

    # Configurable INR Pricing (stored in paise: ₹1 = 100 paise)
    PRICE_INR_BASIC_MONTHLY: int = 79900
    PRICE_INR_BASIC_YEARLY: int = 799000
    PRICE_INR_PRO_MONTHLY: int = 399900
    PRICE_INR_PRO_YEARLY: int = 3999000
    PRICE_INR_AGENCY_MONTHLY: int = 799900
    PRICE_INR_AGENCY_YEARLY: int = 7999000


    # Transactional Email Service (Resend Only)
    RESEND_API_KEY: Optional[str] = None
    RESEND_API_BASE_URL: str = "https://api.resend.com/emails"
    RESEND_WEBHOOK_SECRET: Optional[str] = None
    EMAIL_FROM: str = "SiteSecura <alerts@sitesecura.com>"
    EMAIL_FROM_NAME: str = "SiteSecura Security"
    EMAIL_REPLY_TO: Optional[str] = "support@sitesecura.com"

    # Reliability, Retries & Timeouts
    EMAIL_TIMEOUT_SECONDS: float = 10.0
    EMAIL_MAX_RETRIES: int = 3
    EMAIL_RETRY_BACKOFF_SECONDS: float = 2.0
    EMAIL_MAX_ATTEMPTS: int = 3

    # Storage
    STORAGE_PATH: str = "./storage/reports"
    MEDIA_ROOT: str = "./storage/media"
    MEDIA_PUBLIC_URL_PREFIX: str = "/api/v1/media"
    MAX_IMAGE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB
    MAX_IMAGE_DIMENSION: int = 4096  # Max width/height in pixels
    MAX_IMAGE_PIXELS: int = 16_000_000  # Max pixel count (prevents decompression bombs)

    # AI Security Advisor Configuration
    AI_ENABLED: bool = True
    AI_PRIMARY_PROVIDER: str = "groq1"
    AI_PROVIDER_ORDER: str = "groq1,groq2,gemini"
    AI_ENABLE_FALLBACK: bool = True
    AI_LOG_PROVIDER_USAGE: bool = True

    # Groq Provider #1 (Primary)
    GROQ1_API_KEY: Optional[str] = None
    GROQ1_MODEL: str = "llama-3.3-70b-versatile"
    GROQ1_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Groq Provider #2 (Fallback)
    GROQ2_API_KEY: Optional[str] = None
    GROQ2_MODEL: str = "openai/gpt-oss-120b"
    GROQ2_BASE_URL: str = "https://api.groq.com/openai/v1"

    # Gemini Provider (Final Fallback)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"

    # AI Runtime Controls
    AI_REQUEST_TIMEOUT_SECONDS: float = 30.0
    AI_MAX_OUTPUT_TOKENS: int = 2000
    AI_TEMPERATURE: float = 0.2
    AI_MAX_RETRIES: int = 1
    AI_MAX_CONTEXT_CHARS: int = 16000
    AI_SYSTEM_PROMPT_VERSION: str = "v1"

    # AI Quotas & Rate Limits
    AI_RATE_LIMIT_PER_USER: int = 20  # req/min
    AI_MONTHLY_LIMIT_PRO: int = 100
    AI_MONTHLY_LIMIT_AGENCY: int = 500

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://sitesecura.com",
        "https://app.sitesecura.com",
        "https://scanly.io",
        "https://app.scanly.io",
    ]

    @property
    def cors_origins(self) -> List[str]:
        """
        Returns active CORS origins.
        In production, strictly strips localhost/loopback origins.
        Appends NEXT_PUBLIC_APP_URL if defined and valid.
        """
        origins = list(self.CORS_ORIGINS)
        if self.NEXT_PUBLIC_APP_URL and self.NEXT_PUBLIC_APP_URL not in origins:
            origins.append(self.NEXT_PUBLIC_APP_URL)
        if self.ENVIRONMENT.lower() in ("production", "prod"):
            origins = [
                o for o in origins
                if not (o.startswith("http://localhost") or o.startswith("http://127.0.0.1"))
            ]
        return origins

    def validate_production_configuration(self) -> List[str]:
        """
        Validates critical configuration parameters when running in production.
        Fails fast if critical production settings are missing, insecure, or using development defaults.
        Returns a list of non-blocking warnings for deferred/optional configurations.
        Raises ValueError for critical blocking misconfigurations.
        """
        if self.ENVIRONMENT.lower() not in ("production", "prod"):
            return []

        errors = []
        warnings = []

        # 1. SECRET_KEY
        if not self.SECRET_KEY or self.SECRET_KEY == "development-secret-key-scanly-replace-in-production":
            errors.append("SECRET_KEY must be set to a secure unique random secret in production.")
        elif len(self.SECRET_KEY) < 32:
            errors.append("SECRET_KEY must be at least 32 characters long in production.")

        # 2. DATABASE_URL
        if "scanly_dev_password" in self.DATABASE_URL or "scanly_dev_password" in self.DATABASE_URL_SYNC:
            errors.append("DATABASE_URL contains development default password 'scanly_dev_password'.")
        if self.DATABASE_URL.startswith("sqlite"):
            errors.append("Production database cannot be SQLite.")

        # 3. REDIS_URL
        if not self.REDIS_URL:
            errors.append("REDIS_URL must be specified in production.")

        # 4. FIREBASE CONFIGURATION
        if not self.FIREBASE_PROJECT_ID:
            errors.append("FIREBASE_PROJECT_ID must be specified in production.")

        # 5. URL CONFIGURATION
        if "localhost" in self.NEXT_PUBLIC_APP_URL or "127.0.0.1" in self.NEXT_PUBLIC_APP_URL:
            errors.append(f"NEXT_PUBLIC_APP_URL cannot point to localhost in production (found: {self.NEXT_PUBLIC_APP_URL}).")
        if "localhost" in self.API_URL or "127.0.0.1" in self.API_URL:
            warnings.append(f"API_URL points to localhost in production (found: {self.API_URL}). Ensure reverse proxy is configured.")

        # 6. CORS ORIGINS
        for origin in self.cors_origins:
            if origin == "*":
                errors.append("CORS wildcard '*' is prohibited with credentials in production.")

        # 7. EMAIL SERVICE PRODUCTION VALIDATION (Resend Only, Fail-closed)
        if not self.RESEND_API_KEY or self.RESEND_API_KEY.startswith("re_test_placeholder") or self.RESEND_API_KEY.startswith("re_placeholder"):
            errors.append("RESEND_API_KEY must be configured with a valid live key in production.")

        # Sender configuration safety
        if not self.EMAIL_FROM or "@" not in self.EMAIL_FROM:
            errors.append("EMAIL_FROM must be configured with a valid sender email address in production.")
        elif "example.com" in self.EMAIL_FROM.lower() or "localhost" in self.EMAIL_FROM.lower():
            errors.append(f"EMAIL_FROM cannot use development placeholder domain in production (found: {self.EMAIL_FROM}).")

        # 8. Non-blocking warnings for deferred/optional services
        if not self.STRIPE_SECRET_KEY and not self.RAZORPAY_KEY_SECRET:
            warnings.append("Payment gateway credentials deferred (founder decision). Live paid checkout disabled.")

        if errors:
            raise ValueError(
                "CRITICAL PRODUCTION CONFIGURATION ERROR:\n- " + "\n- ".join(errors)
            )

        return warnings

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()

