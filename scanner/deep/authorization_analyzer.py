"""
Scanly Scanner Engine - Authorization Architecture & Access Control Surface Analyzer (Phase F5)
Passively identifies role-based access control (RBAC) metadata, administrative surfaces,
object-level reference structures (potential BOLA/IDOR architecture), and multi-tenant isolation signals.

Strictly passive: Zero ID manipulation, zero parameter tampering, zero privilege escalation attempts,
zero cross-tenant data access.
"""
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from urllib.parse import urlparse
from scanner.models import Finding, CheckStatus, Severity

STANDARD_ROLES = [
    "admin",
    "administrator",
    "owner",
    "superadmin",
    "manager",
    "editor",
    "moderator",
    "support",
    "staff",
    "member",
    "user",
    "viewer",
    "guest",
    "billing_admin",
]

TENANT_PARAM_PATTERNS = [
    re.compile(r"\b(?:tenant[_-]?id|org[_-]?id|organization[_-]?id|workspace[_-]?id|team[_-]?id|account[_-]?id)\b", re.I),
]

OBJECT_PARAM_ROUTE_REGEX = re.compile(
    r"/(?:users?|accounts?|orders?|invoices?|organizations?|projects?|documents?|items?|customers?|profiles?)/"
    r"(?:\{[a-zA-Z0-9_]+\}|[0-9]+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b",
    re.I
)


def discover_role_metadata(
    texts: List[str],
    api_specs: List[Dict[str, Any]],
) -> List[str]:
    """
    Passively extracts advertised user roles and scopes from API schemas,
    HTML samples, and configuration artifacts.
    """
    detected_roles: Set[str] = set()

    # 1. Search text contents
    for text in texts:
        if not text:
            continue
        text_lower = text.lower()
        has_auth_context = any(k in text_lower for k in ("role", "roles", "permission", "permissions", "user_type", "usertype", "access_control"))
        if has_auth_context:
            for role in STANDARD_ROLES:
                if re.search(r'\b' + re.escape(role) + r'\b', text_lower):
                    detected_roles.add(role)

    # 2. Check OpenAPI / Swagger schemas
    for spec in api_specs:
        raw_str = str(spec).lower()
        for role in STANDARD_ROLES:
            if role in raw_str and any(k in raw_str for k in ("roles", "scopes", "security")):
                detected_roles.add(role)

    return sorted(list(detected_roles))


def analyze_authorization_architecture(
    discovered_endpoints: List[str],
    crawled_texts: List[str],
    api_specs: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Identifies RBAC roles, administrative surfaces, object-level parameter routes,
    and multi-tenant scope indicators.
    """
    findings: List[Finding] = []

    # 1. Role Inventory
    roles = discover_role_metadata(crawled_texts, api_specs)
    if roles:
        findings.append(Finding(
            check_type="deep_auth_role_metadata",
            name="Role-Based Access Control (RBAC) Metadata Observed",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Application Role Hierarchy & Metadata Identified",
            summary=f"Public application schemas or responses reference user roles: {', '.join(roles)}.",
            why_it_matters="Role-based access control structures segment permissions across administrative, staff, and consumer users.",
            how_to_fix="Ensure all role boundaries are validated server-side on every request and never trusted from client inputs.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#role-based-access-control-rbac",
            evidence=f"Roles identified: {roles}.",
        ))

    # 2. Admin Surfaces
    admin_routes: List[str] = []
    for ep in discovered_endpoints:
        path_lower = urlparse(ep).path.lower()
        if any(k in path_lower for k in ("/admin", "/manage", "/dashboard/admin", "/api/admin")):
            admin_routes.append(ep)

    if admin_routes:
        findings.append(Finding(
            check_type="deep_auth_admin_endpoint",
            name="Administrative Management Surface Identified",
            status=CheckStatus.INFO,
            severity=Severity.INFO,
            score_impact=0,
            title="Privileged Administrative Route Surface Discovered",
            summary=f"Identified {len(admin_routes)} administrative endpoint(s). SiteSecura verified public structure without attempting unauthorized access.",
            why_it_matters="Administrative interfaces require robust access control, strict session validation, and multi-factor authentication.",
            how_to_fix="Enforce IP allowlisting, multi-factor authentication, and strict server-side RBAC validation for administrative paths.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
            evidence=f"Administrative routes discovered: {admin_routes[:5]}.",
        ))

    # 3. Object-Level Reference Surfaces
    object_routes: List[str] = []
    for ep in discovered_endpoints:
        if OBJECT_PARAM_ROUTE_REGEX.search(ep):
            object_routes.append(ep)

    if object_routes:
        findings.append(Finding(
            check_type="deep_auth_object_reference_surface",
            name="Object-Level Parameterized Endpoints Identified",
            status=CheckStatus.INFO,
            severity=Severity.INFO,
            score_impact=0,
            title="Object-Level Parameterized Resource Architecture Observed",
            summary=f"Identified {len(object_routes)} endpoint(s) utilizing direct object references (e.g. /users/{{id}}, /orders/{{id}}).",
            why_it_matters=(
                "APIs with object-level parameters require rigorous object-level authorization checks "
                "to ensure users can only access records belonging to their own account or organization (OWASP API1:2023)."
            ),
            how_to_fix="Implement robust object-level authorization (e.g. verify `current_user.organization_id == record.organization_id`) on every data query.",
            estimated_fix_minutes=0,
            documentation_url="https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/",
            evidence=f"Object-level routes observed: {object_routes[:5]}.",
        ))

    # 4. Multi-Tenant Signals
    tenant_signals: List[str] = []
    for ep in discovered_endpoints:
        for pat in TENANT_PARAM_PATTERNS:
            if pat.search(ep):
                tenant_signals.append(ep)
                break

    if tenant_signals:
        findings.append(Finding(
            check_type="deep_auth_tenant_signal",
            name="Multi-Tenant Isolation Parameters Observed",
            status=CheckStatus.INFO,
            severity=Severity.INFO,
            score_impact=0,
            title="Multi-Tenant Scope Identifiers Identified",
            summary=f"Endpoints reference tenant identifiers (e.g. organizationId, tenantId).",
            why_it_matters="Multi-tenant applications rely on tenant identifier boundaries to ensure strict customer isolation.",
            how_to_fix="Bind tenant scoping strictly to the authenticated user's session context rather than accepting unverified client parameters.",
            estimated_fix_minutes=0,
            documentation_url="https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
            evidence=f"Tenant-scoped endpoints observed: {tenant_signals[:5]}.",
        ))

    authz_data: Dict[str, Any] = {
        "roles_identified": roles,
        "roles_observed": roles,
        "roles_count": len(roles),
        "admin_routes_count": len(admin_routes),
        "admin_endpoints_count": len(admin_routes),
        "admin_endpoints": admin_routes[:10],
        "object_routes_count": len(object_routes),
        "object_routes": object_routes[:10],
        "tenant_signals_count": len(tenant_signals),
        "tenant_signals": tenant_signals[:5],
    }

    return authz_data, findings
