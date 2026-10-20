"""
Automated Test Suite - Scanner Check Modules
Tests security headers, cookie analysis, tech fingerprinting, and recommendation catalog.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scanner.headers_check import check_security_headers
from scanner.cookies_check import check_cookies
from scanner.tech_check import check_technologies
from scanner.recommendations import get_recommendation, RECOMMENDATIONS_CATALOG
from scanner.models import CheckStatus


def test_headers_check_missing_all():
    headers = {}
    res = check_security_headers(headers)
    findings = res["findings"]

    # Should detect missing HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
    hsts_finding = next(f for f in findings if f.check_type == "hsts")
    assert hsts_finding.status == CheckStatus.WARNING
    assert hsts_finding.score_impact == -8

    csp_finding = next(f for f in findings if f.check_type == "csp")
    assert csp_finding.status == CheckStatus.WARNING
    assert csp_finding.score_impact == -8


def test_headers_check_present():
    headers = {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Content-Security-Policy": "default-src 'self'",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }
    res = check_security_headers(headers)
    findings = res["findings"]

    for f in findings:
        if f.check_type in ("hsts", "csp", "x_frame_options", "x_content_type_options", "referrer_policy"):
            assert f.status == CheckStatus.PASS
            assert f.score_impact == 0


def test_cookie_security():
    # Insecure cookie
    headers = {"Set-Cookie": "sessionid=xyz123; Path=/"}
    res = check_cookies(headers, {"sessionid": "xyz123"})
    finding = res["findings"][0]
    assert finding.status == CheckStatus.WARNING
    assert finding.score_impact < 0

    # Secure cookie
    headers_sec = {"Set-Cookie": "sessionid=xyz123; Path=/; Secure; HttpOnly; SameSite=Lax"}
    res_sec = check_cookies(headers_sec, {"sessionid": "xyz123"})
    finding_sec = res_sec["findings"][0]
    assert finding_sec.status == CheckStatus.PASS
    assert finding_sec.score_impact == 0


def test_technology_fingerprinting():
    headers = {"Server": "cloudflare", "X-Powered-By": "Next.js"}
    html = "<div id='__next'>Hello Scanly</div>"
    res = check_technologies(headers, html)
    techs = [t["name"] for t in res["detected_technologies"]]
    assert "Cloudflare" in techs
    assert "Next.js" in techs


def test_recommendation_catalog():
    assert "ssl_expired" in RECOMMENDATIONS_CATALOG
    assert "hsts_missing" in RECOMMENDATIONS_CATALOG
    assert "dmarc_missing" in RECOMMENDATIONS_CATALOG

    rec = get_recommendation("ssl_expired")
    assert rec["severity"] == "critical"
    assert rec["estimated_fix_minutes"] > 0
    assert "documentation_url" in rec
