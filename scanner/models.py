"""
Scanly Scanner Engine - Models
Defines data structures and typed schemas for scanner outputs.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime


class CheckStatus(str, Enum):
    PASS = "pass"
    INFO = "info"
    WARNING = "warning"
    HIGH = "high"
    CRITICAL = "critical"
    UNKNOWN = "unknown"
    NOT_APPLICABLE = "not_applicable"


class Severity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskLevel(str, Enum):
    EXCELLENT = "Excellent"
    GOOD = "Good"
    MEDIUM = "Medium Risk"
    HIGH = "High Risk"
    CRITICAL = "Critical Risk"


@dataclass
class Finding:
    check_type: str
    name: str
    status: CheckStatus
    severity: Severity
    score_impact: int
    title: str
    summary: str
    why_it_matters: str
    how_to_fix: str
    estimated_fix_minutes: int
    documentation_url: str
    technical_details: Dict[str, Any] = field(default_factory=dict)
    evidence: Optional[str] = None
    confidence: float = 1.0


@dataclass
class CheckCategoryResult:
    category_name: str
    score: int
    max_score: int
    findings: List[Finding] = field(default_factory=list)


@dataclass
class ScanResult:
    domain: str
    normalized_domain: str
    target_ip: Optional[str]
    score: int
    risk_level: RiskLevel
    score_breakdown: Dict[str, Dict[str, Any]]
    findings: List[Finding]
    passed_checks_count: int
    total_checks_count: int
    scan_duration_ms: int
    started_at: datetime
    completed_at: datetime
    error_message: Optional[str] = None
    is_partial: bool = False
