"""
Scanly Scanner Engine - SSL / TLS Certificate Check Module
Establishes a TLS connection to inspect certificate validity, expiration, issuer, SANs, and protocol version.
Enforces DNS pinning to prevent DNS rebinding while strictly preserving TLS certificate hostname verification.
"""
from datetime import datetime, timezone
import socket
import ssl
from typing import Dict, Any, List, Optional
from .models import Finding, CheckStatus, Severity
from .recommendations import get_recommendation
from .domain import resolve_and_validate_target, SSRFValidationError
from .network.resolver import BaseResolver, SafeResolver


def check_ssl_certificate(
    domain: str,
    timeout_seconds: float = 6.0,
    resolver: Optional[BaseResolver] = None,
) -> Dict[str, Any]:
    """
    Connects via TLS on port 443, parses the server certificate, and checks:
    - Certificate existence & validity
    - Expiration date and days remaining
    - Certificate Authority (Issuer)
    - Subject Alternative Names (SAN) match
    - TLS protocol version (TLSv1.2, TLSv1.3)
    Pins the socket to a validated public IP to prevent DNS rebinding while
    strictly preserving SNI and hostname certificate validation.
    """
    findings: List[Finding] = []
    ssl_data: Dict[str, Any] = {
        "valid": False,
        "issuer": None,
        "subject": None,
        "not_before": None,
        "not_after": None,
        "days_remaining": None,
        "san_list": [],
        "tls_version": None,
        "cipher": None,
        "error": None,
        "resolved_ip": None,
    }

    safe_res = resolver or SafeResolver(timeout=timeout_seconds)

    try:
        norm_domain, resolved_ip = resolve_and_validate_target(domain, resolver=safe_res)
        ssl_data["resolved_ip"] = resolved_ip
    except SSRFValidationError as e:
        ssl_data["error"] = str(e)
        return {"ssl_data": ssl_data, "findings": findings}

    context = ssl.create_default_context()
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED

    try:
        # Connect socket directly to the validated pinned IP to prevent DNS rebinding
        with socket.create_connection((resolved_ip, 443), timeout=timeout_seconds) as sock:
            # Wrap socket with server_hostname=norm_domain for SNI and strict hostname verification
            with context.wrap_socket(sock, server_hostname=norm_domain) as ssock:
                cert = ssock.getpeercert()
                ssl_data["tls_version"] = ssock.version()
                cipher_tuple = ssock.cipher()
                ssl_data["cipher"] = cipher_tuple[0] if cipher_tuple else None

                if not cert:
                    raise ssl.SSLError("No certificate returned by remote server.")

                # Extract Issuer & Subject
                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                subject_dict = dict(x[0] for x in cert.get("subject", []))
                ssl_data["issuer"] = issuer_dict.get("organizationName") or issuer_dict.get("commonName") or "Unknown CA"
                ssl_data["subject"] = subject_dict.get("commonName") or norm_domain

                # Subject Alternative Names (SAN)
                san_list = [entry[1] for entry in cert.get("subjectAltName", []) if entry[0] == "DNS"]
                ssl_data["san_list"] = san_list

                # Parse dates (Format: 'May 15 12:00:00 2026 GMT')
                not_before_str = cert.get("notBefore")
                not_after_str = cert.get("notAfter")
                date_fmt = "%b %d %H:%M:%S %Y %Z"

                if not_after_str:
                    not_after = datetime.strptime(not_after_str, date_fmt).replace(tzinfo=timezone.utc)
                    ssl_data["not_after"] = not_after.isoformat()
                    now = datetime.now(timezone.utc)
                    days_remaining = (not_after - now).days
                    ssl_data["days_remaining"] = days_remaining

                    if days_remaining < 0:
                        ssl_data["valid"] = False
                        rec = get_recommendation("ssl_expired")
                        findings.append(
                            Finding(
                                check_type="ssl_expiration",
                                name="SSL Certificate Expired",
                                status=CheckStatus.CRITICAL,
                                severity=Severity.CRITICAL,
                                score_impact=-30,
                                title=rec["title"],
                                summary=f"SSL certificate expired {abs(days_remaining)} days ago ({not_after.strftime('%Y-%m-%d')}).",
                                why_it_matters=rec["why_it_matters"],
                                how_to_fix=rec["how_to_fix"],
                                estimated_fix_minutes=rec["estimated_fix_minutes"],
                                documentation_url=rec["documentation_url"],
                                evidence=f"Expiry: {not_after.strftime('%Y-%m-%d')} | Issuer: {ssl_data['issuer']}",
                            )
                        )
                    elif days_remaining <= 14:
                        ssl_data["valid"] = True
                        rec = get_recommendation("ssl_expiring_soon")
                        findings.append(
                            Finding(
                                check_type="ssl_expiration",
                                name="SSL Certificate Expiring Soon",
                                status=CheckStatus.WARNING,
                                severity=Severity.HIGH,
                                score_impact=-10,
                                title=rec["title"],
                                summary=f"SSL certificate will expire in {days_remaining} days ({not_after.strftime('%Y-%m-%d')}).",
                                why_it_matters=rec["why_it_matters"],
                                how_to_fix=rec["how_to_fix"],
                                estimated_fix_minutes=rec["estimated_fix_minutes"],
                                documentation_url=rec["documentation_url"],
                                evidence=f"Expires on {not_after.strftime('%Y-%m-%d')}",
                            )
                        )
                    else:
                        ssl_data["valid"] = True
                        rec = get_recommendation("ssl_valid")
                        findings.append(
                            Finding(
                                check_type="ssl_validity",
                                name="Valid SSL Certificate",
                                status=CheckStatus.PASS,
                                severity=Severity.INFO,
                                score_impact=0,
                                title="SSL/TLS Certificate is Valid and Trusted",
                                summary=f"Issued by {ssl_data['issuer']} with {days_remaining} days of validity remaining.",
                                why_it_matters=rec["why_it_matters"],
                                how_to_fix=rec["how_to_fix"],
                                estimated_fix_minutes=0,
                                documentation_url=rec["documentation_url"],
                                evidence=f"Issuer: {ssl_data['issuer']} | TLS Version: {ssl_data['tls_version']} | Expires in {days_remaining} days",
                            )
                        )

    except ssl.SSLCertVerificationError as e:
        ssl_data["valid"] = False
        ssl_data["error"] = str(e)
        rec = get_recommendation("ssl_hostname_mismatch")
        findings.append(
            Finding(
                check_type="ssl_verification",
                name="SSL Certificate Verification Error",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-25,
                title="SSL Certificate Verification Failed",
                summary=f"Certificate verification failed for {norm_domain}: {e.verify_message if hasattr(e, 'verify_message') else str(e)}",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence=str(e),
            )
        )
    except TimeoutError as e:
        ssl_data["valid"] = False
        ssl_data["error"] = f"SSL connection timed out: {str(e)}"
        rec = get_recommendation("https_missing")
        findings.append(
            Finding(
                check_type="ssl_connection",
                name="TLS Connection Timeout",
                status=CheckStatus.UNKNOWN,
                severity=Severity.MEDIUM,
                score_impact=-15,
                title="TLS Connection Timed Out",
                summary=f"Port 443 did not establish a TLS handshake within {timeout_seconds}s.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=5,
                documentation_url=rec["documentation_url"],
                evidence=str(e),
            )
        )
    except Exception as e:
        ssl_data["valid"] = False
        ssl_data["error"] = str(e)
        rec = get_recommendation("https_missing")
        findings.append(
            Finding(
                check_type="ssl_connection",
                name="TLS Connection Failed",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-20,
                title="Unable to Establish TLS Handshake",
                summary=f"Failed to complete TLS handshake on port 443: {str(e)}",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=15,
                documentation_url=rec["documentation_url"],
                evidence=str(e),
            )
        )

    return {"ssl_data": ssl_data, "findings": findings}
