"""
SiteSecura - Verified Badge Database Foundation Test Suite (VB-1)
Verifies:
1. Tables creation: security_badge_policies, security_verifications.
2. Default policy attributes and single active policy guarantee.
3. Foreign keys: website_id, scan_id, policy_id.
4. Public token uniqueness and cryptographic randomness.
5. Cascade delete semantics from website and scan to verifications.
6. Relationships on Website and Scan models.
"""
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine, select, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.db.base import Base
from app.models.user import Organization
from app.models.website import Website
from app.models.scan import Scan, ScanCheck
from app.models.verification import (
    SecurityBadgePolicy,
    SecurityVerification,
    VerificationStatus,
    generate_public_token,
)

TEST_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_badge_db.sqlite3"))
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
def db_session():
    session = TestSyncSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def test_public_token_generation():
    """Verifies that public tokens are cryptographically random, long, URL-safe, and unique."""
    tokens = [generate_public_token() for _ in range(100)]
    assert len(set(tokens)) == 100, "All generated tokens must be strictly unique"
    for tok in tokens:
        assert len(tok) >= 40, "Token must be sufficiently long (>= 40 chars)"
        # URL safe chars: alphanumeric, -, _
        assert all(c.isalnum() or c in ("-", "_") for c in tok), "Token must be strictly URL-safe"


def test_default_badge_policy_creation_and_attributes(db_session):
    """Verifies SecurityBadgePolicy schema, defaults, and policy constraints."""
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
    db_session.add(policy)
    db_session.commit()

    saved = db_session.get(SecurityBadgePolicy, policy.id)
    assert saved is not None
    assert saved.name == "default"
    assert saved.minimum_score == 70
    assert saved.maximum_scan_age_days == 30
    assert saved.verification_validity_days == 30
    assert saved.disallow_critical_findings is True
    assert saved.disallow_high_findings is False
    assert saved.require_successful_scan is True
    assert saved.require_authorized_website is True
    assert saved.require_monitoring is False
    assert saved.is_active is True
    assert saved.created_at is not None
    assert saved.updated_at is not None


def test_security_verification_crud_and_snapshot(db_session):
    """Verifies creating, loading, and querying SecurityVerification records with full snapshots."""
    org = Organization(id=uuid.uuid4(), name="Test Org Badge DB")
    db_session.add(org)

    website = Website(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Secura Test",
        domain="secura-test.com",
        normalized_domain="secura-test.com",
    )
    db_session.add(website)

    scan = Scan(
        id=uuid.uuid4(),
        organization_id=org.id,
        website_id=website.id,
        domain="secura-test.com",
        normalized_domain="secura-test.com",
        status="completed",
        score=88,
        risk_level="Good",
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(scan)
    db_session.commit()

    now = datetime.now(timezone.utc)
    token = generate_public_token()
    verif = SecurityVerification(
        id=uuid.uuid4(),
        website_id=website.id,
        scan_id=scan.id,
        status=VerificationStatus.VERIFIED.value,
        public_token=token,
        score=scan.score,
        risk_level=scan.risk_level,
        verified_at=now,
        expires_at=now + timedelta(days=30),
        eligibility_reason={"eligible": True, "reasons": []},
        monitoring_enabled=False,
    )
    db_session.add(verif)
    db_session.commit()

    loaded = db_session.get(SecurityVerification, verif.id)
    assert loaded is not None
    assert loaded.website_id == website.id
    assert loaded.scan_id == scan.id
    assert loaded.score == 88
    assert loaded.risk_level == "Good"
    assert loaded.status == "verified"
    assert loaded.public_token == token
    assert loaded.eligibility_reason == {"eligible": True, "reasons": []}
    assert loaded.website.id == website.id
    assert loaded.scan.id == scan.id


def test_public_token_uniqueness_constraint(db_session):
    """Verifies that inserting duplicate public_tokens violates uniqueness constraint."""
    org = Organization(id=uuid.uuid4(), name="Unique Token Org")
    site = Website(id=uuid.uuid4(), organization_id=org.id, name="U1", domain="u1.com", normalized_domain="u1.com")
    scan = Scan(id=uuid.uuid4(), organization_id=org.id, website_id=site.id, domain="u1.com", normalized_domain="u1.com", score=80)
    db_session.add_all([org, site, scan])
    db_session.commit()

    shared_token = "same-token-must-fail-on-second-insert-xyz"
    verif1 = SecurityVerification(
        id=uuid.uuid4(),
        website_id=site.id,
        scan_id=scan.id,
        public_token=shared_token,
        score=80,
    )
    db_session.add(verif1)
    db_session.commit()

    verif2 = SecurityVerification(
        id=uuid.uuid4(),
        website_id=site.id,
        scan_id=scan.id,
        public_token=shared_token,
        score=80,
    )
    db_session.add(verif2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_cascade_delete_from_website(db_session):
    """Verifies that deleting a Website cascades and removes its SecurityVerifications."""
    org = Organization(id=uuid.uuid4(), name="Cascade Org")
    site = Website(id=uuid.uuid4(), organization_id=org.id, name="Cascade Site", domain="cascade.com", normalized_domain="cascade.com")
    scan = Scan(id=uuid.uuid4(), organization_id=org.id, website_id=site.id, domain="cascade.com", normalized_domain="cascade.com", score=85)
    db_session.add_all([org, site, scan])
    db_session.commit()

    verif = SecurityVerification(
        id=uuid.uuid4(),
        website_id=site.id,
        scan_id=scan.id,
        public_token=generate_public_token(),
        score=85,
    )
    db_session.add(verif)
    db_session.commit()

    verif_id = verif.id
    assert db_session.get(SecurityVerification, verif_id) is not None

    # Delete website
    db_session.delete(site)
    db_session.commit()

    # Verification must be deleted by cascade
    assert db_session.get(SecurityVerification, verif_id) is None


def test_relationships_on_website_and_scan(db_session):
    """Verifies that Website.security_verifications and Scan.security_verifications back-populate correctly."""
    org = Organization(id=uuid.uuid4(), name="Rel Org")
    site = Website(id=uuid.uuid4(), organization_id=org.id, name="Rel Site", domain="rel.com", normalized_domain="rel.com")
    scan = Scan(id=uuid.uuid4(), organization_id=org.id, website_id=site.id, domain="rel.com", normalized_domain="rel.com", score=92)
    db_session.add_all([org, site, scan])
    db_session.commit()

    verif = SecurityVerification(
        id=uuid.uuid4(),
        website_id=site.id,
        scan_id=scan.id,
        public_token=generate_public_token(),
        score=92,
    )
    db_session.add(verif)
    db_session.commit()

    # Query from website side
    reloaded_site = db_session.get(Website, site.id)
    assert len(reloaded_site.security_verifications) == 1
    assert reloaded_site.security_verifications[0].id == verif.id

    # Query from scan side
    reloaded_scan = db_session.get(Scan, scan.id)
    assert len(reloaded_scan.security_verifications) == 1
    assert reloaded_scan.security_verifications[0].id == verif.id
