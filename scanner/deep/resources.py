"""
Scanly Scanner Engine - Deep Scan Resource Inventory Module
Catalogues scripts, stylesheets, images, and external dependencies across crawled pages.
"""
from typing import List, Dict, Any, Set, Tuple
from urllib.parse import urlparse
from scanner.models import Finding, CheckStatus, Severity
from .models import CrawledPage, ResourceItem


def inventory_resources(crawled_pages: List[CrawledPage]) -> Tuple[Dict[str, Any], List[Finding]]:
    """
    Builds a structured inventory of embedded resources across all crawled pages.
    Returns: (inventory_summary_dict, findings)
    """
    findings: List[Finding] = []

    all_resources: List[ResourceItem] = []
    for p in crawled_pages:
        all_resources.extend(p.resources)

    # Group by type and origin
    total_resources = len(all_resources)
    scripts = [r for r in all_resources if r.resource_type == "script"]
    stylesheets = [r for r in all_resources if r.resource_type == "stylesheet"]
    images = [r for r in all_resources if r.resource_type == "image"]
    iframes = [r for r in all_resources if r.resource_type == "iframe"]

    external_hosts: Set[str] = set()
    for r in all_resources:
        if r.is_external and r.host:
            external_hosts.add(r.host)

    summary = {
        "total_resources": total_resources,
        "scripts_count": len(scripts),
        "stylesheets_count": len(stylesheets),
        "images_count": len(images),
        "iframes_count": len(iframes),
        "external_domains_count": len(external_hosts),
        "external_domains": sorted(list(external_hosts))[:20],
    }

    evidence_text = (
        f"Resources: {len(scripts)} scripts, {len(stylesheets)} styles, {len(images)} images, "
        f"{len(iframes)} iframes across {len(external_hosts)} external domain(s)."
    )

    findings.append(
        Finding(
            check_type="deep_resource_inventory",
            name="Resource & Dependency Inventory",
            status=CheckStatus.PASS,
            severity=Severity.INFO,
            score_impact=0,
            title="Public Resource Inventory Compiled",
            summary=f"Catalogued {total_resources} public resources referencing {len(external_hosts)} external domain(s).",
            why_it_matters="Maintaining visibility into third-party script and resource dependencies helps monitor supply-chain risk.",
            how_to_fix="Regularly review third-party scripts to remove unused trackers and analytics.",
            estimated_fix_minutes=0,
            documentation_url="https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity",
            evidence=evidence_text,
        )
    )

    return summary, findings
