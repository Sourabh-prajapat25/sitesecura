"""
SiteSecura API - Scan Comparison & Security Change Detection Service
Performs deterministic, structure-aware diffing between consecutive scans to detect:
1. Score changes (drops >= 5 points, improvements)
2. New and resolved security findings
3. Normalized DNS record changes (A, AAAA, MX, TXT, SPF, DMARC, DNSSEC)
4. Security header modifications and removals (HSTS, CSP, X-Frame-Options, etc.)
5. SSL/TLS expiration thresholds (30d, 14d, 7d, expired) and renewals
"""
import logging
from typing import Dict, Any, List, Optional, Set, Tuple
from app.models.scan import Scan, ScanCheck

logger = logging.getLogger(__name__)

SCORE_DROP_ALERT_THRESHOLD = 5
SCORE_IMPROVE_THRESHOLD = 5


def _is_failed_check(check: ScanCheck) -> bool:
    """Returns True if the check indicates an active defect, warning, or security flaw."""
    status = (check.status or "").lower()
    return status in ("fail", "warning", "high", "critical")


def _extract_dns_data(scan: Scan) -> Dict[str, Any]:
    """Extracts and normalizes DNS records from scan checks."""
    dns_data: Dict[str, Any] = {
        "a_records": [],
        "aaaa_records": [],
        "mx_records": [],
        "txt_records": [],
        "spf_record": None,
        "dmarc_record": None,
        "dnssec_enabled": False,
    }
    for c in scan.checks or []:
        details = c.technical_details or {}
        if "dns_data" in details and isinstance(details["dns_data"], dict):
            raw = details["dns_data"]
            if "a_records" in raw and isinstance(raw["a_records"], list):
                dns_data["a_records"] = sorted(str(x).strip() for x in raw["a_records"])
            if "aaaa_records" in raw and isinstance(raw["aaaa_records"], list):
                dns_data["aaaa_records"] = sorted(str(x).strip() for x in raw["aaaa_records"])
            if "mx_records" in raw and isinstance(raw["mx_records"], list):
                dns_data["mx_records"] = sorted(str(x).strip() for x in raw["mx_records"])
            if "txt_records" in raw and isinstance(raw["txt_records"], list):
                dns_data["txt_records"] = sorted(str(x).strip() for x in raw["txt_records"])
            if "spf_record" in raw and raw["spf_record"]:
                dns_data["spf_record"] = str(raw["spf_record"]).strip()
            if "dmarc_record" in raw and raw["dmarc_record"]:
                dns_data["dmarc_record"] = str(raw["dmarc_record"]).strip()
            if "dnssec_enabled" in raw:
                dns_data["dnssec_enabled"] = bool(raw["dnssec_enabled"])
        elif c.check_type == "dns_spf":
            dns_data["spf_record"] = c.evidence or details.get("spf_record")
        elif c.check_type == "dns_dmarc":
            dns_data["dmarc_record"] = c.evidence or details.get("dmarc_record")
        elif c.check_type == "dns_dnssec":
            dns_data["dnssec_enabled"] = (c.status == "pass")

    return dns_data


def _extract_ssl_data(scan: Scan) -> Dict[str, Any]:
    """Extracts normalized SSL expiration, issuer, and days remaining."""
    ssl_data: Dict[str, Any] = {
        "valid": True,
        "days_remaining": None,
        "not_after": None,
        "issuer": None,
    }
    for c in scan.checks or []:
        if c.check_type in ("ssl_expiration", "ssl_validity"):
            details = c.technical_details or {}
            if "days_remaining" in details and details["days_remaining"] is not None:
                ssl_data["days_remaining"] = int(details["days_remaining"])
            if "not_after" in details:
                ssl_data["not_after"] = details["not_after"]
            if "issuer" in details:
                ssl_data["issuer"] = details["issuer"]
            if c.status in ("fail", "critical") or details.get("valid") is False:
                ssl_data["valid"] = False

    return ssl_data


def compare_scans(
    previous_scan: Optional[Scan],
    current_scan: Scan,
    score_drop_threshold: int = SCORE_DROP_ALERT_THRESHOLD,
) -> Dict[str, Any]:
    """
    Compares previous scan against current scan and outputs structured diffs.
    If previous_scan is None, current_scan is treated as baseline with zero diff alerts.
    """
    if not previous_scan:
        return {
            "is_baseline": True,
            "has_changes": False,
            "score": {
                "previous": None,
                "current": current_scan.score,
                "delta": 0,
                "changed": False,
                "is_drop": False,
                "is_increase": False,
            },
            "new_findings": [],
            "resolved_findings": [],
            "changed_checks": [],
            "dns_changes": [],
            "header_changes": [],
            "ssl_changes": [],
        }

    # 1. Score Delta
    prev_score = previous_scan.score if previous_scan.score is not None else 0
    curr_score = current_scan.score if current_scan.score is not None else 0
    delta = curr_score - prev_score
    is_drop = (delta <= -score_drop_threshold)
    is_increase = (delta >= SCORE_IMPROVE_THRESHOLD)
    score_changed = (delta != 0)

    # 2. Check Findings (by check_type)
    prev_checks_map = {c.check_type: c for c in (previous_scan.checks or [])}
    curr_checks_map = {c.check_type: c for c in (current_scan.checks or [])}

    new_findings: List[Dict[str, Any]] = []
    resolved_findings: List[Dict[str, Any]] = []
    changed_checks: List[Dict[str, Any]] = []

    # Check for new defects
    for check_type, curr_check in curr_checks_map.items():
        prev_check = prev_checks_map.get(check_type)
        curr_is_failed = _is_failed_check(curr_check)
        prev_is_failed = _is_failed_check(prev_check) if prev_check else False

        if curr_is_failed and not prev_is_failed:
            new_findings.append({
                "check_type": curr_check.check_type,
                "name": curr_check.name,
                "severity": curr_check.severity,
                "title": curr_check.title,
                "summary": curr_check.summary,
                "score_impact": curr_check.score_impact,
                "how_to_fix": curr_check.how_to_fix,
            })
        elif not curr_is_failed and prev_is_failed:
            resolved_findings.append({
                "check_type": curr_check.check_type,
                "name": curr_check.name,
                "title": curr_check.title,
                "previous_severity": prev_check.severity if prev_check else "warning",
            })
        elif prev_check and prev_check.status != curr_check.status:
            changed_checks.append({
                "check_type": curr_check.check_type,
                "name": curr_check.name,
                "previous_status": prev_check.status,
                "current_status": curr_check.status,
            })

    # Also check any checks that were previously failing and are now missing entirely
    for check_type, prev_check in prev_checks_map.items():
        if check_type not in curr_checks_map and _is_failed_check(prev_check):
            resolved_findings.append({
                "check_type": prev_check.check_type,
                "name": prev_check.name,
                "title": prev_check.title,
                "previous_severity": prev_check.severity,
            })

    # 3. DNS Changes
    dns_changes: List[Dict[str, Any]] = []
    prev_dns = _extract_dns_data(previous_scan)
    curr_dns = _extract_dns_data(current_scan)

    # A records
    if prev_dns["a_records"] and curr_dns["a_records"] and set(prev_dns["a_records"]) != set(curr_dns["a_records"]):
        dns_changes.append({
            "record_type": "A",
            "previous": prev_dns["a_records"],
            "current": curr_dns["a_records"],
            "description": f"IPv4 addresses changed from {prev_dns['a_records']} to {curr_dns['a_records']}",
        })
    # MX records
    if prev_dns["mx_records"] and curr_dns["mx_records"] and set(prev_dns["mx_records"]) != set(curr_dns["mx_records"]):
        dns_changes.append({
            "record_type": "MX",
            "previous": prev_dns["mx_records"],
            "current": curr_dns["mx_records"],
            "description": f"Mail exchange servers changed from {prev_dns['mx_records']} to {curr_dns['mx_records']}",
        })
    # SPF record
    if prev_dns["spf_record"] != curr_dns["spf_record"] and (prev_dns["spf_record"] or curr_dns["spf_record"]):
        dns_changes.append({
            "record_type": "SPF",
            "previous": prev_dns["spf_record"],
            "current": curr_dns["spf_record"],
            "description": f"SPF policy modified from '{prev_dns['spf_record']}' to '{curr_dns['spf_record']}'",
        })
    # DMARC record
    if prev_dns["dmarc_record"] != curr_dns["dmarc_record"] and (prev_dns["dmarc_record"] or curr_dns["dmarc_record"]):
        dns_changes.append({
            "record_type": "DMARC",
            "previous": prev_dns["dmarc_record"],
            "current": curr_dns["dmarc_record"],
            "description": f"DMARC policy changed from '{prev_dns['dmarc_record']}' to '{curr_dns['dmarc_record']}'",
        })
    # DNSSEC
    if prev_dns["dnssec_enabled"] != curr_dns["dnssec_enabled"]:
        dns_changes.append({
            "record_type": "DNSSEC",
            "previous": prev_dns["dnssec_enabled"],
            "current": curr_dns["dnssec_enabled"],
            "description": f"DNSSEC status changed from {prev_dns['dnssec_enabled']} to {curr_dns['dnssec_enabled']}",
        })

    # 4. Security Header Changes
    header_changes: List[Dict[str, Any]] = []
    header_check_types = ("hsts", "csp", "x_frame", "x_content_type", "referrer_policy", "permissions_policy")
    for ht in header_check_types:
        prev_h = prev_checks_map.get(ht)
        curr_h = curr_checks_map.get(ht)
        if prev_h and curr_h:
            # Header removed (was PASS, now not PASS)
            if prev_h.status == "pass" and curr_h.status != "pass":
                header_changes.append({
                    "header_type": ht,
                    "name": curr_h.name,
                    "change": "removed",
                    "severity": "high" if ht in ("hsts", "csp") else "warning",
                    "description": f"Security header '{curr_h.name}' was removed or weakened.",
                })
            # Header added (was not PASS, now PASS)
            elif prev_h.status != "pass" and curr_h.status == "pass":
                header_changes.append({
                    "header_type": ht,
                    "name": curr_h.name,
                    "change": "added",
                    "severity": "info",
                    "description": f"Security header '{curr_h.name}' was properly configured.",
                })

    # 5. SSL Expiration & Certificate Changes
    ssl_changes: List[Dict[str, Any]] = []
    prev_ssl = _extract_ssl_data(previous_scan)
    curr_ssl = _extract_ssl_data(current_scan)

    curr_days = curr_ssl.get("days_remaining")
    if curr_days is not None:
        if curr_days < 0:
            ssl_changes.append({
                "type": "ssl_expired",
                "severity": "critical",
                "days_remaining": curr_days,
                "description": f"SSL certificate has EXPIRED ({abs(curr_days)} days ago).",
                "bucket": "expired",
            })
        elif curr_days <= 7:
            ssl_changes.append({
                "type": "ssl_expiry_critical",
                "severity": "critical",
                "days_remaining": curr_days,
                "description": f"SSL certificate expires in {curr_days} days.",
                "bucket": "7_days",
            })
        elif curr_days <= 14:
            ssl_changes.append({
                "type": "ssl_expiry_high",
                "severity": "high",
                "days_remaining": curr_days,
                "description": f"SSL certificate expires in {curr_days} days.",
                "bucket": "14_days",
            })
        elif curr_days <= 30:
            ssl_changes.append({
                "type": "ssl_expiry_warning",
                "severity": "warning",
                "days_remaining": curr_days,
                "description": f"SSL certificate expires in {curr_days} days.",
                "bucket": "30_days",
            })

    # Certificate renewal
    if prev_ssl.get("not_after") and curr_ssl.get("not_after") and prev_ssl["not_after"] != curr_ssl["not_after"]:
        if curr_days is not None and curr_days > 30:
            ssl_changes.append({
                "type": "ssl_renewed",
                "severity": "info",
                "days_remaining": curr_days,
                "description": f"SSL certificate was renewed (valid until {curr_ssl['not_after']}).",
                "bucket": "renewed",
            })

    # Overall change determination
    has_changes = bool(
        score_changed
        or new_findings
        or resolved_findings
        or dns_changes
        or header_changes
        or ssl_changes
    )

    return {
        "is_baseline": False,
        "has_changes": has_changes,
        "score": {
            "previous": prev_score,
            "current": curr_score,
            "delta": delta,
            "changed": score_changed,
            "is_drop": is_drop,
            "is_increase": is_increase,
        },
        "new_findings": new_findings,
        "resolved_findings": resolved_findings,
        "changed_checks": changed_checks,
        "dns_changes": dns_changes,
        "header_changes": header_changes,
        "ssl_changes": ssl_changes,
    }
