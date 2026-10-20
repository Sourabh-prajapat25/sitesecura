"""
Scanly Scanner Engine - Passive Technology & Fingerprinting Check Module
Detects web servers, CMS, CDN, and frontend technologies using passive header signals and HTML patterns.
"""
import re
from typing import Dict, Any, List
from .models import Finding, CheckStatus, Severity


def check_technologies(headers: Dict[str, str], html_sample: str) -> Dict[str, Any]:
    """
    Lightweight, deterministic passive technology detection.
    Identifies web frameworks, CMS platforms, CDNs, and server technologies without intrusive probing.
    """
    findings: List[Finding] = []
    norm_headers = {k.lower(): v for k, v in headers.items()}
    html_lower = html_sample.lower()

    detected_tech: List[Dict[str, str]] = []

    # 1. CDN & Proxy Detection
    if "cf-ray" in norm_headers or "cloudflare" in norm_headers.get("server", "").lower():
        detected_tech.append({"name": "Cloudflare", "category": "CDN / Edge Security", "confidence": "high"})
    if "x-amz-cf-id" in norm_headers or "cloudfront" in norm_headers.get("via", "").lower():
        detected_tech.append({"name": "Amazon CloudFront", "category": "CDN", "confidence": "high"})
    if "x-fastly-request-id" in norm_headers:
        detected_tech.append({"name": "Fastly", "category": "CDN", "confidence": "high"})
    if "x-vercel-id" in norm_headers:
        detected_tech.append({"name": "Vercel", "category": "Hosting / Edge Platform", "confidence": "high"})
    if "x-nf-request-id" in norm_headers:
        detected_tech.append({"name": "Netlify", "category": "Hosting / Platform", "confidence": "high"})

    # 2. Web Server Detection
    server_hdr = norm_headers.get("server", "")
    if "nginx" in server_hdr.lower():
        detected_tech.append({"name": "Nginx", "category": "Web Server", "confidence": "high"})
    elif "apache" in server_hdr.lower():
        detected_tech.append({"name": "Apache HTTP Server", "category": "Web Server", "confidence": "high"})
    elif "caddy" in server_hdr.lower():
        detected_tech.append({"name": "Caddy", "category": "Web Server", "confidence": "high"})
    elif "microsoft-iis" in server_hdr.lower():
        detected_tech.append({"name": "Microsoft IIS", "category": "Web Server", "confidence": "high"})

    # 3. CMS Detection
    if "wp-content" in html_lower or "wp-includes" in html_lower:
        detected_tech.append({"name": "WordPress", "category": "Content Management System (CMS)", "confidence": "high"})
    if "shopify.com" in html_lower or "cdn.shopify.com" in html_lower:
        detected_tech.append({"name": "Shopify", "category": "E-commerce Platform", "confidence": "high"})
    if "drupal" in html_lower or "drupal.settings" in html_lower:
        detected_tech.append({"name": "Drupal", "category": "CMS", "confidence": "medium"})
    if "ghost.org" in html_lower or 'content="ghost' in html_lower:
        detected_tech.append({"name": "Ghost", "category": "Publishing Platform", "confidence": "high"})

    # 4. Frontend & JavaScript Frameworks
    if "__next" in html_lower or "/_next/static" in html_lower:
        detected_tech.append({"name": "Next.js", "category": "Web Framework (React)", "confidence": "high"})
    if "react" in html_lower or "data-reactroot" in html_lower:
        if not any(t["name"] == "Next.js" for t in detected_tech):
            detected_tech.append({"name": "React", "category": "JavaScript Library", "confidence": "medium"})
    if "vue" in html_lower or "data-v-" in html_lower or "__nuxt" in html_lower:
        detected_tech.append({"name": "Vue.js / Nuxt", "category": "Web Framework", "confidence": "medium"})

    # 5. Language / Backend Indicators
    x_powered = norm_headers.get("x-powered-by", "").lower()
    if "php" in x_powered or ".php" in html_lower:
        detected_tech.append({"name": "PHP", "category": "Programming Language", "confidence": "high"})
    if "express" in x_powered:
        detected_tech.append({"name": "Express.js", "category": "Backend Framework", "confidence": "high"})
    if "asp.net" in x_powered:
        detected_tech.append({"name": "ASP.NET", "category": "Web Framework", "confidence": "high"})

    # Add informational finding
    tech_names = [t["name"] for t in detected_tech]
    if tech_names:
        findings.append(
            Finding(
                check_type="technology_detection",
                name="Detected Web Technologies",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title=f"Detected {len(tech_names)} Active Technologies",
                summary=f"Passive fingerprinting identified: {', '.join(tech_names)}",
                why_it_matters="Knowing your stack ensures you can track relevant security advisories and patch dependencies promptly.",
                how_to_fix="Ensure all underlying software and CMS plugins receive automated security updates.",
                estimated_fix_minutes=0,
                documentation_url="https://owasp.org",
                evidence=f"Identified components: {', '.join(tech_names)}",
            )
        )
    else:
        findings.append(
            Finding(
                check_type="technology_detection",
                name="Technology Fingerprinting",
                status=CheckStatus.INFO,
                severity=Severity.INFO,
                score_impact=0,
                title="Minimal Server Fingerprint Exposed",
                summary="The server does not expose obvious software or framework version signatures.",
                why_it_matters="Minimizing technology fingerprinting raises the barrier for automated reconnaissance.",
                how_to_fix="Maintain minimal header disclosure.",
                estimated_fix_minutes=0,
                documentation_url="https://owasp.org",
                evidence="No obvious framework or CMS markers detected.",
            )
        )

    return {"detected_technologies": detected_tech, "findings": findings}
