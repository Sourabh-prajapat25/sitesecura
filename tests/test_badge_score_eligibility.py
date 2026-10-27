"""
SiteSecura - Verified Badge Score Eligibility & Policy Fallback Test Suite
Explicitly validates all 11 required eligibility conditions:
1. Completed scan with score = 70 (inclusive boundary) -> eligible
2. Completed scan with score = 71 -> eligible
3. Completed scan with score = 77 (sitesecura.com scenario) -> eligible
4. Completed scan with score = 100 -> eligible
5. Completed scan with score = 69 -> ineligible (SCORE_BELOW_THRESHOLD)
6. Completed scan with score = 0 -> ineligible (SCORE_BELOW_THRESHOLD)
7. Missing assessment (no scan) -> ineligible (SCAN_NOT_FOUND)
8. Running assessment (in_progress / running) -> ineligible (SCAN_NOT_COMPLETED)
9. Failed assessment -> ineligible (SCAN_NOT_COMPLETED)
10. Completed assessment with null/missing score -> ineligible (SCORE_UNAVAILABLE)
11. Invalid scores:
    - Negative score (-5) -> ineligible (INVALID_SCAN_DATA)
    - Above 100 (105) -> ineligible (INVALID_SCAN_DATA)
12. Unavailable / unseeded policy configuration safely falls back without blocking qualifying scores
13. Website ownership / tenant boundary enforcement remains strictly intact
"""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine, select, event
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.db.base import Base
from app.models.user import Organization
from app.models.website import Website
from app.models.scan import Scan
from app.models.verification import SecurityBadgePolicy
from app.schemas.verification import EligibilityReasonCode
from app.services.badge_eligibility_service import BadgeEligibilityService
from app.core.config import settings

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_badge_score.sqlite3"))
TEST_SYNC_DB_URL = f"sqlite:///{TEST_DB_FILE}"

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
FIXED_NOW = datetime(2026, 10, 27, 12, 0, 0, tzinfo=timezone.utc)


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


def create_site_and_scan(
    db,
    domain: str = "example.com",
    score: int = 80,
    status: str = "completed",
    age_days: int = 1,
):
    org = Organization(id=uuid.uuid4(), name=f"Org-{domain}")
    db.add(org)
    db.flush()

    website = Website(
        id=uuid.uuid4(),
        organization_id=org.id,
        name=f"Site {domain}",
        domain=domain,
        normalized_domain=domain.lower().strip(),
    )
    db.add(website)
    db.flush()

    completed_at = FIXED_NOW - timedelta(days=age_days) if status == "completed" else None
    scan = Scan(
        id=uuid.uuid4(),
        website_id=website.id,
        organization_id=org.id,
        domain=domain,
        normalized_domain=domain.lower().strip(),
        status=status,
        score=score,
        risk_level="Good" if score and score >= 80 else "Medium",
        completed_at=completed_at,
    )
    db.add(scan)
    website.last_scan_id = scan.id
    db.commit()
    return org, website, scan


# =========================================================================
# 1. Score = 70 (Inclusive Boundary) -> ELIGIBLE
# =========================================================================
def test_score_exactly_70_qualifies(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=70)
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is True
    assert result.score == 70
    assert result.checks.minimum_score is True
    assert result.checks.score_available is True
    assert result.reasons == []


# =========================================================================
# 2. Score = 71 -> ELIGIBLE
# =========================================================================
def test_score_71_qualifies(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=71)
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is True
    assert result.score == 71
    assert result.checks.minimum_score is True
    assert result.reasons == []


# =========================================================================
# 3. Score = 77 (SiteSecura scenario) -> ELIGIBLE
# =========================================================================
def test_score_77_sitesecura_scenario(sync_db):
    org, website, scan = create_site_and_scan(sync_db, domain="sitesecura.com", score=77)
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is True
    assert result.score == 77
    assert result.checks.minimum_score is True
    assert EligibilityReasonCode.POLICY_NOT_FOUND.value not in result.reasons


# =========================================================================
# 4. Score = 100 -> ELIGIBLE
# =========================================================================
def test_score_100_qualifies(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=100)
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is True
    assert result.score == 100
    assert result.checks.minimum_score is True
    assert result.reasons == []


# =========================================================================
# 5. Score = 69 (< 70) -> INELIGIBLE
# =========================================================================
def test_score_69_below_threshold(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=69)
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.minimum_score is False
    assert EligibilityReasonCode.SCORE_BELOW_THRESHOLD.value in result.reasons


# =========================================================================
# 6. Score = 0 -> INELIGIBLE
# =========================================================================
def test_score_zero_below_threshold(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=0)
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.minimum_score is False
    assert EligibilityReasonCode.SCORE_BELOW_THRESHOLD.value in result.reasons


# =========================================================================
# 7. Missing assessment (No scan associated) -> INELIGIBLE
# =========================================================================
def test_missing_scan_ineligible(sync_db):
    org = Organization(id=uuid.uuid4(), name="No Scan Org")
    sync_db.add(org)
    website = Website(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Empty Site",
        domain="unscanned.com",
        normalized_domain="unscanned.com",
        last_scan_id=None,
    )
    sync_db.add(website)
    sync_db.commit()

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=None,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.scan_exists is False
    assert EligibilityReasonCode.SCAN_NOT_FOUND.value in result.reasons


# =========================================================================
# 8. Running assessment -> INELIGIBLE
# =========================================================================
def test_running_scan_ineligible(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=85, status="running")
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.scan_completed is False
    assert EligibilityReasonCode.SCAN_NOT_COMPLETED.value in result.reasons


# =========================================================================
# 9. Failed assessment -> INELIGIBLE
# =========================================================================
def test_failed_scan_ineligible(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=85, status="failed")
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.scan_completed is False
    assert EligibilityReasonCode.SCAN_NOT_COMPLETED.value in result.reasons


# =========================================================================
# 10. Completed scan with null/missing score -> INELIGIBLE
# =========================================================================
def test_null_score_ineligible(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=None, status="completed")
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.score_available is False
    assert EligibilityReasonCode.SCORE_UNAVAILABLE.value in result.reasons


# =========================================================================
# 11. Invalid scores: Out of range (< 0 or > 100) -> INELIGIBLE
# =========================================================================
def test_negative_score_rejected(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=-5, status="completed")
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.minimum_score is False
    assert EligibilityReasonCode.INVALID_SCAN_DATA.value in result.reasons


def test_score_greater_than_100_rejected(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=105, status="completed")
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.minimum_score is False
    assert EligibilityReasonCode.INVALID_SCAN_DATA.value in result.reasons


# =========================================================================
# 12. Policy unavailable in DB falls back safely without blocking
# =========================================================================
def test_unseeded_database_falls_back_cleanly(sync_db):
    # Ensure zero policies exist in DB
    sync_db.query(SecurityBadgePolicy).delete()
    sync_db.commit()

    org, website, scan = create_site_and_scan(sync_db, score=77)
    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=org.id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is True
    assert result.score == 77
    assert result.policy.minimum_score == settings.SECURITY_BADGE_MINIMUM_SCORE
    assert EligibilityReasonCode.POLICY_NOT_FOUND.value not in result.reasons


# =========================================================================
# 13. Tenant isolation / Website ownership enforcement
# =========================================================================
def test_unauthorized_organization_blocked(sync_db):
    org, website, scan = create_site_and_scan(sync_db, score=85)
    foreign_org_id = uuid.uuid4()

    result = BadgeEligibilityService.evaluate_eligibility_sync(
        db=sync_db,
        website_id=website.id,
        candidate_scan_id=scan.id,
        auth_organization_id=foreign_org_id,
        policy=None,
        evaluation_time=FIXED_NOW,
    )
    assert result.eligible is False
    assert result.checks.authorized_website is False
    assert EligibilityReasonCode.UNAUTHORIZED_WEBSITE.value in result.reasons
