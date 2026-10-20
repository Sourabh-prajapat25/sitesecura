"""
Automated Test Suite - Deterministic Scoring Engine
Verifies scoring logic, bounds clamping [0, 100], and risk tier boundaries.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scanner.models import Finding, CheckStatus, Severity, RiskLevel
from scanner.scoring import calculate_score


def test_perfect_score():
    findings = [
        Finding(
            check_type="https_availability",
            name="HTTPS Available",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="HTTPS Active",
            summary="HTTPS works",
            why_it_matters="Encrypts traffic",
            how_to_fix="Keep active",
            estimated_fix_minutes=0,
            documentation_url="https://owasp.org",
        ),
        Finding(
            check_type="hsts",
            name="HSTS Configured",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="HSTS Active",
            summary="HSTS present",
            why_it_matters="Prevents downgrade",
            how_to_fix="Keep active",
            estimated_fix_minutes=0,
            documentation_url="https://owasp.org",
        ),
    ]

    score, risk, breakdown, passed_count, total_count = calculate_score(findings)
    assert score == 100
    assert risk == RiskLevel.EXCELLENT
    assert passed_count == 2
    assert total_count == 2


def test_deductions_and_risk_tiers():
    findings = [
        Finding(
            check_type="hsts",
            name="Missing HSTS",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-8,
            title="Missing HSTS",
            summary="No HSTS header",
            why_it_matters="Vulnerable to downgrade",
            how_to_fix="Add header",
            estimated_fix_minutes=2,
            documentation_url="https://owasp.org",
        ),
        Finding(
            check_type="csp",
            name="Missing CSP",
            status=CheckStatus.WARNING,
            severity=Severity.MEDIUM,
            score_impact=-8,
            title="Missing CSP",
            summary="No CSP header",
            why_it_matters="Higher XSS risk",
            how_to_fix="Add header",
            estimated_fix_minutes=15,
            documentation_url="https://owasp.org",
        ),
    ]

    score, risk, breakdown, passed_count, total_count = calculate_score(findings)
    assert score == 84  # 100 - 16
    assert risk == RiskLevel.GOOD
    assert passed_count == 0
    assert total_count == 2


def test_score_clamping_to_zero():
    findings = [
        Finding(
            check_type="ssl_expiration",
            name="SSL Expired",
            status=CheckStatus.CRITICAL,
            severity=Severity.CRITICAL,
            score_impact=-150,  # Extreme negative deduction
            title="SSL Expired",
            summary="Expired",
            why_it_matters="Severe security warning",
            how_to_fix="Renew",
            estimated_fix_minutes=10,
            documentation_url="https://owasp.org",
        )
    ]

    score, risk, breakdown, passed_count, total_count = calculate_score(findings)
    assert score == 0
    assert risk == RiskLevel.CRITICAL
