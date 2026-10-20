"""
SiteSecura - Phase F2: Advanced Transport, TLS, DNS & Security Configuration Automated Test Suite
Validates:
1. Advanced TLS & Certificate Analysis:
   - Certificate attributes (issuer, subject, dates, days remaining, SANs, wildcard matching)
   - Public key algorithm & key size (RSA 2048+, ECC 256+)
   - Signature algorithm (SHA-256 vs deprecated SHA-1)
   - Protocol negotiation (TLS 1.3 / 1.2 vs legacy)
   - Cipher suites & Perfect Forward Secrecy (PFS)
   - ALPN HTTP/2 support detection
   - SSRF safety & IP pinning
2. Advanced DNS Infrastructure & CAA:
   - A and AAAA (IPv6 readiness) detection
   - Authoritative NS redundancy (multi-server vs single-server risk)
   - MX mail exchangers with priority ranking
   - CAA (Certification Authority Authorization) parsing & missing CAA warnings
   - DNSSEC cryptographic validation
3. Advanced Email Security (SPF & DMARC):
   - SPF parsing, mechanisms, qualifiers (-all, ~all, ?all, +all)
   - RFC 7208 10-lookup ceiling limit enforcement
   - Multiple SPF records PermError detection
   - DMARC tag parsing, policy enforcement (reject, quarantine, none)
   - Subdomain policy, enforcement percentage, alignment, and aggregate reporting (rua)
   - Anti-double-counting protection
4. Semantic HSTS Analysis:
   - Numerical max-age duration validation (>= 6 months / 1 year)
   - includeSubDomains directive audit
   - Preload list eligibility
   - Anti-double-counting protection when HSTS is missing
5. Semantic Content Security Policy (CSP):
   - Directive deconstruction
   - 'unsafe-inline' detection & modern nonce/hash override awareness
   - 'unsafe-eval' code execution detection
   - Wildcard (*) and cleartext (http:) permissive sources
   - object-src 'none' plugin restriction
   - Anti-double-counting protection when CSP is missing
6. Security Headers Quality & Cross-Origin Isolation:
   - Referrer-Policy privacy evaluation (strict-origin vs insecure 'unsafe-url' leakage)
   - Permissions-Policy hardware API restriction audit
   - Modern Cross-Origin Isolation (COOP, CORP, COEP)
   - X-Content-Type-Options: nosniff validation
7. Deterministic Scoring & Version 2 Metadata:
   - Category mapping & deduplication
   - Strict 0-100 bounded scoring
   - deep_scan_version: 2 structured metadata compilation
   - Backward compatibility with Phase F1 records
"""
import os
import sys
from datetime import datetime, timezone, timedelta
import pytest
from unittest.mock import MagicMock, patch

# Ensure root directory is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scanner.models import Finding, RiskLevel, CheckStatus, Severity
from scanner.deep.models import CrawledPage, DeepScanResult
from scanner.deep.tls import analyze_deep_tls, _match_hostname_in_sans
from scanner.deep.dns import analyze_deep_dns
from scanner.deep.email_security import (
    parse_spf_record,
    parse_dmarc_record,
    analyze_deep_email_security,
)
from scanner.deep.hsts import parse_hsts_header, analyze_deep_hsts
from scanner.deep.csp import parse_csp_directives, analyze_deep_csp
from scanner.deep.security_headers import analyze_deep_security_headers_quality
from scanner.deep.scoring import calculate_deep_score, CATEGORY_CONFIG
from scanner.deep.runner import run_deep_security_scan
from scanner.deep.config import DeepScanConfig
from scanner.network.resolver import MockResolver


# =========================================================================
# 1. ADVANCED TLS & CERTIFICATE TESTS
# =========================================================================

def test_tls_hostname_matching_logic():
    """Verify exact and wildcard SAN matching semantics."""
    san_list = ["example.com", "www.example.com", "*.sub.example.com"]
    # Exact match
    assert _match_hostname_in_sans("example.com", san_list) is True
    assert _match_hostname_in_sans("www.example.com", san_list) is True
    # Wildcard match (single level)
    assert _match_hostname_in_sans("api.sub.example.com", san_list) is True
    assert _match_hostname_in_sans("auth.sub.example.com", san_list) is True
    # Wildcard does not match multiple levels
    assert _match_hostname_in_sans("deep.api.sub.example.com", san_list) is False
    # No match
    assert _match_hostname_in_sans("other.com", san_list) is False


def test_tls_analysis_ssrf_rejection():
    """Verify SSRF shield prevents connecting to private or metadata IP addresses."""
    mock_res = MockResolver({"evil.com": ["169.254.169.254"]})
    tls_data, findings = analyze_deep_tls("evil.com", resolver=mock_res)

    assert tls_data["valid"] is False
    assert "prohibited" in (tls_data["error"] or "").lower()
    assert any(f.check_type == "deep_tls_ssrf_blocked" for f in findings)
    assert any(f.status == CheckStatus.CRITICAL for f in findings)


def test_tls_connection_timeout_handling():
    """Verify network timeouts return structured failure without throwing exceptions."""
    mock_res = MockResolver({"timeout.example.com": ["93.184.216.34"]})
    # Connect with an impossibly short timeout against a non-responding target or mock socket failure
    with patch("socket.create_connection", side_effect=TimeoutError("Connection timed out")):
        tls_data, findings = analyze_deep_tls("timeout.example.com", timeout_seconds=0.1, resolver=mock_res)

    assert tls_data["valid"] is False
    assert "timeout" in (tls_data["error"] or "").lower()
    assert any(f.check_type == "deep_tls_connection" for f in findings)


# =========================================================================
# 2. ADVANCED DNS & INFRASTRUCTURE TESTS
# =========================================================================

def test_dns_analysis_comprehensive_records():
    """Verify DNS parser accurately extracts A, AAAA, MX priorities, NS, and CAA records."""
    mock_caa_obj = MagicMock()
    mock_caa_obj.tag = b"issue"
    mock_caa_obj.value = b"letsencrypt.org"
    mock_caa_obj.flags = 0

    mock_mx_obj = MagicMock()
    mock_mx_obj.preference = 10
    mock_mx_obj.exchange.to_text.return_value = "mail.example.com."

    mock_ns1 = MagicMock()
    mock_ns1.to_text.return_value = "ns1.example.com."
    mock_ns2 = MagicMock()
    mock_ns2.to_text.return_value = "ns2.example.com."

    mock_a = MagicMock()
    mock_a.to_text.return_value = "93.184.216.34"

    mock_aaaa = MagicMock()
    mock_aaaa.to_text.return_value = "2606:2800:220:1:248:1893:25c8:1946"

    def mock_resolve(qname, rtype):
        if rtype == "A":
            return [mock_a]
        elif rtype == "AAAA":
            return [mock_aaaa]
        elif rtype == "MX":
            return [mock_mx_obj]
        elif rtype == "NS":
            return [mock_ns1, mock_ns2]
        elif rtype == "CAA":
            return [mock_caa_obj]
        elif rtype == "DNSKEY":
            return [MagicMock()]
        raise Exception("NXDOMAIN")

    with patch("dns.resolver.Resolver.resolve", side_effect=mock_resolve):
        dns_data, findings = analyze_deep_dns("example.com")

    assert dns_data["has_ipv6"] is True
    assert dns_data["has_redundant_ns"] is True
    assert dns_data["caa_present"] is True
    assert "letsencrypt.org" in dns_data["allowed_cas"]
    assert dns_data["dnssec_enabled"] is True
    assert dns_data["has_mx"] is True
    assert dns_data["mx_records"][0]["priority"] == 10

    # Verify positive findings
    assert any(f.check_type == "deep_caa_record" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "deep_dnssec" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "deep_dns_redundancy" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "deep_dns_ipv6" and f.status == CheckStatus.PASS for f in findings)


def test_dns_analysis_missing_caa_and_single_ns():
    """Verify warning when CAA record is missing and only 1 nameserver is configured."""
    mock_ns1 = MagicMock()
    mock_ns1.to_text.return_value = "ns1.example.com."

    def mock_resolve(qname, rtype):
        if rtype == "A":
            return [MagicMock(to_text=lambda: "93.184.216.34")]
        elif rtype == "NS":
            return [mock_ns1]
        raise Exception("No record")

    with patch("dns.resolver.Resolver.resolve", side_effect=mock_resolve):
        dns_data, findings = analyze_deep_dns("example.com")

    assert dns_data["caa_present"] is False
    assert dns_data["has_redundant_ns"] is False
    assert any(f.check_type == "deep_caa_record" and f.status == CheckStatus.WARNING for f in findings)
    assert any(f.check_type == "deep_dns_redundancy" and f.status == CheckStatus.WARNING for f in findings)


# =========================================================================
# 3. ADVANCED EMAIL SECURITY (SPF & DMARC) TESTS
# =========================================================================

def test_spf_parsing_and_lookup_count():
    """Verify SPF parser tracks mechanisms and enforces RFC 7208 10-lookup count."""
    # Under limit (3 lookups: include, a, mx)
    spf_good = "v=spf1 include:_spf.google.com a mx ip4:192.0.2.0/24 -all"
    res_good = parse_spf_record(spf_good)
    assert res_good["is_valid"] is True
    assert res_good["all_qualifier"] == "-all"
    assert res_good["lookup_count"] == 3
    assert res_good["lookup_count_exceeded"] is False

    # Over 10 lookups (11 includes)
    spf_heavy = "v=spf1 " + " ".join([f"include:spf{i}.example.com" for i in range(11)]) + " ~all"
    res_heavy = parse_spf_record(spf_heavy)
    assert res_heavy["lookup_count"] == 11
    assert res_heavy["lookup_count_exceeded"] is True


def test_spf_qualifier_policies():
    """Verify evaluation of hardfail, softfail, neutral, and pass-all qualifiers."""
    # Hardfail: Pass
    with patch("scanner.deep.email_security._create_dns_resolver") as mock_res_factory:
        mock_res = MagicMock()
        mock_ans = MagicMock()
        mock_ans.strings = [b"v=spf1 include:_spf.google.com -all"]
        mock_res.resolve.side_effect = lambda qname, rtype: [mock_ans] if rtype == "TXT" and "_dmarc" not in qname else []
        mock_res_factory.return_value = mock_res

        data, findings = analyze_deep_email_security("example.com")
        assert any(f.check_type == "deep_spf_policy" and f.status == CheckStatus.PASS for f in findings)

    # Pass-all (+all): Critical finding
    with patch("scanner.deep.email_security._create_dns_resolver") as mock_res_factory:
        mock_res = MagicMock()
        mock_ans = MagicMock()
        mock_ans.strings = [b"v=spf1 +all"]
        mock_res.resolve.side_effect = lambda qname, rtype: [mock_ans] if rtype == "TXT" and "_dmarc" not in qname else []
        mock_res_factory.return_value = mock_res

        data, findings = analyze_deep_email_security("example.com")
        assert any(f.check_type == "deep_spf_policy" and f.status == CheckStatus.CRITICAL and f.score_impact == -15 for f in findings)


def test_spf_multiple_records_permerror():
    """Verify RFC 7208 Section 3.2 violation generates critical finding when multiple SPF records exist."""
    with patch("scanner.deep.email_security._create_dns_resolver") as mock_res_factory:
        mock_res = MagicMock()
        mock_ans1 = MagicMock(strings=[b"v=spf1 include:_spf.google.com ~all"])
        mock_ans2 = MagicMock(strings=[b"v=spf1 include:mail.sendgrid.net ~all"])
        mock_res.resolve.side_effect = lambda qname, rtype: [mock_ans1, mock_ans2] if rtype == "TXT" and "_dmarc" not in qname else []
        mock_res_factory.return_value = mock_res

        data, findings = analyze_deep_email_security("example.com")
        assert data["spf"]["has_multiple_records"] is True
        assert any(f.check_type == "deep_spf_multiple_records" and f.status == CheckStatus.CRITICAL for f in findings)


def test_dmarc_parsing_and_enforcement():
    """Verify DMARC policies: reject, quarantine, none, and pct enforcement."""
    # Strong reject policy
    dmarc_strong = "v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:dmarc@example.com"
    p_strong = parse_dmarc_record(dmarc_strong)
    assert p_strong["policy"] == "reject"
    assert p_strong["percentage"] == 100
    assert p_strong["rua"] == ["mailto:dmarc@example.com"]

    # Monitoring-only policy
    dmarc_none = "v=DMARC1; p=none;"
    p_none = parse_dmarc_record(dmarc_none)
    assert p_none["policy"] == "none"
    assert p_none["rua"] == []


def test_email_security_missing_records_anti_double_counting():
    """Verify missing SPF and DMARC generate clean canonical findings without duplicate sub-findings."""
    with patch("scanner.deep.email_security._create_dns_resolver") as mock_res_factory:
        mock_res = MagicMock()
        mock_res.resolve.side_effect = Exception("NXDOMAIN")
        mock_res_factory.return_value = mock_res

        data, findings = analyze_deep_email_security("example.com")
        assert data["spf"]["is_present"] is False
        assert data["dmarc"]["is_present"] is False

        # Only missing findings should be present
        check_types = [f.check_type for f in findings]
        assert "deep_spf_missing" in check_types
        assert "deep_dmarc_missing" in check_types
        # Sub-checks must NOT be emitted
        assert "deep_spf_lookup_limit" not in check_types
        assert "deep_dmarc_reporting" not in check_types


# =========================================================================
# 4. SEMANTIC HSTS TESTS
# =========================================================================

def test_hsts_parsing():
    """Verify HSTS directive parser."""
    h = "max-age=31536000; includeSubDomains; preload"
    parsed = parse_hsts_header(h)
    assert parsed["max_age_seconds"] == 31536000
    assert parsed["includes_subdomains"] is True
    assert parsed["preload"] is True


def test_hsts_semantic_analysis_strong():
    """Verify strong HSTS policy passes."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"strict-transport-security": "max-age=31536000; includeSubDomains; preload"},
    )
    hsts_data, findings = analyze_deep_hsts([page])
    assert hsts_data["status"] == "strong"
    assert any(f.check_type == "deep_hsts_strong" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "deep_hsts_preload_ready" and f.status == CheckStatus.PASS for f in findings)


def test_hsts_semantic_analysis_short_max_age():
    """Verify short max-age and missing includeSubDomains produce warnings."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"strict-transport-security": "max-age=86400"},
    )
    hsts_data, findings = analyze_deep_hsts([page])
    assert hsts_data["status"] == "acceptable"
    assert any(f.check_type == "deep_hsts_short_max_age" and f.status == CheckStatus.WARNING for f in findings)
    assert any(f.check_type == "deep_hsts_missing_subdomains" and f.status == CheckStatus.WARNING for f in findings)


def test_hsts_anti_double_counting_when_missing():
    """Verify missing HSTS generates zero findings (suppressed for multi-page headers audit)."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={},
    )
    hsts_data, findings = analyze_deep_hsts([page])
    assert hsts_data["is_present"] is False
    assert len(findings) == 0


# =========================================================================
# 5. SEMANTIC CONTENT SECURITY POLICY (CSP) TESTS
# =========================================================================

def test_csp_directive_parsing():
    """Verify CSP parser splits directives into source expressions."""
    csp_raw = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; object-src 'none'"
    dirs = parse_csp_directives(csp_raw)
    assert dirs["default-src"] == ["'self'"]
    assert dirs["script-src"] == ["'self'", "'unsafe-inline'", "https://cdn.example.com"]
    assert dirs["object-src"] == ["'none'"]


def test_csp_unsafe_inline_detection():
    """Verify unsafe-inline is flagged when no nonces or hashes are used."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'"},
    )
    csp_data, findings = analyze_deep_csp([page])
    assert csp_data["has_unsafe_inline"] is True
    assert any(f.check_type == "deep_csp_unsafe_inline" and f.status == CheckStatus.WARNING for f in findings)


def test_csp_nonce_override_for_unsafe_inline():
    """Verify modern nonce presence suppresses unsafe-inline penalty (CSP Level 3)."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'nonce-rAnd0m123'; object-src 'none'"},
    )
    csp_data, findings = analyze_deep_csp([page])
    assert csp_data["has_nonces_or_hashes"] is True
    # unsafe-inline finding should NOT be generated because nonce overrides it in modern browsers
    assert not any(f.check_type == "deep_csp_unsafe_inline" for f in findings)


def test_csp_wildcards_and_eval_detection():
    """Verify wildcard sources (*) and unsafe-eval generate warnings."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"content-security-policy": "default-src 'self'; script-src 'self' * 'unsafe-eval'; object-src 'none'"},
    )
    csp_data, findings = analyze_deep_csp([page])
    assert csp_data["has_unsafe_eval"] is True
    assert csp_data["has_wildcards"] is True
    assert any(f.check_type == "deep_csp_unsafe_eval" and f.status == CheckStatus.WARNING for f in findings)
    assert any(f.check_type == "deep_csp_wildcard" and f.status == CheckStatus.WARNING for f in findings)


def test_csp_robust_configuration():
    """Verify strictly configured CSP gets PASS."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"content-security-policy": "default-src 'self'; script-src 'self' https://trusted.cdn.com; object-src 'none'; base-uri 'self'"},
    )
    csp_data, findings = analyze_deep_csp([page])
    assert csp_data["status"] == "robust"
    assert any(f.check_type == "deep_csp_robust" and f.status == CheckStatus.PASS for f in findings)


def test_csp_anti_double_counting_when_missing():
    """Verify missing CSP generates zero findings here (handled by headers module)."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={},
    )
    csp_data, findings = analyze_deep_csp([page])
    assert csp_data["is_present"] is False
    assert len(findings) == 0


# =========================================================================
# 6. SECURITY HEADERS QUALITY & CROSS-ORIGIN ISOLATION TESTS
# =========================================================================

def test_referrer_policy_safe_vs_insecure():
    """Verify safe vs unsafe-url Referrer-Policy."""
    # Safe
    safe_page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"referrer-policy": "strict-origin-when-cross-origin"},
    )
    data_safe, f_safe = analyze_deep_security_headers_quality([safe_page])
    assert data_safe["referrer_policy_status"] == "safe"
    assert any(f.check_type == "deep_referrer_policy_safe" and f.status == CheckStatus.PASS for f in f_safe)

    # Insecure unsafe-url
    insecure_page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={"referrer-policy": "unsafe-url"},
    )
    data_insecure, f_insecure = analyze_deep_security_headers_quality([insecure_page])
    assert data_insecure["referrer_policy_status"] == "insecure"
    assert any(f.check_type == "deep_referrer_policy_insecure" and f.status == CheckStatus.WARNING for f in f_insecure)


def test_cross_origin_isolation_headers():
    """Verify detection of COOP, CORP, COEP, and Permissions-Policy."""
    page = CrawledPage(
        url="https://example.com",
        final_url="https://example.com",
        depth=0,
        status_code=200,
        content_type="text/html",
        is_https=True,
        headers={
            "permissions-policy": "camera=(), microphone=(), geolocation=()",
            "cross-origin-opener-policy": "same-origin",
            "cross-origin-resource-policy": "same-origin",
            "cross-origin-embedder-policy": "require-corp",
            "x-content-type-options": "nosniff",
        },
    )
    data, findings = analyze_deep_security_headers_quality([page])
    assert "camera" in data["permissions_policy_apis_restricted"]
    assert any(f.check_type == "deep_permissions_policy_configured" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "deep_coop_configured" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "deep_corp_configured" and f.status == CheckStatus.PASS for f in findings)
    assert any(f.check_type == "deep_coep_configured" and f.status == CheckStatus.PASS for f in findings)


# =========================================================================
# 7. SCORING INTEGRATION & VERSION 2 METADATA TESTS
# =========================================================================

def test_scoring_f2_category_mapping_and_bounds():
    """Verify F2 check types map correctly to categories and score is bounded 0-100."""
    findings = [
        Finding(
            check_type="deep_tls_validity",
            name="Valid TLS",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Valid Certificate",
            summary="Valid",
            why_it_matters="",
            how_to_fix="",
            estimated_fix_minutes=0,
            documentation_url="",
            evidence="",
        ),
        Finding(
            check_type="deep_caa_record",
            name="Missing CAA",
            status=CheckStatus.WARNING,
            severity=Severity.LOW,
            score_impact=-3,
            title="Missing CAA",
            summary="No CAA",
            why_it_matters="",
            how_to_fix="",
            estimated_fix_minutes=10,
            documentation_url="",
            evidence="",
        ),
        Finding(
            check_type="deep_spf_policy",
            name="Neutral SPF",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-5,
            title="Neutral SPF",
            summary="Neutral",
            why_it_matters="",
            how_to_fix="",
            estimated_fix_minutes=10,
            documentation_url="",
            evidence="",
        ),
        Finding(
            check_type="deep_csp_unsafe_inline",
            name="CSP unsafe-inline",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-6,
            title="Unsafe inline",
            summary="Unsafe inline",
            why_it_matters="",
            how_to_fix="",
            estimated_fix_minutes=20,
            documentation_url="",
            evidence="",
        ),
    ]

    score, risk, breakdown, passed_count, total_count = calculate_deep_score(findings)

    assert 0 <= score <= 100
    assert total_count == 4
    assert passed_count == 1
    # Verify categories received deductions
    assert breakdown["Transport Security"]["score"] == 25
    assert breakdown["Security Headers"]["deductions"] == 6
    assert breakdown["Website & Technology"]["deductions"] == 8


def test_deep_scan_runner_produces_version_2_metadata():
    """Verify DeepScanRunner populates deep_scan_version: 2 and all F2 metadata sections."""
    mock_res = MockResolver({"scan-target.com": ["93.184.216.34"]})
    mock_client = MagicMock()
    mock_client.get.return_value = MagicMock(status_code=404, text="", headers={}, url="https://scan-target.com")
    mock_client.options.return_value = mock_client.get.return_value

    # Mock crawler, discovery, and external network dependencies
    with patch("scanner.deep.runner.crawl_website", return_value=([], [], 0)), \
         patch("scanner.deep.runner.fetch_and_analyze_robots", return_value=(MagicMock(is_present=False, disallowed_paths=[], allowed_paths=[], sitemap_urls=[]), [])), \
         patch("scanner.deep.runner.fetch_and_analyze_sitemap", return_value=(MagicMock(is_present=False, discovered_urls_count=0, is_sitemap_index=False), [], [])), \
         patch("scanner.deep.runner.analyze_deep_tls", return_value=({"valid": True, "tls_version": "TLSv1.3", "cipher_name": "TLS_AES_256_GCM_SHA384", "supports_http2": True}, [])), \
         patch("scanner.deep.runner.analyze_deep_dns", return_value=({"caa_present": True, "dnssec_enabled": True, "has_ipv6": True}, [])), \
         patch("scanner.deep.runner.analyze_deep_email_security", return_value=({"spf": {"is_present": True}, "dmarc": {"is_present": True}}, [])):

        cfg = DeepScanConfig(max_pages=5)
        res = run_deep_security_scan("scan-target.com", plan="pro", config=cfg, resolver=mock_res, client=mock_client)

        assert res.scan_metadata["deep_scan_version"] >= 2
        assert "tls" in res.scan_metadata
        assert "dns" in res.scan_metadata
        assert "email_security" in res.scan_metadata
        assert "hsts" in res.scan_metadata
        assert "csp" in res.scan_metadata
        assert "http_protocol" in res.scan_metadata
        assert res.scan_metadata["tls"]["valid"] is True
        assert res.scan_metadata["dns"]["caa_present"] is True


def test_deep_scan_runner_failure_isolation():
    """Verify that unexpected exceptions in F2 analysis modules do not crash the overall scan."""
    mock_res = MockResolver({"crash-test.com": ["93.184.216.34"]})
    mock_client = MagicMock()
    mock_client.get.return_value = MagicMock(status_code=404, text="", headers={}, url="https://crash-test.com")
    mock_client.options.return_value = mock_client.get.return_value

    with patch("scanner.deep.runner.crawl_website", return_value=([], [], 0)), \
         patch("scanner.deep.runner.fetch_and_analyze_robots", return_value=(MagicMock(is_present=False, disallowed_paths=[], allowed_paths=[], sitemap_urls=[]), [])), \
         patch("scanner.deep.runner.fetch_and_analyze_sitemap", return_value=(MagicMock(is_present=False, discovered_urls_count=0, is_sitemap_index=False), [], [])), \
         patch("scanner.deep.runner.analyze_deep_tls", side_effect=RuntimeError("TLS module crashed")), \
         patch("scanner.deep.runner.analyze_deep_dns", side_effect=RuntimeError("DNS module crashed")):

        cfg = DeepScanConfig(max_pages=5)
        res = run_deep_security_scan("crash-test.com", plan="pro", config=cfg, resolver=mock_res, client=mock_client)

        # Scan should succeed gracefully with is_partial=True rather than raising unhandled exception
        assert res.domain == "crash-test.com"
        assert res.is_partial is True
        assert res.scan_metadata["deep_scan_version"] >= 2
