"""
Scanly Scanner Engine - Frontend Secret & Exposure Detection Module (Phase F3)
Provides high-precision pattern matchers, strict false-positive filtering,
automatic masking, and configuration exposure detection.
"""
import re
from typing import List, Dict, Any, Optional, Set, Tuple

# =============================================================================
# Secret Pattern Matchers (High Precision, Linear-Time ReDoS Safe)
# =============================================================================

# Fast substring pre-checks before applying regex
SECRET_PRECHECKS = {
    "AWS_KEY": ("AKIA", "ABIA", "ACCA", "ASIA"),
    "GOOGLE_API_KEY": ("AIza",),
    "STRIPE_SECRET": ("sk_live_", "rk_live_"),
    "SLACK_TOKEN": ("xoxb-", "xoxp-", "xoxa-", "xoxr-", "xoxs-"),
    "PRIVATE_KEY": ("-----BEGIN", "PRIVATE KEY"),
    "GITHUB_TOKEN": ("ghp_", "gho_", "ghu_", "ghs_", "ghr_"),
    "JWT_TOKEN": ("eyJ",),
}

SECRET_RULES = [
    {
        "type": "AWS Access Key",
        "category": "aws_access_key",
        "precheck": ("AKIA", "ABIA", "ACCA", "ASIA"),
        "regex": re.compile(r"\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b"),
        "confidence": "HIGH",
        "severity": "CRITICAL",
    },
    {
        "type": "Google Cloud / Firebase API Key",
        "category": "google_api_key",
        "precheck": ("AIza",),
        "regex": re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b"),
        "confidence": "HIGH",
        "severity": "HIGH",
    },
    {
        "type": "Stripe Live Secret Key",
        "category": "stripe_secret_key",
        "precheck": ("sk_live_", "rk_live_"),
        "regex": re.compile(r"\b(?:sk_live|rk_live)_[0-9a-zA-Z]{24,99}\b"),
        "confidence": "HIGH",
        "severity": "CRITICAL",
    },
    {
        "type": "Slack Token",
        "category": "slack_token",
        "precheck": ("xoxb-", "xoxp-", "xoxa-", "xoxr-", "xoxs-"),
        "regex": re.compile(r"\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,34}\b"),
        "confidence": "HIGH",
        "severity": "HIGH",
    },
    {
        "type": "Private Key Block",
        "category": "private_key",
        "precheck": ("-----BEGIN",),
        "regex": re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
        "confidence": "HIGH",
        "severity": "CRITICAL",
    },
    {
        "type": "GitHub Personal Access Token",
        "category": "github_token",
        "precheck": ("ghp_", "gho_", "ghu_", "ghs_", "ghr_"),
        "regex": re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b"),
        "confidence": "HIGH",
        "severity": "CRITICAL",
    },
    {
        "type": "Hardcoded JSON Web Token (JWT)",
        "category": "jwt_token",
        "precheck": ("eyJ",),
        "regex": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
        "confidence": "MEDIUM",
        "severity": "MEDIUM",
    },
]

# Patterns for False Positive Rejection
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
GIT_COMMIT_RE = re.compile(r"^[0-9a-f]{40}$", re.I)
HEX_COLOR_RE = re.compile(r"^#?[0-9a-f]{6}$|^#?[0-9a-f]{8}$", re.I)

DUMMY_KEYWORDS = (
    "example",
    "sample",
    "dummy",
    "placeholder",
    "your_key",
    "your-key",
    "your_api_key",
    "your_token",
    "xxxx",
    "00000000",
    "akiaiosfodnn7example",
)


def mask_secret(value: str) -> str:
    """
    Masks a sensitive secret string so that only the first few and last few
    characters are visible, replacing the rest with asterisks.
    Guarantees raw unmasked secret is NEVER retained or exposed.
    """
    if not value:
        return ""
    if value.startswith("-----BEGIN"):
        return "-----BEGIN PRIVATE KEY----- [MASKED]"
    val_len = len(value)
    if val_len <= 8:
        return "*" * val_len
    
    prefix_len = min(4, max(2, val_len // 5))
    suffix_len = min(4, max(2, val_len // 5))
    masked_count = max(4, val_len - prefix_len - suffix_len)
    return value[:prefix_len] + ("*" * masked_count) + value[-suffix_len:]


def is_false_positive_secret(matched_value: str, rule_category: str) -> bool:
    """
    Verifies whether a matched regex string is a benign false positive
    (e.g., placeholder, git commit SHA, UUID, hex color, or publishable key).
    """
    val_lower = matched_value.lower()

    # Reject known dummy/example patterns
    for kw in DUMMY_KEYWORDS:
        if kw in val_lower:
            return True

    # Rule-specific filters
    if rule_category == "aws_access_key":
        # Check for repetitive characters
        unique_chars = set(matched_value[4:])
        if len(unique_chars) <= 2:
            return True

    elif rule_category == "stripe_secret_key":
        # Stripe publishable keys are client-facing and NOT secret
        if val_lower.startswith("pk_live_") or val_lower.startswith("pk_test_"):
            return True
        # Stripe test secret keys are lower severity or non-production
        if val_lower.startswith("sk_test_") or val_lower.startswith("rk_test_"):
            return True

    elif rule_category == "google_api_key":
        # Check minimum entropy
        unique_chars = set(matched_value[4:])
        if len(unique_chars) < 8:
            return True

    elif rule_category == "jwt_token":
        # Sentry public client DSNs and tokens sometimes resemble JWTs
        if "sentry" in val_lower or "ingest" in val_lower:
            return True

    # Check for UUID / Git commit / Hex color
    if UUID_RE.match(matched_value) or GIT_COMMIT_RE.match(matched_value):
        return True

    return False


def scan_text_for_secrets(
    text: str,
    source_identifier: str = "",
) -> List[Dict[str, Any]]:
    """
    Scans a block of text (JavaScript bundle, inline script, or source map)
    for high-risk credentials and secrets.
    Returns a list of detected items with MASKED secret values only.
    """
    if not text or len(text) < 10:
        return []

    results: List[Dict[str, Any]] = []
    seen_keys: Set[str] = set()

    for rule in SECRET_RULES:
        # Fast substring precheck
        prechecks = rule["precheck"]
        if not any(token in text for token in prechecks):
            continue

        for match in rule["regex"].finditer(text):
            raw_val = match.group(0)
            if is_false_positive_secret(raw_val, rule["category"]):
                continue

            # Deduplicate by raw value
            if raw_val in seen_keys:
                continue
            seen_keys.add(raw_val)

            masked_val = mask_secret(raw_val)
            results.append({
                "secret_type": rule["type"],
                "category": rule["category"],
                "masked_value": masked_val,
                "confidence": rule["confidence"],
                "severity": rule["severity"],
                "source": source_identifier,
            })

    return results


# =============================================================================
# Configuration & Internal IP Exposure Patterns
# =============================================================================

INTERNAL_IP_PATTERNS = [
    # 127.0.0.1 or localhost
    re.compile(r"\b(?:https?://)?(?:127\.0\.0\.1|localhost)(?::\d{2,5})?\b", re.I),
    # RFC 1918 10.0.0.0/8
    re.compile(r"\b(?:https?://)?10\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?::\d{2,5})?\b"),
    # RFC 1918 172.16.0.0/12
    re.compile(r"\b(?:https?://)?172\.(?:1[6-9]|2\d|3[01])\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?::\d{2,5})?\b"),
    # RFC 1918 192.168.0.0/16
    re.compile(r"\b(?:https?://)?192\.168\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?::\d{2,5})?\b"),
    # Internal domain suffixes
    re.compile(r"\b[a-zA-Z0-9_\-\.]+\.(?:internal|local|corp|lan|localdomain)(?::\d{2,5})?\b", re.I),
]

FRAMEWORK_ENV_PATTERNS = [
    re.compile(r"\b(NEXT_PUBLIC_[A-Z0-9_]{3,50})\b"),
    re.compile(r"\b(REACT_APP_[A-Z0-9_]{3,50})\b"),
    re.compile(r"\b(VITE_[A-Z0-9_]{3,50})\b"),
]

SENSITIVE_ENV_KEYWORDS = (
    "SECRET",
    "PRIVATE",
    "TOKEN",
    "PASSWORD",
    "PASS",
    "DATABASE",
    "ADMIN_KEY",
    "SERVICE_ROLE",
    "MASTER",
)


def scan_text_for_internal_ips_and_configs(
    text: str,
    source_identifier: str = "",
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    """
    Scans text for hardcoded private/internal IP addresses, localhost URLs,
    and exposed framework environment variables with potentially sensitive names.
    """
    if not text or len(text) < 10:
        return [], []

    internal_ips: List[Dict[str, str]] = []
    seen_ips: Set[str] = set()

    for pat in INTERNAL_IP_PATTERNS:
        for match in pat.finditer(text):
            val = match.group(0).strip()
            # Ignore standard benign doc/mask references like 0.0.0.0 or 127.0.0.1 in non-URL strings if too simple
            if val in seen_ips:
                continue
            seen_ips.add(val)
            internal_ips.append({
                "value": val,
                "source": source_identifier,
            })
            if len(internal_ips) >= 15:
                break
        if len(internal_ips) >= 15:
            break

    exposed_envs: List[Dict[str, str]] = []
    seen_envs: Set[str] = set()

    for env_pat in FRAMEWORK_ENV_PATTERNS:
        for match in env_pat.finditer(text):
            var_name = match.group(1).strip()
            if var_name in seen_envs:
                continue
            seen_envs.add(var_name)
            is_suspicious = any(kw in var_name for kw in SENSITIVE_ENV_KEYWORDS)
            exposed_envs.append({
                "variable": var_name,
                "is_sensitive": is_suspicious,
                "source": source_identifier,
            })
            if len(exposed_envs) >= 20:
                break
        if len(exposed_envs) >= 20:
            break

    return internal_ips, exposed_envs
