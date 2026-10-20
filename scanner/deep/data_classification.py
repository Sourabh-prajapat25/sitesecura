"""
Scanly Scanner Engine - Phase F7 Data Classification Engine & Masking Utilities
Provides data taxonomy, confidence levels, irreversible masking, and deterministic validation (Luhn).
Guarantees: Zero raw PII, payment credentials, or secrets stored or transmitted.
"""
import re
from typing import Tuple, Dict, Any, Optional

# Classification Taxonomy
class DataCategory:
    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    PERSONAL = "PERSONAL"
    SENSITIVE_PERSONAL = "SENSITIVE_PERSONAL"
    AUTHENTICATION = "AUTHENTICATION"
    FINANCIAL = "FINANCIAL"
    HEALTH = "HEALTH"
    LOCATION = "LOCATION"
    IDENTITY = "IDENTITY"
    CONFIDENTIAL = "CONFIDENTIAL"
    SECRET = "SECRET"


class Confidence:
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


DataClassification = DataCategory
ConfidenceLevel = Confidence


# Irreversible Masking Functions
def mask_email(email: str) -> str:
    """
    Masks an email address irrevocably (e.g. 'john.doe@example.com' -> 'j***e@example.com').
    Never returns the full mailbox name.
    """
    if not email or "@" not in email:
        return "masked@***"
    parts = email.strip().split("@", 1)
    name = parts[0]
    domain = parts[1]
    
    if len(name) <= 2:
        masked_name = name[0] + "***"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"


def mask_phone(phone: str) -> str:
    """
    Masks a phone number keeping country/prefix hint and last 2-4 digits.
    (e.g. '+1-555-123-4567' -> '+1******4567', '+919876543210' -> '+91******3210')
    """
    clean = re.sub(r"[^\d+]", "", phone.strip())
    if len(clean) < 6:
        return "******"
    if clean.startswith("+"):
        prefix = clean[:3]
        suffix = clean[-4:]
        return f"{prefix}******{suffix}"
    return f"{clean[:2]}******{clean[-4:]}"


def mask_card_number(card: str) -> str:
    """
    Masks a payment card number, preserving first 6 (BIN) and last 4 digits.
    (e.g. '4532015112830366' -> '453201******0366')
    """
    digits = re.sub(r"\D", "", card.strip())
    if len(digits) < 10:
        return "****-****-****-****"
    return f"{digits[:6]}******{digits[-4:]}"


def mask_government_id(id_val: str, id_type: str = "") -> str:
    """
    Masks an official identification number (SSN, Aadhaar, PAN, National ID).
    (e.g. '123-45-6789' -> '***-**-6789')
    """
    clean = id_val.strip()
    if id_type.upper() == "SSN" or re.match(r"^\d{3}-\d{2}-\d{4}$", clean):
        return f"***-**-{clean[-4:]}"
    if len(clean) <= 4:
        return "****"
    return f"***-***-{clean[-4:]}"


def mask_token(token: str) -> str:
    """Masks a session, reset token, or password string."""
    if not token:
        return ""
    if len(token) <= 8:
        return "********"
    return token[:4] + "...***..." + token[-4:]


# Luhn Validation for Credit Card Detection
def luhn_validate(card_str: str) -> bool:
    """
    Deterministic Luhn (mod 10) algorithm to verify potential payment card numbers.
    Filters out numeric strings that are not valid card checksums.
    """
    digits_only = re.sub(r"\D", "", card_str)
    if not (13 <= len(digits_only) <= 19):
        return False

    checksum = 0
    reverse_digits = digits_only[::-1]
    for i, char in enumerate(reverse_digits):
        n = int(char)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        checksum += n

    return checksum % 10 == 0


# Sensitive Field Classification Patterns
FIELD_TAXONOMY_MAP = [
    # AUTHENTICATION
    (re.compile(r"(?i)(?:^|_)(?:pass(?:word|phrase)?|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth(?:orization)?|bearer|session|jwt|refresh[_-]?token|private[_-]?key|token)(?:$|_)"), DataCategory.AUTHENTICATION, Confidence.HIGH),
    # FINANCIAL
    (re.compile(r"(?i)(?:^|_)(?:card[_-]?(?:number|no)?|credit[_-]?card(?:[_-]?number)?|cc[_-]?num|cvv|cvc|pan|iban|swift|bank[_-]?acc(?:ount)?|routing|upi[_-]?id|payment[_-]?method|invoice[_-]?amount)(?:$|_)"), DataCategory.FINANCIAL, Confidence.HIGH),
    # SENSITIVE_PERSONAL (Government IDs, Health, Biometric)
    (re.compile(r"(?i)(?:^|_)(?:ssn|social[_-]?security|aadhaar|pan[_-]?card|national[_-]?id|tax[_-]?id|passport[_-]?no|driving[_-]?license)(?:$|_)"), DataCategory.SENSITIVE_PERSONAL, Confidence.HIGH),
    # HEALTH
    (re.compile(r"(?i)(?:^|_)(?:patient[_-]?id|diagnosis|prescription|medical[_-]?(?:record|history|diagnosis)|blood[_-]?group|health[_-]?data)(?:$|_)"), DataCategory.HEALTH, Confidence.HIGH),
    # PERSONAL
    (re.compile(r"(?i)(?:^|_)(?:first[_-]?name|last[_-]?name|full[_-]?name|user[_-]?name|user[_-]?id|customer[_-]?id|email|phone|mobile|cell|dob|birth[_-]?date|gender|address|postal[_-]?code|zip[_-]?code)(?:$|_)"), DataCategory.PERSONAL, Confidence.HIGH),
    # LOCATION
    (re.compile(r"(?i)(?:^|_)(?:latitude|longitude|gps(?:[_-]?(?:latitude|longitude|lat|lon))?|geo[_-]?(?:loc|lat|long)|home[_-]?address)(?:$|_)"), DataCategory.LOCATION, Confidence.MEDIUM),
    # INTERNAL / CONFIDENTIAL
    (re.compile(r"(?i)(?:^|_)(?:internal[_-]?notes?|debug|stack[_-]?trace|env(?:ironment)?|salary|compensation|admin[_-]?notes?)(?:$|_)"), DataCategory.INTERNAL, Confidence.HIGH),
]


def classify_field_name(field_name: str) -> Tuple[str, str]:
    """
    Classifies a data field or query parameter name into a DataCategory and confidence.
    Returns (category, confidence).
    """
    clean_name = field_name.strip()
    for pattern, category, confidence in FIELD_TAXONOMY_MAP:
        if pattern.search(clean_name):
            return category, confidence
    return DataCategory.PUBLIC, Confidence.LOW
