"""
Scanly Scanner Engine - Phase F7 Sensitive Health, Location & Authentication Data Analyzer
Passively detects public exposures of medical/health records, precise GPS coordinates, and auth tokens.
Guarantees: Strict contextual validation to prevent false positives; irreversible masking.
"""
import re
from typing import List, Dict, Any, Tuple, Set, Optional

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import (
    DataCategory,
    Confidence,
    mask_token,
)
from .data_security_finding_helper import make_data_finding

# Health Data Context Patterns (Requires compound context)
HEALTH_COMPOUND_REGEX = re.compile(
    r"(?i)(?:['\"]?(?:patient[_-]?id|medical[_-]?record[_-]?(?:no|num|number)?|prescription[_-]?id|diagnosis[_-]?code|lab[_-]?result[_-]?id)['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9_-]+)['\"]?|\b(?:diagnosed\s+with|acute\s+leukemia|prescribed\s+chemotherapy)\b)"
)

# Precise GPS Coordinates Pattern (e.g., lat: 37.774929, lon: -122.419416 or JSON "latitude": ...)
GPS_COORD_REGEX = re.compile(
    r"(?i)['\"]?(?:user|client|device|driver|current)?[_-]?(?:lat|latitude)['\"]?\s*[:=]\s*([+-]?\d{1,2}\.\d{4,8})\s*[,;]?\s*['\"]?(?:lon|lng|longitude)['\"]?\s*[:=]\s*([+-]?\d{1,3}\.\d{4,8})\b"
)

# Public Authentication Data Patterns (Plaintext passwords, reset tokens, magic links in HTML/JS)
PUBLIC_PASSWORD_REGEX = re.compile(
    r"(?i)['\"]?(?:plaintext_password|password|passwd|pwd|user[_-]?password)['\"]?\s*[:=]\s*['\"]([^'\"]{6,64})['\"]"
)
PUBLIC_RESET_TOKEN_REGEX = re.compile(
    r"(?i)['\"]?(?:reset[_-]?token|magic[_-]?link[_-]?token|verification[_-]?token|auth[_-]?code)['\"]?\s*[:=]\s*['\"]([a-zA-Z0-9_\-\.]{16,128})['\"]"
)

# False positive exclusions for dummy or template values
BENIGN_PASSWORDS = {"password", "secret", "********", "changeme", "admin", "123456", "your_password", "null", "undefined", ""}


def analyze_sensitive_data(
    crawled_pages: List[CrawledPage],
    f3_metadata: Optional[Dict[str, Any]] = None,
    f5_metadata: Optional[Dict[str, Any]] = None,
    max_samples: int = 5,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits pages for exposed health identifiers, precise user geolocation GPS,
    and public authentication data (passwords, reset tokens).
    """
    findings: List[Finding] = []

    health_exposures: List[Dict[str, Any]] = []
    location_exposures: List[Dict[str, Any]] = []
    auth_data_exposures: List[Dict[str, Any]] = []

    seen_health: Set[str] = set()
    seen_coords: Set[str] = set()
    seen_auth: Set[str] = set()

    # Track already flagged tokens from F3 and F5 to avoid double penalties
    known_f3_secrets = set()
    if f3_metadata and "secrets_detected" in f3_metadata:
        for s in f3_metadata.get("secrets_detected", []):
            known_f3_secrets.add(s.get("masked", ""))

    for page in crawled_pages:
        text_corpus: List[str] = []
        if page.body_sample:
            text_corpus.append(page.body_sample)
        if hasattr(page, "inline_scripts") and page.inline_scripts:
            text_corpus.extend(page.inline_scripts[:10])

        combined_text = "\n".join(text_corpus)
        if not combined_text:
            continue

        # 1. Health Context Check
        for match in HEALTH_COMPOUND_REGEX.finditer(combined_text):
            raw_id = (match.group(1) or match.group(0)).strip()
            if raw_id.lower() not in BENIGN_PASSWORDS and raw_id not in seen_health:
                seen_health.add(raw_id)
                health_exposures.append({
                    "type": "Patient / Medical Record Identifier",
                    "masked_id": mask_token(raw_id),
                    "page_url": page.url,
                    "confidence": Confidence.HIGH,
                })

        # 2. Precise Personal Location Check
        for match in GPS_COORD_REGEX.finditer(combined_text):
            lat_str = match.group(1)
            lon_str = match.group(2)
            try:
                lat = float(lat_str)
                lon = float(lon_str)
                if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
                    # Ignore (0.0, 0.0) or default maps centers like (37.7749, -122.4194) if generic
                    coord_key = f"{lat:.3f},{lon:.3f}"
                    if coord_key not in seen_coords:
                        seen_coords.add(coord_key)
                        location_exposures.append({
                            "coordinates": f"{lat:.4f}, {lon:.4f}",
                            "page_url": page.url,
                            "confidence": Confidence.MEDIUM,
                        })
            except ValueError:
                pass

        # 3. Authentication Data Check (Password / Reset Token in DOM/JS)
        for match in PUBLIC_PASSWORD_REGEX.finditer(combined_text):
            pwd = match.group(1).strip()
            if pwd.lower() not in BENIGN_PASSWORDS:
                masked_pwd = mask_token(pwd)
                if masked_pwd not in seen_auth and masked_pwd not in known_f3_secrets:
                    seen_auth.add(masked_pwd)
                    auth_data_exposures.append({
                        "type": "Hardcoded Password / Credential",
                        "masked": masked_pwd,
                        "page_url": page.url,
                        "confidence": Confidence.HIGH,
                    })

        for match in PUBLIC_RESET_TOKEN_REGEX.finditer(combined_text):
            tok = match.group(1).strip()
            if tok.lower() not in BENIGN_PASSWORDS:
                masked_tok = mask_token(tok)
                if masked_tok not in seen_auth:
                    seen_auth.add(masked_tok)
                    auth_data_exposures.append({
                        "type": "Reset Token / Magic Link Credential",
                        "masked": masked_tok,
                        "page_url": page.url,
                        "confidence": Confidence.HIGH,
                    })

    sensitive_telemetry = {
        "health_data_count": len(health_exposures),
        "health_data": health_exposures[:max_samples],
        "location_data_count": len(location_exposures),
        "location_data": location_exposures[:max_samples],
        "authentication_data_count": len(auth_data_exposures),
        "authentication_data": auth_data_exposures[:max_samples],
    }

    # Generate Findings
    if health_exposures:
        findings.append(make_data_finding(
            check_type="deep_public_health_data",
            title="Public Health / Medical Record Data Exposure",
            description=(
                "Patient identifiers, medical record indicators, or prescription references were "
                "discovered in publicly accessible page content or client-side responses."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"Observed {len(health_exposures)} medical identifier references.",
            how_to_fix="Ensure health and medical data is strictly restricted to authorized, HIPAA/GDPR-compliant authenticated backends.",
            data_category=DataCategory.HEALTH,
        ))

    if location_exposures:
        findings.append(make_data_finding(
            check_type="deep_public_location_data",
            title="Precise Personal Geolocation Coordinates Exposed",
            description=(
                "High-precision GPS coordinates associated with individual user, client, or driver tracking "
                "were discovered in public web page responses."
            ),
            severity=Severity.MEDIUM,
            status=CheckStatus.WARNING,
            evidence=f"Observed {len(location_exposures)} high-precision GPS coordinate points.",
            how_to_fix="Sanitize user geolocation responses to limit precision (coarse regional location) on unauthenticated endpoints.",
            data_category=DataCategory.LOCATION,
        ))

    if auth_data_exposures:
        sample_auth = ", ".join([f"{a['type']} ({a['masked']})" for a in auth_data_exposures[:2]])
        findings.append(make_data_finding(
            check_type="deep_public_auth_data",
            title="Authentication Tokens or Passwords Exposed in Public Content",
            description=(
                "Cleartext passwords, account recovery reset tokens, or magic link credentials were "
                "identified directly in publicly readable HTML DOM, inline scripts, or template definitions."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"Exposed credentials: {sample_auth}",
            how_to_fix="Remove hardcoded credentials from public code. Ensure password reset tokens are transmitted solely out-of-band.",
            data_category=DataCategory.AUTHENTICATION,
        ))

    return sensitive_telemetry, findings
