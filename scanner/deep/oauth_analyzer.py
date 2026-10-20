"""
Scanly Scanner Engine - OAuth 2.0, OpenID Connect & SAML Identity Flow Analyzer (Phase F5)
Passively audits identity provider metadata, OIDC discovery documents, PKCE support,
grant-type configurations, OAuth redirect URIs, JWKS endpoints, and SAML metadata.

Strictly passive: Zero token generation, zero OAuth code exchanges, zero SAML assertions.
Public JWKS keys and OpenID discovery documents are standard identity mechanisms and
never flagged as private key leaks.
"""
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from urllib.parse import urlparse, parse_qs, unquote
from scanner.models import Finding, CheckStatus, Severity

OIDC_CANDIDATE_PATHS = [
    "/.well-known/openid-configuration",
    "/oauth/.well-known/openid-configuration",
    "/auth/.well-known/openid-configuration",
]

JWKS_CANDIDATE_PATHS = [
    "/.well-known/jwks.json",
]

SAML_CANDIDATE_PATHS = [
    "/saml/metadata",
    "/saml2/metadata",
    "/sso/metadata.xml",
    "/federationmetadata/2007-06/federationmetadata.xml",
]


def parse_oidc_configuration(doc: Dict[str, Any], doc_url: str) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Safely parses an OpenID Connect discovery document, auditing PKCE,
    grant types, endpoints, and token transport security.
    """
    findings: List[Finding] = []

    issuer = doc.get("issuer")
    auth_ep = doc.get("authorization_endpoint")
    token_ep = doc.get("token_endpoint")
    jwks_uri = doc.get("jwks_uri")
    userinfo_ep = doc.get("userinfo_endpoint")

    scopes = doc.get("scopes_supported") or []
    response_types = doc.get("response_types_supported") or []
    grant_types = doc.get("grant_types_supported") or []
    code_challenges = doc.get("code_challenge_methods_supported") or []

    # 1. Insecure HTTP endpoints check
    insecure_endpoints = []
    for ep_name, ep_url in [("authorization_endpoint", auth_ep), ("token_endpoint", token_ep), ("jwks_uri", jwks_uri)]:
        if ep_url and ep_url.lower().startswith("http://"):
            insecure_endpoints.append(f"{ep_name} ({ep_url})")

    if insecure_endpoints:
        findings.append(Finding(
            check_type="deep_oauth_http_endpoint",
            name="Insecure Cleartext OAuth/OIDC Endpoint Declared",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-4,
            title="OAuth/OIDC Metadata Declares Cleartext HTTP Endpoint",
            summary=f"OpenID Connect discovery document at {doc_url} specifies cleartext HTTP endpoint(s): {', '.join(insecure_endpoints)}.",
            why_it_matters="OAuth token and authorization requests sent over plain HTTP expose authorization codes and tokens to network eavesdropping.",
            how_to_fix="Ensure all OAuth/OIDC endpoints use TLS (HTTPS) exclusively.",
            estimated_fix_minutes=15,
            documentation_url="https://datatracker.ietf.org/doc/html/rfc6749#section-3.1",
            evidence=f"Insecure endpoints in {doc_url}: {insecure_endpoints}.",
        ))

    # 2. PKCE Support check
    has_pkce_s256 = "S256" in code_challenges
    if not has_pkce_s256:
        findings.append(Finding(
            check_type="deep_oauth_missing_pkce",
            name="OAuth PKCE (RFC 7636) Support Not Advertised",
            status=CheckStatus.WARNING,
            severity=Severity.LOW,
            score_impact=-2,
            title="PKCE (S256) Not Explicitly Supported in OIDC Metadata",
            summary=f"The OpenID Connect discovery at {doc_url} does not declare 'S256' in code_challenge_methods_supported.",
            why_it_matters=(
                "Proof Key for Code Exchange (PKCE, RFC 7636) prevents authorization code interception attacks, "
                "especially in public clients, SPAs, and mobile applications."
            ),
            how_to_fix="Enable and enforce PKCE with S256 code challenge method on the OAuth 2.0 authorization server.",
            estimated_fix_minutes=30,
            documentation_url="https://datatracker.ietf.org/doc/html/rfc7636",
            evidence=f"code_challenge_methods_supported: {code_challenges or 'None declared'}.",
        ))

    # 3. Implicit Flow warning
    has_implicit = "implicit" in grant_types or any("token" in rt.split() for rt in response_types)
    if has_implicit:
        findings.append(Finding(
            check_type="deep_oauth_implicit_grant_allowed",
            name="OAuth 2.0 Implicit Grant Flow Advertised",
            status=CheckStatus.WARNING,
            severity=Severity.LOW,
            score_impact=-2,
            title="Deprecated OAuth 2.0 Implicit Flow Advertised",
            summary=f"OIDC metadata at {doc_url} advertises support for the legacy Implicit grant flow.",
            why_it_matters=(
                "The OAuth 2.0 Security Best Current Practice (BCP) deprecates the Implicit flow because "
                "access tokens are returned in the URL fragment, where they are vulnerable to leakage."
            ),
            how_to_fix="Migrate client applications to the Authorization Code flow with PKCE and disable the Implicit grant.",
            estimated_fix_minutes=45,
            documentation_url="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics",
            evidence=f"Implicit flow advertised in grant_types_supported / response_types_supported at {doc_url}.",
        ))

    # 4. Resource Owner Password Credentials (ROPC) warning
    if "password" in grant_types:
        findings.append(Finding(
            check_type="deep_oauth_password_grant_allowed",
            name="OAuth 2.0 Resource Owner Password Grant Advertised",
            status=CheckStatus.WARNING,
            severity=Severity.LOW,
            score_impact=-2,
            title="Legacy Password Grant (ROPC) Advertised in OIDC Metadata",
            summary=f"OIDC metadata at {doc_url} includes the 'password' grant type in grant_types_supported.",
            why_it_matters="The Resource Owner Password Credentials grant requires the client to handle user passwords directly, increasing credential exposure risk.",
            how_to_fix="Disable the password grant type in favor of Authorization Code with PKCE or modern WebAuthn/Passkey flows.",
            estimated_fix_minutes=30,
            documentation_url="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics#section-2.4",
            evidence=f"Grant types at {doc_url} include 'password'.",
        ))

    # 5. Metadata discovery informational finding
    findings.append(Finding(
        check_type="deep_oidc_metadata_exposed",
        name="OpenID Connect Configuration Document Discovered",
        status=CheckStatus.PASS,
        severity=Severity.INFO,
        score_impact=0,
        title="OpenID Connect Identity Provider Metadata Discovered",
        summary=f"Public OIDC discovery document parsed from {doc_url} (Issuer: {issuer or 'Declared'}).",
        why_it_matters="OpenID Connect discovery (RFC 8414) standardizes client auto-configuration and identity endpoints.",
        how_to_fix="Maintain standard OIDC endpoint security and TLS encryption.",
        estimated_fix_minutes=0,
        documentation_url="https://openid.net/specs/openid-connect-discovery-1_0.html",
        evidence=f"Discovered OIDC metadata: Issuer='{issuer}', TokenEndpoint='{token_ep}', JWKS='{jwks_uri}'.",
    ))

    oidc_info = {
        "url": doc_url,
        "issuer": issuer,
        "authorization_endpoint": auth_ep,
        "token_endpoint": token_ep,
        "jwks_uri": jwks_uri,
        "userinfo_endpoint": userinfo_ep,
        "scopes_supported": scopes[:15],
        "response_types_supported": response_types[:10],
        "grant_types_supported": grant_types[:10],
        "code_challenge_methods_supported": code_challenges[:5],
        "has_pkce_s256": has_pkce_s256,
        "has_implicit_flow": has_implicit,
        "has_password_grant": "password" in grant_types,
    }

    return oidc_info, findings


def analyze_oauth_redirect_uris(urls: List[str]) -> Tuple[List[Dict[str, Any]], List[Finding]]:
    """
    Passively audits redirect_uri query parameters observed in authorization URLs.
    Checks for cleartext HTTP redirect targets and wildcard indicators.
    """
    redirect_observations: List[Dict[str, Any]] = []
    findings: List[Finding] = []
    seen: Set[str] = set()

    for url in urls:
        if not url:
            continue
        parsed = urlparse(url)
        if not parsed.query:
            continue

        qs = parse_qs(parsed.query, keep_blank_values=False)
        for p_name in ("redirect_uri", "callback", "callback_url", "redirect_url"):
            if p_name in qs:
                for raw_ruri in qs[p_name]:
                    ruri = unquote(raw_ruri.strip())
                    if not ruri or ruri in seen:
                        continue
                    seen.add(ruri)

                    r_parsed = urlparse(ruri)
                    is_http = r_parsed.scheme.lower() == "http" and r_parsed.hostname not in ("localhost", "127.0.0.1", None)
                    is_wildcard = "*" in ruri

                    obs = {
                        "source_url": url,
                        "parameter": p_name,
                        "redirect_uri": ruri,
                        "is_insecure_http": is_http,
                        "is_wildcard": is_wildcard,
                    }
                    redirect_observations.append(obs)

                    if is_http:
                        findings.append(Finding(
                            check_type="deep_oauth_http_endpoint",
                            name="OAuth Redirect URI Uses Insecure HTTP",
                            status=CheckStatus.WARNING,
                            severity=Severity.MEDIUM,
                            score_impact=-4,
                            title="OAuth redirect_uri Target Uses Unencrypted HTTP",
                            summary=f"OAuth authorization URL specifies an unencrypted HTTP callback: {ruri}.",
                            why_it_matters=(
                                "Transmitting authorization codes over unencrypted HTTP permits eavesdroppers "
                                "on the network to steal codes and exchange them for user access tokens."
                            ),
                            how_to_fix="Ensure all OAuth 2.0 client redirect URIs use strict HTTPS schemes.",
                            estimated_fix_minutes=15,
                            documentation_url="https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.1",
                            evidence=f"Insecure redirect_uri '{ruri}' found in authorization URL: {url}.",
                        ))

                    elif is_wildcard:
                        findings.append(Finding(
                            check_type="deep_oauth_redirect_uri_exposure",
                            name="OAuth Redirect URI Contains Wildcard Pattern",
                            status=CheckStatus.WARNING,
                            severity=Severity.LOW,
                            score_impact=-2,
                            title="Permissive Wildcard Pattern in OAuth redirect_uri",
                            summary=f"OAuth callback parameter '{ruri}' contains a wildcard pattern (*).",
                            why_it_matters=(
                                "Wildcard redirect URIs can allow attackers to redirect authorization codes "
                                "to attacker-controlled subdomains or unvalidated paths."
                            ),
                            how_to_fix="Enforce exact, full-path matching for all registered client redirect URIs.",
                            estimated_fix_minutes=20,
                            documentation_url="https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics#section-4.1",
                            evidence=f"Wildcard redirect_uri '{ruri}' in {url}.",
                        ))

    return redirect_observations, findings


def analyze_saml_metadata(body: str, url: str) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively inspects SAML 2.0 metadata XML responses for entity identifiers
    and Single Sign-On service endpoints.
    """
    findings: List[Finding] = []
    if "entitydescriptor" not in body.lower() and "singlesignonservice" not in body.lower():
        return {}, []

    entity_id_match = re.search(r'entityID=["\']([^"\']+)["\']', body, re.I)
    entity_id = entity_id_match.group(1) if entity_id_match else None

    sso_bindings = []
    for m in re.finditer(r'<[a-zA-Z0-9:]*SingleSignOnService[^>]*Binding=["\']([^"\']+)["\'][^>]*Location=["\']([^"\']+)["\']', body, re.I):
        sso_bindings.append({
            "binding": m.group(1),
            "location": m.group(2),
        })

    saml_info = {
        "url": url,
        "entity_id": entity_id,
        "sso_services_count": len(sso_bindings),
        "sso_services": sso_bindings[:5],
    }

    findings.append(Finding(
        check_type="deep_saml_metadata_exposed",
        name="SAML 2.0 Identity Provider Metadata Discovered",
        status=CheckStatus.PASS,
        severity=Severity.INFO,
        score_impact=0,
        title="SAML 2.0 Federation Metadata Discovered",
        summary=f"Public SAML metadata discovered at {url} (EntityID: {entity_id or 'Declared'}).",
        why_it_matters="SAML metadata publishes SAML entity identifiers, SSO endpoints, and signing certificates for enterprise SSO federation.",
        how_to_fix="Maintain standard SSO metadata encryption and certificate rotation procedures.",
        estimated_fix_minutes=0,
        documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/SAML_Security_Cheat_Sheet.html",
        evidence=f"Discovered SAML metadata at {url}: EntityID='{entity_id}'.",
    ))

    return saml_info, findings
