"""
Scanly API - Standalone CSP Policy Analyzer Service (Phase 3)
Provides deterministic parsing, standards evaluation (W3C CSP Level 3),
effective-directive fallback resolution, and safe remote header inspection.
"""
import re
import time
import logging
from typing import List, Dict, Tuple, Optional, Any, Set
from urllib.parse import urlparse, urljoin
from datetime import datetime, timezone

import httpx
import httpcore

from app.schemas.tools import (
    CspDirectiveItem,
    CspFinding,
    CspPolicyDetail,
    CspPolicyMetrics,
    CspPolicyAnalyzeRequest,
    CspPolicyAnalyzeResponse,
)
from scanner.network.safety import (
    validate_hostname,
    SSRFValidationError,
)
from scanner.network.resolver import SafeResolver, BaseResolver
from scanner.network.http_client import SafeSyncBackend

logger = logging.getLogger(__name__)

# Standard supported HTTP ports
ALLOWED_HTTP_PORTS = {80, 443}
DEFAULT_USER_AGENT = "SiteSecura-CspAnalyzer/1.0 (+https://sitesecura.com/tools/csp-policy-analyzer)"
DEFAULT_CONNECT_TIMEOUT = 3.0
DEFAULT_READ_TIMEOUT = 5.0
MAX_REDIRECTS = 5

# Regular expressions for token recognition
NONCE_PATTERN = re.compile(r"^'nonce-[a-zA-Z0-9+/=_-]+'$", re.IGNORECASE)
HASH_PATTERN = re.compile(r"^'(sha256|sha384|sha512)-[a-zA-Z0-9+/=_-]+'$", re.IGNORECASE)

KNOWN_STANDARD_DIRECTIVES = {
    "default-src",
    "script-src",
    "script-src-elem",
    "script-src-attr",
    "style-src",
    "style-src-elem",
    "style-src-attr",
    "img-src",
    "font-src",
    "connect-src",
    "media-src",
    "object-src",
    "manifest-src",
    "worker-src",
    "child-src",
    "frame-src",
    "frame-ancestors",
    "form-action",
    "base-uri",
    "sandbox",
    "upgrade-insecure-requests",
    "report-uri",
    "report-to",
    "trusted-types",
    "require-trusted-types-for",
    "navigate-to",
}

DEPRECATED_DIRECTIVES = {
    "block-all-mixed-content": "Deprecated in modern browsers; HTTPS upgrades are handled automatically or via upgrade-insecure-requests.",
    "plugin-types": "Removed from CSP Level 3 as legacy browser plugins (Flash, Silverlight, Java applets) are no longer supported.",
    "reflected-xss": "Obsolete directive removed from CSP Level 2.",
    "referrer": "Obsolete directive; replaced by the standalone 'Referrer-Policy' HTTP header.",
    "report-uri": "Deprecated in CSP Level 3 in favor of 'report-to', though still widely deployed for legacy browser compatibility.",
}

# Directives that inherit fallback from default-src
FALLBACK_TO_DEFAULT_SRC = {
    "script-src",
    "style-src",
    "img-src",
    "font-src",
    "connect-src",
    "media-src",
    "object-src",
    "manifest-src",
    "child-src",
}

# Standard CSP quoted keywords
RECOGNIZED_QUOTED_KEYWORDS = {
    "'self'",
    "'none'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "'strict-dynamic'",
    "'unsafe-hashes'",
    "'report-sample'",
    "'wasm-unsafe-eval'",
}

UNQUOTED_KEYWORDS = {
    "self": "'self'",
    "none": "'none'",
    "unsafe-inline": "'unsafe-inline'",
    "unsafe-eval": "'unsafe-eval'",
    "strict-dynamic": "'strict-dynamic'",
    "unsafe-hashes": "'unsafe-hashes'",
    "report-sample": "'report-sample'",
}


# ============================================================================
# 1. Parsing & Normalization Engine
# ============================================================================

def parse_csp_policy(raw_policy: str) -> Tuple[List[CspDirectiveItem], List[str]]:
    """
    Parses a raw CSP header string into structured CspDirectiveItem objects.
    Preserves original tokens, detects duplicates, unknown directives, and syntax warnings.
    Returns: (directives, top_level_warnings)
    """
    directives: List[CspDirectiveItem] = []
    warnings: List[str] = []
    seen_directive_names: Set[str] = set()

    # Normalize BOM or weird invisible leading chars
    cleaned = raw_policy.removeprefix("\ufeff").strip()
    if not cleaned:
        return ([], ["Submitted CSP policy string is empty."])

    # Split directives on semicolons
    raw_chunks = cleaned.split(";")
    for chunk in raw_chunks:
        chunk_str = chunk.strip()
        if not chunk_str:
            # Trailing or double semicolon (e.g. ";;")
            continue

        parts = chunk_str.split()
        if not parts:
            continue

        raw_dir_name = parts[0]
        dir_name = raw_dir_name.lower()
        values = parts[1:]

        dir_warnings: List[str] = []
        is_dup = dir_name in seen_directive_names
        is_unknown = dir_name not in KNOWN_STANDARD_DIRECTIVES and dir_name not in DEPRECATED_DIRECTIVES
        is_deprecated = dir_name in DEPRECATED_DIRECTIVES

        if is_dup:
            dir_warnings.append(
                f"Duplicate directive '{dir_name}'. Under CSP Level 3 §4.1, the first declaration is operative; subsequent duplicates are ignored by compliant browsers."
            )

        if is_unknown:
            dir_warnings.append(
                f"Unrecognized directive '{dir_name}'. It may be proprietary, experimental, or unsupported in current browser engines."
            )

        if is_deprecated:
            dir_warnings.append(
                f"Deprecated directive '{dir_name}': {DEPRECATED_DIRECTIVES[dir_name]}"
            )

        # Check for common unquoted keywords in values
        for val in values:
            val_lower = val.lower()
            if val_lower in UNQUOTED_KEYWORDS:
                dir_warnings.append(
                    f"Unquoted keyword '{val}'. Without surrounding single quotes, browsers parse this as a host name (e.g. 'http://{val}') rather than the CSP keyword {UNQUOTED_KEYWORDS[val_lower]}."
                )

        # Check for contradictory 'none' combined with other tokens
        has_none = any(v.lower() == "'none'" for v in values)
        if has_none and len(values) > 1:
            dir_warnings.append(
                f"Directive '{dir_name}' specifies ''none'' alongside other source expressions ({', '.join(values)}). ''none'' means no sources are permitted; combining it with other values is contradictory."
            )

        directive_item = CspDirectiveItem(
            name=dir_name,
            values=values,
            raw_text=chunk_str,
            is_duplicate=is_dup,
            is_unknown=is_unknown,
            is_deprecated=is_deprecated,
            is_fallback=False,
            fallback_source=None,
            warnings=dir_warnings,
        )

        directives.append(directive_item)
        seen_directive_names.add(dir_name)

    return (directives, warnings)


def resolve_effective_directives(
    explicit_directives: List[CspDirectiveItem],
) -> Dict[str, CspDirectiveItem]:
    """
    Determines effective directives according to W3C CSP Level 3 fallback rules.
    - script-src, img-src, style-src, font-src, connect-src, object-src, etc. fall back to default-src.
    - frame-src falls back to child-src, then default-src.
    - worker-src falls back to child-src, then script-src, then default-src.
    - base-uri, form-action, frame-ancestors DO NOT fall back to default-src!
    """
    effective: Dict[str, CspDirectiveItem] = {}

    # Map primary (first occurrence) explicit directives
    first_explicit: Dict[str, CspDirectiveItem] = {}
    for d in explicit_directives:
        if d.name not in first_explicit:
            first_explicit[d.name] = d

    default_src = first_explicit.get("default-src")

    # List of resource directives to evaluate for effective rules
    target_directives = [
        "default-src",
        "script-src",
        "object-src",
        "style-src",
        "img-src",
        "connect-src",
        "font-src",
        "media-src",
        "child-src",
        "frame-src",
        "worker-src",
        "manifest-src",
        "base-uri",
        "form-action",
        "frame-ancestors",
    ]

    for target in target_directives:
        if target in first_explicit:
            effective[target] = first_explicit[target]
        else:
            # Check fallback rules
            if target in FALLBACK_TO_DEFAULT_SRC and default_src:
                effective[target] = CspDirectiveItem(
                    name=target,
                    values=default_src.values,
                    raw_text=f"{target} (inherited from default-src: {default_src.raw_text})",
                    is_duplicate=False,
                    is_unknown=False,
                    is_deprecated=False,
                    is_fallback=True,
                    fallback_source="default-src",
                    warnings=[],
                )
            elif target == "frame-src":
                # frame-src falls back to child-src, then default-src
                if "child-src" in first_explicit:
                    child_src = first_explicit["child-src"]
                    effective[target] = CspDirectiveItem(
                        name=target,
                        values=child_src.values,
                        raw_text=f"frame-src (inherited from child-src: {child_src.raw_text})",
                        is_duplicate=False,
                        is_unknown=False,
                        is_deprecated=False,
                        is_fallback=True,
                        fallback_source="child-src",
                        warnings=[],
                    )
                elif default_src:
                    effective[target] = CspDirectiveItem(
                        name=target,
                        values=default_src.values,
                        raw_text=f"frame-src (inherited from default-src: {default_src.raw_text})",
                        is_duplicate=False,
                        is_unknown=False,
                        is_deprecated=False,
                        is_fallback=True,
                        fallback_source="default-src",
                        warnings=[],
                    )
            elif target == "worker-src":
                # worker-src falls back to child-src, then script-src, then default-src
                if "child-src" in first_explicit:
                    child_src = first_explicit["child-src"]
                    effective[target] = CspDirectiveItem(
                        name=target,
                        values=child_src.values,
                        raw_text=f"worker-src (inherited from child-src: {child_src.raw_text})",
                        is_duplicate=False,
                        is_unknown=False,
                        is_deprecated=False,
                        is_fallback=True,
                        fallback_source="child-src",
                        warnings=[],
                    )
                elif "script-src" in first_explicit:
                    script_src = first_explicit["script-src"]
                    effective[target] = CspDirectiveItem(
                        name=target,
                        values=script_src.values,
                        raw_text=f"worker-src (inherited from script-src: {script_src.raw_text})",
                        is_duplicate=False,
                        is_unknown=False,
                        is_deprecated=False,
                        is_fallback=True,
                        fallback_source="script-src",
                        warnings=[],
                    )
                elif default_src:
                    effective[target] = CspDirectiveItem(
                        name=target,
                        values=default_src.values,
                        raw_text=f"worker-src (inherited from default-src: {default_src.raw_text})",
                        is_duplicate=False,
                        is_unknown=False,
                        is_deprecated=False,
                        is_fallback=True,
                        fallback_source="default-src",
                        warnings=[],
                    )
            # Note: base-uri, form-action, frame-ancestors DO NOT fall back!

    return effective


# ============================================================================
# 2. Security Analysis Rules Engine
# ============================================================================

def analyze_single_csp_policy(
    raw_policy: str,
    policy_type: str = "enforce",
) -> CspPolicyDetail:
    """
    Executes deep static analysis on an individual CSP string.
    Generates deterministic findings, severity ratings, evidence, and recommendations.
    """
    directives, parse_warnings = parse_csp_policy(raw_policy)
    effective_directives = resolve_effective_directives(directives)

    findings: List[CspFinding] = []

    # Map directives by name
    explicit_map: Dict[str, CspDirectiveItem] = {}
    for d in directives:
        if d.name not in explicit_map:
            explicit_map[d.name] = d

    # 1. Report-Only Warning
    is_report_only = policy_type == "report_only"
    if is_report_only:
        findings.append(
            CspFinding(
                id="CSP_REPORT_ONLY_MODE",
                title="Policy is Operating in Report-Only Mode",
                severity="info",
                confidence="definite",
                directive=None,
                evidence=None,
                explanation="The policy is delivered via 'Content-Security-Policy-Report-Only'. In this mode, the browser reports policy violations to configured reporting endpoints but DOES NOT enforce restrictions or block any resources.",
                security_impact="Attackers can still successfully execute Cross-Site Scripting (XSS), load untrusted resources, and exfiltrate data unhindered by this policy.",
                recommendation="Use Report-Only mode during staging and initial deployment to collect violation reports. Once you have verified that legitimate application resources are permitted without violations, promote the policy to the enforcing 'Content-Security-Policy' header.",
                safe_example="Content-Security-Policy: default-src 'self'; ...",
                reference="W3C CSP Level 3 §3.2 (Reporting)",
                is_conditional=False,
            )
        )

    # 2. Missing default-src
    has_default_src = "default-src" in explicit_map
    if not has_default_src:
        # Check how many resource directives are missing
        uncovered = [
            req
            for req in ("script-src", "object-src", "style-src", "img-src", "connect-src")
            if req not in explicit_map
        ]
        if uncovered:
            findings.append(
                CspFinding(
                    id="CSP_MISSING_DEFAULT_SRC_WITH_UNCOVERED_TYPES",
                    title="Missing 'default-src' Directive with Uncovered Resource Types",
                    severity="high" if "script-src" in uncovered or "object-src" in uncovered else "medium",
                    confidence="definite",
                    directive="default-src",
                    evidence=f"Uncovered types: {', '.join(uncovered)}",
                    explanation=f"'default-src' is not defined, leaving {len(uncovered)} resource directive(s) ({', '.join(uncovered)}) completely unconstrained. When both 'default-src' and a specific directive are absent, browsers allow loading that resource type from ANY origin.",
                    security_impact="Uncovered resource types can be retrieved from untrusted or malicious third parties without restriction.",
                    recommendation="Define a restrictive 'default-src' directive (such as 'default-src 'self'' or 'default-src 'none'') to establish a secure fallback for all resource types.",
                    safe_example="default-src 'self';",
                    reference="W3C CSP Level 3 §6.1.1 (default-src)",
                    is_conditional=False,
                )
            )
        else:
            findings.append(
                CspFinding(
                    id="CSP_MISSING_DEFAULT_SRC_EXPLICIT_FALLBACK",
                    title="Missing 'default-src' Directive (All Common Types Explicit)",
                    severity="low",
                    confidence="informational",
                    directive="default-src",
                    evidence=None,
                    explanation="'default-src' is not specified, but all primary resource directives (script-src, object-src, style-src, img-src, connect-src) are explicitly defined.",
                    security_impact="While current resource types are constrained, any future or auxiliary directives (such as worker-src, font-src, media-src, manifest-src) will default to unrestricted loading.",
                    recommendation="Add 'default-src 'self'' or 'default-src 'none'' to maintain a secure baseline for future web standards and unhandled resource types.",
                    safe_example="default-src 'self';",
                    reference="W3C CSP Level 3 §6.1.1",
                    is_conditional=True,
                )
            )

    # 3. script-src Analysis
    effective_script = effective_directives.get("script-src")
    if not effective_script:
        findings.append(
            CspFinding(
                id="CSP_SCRIPT_SRC_MISSING",
                title="Missing 'script-src' Directive (Unrestricted Script Execution)",
                severity="critical" if not is_report_only else "high",
                confidence="definite",
                directive="script-src",
                evidence=None,
                explanation="Neither 'script-src' nor 'default-src' is defined in this policy. Browsers allow scripts to execute from ANY location, completely disabling CSP's primary defense against Cross-Site Scripting (XSS).",
                security_impact="Injected scripts, malicious CDNs, and inline event handlers can execute without impediment.",
                recommendation="Define 'script-src' with trusted origins, nonces ('nonce-...'), or cryptographic hashes ('sha256-...'). Avoid wildcard origins.",
                safe_example="script-src 'self' https://trusted.cdn.com;",
                reference="W3C CSP Level 3 §6.1.13 (script-src)",
                is_conditional=False,
            )
        )
    else:
        script_vals = effective_script.values
        script_vals_lower = [s.lower() for s in script_vals]

        has_nonces = any(NONCE_PATTERN.match(s) for s in script_vals)
        has_hashes = any(HASH_PATTERN.match(s) for s in script_vals)
        has_strict_dynamic = "'strict-dynamic'" in script_vals_lower
        has_unsafe_inline = "'unsafe-inline'" in script_vals_lower
        has_unsafe_eval = "'unsafe-eval'" in script_vals_lower
        has_wildcard = "*" in script_vals
        has_broad_https = "https:" in script_vals_lower
        has_data_scheme = "data:" in script_vals_lower

        # 'unsafe-inline' handling
        if has_unsafe_inline:
            if (has_nonces or has_hashes) and has_strict_dynamic:
                # Modern CSP3 polyfill pattern!
                findings.append(
                    CspFinding(
                        id="CSP_UNSAFE_INLINE_POLYFILL_NOTICE",
                        title="'unsafe-inline' Present with 'strict-dynamic' and Nonces (CSP3 Polyfill)",
                        severity="info",
                        confidence="conditional",
                        directive="script-src",
                        evidence=f"script-src {' '.join(script_vals)}",
                        explanation="The policy contains ''unsafe-inline'' alongside ''strict-dynamic'' and cryptographic nonces or hashes. In modern CSP Level 3 compliant browsers (Chrome, Firefox, Safari, Edge), ''unsafe-inline'' is automatically ignored when a nonce or hash is present.",
                        security_impact="Modern browsers enforce strict nonce/hash validation. Older CSP Level 1/2 browsers will fall back to permitting inline scripts.",
                        recommendation="If your application only targets modern browsers, you can remove ''unsafe-inline''. If legacy browser support is required, retain this pattern as an intentional backward-compatibility polyfill.",
                        safe_example="script-src 'strict-dynamic' 'nonce-rAnd0m123' 'unsafe-inline';",
                        reference="W3C CSP Level 3 §6.1.13.2 ('strict-dynamic' semantics)",
                        is_conditional=True,
                    )
                )
            elif has_nonces or has_hashes:
                findings.append(
                    CspFinding(
                        id="CSP_UNSAFE_INLINE_IGNORED_BY_NONCE",
                        title="'unsafe-inline' Present with Nonce/Hash (Ignored in Modern Browsers)",
                        severity="low",
                        confidence="conditional",
                        directive="script-src",
                        evidence=f"script-src {' '.join(script_vals)}",
                        explanation="The policy specifies ''unsafe-inline'' alongside nonces or hashes. In CSP Level 2 and Level 3 browsers, the presence of a nonce or hash causes ''unsafe-inline'' to be ignored for script tags.",
                        security_impact="Inline script tags without nonces are blocked in modern browsers, but inline event handlers (e.g. onclick) may still behave differently depending on browser version.",
                        recommendation="Remove ''unsafe-inline'' if legacy browser backward compatibility is not needed.",
                        safe_example="script-src 'self' 'nonce-rAnd0m123';",
                        reference="W3C CSP Level 2 §4.2",
                        is_conditional=True,
                    )
                )
            else:
                findings.append(
                    CspFinding(
                        id="CSP_UNSAFE_INLINE_SCRIPT",
                        title="'unsafe-inline' Enabled in Script Policy",
                        severity="high",
                        confidence="definite",
                        directive="script-src",
                        evidence=f"script-src {' '.join(script_vals)}",
                        explanation="The policy allows ''unsafe-inline'' in script execution without nonces or cryptographic hashes. This permits execution of inline <script> tags, javascript: URIs, and inline DOM event attributes (onclick, onload).",
                        security_impact="Substantially neutralizes CSP's XSS mitigation capabilities. If an attacker injects HTML onto the page, their script code executes without obstruction.",
                        recommendation="Refactor inline code into external JavaScript bundles. For necessary inline snippets, deploy per-response cryptographically random nonces ('nonce-...') or SHA-256 hashes.",
                        safe_example="script-src 'self' 'nonce-EDNnf03nceIOfn39fn3e9h3sdfa';",
                        reference="W3C CSP Level 3 §6.1.13 (script-src)",
                        is_conditional=False,
                    )
                )

        # 'unsafe-eval' handling
        if has_unsafe_eval:
            findings.append(
                CspFinding(
                    id="CSP_UNSAFE_EVAL_SCRIPT",
                    title="'unsafe-eval' Permits Dynamic Code Execution",
                    severity="medium",
                    confidence="definite",
                    directive="script-src",
                    evidence=f"script-src {' '.join(script_vals)}",
                    explanation="The policy permits ''unsafe-eval'', allowing JavaScript execution strings passed to eval(), Function(), setTimeout(string), and setInterval(string).",
                    security_impact="Increases vulnerability surface to DOM-based XSS when user-controlled data is parsed into dynamic evaluation functions.",
                    recommendation="Avoid eval() and string-based execution. Use modern JSON.parse() for serialization, and precompile frontend templates (e.g. React, Vue, Angular) during your build process.",
                    safe_example="script-src 'self' 'nonce-...';",
                    reference="W3C CSP Level 3 §6.1.13.3 (eval execution)",
                    is_conditional=False,
                )
            )

        # Wildcard script source
        if has_wildcard:
            findings.append(
                CspFinding(
                    id="CSP_SCRIPT_WILDCARD_SOURCE",
                    title="Wildcard (*) Source in Script Policy",
                    severity="critical" if not is_report_only else "high",
                    confidence="definite",
                    directive="script-src",
                    evidence=f"script-src {' '.join(script_vals)}",
                    explanation="The policy includes the wildcard '*' source in script execution, permitting script loading from any domain across the Internet.",
                    security_impact="Completely undermines origin restriction. An attacker can load malicious script payloads from any external host or domain.",
                    recommendation="Replace '*' with specific trusted domain origins, strict nonces, or package-specific CDN hosts.",
                    safe_example="script-src 'self' https://cdn.jsdelivr.net;",
                    reference="W3C CSP Level 3 §6.1.13",
                    is_conditional=False,
                )
            )

        # Broad https: scheme in script-src
        if has_broad_https and not has_strict_dynamic:
            findings.append(
                CspFinding(
                    id="CSP_SCRIPT_BROAD_HTTPS_SCHEME",
                    title="Broad 'https:' Scheme in Script Policy",
                    severity="medium",
                    confidence="definite",
                    directive="script-src",
                    evidence=f"script-src {' '.join(script_vals)}",
                    explanation="The policy specifies 'https:' as a script source expression. This permits scripts to be loaded from any HTTPS-enabled server worldwide.",
                    security_impact="Attackers can host payloads on legitimate HTTPS cloud services (e.g. AWS S3, Google Cloud Storage, GitHub Pages) and load them into your application.",
                    recommendation="Restrict script-src to explicit trusted domains rather than the open 'https:' protocol scheme.",
                    safe_example="script-src 'self' https://trusted.example.com;",
                    reference="W3C CSP Level 3 §6.1.13",
                    is_conditional=False,
                )
            )

        # data: scheme in script-src
        if has_data_scheme:
            findings.append(
                CspFinding(
                    id="CSP_SCRIPT_DATA_SCHEME",
                    title="Dangerous 'data:' Scheme in Script Policy",
                    severity="high",
                    confidence="definite",
                    directive="script-src",
                    evidence=f"script-src {' '.join(script_vals)}",
                    explanation="The policy specifies the 'data:' URI scheme in script-src. Data URIs can encode arbitrary executable JavaScript strings (e.g. data:text/javascript,alert(1)).",
                    security_impact="Enables trivial XSS exploitation via injected <script src=\"data:text/javascript,...\"> tags.",
                    recommendation="Remove 'data:' from script-src and default-src directives.",
                    safe_example="script-src 'self';",
                    reference="W3C CSP Level 3 §6.1.13",
                    is_conditional=False,
                )
            )

        # Positive praise for modern strict-dynamic
        if has_strict_dynamic and (has_nonces or has_hashes):
            findings.append(
                CspFinding(
                    id="CSP_STRICT_DYNAMIC_DEPLOYED",
                    title="Modern 'strict-dynamic' Architecture Deployed",
                    severity="info",
                    confidence="definite",
                    directive="script-src",
                    evidence=f"script-src {' '.join(script_vals)}",
                    explanation="The policy employs ''strict-dynamic'' with cryptographic nonces or hashes. This implements modern CSP Level 3 script protection, allowing authorized scripts to dynamically load trusted dependencies without brittle domain allowlists.",
                    security_impact="Significantly hardens the application against XSS while reducing maintenance overhead associated with external CDN domain allowlists.",
                    recommendation="Maintain nonce unpredictability and ensure server-side template generation creates a fresh random nonce for every HTTP response.",
                    safe_example="script-src 'strict-dynamic' 'nonce-...' https:;",
                    reference="W3C CSP Level 3 §6.1.13.2",
                    is_conditional=False,
                )
            )

    # 4. object-src Analysis
    effective_object = effective_directives.get("object-src")
    if not effective_object:
        findings.append(
            CspFinding(
                id="CSP_OBJECT_SRC_MISSING",
                title="Missing 'object-src' Directive (Plugin Exploitation Risk)",
                severity="high" if not is_report_only else "medium",
                confidence="definite",
                directive="object-src",
                evidence=None,
                explanation="Neither 'object-src' nor 'default-src' is defined, leaving plugin execution (<object>, <embed>, <applet>) completely unrestricted.",
                security_impact="Legacy browser plugins or malicious multimedia containers can execute arbitrary code or bypass DOM sandbox protections.",
                recommendation="Set 'object-src 'none'' unless your application explicitly relies on legacy browser object embedding.",
                safe_example="object-src 'none';",
                reference="W3C CSP Level 3 §6.1.10 (object-src)",
                is_conditional=False,
            )
        )
    else:
        obj_vals = effective_object.values
        if "'none'" not in [v.lower() for v in obj_vals]:
            findings.append(
                CspFinding(
                    id="CSP_OBJECT_SRC_NOT_NONE",
                    title="'object-src' is Not Restricted to ''none''",
                    severity="medium",
                    confidence="definite",
                    directive="object-src",
                    evidence=f"object-src {' '.join(obj_vals)}",
                    explanation=f"'object-src' allows plugins from: {', '.join(obj_vals)}. Modern web applications rarely need plugins (<object>, <embed>). Allowing plugins expands the XSS attack surface.",
                    security_impact="Plugins can be coerced into loading untrusted payloads or executing legacy code that ignores standard origin boundaries.",
                    recommendation="Set 'object-src 'none'' to completely disable plugin execution.",
                    safe_example="object-src 'none';",
                    reference="W3C CSP Level 3 §6.1.10",
                    is_conditional=False,
                )
            )

    # 5. base-uri Analysis (Does NOT fall back to default-src!)
    if "base-uri" not in explicit_map:
        findings.append(
            CspFinding(
                id="CSP_MISSING_BASE_URI",
                title="Missing 'base-uri' Directive (Base Tag Hijacking Risk)",
                severity="medium",
                confidence="definite",
                directive="base-uri",
                evidence=None,
                explanation="'base-uri' is not defined in the policy. Note that 'base-uri' DOES NOT fall back to 'default-src'. When omitted, any origin can be injected into an HTML <base href=\"...\"> tag.",
                security_impact="If an attacker injects a <base> tag, all relative script, stylesheet, and API URLs will resolve against the attacker's server, enabling remote code execution.",
                recommendation="Explicitly define 'base-uri 'self'' or 'base-uri 'none''.",
                safe_example="base-uri 'self';",
                reference="W3C CSP Level 3 §6.2.2 (base-uri)",
                is_conditional=False,
            )
        )
    else:
        base_vals = explicit_map["base-uri"].values
        if "*" in base_vals:
            findings.append(
                CspFinding(
                    id="CSP_BASE_URI_WILDCARD",
                    title="Wildcard (*) Specified in 'base-uri'",
                    severity="medium",
                    confidence="definite",
                    directive="base-uri",
                    evidence=f"base-uri {' '.join(base_vals)}",
                    explanation="'base-uri' contains '*', allowing the document base URL to be set to any external domain.",
                    security_impact="Attackers with HTML injection can hijack relative URL resolution across the entire page.",
                    recommendation="Restrict 'base-uri' to ''self'' or ''none''.",
                    safe_example="base-uri 'self';",
                    reference="W3C CSP Level 3 §6.2.2",
                    is_conditional=False,
                )
            )

    # 6. frame-ancestors Analysis (Does NOT fall back to default-src!)
    if "frame-ancestors" not in explicit_map:
        findings.append(
            CspFinding(
                id="CSP_MISSING_FRAME_ANCESTORS",
                title="Missing 'frame-ancestors' Directive (Clickjacking Defense)",
                severity="medium",
                confidence="definite",
                directive="frame-ancestors",
                evidence=None,
                explanation="'frame-ancestors' is omitted. 'frame-ancestors' DOES NOT fall back to 'default-src'. It governs which parent pages may embed this site within <iframe>, <frame>, <object>, or <embed> elements, superseding the legacy X-Frame-Options header.",
                security_impact="Without framing restrictions, malicious websites can embed this application inside a transparent iframe to execute clickjacking attacks, coercing authenticated users into unintended actions.",
                recommendation="Set 'frame-ancestors 'self'' to restrict framing to your own origin, or 'frame-ancestors 'none'' to disallow framing entirely.",
                safe_example="frame-ancestors 'self';",
                reference="W3C CSP Level 3 §6.3.1 (frame-ancestors)",
                is_conditional=False,
            )
        )
    else:
        frame_anc_vals = explicit_map["frame-ancestors"].values
        if "*" in frame_anc_vals:
            findings.append(
                CspFinding(
                    id="CSP_FRAME_ANCESTORS_WILDCARD",
                    title="Wildcard (*) Specified in 'frame-ancestors'",
                    severity="medium",
                    confidence="definite",
                    directive="frame-ancestors",
                    evidence=f"frame-ancestors {' '.join(frame_anc_vals)}",
                    explanation="'frame-ancestors' specifies '*', explicitly allowing any website on the Internet to embed this page in an iframe.",
                    security_impact="Eliminates browser clickjacking defenses, leaving authenticated users vulnerable to UI redressing.",
                    recommendation="Restrict 'frame-ancestors' to trusted domains, ''self'', or ''none''.",
                    safe_example="frame-ancestors 'self';",
                    reference="W3C CSP Level 3 §6.3.1",
                    is_conditional=False,
                )
            )

    # 7. form-action Analysis (Does NOT fall back to default-src!)
    if "form-action" not in explicit_map:
        findings.append(
            CspFinding(
                id="CSP_MISSING_FORM_ACTION",
                title="Missing 'form-action' Directive (Form Hijacking Defense)",
                severity="low",
                confidence="definite",
                directive="form-action",
                evidence=None,
                explanation="'form-action' is omitted. 'form-action' DOES NOT fall back to 'default-src'. It controls the valid endpoints that HTML <form action=\"...\"> elements may submit data to.",
                security_impact="An attacker exploiting HTML injection or modifying the DOM could alter form action targets to exfiltrate submitted form fields or credentials to an external server.",
                recommendation="Explicitly declare 'form-action 'self'' to ensure forms only submit to your own endpoints.",
                safe_example="form-action 'self';",
                reference="W3C CSP Level 3 §6.2.1 (form-action)",
                is_conditional=False,
            )
        )
    else:
        form_act_vals = explicit_map["form-action"].values
        if "*" in form_act_vals:
            findings.append(
                CspFinding(
                    id="CSP_FORM_ACTION_WILDCARD",
                    title="Wildcard (*) Specified in 'form-action'",
                    severity="low",
                    confidence="definite",
                    directive="form-action",
                    evidence=f"form-action {' '.join(form_act_vals)}",
                    explanation="'form-action' allows form submissions to any destination on the Internet (*).",
                    security_impact="Permits forms to submit sensitive user data and credentials to unverified third-party endpoints.",
                    recommendation="Restrict 'form-action' to ''self'' or trusted API endpoints.",
                    safe_example="form-action 'self';",
                    reference="W3C CSP Level 3 §6.2.1",
                    is_conditional=False,
                )
            )

    # 8. connect-src Analysis (APIs, WebSockets, XHR)
    effective_connect = effective_directives.get("connect-src")
    if effective_connect:
        connect_vals = effective_connect.values
        if "*" in connect_vals:
            findings.append(
                CspFinding(
                    id="CSP_CONNECT_SRC_WILDCARD",
                    title="Wildcard (*) Source in 'connect-src'",
                    severity="medium",
                    confidence="definite",
                    directive="connect-src",
                    evidence=f"connect-src {' '.join(connect_vals)}",
                    explanation="'connect-src' permits XMLHttpRequest, fetch(), WebSocket, and EventSource connections to any external domain (*).",
                    security_impact="If an attacker executes script code or leverages an injection flaw, they can freely exfiltrate harvested tokens or session data to any arbitrary endpoint.",
                    recommendation="Restrict 'connect-src' to your application's specific API endpoints and trusted third-party service origins.",
                    safe_example="connect-src 'self' https://api.example.com;",
                    reference="W3C CSP Level 3 §6.1.2 (connect-src)",
                    is_conditional=False,
                )
            )

    # 9. Insecure cleartext HTTP schemes across directives
    for d in directives:
        for val in d.values:
            val_lower = val.lower()
            if val_lower == "http:" or (val_lower.startswith("http://") and not val_lower.startswith("http://localhost")):
                findings.append(
                    CspFinding(
                        id="CSP_INSECURE_HTTP_SCHEME",
                        title=f"Unencrypted HTTP Scheme in '{d.name}' Directive",
                        severity="medium",
                        confidence="definite",
                        directive=d.name,
                        evidence=f"{d.name} {val}",
                        explanation=f"Directive '{d.name}' specifies unencrypted HTTP source '{val}'. Resources fetched over cleartext HTTP are vulnerable to interception and active tampering.",
                        security_impact="Enables adversary-in-the-middle (AITM) attacks to replace resources with malicious payloads or eavesdrop on network traffic.",
                        recommendation=f"Update '{val}' to utilize secure HTTPS transport ('https://...').",
                        safe_example=f"{d.name} https://secure.example.com;",
                        reference="W3C CSP Level 3 §4.2.2",
                        is_conditional=False,
                    )
                )

    # 10. Directive syntax warnings from parse step
    for d in directives:
        for w in d.warnings:
            # Create a dedicated finding for duplicate directives
            if d.is_duplicate and "Duplicate directive" in w:
                findings.append(
                    CspFinding(
                        id="CSP_DUPLICATE_DIRECTIVE",
                        title=f"Duplicate '{d.name}' Directive Declared",
                        severity="low",
                        confidence="definite",
                        directive=d.name,
                        evidence=d.raw_text,
                        explanation=w,
                        security_impact="Duplicate directives create configuration ambiguity and maintenance hazards. Browsers discard subsequent declarations, meaning rules in duplicate blocks are completely ineffective.",
                        recommendation=f"Consolidate all '{d.name}' source expressions into a single directive line.",
                        safe_example=f"{d.name} ...;",
                        reference="W3C CSP Level 3 §4.1",
                        is_conditional=False,
                    )
                )
            elif "Unquoted keyword" in w:
                findings.append(
                    CspFinding(
                        id="CSP_UNQUOTED_KEYWORD_ERROR",
                        title=f"Unquoted Keyword in '{d.name}' Directive",
                        severity="medium",
                        confidence="definite",
                        directive=d.name,
                        evidence=d.raw_text,
                        explanation=w,
                        security_impact="The browser does not treat the unquoted string as a CSP keyword. For example, unquoted 'self' is treated as a host name ('http://self') rather than current origin ('self'), silently breaking intended security restrictions.",
                        recommendation="Wrap all CSP keywords (self, none, unsafe-inline, unsafe-eval, strict-dynamic) in single quotes.",
                        safe_example=f"{d.name} 'self';",
                        reference="W3C CSP Level 3 §4.2.1",
                        is_conditional=False,
                    )
                )
            elif "Contradictory" in w:
                findings.append(
                    CspFinding(
                        id="CSP_CONTRADICTORY_NONE_DIRECTIVE",
                        title=f"Contradictory ''none'' Source in '{d.name}'",
                        severity="low",
                        confidence="definite",
                        directive=d.name,
                        evidence=d.raw_text,
                        explanation=w,
                        security_impact="Directives specifying ''none'' alongside other sources confuse developers and may cause unpredictable fallback behavior across browser engines.",
                        recommendation="If no sources are permitted, specify only ''none''. If sources are required, remove ''none''.",
                        safe_example=f"{d.name} 'none';",
                        reference="W3C CSP Level 3 §6.1",
                        is_conditional=False,
                    )
                )
            elif d.is_unknown and "Unrecognized directive" in w:
                findings.append(
                    CspFinding(
                        id="CSP_UNKNOWN_DIRECTIVE_NOTICE",
                        title=f"Unrecognized Directive '{d.name}'",
                        severity="info",
                        confidence="informational",
                        directive=d.name,
                        evidence=d.raw_text,
                        explanation=w,
                        security_impact="The directive is ignored by standard browsers and provides no defensive benefit in current environments.",
                        recommendation="Verify directive spelling and consult MDN or W3C specifications.",
                        safe_example=None,
                        reference="W3C CSP Level 3",
                        is_conditional=True,
                    )
                )

    # 11. upgrade-insecure-requests check
    has_upgrade_insecure = "upgrade-insecure-requests" in explicit_map
    if not has_upgrade_insecure:
        findings.append(
            CspFinding(
                id="CSP_UPGRADE_INSECURE_REQUESTS_RECOMMENDATION",
                title="Consider Adding 'upgrade-insecure-requests'",
                severity="info",
                confidence="informational",
                directive="upgrade-insecure-requests",
                evidence=None,
                explanation="The 'upgrade-insecure-requests' directive is not present. This directive instructs browsers to treat all insecure URLs (HTTP) as though they were served over HTTPS before fetching.",
                security_impact="Helps prevent mixed-content blocking and eliminates accidental cleartext asset requests.",
                recommendation="Add 'upgrade-insecure-requests;' if your application is fully migrated to HTTPS.",
                safe_example="upgrade-insecure-requests;",
                reference="W3C CSP Level 3 §6.4.1",
                is_conditional=True,
            )
        )

    # Calculate summary flags
    has_unsafe_inline = False
    has_unsafe_eval = False
    has_strict_dynamic = False
    has_nonces_or_hashes = False
    has_wildcard = False

    if effective_script:
        vals_lower = [v.lower() for v in effective_script.values]
        has_unsafe_inline = "'unsafe-inline'" in vals_lower
        has_unsafe_eval = "'unsafe-eval'" in vals_lower
        has_strict_dynamic = "'strict-dynamic'" in vals_lower
        has_nonces_or_hashes = any(NONCE_PATTERN.match(v) or HASH_PATTERN.match(v) for v in effective_script.values)
        has_wildcard = "*" in effective_script.values

    dup_count = sum(1 for d in directives if d.is_duplicate)

    return CspPolicyDetail(
        policy_type=policy_type,
        raw_policy=raw_policy,
        directives=directives,
        effective_directives=effective_directives,
        findings=findings,
        has_unsafe_inline=has_unsafe_inline,
        has_unsafe_eval=has_unsafe_eval,
        has_strict_dynamic=has_strict_dynamic,
        has_nonces_or_hashes=has_nonces_or_hashes,
        has_wildcard=has_wildcard,
        directive_count=len(directives),
        duplicate_count=dup_count,
        findings_count=len(findings),
    )


# ============================================================================
# 3. Quality Scoring & Aggregation
# ============================================================================

def calculate_csp_quality_score(
    policies: List[CspPolicyDetail],
    has_enforcing_policy: bool,
) -> Tuple[int, str]:
    """
    Computes a deterministic, explainable CSP Configuration Quality Score (0-100).
    - Missing enforcing policy: 0 ("None") or max 40 if report-only is present.
    - Base score 100 with deduction for distinct security deficiencies.
    - Bonuses for strict-dynamic, nonces, and restrictive object/base/framing boundaries.
    """
    if not policies:
        return (0, "None")

    if not has_enforcing_policy:
        # Only report-only policies exist
        has_any_policy = any(p.directive_count > 0 for p in policies)
        if has_any_policy:
            return (40, "Weak (Report-Only)")
        return (0, "None")

    # Evaluate the primary enforcing policy
    enforcing_policy = next((p for p in policies if p.policy_type == "enforce"), policies[0])

    score = 100

    # Severity Deductions
    for f in enforcing_policy.findings:
        if f.severity == "critical":
            score -= 25
        elif f.severity == "high":
            score -= 15
        elif f.severity == "medium":
            score -= 8
        elif f.severity == "low":
            score -= 3
        # info findings do not deduct points

    # Positive Architectural Bonuses (only if not severely broken)
    if enforcing_policy.has_strict_dynamic and enforcing_policy.has_nonces_or_hashes:
        score += 10

    effective_obj = enforcing_policy.effective_directives.get("object-src")
    if effective_obj and "'none'" in [v.lower() for v in effective_obj.values]:
        score += 5

    if "base-uri" in [d.name for d in enforcing_policy.directives]:
        score += 5

    if "frame-ancestors" in [d.name for d in enforcing_policy.directives]:
        score += 5

    # Clamp score to [0, 100]
    score = max(0, min(100, score))

    if score >= 90:
        rating = "Excellent"
    elif score >= 75:
        rating = "Good"
    elif score >= 55:
        rating = "Moderate"
    elif score >= 35:
        rating = "Weak"
    else:
        rating = "Inadequate"

    return (score, rating)


# ============================================================================
# 4. Safe Remote HTTP Header Inspection (Mode B)
# ============================================================================

def _safe_fetch_csp_headers(
    target_url: str,
    timeout: float = DEFAULT_READ_TIMEOUT,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
) -> Tuple[str, Optional[int], Optional[float], List[str], List[str], Optional[str]]:
    """
    Safely connects to a remote target over HTTPS, follows redirects (max 5 hops),
    and retrieves Content-Security-Policy and Content-Security-Policy-Report-Only headers.
    Does NOT download response body, crawl, or follow external directive URLs.
    Returns: (status, http_status_code, round_trip_ms, enforce_headers, report_only_headers, error_message)
    """
    if resolver is None:
        resolver = SafeResolver()

    parsed = urlparse(target_url)
    scheme = (parsed.scheme or "").lower()
    if scheme != "https":
        return ("blocked_target", None, None, [], [], "Only secure HTTPS URLs are permitted.")

    host = parsed.hostname
    if not host:
        return ("blocked_target", None, None, [], [], "Invalid target hostname.")

    port = parsed.port or 443
    if port not in ALLOWED_HTTP_PORTS:
        return ("blocked_target", None, None, [], [], f"Disallowed port '{port}'.")

    # SSRF safety check
    try:
        validated_host = validate_hostname(host)
        approved_ips = resolver.resolve(validated_host, port)
        if not approved_ips:
            return ("fetch_error", None, None, [], [], f"DNS resolution failed for {validated_host}.")
    except SSRFValidationError as s_err:
        return ("blocked_target", None, None, [], [], f"SSRF Protection blocked destination: {str(s_err)}")
    except Exception as exc:
        return ("fetch_error", None, None, [], [], f"DNS resolution failed: {str(exc)}")

    timeout_cfg = httpx.Timeout(
        connect=DEFAULT_CONNECT_TIMEOUT,
        read=timeout,
        write=timeout,
        pool=timeout,
    )

    req_headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "*/*",
        "Connection": "close",
    }

    if custom_transport is not None:
        transport = custom_transport
    else:
        backend = SafeSyncBackend(resolver)
        pool = httpcore.ConnectionPool(
            network_backend=backend,
            max_connections=3,
            max_keepalive_connections=0,
        )
        transport = httpx.HTTPTransport()
        transport._pool = pool

    current_url = target_url
    redirect_count = 0
    visited_urls = []

    start_time = time.perf_counter()

    try:
        with httpx.Client(
            transport=transport,
            timeout=timeout_cfg,
            follow_redirects=False,
            headers=req_headers,
            verify=True,
        ) as client:
            while True:
                if current_url in visited_urls:
                    return ("fetch_error", None, None, [], [], "Redirect loop detected.")

                visited_urls.append(current_url)

                req = client.build_request("GET", current_url)
                resp = client._send_single_request(req)

                status_code = resp.status_code

                # Follow redirects manually up to cap
                if status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    resp.close()

                    if not location:
                        return ("fetch_error", status_code, None, [], [], "Redirect without Location header.")

                    redirect_count += 1
                    if redirect_count > MAX_REDIRECTS:
                        return ("fetch_error", status_code, None, [], [], f"Exceeded maximum redirect limit ({MAX_REDIRECTS}).")

                    next_url = urljoin(current_url, location.strip())
                    next_parsed = urlparse(next_url)
                    next_scheme = (next_parsed.scheme or "").lower()

                    if next_scheme != "https":
                        return (
                            "blocked_target",
                            status_code,
                            None,
                            [],
                            [],
                            f"Redirect to unencrypted or disallowed protocol '{next_scheme}' is blocked.",
                        )

                    next_host = next_parsed.hostname
                    if not next_host:
                        return ("blocked_target", status_code, None, [], [], "Invalid redirect hostname.")

                    next_port = next_parsed.port or 443
                    if next_port not in ALLOWED_HTTP_PORTS:
                        return ("blocked_target", status_code, None, [], [], f"Redirect to port {next_port} is disallowed.")

                    # Re-validate next hop against SSRF blocklist
                    try:
                        valid_next = validate_hostname(next_host)
                        next_ips = resolver.resolve(valid_next, next_port)
                        if not next_ips:
                            return ("fetch_error", status_code, None, [], [], f"Could not resolve redirect host {valid_next}.")
                    except SSRFValidationError as e:
                        return ("blocked_target", status_code, None, [], [], f"Redirect target blocked by SSRF filter: {str(e)}")

                    current_url = next_url
                    continue

                # Final response reached: extract CSP headers without consuming body
                round_trip_ms = (time.perf_counter() - start_time) * 1000.0

                try:
                    # In httpx, get_list retrieves multiple headers with the same name
                    enforce_headers = resp.headers.get_list("content-security-policy")
                    report_headers = resp.headers.get_list("content-security-policy-report-only")
                finally:
                    resp.close()

                if not enforce_headers and not report_headers:
                    return ("no_policy_found", status_code, round_trip_ms, [], [], "No Content-Security-Policy headers found on target.")

                return ("success", status_code, round_trip_ms, enforce_headers, report_headers, None)

    except (httpx.ConnectTimeout, httpx.ReadTimeout, httpcore.TimeoutException):
        return ("fetch_error", None, None, [], [], "Connection timed out.")
    except (httpx.ConnectError, httpcore.ConnectError) as conn_err:
        err_msg = str(conn_err)
        if "certificate" in err_msg.lower() or "ssl" in err_msg.lower():
            return ("fetch_error", None, None, [], [], f"TLS certificate validation failed: {err_msg}")
        return ("fetch_error", None, None, [], [], f"Connection error: {err_msg}")
    except Exception as exc:
        logger.error(f"Error fetching headers for {target_url}: {exc}", exc_info=True)
        return ("fetch_error", None, None, [], [], f"Failed to retrieve headers: {str(exc)}")


# ============================================================================
# 5. Core Orchestrator
# ============================================================================

def generate_csp_summary_markdown(
    response: CspPolicyAnalyzeResponse,
) -> str:
    """Generates a clean human-readable Markdown diagnostic report."""
    lines = [
        f"# SiteSecura CSP Policy Analysis Report",
        f"Mode: {response.mode.upper()}",
        f"Status: {response.status.upper()}",
        f"Timestamp: {response.checked_at}",
        f"Duration: {response.duration_ms:.1f} ms",
    ]

    if response.url:
        lines.append(f"Target URL: {response.url}")
    if response.http_status_code:
        lines.append(f"HTTP Status: {response.http_status_code}")

    m = response.metrics
    lines.extend([
        "",
        "## Configuration Quality",
        f"- Quality Score: {m.quality_score}/100 ({m.quality_rating})",
        f"- Enforcing Policies: {m.enforcing_policies_count}",
        f"- Report-Only Policies: {m.report_only_policies_count}",
        f"- Total Explicit Directives: {m.total_directives}",
        f"- Total Findings: {m.total_findings} (Critical: {m.critical_findings_count}, High: {m.high_findings_count}, Medium: {m.medium_findings_count}, Low: {m.low_findings_count}, Info: {m.info_findings_count})",
        "",
        "## Diagnostic Findings",
    ])

    if not response.findings:
        lines.append("No security findings generated.")
    else:
        for f in response.findings:
            lines.append(f"### [{f.severity.upper()}] {f.title} ({f.id})")
            lines.append(f"- Explanation: {f.explanation}")
            lines.append(f"- Security Impact: {f.security_impact}")
            if f.evidence:
                lines.append(f"- Evidence: `{f.evidence}`")
            lines.append(f"- Recommendation: {f.recommendation}")
            if f.safe_example:
                lines.append(f"- Safe Example: `{f.safe_example}`")
            if f.reference:
                lines.append(f"- Reference: {f.reference}")
            lines.append("")

    lines.append("Generated by SiteSecura (https://sitesecura.com/tools/csp-policy-analyzer)")
    return "\n".join(lines)


def execute_csp_policy_analysis_sync(
    request: CspPolicyAnalyzeRequest,
    timeout: float = DEFAULT_READ_TIMEOUT,
    resolver: Optional[BaseResolver] = None,
    custom_transport: Optional[httpx.BaseTransport] = None,
) -> CspPolicyAnalyzeResponse:
    """
    Synchronously executes CSP Policy Analysis for either Mode A (pasted) or Mode B (remote).
    """
    start_time = time.perf_counter()
    now_iso = datetime.now(timezone.utc).isoformat()

    policies: List[CspPolicyDetail] = []
    all_findings: List[CspFinding] = []
    warnings: List[str] = []

    mode = request.mode

    if mode == "paste":
        raw_input = (request.policy or "").strip()
        policy_type = request.policy_type or "enforce"

        if not raw_input:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return CspPolicyAnalyzeResponse(
                mode="paste",
                status="invalid_policy",
                url=None,
                http_status_code=None,
                retrieval_duration_ms=None,
                checked_at=now_iso,
                duration_ms=duration_ms,
                policies=[],
                findings=[],
                metrics=CspPolicyMetrics(
                    total_policies=0,
                    enforcing_policies_count=0,
                    report_only_policies_count=0,
                    total_directives=0,
                    total_findings=0,
                    critical_findings_count=0,
                    high_findings_count=0,
                    medium_findings_count=0,
                    low_findings_count=0,
                    info_findings_count=0,
                    quality_score=0,
                    quality_rating="None",
                ),
                summary_markdown=None,
                error_message="Pasted CSP policy text cannot be empty.",
                warnings=["Please provide a valid Content-Security-Policy header string."],
            )

        policy_detail = analyze_single_csp_policy(raw_input, policy_type=policy_type)
        policies.append(policy_detail)
        all_findings.extend(policy_detail.findings)

        status = "success"
        target_url = None
        http_status = None
        rt_ms = None
        error_msg = None

    else:
        # Mode B: Remote website inspection
        target_url = request.url
        if not target_url:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return CspPolicyAnalyzeResponse(
                mode="remote",
                status="invalid_policy",
                url=None,
                http_status_code=None,
                retrieval_duration_ms=None,
                checked_at=now_iso,
                duration_ms=duration_ms,
                policies=[],
                findings=[],
                metrics=CspPolicyMetrics(
                    total_policies=0,
                    enforcing_policies_count=0,
                    report_only_policies_count=0,
                    total_directives=0,
                    total_findings=0,
                    critical_findings_count=0,
                    high_findings_count=0,
                    medium_findings_count=0,
                    low_findings_count=0,
                    info_findings_count=0,
                    quality_score=0,
                    quality_rating="None",
                ),
                summary_markdown=None,
                error_message="A target website URL is required for remote inspection.",
                warnings=["Missing target URL."],
            )

        (
            ret_status,
            http_status,
            rt_ms,
            enforce_headers,
            report_headers,
            err_msg,
        ) = _safe_fetch_csp_headers(
            target_url=target_url,
            timeout=timeout,
            resolver=resolver,
            custom_transport=custom_transport,
        )

        error_msg = err_msg

        if ret_status == "success":
            status = "success"
            # Parse all enforcing headers
            for enf_val in enforce_headers:
                p_detail = analyze_single_csp_policy(enf_val, policy_type="enforce")
                policies.append(p_detail)
                all_findings.extend(p_detail.findings)

            # Parse all report-only headers
            for rep_val in report_headers:
                p_detail = analyze_single_csp_policy(rep_val, policy_type="report_only")
                policies.append(p_detail)
                all_findings.extend(p_detail.findings)

        elif ret_status == "no_policy_found":
            status = "no_policy_found"
            # Emit standard missing policy finding
            all_findings.append(
                CspFinding(
                    id="CSP_NO_HEADER_PRESENT",
                    title="No Content-Security-Policy Header Found",
                    severity="high",
                    confidence="definite",
                    directive=None,
                    evidence=None,
                    explanation=f"The server at {target_url} (HTTP {http_status or 200}) did not return any Content-Security-Policy or Content-Security-Policy-Report-Only headers.",
                    security_impact="The website operates without Content Security Policy protection, leaving browsers reliant solely on built-in origin defenses.",
                    recommendation="Deploy a Content-Security-Policy header. Start in Report-Only mode on staging, monitor violations, and enforce in production.",
                    safe_example="Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self';",
                    reference="W3C CSP Level 3 §3.1",
                    is_conditional=False,
                )
            )

        elif ret_status == "blocked_target":
            status = "blocked_target"
            warnings.append(f"Inspection blocked by security policy: {err_msg}")
        else:
            status = "fetch_error"
            warnings.append(f"Network inspection error: {err_msg}")

    # Sort aggregated findings by severity priority
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    all_findings.sort(key=lambda f: severity_order.get(f.severity, 5))

    # Metrics calculation
    enforce_count = sum(1 for p in policies if p.policy_type == "enforce")
    report_count = sum(1 for p in policies if p.policy_type == "report_only")
    total_directives = sum(p.directive_count for p in policies)

    crit_cnt = sum(1 for f in all_findings if f.severity == "critical")
    high_cnt = sum(1 for f in all_findings if f.severity == "high")
    med_cnt = sum(1 for f in all_findings if f.severity == "medium")
    low_cnt = sum(1 for f in all_findings if f.severity == "low")
    info_cnt = sum(1 for f in all_findings if f.severity == "info")

    quality_score, quality_rating = calculate_csp_quality_score(
        policies=policies,
        has_enforcing_policy=(enforce_count > 0),
    )

    metrics = CspPolicyMetrics(
        total_policies=len(policies),
        enforcing_policies_count=enforce_count,
        report_only_policies_count=report_count,
        total_directives=total_directives,
        total_findings=len(all_findings),
        critical_findings_count=crit_cnt,
        high_findings_count=high_cnt,
        medium_findings_count=med_cnt,
        low_findings_count=low_cnt,
        info_findings_count=info_cnt,
        quality_score=quality_score,
        quality_rating=quality_rating,
    )

    duration_ms = (time.perf_counter() - start_time) * 1000.0

    resp = CspPolicyAnalyzeResponse(
        mode=mode,
        status=status,
        url=target_url,
        http_status_code=http_status,
        retrieval_duration_ms=rt_ms,
        checked_at=now_iso,
        duration_ms=duration_ms,
        policies=policies,
        findings=all_findings,
        metrics=metrics,
        summary_markdown=None,
        error_message=error_msg,
        warnings=warnings,
    )

    resp.summary_markdown = generate_csp_summary_markdown(resp)
    return resp


async def execute_csp_policy_analysis(
    request: CspPolicyAnalyzeRequest,
    timeout: float = DEFAULT_READ_TIMEOUT,
) -> CspPolicyAnalyzeResponse:
    """Async wrapper around execute_csp_policy_analysis_sync."""
    import asyncio
    return await asyncio.to_thread(execute_csp_policy_analysis_sync, request, timeout)
