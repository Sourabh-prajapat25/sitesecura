"""
Scanly Scanner Engine - Phase F7 Form Data Collection Sensitivity Analyzer
Analyzes form input fields for data categories, collection sensitivity, and excessive data collection signals.
Guarantees: Pure passive static HTML inspection; zero form submissions.
"""
from typing import List, Dict, Any, Tuple

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import (
    DataCategory,
    Confidence,
    classify_field_name,
)
from .data_security_finding_helper import make_data_finding

# Highly sensitive fields that require heightened necessity justification
HIGHLY_SENSITIVE_FORM_FIELDS = {
    "ssn", "social_security", "aadhaar", "pan", "national_id", "tax_id",
    "passport", "income", "salary", "medical", "patient", "blood_group",
    "card_number", "cvv", "bank_account"
}


def analyze_form_data(
    crawled_pages: List[CrawledPage],
    max_samples: int = 5,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively audits all forms discovered during crawling for input field sensitivity,
    data categories, and excessive data collection patterns.
    """
    findings: List[Finding] = []

    analyzed_forms: List[Dict[str, Any]] = []
    excessive_forms: List[Dict[str, Any]] = []

    for page in crawled_pages:
        for form in page.forms:
            action = (getattr(form, "action", None) if not isinstance(form, dict) else form.get("action")) or page.url
            raw_method = getattr(form, "method", None) if not isinstance(form, dict) else form.get("method")
            method = (raw_method or "GET").upper()
            inputs = (getattr(form, "inputs", None) if not isinstance(form, dict) else form.get("inputs")) or []

            categorized_inputs: List[Dict[str, Any]] = []
            has_highly_sensitive = False
            sensitive_field_names: List[str] = []

            for inp in inputs:
                name = (getattr(inp, "name", None) if not isinstance(inp, dict) else inp.get("name")) or ""
                inp_type = (getattr(inp, "input_type", None) or (inp.get("type") if isinstance(inp, dict) else "text") or "text").lower()
                clean_name = name.lower().replace("-", "_").strip()

                if not clean_name:
                    continue

                category, conf = classify_field_name(clean_name)
                if clean_name in HIGHLY_SENSITIVE_FORM_FIELDS or category in (
                    DataCategory.SENSITIVE_PERSONAL,
                    DataCategory.FINANCIAL,
                    DataCategory.HEALTH,
                ):
                    has_highly_sensitive = True
                    sensitive_field_names.append(name)

                categorized_inputs.append({
                    "name": name,
                    "type": inp_type,
                    "category": category,
                    "required": getattr(inp, "required", False),
                })

            if categorized_inputs:
                form_item = {
                    "page_url": page.url,
                    "action": action,
                    "method": method,
                    "fields_count": len(categorized_inputs),
                    "fields": categorized_inputs,
                    "has_sensitive_fields": has_highly_sensitive,
                }
                analyzed_forms.append(form_item)

                if has_highly_sensitive:
                    excessive_forms.append({
                        "page_url": page.url,
                        "action": action,
                        "sensitive_fields": sensitive_field_names,
                    })

    form_telemetry = {
        "forms_analyzed_count": len(analyzed_forms),
        "forms": analyzed_forms[:max_samples],
        "excessive_collection_forms_count": len(excessive_forms),
        "excessive_collection_forms": excessive_forms[:max_samples],
    }

    if excessive_forms:
        sample_form = excessive_forms[0]
        fields_str = ", ".join(sample_form["sensitive_fields"][:4])
        findings.append(make_data_finding(
            check_type="deep_excessive_data_collection",
            title=f"Excessive Data Collection Signal in Public Form: {fields_str}",
            description=(
                "The public form appears to request sensitive personal or financial information "
                f"({fields_str}). SiteSecura cannot determine the legal necessity of this data from the form alone. "
                "Ensure compliance with data minimization principles by requesting only strictly required fields."
            ),
            severity=Severity.LOW,
            status=CheckStatus.WARNING,
            evidence=f"Form on {sample_form['page_url']} (action: {sample_form['action']}) requests: {fields_str}",
            how_to_fix="Review input fields and eliminate optional or unnecessary sensitive fields from public customer-facing forms.",
            data_category=DataCategory.SENSITIVE_PERSONAL,
        ))

    return form_telemetry, findings
