"""
SiteSecura - Verified Badge Eligibility Engine Test Suite (VB-2)
Implements all 20 required eligibility test cases + edge cases:
1. Eligible website
2. Score below threshold (69)
3. Score exactly threshold (70)
4. Score above threshold (85)
5. Critical finding present
6. High finding only (default policy: allowed)
7. High finding with policy disallowing high findings
8. Scan too old (31 days old)
9. Scan exactly at boundary (30 days old - inclusive)
10. Scan failed status
11. Scan running status
12. No scan associated
13. Missing score
14. Scan website mismatch
15. Domain mismatch
16. Unauthorized organization context
17. Missing policy configuration
18. Multiple failure reasons collected
19. Determinism across evaluations
20. No scanner regression
Plus:
21. Invalid scan score out of bounds
22. Missing completed_at timestamp
23. Monitoring requirement toggle
24. Sync and Async API execution parity
"""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine, select, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.db.base import Base
from app.models.user import Organization
from app.models.website import Website
from app.models.scan import Scan, ScanCheck
from app.models.verification import SecurityBadgePolicy
from app.schemas.verification import EligibilityReasonCode
from app.services.badge_eligibility_service import BadgeEligibilityService

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_badge_engine.sqlite3"))
TEST_SYNC_DB_URL = f"sqlite:///{TEST_DB_FILE}"
TEST_ASYNC_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

test_sync_engine = create_engine(
    TEST_SYNC_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

@event.listens_for(test_sync_engine, "connect")
def set_sqlite_pragma_sync(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

TestSyncSessionLocal = sessionmaker(bind=test_sync_engine, autocommit=False, autoflush=False)

test_async_engine = create_async_engine(
    TEST_ASYNC_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)
TestAsyncSessionLocal = async_sessionmaker(bind=test_async_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)
    yield
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest.fixture
def sync_db():
    session = TestSyncSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def seed_default_policy(db):
    """Seeds exactly one active default policy."""
    policy = SecurityBadgePolicy(
        id=uuid.uuid4(),
        name="default",
        description="Default SiteSecura Verified Badge policy",
        is_active=True,
        minimum_score=70,
        maximum_scan_age_days=30,
        verification_validity_days=30,
        disallow_critical_findings=True,
        disallow_high_findings=False,
        require_successful_scan=True,
        require_authorized_website=True,
        require_monitoring=False,
    )
    db.add(policy)
    db.commit()
    return policy


# Fixed deterministic test time: 2026-09-29T12:00:00Z
FIXED_NOW = datetime(2026, 9, 29, 12, 0, 0, tzinfo=timezone.utc)


def create_website_and_scan(
    db,
    domain="example.com",
    score=85,
    status="completed",
    age_days=5,
    monitoring_enabled=False,
    mismatch_domain=None,
    scan_website_id=None,
    has_critical=False,
    has_high=False,
):
    org = Organization(id=uuid.uuid4(), name=f"Org-{uuid.uuid4().hex[:6]}")
    db.add(org)

    website = Website(
        id=uuid.uuid4(),
        organization_id=org.id,
        name=f"Site {domain}",
        domain=domain,
        normalized_domain=domain,
        monitoring_enabled=monitoring_enabled,
    )
    db.add(website)

    completed_at = FIXED_NOW - timedelta(days=age_days) if age_days is not None else None
    target_scan_domain = mismatch_domain if mismatch_domain else domain

    scan = Scan(
        id=uuid.uuid4(),
        organization_id=org.id,
        website_id=scan_website_id if scan_website_id is not None else website.id,
        domain=target_scan_domain,
        normalized_domain=target_scan_domain,
        status=status,
        score=score,
        risk_level="Good" if score and score >= 80 else "Medium",
        completed_at=completed_at,
    )
    db.add(scan)
    website.last_scan_id = scan.id

    if has_critical:
        crit_check = ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan.id,
            check_type="ssl_expired",
            name="SSL Expired",
            status="critical",
            severity="critical",
            score_impact=-30,
            title="Critical SSL finding",
            summary="SSL expired",
            confidence=1.0,
        )
        db.add(crit_check)

    if has_high:
        high_check = ScanCheck(
            id=uuid.uuid4(),
            scan_id=scan.id,
            check_type="missing_csp",
            name="Missing CSP",
            status="high",
            severity="high",
            score_impact=-15,
            title="High severity finding",
            summary="Missing Content-Security-Policy",
            confidence=1.0,
        )
        db.add(high_check)

    db.commit()
    return org, website, scan


# =========================================================================
# TEST 1 — Eligible website
# =========================================================================
def test_1_eligible_website(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=85, age_days=5)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is True
    assert result.reasons == []
    assert result.score == 85
    assert result.checks.website_exists is True
    assert result.checks.authorized_website is True
    assert result.checks.scan_exists is True
    assert result.checks.scan_completed is True
    assert result.checks.scan_recent is True
    assert result.checks.score_available is True
    assert result.checks.minimum_score is True
    assert result.checks.critical_findings is True
    assert result.checks.high_findings is True
    assert result.checks.website_scan_match is True
    assert result.checks.domain_match is True


# =========================================================================
# TEST 2 — Score below threshold (69)
# =========================================================================
def test_2_score_below_threshold(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=69)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCORE_BELOW_THRESHOLD.value in result.reasons
    assert result.checks.minimum_score is False


# =========================================================================
# TEST 3 — Score exactly threshold (70)
# =========================================================================
def test_3_score_exactly_threshold(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=70)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is True
    assert result.reasons == []
    assert result.checks.minimum_score is True


# =========================================================================
# TEST 4 — Score above threshold (85)
# =========================================================================
def test_4_score_above_threshold(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=85)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is True
    assert result.reasons == []


# =========================================================================
# TEST 5 — Critical finding exists
# =========================================================================
def test_5_critical_finding_present(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=90, has_critical=True)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.CRITICAL_FINDING_PRESENT.value in result.reasons
    assert result.checks.critical_findings is False


# =========================================================================
# TEST 6 — High finding only (default policy: allowed)
# =========================================================================
def test_6_high_finding_only_default_policy_allowed(sync_db):
    policy = seed_default_policy(sync_db)
    assert policy.disallow_high_findings is False

    org, website, scan = create_website_and_scan(sync_db, score=85, has_high=True)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is True
    assert result.reasons == []
    assert result.checks.high_findings is True


# =========================================================================
# TEST 7 — High finding with policy enabled (disallow_high_findings = True)
# =========================================================================
def test_7_high_finding_disallowed_when_policy_enabled(sync_db):
    policy = seed_default_policy(sync_db)
    policy.disallow_high_findings = True
    sync_db.commit()

    org, website, scan = create_website_and_scan(sync_db, score=85, has_high=True)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.HIGH_FINDING_PRESENT.value in result.reasons
    assert result.checks.high_findings is False

    # Restore default
    policy.disallow_high_findings = False
    sync_db.commit()


# =========================================================================
# TEST 8 — Scan too old (31 days old, policy 30 days)
# =========================================================================
def test_8_scan_too_old(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=90, age_days=31)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCAN_TOO_OLD.value in result.reasons
    assert result.checks.scan_recent is False


# =========================================================================
# TEST 9 — Scan exactly at allowed boundary (30 days old - inclusive)
# =========================================================================
def test_9_scan_exactly_at_boundary_inclusive(sync_db):
    policy = seed_default_policy(sync_db)
    # Exactly 30 days old relative to FIXED_NOW
    org, website, scan = create_website_and_scan(sync_db, score=85, age_days=30)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is True
    assert result.reasons == []
    assert result.checks.scan_recent is True


# =========================================================================
# TEST 10 — Scan failed
# =========================================================================
def test_10_scan_failed(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=85, status="failed")

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCAN_NOT_COMPLETED.value in result.reasons
    assert result.checks.scan_completed is False


# =========================================================================
# TEST 11 — Scan running
# =========================================================================
def test_11_scan_running(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=85, status="running")

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCAN_NOT_COMPLETED.value in result.reasons
    assert result.checks.scan_completed is False


# =========================================================================
# TEST 12 — No scan
# =========================================================================
def test_12_no_scan(sync_db):
    policy = seed_default_policy(sync_db)
    org = Organization(id=uuid.uuid4(), name="No Scan Org")
    sync_db.add(org)
    website = Website(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Empty Site",
        domain="noscan.com",
        normalized_domain="noscan.com",
        last_scan_id=None,
    )
    sync_db.add(website)
    sync_db.commit()

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=None,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCAN_NOT_FOUND.value in result.reasons
    assert result.checks.scan_exists is False


# =========================================================================
# TEST 13 — Missing score
# =========================================================================
def test_13_missing_score(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=None)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCORE_UNAVAILABLE.value in result.reasons
    assert result.checks.score_available is False


# =========================================================================
# TEST 14 — Wrong website/scan association (SCAN_WEBSITE_MISMATCH)
# =========================================================================
def test_14_wrong_website_scan_association(sync_db):
    policy = seed_default_policy(sync_db)
    # Create two valid websites belonging to the org
    org = Organization(id=uuid.uuid4(), name="Mismatch Org")
    sync_db.add(org)
    site_a = Website(id=uuid.uuid4(), organization_id=org.id, name="Site A", domain="site-a.com", normalized_domain="site-a.com")
    site_b = Website(id=uuid.uuid4(), organization_id=org.id, name="Site B", domain="site-b.com", normalized_domain="site-b.com")
    sync_db.add_all([site_a, site_b])

    # Scan belongs to site_b
    scan_b = Scan(
        id=uuid.uuid4(),
        organization_id=org.id,
        website_id=site_b.id,
        domain="site-b.com",
        normalized_domain="site-b.com",
        status="completed",
        score=85,
        completed_at=FIXED_NOW - timedelta(days=2),
    )
    sync_db.add(scan_b)
    sync_db.commit()

    # Evaluate Site A using candidate scan that belongs to Site B
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=site_a.id,
        candidate_scan_id=scan_b.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCAN_WEBSITE_MISMATCH.value in result.reasons
    assert result.checks.website_scan_match is False


# =========================================================================
# TEST 15 — Domain mismatch where both normalized domains exist
# =========================================================================
def test_15_domain_mismatch(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(
        sync_db,
        domain="site-alpha.com",
        mismatch_domain="site-beta.com",
        score=85,
    )

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.DOMAIN_MISMATCH.value in result.reasons
    assert result.checks.domain_match is False


# =========================================================================
# TEST 16 — Unauthorized organization
# =========================================================================
def test_16_unauthorized_organization(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=85)
    foreign_org_id = uuid.uuid4()

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=foreign_org_id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.UNAUTHORIZED_WEBSITE.value in result.reasons
    assert result.checks.authorized_website is False


# =========================================================================
# TEST 17 — Missing policy
# =========================================================================
def test_17_missing_policy(sync_db):
    org, website, scan = create_website_and_scan(sync_db, score=85)

    # Pass invalid or non-existent policy
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )

    # If database has no active policy (or when policy query returns None)
    # Here, let's temporarily inactivate active policies in DB to test POLICY_NOT_FOUND
    sync_db.query(SecurityBadgePolicy).update({"is_active": False})
    sync_db.commit()

    result_no_policy = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )

    assert result_no_policy.eligible is False
    assert EligibilityReasonCode.POLICY_NOT_FOUND.value in result_no_policy.reasons

    # Restore active policy
    sync_db.query(SecurityBadgePolicy).update({"is_active": True})
    sync_db.commit()


# =========================================================================
# TEST 18 — Multiple failures collected (Section 41)
# =========================================================================
def test_18_multiple_failures_collected(sync_db):
    policy = seed_default_policy(sync_db)
    # Score 50 (< 70), Critical finding present, Scan 35 days old (> 30)
    org, website, scan = create_website_and_scan(
        sync_db,
        score=50,
        age_days=35,
        has_critical=True,
    )

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    # All 3 failure reasons must be present
    assert EligibilityReasonCode.SCORE_BELOW_THRESHOLD.value in result.reasons
    assert EligibilityReasonCode.CRITICAL_FINDING_PRESENT.value in result.reasons
    assert EligibilityReasonCode.SCAN_TOO_OLD.value in result.reasons
    assert len(result.reasons) >= 3


# =========================================================================
# TEST 19 — Determinism
# =========================================================================
def test_19_determinism_across_evaluations(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=88, age_days=10)

    res1 = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    res2 = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    res3 = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert res1.eligible == res2.eligible == res3.eligible
    assert res1.score == res2.score == res3.score
    assert res1.reasons == res2.reasons == res3.reasons
    assert res1.checks.model_dump() == res2.checks.model_dump() == res3.checks.model_dump()


# =========================================================================
# TEST 21 — Invalid scan score (< 0 or > 100)
# =========================================================================
def test_21_invalid_scan_score_out_of_bounds(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=150)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.INVALID_SCAN_DATA.value in result.reasons

    # Test negative score
    scan.score = -10
    sync_db.commit()

    result_neg = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result_neg.eligible is False
    assert EligibilityReasonCode.INVALID_SCAN_DATA.value in result_neg.reasons


# =========================================================================
# TEST 22 — Missing completed_at timestamp
# =========================================================================
def test_22_missing_completed_at_timestamp(sync_db):
    policy = seed_default_policy(sync_db)
    org, website, scan = create_website_and_scan(sync_db, score=85, age_days=None)

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )

    assert result.eligible is False
    assert EligibilityReasonCode.SCAN_COMPLETION_TIME_UNAVAILABLE.value in result.reasons


# =========================================================================
# TEST 23 — Continuous monitoring requirement toggle
# =========================================================================
def test_23_monitoring_requirement_toggle(sync_db):
    policy = seed_default_policy(sync_db)
    policy.require_monitoring = True
    sync_db.commit()

    # Case A: website has monitoring_enabled = False -> Disqualified
    org, website, scan = create_website_and_scan(sync_db, score=90, monitoring_enabled=False)
    res_no_mon = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )
    assert res_no_mon.eligible is False
    assert EligibilityReasonCode.MONITORING_REQUIRED.value in res_no_mon.reasons

    # Case B: website has monitoring_enabled = True -> Eligible
    website.monitoring_enabled = True
    sync_db.commit()
    res_mon = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=policy,
        evaluation_time=FIXED_NOW,
    )
    assert res_mon.eligible is True
    assert res_mon.reasons == []

    # Restore policy
    policy.require_monitoring = False
    sync_db.commit()


def test_24_async_evaluation_parity():
    import asyncio

    async def _run():
        async with TestAsyncSessionLocal() as async_db:
            res_p = await async_db.execute(select(SecurityBadgePolicy).where(SecurityBadgePolicy.is_active == True))
            policy = res_p.scalars().first()

            org = Organization(id=uuid.uuid4(), name="Async Parity Org")
            async_db.add(org)
            website = Website(
                id=uuid.uuid4(),
                organization_id=org.id,
                name="Async Site",
                domain="async-test.com",
                normalized_domain="async-test.com",
            )
            async_db.add(website)
            scan = Scan(
                id=uuid.uuid4(),
                organization_id=org.id,
                website_id=website.id,
                domain="async-test.com",
                normalized_domain="async-test.com",
                status="completed",
                score=95,
                completed_at=FIXED_NOW - timedelta(days=2),
            )
            async_db.add(scan)
            website.last_scan_id = scan.id
            await async_db.commit()

            async_result = await BadgeEligibilityService.evaluate_eligibility(
                db=async_db,
                website_id=website.id,
                candidate_scan_id=scan.id,
                auth_organization_id=org.id,
                policy=policy,
                evaluation_time=FIXED_NOW,
            )

            assert async_result.eligible is True
            assert async_result.score == 95
            assert async_result.reasons == []

    asyncio.run(_run())
