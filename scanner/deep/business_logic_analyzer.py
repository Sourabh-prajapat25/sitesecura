"""
Scanly Scanner Engine - Business-Logic Surface & Transaction Workflow Analyzer (Phase F5)
Passively inventories business-critical transaction surfaces (payment, billing, refund,
invitation, role modification, approval, and credits) and detects magic-link exposure.

Strictly passive: Zero state-changing mutations, zero payment calls, zero invitation triggers,
zero credit manipulation.
"""
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from urllib.parse import urlparse, parse_qs
from scanner.models import Finding, CheckStatus, Severity
from scanner.deep.secrets import mask_secret

BUSINESS_CATEGORIES = {
    "payment": re.compile(r"/(?:checkout|billing|payments?|stripe|invoices?|subscriptions?|orders?|pay)\b", re.I),
    "role_change": re.compile(r"/(?:admin/)?(?:users?/[^/]+/roles?|members?/[^/]+/roles?|team/members?|permissions?)\b", re.I),
    "refund": re.compile(r"/(?:refunds?|cancel[_-]order|disputes?)\b", re.I),
    "invitation": re.compile(r"/(?:invites?|invitations?|team/invite)\b", re.I),
    "approval": re.compile(r"/(?:approv(?:e|al|als)|reject(?:ion)?)\b", re.I),
    "credit": re.compile(r"/(?:wallet|credits?|points?|transfers?|payouts?)\b", re.I),
}

MAGIC_LINK_PARAM_NAMES = {"magic_link", "magiclink", "magic_token", "invite_token", "invitation_token"}
DUMMY_VALUES = {"", "test", "string", "null", "undefined", "{token}"}


def analyze_business_logic_surface(
    endpoints: List[str],
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Passively classifies business-critical workflows and checks for exposed invitation / magic-link tokens.
    """
    findings: List[Finding] = []
    categorized: Dict[str, List[str]] = {k: [] for k in BUSINESS_CATEGORIES}
    exposed_magic_links: List[Dict[str, Any]] = []
    seen: Set[str] = set()

    for ep in endpoints:
        if not ep or ep in seen:
            continue
        seen.add(ep)

        path_lower = urlparse(ep).path.lower()

        # Classify business categories
        for cat_name, regex in BUSINESS_CATEGORIES.items():
            if regex.search(path_lower):
                categorized[cat_name].append(ep)

        # Check for magic link / invite token in query parameters
        parsed = urlparse(ep)
        if parsed.query:
            qs = parse_qs(parsed.query, keep_blank_values=False)
            for p_name, p_vals in qs.items():
                if p_name.lower() in MAGIC_LINK_PARAM_NAMES:
                    for raw_val in p_vals:
                        if len(raw_val) >= 12 and raw_val.lower() not in DUMMY_VALUES:
                            masked = mask_secret(raw_val)
                            clean_ep = ep.replace(raw_val, masked)
                            exposed_magic_links.append({
                                "url": clean_ep,
                                "parameter": p_name,
                                "masked_token": masked,
                            })
                            findings.append(Finding(
                                check_type="deep_auth_magic_link_exposure",
                                name="Magic Link / Invitation Token Observed in URL",
                                status=CheckStatus.WARNING,
                                severity=Severity.MEDIUM,
                                score_impact=-4,
                                title=f"Authentication / Invite Token Leaked in URL Parameter '{p_name}'",
                                summary=f"Passwordless login or workspace invitation token observed in URL parameter '{p_name}'.",
                                why_it_matters=(
                                    "Magic link and invitation tokens grant access to user accounts or workspaces. "
                                    "Transporting them in URLs exposes them in server access logs and HTTP Referer headers."
                                ),
                                how_to_fix="Ensure magic links and invitation links expire rapidly (15 minutes), are strictly single-use, and invalidate upon completion.",
                                estimated_fix_minutes=20,
                                documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
                                evidence=f"URL '{clean_ep}' discloses token parameter '{p_name}'.",
                            ))
                            break

    # Business workflow informational findings
    if categorized["payment"]:
        findings.append(Finding(
            check_type="deep_business_payment_endpoint",
            name="Payment & Billing Workflow Surface Identified",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="E-Commerce / Payment Transaction Surface Discovered",
            summary=f"Discovered {len(categorized['payment'])} payment or subscription endpoint(s). SiteSecura did not execute or submit real payment transactions.",
            why_it_matters="Payment flows require robust PCI-DSS compliance, strict idempotency, and server-side amount validation.",
            how_to_fix="Ensure all transactions validate amounts and currency server-side and use trusted PCI-compliant payment gateways.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html",
            evidence=f"Payment endpoints: {categorized['payment'][:5]}.",
        ))

    if categorized["role_change"]:
        findings.append(Finding(
            check_type="deep_business_role_change_endpoint",
            name="User Role & Privilege Management Surface Identified",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Privilege & Role Modification Surface Discovered",
            summary=f"Identified {len(categorized['role_change'])} role-assignment endpoint(s). SiteSecura did not attempt privilege modification.",
            why_it_matters="Role modification endpoints are prime targets for privilege escalation attacks and require strict authorization checks.",
            how_to_fix="Verify that only authorized organization owners can modify member roles and log all changes to audit logs.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
            evidence=f"Role management endpoints: {categorized['role_change'][:5]}.",
        ))

    if categorized["refund"]:
        findings.append(Finding(
            check_type="deep_business_refund_endpoint",
            name="Refund & Cancellation Workflow Surface Identified",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Refund & Order Cancellation Surface Discovered",
            summary=f"Discovered {len(categorized['refund'])} refund or cancellation endpoint(s).",
            why_it_matters="Refund operations require two-step approval and strict business-logic checks to prevent negative balance or re-refund abuse.",
            how_to_fix="Enforce strict idempotency keys and server-side state verification for all refund transactions.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html",
            evidence=f"Refund endpoints: {categorized['refund'][:5]}.",
        ))

    if categorized["invitation"]:
        findings.append(Finding(
            check_type="deep_business_invite_endpoint",
            name="Workspace Invitation Workflow Surface Identified",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="User & Workspace Invitation Workflow Discovered",
            summary=f"Discovered {len(categorized['invitation'])} user invitation endpoint(s).",
            why_it_matters="Workspace invitation endpoints must enforce rate limits and validate inviter permissions to prevent email flooding and unauthorized workspace access.",
            how_to_fix="Rate-limit invitation requests and verify inviter organization permissions server-side.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
            evidence=f"Invitation endpoints: {categorized['invitation'][:5]}.",
        ))

    if categorized["approval"]:
        findings.append(Finding(
            check_type="deep_business_approval_endpoint",
            name="Administrative Approval Surface Identified",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Workflow Approval / Rejection Surface Discovered",
            summary=f"Discovered {len(categorized['approval'])} approval workflow endpoint(s).",
            why_it_matters="Approval actions must verify user authority and enforce separation of duties.",
            how_to_fix="Validate approver roles server-side and prevent self-approval of sensitive requests.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
            evidence=f"Approval endpoints: {categorized['approval'][:5]}.",
        ))

    if categorized["credit"]:
        findings.append(Finding(
            check_type="deep_business_credit_endpoint",
            name="Credits & Wallet Surface Identified",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Digital Wallet & Credit Management Surface Discovered",
            summary=f"Discovered {len(categorized['credit'])} wallet or credit management endpoint(s).",
            why_it_matters="Points and wallet systems require atomic database transactions to prevent race condition double-spending.",
            how_to_fix="Use database row locking (SELECT ... FOR UPDATE) and atomic operations for wallet balance updates.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html",
            evidence=f"Credit endpoints: {categorized['credit'][:5]}.",
        ))

    business_data: Dict[str, Any] = {
        "categorized_workflows": categorized,
        "magic_links_found": exposed_magic_links,
        "payment_endpoints_count": len(categorized["payment"]),
        "payment_endpoints": categorized["payment"][:5],
        "role_change_endpoints_count": len(categorized["role_change"]),
        "role_change_endpoints": categorized["role_change"][:5],
        "refund_endpoints_count": len(categorized["refund"]),
        "refund_endpoints": categorized["refund"][:5],
        "invitation_endpoints_count": len(categorized["invitation"]),
        "invitation_endpoints": categorized["invitation"][:5],
        "approval_endpoints_count": len(categorized["approval"]),
        "approval_endpoints": categorized["approval"][:5],
        "credit_endpoints_count": len(categorized["credit"]),
        "credit_endpoints": categorized["credit"][:5],
        "magic_links_detected_count": len(exposed_magic_links),
        "magic_links": exposed_magic_links[:5],
    }

    return business_data, findings
