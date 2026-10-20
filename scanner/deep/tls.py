"""
Scanly Scanner Engine - Deep Scan Advanced TLS & Certificate Analysis
Deep inspection of server certificate chain, SANs, public key strength, signature algorithm,
negotiated cipher suite, TLS protocol version, and ALPN / HTTP/2 support.
Enforces strict SSRF protection and target IP pinning to eliminate DNS rebinding.
"""
from datetime import datetime, timezone
import socket
import ssl
from typing import Dict, Any, List, Optional, Tuple

try:
    from cryptography import x509
    from cryptography.hazmat.primitives.asymmetric import rsa, ec, ed25519, ed448
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

from scanner.models import Finding, CheckStatus, Severity
from scanner.domain import resolve_and_validate_target, SSRFValidationError, normalize_domain
from scanner.network.resolver import BaseResolver, SafeResolver


def _match_hostname_in_sans(hostname: str, san_list: List[str]) -> bool:
    """Checks whether hostname matches any entry in san_list including wildcard rules."""
    norm_host = hostname.lower().strip(".")
    for san in san_list:
        norm_san = san.lower().strip(".")
        if norm_san == norm_host:
            return True
        if norm_san.startswith("*."):
            suffix = norm_san[2:]
            # Wildcard matches one level of subdomain
            if norm_host.endswith("." + suffix):
                prefix = norm_host[: -(len(suffix) + 1)]
                if "." not in prefix:
                    return True
    return False


def analyze_deep_tls(
    domain: str,
    timeout_seconds: float = 6.0,
    resolver: Optional[BaseResolver] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Performs deep TLS and cryptographic transport inspection for target domain.
    Returns (tls_metadata, findings).
    Never raises uncaught exceptions on network failure or invalid target.
    """
    findings: List[Finding] = []
    tls_data: Dict[str, Any] = {
        "valid": False,
        "issuer": None,
        "issuer_organization": None,
        "issuer_common_name": None,
        "subject": None,
        "subject_common_name": None,
        "not_before": None,
        "not_after": None,
        "days_remaining": None,
        "san_list": [],
        "is_wildcard": False,
        "hostname_matched": False,
        "tls_version": None,
        "cipher_name": None,
        "cipher_bits": None,
        "has_forward_secrecy": False,
        "alpn_selected": None,
        "supports_http2": False,
        "key_algorithm": None,
        "key_size": None,
        "signature_algorithm": None,
        "serial_number": None,
        "error": None,
        "resolved_ip": None,
    }

    safe_res = resolver or SafeResolver(timeout=timeout_seconds)

    try:
        norm_domain, resolved_ip = resolve_and_validate_target(domain, resolver=safe_res)
        tls_data["resolved_ip"] = resolved_ip
    except SSRFValidationError as e:
        tls_data["error"] = str(e)
        findings.append(
            Finding(
                check_type="deep_tls_ssrf_blocked",
                name="TLS Target Prohibited",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-25,
                title="Target Host Prohibited by SSRF Shield",
                summary=str(e),
                why_it_matters="SiteSecura never connects to private or non-routable IP addresses.",
                how_to_fix="Ensure your target domain resolves to a publicly routable IP address.",
                estimated_fix_minutes=5,
                documentation_url="https://scanly.io/docs/faq",
                evidence=str(e),
            )
        )
        return tls_data, findings

    context = ssl.create_default_context()
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED

    # Enable ALPN negotiation for HTTP/2 and HTTP/1.1
    try:
        context.set_alpn_protocols(["h2", "http/1.1"])
    except (AttributeError, NotImplementedError):
        pass

    try:
        with socket.create_connection((resolved_ip, 443), timeout=timeout_seconds) as sock:
            with context.wrap_socket(sock, server_hostname=norm_domain) as ssock:
                cert = ssock.getpeercert()
                cert_der = ssock.getpeercert(binary_form=True)

                tls_ver = ssock.version()
                tls_data["tls_version"] = tls_ver

                cipher_tuple = ssock.cipher()
                if cipher_tuple:
                    tls_data["cipher_name"] = cipher_tuple[0]
                    tls_data["cipher_bits"] = cipher_tuple[2]

                # Check ALPN
                try:
                    alpn = ssock.selected_alpn_protocol()
                    tls_data["alpn_selected"] = alpn
                    if alpn == "h2":
                        tls_data["supports_http2"] = True
                except (AttributeError, NotImplementedError):
                    pass

                # Forward Secrecy detection
                cipher_name = (tls_data["cipher_name"] or "").upper()
                if tls_ver == "TLSv1.3" or "ECDHE" in cipher_name or "DHE" in cipher_name or "ED25519" in cipher_name:
                    tls_data["has_forward_secrecy"] = True

                if not cert:
                    raise ssl.SSLError("Remote server did not present a peer certificate.")

                # Extract Issuer & Subject
                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                subject_dict = dict(x[0] for x in cert.get("subject", []))

                tls_data["issuer_organization"] = issuer_dict.get("organizationName")
                tls_data["issuer_common_name"] = issuer_dict.get("commonName")
                tls_data["issuer"] = tls_data["issuer_organization"] or tls_data["issuer_common_name"] or "Unknown CA"

                tls_data["subject_common_name"] = subject_dict.get("commonName")
                tls_data["subject"] = tls_data["subject_common_name"] or norm_domain

                # Subject Alternative Names (SANs)
                san_list = [entry[1] for entry in cert.get("subjectAltName", []) if entry[0] in ("DNS", "IP Address")]
                tls_data["san_list"] = san_list
                tls_data["is_wildcard"] = any(san.startswith("*.") for san in san_list)
                tls_data["hostname_matched"] = _match_hostname_in_sans(norm_domain, san_list)

                # Serial Number
                tls_data["serial_number"] = cert.get("serialNumber")

                # Parse validity dates
                not_before_str = cert.get("notBefore")
                not_after_str = cert.get("notAfter")
                date_fmt = "%b %d %H:%M:%S %Y %Z"

                if not_before_str:
                    try:
                        not_before = datetime.strptime(not_before_str, date_fmt).replace(tzinfo=timezone.utc)
                        tls_data["not_before"] = not_before.isoformat()
                    except ValueError:
                        pass

                if not_after_str:
                    not_after = datetime.strptime(not_after_str, date_fmt).replace(tzinfo=timezone.utc)
                    tls_data["not_after"] = not_after.isoformat()
                    now = datetime.now(timezone.utc)
                    days_remaining = (not_after - now).days
                    tls_data["days_remaining"] = days_remaining

                # Parse detailed cryptographic key details via cryptography library
                if HAS_CRYPTOGRAPHY and cert_der:
                    try:
                        x509_cert = x509.load_der_x509_certificate(cert_der)
                        pub_key = x509_cert.public_key()
                        if isinstance(pub_key, rsa.RSAPublicKey):
                            tls_data["key_algorithm"] = "RSA"
                            tls_data["key_size"] = pub_key.key_size
                        elif isinstance(pub_key, ec.EllipticCurvePublicKey):
                            tls_data["key_algorithm"] = f"ECC ({pub_key.curve.name})"
                            tls_data["key_size"] = pub_key.key_size
                        elif isinstance(pub_key, ed25519.Ed25519PublicKey):
                            tls_data["key_algorithm"] = "Ed25519"
                            tls_data["key_size"] = 256
                        elif isinstance(pub_key, ed448.Ed448PublicKey):
                            tls_data["key_algorithm"] = "Ed448"
                            tls_data["key_size"] = 448

                        if hasattr(x509_cert, "signature_algorithm_oid"):
                            tls_data["signature_algorithm"] = x509_cert.signature_algorithm_oid._name
                    except Exception:
                        pass

                # Mark valid if no cert errors
                tls_data["valid"] = (tls_data["days_remaining"] is not None and tls_data["days_remaining"] >= 0)

                # =========================================================
                # Generate Findings
                # =========================================================

                # 1. Certificate Validity & Expiration
                days = tls_data["days_remaining"]
                if days is not None and days < 0:
                    findings.append(
                        Finding(
                            check_type="deep_tls_validity",
                            name="TLS Certificate Expired",
                            status=CheckStatus.CRITICAL,
                            severity=Severity.CRITICAL,
                            score_impact=-30,
                            title="SSL/TLS Certificate is Expired",
                            summary=f"The SSL/TLS certificate expired {abs(days)} days ago ({tls_data['not_after']}).",
                            why_it_matters="Expired certificates immediately trigger full-screen browser warnings and block visitor access.",
                            how_to_fix="Renew and deploy an active SSL/TLS certificate immediately with your CA or hosting provider.",
                            estimated_fix_minutes=15,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                            evidence=f"Expired on {tls_data['not_after']} ({abs(days)} days overdue)",
                        )
                    )
                elif days is not None and days <= 14:
                    findings.append(
                        Finding(
                            check_type="deep_tls_validity",
                            name="TLS Certificate Expiring Soon",
                            status=CheckStatus.WARNING,
                            severity=Severity.HIGH,
                            score_impact=-10,
                            title="SSL/TLS Certificate Expiring Soon",
                            summary=f"Certificate will expire in {days} days ({tls_data['not_after']}).",
                            why_it_matters="If certificates are not renewed before expiration, visitor traffic will encounter security warnings.",
                            how_to_fix="Renew certificate before expiry date.",
                            estimated_fix_minutes=15,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                            evidence=f"Expires on {tls_data['not_after']} ({days} days remaining)",
                        )
                    )
                elif days is not None and days <= 30:
                    findings.append(
                        Finding(
                            check_type="deep_tls_validity",
                            name="TLS Certificate Expiration Warning",
                            status=CheckStatus.WARNING,
                            severity=Severity.LOW,
                            score_impact=-3,
                            title="Certificate Nearing Expiration",
                            summary=f"Certificate expires in {days} days. Ensure automated renewal (e.g. Certbot ACME) is operational.",
                            why_it_matters="Automated certificate renewal failure can cause unexpected website downtime.",
                            how_to_fix="Check ACME auto-renewal timers or prepare manual renewal.",
                            estimated_fix_minutes=10,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                            evidence=f"Expires on {tls_data['not_after']} ({days} days remaining)",
                        )
                    )
                else:
                    findings.append(
                        Finding(
                            check_type="deep_tls_validity",
                            name="Valid TLS Certificate",
                            status=CheckStatus.PASS,
                            severity=Severity.INFO,
                            score_impact=0,
                            title="SSL/TLS Certificate is Valid and Trusted",
                            summary=f"Issued by {tls_data['issuer']} with {days} days of remaining validity.",
                            why_it_matters="Valid certificates establish encrypted, authenticated channels that preserve visitor privacy and data integrity.",
                            how_to_fix="Maintain automated renewal to prevent future expiration.",
                            estimated_fix_minutes=0,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                            evidence=f"Issuer: {tls_data['issuer']} | Subject: {tls_data['subject']} | Days Remaining: {days}",
                        )
                    )

                # 2. TLS Protocol Version
                if tls_ver == "TLSv1.3":
                    findings.append(
                        Finding(
                            check_type="deep_tls_protocol",
                            name="Modern TLS 1.3 Protocol",
                            status=CheckStatus.PASS,
                            severity=Severity.INFO,
                            score_impact=0,
                            title="Modern TLS 1.3 Protocol Negotiated",
                            summary="Server successfully negotiated TLS 1.3, providing optimal cryptographic privacy and reduced handshake latency.",
                            why_it_matters="TLS 1.3 eliminates obsolete cipher suites, simplifies handshakes, and mandates forward secrecy by default.",
                            how_to_fix="Continue supporting TLS 1.3.",
                            estimated_fix_minutes=0,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                            evidence=f"Protocol: {tls_ver} | Cipher: {tls_data['cipher_name']}",
                        )
                    )
                elif tls_ver == "TLSv1.2":
                    findings.append(
                        Finding(
                            check_type="deep_tls_protocol",
                            name="TLS 1.2 Protocol Negotiated",
                            status=CheckStatus.PASS,
                            severity=Severity.INFO,
                            score_impact=0,
                            title="TLS 1.2 Protocol Active",
                            summary="Server negotiated TLS 1.2. While secure, enabling TLS 1.3 provides performance and security benefits.",
                            why_it_matters="TLS 1.2 is widely supported and secure, but lacks modern 0-RTT and mandatory forward secrecy present in TLS 1.3.",
                            how_to_fix="Enable TLS 1.3 in your web server (Nginx: `ssl_protocols TLSv1.2 TLSv1.3;`).",
                            estimated_fix_minutes=15,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                            evidence=f"Protocol: {tls_ver} | Cipher: {tls_data['cipher_name']}",
                        )
                    )
                else:
                    findings.append(
                        Finding(
                            check_type="deep_tls_protocol",
                            name="Deprecated TLS Protocol",
                            status=CheckStatus.CRITICAL,
                            severity=Severity.HIGH,
                            score_impact=-20,
                            title=f"Deprecated Protocol Active ({tls_ver})",
                            summary=f"The remote server negotiated {tls_ver}, which has been formally deprecated by IETF (RFC 8996).",
                            why_it_matters="Legacy TLS protocols (1.0, 1.1) and SSLv3 contain cryptographic weaknesses exploitable by network attackers.",
                            how_to_fix="Disable TLS 1.0/1.1 and enable TLS 1.2 and TLS 1.3 on your server or load balancer.",
                            estimated_fix_minutes=20,
                            documentation_url="https://datatracker.ietf.org/doc/html/rfc8996",
                            evidence=f"Negotiated: {tls_ver}",
                        )
                    )

                # 3. Forward Secrecy & Cipher Suite
                if tls_data["has_forward_secrecy"]:
                    findings.append(
                        Finding(
                            check_type="deep_tls_forward_secrecy",
                            name="Forward Secrecy Active",
                            status=CheckStatus.PASS,
                            severity=Severity.INFO,
                            score_impact=0,
                            title="Perfect Forward Secrecy (PFS) Enabled",
                            summary=f"Negotiated cipher suite ({tls_data['cipher_name']}) supports ephemeral key exchange (ECDHE/DHE).",
                            why_it_matters="Forward secrecy ensures that even if the server's private key is compromised in the future, past recorded traffic cannot be decrypted.",
                            how_to_fix="No action required.",
                            estimated_fix_minutes=0,
                            documentation_url="https://en.wikipedia.org/wiki/Forward_secrecy",
                            evidence=f"Cipher: {tls_data['cipher_name']} ({tls_data['cipher_bits']} bits)",
                        )
                    )
                else:
                    findings.append(
                        Finding(
                            check_type="deep_tls_forward_secrecy",
                            name="Missing Forward Secrecy",
                            status=CheckStatus.WARNING,
                            severity=Severity.MEDIUM,
                            score_impact=-5,
                            title="Cipher Suite Lacks Forward Secrecy",
                            summary=f"Negotiated cipher ({tls_data['cipher_name']}) does not utilize ephemeral key exchange.",
                            why_it_matters="Without forward secrecy, any captured encrypted traffic can be retroactively decrypted if private keys are ever exposed.",
                            how_to_fix="Configure modern ECDHE/DHE cipher suites in web server configuration.",
                            estimated_fix_minutes=20,
                            documentation_url="https://en.wikipedia.org/wiki/Forward_secrecy",
                            evidence=f"Cipher: {tls_data['cipher_name']}",
                        )
                    )

                # 4. Public Key & Signature Quality
                key_size = tls_data.get("key_size")
                key_algo = tls_data.get("key_algorithm") or ""
                sig_algo = (tls_data.get("signature_algorithm") or "").lower()

                if "sha1" in sig_algo or "md5" in sig_algo:
                    findings.append(
                        Finding(
                            check_type="deep_tls_weak_signature",
                            name="Weak Certificate Signature",
                            status=CheckStatus.CRITICAL,
                            severity=Severity.HIGH,
                            score_impact=-15,
                            title="Deprecated Signature Algorithm Detected",
                            summary=f"Certificate uses {tls_data.get('signature_algorithm')}, which is cryptographically broken.",
                            why_it_matters="SHA-1 and MD5 certificates are vulnerable to collision attacks and rejected by modern browsers.",
                            how_to_fix="Re-issue certificate using SHA-256 (e.g., sha256WithRSAEncryption) or ECDSA.",
                            estimated_fix_minutes=15,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                            evidence=f"Signature: {tls_data.get('signature_algorithm')}",
                        )
                    )
                elif key_size and "rsa" in key_algo.lower() and key_size < 2048:
                    findings.append(
                        Finding(
                            check_type="deep_tls_weak_key",
                            name="Insufficient Key Length",
                            status=CheckStatus.CRITICAL,
                            severity=Severity.HIGH,
                            score_impact=-15,
                            title="RSA Key Size Under 2048 Bits",
                            summary=f"Certificate public key length is {key_size} bits. Modern security standards mandate at least 2048 bits.",
                            why_it_matters="RSA keys smaller than 2048 bits do not provide adequate resistance against factoring attacks.",
                            how_to_fix="Generate a new private key of at least 2048 bits (or ECC 256 bits) and re-issue certificate.",
                            estimated_fix_minutes=20,
                            documentation_url="https://www.keylength.com",
                            evidence=f"Key Size: {key_size} bits (RSA)",
                        )
                    )
                elif key_size:
                    findings.append(
                        Finding(
                            check_type="deep_tls_key_strength",
                            name="Robust Cryptographic Key",
                            status=CheckStatus.PASS,
                            severity=Severity.INFO,
                            score_impact=0,
                            title="Robust Public Key Length",
                            summary=f"Certificate uses {tls_data['key_algorithm']} with {key_size}-bit key length.",
                            why_it_matters="Adequate key sizes ensure cryptographic strength against brute-force and factoring attacks.",
                            how_to_fix="Maintain current key standards.",
                            estimated_fix_minutes=0,
                            documentation_url="https://www.keylength.com",
                            evidence=f"Algorithm: {tls_data['key_algorithm']} | Key Length: {key_size} bits | Signature: {tls_data.get('signature_algorithm')}",
                        )
                    )

                # 5. ALPN & HTTP/2 Support
                if tls_data["supports_http2"]:
                    findings.append(
                        Finding(
                            check_type="deep_tls_alpn_http2",
                            name="HTTP/2 Protocol Supported",
                            status=CheckStatus.PASS,
                            severity=Severity.INFO,
                            score_impact=0,
                            title="HTTP/2 Supported via ALPN",
                            summary="Server successfully advertised and negotiated the 'h2' (HTTP/2) application protocol.",
                            why_it_matters="HTTP/2 improves performance via multiplexed requests over a single connection and header compression.",
                            how_to_fix="No action required.",
                            estimated_fix_minutes=0,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview#http2",
                            evidence="ALPN negotiated: h2",
                        )
                    )
                else:
                    findings.append(
                        Finding(
                            check_type="deep_tls_alpn_http2",
                            name="HTTP/1.1 Protocol Fallback",
                            status=CheckStatus.INFO,
                            severity=Severity.INFO,
                            score_impact=0,
                            title="HTTP/1.1 Negotiated via ALPN",
                            summary="Server negotiated HTTP/1.1. HTTP/2 was not negotiated during the TLS handshake.",
                            why_it_matters="HTTP/2 offers lower latency, connection reuse, and header compression over HTTP/1.1.",
                            how_to_fix="Enable HTTP/2 support in your web server or CDN.",
                            estimated_fix_minutes=15,
                            documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview#http2",
                            evidence=f"ALPN negotiated: {tls_data['alpn_selected'] or 'none'}",
                        )
                    )

    except ssl.SSLCertVerificationError as e:
        tls_data["valid"] = False
        tls_data["error"] = str(e)
        findings.append(
            Finding(
                check_type="deep_tls_verification",
                name="TLS Verification Failure",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-25,
                title="TLS Certificate Verification Failed",
                summary=f"Certificate presented by {norm_domain} failed trust validation: {getattr(e, 'verify_message', str(e))}",
                why_it_matters="Untrusted or invalid certificates trigger security blocking screens in all modern browsers.",
                how_to_fix="Install a valid SSL/TLS certificate issued by a trusted public Certificate Authority.",
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                evidence=str(e),
            )
        )
    except (socket.timeout, TimeoutError) as e:
        tls_data["valid"] = False
        tls_data["error"] = f"TLS handshake timeout: {str(e)}"
        findings.append(
            Finding(
                check_type="deep_tls_connection",
                name="TLS Handshake Timeout",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-10,
                title="TLS Handshake Timed Out",
                summary=f"Port 443 on {norm_domain} did not complete TLS negotiation within {timeout_seconds}s.",
                why_it_matters="Slow or non-responsive TLS connections degrade user experience and search rankings.",
                how_to_fix="Inspect firewall, CDN routing, and server load on port 443.",
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                evidence=str(e),
            )
        )
    except Exception as e:
        tls_data["valid"] = False
        tls_data["error"] = str(e)
        findings.append(
            Finding(
                check_type="deep_tls_connection",
                name="TLS Connection Failed",
                status=CheckStatus.CRITICAL,
                severity=Severity.HIGH,
                score_impact=-15,
                title="TLS Handshake Failed",
                summary=f"Unable to establish TLS connection on port 443: {str(e)}",
                why_it_matters="Port 443 must respond with a valid TLS configuration for HTTPS websites.",
                how_to_fix="Ensure port 443 is open and configured with a valid SSL/TLS certificate.",
                estimated_fix_minutes=20,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security",
                evidence=str(e),
            )
        )

    return tls_data, findings
