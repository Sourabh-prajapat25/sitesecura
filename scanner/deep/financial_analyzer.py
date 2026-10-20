"""
Scanly Scanner Engine - Phase F7 Financial & Payment Data Exposure Analyzer
Passively inspects crawled pages and content for payment cards, CVV, IBAN, and financial details.
Guarantees: Strict Luhn algorithm verification; zero raw card numbers stored or emitted.
"""
import re
from typing import List, Dict, Any, Tuple, Set

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import (
    DataCategory,
    Confidence,
    mask_card_number,
    luhn_validate,
)
from .data_security_finding_helper import make_data_finding

# Potential payment card candidate regexes (13-19 digits, with or without delimiters)
CARD_CANDIDATE_REGEX = re.compile(r"\b(?:\d{4}[-\s]?){3,4}\d{1,4}\b|\b\d{13,19}\b")

# CVV / Security Code Context
CVV_CONTEXT_REGEX = re.compile(r"(?i)\b(?:cvv|cvc|cid|security[_-]?code)\s*[:=]\s*['\"]?(\d{3,4})['\"]?\b")

# International Bank Account Number (IBAN) format (RFC 13616)
IBAN_REGEX = re.compile(r"\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b")

# Known IBAN country codes for plausibility check
VALID_IBAN_COUNTRIES = {
    "AL", "AD", "AT", "AZ", "BH", "BY", "BE", "BA", "BR", "BG", "CR", "HR", "CY", "CZ",
    "DK", "DO", "EE", "FO", "FI", "FR", "GE", "DE", "GI", "GR", "GL", "GT", "HU", "IS",
    "IE", "IL", "IT", "JO", "KZ", "XK", "KW", "LV", "LB", "LI", "LT", "LU", "MK", "MT",
    "MR", "MU", "MD", "MC", "ME", "NL", "NO", "PK", "PS", "PL", "PT", "QA", "RO", "LC",
    "SM", "ST", "SA", "RS", "SC", "SK", "SI", "ES", "SE", "CH", "TL", "TN", "TR", "UA",
    "AE", "GB", "VA", "VG"
}


def _classify_card_brand(digits: str) -> str:
    """Identifies the card network from the IIN / BIN prefix."""
    if digits.startswith("4"):
        return "Visa"
    if digits.startswith(("51", "52", "53", "54", "55")) or (digits.startswith("2") and 2221 <= int(digits[:4]) <= 2720):
        return "Mastercard"
    if digits.startswith(("34", "37")):
        return "American Express"
    if digits.startswith("6011") or digits.startswith("65") or (digits.startswith("64") and 644 <= int(digits[:3]) <= 649):
        return "Discover"
    return "Payment Card"


def analyze_financial_data(
    crawled_pages: List[CrawledPage],
    max_samples: int = 5,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits pages for exposed payment card numbers (verified with Luhn algorithm),
    CVV codes, and IBAN bank account details.
    """
    findings: List[Finding] = []

    detected_cards: List[Dict[str, Any]] = []
    detected_ibans: List[Dict[str, Any]] = []
    cvv_found = False

    seen_cards: Set[str] = set()
    seen_ibans: Set[str] = set()

    for page in crawled_pages:
        text_corpus: List[str] = []
        if page.body_sample:
            text_corpus.append(page.body_sample)
        if hasattr(page, "inline_scripts") and page.inline_scripts:
            text_corpus.extend(page.inline_scripts[:10])

        combined_text = "\n".join(text_corpus)
        if not combined_text:
            continue

        # 1. Payment Cards with Luhn Check
        for match in CARD_CANDIDATE_REGEX.finditer(combined_text):
            raw_val = match.group(0)
            digits = re.sub(r"\D", "", raw_val)

            # Skip small numbers or excessively long ones
            if len(digits) < 13 or len(digits) > 19:
                continue

            # Deterministic Luhn Check
            if luhn_validate(digits):
                masked = mask_card_number(digits)
                if masked not in seen_cards:
                    seen_cards.add(masked)
                    brand = _classify_card_brand(digits)
                    detected_cards.append({
                        "card_brand": brand,
                        "brand": brand,
                        "masked_number": masked,
                        "masked": masked,
                        "page_url": page.url,
                        "confidence": Confidence.HIGH,
                    })

        # 2. CVV Context
        if CVV_CONTEXT_REGEX.search(combined_text):
            cvv_found = True

        # 3. IBAN Detection
        for match in IBAN_REGEX.finditer(combined_text):
            raw_iban = match.group(1).upper()
            country_code = raw_iban[:2]
            if country_code in VALID_IBAN_COUNTRIES and len(raw_iban) >= 15:
                # Mask IBAN (keep country code and last 4)
                masked_iban = f"{country_code}**-****-****-{raw_iban[-4:]}"
                if masked_iban not in seen_ibans:
                    seen_ibans.add(masked_iban)
                    detected_ibans.append({
                        "country_code": country_code,
                        "country": country_code,
                        "masked_iban": masked_iban,
                        "masked": masked_iban,
                        "page_url": page.url,
                        "confidence": Confidence.HIGH,
                    })

    financial_data = {
        "cards_detected_count": len(detected_cards),
        "cards": detected_cards[:max_samples],
        "ibans_detected_count": len(detected_ibans),
        "ibans": detected_ibans[:max_samples],
        "cvv_exposed": cvv_found,
    }

    # Findings Generation
    if detected_cards or cvv_found:
        card_summary = ", ".join([f"{c['brand']} ({c['masked']})" for c in detected_cards[:3]])
        ev = f"Identified valid payment cards: {card_summary}" if detected_cards else "CVV / Security code assignment pattern discovered in public content."
        if cvv_found and detected_cards:
            ev += " (CVV context also identified)."

        findings.append(make_data_finding(
            check_type="deep_public_payment_data",
            title="Public Payment Card (PAN) Data Exposed",
            description=(
                "Valid payment card numbers passing Luhn checksum verification or CVV security codes "
                "were discovered in public page source or responses. This represents a critical data security violation."
            ),
            severity=Severity.CRITICAL,
            status=CheckStatus.CRITICAL,
            evidence=ev,
            how_to_fix="Immediately remove payment card numbers from web pages, client templates, and static assets. Ensure compliance with PCI-DSS requirements.",
            data_category=DataCategory.FINANCIAL,
        ))

    elif detected_ibans:
        iban_summary = ", ".join([f"{i['country']} ({i['masked']})" for i in detected_ibans[:3]])
        findings.append(make_data_finding(
            check_type="deep_public_financial_data",
            title="Public Bank Account / IBAN Information Exposed",
            description=(
                "International Bank Account Numbers (IBAN) were identified in public content. "
                "Unless intentionally published for public donations or corporate invoicing, bank details should not be casually exposed."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"Exposed IBANs: {iban_summary}",
            how_to_fix="Review whether published banking details are intentional. Restrict direct bank account disclosures to authenticated customer portals.",
            data_category=DataCategory.FINANCIAL,
        ))

    return financial_data, findings
