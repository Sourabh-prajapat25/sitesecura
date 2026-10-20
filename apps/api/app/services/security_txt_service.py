"""
Scanly API - Standalone security.txt Validator Service
Validates security.txt files against RFC 9116 specification:
- Safe HTTPS-only fetching with socket connection pinning (SafeSyncBackend + SafeResolver)
- Enforces strict SSRF defenses (blocks loopback, private RFC 1918, link-local, cloud metadata)
- Primary standard location: /.well-known/security.txt
- Secondary fallback location: /security.txt (used only if primary is absent)
- Streaming response size cap (max 64 KiB)
- Full RFC 9116 syntax, required directives (Contact, Expires), optional directives,
  URI verification, timezone-aware expiration calculation, and finding categorizations.
Does NOT invoke the full SiteSecura perimeter scanner.
"""
import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urljoin, urlparse

import ssl
import httpcore
import httpx

from app.schemas.tools import (
    ALLOWED_HTTP_PORTS,
    SecurityTxtField,
    SecurityTxtFinding,
    SecurityTxtSummary,
    SecurityTxtValidateResponse,
)
from scanner.network.safety import (
    validate_hostname,
    is_safe_ip,
    SSRFValidationError,
)
from scanner.network.resolver import BaseResolver, SafeResolver
from scanner.network.http_client import SafeSyncBackend

logger = logging.getLogger(__name__)

# RFC 9116 resource limits
MAX_FILE_BYTES = 65536  # 64 KiB
MAX_REDIRECTS = 5
DEFAULT_CONNECT_TIMEOUT = 3.0
DEFAULT_READ_TIMEOUT = 5.0

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SiteSecura-SecurityTxtValidator/1.0"
)

# Canonical field name casing for recognized RFC 9116 directives
FIELD_NAME_CANONICAL = {
    "contact": "Contact",
    "expires": "Expires",
    "encryption": "Encryption",
    "acknowledgments": "Acknowledgments",
    "preferred-languages": "Preferred-Languages",
    "canonical": "Canonical",
    "policy": "Policy",
    "hiring": "Hiring",
}

# Supported contact URI schemes
ALLOWED_CONTACT_SCHEMES = {"mailto", "https", "tel"}

# Valid directive name regex (RFC 9116 Section 2.1: letters, digits, hyphen)
FIELD_NAME_REGEX = re.compile(r"^[a-zA-Z0-9-]+$")


def _safe_fetch_single_url(
    target_url: str,
    resolver: BaseResolver,
    custom_transport: Optional[httpx.BaseTransport] = None,
    timeout: float = DEFAULT_READ_TIMEOUT,
) -> Tuple[str, Optional[int], Optional[str], Optional[int], Optional[str], Optional[str]]:
    """
    Safely retrieves a single security.txt URL candidate over HTTPS.
    Enforces socket-level TCP connection pinning, SSRF verification,
    and manual hop-by-hop redirects strictly capped at HTTPS destinations.
    Returns: (retrieval_status, http_status_code, content_type, content_length, body_text, error_message)
    """
    parsed = urlparse(target_url)
    if (parsed.scheme or "").lower() != "https":
        return ("blocked_target", None, None, None, None, "RFC 9116 Section 3 strictly requires HTTPS.")

    host = parsed.hostname
    if not host:
        return ("connection_error", None, None, None, None, "Invalid hostname.")

    port = parsed.port or 443
    if port not in ALLOWED_HTTP_PORTS:
        return ("blocked_target", None, None, None, None, f"Disallowed port '{port}'.")

    # Pre-resolve and verify safety of target IP candidates
    try:
        validated_host = validate_hostname(host)
        approved_ips = resolver.resolve(validated_host, port)
        if not approved_ips:
            return ("connection_error", None, None, None, None, f"Could not resolve IP for {validated_host}.")
    except SSRFValidationError as s_err:
        return ("blocked_target", None, None, None, None, f"SSRF Protection blocked destination: {str(s_err)}")
    except Exception as exc:
        return ("connection_error", None, None, None, None, f"DNS resolution failed: {str(exc)}")

    timeout_cfg = httpx.Timeout(
        connect=DEFAULT_CONNECT_TIMEOUT,
        read=timeout,
        write=timeout,
        pool=timeout,
    )

    req_headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/plain, text/*;q=0.9, */*;q=0.8",
        "Connection": "close",
    }

    # Setup transport
    backend = None
    if custom_transport is not None:
        transport = custom_transport
    else:
        backend = SafeSyncBackend(resolver)
        pool = httpcore.ConnectionPool(
            network_backend=backend,
            max_connections=3,
            max_keepalive_connections=0,
        )
        transport = httpx.HTTPTransport()
        transport._pool = pool

    current_url = target_url
    redirect_count = 0
    visited_urls = []

    try:
        with httpx.Client(
            transport=transport,
            timeout=timeout_cfg,
            follow_redirects=False,
            headers=req_headers,
            verify=True,
        ) as client:
            while True:
                if current_url in visited_urls:
                    return ("connection_error", None, None, None, None, "Redirect loop detected.")

                visited_urls.append(current_url)

                req = client.build_request("GET", current_url)
                resp = client._send_single_request(req)

                status_code = resp.status_code
                content_type = resp.headers.get("content-type")

                # Handle redirects hop-by-hop
                if status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    resp.close()

                    if not location:
                        return ("not_found", status_code, content_type, None, None, "Redirect without Location header.")

                    redirect_count += 1
                    if redirect_count > MAX_REDIRECTS:
                        return ("connection_error", status_code, content_type, None, None, f"Exceeded redirect limit ({MAX_REDIRECTS}).")

                    next_url = urljoin(current_url, location.strip())
                    next_parsed = urlparse(next_url)
                    next_scheme = (next_parsed.scheme or "").lower()

                    # RFC 9116 Section 3: Clients MUST NOT follow redirects to an HTTP URL
                    if next_scheme != "https":
                        return (
                            "blocked_target",
                            status_code,
                            content_type,
                            None,
                            None,
                            "Redirect to unencrypted HTTP URL is strictly prohibited by RFC 9116 Section 3.",
                        )

                    next_host = next_parsed.hostname
                    if not next_host:
                        return ("blocked_target", status_code, content_type, None, None, "Redirect destination has no valid hostname.")

                    next_port = next_parsed.port or 443
                    if next_port not in ALLOWED_HTTP_PORTS:
                        return ("blocked_target", status_code, content_type, None, None, f"Redirect to disallowed port '{next_port}'.")

                    # Verify SSRF on redirect destination before connecting
                    try:
                        valid_next_host = validate_hostname(next_host)
                        next_ips = resolver.resolve(valid_next_host, next_port)
                        if not next_ips:
                            return ("blocked_target", status_code, content_type, None, None, f"Could not resolve destination {valid_next_host}.")
                    except (SSRFValidationError, ValueError) as ssrf_err:
                        return ("blocked_target", status_code, content_type, None, None, f"Redirect to unsafe destination blocked by SSRF policy: {str(ssrf_err)}")
                    except Exception as e:
                        return ("connection_error", status_code, content_type, None, None, f"DNS resolution failed for redirect: {str(e)}")

                    current_url = next_url
                    continue

                # Terminal response reached
                content_len_hdr = resp.headers.get("content-length")
                if content_len_hdr and content_len_hdr.isdigit() and int(content_len_hdr) > MAX_FILE_BYTES:
                    resp.close()
                    return ("oversized", status_code, content_type, int(content_len_hdr), None, f"File exceeds maximum allowed size of {MAX_FILE_BYTES} bytes.")

                # Stream response body bounded by MAX_FILE_BYTES
                body_bytes = b""
                try:
                    for chunk in resp.iter_bytes(chunk_size=4096):
                        body_bytes += chunk
                        if len(body_bytes) > MAX_FILE_BYTES:
                            resp.close()
                            return ("oversized", status_code, content_type, len(body_bytes), None, f"File content exceeded {MAX_FILE_BYTES} bytes during streaming.")
                finally:
                    resp.close()

                actual_len = len(body_bytes)
                body_text = body_bytes.decode("utf-8", errors="replace")

                # Detect if the server returned an HTML error/webpage instead of plaintext
                lowered_start = body_text[:500].lower().strip()
                if lowered_start.startswith("<!doctype html") or lowered_start.startswith("<html") or "<head>" in lowered_start:
                    if status_code == 200:
                        return ("html_response", 200, content_type, actual_len, body_text, "Server returned an HTML document instead of a plaintext security.txt file.")

                if status_code == 200:
                    return ("retrieved", 200, content_type, actual_len, body_text, None)
                elif status_code == 404:
                    return ("not_found", 404, content_type, actual_len, None, "File not found (HTTP 404).")
                elif status_code == 403:
                    return ("forbidden", 403, content_type, actual_len, None, "Access forbidden (HTTP 403).")
                elif status_code == 429:
                    return ("rate_limited", 429, content_type, actual_len, None, "Target server rate limited the request (HTTP 429).")
                elif status_code >= 500:
                    return ("server_error", status_code, content_type, actual_len, None, f"Target server returned error HTTP {status_code}.")
                else:
                    return ("not_found", status_code, content_type, actual_len, None, f"Server returned unexpected HTTP {status_code}.")

    except httpx.TimeoutException:
        return ("timeout", None, None, None, None, "Request timed out while connecting or reading response.")
    except (httpx.ConnectError, ssl.SSLError) as conn_err:
        err_msg = str(conn_err)
        if "certificate" in err_msg.lower() or "ssl" in err_msg.lower():
            return ("tls_error", None, None, None, None, f"TLS certificate validation failed: {err_msg}")
        return ("connection_error", None, None, None, None, f"Connection failed: {err_msg}")
    except Exception as gen_err:
        return ("connection_error", None, None, None, None, f"Failed to retrieve file: {str(gen_err)}")


def parse_and_validate_security_txt(
    content: str,
    now_utc: Optional[datetime] = None,
) -> Tuple[List[SecurityTxtField], List[SecurityTxtFinding], Optional[str], Optional[bool], Optional[int]]:
    """
    Parses and validates security.txt content text strictly against RFC 9116 rules.
    Returns: (fields, findings, expires_at_iso, is_expired, days_until_expiration)
    """
    reference_time = now_utc or datetime.now(timezone.utc)

    fields: List[SecurityTxtField] = []
    findings: List[SecurityTxtFinding] = []

    contact_occurrences: List[Tuple[int, str]] = []
    expires_occurrences: List[Tuple[int, str]] = []
    languages_occurrences: List[Tuple[int, str]] = []

    expires_at_iso: Optional[str] = None
    is_expired: Optional[bool] = None
    days_until_expiration: Optional[int] = None

    lines = content.splitlines()
    in_pgp_signature = False

    for line_idx, raw_line in enumerate(lines, 1):
        line = raw_line.strip()

        # Handle OpenPGP cleartext signature lines gracefully without treating as errors
        if line.startswith("-----BEGIN PGP SIGNED MESSAGE-----"):
            continue
        if line.startswith("-----BEGIN PGP SIGNATURE-----"):
            in_pgp_signature = True
            continue
        if line.startswith("-----END PGP SIGNATURE-----"):
            in_pgp_signature = False
            continue
        if in_pgp_signature:
            continue
        if line.startswith("Hash:"):
            continue

        # Skip blank lines and full comment lines (RFC 9116 Section 2.1)
        if not line or line.startswith("#"):
            continue

        # Each valid directive MUST have a colon separator
        if ":" not in line:
            findings.append(
                SecurityTxtFinding(
                    code="MALFORMED_LINE",
                    severity="error",
                    title="Malformed Directive Line",
                    message=f"Line {line_idx} does not contain a field-name and value separated by a colon: '{line[:80]}'.",
                    line_number=line_idx,
                    field_name=None,
                    recommendation="Directives must follow the 'Field-Name: Field-Value' syntax. Prepend with '#' if intended as a comment.",
                    reference="RFC 9116 Section 2.1",
                )
            )
            continue

        name_part, val_part = line.split(":", 1)
        raw_name = name_part.strip()
        field_val = val_part.strip()

        # Validate directive name format
        if not FIELD_NAME_REGEX.match(raw_name):
            findings.append(
                SecurityTxtFinding(
                    code="INVALID_FIELD_NAME",
                    severity="error",
                    title="Invalid Field Name Syntax",
                    message=f"Line {line_idx} contains invalid field name '{raw_name}'. Directives may only contain alphanumeric characters and hyphens.",
                    line_number=line_idx,
                    field_name=raw_name,
                    recommendation="Use standard RFC 9116 directive names (e.g. Contact, Expires, Policy).",
                    reference="RFC 9116 Section 2.1",
                )
            )
            continue

        lower_name = raw_name.lower()
        canon_name = FIELD_NAME_CANONICAL.get(lower_name, raw_name)

        # Empty value check
        if not field_val:
            fields.append(
                SecurityTxtField(
                    name=canon_name,
                    value="",
                    line_number=line_idx,
                    is_valid=False,
                    description="Directive has an empty value",
                )
            )
            findings.append(
                SecurityTxtFinding(
                    code="EMPTY_FIELD_VALUE",
                    severity="error",
                    title=f"Empty Value for {canon_name}",
                    message=f"Directive '{canon_name}' on line {line_idx} does not provide a value.",
                    line_number=line_idx,
                    field_name=canon_name,
                    recommendation=f"Provide a valid value for {canon_name} or delete the line.",
                    reference="RFC 9116 Section 2",
                )
            )
            continue

        is_field_valid = True
        field_desc: Optional[str] = None

        # Field-specific RFC 9116 validation
        if lower_name == "contact":
            contact_occurrences.append((line_idx, field_val))
            parsed_c = urlparse(field_val)
            scheme = (parsed_c.scheme or "").lower()

            if scheme == "mailto":
                # Check email format
                if "@" in parsed_c.path:
                    field_desc = "Email contact URI"
                    findings.append(
                        SecurityTxtFinding(
                            code="CONTACT_VALID",
                            severity="success",
                            title="Valid Email Contact",
                            message=f"Contact URI '{field_val}' is a valid mailto: address.",
                            line_number=line_idx,
                            field_name="Contact",
                            reference="RFC 9116 Section 2.5.3",
                        )
                    )
                else:
                    is_field_valid = False
                    field_desc = "Invalid mailto URI"
                    findings.append(
                        SecurityTxtFinding(
                            code="CONTACT_INVALID_EMAIL",
                            severity="error",
                            title="Malformed Mailto URI in Contact",
                            message=f"Contact URI '{field_val}' is not a valid email address.",
                            line_number=line_idx,
                            field_name="Contact",
                            recommendation="Ensure format is 'mailto:security@example.com'.",
                            reference="RFC 9116 Section 2.5.3",
                        )
                    )

            elif scheme == "https":
                if parsed_c.hostname:
                    field_desc = "Web disclosure form / portal URL"
                    findings.append(
                        SecurityTxtFinding(
                            code="CONTACT_VALID",
                            severity="success",
                            title="Valid HTTPS Contact URL",
                            message=f"Contact URI '{field_val}' is a valid HTTPS link.",
                            line_number=line_idx,
                            field_name="Contact",
                            reference="RFC 9116 Section 2.5.3",
                        )
                    )
                else:
                    is_field_valid = False
                    field_desc = "Malformed HTTPS contact URL"
                    findings.append(
                        SecurityTxtFinding(
                            code="CONTACT_INVALID_URL",
                            severity="error",
                            title="Malformed HTTPS Contact URL",
                            message=f"Contact URL '{field_val}' has no valid hostname.",
                            line_number=line_idx,
                            field_name="Contact",
                            recommendation="Provide a valid HTTPS URL (e.g. https://example.com/security).",
                            reference="RFC 9116 Section 2.5.3",
                        )
                    )

            elif scheme == "http":
                is_field_valid = False
                field_desc = "Insecure HTTP contact URL"
                findings.append(
                    SecurityTxtFinding(
                        code="CONTACT_INSECURE_HTTP",
                        severity="error",
                        title="Insecure HTTP Contact URL",
                        message=f"Contact URL '{field_val}' uses unencrypted HTTP. RFC 9116 Section 2.5.3 strictly prohibits HTTP contact links.",
                        line_number=line_idx,
                        field_name="Contact",
                        recommendation=f"Update the contact link to use HTTPS: https://{field_val[7:]}",
                        reference="RFC 9116 Section 2.5.3",
                    )
                )

            elif scheme == "tel":
                field_desc = "Telephone contact URI"
                findings.append(
                    SecurityTxtFinding(
                        code="CONTACT_VALID",
                        severity="success",
                        title="Valid Telephone Contact",
                        message=f"Contact URI '{field_val}' is a valid telephone link.",
                        line_number=line_idx,
                        field_name="Contact",
                        reference="RFC 9116 Section 2.5.3",
                    )
                )

            elif "@" in field_val and not scheme:
                # Common omission: plain email without mailto:
                is_field_valid = False
                field_desc = "Missing mailto: scheme prefix"
                findings.append(
                    SecurityTxtFinding(
                        code="CONTACT_MISSING_SCHEME",
                        severity="warning",
                        title="Contact Email Missing 'mailto:' Scheme",
                        message=f"Contact value '{field_val}' appears to be an email address but lacks the required 'mailto:' URI scheme.",
                        line_number=line_idx,
                        field_name="Contact",
                        recommendation=f"Prepend with 'mailto:': mailto:{field_val}",
                        reference="RFC 9116 Section 2.5.3",
                    )
                )

            else:
                is_field_valid = False
                field_desc = "Unsupported contact URI scheme"
                findings.append(
                    SecurityTxtFinding(
                        code="CONTACT_UNSUPPORTED_SCHEME",
                        severity="error",
                        title="Unsupported Contact URI Scheme",
                        message=f"Contact value '{field_val}' is not a valid URI. RFC 9116 requires URI schemes mailto:, https:, or tel:.",
                        line_number=line_idx,
                        field_name="Contact",
                        recommendation="Use 'mailto:security@example.com' or 'https://example.com/security'.",
                        reference="RFC 9116 Section 2.5.3",
                    )
                )

        elif lower_name == "expires":
            expires_occurrences.append((line_idx, field_val))
            parsed_dt = None

            # Attempt ISO 8601 / RFC 3339 parsing
            norm_date = field_val.replace("Z", "+00:00")
            try:
                parsed_dt = datetime.fromisoformat(norm_date)
            except Exception:
                try:
                    # Fallback pattern parsing if needed
                    parsed_dt = datetime.strptime(field_val, "%Y-%m-%dT%H:%M:%S%z")
                except Exception:
                    pass

            if parsed_dt is None:
                is_field_valid = False
                field_desc = "Invalid date-time format"
                findings.append(
                    SecurityTxtFinding(
                        code="EXPIRES_INVALID_FORMAT",
                        severity="error",
                        title="Invalid Date Format in Expires",
                        message=f"Expires value '{field_val}' cannot be parsed as an RFC 3339 date-time.",
                        line_number=line_idx,
                        field_name="Expires",
                        recommendation="Format as RFC 3339 UTC timestamp, e.g. '2027-12-31T23:59:59.000Z'.",
                        reference="RFC 9116 Section 2.5.5",
                    )
                )
            else:
                if parsed_dt.tzinfo is None:
                    is_field_valid = False
                    field_desc = "Missing timezone in timestamp"
                    findings.append(
                        SecurityTxtFinding(
                            code="EXPIRES_MISSING_TIMEZONE",
                            severity="error",
                            title="Missing Timezone in Expires",
                            message=f"Expires value '{field_val}' lacks an explicit timezone offset.",
                            line_number=line_idx,
                            field_name="Expires",
                            recommendation="Add 'Z' for UTC, e.g. '2027-12-31T23:59:59.000Z'.",
                            reference="RFC 9116 Section 2.5.5",
                        )
                    )
                else:
                    utc_exp = parsed_dt.astimezone(timezone.utc)
                    expires_at_iso = utc_exp.isoformat()

                    if utc_exp < reference_time:
                        is_expired = True
                        is_field_valid = False
                        field_desc = f"Expired on {utc_exp.strftime('%Y-%m-%d')}"
                        findings.append(
                            SecurityTxtFinding(
                                code="EXPIRES_PASSED",
                                severity="error",
                                title="security.txt File Has Expired",
                                message=f"The file expired on {utc_exp.strftime('%Y-%m-%d %H:%M:%S UTC')}. RFC 9116 Section 2.5.5 directs researchers to consider expired files invalid.",
                                line_number=line_idx,
                                field_name="Expires",
                                recommendation="Update the Expires field to a future date.",
                                reference="RFC 9116 Section 2.5.5",
                            )
                        )
                    else:
                        is_expired = False
                        days_diff = (utc_exp - reference_time).days
                        days_until_expiration = days_diff
                        field_desc = f"Valid until {utc_exp.strftime('%Y-%m-%d')} ({days_diff} days left)"
                        findings.append(
                            SecurityTxtFinding(
                                code="EXPIRES_VALID",
                                severity="success",
                                title="Expiration Date is Valid and in Future",
                                message=f"File remains valid for {days_diff} days (until {utc_exp.strftime('%Y-%m-%d %H:%M:%S UTC')}).",
                                line_number=line_idx,
                                field_name="Expires",
                                reference="RFC 9116 Section 2.5.5",
                            )
                        )

                        if days_diff > 366:
                            findings.append(
                                SecurityTxtFinding(
                                    code="EXPIRES_TOO_FAR",
                                    severity="warning",
                                    title="Expiration Date Exceeds Recommended Limit",
                                    message=f"Expiration date is {days_diff} days in the future. RFC 9116 Section 2.5.5 recommends setting expiration within one year to prevent stale disclosure instructions.",
                                    line_number=line_idx,
                                    field_name="Expires",
                                    recommendation="Reduce expiration to less than 365 days from publication.",
                                    reference="RFC 9116 Section 2.5.5",
                                )
                            )

        elif lower_name == "canonical":
            parsed_canon = urlparse(field_val)
            if (parsed_canon.scheme or "").lower() != "https":
                is_field_valid = False
                field_desc = "Canonical URI must use HTTPS"
                findings.append(
                    SecurityTxtFinding(
                        code="CANONICAL_NOT_HTTPS",
                        severity="error",
                        title="Canonical URI Not HTTPS",
                        message=f"Canonical URI '{field_val}' must use the HTTPS scheme.",
                        line_number=line_idx,
                        field_name="Canonical",
                        recommendation="Update Canonical URI to use https://.",
                        reference="RFC 9116 Section 2.5.2",
                    )
                )
            else:
                field_desc = "Designated canonical location"
                findings.append(
                    SecurityTxtFinding(
                        code="CANONICAL_VALID",
                        severity="success",
                        title="Valid Canonical URI",
                        message=f"Canonical URI specified: {field_val}",
                        line_number=line_idx,
                        field_name="Canonical",
                        reference="RFC 9116 Section 2.5.2",
                    )
                )

        elif lower_name == "policy":
            parsed_pol = urlparse(field_val)
            if (parsed_pol.scheme or "").lower() == "https":
                field_desc = "Vulnerability disclosure policy URL"
                findings.append(
                    SecurityTxtFinding(
                        code="POLICY_VALID",
                        severity="success",
                        title="Security Policy Link Found",
                        message=f"Disclosure policy: {field_val}",
                        line_number=line_idx,
                        field_name="Policy",
                        reference="RFC 9116 Section 2.5.7",
                    )
                )
            else:
                field_desc = "Security policy link"

        elif lower_name == "encryption":
            field_desc = "Public encryption key reference"
            findings.append(
                SecurityTxtFinding(
                    code="ENCRYPTION_PRESENT",
                    severity="info",
                    title="Public Encryption Key Provided",
                    message=f"Encryption key pointer: {field_val}",
                    line_number=line_idx,
                    field_name="Encryption",
                    reference="RFC 9116 Section 2.5.4",
                )
            )

        elif lower_name == "acknowledgments":
            field_desc = "Hall of fame / recognitions link"

        elif lower_name == "hiring":
            field_desc = "Security careers / job postings link"

        elif lower_name == "preferred-languages":
            languages_occurrences.append((line_idx, field_val))
            field_desc = f"Supported languages: {field_val}"

        else:
            # Recognized extension field (RFC 9116 Section 2.5.9)
            field_desc = f"Extension directive: {canon_name}"
            findings.append(
                SecurityTxtFinding(
                    code="EXTENSION_FIELD",
                    severity="info",
                    title=f"Extension Directive: {canon_name}",
                    message=f"Found extension field '{canon_name}'. RFC 9116 permits non-standard extension fields.",
                    line_number=line_idx,
                    field_name=canon_name,
                    reference="RFC 9116 Section 2.5.9",
                )
            )

        fields.append(
            SecurityTxtField(
                name=canon_name,
                value=field_val,
                line_number=line_idx,
                is_valid=is_field_valid,
                description=field_desc,
            )
        )

    # Post-file cardinality checks (RFC 9116 Requirements)
    if len(contact_occurrences) == 0:
        findings.append(
            SecurityTxtFinding(
                code="CONTACT_MISSING",
                severity="error",
                title="Missing Required 'Contact' Directive",
                message="No 'Contact' directive was found in the file. RFC 9116 Section 2.5.3 specifies that at least one Contact field MUST be present.",
                line_number=None,
                field_name="Contact",
                recommendation="Add at least one Contact entry, e.g. 'Contact: mailto:security@example.com'.",
                reference="RFC 9116 Section 2.5.3",
            )
        )

    if len(expires_occurrences) == 0:
        findings.append(
            SecurityTxtFinding(
                code="EXPIRES_MISSING",
                severity="error",
                title="Missing Required 'Expires' Directive",
                message="No 'Expires' directive was found in the file. RFC 9116 Section 2.5.5 specifies that exactly one Expires field MUST be present.",
                line_number=None,
                field_name="Expires",
                recommendation="Add an Expires entry with a future UTC timestamp, e.g. 'Expires: 2027-12-31T23:59:59.000Z'.",
                reference="RFC 9116 Section 2.5.5",
            )
        )
    elif len(expires_occurrences) > 1:
        findings.append(
            SecurityTxtFinding(
                code="EXPIRES_MULTIPLE",
                severity="error",
                title="Duplicate 'Expires' Directives Found",
                message=f"Found {len(expires_occurrences)} Expires directives. RFC 9116 Section 2.5.5 mandates that Expires MUST appear exactly once.",
                line_number=expires_occurrences[1][0],
                field_name="Expires",
                recommendation="Remove extraneous Expires directives so only one remains.",
                reference="RFC 9116 Section 2.5.5",
            )
        )

    if len(languages_occurrences) > 1:
        findings.append(
            SecurityTxtFinding(
                code="LANGUAGES_MULTIPLE",
                severity="warning",
                title="Multiple Preferred-Languages Directives",
                message="Multiple Preferred-Languages directives found. RFC 9116 Section 2.5.8 specifies at most one directive with a comma-separated list.",
                line_number=languages_occurrences[1][0],
                field_name="Preferred-Languages",
                recommendation="Combine language tags into a single comma-separated directive, e.g. 'Preferred-Languages: en, es'.",
                reference="RFC 9116 Section 2.5.8",
            )
        )

    return fields, findings, expires_at_iso, is_expired, days_until_expiration


def execute_security_txt_validation_sync(
    domain: str,
    timeout: float = DEFAULT_READ_TIMEOUT,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
    now_utc: Optional[datetime] = None,
) -> SecurityTxtValidateResponse:
    """
    Synchronous execution of safe security.txt retrieval and RFC 9116 validation.
    """
    t_start = time.perf_counter()
    checked_at = (now_utc or datetime.now(timezone.utc)).isoformat()
    active_resolver = resolver or SafeResolver(timeout=DEFAULT_CONNECT_TIMEOUT)

    clean_domain = domain.strip().lower()
    if clean_domain.startswith("http://") or clean_domain.startswith("https://"):
        clean_domain = urlparse(clean_domain).hostname or clean_domain

    primary_url = f"https://{clean_domain}/.well-known/security.txt"
    fallback_url = f"https://{clean_domain}/security.txt"

    # Step 1: Attempt retrieval at standard location (/.well-known/security.txt)
    status_str, http_code, c_type, c_len, raw_text, err_msg = _safe_fetch_single_url(
        target_url=primary_url,
        resolver=active_resolver,
        custom_transport=custom_transport,
        timeout=timeout,
    )

    effective_location: Optional[str] = None
    used_fallback = False
    effective_url = primary_url

    # Step 2: If primary returns 404 or html_response, attempt fallback (/security.txt)
    if status_str in ("not_found", "html_response"):
        fb_status, fb_code, fb_ctype, fb_len, fb_text, fb_err = _safe_fetch_single_url(
            target_url=fallback_url,
            resolver=active_resolver,
            custom_transport=custom_transport,
            timeout=timeout,
        )

        if fb_status == "retrieved" and fb_text:
            # Fallback succeeded!
            status_str, http_code, c_type, c_len, raw_text, err_msg = (
                fb_status,
                fb_code,
                fb_ctype,
                fb_len,
                fb_text,
                fb_err,
            )
            effective_location = "/security.txt"
            effective_url = fallback_url
            used_fallback = True
        else:
            # Fallback also failed or was absent; report primary outcome
            effective_location = None
    elif status_str == "retrieved":
        effective_location = "/.well-known/security.txt"
        used_fallback = False

    t_end = time.perf_counter()
    duration_ms = round((t_end - t_start) * 1000, 2)

    # Step 3: Handle retrieval failures
    if status_str != "retrieved" or raw_text is None:
        fail_findings: List[SecurityTxtFinding] = []

        if status_str == "not_found":
            fail_findings.append(
                SecurityTxtFinding(
                    code="FILE_NOT_FOUND",
                    severity="error",
                    title="No security.txt File Found",
                    message=f"No security.txt file was found at standard path '/.well-known/security.txt' or fallback '/security.txt' on https://{clean_domain}.",
                    recommendation="Publish a security.txt file at https://" + clean_domain + "/.well-known/security.txt according to RFC 9116.",
                    reference="RFC 9116 Section 3",
                )
            )
            val_status = "not_found"
        elif status_str == "html_response":
            fail_findings.append(
                SecurityTxtFinding(
                    code="HTML_CONTENT_RETURNED",
                    severity="error",
                    title="Server Returned HTML Instead of Plaintext",
                    message="The web server returned an HTML webpage (such as a 404 template or homepage) instead of a plaintext security.txt file.",
                    recommendation="Ensure the web server returns a genuine text/plain security.txt file with HTTP status 200.",
                    reference="RFC 9116 Section 3",
                )
            )
            val_status = "invalid"
        elif status_str == "blocked_target":
            fail_findings.append(
                SecurityTxtFinding(
                    code="SECURITY_POLICY_BLOCKED",
                    severity="error",
                    title="Request Blocked by Security Policy",
                    message=err_msg or "Outbound request was blocked by security policy.",
                    recommendation="Ensure the target hostname resolves to a public internet address.",
                    reference="RFC 9116 Section 3",
                )
            )
            val_status = "retrieval_error"
        else:
            fail_findings.append(
                SecurityTxtFinding(
                    code="RETRIEVAL_ERROR",
                    severity="error",
                    title="File Retrieval Failed",
                    message=err_msg or f"Could not retrieve security.txt ({status_str}).",
                    recommendation="Verify that the website is accessible over HTTPS with a valid TLS certificate.",
                    reference="RFC 9116 Section 3",
                )
            )
            val_status = "retrieval_error"

        summary = SecurityTxtSummary(
            total_fields=0,
            errors_count=len([f for f in fail_findings if f.severity == "error"]),
            warnings_count=0,
            info_count=0,
            has_contact=False,
            has_expires=False,
            has_encryption=False,
            has_policy=False,
            has_canonical=False,
            has_hiring=False,
            is_https=True,
            used_fallback=False,
        )

        return SecurityTxtValidateResponse(
            domain=clean_domain,
            target_url=effective_url,
            checked_at=checked_at,
            duration_ms=duration_ms,
            retrieval_status=status_str,
            source_location=None,
            http_status_code=http_code,
            content_type=c_type,
            content_length=c_len,
            validation_status=val_status,
            summary=summary,
            fields=[],
            findings=fail_findings,
            expires_at=None,
            is_expired=None,
            days_until_expiration=None,
            raw_content=raw_text,
        )

    # Step 4: File was successfully retrieved — parse and validate against RFC 9116
    parsed_fields, findings, expires_at_iso, is_expired, days_until_expiration = parse_and_validate_security_txt(
        content=raw_text,
        now_utc=now_utc,
    )

    # Add location-specific findings
    if used_fallback:
        findings.insert(
            0,
            SecurityTxtFinding(
                code="FALLBACK_LOCATION_USED",
                severity="warning",
                title="Legacy Fallback Path Used",
                message="File was retrieved from '/security.txt' instead of RFC 9116 standardized path '/.well-known/security.txt'.",
                line_number=None,
                field_name=None,
                recommendation="Move the file to '/.well-known/security.txt' or configure a 301 redirect to it.",
                reference="RFC 9116 Section 3",
            ),
        )
    else:
        findings.insert(
            0,
            SecurityTxtFinding(
                code="STANDARD_LOCATION_OK",
                severity="success",
                title="Standard Location Verified",
                message="File is served from the RFC 9116 standardized path '/.well-known/security.txt'.",
                line_number=None,
                field_name=None,
                reference="RFC 9116 Section 3",
            ),
        )

    # Check content-type header (RFC 9116 Section 3: SHOULD be text/plain)
    if c_type and not c_type.lower().startswith("text/plain"):
        findings.append(
            SecurityTxtFinding(
                code="CONTENT_TYPE_MISMATCH",
                severity="info",
                title="Content-Type Not text/plain",
                message=f"Server returned Content-Type '{c_type}'. RFC 9116 Section 3 specifies that the media type SHOULD be 'text/plain; charset=utf-8'.",
                line_number=None,
                field_name=None,
                recommendation="Configure your web server to serve security.txt with 'Content-Type: text/plain; charset=utf-8'.",
                reference="RFC 9116 Section 3",
            )
        )

    # Aggregate counts
    errors_count = len([f for f in findings if f.severity == "error"])
    warnings_count = len([f for f in findings if f.severity == "warning"])
    info_count = len([f for f in findings if f.severity == "info"])

    # Determine overall validation status
    if errors_count > 0:
        overall_validation = "invalid"
    elif warnings_count > 0:
        overall_validation = "valid_with_warnings"
    else:
        overall_validation = "valid"

    # Directives present summary
    has_contact = any(f.name.lower() == "contact" and f.is_valid for f in parsed_fields)
    has_expires = any(f.name.lower() == "expires" and f.is_valid for f in parsed_fields)
    has_encryption = any(f.name.lower() == "encryption" for f in parsed_fields)
    has_policy = any(f.name.lower() == "policy" for f in parsed_fields)
    has_canonical = any(f.name.lower() == "canonical" for f in parsed_fields)
    has_hiring = any(f.name.lower() == "hiring" for f in parsed_fields)

    summary = SecurityTxtSummary(
        total_fields=len(parsed_fields),
        errors_count=errors_count,
        warnings_count=warnings_count,
        info_count=info_count,
        has_contact=has_contact,
        has_expires=has_expires,
        has_encryption=has_encryption,
        has_policy=has_policy,
        has_canonical=has_canonical,
        has_hiring=has_hiring,
        is_https=True,
        used_fallback=used_fallback,
    )

    return SecurityTxtValidateResponse(
        domain=clean_domain,
        target_url=effective_url,
        checked_at=checked_at,
        duration_ms=duration_ms,
        retrieval_status="retrieved",
        source_location=effective_location,
        http_status_code=http_code,
        content_type=c_type,
        content_length=c_len,
        validation_status=overall_validation,
        summary=summary,
        fields=parsed_fields,
        findings=findings,
        expires_at=expires_at_iso,
        is_expired=is_expired,
        days_until_expiration=days_until_expiration,
        raw_content=raw_text[:MAX_FILE_BYTES],
    )


async def execute_security_txt_validation(
    domain: str,
    timeout: float = DEFAULT_READ_TIMEOUT,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
    now_utc: Optional[datetime] = None,
) -> SecurityTxtValidateResponse:
    """
    Asynchronously executes standalone security.txt validation by running socket I/O in worker thread.
    """
    return await asyncio.to_thread(
        execute_security_txt_validation_sync,
        domain=domain,
        timeout=timeout,
        resolver=resolver,
        custom_transport=custom_transport,
        now_utc=now_utc,
    )
