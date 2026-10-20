"""
Scanly Scanner Engine - Phase F7 Passive PII Discovery & Classification Analyzer
Passively audits crawled pages, HTML DOM, text samples, and client-side structures for PII.
Guarantees: Zero raw PII stored; all values irrevocably masked before metadata or findings.
"""
import re
from typing import List, Dict, Any, Tuple, Set, Optional

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import (
    DataCategory,
    Confidence,
    mask_email,
    mask_phone,
    mask_government_id,
)
from .data_security_finding_helper import make_data_finding

# Regex Patterns for PII Discovery
EMAIL_REGEX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}")

# Government Identity Patterns (US SSN, Indian PAN, Aadhaar)
SSN_REGEX = re.compile(r"\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b")
PAN_REGEX = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
AADHAAR_REGEX = re.compile(r"\b[2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4}\b")

# Generic email prefixes that represent expected public contact points rather than personal leaks
PUBLIC_GENERIC_EMAIL_PREFIXES = {
    "support", "sales", "info", "contact", "help", "hello", "hi", "press",
    "media", "jobs", "careers", "security", "privacy", "legal", "abuse",
    "billing", "inquiries", "feedback", "team", "marketing",
}

# Negative filter for false positive phone numbers (dates, semantic versions, coordinates, CSS)
DATE_VERSION_PATTERN = re.compile(r"^(19|20)\d{2}[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])$|^\d+\.\d+\.\d+")


def _classify_email(email_str: str) -> Tuple[str, str]:
    """Classifies email into 'generic' vs 'personal/internal'."""
    prefix = email_str.split("@")[0].lower()
    if any(prefix == g or prefix.startswith(f"{g}+") or prefix.startswith(f"{g}.") for g in PUBLIC_GENERIC_EMAIL_PREFIXES):
        return "generic_contact", Confidence.HIGH
    if "." in prefix or "_" in prefix or any(k in prefix for k in ("admin", "root", "dev", "employee", "corp")):
        return "personal_or_internal", Confidence.HIGH
    return "personal", Confidence.MEDIUM


def _is_valid_phone(phone_str: str) -> bool:
    """Filters out numeric version strings, dates, and non-phone artifacts."""
    clean = re.sub(r"[^\d+]", "", phone_str)
    if len(clean) < 7 or len(clean) > 15:
        return False
    # Avoid repeating same digit (e.g., 000000000, 11111111)
    if len(set(clean.replace("+", ""))) <= 2:
        return False
    if DATE_VERSION_PATTERN.match(phone_str.strip()):
        return False
    return True


def analyze_pii(
    crawled_pages: List[CrawledPage],
    max_samples_per_page: int = 5,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively extracts and classifies PII (emails, phone numbers, government IDs)
    across all crawled pages. Returns structured PII telemetry and security findings.
    """
    findings: List[Finding] = []

    discovered_emails: Dict[str, Dict[str, Any]] = {}  # email -> info
    discovered_phones: Dict[str, Dict[str, Any]] = {}
    discovered_gov_ids: List[Dict[str, Any]] = []

    seen_email_keys: Set[str] = set()
    seen_phone_keys: Set[str] = set()
    seen_gov_keys: Set[str] = set()

    for page in crawled_pages:
        # Search page text, body sample, inline scripts
        text_corpus: List[str] = []
        if page.body_sample:
            text_corpus.append(page.body_sample)
        if hasattr(page, "inline_scripts") and page.inline_scripts:
            text_corpus.extend(page.inline_scripts[:10])

        combined_text = "\n".join(text_corpus)
        if not combined_text:
            continue

        # 1. Emails
        for match in EMAIL_REGEX.finditer(combined_text):
            raw_email = match.group(0).strip().lower()
            if raw_email not in seen_email_keys:
                seen_email_keys.add(raw_email)
                email_type, conf = _classify_email(raw_email)
                discovered_emails[raw_email] = {
                    "masked": mask_email(raw_email),
                    "type": email_type,
                    "confidence": conf,
                    "page_url": page.url,
                }

        # 2. Phones
        for match in PHONE_REGEX.finditer(combined_text):
            raw_phone = match.group(0).strip()
            if _is_valid_phone(raw_phone) and raw_phone not in seen_phone_keys:
                seen_phone_keys.add(raw_phone)
                discovered_phones[raw_phone] = {
                    "masked": mask_phone(raw_phone),
                    "confidence": Confidence.MEDIUM,
                    "page_url": page.url,
                }

        # 3. Government IDs
        # US SSN
        for match in SSN_REGEX.finditer(combined_text):
            raw_ssn = match.group(0).strip()
            key = f"SSN:{raw_ssn}"
            if key not in seen_gov_keys:
                seen_gov_keys.add(key)
                discovered_gov_ids.append({
                    "type": "US Social Security Number (SSN)",
                    "masked": mask_government_id(raw_ssn),
                    "confidence": Confidence.HIGH,
                    "page_url": page.url,
                })

        # Indian PAN
        for match in PAN_REGEX.finditer(combined_text):
            raw_pan = match.group(0).strip()
            key = f"PAN:{raw_pan}"
            if key not in seen_gov_keys:
                seen_gov_keys.add(key)
                discovered_gov_ids.append({
                    "type": "Indian Permanent Account Number (PAN)",
                    "masked": mask_government_id(raw_pan),
                    "confidence": Confidence.HIGH,
                    "page_url": page.url,
                })

        # Indian Aadhaar
        for match in AADHAAR_REGEX.finditer(combined_text):
            raw_aadhaar = match.group(0).strip()
            key = f"Aadhaar:{raw_aadhaar}"
            if key not in seen_gov_keys:
                seen_gov_keys.add(key)
                discovered_gov_ids.append({
                    "type": "Indian Aadhaar National ID",
                    "masked": mask_government_id(raw_aadhaar),
                    "confidence": Confidence.HIGH,
                    "page_url": page.url,
                })

    # Prepare structured summary
    personal_emails = [e for e in discovered_emails.values() if e["type"] in ("personal", "personal_or_internal")]
    generic_emails = [e for e in discovered_emails.values() if e["type"] == "generic_contact"]

    formatted_personal_emails = [
        {"masked_email": e["masked"], "masked": e["masked"], "page_url": e["page_url"], "context": e.get("type")}
        for e in personal_emails[:max_samples_per_page]
    ]
    formatted_generic_emails = [
        {"masked_email": e["masked"], "masked": e["masked"], "page_url": e["page_url"]}
        for e in generic_emails[:max_samples_per_page]
    ]
    formatted_phone_numbers = [
        {"masked_phone": p["masked"], "masked": p["masked"], "page_url": p["page_url"]}
        for p in list(discovered_phones.values())[:max_samples_per_page]
    ]

    pii_telemetry = {
        "emails_total_count": len(discovered_emails),
        "personal_emails_count": len(personal_emails),
        "generic_emails_count": len(generic_emails),
        "personal_emails": formatted_personal_emails,
        "generic_emails": formatted_generic_emails,
        "personal_email_samples": [e["masked"] for e in personal_emails[:max_samples_per_page]],
        "generic_email_samples": [e["masked"] for e in generic_emails[:max_samples_per_page]],
        "phone_numbers_count": len(discovered_phones),
        "phone_numbers": formatted_phone_numbers,
        "phone_samples": [p["masked"] for p in list(discovered_phones.values())[:max_samples_per_page]],
        "government_ids_count": len(discovered_gov_ids),
        "government_ids": discovered_gov_ids[:max_samples_per_page],
    }

    # Generate Findings
    if discovered_gov_ids:
        gov_summary = ", ".join([f"{g['type']} ({g['masked']})" for g in discovered_gov_ids[:3]])
        findings.append(make_data_finding(
            check_type="deep_public_government_id",
            title="Public Government Identity Number Exposure",
            description=(
                "One or more government identification numbers (such as SSN, PAN, or National ID) "
                "were discovered in publicly accessible website content or source code."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"Exposed IDs: {gov_summary}",
            how_to_fix="Immediately purge government identity numbers from public web content, templates, and scripts.",
            data_category=DataCategory.SENSITIVE_PERSONAL,
        ))

    if personal_emails or discovered_phones:
        sample_str = ", ".join([e["masked"] for e in personal_emails[:3]])
        phone_str = ", ".join([p["masked"] for p in list(discovered_phones.values())[:2]])
        ev_parts = []
        if sample_str:
            ev_parts.append(f"Emails: {sample_str}")
        if phone_str:
            ev_parts.append(f"Phones: {phone_str}")

        findings.append(make_data_finding(
            check_type="deep_public_pii",
            title="Public Personal Contact Information (PII) Observable",
            description=(
                "Individual employee, administrator, or customer contact information (direct email addresses "
                "or personal telephone numbers) was identified across public web pages."
            ),
            severity=Severity.MEDIUM,
            status=CheckStatus.WARNING,
            evidence="; ".join(ev_parts),
            how_to_fix="Replace direct personal or employee contact information with generic organizational aliases (e.g. contact@example.com).",
            data_category=DataCategory.PERSONAL,
        ))

    return pii_telemetry, findings
