"""
Scanly Scanner Engine - Deep Scan Advanced Email Security Analysis
Deep inspection of SPF (mechanisms, qualifiers, 10-lookup RFC 7208 limit, multiple record detection)
and DMARC (policy modes, subdomain policy, enforcement percentage, alignment, and aggregate reporting endpoints).
"""
import re
from typing import Dict, Any, List, Optional, Tuple
import dns.resolver
from scanner.models import Finding, CheckStatus, Severity
from scanner.domain import normalize_domain
from .dns import _create_dns_resolver


LOOKUP_MECHANISMS = ("include:", "a", "a:", "mx", "mx:", "ptr", "ptr:", "exists:", "redirect=")


def parse_spf_record(spf_text: str) -> Dict[str, Any]:
    """Parses raw SPF record into structured mechanisms, qualifier, and DNS lookup counter."""
    tokens = [t.strip() for t in spf_text.split() if t.strip()]
    mechanisms: List[str] = []
    qualifier = None
    lookup_count = 0
    redirect_target = None

    for token in tokens:
        lower_token = token.lower()
        if lower_token == "v=spf1":
            continue

        # Check for terminal "all"
        if lower_token.endswith("all"):
            qualifier = token
            continue

        # Check for redirect
        if lower_token.startswith("redirect="):
            redirect_target = token.split("=")[1]
            lookup_count += 1
            mechanisms.append(token)
            continue

        # Count DNS lookup mechanisms according to RFC 7208 Section 4.6.4
        for prefix in LOOKUP_MECHANISMS:
            if lower_token == prefix or lower_token.startswith(prefix):
                lookup_count += 1
                break

        mechanisms.append(token)

    return {
        "raw": spf_text,
        "is_valid": True,
        "all_qualifier": qualifier,
        "mechanisms": mechanisms,
        "lookup_count": lookup_count,
        "lookup_count_exceeded": lookup_count > 10,
        "redirect_target": redirect_target,
    }


def parse_dmarc_record(dmarc_text: str) -> Dict[str, Any]:
    """Parses raw DMARC record into structured tags and policies."""
    tags: Dict[str, str] = {}
    parts = dmarc_text.split(";")
    for part in parts:
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            tags[k.strip().lower()] = v.strip()

    rua_list = [u.strip() for u in tags.get("rua", "").split(",") if u.strip()]
    ruf_list = [u.strip() for u in tags.get("ruf", "").split(",") if u.strip()]

    try:
        pct = int(tags.get("pct", 100))
    except ValueError:
        pct = 100

    return {
        "raw": dmarc_text,
        "is_present": True,
        "policy": tags.get("p", "none").lower(),
        "subdomain_policy": tags.get("sp", "").lower() or None,
        "percentage": pct,
        "adkim": tags.get("adkim", "r").lower(),
        "aspf": tags.get("aspf", "r").lower(),
        "rua": rua_list,
        "ruf": ruf_list,
        "tags": tags,
    }


def analyze_deep_email_security(
    domain: str,
    timeout_seconds: float = 2.0,
    nameservers: Optional[List[str]] = None,
) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Performs deep analysis of SPF and DMARC configurations for target domain.
    Returns (email_security_data, findings).
    Strictly follows anti-double-counting rules and never raises uncaught exceptions.
    """
    norm_domain = normalize_domain(domain)
    findings: List[Finding] = []

    email_data: Dict[str, Any] = {
        "domain": norm_domain,
        "spf": {
            "is_present": False,
            "raw": None,
            "all_qualifier": None,
            "mechanisms": [],
            "lookup_count": 0,
            "lookup_count_exceeded": False,
            "has_multiple_records": False,
        },
        "dmarc": {
            "is_present": False,
            "raw": None,
            "policy": None,
            "subdomain_policy": None,
            "percentage": 100,
            "rua": [],
            "ruf": [],
            "adkim": "r",
            "aspf": "r",
        },
        "error": None,
    }

    resolver = _create_dns_resolver(timeout_seconds, nameservers)

    # 1. SPF Record Resolution
    raw_spf_records: List[str] = []
    try:
        answers = resolver.resolve(norm_domain, "TXT")
        for r in answers:
            txt_val = "".join([s.decode("utf-8", errors="ignore") if isinstance(s, bytes) else str(s) for s in r.strings])
            if txt_val.strip().startswith("v=spf1"):
                raw_spf_records.append(txt_val.strip())
    except Exception:
        pass

    # 2. DMARC Record Resolution (_dmarc.<domain>)
    dmarc_domain = f"_dmarc.{norm_domain}"
    raw_dmarc_records: List[str] = []
    try:
        answers = resolver.resolve(dmarc_domain, "TXT")
        for r in answers:
            txt_val = "".join([s.decode("utf-8", errors="ignore") if isinstance(s, bytes) else str(s) for s in r.strings])
            if txt_val.strip().startswith("v=DMARC1"):
                raw_dmarc_records.append(txt_val.strip())
    except Exception:
        pass

    # =========================================================
    # Evaluate SPF
    # =========================================================
    if len(raw_spf_records) > 1:
        email_data["spf"]["is_present"] = True
        email_data["spf"]["has_multiple_records"] = True
        email_data["spf"]["raw"] = " | ".join(raw_spf_records)
        findings.append(
            Finding(
                check_type="deep_spf_multiple_records",
                name="Multiple SPF Records (PermError)",
                status=CheckStatus.CRITICAL,
                severity=Severity.HIGH,
                score_impact=-10,
                title="Multiple SPF Records Detected",
                summary=f"Domain publishes {len(raw_spf_records)} SPF records. RFC 7208 Section 3.2 prohibits multiple SPF records, causing receiving mail servers to return a permanent authentication error (PermError).",
                why_it_matters="When multiple SPF records exist, major mail providers (Gmail, Outlook) may reject or mark all incoming emails from your domain as spam.",
                how_to_fix="Consolidate all authorized sending hosts into a single 'v=spf1 ...' TXT record in your DNS zone.",
                estimated_fix_minutes=15,
                documentation_url="https://datatracker.ietf.org/doc/html/rfc7208#section-3.2",
                evidence="\n".join([f"Record {i+1}: {r}" for i, r in enumerate(raw_spf_records)]),
            )
        )
    elif len(raw_spf_records) == 1:
        parsed_spf = parse_spf_record(raw_spf_records[0])
        email_data["spf"] = parsed_spf
        email_data["spf"]["is_present"] = True
        email_data["spf"]["has_multiple_records"] = False

        all_q = (parsed_spf["all_qualifier"] or "").lower()

        # Check lookup count limit
        if parsed_spf["lookup_count_exceeded"]:
            findings.append(
                Finding(
                    check_type="deep_spf_lookup_limit",
                    name="SPF DNS Lookup Limit Exceeded",
                    status=CheckStatus.WARNING,
                    severity=Severity.MEDIUM,
                    score_impact=-5,
                    title=f"SPF Record Exceeds 10 DNS Lookup Limit ({parsed_spf['lookup_count']})",
                    summary=f"SPF record triggers {parsed_spf['lookup_count']} DNS lookups. RFC 7208 mandates a strict maximum of 10 lookups. Excess lookups cause PermError evaluation failures.",
                    why_it_matters="Mail servers abandon SPF evaluation and flag messages as unauthenticated when the 10-lookup ceiling is breached.",
                    how_to_fix="Flatten your SPF record using direct IP subnets (`ip4:`/`ip6:`) or remove redundant `include:` mechanisms.",
                    estimated_fix_minutes=25,
                    documentation_url="https://datatracker.ietf.org/doc/html/rfc7208#section-4.6.4",
                    evidence=f"Total lookups: {parsed_spf['lookup_count']} | Mechanisms: {', '.join(parsed_spf['mechanisms'])}",
                )
            )

        # Check all mechanism qualifiers
        if all_q in ("-all",):
            findings.append(
                Finding(
                    check_type="deep_spf_policy",
                    name="Enforcing SPF HardFail (-all)",
                    status=CheckStatus.PASS,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="Strict SPF Policy Active (-all)",
                    summary="SPF record specifies hard fail (-all), instructing mail servers to reject all unauthorized sending servers.",
                    why_it_matters="Hard fail provides the highest level of SPF protection against forged sender headers.",
                    how_to_fix="Maintain strict SPF mechanism declarations.",
                    estimated_fix_minutes=0,
                    documentation_url="https://datatracker.ietf.org/doc/html/rfc7208",
                    evidence=raw_spf_records[0],
                )
            )
        elif all_q in ("~all",):
            findings.append(
                Finding(
                    check_type="deep_spf_policy",
                    name="SPF SoftFail Policy (~all)",
                    status=CheckStatus.PASS,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="SPF SoftFail Policy Active (~all)",
                    summary="SPF record specifies soft fail (~all). Unauthorized sending servers are accepted with soft failure flags, optimal when paired with DMARC.",
                    why_it_matters="Softfail allows legitimate third-party mail forwarders to pass through without false positive rejection when DMARC handles authentication.",
                    how_to_fix="Maintain SPF with accompanying DMARC quarantine/reject policy.",
                    estimated_fix_minutes=0,
                    documentation_url="https://datatracker.ietf.org/doc/html/rfc7208",
                    evidence=raw_spf_records[0],
                )
            )
        elif all_q in ("?all",):
            findings.append(
                Finding(
                    check_type="deep_spf_policy",
                    name="Neutral SPF Policy (?all)",
                    status=CheckStatus.WARNING,
                    severity=Severity.MEDIUM,
                    score_impact=-5,
                    title="Neutral SPF Policy (?all) Provides No Protection",
                    summary="SPF record terminates with '?all' (neutral). The domain explicitly states that no definitive policy exists for unauthorized senders.",
                    why_it_matters="Neutral SPF does not protect against domain spoofing or phishing impersonation.",
                    how_to_fix="Upgrade your terminal mechanism from '?all' to '~all' or '-all'.",
                    estimated_fix_minutes=10,
                    documentation_url="https://datatracker.ietf.org/doc/html/rfc7208",
                    evidence=raw_spf_records[0],
                )
            )
        elif all_q in ("+all", "all"):
            findings.append(
                Finding(
                    check_type="deep_spf_policy",
                    name="Dangerous SPF Policy (+all)",
                    status=CheckStatus.CRITICAL,
                    severity=Severity.HIGH,
                    score_impact=-15,
                    title="Dangerous SPF Pass-All Policy (+all)",
                    summary="SPF record specifies '+all' (pass all). This explicitly authorizes EVERY server on the entire internet to send email pretending to be your domain!",
                    why_it_matters="Attackers can send phishing emails that pass SPF validation unconditionally.",
                    how_to_fix="Replace '+all' with '~all' or '-all' immediately.",
                    estimated_fix_minutes=5,
                    documentation_url="https://datatracker.ietf.org/doc/html/rfc7208",
                    evidence=raw_spf_records[0],
                )
            )
        else:
            findings.append(
                Finding(
                    check_type="deep_spf_policy",
                    name="SPF Missing Terminal Mechanism",
                    status=CheckStatus.WARNING,
                    severity=Severity.LOW,
                    score_impact=-3,
                    title="SPF Record Missing Terminal 'all' Qualifier",
                    summary="SPF record does not conclude with an explicit 'all' qualifier (e.g. ~all or -all). Default behavior is ambiguous.",
                    why_it_matters="Without an explicit terminal policy, mail providers may apply varying fallback rules to unlisted senders.",
                    how_to_fix="Append '~all' or '-all' to your SPF record.",
                    estimated_fix_minutes=5,
                    documentation_url="https://datatracker.ietf.org/doc/html/rfc7208",
                    evidence=raw_spf_records[0],
                )
            )
    else:
        findings.append(
            Finding(
                check_type="deep_spf_missing",
                name="Missing SPF Record",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-7,
                title="Missing Sender Policy Framework (SPF) Record",
                summary="No SPF (v=spf1) record was detected in DNS. Anyone can send emails claiming to originate from your domain without failing authentication.",
                why_it_matters="Without SPF, your domain reputation is vulnerable to email spoofing, BEC (business email compromise), and spam abuse.",
                how_to_fix="Add a DNS TXT record with your authorized mail services (e.g., `v=spf1 include:_spf.google.com ~all`).",
                estimated_fix_minutes=15,
                documentation_url="https://datatracker.ietf.org/doc/html/rfc7208",
                evidence="No 'v=spf1' record returned in DNS TXT responses.",
            )
        )

    # =========================================================
    # Evaluate DMARC
    # =========================================================
    if raw_dmarc_records:
        parsed_dmarc = parse_dmarc_record(raw_dmarc_records[0])
        email_data["dmarc"] = parsed_dmarc
        email_data["dmarc"]["is_present"] = True

        policy = parsed_dmarc["policy"]
        pct = parsed_dmarc["percentage"]
        rua = parsed_dmarc["rua"]

        if policy in ("reject", "quarantine"):
            if pct == 100:
                findings.append(
                    Finding(
                        check_type="deep_dmarc_policy",
                        name="Enforcing DMARC Policy Active",
                        status=CheckStatus.PASS,
                        severity=Severity.INFO,
                        score_impact=0,
                        title=f"Enforcing DMARC Policy Active (p={policy})",
                        summary=f"DMARC policy instructs receiving mail servers to {policy} 100% of unauthenticated emails.",
                        why_it_matters="Active DMARC enforcement blocks phishing and email impersonation attacks targeting your customers and team.",
                        how_to_fix="Maintain regular monitoring of aggregate reports.",
                        estimated_fix_minutes=0,
                        documentation_url="https://dmarc.org/overview/",
                        evidence=raw_dmarc_records[0],
                    )
                )
            else:
                findings.append(
                    Finding(
                        check_type="deep_dmarc_policy",
                        name="Partial DMARC Enforcement",
                        status=CheckStatus.WARNING,
                        severity=Severity.LOW,
                        score_impact=-2,
                        title=f"Partial DMARC Enforcement (p={policy}, pct={pct}%)",
                        summary=f"DMARC policy is set to {policy}, but applies to only {pct}% of incoming mail. The remaining {100-pct}% of messages bypass enforcement.",
                        why_it_matters="Partial enforcement leaves an opening for attackers to spoof emails that happen to fall outside the percentage window.",
                        how_to_fix="Increase the 'pct' tag to 100 once authentication alignment is verified.",
                        estimated_fix_minutes=10,
                        documentation_url="https://dmarc.org/overview/",
                        evidence=raw_dmarc_records[0],
                    )
                )
        else:
            findings.append(
                Finding(
                    check_type="deep_dmarc_policy",
                    name="Monitoring-Only DMARC Policy (p=none)",
                    status=CheckStatus.WARNING,
                    severity=Severity.LOW,
                    score_impact=-4,
                    title="Permissive DMARC Policy Active (p=none)",
                    summary="DMARC is published with policy 'p=none'. Unauthenticated or fraudulent emails are monitored but NOT blocked by mail servers.",
                    why_it_matters="While p=none is an appropriate starting phase for telemetry, it provides zero active protection against domain spoofing.",
                    how_to_fix="Review your DMARC aggregate reports and graduate your policy to 'p=quarantine' or 'p=reject'.",
                    estimated_fix_minutes=20,
                    documentation_url="https://dmarc.org/overview/",
                    evidence=raw_dmarc_records[0],
                )
            )

        # Reporting check
        if not rua:
            findings.append(
                Finding(
                    check_type="deep_dmarc_reporting",
                    name="DMARC Aggregate Reports Missing",
                    status=CheckStatus.INFO,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="DMARC Aggregate Reporting (rua) Not Configured",
                    summary="DMARC record does not designate a reporting mailbox (`rua=mailto:...`) to receive XML feedback reports.",
                    why_it_matters="Without aggregate reports, you lack visibility into who is sending email on behalf of your domain or failing authentication.",
                    how_to_fix="Add an `rua=mailto:dmarc-reports@yourdomain.com` tag to your DMARC record.",
                    estimated_fix_minutes=10,
                    documentation_url="https://dmarc.org/overview/",
                    evidence=raw_dmarc_records[0],
                )
            )
    else:
        findings.append(
            Finding(
                check_type="deep_dmarc_missing",
                name="Missing DMARC Policy",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-8,
                title="Missing DMARC Policy Record",
                summary=f"No DMARC TXT record was found at {dmarc_domain}.",
                why_it_matters="Without DMARC, receiving email servers cannot verify sender legitimacy against SPF/DKIM alignment, enabling domain spoofing.",
                how_to_fix=f"Publish a DMARC TXT record at {dmarc_domain} (e.g. `v=DMARC1; p=quarantine; rua=mailto:dmarc@{norm_domain}`).",
                estimated_fix_minutes=15,
                documentation_url="https://dmarc.org/overview/",
                evidence=f"No TXT record found at {dmarc_domain}",
            )
        )

    # 3. Informative DKIM Guidance
    findings.append(
        Finding(
            check_type="deep_dkim_selector_info",
            name="DKIM Cryptographic Verification",
            status=CheckStatus.UNKNOWN,
            severity=Severity.INFO,
            score_impact=0,
            title="DKIM Requires Provider-Specific Selector",
            summary="Passive scanners cannot query DKIM public keys without knowing your provider selector (e.g. `s1._domainkey` or `google._domainkey`).",
            why_it_matters="DKIM provides cryptographic signature verification for email contents, preventing transit tampering.",
            how_to_fix="Verify DKIM is enabled in your email provider console (Google Workspace, Microsoft 365, Mailgun, etc.).",
            estimated_fix_minutes=10,
            documentation_url="https://www.sparkpost.com/resources/email-explained/dkim-domainkeys-identified-mail/",
            evidence="Passive scan cannot enumerate private provider selectors.",
        )
    )

    return email_data, findings
