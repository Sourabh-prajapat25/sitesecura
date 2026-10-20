"""
Automated Test Suite - Individual Per-Cookie Security Parser (Phase A.10)
Tests:
1. Secure + HttpOnly + SameSite
2. Secure missing
3. HttpOnly missing
4. SameSite missing
5. Multiple cookies with mixed attributes
6. No cookies observed
7. Malformed cookie header
8. Cookie with Expires containing commas
9. SameSite=Lax
10. SameSite=Strict
11. SameSite=None
12. Isolation: attribute leakage prevention across distinct cookies
"""
import pytest
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scanner.cookies_check import (
    check_cookies,
    split_set_cookie_header,
    parse_cookie_string,
)
from scanner.models import CheckStatus


def test_1_secure_httponly_samesite_all_present():
    """1. Fully secured cookie passes with 0 score impact."""
    headers = {"Set-Cookie": "session=xyz123; Secure; HttpOnly; SameSite=Lax"}
    res = check_cookies(headers)
    assert res["cookies_data"]["cookies_found"] is True
    assert res["cookies_data"]["missing_secure"] is False
    assert res["cookies_data"]["missing_httponly"] is False
    assert res["cookies_data"]["missing_samesite"] is False

    finding = res["findings"][0]
    assert finding.status == CheckStatus.PASS
    assert finding.score_impact == 0


def test_2_secure_missing():
    """2. Cookie missing Secure flag is detected with deduction."""
    headers = {"Set-Cookie": "session=xyz123; HttpOnly; SameSite=Strict"}
    res = check_cookies(headers)
    assert res["cookies_data"]["missing_secure"] is True
    assert res["cookies_data"]["missing_httponly"] is False
    assert res["cookies_data"]["missing_samesite"] is False

    finding = res["findings"][0]
    assert finding.status == CheckStatus.WARNING
    assert finding.score_impact == -5
    assert "missing 'Secure'" in finding.summary


def test_3_httponly_missing():
    """3. Cookie missing HttpOnly flag is detected with deduction."""
    headers = {"Set-Cookie": "session=xyz123; Secure; SameSite=Lax"}
    res = check_cookies(headers)
    assert res["cookies_data"]["missing_secure"] is False
    assert res["cookies_data"]["missing_httponly"] is True
    assert res["cookies_data"]["missing_samesite"] is False

    finding = res["findings"][0]
    assert finding.status == CheckStatus.WARNING
    assert finding.score_impact == -3
    assert "missing 'HttpOnly'" in finding.summary


def test_4_samesite_missing():
    """4. Cookie missing SameSite flag is detected with deduction."""
    headers = {"Set-Cookie": "session=xyz123; Secure; HttpOnly"}
    res = check_cookies(headers)
    assert res["cookies_data"]["missing_secure"] is False
    assert res["cookies_data"]["missing_httponly"] is False
    assert res["cookies_data"]["missing_samesite"] is True

    finding = res["findings"][0]
    assert finding.status == CheckStatus.WARNING
    assert finding.score_impact == -2
    assert "missing 'SameSite'" in finding.summary


def test_5_multiple_cookies_with_mixed_attributes():
    """5. Multiple cookies with mixed attributes must evaluate each cookie individually."""
    # Cookie 1 is fully secure, Cookie 2 is missing Secure and SameSite
    set_cookie_raw = (
        "auth_token=secret123; Secure; HttpOnly; SameSite=Strict, "
        "tracking_id=track456; HttpOnly; Path=/"
    )
    headers = {"Set-Cookie": set_cookie_raw}
    res = check_cookies(headers)

    cookies = res["cookies_data"]["cookies"]
    assert len(cookies) == 2
    assert cookies[0]["name"] == "auth_token"
    assert cookies[0]["secure"] is True
    assert cookies[0]["httponly"] is True
    assert cookies[0]["samesite"] == "Strict"

    assert cookies[1]["name"] == "tracking_id"
    assert cookies[1]["secure"] is False
    assert cookies[1]["httponly"] is True
    assert cookies[1]["samesite"] is None

    # Overall finding must flag the insecure cookie, NOT claim all are secure
    assert res["cookies_data"]["missing_secure"] is True
    assert res["cookies_data"]["missing_samesite"] is True
    finding = res["findings"][0]
    assert finding.status == CheckStatus.WARNING
    assert finding.score_impact == -7  # -5 for Secure, -2 for SameSite
    assert "'tracking_id': missing 'Secure', missing 'SameSite'" in finding.summary


def test_6_no_cookies_observed():
    """6. Empty headers return NOT_APPLICABLE and 0 impact."""
    res = check_cookies(headers={})
    assert res["cookies_data"]["cookies_found"] is False
    assert res["cookies_data"]["cookie_count"] == 0

    finding = res["findings"][0]
    assert finding.status == CheckStatus.NOT_APPLICABLE
    assert finding.score_impact == 0


def test_7_malformed_cookie_header():
    """7. Malformed cookie strings are handled safely without crashing."""
    headers = {"Set-Cookie": ";;;;===; ; broken"}
    res = check_cookies(headers)
    assert res["cookies_data"]["cookie_count"] == 0
    assert res["findings"][0].status == CheckStatus.NOT_APPLICABLE


def test_8_cookie_with_expires_containing_commas():
    """8. Commas in Expires date stamps do not break cookie boundaries."""
    raw = (
        "sess=val1; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/; Secure; HttpOnly; SameSite=Lax, "
        "pref=dark; Expires=Thu, 01-Jan-2030 00:00:00 GMT; Path=/; Secure; HttpOnly; SameSite=Strict"
    )
    headers = {"Set-Cookie": raw}
    res = check_cookies(headers)
    cookies = res["cookies_data"]["cookies"]
    assert len(cookies) == 2
    assert cookies[0]["name"] == "sess"
    assert "Wed, 21 Oct 2026" in cookies[0]["expires"]
    assert cookies[0]["secure"] is True
    assert cookies[0]["httponly"] is True
    assert cookies[0]["samesite"] == "Lax"

    assert cookies[1]["name"] == "pref"
    assert "Thu, 01-Jan-2030" in cookies[1]["expires"]
    assert cookies[1]["secure"] is True
    assert cookies[1]["httponly"] is True
    assert cookies[1]["samesite"] == "Strict"

    assert res["findings"][0].status == CheckStatus.PASS


def test_9_samesite_lax():
    """9. SameSite=Lax parsed correctly."""
    cookie = parse_cookie_string("id=1; Secure; HttpOnly; SameSite=Lax")
    assert cookie is not None
    assert cookie.samesite == "Lax"


def test_10_samesite_strict():
    """10. SameSite=Strict parsed correctly."""
    cookie = parse_cookie_string("id=1; Secure; HttpOnly; SameSite=Strict")
    assert cookie is not None
    assert cookie.samesite == "Strict"


def test_11_samesite_none():
    """11. SameSite=None parsed correctly."""
    cookie = parse_cookie_string("id=1; Secure; HttpOnly; SameSite=None")
    assert cookie is not None
    assert cookie.samesite == "None"


def test_12_isolation_no_attribute_leakage():
    """
    12. Verify Cookie A's Secure flag is NEVER imputed onto Cookie B.
    """
    raw = "cookieA=1; Secure, cookieB=2; HttpOnly, cookieC=3; SameSite=Lax"
    headers = {"Set-Cookie": raw}
    res = check_cookies(headers)
    cookies = res["cookies_data"]["cookies"]
    assert len(cookies) == 3

    # A: Secure=True, HttpOnly=False, SameSite=None
    assert cookies[0]["name"] == "cookieA"
    assert cookies[0]["secure"] is True
    assert cookies[0]["httponly"] is False
    assert cookies[0]["samesite"] is None

    # B: Secure=False, HttpOnly=True, SameSite=None
    assert cookies[1]["name"] == "cookieB"
    assert cookies[1]["secure"] is False
    assert cookies[1]["httponly"] is True
    assert cookies[1]["samesite"] is None

    # C: Secure=False, HttpOnly=False, SameSite=Lax
    assert cookies[2]["name"] == "cookieC"
    assert cookies[2]["secure"] is False
    assert cookies[2]["httponly"] is False
    assert cookies[2]["samesite"] == "Lax"

    # All three flags are missing on at least one cookie
    assert res["cookies_data"]["missing_secure"] is True
    assert res["cookies_data"]["missing_httponly"] is True
    assert res["cookies_data"]["missing_samesite"] is True
    assert res["findings"][0].score_impact == -10
