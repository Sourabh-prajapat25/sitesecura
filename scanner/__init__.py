"""
Scanly Scanner Engine Package
"""
from .models import ScanResult, Finding, CheckStatus, Severity, RiskLevel
from .domain import normalize_domain, is_safe_ip, resolve_and_validate_target, SSRFValidationError
from .recommendations import RECOMMENDATIONS_CATALOG, get_recommendation
from .runner import run_security_scan

__all__ = [
    "ScanResult",
    "Finding",
    "CheckStatus",
    "Severity",
    "RiskLevel",
    "normalize_domain",
    "is_safe_ip",
    "resolve_and_validate_target",
    "SSRFValidationError",
    "RECOMMENDATIONS_CATALOG",
    "get_recommendation",
    "run_security_scan",
]
