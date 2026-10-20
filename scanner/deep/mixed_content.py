"""
Scanly Scanner Engine - Deep Scan Mixed Content Detector
Detects active and passive unencrypted http:// resources loaded on encrypted https:// pages.
"""
from typing import List, Dict, Any, Tuple
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage, ResourceItem


def analyze_mixed_content(crawled_pages: List[CrawledPage]) -> List[Finding]:
    """
    Scans resources embedded in HTTPS pages for unencrypted HTTP references.
    """
    findings: List[Finding] = []

    active_mixed: List[Dict[str, str]] = []  # scripts, stylesheets, iframes
    passive_mixed: List[Dict[str, str]] = []  # images, other

    for page in crawled_pages:
        if not page.is_https:
            continue

        for res in page.resources:
            if not res.is_https and res.resource_url.startswith("http://"):
                item = {
                    "page_url": page.url,
                    "resource_url": res.resource_url,
                    "type": res.resource_type,
                }
                if res.resource_type in ("script", "stylesheet", "iframe"):
                    active_mixed.append(item)
                else:
                    passive_mixed.append(item)

    # 1. Active Mixed Content (High Severity)
    if active_mixed:
        evidence_lines = [
            f"Page: {item['page_url']}\n  -> Insecure {item['type']}: {item['resource_url']}"
            for item in active_mixed[:5]
        ]
        if len(active_mixed) > 5:
            evidence_lines.append(f"...and {len(active_mixed) - 5} more occurrences")

        findings.append(
            Finding(
                check_type="deep_mixed_content_active",
                name="Active Mixed Content Detected",
                status=CheckStatus.HIGH,
                severity=Severity.HIGH,
                score_impact=-12,
                title="Insecure Scripts or Stylesheets Loaded Over HTTP",
                summary=f"Discovered {len(active_mixed)} instance(s) of active mixed content (scripts, stylesheets, or iframes) loaded over cleartext HTTP on HTTPS pages.",
                why_it_matters="Active mixed content can be intercepted and modified by an attacker (Man-in-the-Middle) to execute arbitrary JavaScript within your encrypted origin.",
                how_to_fix="Update resource URLs to use https:// or relative paths, or configure Content-Security-Policy: upgrade-insecure-requests.",
                estimated_fix_minutes=15,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content",
                evidence="\n".join(evidence_lines),
            )
        )

    # 2. Passive Mixed Content (Medium Severity)
    if passive_mixed:
        evidence_lines = [
            f"Page: {item['page_url']}\n  -> Insecure image: {item['resource_url']}"
            for item in passive_mixed[:5]
        ]
        if len(passive_mixed) > 5:
            evidence_lines.append(f"...and {len(passive_mixed) - 5} more occurrences")

        findings.append(
            Finding(
                check_type="deep_mixed_content_passive",
                name="Passive Mixed Content Detected",
                status=CheckStatus.WARNING,
                severity=Severity.LOW,
                score_impact=-4,
                title="Insecure Images Loaded Over HTTP",
                summary=f"Discovered {len(passive_mixed)} instance(s) of passive mixed content (images or media) loaded over cleartext HTTP on HTTPS pages.",
                why_it_matters="Passive mixed content allows network eavesdroppers to track visitor browsing or replace images with misleading content.",
                how_to_fix="Ensure all image src references point to https:// endpoints.",
                estimated_fix_minutes=10,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content",
                evidence="\n".join(evidence_lines),
            )
        )

    # 3. Clean PASS
    if not active_mixed and not passive_mixed:
        findings.append(
            Finding(
                check_type="deep_mixed_content_clean",
                name="Mixed Content Audit",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Zero Mixed Content Detected",
                summary="All public scripts, stylesheets, images, and iframes on HTTPS pages are loaded over secure HTTPS connections.",
                why_it_matters="A pure HTTPS content pipeline prevents network tampering and protects user privacy.",
                how_to_fix="Maintain https:// references for all embedded assets.",
                estimated_fix_minutes=0,
                documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content",
                evidence="Audited all embedded page resources without finding cleartext http:// references.",
            )
        )

    return findings
