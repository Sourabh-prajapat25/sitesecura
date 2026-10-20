"""
Scanly Scanner Engine - Deep Scan Multi-Page Technology Aggregator
Reuses existing technology detection engine across all discovered pages and aggregates findings.
"""
from typing import List, Dict, Any, Tuple, Set
from scanner.models import Finding, CheckStatus, Severity
from scanner.tech_check import check_technologies
from .models import CrawledPage


def aggregate_technologies(crawled_pages: List[CrawledPage]) -> Tuple[List[Dict[str, Any]], List[Finding]]:
    """
    Executes technology fingerprinting across all crawled pages and computes multi-page confidence.
    Returns: (detected_technologies_list, findings)
    """
    # Map: tech_name -> {category: str, pages: set(), confidence: str}
    tech_map: Dict[str, Dict[str, Any]] = {}

    for page in crawled_pages:
        # Run existing technology check module
        res = check_technologies(page.headers, html_sample=page.title or "")
        detected_list = res.get("detected_technologies", [])
        page.technologies = detected_list

        for t in detected_list:
            name = t["name"]
            cat = t.get("category", "General")
            if name not in tech_map:
                tech_map[name] = {"name": name, "category": cat, "pages": set(), "confidence": "medium"}
            tech_map[name]["pages"].add(page.url)

    # Compute confidence based on multi-page occurrence
    total_pages = len(crawled_pages)
    aggregated_list: List[Dict[str, Any]] = []

    for name, data in tech_map.items():
        page_count = len(data["pages"])
        ratio = page_count / max(total_pages, 1)
        conf = "high" if (page_count >= 2 or ratio >= 0.5) else "medium"
        data["confidence"] = conf
        data["page_count"] = page_count
        aggregated_list.append({
            "name": name,
            "category": data["category"],
            "confidence": conf,
            "page_count": page_count,
            "sample_pages": list(data["pages"])[:3],
        })

    findings: List[Finding] = []
    if aggregated_list:
        tech_names = [f"{t['name']} ({t['category']})" for t in aggregated_list]
        evidence_lines = [
            f"• {t['name']} — {t['category']} (Observed on {t['page_count']} page(s), Confidence: {t['confidence'].title()})"
            for t in aggregated_list
        ]
        findings.append(
            Finding(
                check_type="deep_technology_profile",
                name="Technology Stack Profile",
                status=CheckStatus.PASS,
                severity=Severity.INFO,
                score_impact=0,
                title="Multi-Page Technology Stack Identified",
                summary=f"Identified {len(aggregated_list)} distinct component(s) across crawled pages: {', '.join(t['name'] for t in aggregated_list[:5])}.",
                why_it_matters="Accurate technology inventory enables proactive patching and monitoring of framework-specific vulnerabilities.",
                how_to_fix="Ensure all identified platforms and libraries are kept updated to latest secure release versions.",
                estimated_fix_minutes=0,
                documentation_url="https://cve.mitre.org/",
                evidence="\n".join(evidence_lines),
            )
        )
    else:
        findings.append(
            Finding(
                check_type="deep_technology_profile",
                name="Technology Stack Profile",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Minimal Passive Technology Exposure",
                summary="No overt framework or server version fingerprints were exposed in public headers or HTML samples.",
                why_it_matters="Minimizing technology fingerprint exposure prevents attackers from tailoring automated exploits.",
                how_to_fix="Continue suppressing identifying headers like X-Powered-By and Server tokens.",
                estimated_fix_minutes=0,
                documentation_url="https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server",
                evidence="No high-confidence tech fingerprints detected.",
            )
        )

    return aggregated_list, findings
