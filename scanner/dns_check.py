"""
Scanly Scanner Engine - DNS & Email Security Check Module
Queries DNS records (A, AAAA, MX, TXT, NS) and evaluates email security postures (SPF, DMARC, DKIM info, DNSSEC).
"""
from typing import Dict, Any, List, Optional
import dns.resolver
import dns.dnssec
from .models import Finding, CheckStatus, Severity
from .recommendations import get_recommendation
from .domain import normalize_domain


def check_dns_email_security(domain: str, timeout_seconds: float = 2.0) -> Dict[str, Any]:
    """
    Executes DNS lookups for domain:
    - A and AAAA records
    - MX (Mail Exchanger) records
    - TXT records (SPF verification)
    - NS records
    - DMARC (_dmarc.<domain>) policy verification
    - DNSSEC existence
    - DKIM informational guidance (marked UNKNOWN without selector)
    """
    findings: List[Finding] = []
    norm_domain = normalize_domain(domain)

    dns_data: Dict[str, Any] = {
        "a_records": [],
        "aaaa_records": [],
        "mx_records": [],
        "txt_records": [],
        "ns_records": [],
        "spf_record": None,
        "dmarc_record": None,
        "dmarc_policy": None,
        "dnssec_enabled": False,
    }

    resolver = dns.resolver.Resolver()
    # Provide reliable public fallbacks if default nameservers contain unroutable/dead interfaces
    if not resolver.nameservers or any(ns.startswith("127.") for ns in resolver.nameservers):
        resolver.nameservers = ["1.1.1.1", "8.8.8.8"]
    else:
        for pub in ["1.1.1.1", "8.8.8.8"]:
            if pub not in resolver.nameservers:
                resolver.nameservers.append(pub)
    resolver.timeout = min(timeout_seconds, 1.0)
    resolver.lifetime = max(timeout_seconds, 2.5)

    # 1. Query A Records
    try:
        answers = resolver.resolve(norm_domain, "A")
        dns_data["a_records"] = [r.to_text() for r in answers]
    except Exception:
        pass

    # 2. Query AAAA Records
    try:
        answers = resolver.resolve(norm_domain, "AAAA")
        dns_data["aaaa_records"] = [r.to_text() for r in answers]
    except Exception:
        pass

    # 3. Query NS Records
    try:
        answers = resolver.resolve(norm_domain, "NS")
        dns_data["ns_records"] = [r.to_text().rstrip(".") for r in answers]
    except Exception:
        pass

    # 4. Query MX Records
    try:
        answers = resolver.resolve(norm_domain, "MX")
        dns_data["mx_records"] = [r.exchange.to_text().rstrip(".") for r in answers]
    except Exception:
        pass

    # 5. Query TXT Records & Detect SPF
    try:
        answers = resolver.resolve(norm_domain, "TXT")
        for r in answers:
            txt_val = "".join([s.decode("utf-8", errors="ignore") if isinstance(s, bytes) else str(s) for s in r.strings])
            dns_data["txt_records"].append(txt_val)
            if txt_val.startswith("v=spf1"):
                dns_data["spf_record"] = txt_val
    except Exception:
        pass

    # Evaluate SPF
    if dns_data["spf_record"]:
        rec = get_recommendation("spf_present")
        findings.append(
            Finding(
                check_type="spf_record",
                name="SPF Record Configured",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Sender Policy Framework (SPF) Configured",
                summary="A valid SPF record is published in DNS.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=0,
                documentation_url=rec["documentation_url"],
                evidence=dns_data["spf_record"],
            )
        )
    else:
        rec = get_recommendation("spf_missing")
        findings.append(
            Finding(
                check_type="spf_record",
                name="Missing SPF Record",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-7,
                title=rec["title"],
                summary="No SPF record (v=spf1) was detected for this domain.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence="No 'v=spf1' record found in DNS TXT responses.",
            )
        )

    # 6. Query DMARC Policy (_dmarc.<domain>)
    dmarc_domain = f"_dmarc.{norm_domain}"
    try:
        dmarc_answers = resolver.resolve(dmarc_domain, "TXT")
        for r in dmarc_answers:
            dmarc_txt = "".join([s.decode("utf-8", errors="ignore") if isinstance(s, bytes) else str(s) for s in r.strings])
            if dmarc_txt.startswith("v=DMARC1"):
                dns_data["dmarc_record"] = dmarc_txt
                # Extract policy (p=none, p=quarantine, p=reject)
                for part in dmarc_txt.split(";"):
                    part = part.strip()
                    if part.startswith("p="):
                        dns_data["dmarc_policy"] = part.split("=")[1].strip()
    except Exception:
        pass

    # Evaluate DMARC
    if dns_data["dmarc_record"]:
        policy = dns_data.get("dmarc_policy", "configured")
        rec = get_recommendation("dmarc_present")
        findings.append(
            Finding(
                check_type="dmarc_record",
                name="DMARC Policy Configured",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title=f"DMARC Policy Active (p={policy})",
                summary=f"DMARC is published with policy p={policy}.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=0,
                documentation_url=rec["documentation_url"],
                evidence=dns_data["dmarc_record"],
            )
        )
    else:
        rec = get_recommendation("dmarc_missing")
        findings.append(
            Finding(
                check_type="dmarc_record",
                name="Missing DMARC Policy",
                status=CheckStatus.WARNING,
                severity=Severity.MEDIUM,
                score_impact=-8,
                title=rec["title"],
                summary=f"No DMARC record found at {dmarc_domain}.",
                why_it_matters=rec["why_it_matters"],
                how_to_fix=rec["how_to_fix"],
                estimated_fix_minutes=rec["estimated_fix_minutes"],
                documentation_url=rec["documentation_url"],
                evidence=f"No TXT record found at {dmarc_domain}",
            )
        )

    # 7. Check DKIM (Responsible note: selector cannot be guessed reliably)
    rec = get_recommendation("dkim_info")
    findings.append(
        Finding(
            check_type="dkim_status",
            name="DKIM Email Authentication",
            status=CheckStatus.UNKNOWN,
            severity=Severity.INFO,
            score_impact=0,
            title="DKIM Selector Requires Specific Domain Key",
            summary="DKIM discovery requires knowing your email provider's specific selector (e.g. google._domainkey).",
            why_it_matters=rec["why_it_matters"],
            how_to_fix=rec["how_to_fix"],
            estimated_fix_minutes=rec["estimated_fix_minutes"],
            documentation_url=rec["documentation_url"],
            evidence="Passive scans cannot guess private provider selectors without false positives.",
        )
    )

    # 8. Check DNSSEC
    try:
        dnssec_answers = resolver.resolve(norm_domain, "DNSKEY")
        if dnssec_answers:
            dns_data["dnssec_enabled"] = True
            rec = get_recommendation("dnssec_present")
            findings.append(
                Finding(
                    check_type="dnssec",
                    name="DNSSEC Validation",
                    status=CheckStatus.PASS,
                    severity=Severity.INFO,
                    score_impact=0,
                    title="DNSSEC is Enabled",
                    summary="Cryptographic DNSSEC keys are active for domain.",
                    why_it_matters=rec["why_it_matters"],
                    how_to_fix=rec["how_to_fix"],
                    estimated_fix_minutes=0,
                    documentation_url=rec["documentation_url"],
                    evidence="DNSKEY records detected in zone.",
                )
            )
    except Exception:
        dns_data["dnssec_enabled"] = False

    return {"dns_data": dns_data, "findings": findings}
