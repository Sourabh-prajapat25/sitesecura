"""
Scanly Scanner Engine - Deep Scan Advanced Semantic CSP Analysis
Deconstructs and semantically audits Content Security Policy (CSP) directives:
- Directive parsing and source dictionary mapping
- Detection of unsafe directives ('unsafe-inline', 'unsafe-eval')
- Nonce and hash recognition (CSP Level 3 override awareness)
- Wildcard (*) and cleartext (http:) source identification
- Restriction audits for object-src, base-uri, and frame-ancestors
- Anti-double-counting protection (suppresses sub-findings if CSP is completely missing)
"""
import re
from typing import Dict, Any, List, Optional, Tuple, Set
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage


NONCE_PATTERN = re.compile(r"^'nonce-[a-zA-Z0-9+/=_-]+'$", re.IGNORECASE)
HASH_PATTERN = re.compile(r"^'(sha256|sha384|sha512)-[a-zA-Z0-9+/=_-]+'$", re.IGNORECASE)


def parse_csp_directives(csp_text: str) -> Dict[str, List[str]]:
    """Splits raw CSP header into a dictionary of directive names and their list of source expressions."""
    directives: Dict[str, List[str]] = {}
    tokens = csp_text.split(";")
    for raw_dir in tokens:
        raw_dir = raw_dir.strip()
        if not raw_dir:
            continue
        parts = raw_dir.split()
        if parts:
            dir_name = parts[0].lower()
            dir_sources = parts[1:]
            directives[dir_name] = dir_sources
    return directives


def analyze_deep_csp(crawled_pages: List[CrawledPage]) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Performs semantic evaluation of Content Security Policy across crawled pages.
    Returns (csp_data, findings).
    Anti-double-counting: If CSP is missing across all pages, returns empty findings
    (since multi-page header consistency audit already reported deep_csp_missing).
    """
    findings: List[Finding] = []
    csp_data: Dict[str, Any] = {
        "is_present": False,
        "raw_header": None,
        "directives": {},
        "has_unsafe_inline": False,
        "has_unsafe_eval": False,
        "has_wildcards": False,
        "has_nonces_or_hashes": False,
        "status": "missing",
    }

    raw_csp = None
    for p in crawled_pages:
        if p.status_code and p.status_code < 400:
            norm_headers = {k.lower(): v for k, v in p.headers.items()}
            val = norm_headers.get("content-security-policy")
            if val and val.strip():
                raw_csp = val.strip()
                break

    # If missing everywhere, suppress redundant sub-findings
    if not raw_csp:
        return csp_data, findings

    directives = parse_csp_directives(raw_csp)
    csp_data["is_present"] = True
    csp_data["raw_header"] = raw_csp
    csp_data["directives"] = directives

    # Determine effective script sources (script-src fallback to default-src)
    script_sources = directives.get("script-src", directives.get("default-src", []))
    default_sources = directives.get("default-src", [])
    object_sources = directives.get("object-src", directives.get("default-src", []))

    # Detect nonces or hashes in script sources
    has_nonces = any(NONCE_PATTERN.match(s) or HASH_PATTERN.match(s) for s in script_sources)
    has_strict_dynamic = "'strict-dynamic'" in [s.lower() for s in script_sources]
    csp_data["has_nonces_or_hashes"] = has_nonces or has_strict_dynamic

    # 1. 'unsafe-inline' Check
    has_inline = any(s.lower() == "'unsafe-inline'" for s in script_sources)
    csp_data["has_unsafe_inline"] = has_inline

    if has_inline and not (has_nonces or has_strict_dynamic):
        findings.append(
            Finding(
                check_type="deep_csp_unsafe_inline",
                name="CSP Allows 'unsafe-inline'",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-6,
                title="CSP Enables 'unsafe-inline' Script Execution",
                summary="Content Security Policy allows `'unsafe-inline'` scripts without nonces or cryptographic hashes, permitting inline script execution.",
                why_it_matters="The primary purpose of CSP is defeating Cross-Site Scripting (XSS). Allowing `'unsafe-inline'` eliminates browser protection against injected script tags and event handlers.",
                how_to_fix="Remove `'unsafe-inline'` and adopt cryptographic nonces (`'nonce-...'`) or SHA hashes for legitimate inline scripts.",
                estimated_fix_minutes=30,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src",
                evidence=f"script-src: {' '.join(script_sources)}",
            )
        )

    # 2. 'unsafe-eval' Check
    has_eval = any(s.lower() == "'unsafe-eval'" for s in script_sources)
    csp_data["has_unsafe_eval"] = has_eval
    if has_eval:
        findings.append(
            Finding(
                check_type="deep_csp_unsafe_eval",
                name="CSP Allows 'unsafe-eval'",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="CSP Permits 'unsafe-eval' Execution",
                summary="Content Security Policy includes `'unsafe-eval'`, permitting the execution of strings as code via `eval()`, `setTimeout()`, and `Function()` constructors.",
                why_it_matters="Allowing eval increases vulnerability to DOM-based code execution if untrusted user input reaches dynamic execution sinks.",
                how_to_fix="Refactor code and client libraries to avoid `eval()` and remove `'unsafe-eval'` from script-src.",
                estimated_fix_minutes=25,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src",
                evidence=f"script-src: {' '.join(script_sources)}",
            )
        )

    # 3. Wildcard or Cleartext Sources Check
    sensitive_directives = ["script-src", "default-src", "connect-src", "object-src"]
    wildcard_dirs = []
    for d_name in sensitive_directives:
        sources = directives.get(d_name, [])
        for src in sources:
            if src == "*" or src.startswith("http:"):
                wildcard_dirs.append(f"{d_name} ({src})")
                break

    if wildcard_dirs:
        csp_data["has_wildcards"] = True
        findings.append(
            Finding(
                check_type="deep_csp_wildcard",
                name="CSP Permissive Wildcard Sources",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-3,
                title="Permissive Wildcard or Cleartext Sources in CSP",
                summary=f"Sensitive CSP directives include overly permissive wildcard sources or unencrypted protocols: {', '.join(wildcard_dirs)}.",
                why_it_matters="Wildcard sources (`*`) allow loading executable resources from any internet domain, weakening origin isolation.",
                how_to_fix="Replace `*` and `http:` with specific, trusted domain origins (e.g. `https://cdn.example.com`).",
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy",
                evidence=f"Permissive directives: {', '.join(wildcard_dirs)}",
            )
        )

    # 4. object-src Restriction Check (Legacy plugins: Flash/Java)
    object_restricted = any(s.lower() in ("'none'", "none") for s in object_sources)
    if not object_restricted and "'none'" not in [s.lower() for s in default_sources]:
        findings.append(
            Finding(
                check_type="deep_csp_missing_object_src",
                name="CSP object-src Not Restricted",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-2,
                title="object-src Directive Not Restricted to 'none'",
                summary="Content Security Policy does not explicitly restrict plugin execution via `object-src 'none'`.",
                why_it_matters="Restricting `object-src 'none'` prevents malicious injection of legacy Flash, Java, or ActiveX objects.",
                how_to_fix="Add `object-src 'none';` to your Content-Security-Policy header.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/object-src",
                evidence=f"object-src: {' '.join(object_sources) if object_sources else 'Not defined'}",
            )
        )

    # 5. base-uri Restriction Check
    if "base-uri" not in directives:
        findings.append(
            Finding(
                check_type="deep_csp_missing_base_uri",
                name="CSP base-uri Not Restricted",
                status=CheckStatus.INFO,
                severity=Severity.LOW,
                score_impact=-1,
                title="base-uri Directive Not Restricted",
                summary="Content Security Policy does not define `base-uri`. The HTML `<base>` tag could theoretically be altered to hijack relative URL resolution.",
                why_it_matters="Restricting `base-uri 'self'` prevents attackers from re-targeting relative script and stylesheet paths.",
                how_to_fix="Add `base-uri 'self';` to your Content-Security-Policy header.",
                estimated_fix_minutes=5,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/base-uri",
                evidence="base-uri directive missing in CSP.",
            )
        )

    # 6. Overall Positive Assessment
    if not has_inline and not has_eval and not csp_data["has_wildcards"] and object_restricted:
        csp_data["status"] = "robust"
        findings.append(
            Finding(
                check_type="deep_csp_robust",
                name="Robust Content Security Policy",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Robust Content Security Policy Defined",
                summary="CSP strictly regulates script execution without unsafe-inline, unsafe-eval, or wildcards, effectively mitigating XSS risks.",
                why_it_matters="A strict CSP is the web's gold standard defense against client-side script injection and data exfiltration.",
                how_to_fix="Maintain existing policy and audit external source domains periodically.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy",
                evidence=raw_csp,
            )
        )
    elif len(directives) > 0:
        csp_data["status"] = "moderate"

    return csp_data, findings
