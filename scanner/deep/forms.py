"""
Scanly Scanner Engine - Deep Scan Public Form Analysis Module
Passively inspects public form actions, protocols, and sensitive input fields without submission.
"""
from typing import List, Dict, Any
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage, FormMetadata


def analyze_public_forms(crawled_pages: List[CrawledPage]) -> List[Finding]:
    """
    Performs passive structural analysis of forms detected across crawled pages.
    STRICTLY NON-DESTRUCTIVE: Never dispatches form submissions.
    """
    findings: List[Finding] = []

    all_forms: List[FormMetadata] = []
    for p in crawled_pages:
        all_forms.extend(p.forms)

    if not all_forms:
        findings.append(
            Finding(
                check_type="deep_forms_none",
                name="Public Form Discovery",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="No Public Forms Detected",
                summary="No HTML input forms were observed across the crawled pages.",
                why_it_matters="Pages without input forms present no form-submission attack surface.",
                how_to_fix="No action required.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Learn/Forms/Security",
                evidence="Zero HTML forms detected.",
            )
        )
        return findings

    insecure_submission_forms: List[FormMetadata] = []
    password_on_http_forms: List[FormMetadata] = []
    external_action_forms: List[FormMetadata] = []

    for f in all_forms:
        # 1. Insecure form action (form action URL starts with http://)
        if f.action_protocol == "http":
            insecure_submission_forms.append(f)

        # 2. Password field rendered on a non-HTTPS page
        if f.has_password and f.page_url.startswith("http://"):
            password_on_http_forms.append(f)

        # 3. Form action submits to external origin
        if f.is_external and f.method == "POST":
            external_action_forms.append(f)

    # 1. Insecure submission finding (High severity)
    if insecure_submission_forms:
        evidence_lines = [
            f"Page: {f.page_url}\n  -> Action: {f.resolved_action_url} (Method: {f.method})"
            for f in insecure_submission_forms[:5]
        ]
        findings.append(
            Finding(
                check_type="deep_form_insecure_action",
                name="Insecure Form Action (Cleartext HTTP)",
                status=CheckStatus.HIGH,
                severity=Severity.HIGH,
                score_impact=-10,
                title="Form Submits Data Over Cleartext HTTP",
                summary=f"Found {len(insecure_submission_forms)} form(s) configured with unencrypted http:// action destinations.",
                why_it_matters="Form input submitted over cleartext HTTP can be intercepted by adversaries on the local network, compromising user input.",
                how_to_fix="Update form action attributes to use https:// URLs or relative paths.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Learn/Forms/Security",
                evidence="\n".join(evidence_lines),
            )
        )

    # 2. Password on non-HTTPS page (Critical severity)
    if password_on_http_forms:
        evidence_lines = [f.page_url for f in password_on_http_forms[:5]]
        findings.append(
            Finding(
                check_type="deep_form_password_on_http",
                name="Password Field on Cleartext HTTP Page",
                status=CheckStatus.CRITICAL,
                severity=Severity.CRITICAL,
                score_impact=-15,
                title="Password Input Rendered on Insecure Page",
                summary=f"Found password input field(s) served over cleartext HTTP.",
                why_it_matters="Browsers flag password fields on unencrypted pages as insecure and display prominent warnings to users.",
                how_to_fix="Serve all login and registration forms exclusively over HTTPS.",
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Learn/Forms/Security",
                evidence="\n".join(evidence_lines),
            )
        )

    # 3. External Form POST (Info / Low)
    if external_action_forms:
        evidence_lines = [
            f"Page: {f.page_url} -> External Target: {f.resolved_action_url}"
            for f in external_action_forms[:5]
        ]
        findings.append(
            Finding(
                check_type="deep_form_external_action",
                name="Form Posts to External Origin",
                status=CheckStatus.INFO,
                severity=Severity.LOW,
                score_impact=-1,
                title="Form Action Targets External Domain",
                summary=f"Detected {len(external_action_forms)} form(s) submitting POST data to external domain origins.",
                why_it_matters="Submitting forms to external origins requires careful verification that the external endpoint is trusted and uses encrypted transport.",
                how_to_fix="Verify that third-party form processors (e.g. payment gateways, email subscribe) are authorized and use HTTPS.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Learn/Forms/Security",
                evidence="\n".join(evidence_lines),
            )
        )

    # 4. Clean PASS
    if not insecure_submission_forms and not password_on_http_forms:
        findings.append(
            Finding(
                check_type="deep_form_secure_pass",
                name="Public Form Security",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Secure Form Endpoints Verified",
                summary=f"Analyzed {len(all_forms)} form(s) across crawled pages; all targets utilize secure encrypted HTTPS submission paths.",
                why_it_matters="Secure form submission prevents credentials and user inputs from being intercepted in transit.",
                how_to_fix="Maintain secure HTTPS action endpoints.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Learn/Forms/Security",
                evidence=f"Audited {len(all_forms)} public form(s).",
            )
        )

    return findings
