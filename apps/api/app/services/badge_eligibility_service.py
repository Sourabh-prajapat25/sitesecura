"""
Scanly API - Verified Badge Eligibility Engine (VB-2)
Deterministically evaluates whether a website satisfies the active Verified Badge policy.
Pure evaluation service: does NOT modify scanner scores, does NOT alter scans,
does NOT make external calls, and does NOT auto-create verifications.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.website import Website
from app.models.scan import Scan, ScanCheck
from app.models.verification import SecurityBadgePolicy
from app.core.config import settings
from app.schemas.verification import (
    EligibilityReasonCode,
    EligibilityChecks,
    PolicySummary,
    BadgeEligibilityResult,
)
try:
    from scanner.domain import normalize_domain, SSRFValidationError
except ImportError:
    import sys
    import os
    _current_dir = os.path.dirname(os.path.abspath(__file__))
    _root = os.path.abspath(os.path.join(_current_dir, "..", "..", "..", ".."))
    if _root not in sys.path:
        sys.path.insert(0, _root)
    from scanner.domain import normalize_domain, SSRFValidationError

logger = logging.getLogger(__name__)


class BadgeEligibilityService:
    """
    Deterministic Badge Eligibility Engine.
    Answers: 'Does this SiteSecura-managed website currently satisfy the configured
    Verified Badge policy based on a real completed scan?'
    """

    @staticmethod
    def validate_policy(policy: Optional[SecurityBadgePolicy]) -> bool:
        """
        Validates badge policy values to guarantee safety and integrity.
        - minimum_score in [0, 100]
        - maximum_scan_age_days > 0
        - verification_validity_days > 0
        """
        if not policy:
            return False
        if not (0 <= policy.minimum_score <= 100):
            logger.warning(f"Invalid policy minimum_score: {policy.minimum_score}")
            return False
        if policy.maximum_scan_age_days <= 0:
            logger.warning(f"Invalid policy maximum_scan_age_days: {policy.maximum_scan_age_days}")
            return False
        if policy.verification_validity_days <= 0:
            logger.warning(f"Invalid policy verification_validity_days: {policy.verification_validity_days}")
            return False
        return True

    @classmethod
    def get_fallback_policy(cls) -> SecurityBadgePolicy:
        """
        Safe fallback default policy derived from configuration constants
        when no active database policy is found or configured.
        """
        min_score = getattr(settings, "SECURITY_BADGE_MINIMUM_SCORE", 70)
        return SecurityBadgePolicy(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            name="default_fallback",
            description="Default platform-wide fallback Verified Badge eligibility policy.",
            is_active=True,
            minimum_score=min_score,
            maximum_scan_age_days=30,
            verification_validity_days=30,
            disallow_critical_findings=False,
            disallow_high_findings=False,
            require_successful_scan=True,
            require_authorized_website=True,
            require_monitoring=False,
        )

    @classmethod
    async def get_active_badge_policy(cls, db: AsyncSession) -> Optional[SecurityBadgePolicy]:
        """
        Retrieves the single active SecurityBadgePolicy (async).
        Returns the primary active policy, or None if none exists.
        """
        stmt = select(SecurityBadgePolicy).where(SecurityBadgePolicy.is_active == True)
        res = await db.execute(stmt)
        policies = res.scalars().all()

        if len(policies) == 0:
            logger.warning("No active SecurityBadgePolicy found in database.")
            return None
        if len(policies) > 1:
            logger.warning(
                f"Multiple active SecurityBadgePolicy records found ({len(policies)}). "
                "Using primary policy."
            )

        policy = policies[0]
        if not cls.validate_policy(policy):
            return None
        return policy

    @classmethod
    def get_active_badge_policy_sync(cls, db: Session) -> Optional[SecurityBadgePolicy]:
        """
        Retrieves the single active SecurityBadgePolicy (sync).
        Returns the primary active policy, or None if none exists.
        """
        stmt = select(SecurityBadgePolicy).where(SecurityBadgePolicy.is_active == True)
        policies = db.execute(stmt).scalars().all()

        if len(policies) == 0:
            logger.warning("No active SecurityBadgePolicy found in database.")
            return None
        if len(policies) > 1:
            logger.warning(
                f"Multiple active SecurityBadgePolicy records found ({len(policies)}). "
                "Using primary policy."
            )

        policy = policies[0]
        if not cls.validate_policy(policy):
            return None
        return policy

    @classmethod
    async def evaluate_eligibility(
        cls,
        db: AsyncSession,
        website_id: uuid.UUID,
        candidate_scan_id: Optional[uuid.UUID] = None,
        auth_organization_id: Optional[uuid.UUID] = None,
        policy: Optional[SecurityBadgePolicy] = None,
        evaluation_time: Optional[datetime] = None,
    ) -> BadgeEligibilityResult:
        """
        Asynchronously evaluates badge eligibility for a website.
        """
        now = evaluation_time or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        # 1. Resolve active badge policy or fall back to safe configuration defaults
        active_policy = policy
        if active_policy is None:
            try:
                active_policy = await cls.get_active_badge_policy(db)
            except Exception as exc:
                logger.warning(f"Failed to query active badge policy: {exc}")
                active_policy = None

        if not active_policy or not cls.validate_policy(active_policy):
            active_policy = cls.get_fallback_policy()

        policy_summary = cls._build_policy_summary(active_policy)
        checks = EligibilityChecks()
        reasons: List[str] = []

        # 2. Rule 1: Website exists
        w_stmt = select(Website).where(Website.id == website_id)
        w_res = await db.execute(w_stmt)
        website = w_res.scalar_one_or_none()

        if not website:
            checks.website_exists = False
            reasons.append(EligibilityReasonCode.WEBSITE_NOT_FOUND.value)
            return BadgeEligibilityResult(
                eligible=False,
                website_id=website_id,
                scan_id=candidate_scan_id,
                score=None,
                risk_level=None,
                reasons=reasons,
                checks=checks,
                policy=policy_summary,
                evaluated_at=now,
            )
        checks.website_exists = True

        # 3. Rule 2: Organization authorization
        if auth_organization_id is not None:
            if website.organization_id != auth_organization_id:
                checks.authorized_website = False
                reasons.append(EligibilityReasonCode.UNAUTHORIZED_WEBSITE.value)
                return BadgeEligibilityResult(
                    eligible=False,
                    website_id=website_id,
                    scan_id=candidate_scan_id,
                    score=None,
                    risk_level=None,
                    reasons=reasons,
                    checks=checks,
                    policy=policy_summary,
                    evaluated_at=now,
                )
            checks.authorized_website = True
        else:
            # When no auth_organization_id is explicitly supplied, assume caller
            # has verified context or website is internal
            checks.authorized_website = True

        # 4. Rule 3: Candidate scan exists
        candidate_scan = None
        if candidate_scan_id:
            s_stmt = select(Scan).where(Scan.id == candidate_scan_id)
            s_res = await db.execute(s_stmt)
            candidate_scan = s_res.scalar_one_or_none()
        elif website.last_scan_id:
            s_stmt = select(Scan).where(Scan.id == website.last_scan_id)
            s_res = await db.execute(s_stmt)
            candidate_scan = s_res.scalar_one_or_none()
        else:
            # Query latest scan for this website
            s_stmt = select(Scan).where(Scan.website_id == website.id).order_by(Scan.created_at.desc()).limit(1)
            s_res = await db.execute(s_stmt)
            candidate_scan = s_res.scalar_one_or_none()

        if not candidate_scan:
            checks.scan_exists = False
            reasons.append(EligibilityReasonCode.SCAN_NOT_FOUND.value)
            return BadgeEligibilityResult(
                eligible=False,
                website_id=website.id,
                scan_id=None,
                score=None,
                risk_level=None,
                reasons=reasons,
                checks=checks,
                policy=policy_summary,
                evaluated_at=now,
            )
        checks.scan_exists = True

        # 5. Evaluate scan rules and collect all relevant failure reasons
        has_critical = False
        has_high = False

        if active_policy.disallow_critical_findings:
            crit_stmt = select(ScanCheck.id).where(
                ScanCheck.scan_id == candidate_scan.id,
                or_(
                    func.lower(ScanCheck.severity) == "critical",
                    func.lower(ScanCheck.status) == "critical",
                ),
            ).limit(1)
            crit_res = await db.execute(crit_stmt)
            has_critical = crit_res.scalar_one_or_none() is not None

        if active_policy.disallow_high_findings:
            high_stmt = select(ScanCheck.id).where(
                ScanCheck.scan_id == candidate_scan.id,
                or_(
                    func.lower(ScanCheck.severity) == "high",
                    func.lower(ScanCheck.status) == "high",
                ),
            ).limit(1)
            high_res = await db.execute(high_stmt)
            has_high = high_res.scalar_one_or_none() is not None

        return cls._evaluate_scan_rules(
            website=website,
            scan=candidate_scan,
            policy=active_policy,
            policy_summary=policy_summary,
            checks=checks,
            reasons=reasons,
            has_critical=has_critical,
            has_high=has_high,
            now=now,
        )

    @classmethod
    def evaluate_eligibility_sync(
        cls,
        db: Session,
        website_id: uuid.UUID,
        candidate_scan_id: Optional[uuid.UUID] = None,
        auth_organization_id: Optional[uuid.UUID] = None,
        policy: Optional[SecurityBadgePolicy] = None,
        evaluation_time: Optional[datetime] = None,
    ) -> BadgeEligibilityResult:
        """
        Synchronously evaluates badge eligibility for a website.
        """
        now = evaluation_time or datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        # 1. Resolve active badge policy or fall back to safe configuration defaults
        active_policy = policy
        if active_policy is None:
            try:
                active_policy = cls.get_active_badge_policy_sync(db)
            except Exception as exc:
                logger.warning(f"Failed to query active badge policy sync: {exc}")
                active_policy = None

        if not active_policy or not cls.validate_policy(active_policy):
            active_policy = cls.get_fallback_policy()

        policy_summary = cls._build_policy_summary(active_policy)
        checks = EligibilityChecks()
        reasons: List[str] = []

        # 2. Rule 1: Website exists
        w_stmt = select(Website).where(Website.id == website_id)
        website = db.execute(w_stmt).scalar_one_or_none()

        if not website:
            checks.website_exists = False
            reasons.append(EligibilityReasonCode.WEBSITE_NOT_FOUND.value)
            return BadgeEligibilityResult(
                eligible=False,
                website_id=website_id,
                scan_id=candidate_scan_id,
                score=None,
                risk_level=None,
                reasons=reasons,
                checks=checks,
                policy=policy_summary,
                evaluated_at=now,
            )
        checks.website_exists = True

        # 3. Rule 2: Organization authorization
        if auth_organization_id is not None:
            if website.organization_id != auth_organization_id:
                checks.authorized_website = False
                reasons.append(EligibilityReasonCode.UNAUTHORIZED_WEBSITE.value)
                return BadgeEligibilityResult(
                    eligible=False,
                    website_id=website_id,
                    scan_id=candidate_scan_id,
                    score=None,
                    risk_level=None,
                    reasons=reasons,
                    checks=checks,
                    policy=policy_summary,
                    evaluated_at=now,
                )
            checks.authorized_website = True
        else:
            checks.authorized_website = True

        # 4. Rule 3: Candidate scan exists
        candidate_scan = None
        if candidate_scan_id:
            s_stmt = select(Scan).where(Scan.id == candidate_scan_id)
            candidate_scan = db.execute(s_stmt).scalar_one_or_none()
        elif website.last_scan_id:
            s_stmt = select(Scan).where(Scan.id == website.last_scan_id)
            candidate_scan = db.execute(s_stmt).scalar_one_or_none()
        else:
            s_stmt = select(Scan).where(Scan.website_id == website.id).order_by(Scan.created_at.desc()).limit(1)
            candidate_scan = db.execute(s_stmt).scalar_one_or_none()

        if not candidate_scan:
            checks.scan_exists = False
            reasons.append(EligibilityReasonCode.SCAN_NOT_FOUND.value)
            return BadgeEligibilityResult(
                eligible=False,
                website_id=website.id,
                scan_id=None,
                score=None,
                risk_level=None,
                reasons=reasons,
                checks=checks,
                policy=policy_summary,
                evaluated_at=now,
            )
        checks.scan_exists = True

        # 5. Evaluate scan rules and collect all relevant failure reasons
        has_critical = False
        has_high = False

        if active_policy.disallow_critical_findings:
            crit_stmt = select(ScanCheck.id).where(
                ScanCheck.scan_id == candidate_scan.id,
                or_(
                    func.lower(ScanCheck.severity) == "critical",
                    func.lower(ScanCheck.status) == "critical",
                ),
            ).limit(1)
            has_critical = db.execute(crit_stmt).scalar_one_or_none() is not None

        if active_policy.disallow_high_findings:
            high_stmt = select(ScanCheck.id).where(
                ScanCheck.scan_id == candidate_scan.id,
                or_(
                    func.lower(ScanCheck.severity) == "high",
                    func.lower(ScanCheck.status) == "high",
                ),
            ).limit(1)
            has_high = db.execute(high_stmt).scalar_one_or_none() is not None

        return cls._evaluate_scan_rules(
            website=website,
            scan=candidate_scan,
            policy=active_policy,
            policy_summary=policy_summary,
            checks=checks,
            reasons=reasons,
            has_critical=has_critical,
            has_high=has_high,
            now=now,
        )

    @classmethod
    def _evaluate_scan_rules(
        cls,
        website: Website,
        scan: Scan,
        policy: SecurityBadgePolicy,
        policy_summary: PolicySummary,
        checks: EligibilityChecks,
        reasons: List[str],
        has_critical: bool,
        has_high: bool,
        now: datetime,
    ) -> BadgeEligibilityResult:
        """
        Deterministic, pure-evaluation helper across all scan-level criteria.
        Collects all failing checks instead of failing fast, enabling rich UX feedback.
        """
        # Rule 10: Scan Website Mismatch
        if scan.website_id != website.id:
            checks.website_scan_match = False
            reasons.append(EligibilityReasonCode.SCAN_WEBSITE_MISMATCH.value)
        else:
            checks.website_scan_match = True

        # Rule 11: Domain Consistency
        try:
            site_norm = website.normalized_domain or normalize_domain(website.domain)
        except SSRFValidationError:
            site_norm = website.domain.strip().lower()

        try:
            scan_norm = scan.normalized_domain or normalize_domain(scan.domain)
        except SSRFValidationError:
            scan_norm = scan.domain.strip().lower()

        if site_norm != scan_norm:
            checks.domain_match = False
            reasons.append(EligibilityReasonCode.DOMAIN_MISMATCH.value)
        else:
            checks.domain_match = True

        # Rule 4: Scan Status Completed
        if policy.require_successful_scan:
            if scan.status != "completed":
                checks.scan_completed = False
                reasons.append(EligibilityReasonCode.SCAN_NOT_COMPLETED.value)
            else:
                checks.scan_completed = True
        else:
            checks.scan_completed = (scan.status == "completed")

        # Rule 5: Scan Recency (Inclusive Boundary)
        # Scan completed at exactly `now - timedelta(days=maximum_scan_age_days)` is eligible.
        if scan.completed_at is None:
            checks.scan_recent = False
            reasons.append(EligibilityReasonCode.SCAN_COMPLETION_TIME_UNAVAILABLE.value)
        else:
            completed_at = scan.completed_at
            if completed_at.tzinfo is None:
                completed_at = completed_at.replace(tzinfo=timezone.utc)

            # Age in days; inclusive threshold
            max_age_delta = timedelta(days=policy.maximum_scan_age_days)
            if (now - completed_at) > max_age_delta:
                checks.scan_recent = False
                reasons.append(EligibilityReasonCode.SCAN_TOO_OLD.value)
            else:
                checks.scan_recent = True

        # Rule 6: Score Availability and Threshold
        if scan.score is None:
            checks.score_available = False
            checks.minimum_score = False
            reasons.append(EligibilityReasonCode.SCORE_UNAVAILABLE.value)
        else:
            checks.score_available = True
            if scan.score < 0 or scan.score > 100:
                checks.minimum_score = False
                reasons.append(EligibilityReasonCode.INVALID_SCAN_DATA.value)
            elif scan.score < policy.minimum_score:
                checks.minimum_score = False
                reasons.append(EligibilityReasonCode.SCORE_BELOW_THRESHOLD.value)
            else:
                checks.minimum_score = True

        # Rule 7: Critical Findings
        if policy.disallow_critical_findings:
            if has_critical:
                checks.critical_findings = False
                reasons.append(EligibilityReasonCode.CRITICAL_FINDING_PRESENT.value)
            else:
                checks.critical_findings = True
        else:
            checks.critical_findings = True

        # Rule 8: High Findings
        if policy.disallow_high_findings:
            if has_high:
                checks.high_findings = False
                reasons.append(EligibilityReasonCode.HIGH_FINDING_PRESENT.value)
            else:
                checks.high_findings = True
        else:
            checks.high_findings = True

        # Rule 12: Continuous Monitoring Requirement (Future-facing)
        if policy.require_monitoring:
            if not website.monitoring_enabled:
                checks.monitoring_match = False
                reasons.append(EligibilityReasonCode.MONITORING_REQUIRED.value)
            else:
                checks.monitoring_match = True
        else:
            checks.monitoring_match = True

        is_eligible = (len(reasons) == 0)

        logger.debug(
            f"Evaluated badge eligibility for website {website.id} and scan {scan.id}: "
            f"eligible={is_eligible}, score={scan.score}, reasons={reasons}"
        )

        return BadgeEligibilityResult(
            eligible=is_eligible,
            website_id=website.id,
            scan_id=scan.id,
            score=scan.score,
            risk_level=scan.risk_level,
            reasons=reasons,
            checks=checks,
            policy=policy_summary,
            evaluated_at=now,
        )

    @classmethod
    def _build_default_policy_summary(cls, min_score: Optional[int] = None) -> PolicySummary:
        if min_score is None:
            min_score = getattr(settings, "SECURITY_BADGE_MINIMUM_SCORE", 70)
        return PolicySummary(
            minimum_score=min_score,
            maximum_scan_age_days=30,
            verification_validity_days=30,
            disallow_critical_findings=False,
            disallow_high_findings=False,
            require_successful_scan=True,
            require_authorized_website=True,
            require_monitoring=False,
        )

    @classmethod
    def _build_policy_summary(cls, policy: SecurityBadgePolicy) -> PolicySummary:
        return PolicySummary(
            minimum_score=policy.minimum_score,
            maximum_scan_age_days=policy.maximum_scan_age_days,
            verification_validity_days=policy.verification_validity_days,
            disallow_critical_findings=policy.disallow_critical_findings,
            disallow_high_findings=policy.disallow_high_findings,
            require_successful_scan=policy.require_successful_scan,
            require_authorized_website=policy.require_authorized_website,
            require_monitoring=policy.require_monitoring,
        )

    @classmethod
    def _build_policy_not_found_result(
        cls,
        website_id: uuid.UUID,
        scan_id: Optional[uuid.UUID],
        now: datetime,
    ) -> BadgeEligibilityResult:
        return BadgeEligibilityResult(
            eligible=False,
            website_id=website_id,
            scan_id=scan_id,
            score=None,
            risk_level=None,
            reasons=[EligibilityReasonCode.POLICY_NOT_FOUND.value],
            checks=EligibilityChecks(),
            policy=PolicySummary(
                minimum_score=70,
                maximum_scan_age_days=30,
                verification_validity_days=30,
                disallow_critical_findings=True,
                disallow_high_findings=False,
                require_successful_scan=True,
                require_authorized_website=True,
                require_monitoring=False,
            ),
            evaluated_at=now,
        )
