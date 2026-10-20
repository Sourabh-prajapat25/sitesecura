"""
Scanly Database Seeder
Seeds initial recommendation library, blog categories, and sample educational articles.
Phase E1: Standardized 8 Categories, 5 Foundational Articles, Idempotent Execution.
Run with: python scripts/seed_db.py
"""
import sys
import os
import uuid
from datetime import datetime, timezone

# Add project root and apps/api to path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, ".."))
api_dir = os.path.join(project_root, "apps", "api")
if project_root not in sys.path:
    sys.path.insert(0, project_root)
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from app.db.session import get_sync_db
from app.models.scan import Recommendation
from app.models.cms import BlogCategory, BlogPost
from scanner.recommendations import RECOMMENDATIONS_CATALOG


def seed_database():
    db = get_sync_db()
    print("Seeding Scanly database...")

    # 1. Seed Recommendations Library
    rec_count = 0
    for key, data in RECOMMENDATIONS_CATALOG.items():
        existing = db.query(Recommendation).filter_by(check_type=key).first()
        if not existing:
            rec = Recommendation(
                id=uuid.uuid4(),
                check_type=key,
                title=data["title"],
                why_it_matters=data["why_it_matters"],
                how_to_fix=data["how_to_fix"],
                estimated_fix_minutes=data["estimated_fix_minutes"],
                documentation_url=data["documentation_url"],
                severity=data["severity"],
                is_active=True,
            )
            db.add(rec)
            rec_count += 1
    db.commit()
    print(f"[OK] Seeded {rec_count} recommendations.")

    # 2. Seed Standardized Blog Categories (Phase E1)
    categories = [
        {
            "name": "Website Security",
            "slug": "website-security",
            "description": "Essential web security principles, baseline hygiene, and cyber threat protection for modern websites.",
        },
        {
            "name": "SSL/TLS",
            "slug": "ssl-tls",
            "description": "Guides on HTTPS, TLS cipher suites, certificate renewals, and transport-layer encryption.",
        },
        {
            "name": "Security Headers",
            "slug": "security-headers",
            "description": "Defensive HTTP response headers including HSTS, CSP, and X-Content-Type-Options.",
        },
        {
            "name": "DNS & Email Security",
            "slug": "dns-email-security",
            "description": "Protecting domain reputation and preventing spoofing with SPF, DKIM, DMARC, and DNSSEC.",
        },
        {
            "name": "WordPress Security",
            "slug": "wordpress-security",
            "description": "Hardening WordPress installations, managing plugin security, and preventing CMS exploitation.",
        },
        {
            "name": "Small Business Security",
            "slug": "small-business-security",
            "description": "Practical, cost-effective cybersecurity strategies designed for small business owners and teams.",
        },
        {
            "name": "Security Guides",
            "slug": "security-guides",
            "description": "Step-by-step implementation walkthroughs for website vulnerability assessment and hardening.",
        },
        {
            "name": "SiteSecura Updates",
            "slug": "sitesecura-updates",
            "description": "Product updates, security scanner engine improvements, and platform announcements.",
        },
        # Backwards compatibility legacy category slugs
        {
            "name": "SSL & Encryption",
            "slug": "ssl-encryption",
            "description": "Legacy category for SSL and TLS encryption topics.",
        },
        {
            "name": "Headers & Hardening",
            "slug": "headers-hardening",
            "description": "Legacy category for HTTP response header hardening.",
        },
    ]

    cat_map = {}
    new_cat_count = 0
    for cat_data in categories:
        existing = db.query(BlogCategory).filter(
            (BlogCategory.slug == cat_data["slug"]) | (BlogCategory.name == cat_data["name"])
        ).first()
        if not existing:
            cat = BlogCategory(
                id=uuid.uuid4(),
                name=cat_data["name"],
                slug=cat_data["slug"],
                description=cat_data["description"],
            )
            db.add(cat)
            db.flush()
            cat_map[cat.slug] = cat.id
            new_cat_count += 1
        else:
            cat_map[existing.slug] = existing.id
    db.commit()
    print(f"[OK] Seeded {new_cat_count} new categories (total checked: {len(categories)}).")

    # 3. Seed Realistic Educational Blog Posts (Phase E1)
    posts = [
        {
            "title": "What Is Website Security? A Complete Beginner's Guide",
            "slug": "what-is-website-security-beginners-guide",
            "excerpt": "A comprehensive guide to website security fundamentals, modern web threats, and foundational defenses every website owner must understand.",
            "content": """What Is Website Security?

Website security refers to the protocols, technologies, and defensive practices designed to protect websites and web applications from unauthorized access, data theft, malicious alteration, or service disruption.

Why Website Security Matters
Every day, thousands of websites are probed and targeted by automated crawlers, exploit scanners, and threat actors. Whether you run a simple business landing page, an e-commerce storefront, or a software platform, an insecure website exposes your business and customers to severe risks:
1. Data Breaches: Theft of customer credentials, personal information, or proprietary business data.
2. Search Engine Penalties: Search engines flag compromised websites, displaying security warnings that destroy organic traffic.
3. Reputation Damage: Visitors immediately abandon websites that show SSL certificate warnings or browser security blocks.
4. Financial and Compliance Liability: Non-compliance with privacy regulations (GDPR, CCPA) or payment standards (PCI-DSS) can incur heavy penalties.

Core Pillars of Modern Web Security
1. Transport Layer Security (HTTPS): Ensuring all traffic between visitors and your web server is encrypted and protected against eavesdropping.
2. Defensive HTTP Headers: Instructing modern web browsers to block cross-site scripting (XSS), clickjacking, and mime-type sniffing.
3. Domain & Email Authentication: Configuring DNS records (SPF, DKIM, and DMARC) to prevent adversaries from forging your domain in phishing emails.
4. Regular Scanning & Auditing: Continuously scanning external endpoints to catch misconfigurations and expiring certificates before attackers exploit them.

How SiteSecura Helps
SiteSecura provides continuous, non-invasive security posture assessments for your websites. From checking SSL certificates and response headers to auditing DNS configurations, our platform gives you instant, actionable fix instructions.""",
            "category_slug": "website-security",
            "status": "published",
        },
        {
            "title": "HTTPS vs SSL vs TLS: What's the Difference?",
            "slug": "https-vs-ssl-vs-tls-difference",
            "excerpt": "Understand the differences between SSL, TLS, and HTTPS, how certificates work, and why modern browsers require TLS 1.2 or TLS 1.3.",
            "content": """HTTPS vs SSL vs TLS: Demystifying Web Encryption

If you operate a website, you have likely encountered the terms SSL, TLS, and HTTPS used interchangeably. While they all relate to encrypting web communications, they represent different components of modern transport security.

1. What is SSL?
Secure Sockets Layer (SSL) was the original cryptographic protocol developed by Netscape in the 1990s. SSL 1.0 was never released publicly, SSL 2.0 was deprecated due to fundamental flaws, and SSL 3.0 was formally retired in 2015 following vulnerabilities like POODLE. Today, true SSL is obsolete and insecure.

2. What is TLS?
Transport Layer Security (TLS) is the direct, modernized successor to SSL. Created by the Internet Engineering Task Force (IETF), TLS fixed the cryptographic shortcomings of SSL.
- TLS 1.0 and 1.1: Deprecated by all major browsers due to outdated cipher suites.
- TLS 1.2: Widely supported and secure when configured with strong cipher suites.
- TLS 1.3: The modern gold standard. It improves handshake speed and eliminates insecure legacy cryptographic primitives.

3. What is HTTPS?
Hypertext Transfer Protocol Secure (HTTPS) is simply regular HTTP layered over a TLS connection. When a browser connects to an HTTPS URL, it performs a TLS handshake with the web server, verifies the server's digital certificate, and establishes an encrypted channel.

Why Certificate Verification Is Critical
An HTTPS certificate accomplishes two goals:
1. Encryption: Encrypts data in transit so third parties on the network cannot read cleartext passwords, session cookies, or forms.
2. Authentication: Cryptographically validates that the visitor is genuinely communicating with your domain, not an imposter.

How to Verify Your TLS Configuration
Use SiteSecura to inspect your certificate validity, cipher suite strength, and expiration date to avoid sudden certificate outages.""",
            "category_slug": "ssl-tls",
            "status": "published",
        },
        {
            "title": "What Are Security Headers and Why Do They Matter?",
            "slug": "what-are-security-headers-and-why-they-matter",
            "excerpt": "Explore defensive HTTP response headers like HSTS, Content-Security-Policy, and X-Frame-Options that protect your visitors directly in their browsers.",
            "content": """Understanding Defensive HTTP Security Headers

When a browser requests a page from your website, the server responds with the HTML content alongside metadata known as HTTP response headers. Security headers are specialized instructions that tell the browser how to restrict certain behaviors, preventing common client-side attacks.

Essential Security Headers Every Site Should Send

1. Strict-Transport-Security (HSTS)
Tells browsers that the site must only be accessed over HTTPS for a defined duration.
Example:
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
This prevents SSL stripping attacks and accidental unencrypted redirects.

2. Content-Security-Policy (CSP)
Controls which resources (scripts, stylesheets, images, fonts) the browser is allowed to execute or load.
Example:
Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted-cdn.com;
CSP is the most effective browser-side defense against Cross-Site Scripting (XSS).

3. X-Content-Type-Options
Prevents browsers from MIME-sniffing a response away from the declared content-type.
Example:
X-Content-Type-Options: nosniff
This stops malicious scripts disguised as images or text files from executing.

4. X-Frame-Options
Controls whether your website can be embedded in an <iframe> or <frame>.
Example:
X-Frame-Options: DENY
This prevents Clickjacking attacks where an attacker tricks a user into clicking invisible interface buttons.

5. Referrer-Policy
Controls how much referrer information is sent along when a user navigates away from your site.
Example:
Referrer-Policy: strict-origin-when-cross-origin

Checking Your Security Headers
Running a SiteSecura scan checks all required headers and provides the exact config snippets needed for Nginx, Apache, Caddy, or Cloudflare.""",
            "category_slug": "security-headers",
            "status": "published",
        },
        {
            "title": "What Is DMARC? A Practical Guide to Email Security",
            "slug": "what-is-dmarc-guide-to-email-security",
            "excerpt": "Protect your domain reputation and prevent phishing by implementing SPF, DKIM, and DMARC email authentication records.",
            "content": """What Is DMARC and Why Does It Matter?

Domain-based Message Authentication, Reporting, and Conformance (DMARC) is an email authentication protocol that helps domain owners protect their domain name from being spoofed by spammers and phishing operators.

The Flaw in Email Architecture
The Simple Mail Transfer Protocol (SMTP) was developed in the early days of the Internet without built-in sender identity verification. By default, any computer on the internet can send an email claiming to be from `support@yourdomain.com`.

The Three Email Authentication Records

1. SPF (Sender Policy Framework)
A DNS TXT record that lists which mail servers and IP addresses are authorized to send email on behalf of your domain.
Example:
v=spf1 include:_spf.google.com ~all

2. DKIM (DomainKeys Identified Mail)
Attaches a cryptographic signature to outbound emails. The receiving server looks up your public key in your DNS to verify that the message wasn't tampered with in transit.

3. DMARC (The Enforcer)
Ties SPF and DKIM together. It instructs receiving mail providers (like Google, Microsoft, Yahoo) what to do if an incoming message fails SPF or DKIM checks:
- p=none (Monitoring mode): Deliver the email, but send aggregate reports to the domain owner.
- p=quarantine: Send failing emails directly to the recipient's spam folder.
- p=reject: Block and drop failing emails completely.

Why Major Providers Require DMARC
Starting in 2024, Google and Yahoo enforce mandatory DMARC records for bulk email senders. Without valid SPF and DMARC records, legitimate customer emails will bounce or land in the junk folder.

Audit Your DNS Records with SiteSecura
SiteSecura automatically inspects your domain's SPF and DMARC records during every website scan and alerts you if your domain is vulnerable to spoofing.""",
            "category_slug": "dns-email-security",
            "status": "published",
        },
        {
            "title": "How to Check Your Website Security",
            "slug": "how-to-check-your-website-security",
            "excerpt": "A practical checklist and methodology to evaluate your website's security posture, certificates, and configuration.",
            "content": """How to Check Your Website Security: A Practical Guide

Maintaining strong website security is not a one-time project; it requires continuous verification of your public-facing infrastructure. Here is a practical, 5-step checklist to evaluate your web security posture today.

1. Inspect SSL/TLS Certificate Health
- Does your site redirect all HTTP traffic to HTTPS automatically?
- What is your certificate's expiration date? (Unexpected expiration is one of the top causes of unplanned downtime).
- Does your server support modern TLS 1.3, or is it still serving deprecated TLS 1.0/1.1 protocols?

2. Audit HTTP Response Headers
- Are defensive headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options) present on all page responses?
- Test whether your login pages allow iframe embedding.

3. Check Domain & Email Authentication
- Verify that your domain publishes a valid SPF record.
- Confirm you have configured a DMARC policy (`p=quarantine` or `p=reject`) to prevent email forgery.
- Check that DNSSEC is enabled where supported by your registrar.

4. Evaluate Cookie Security Attributes
If your application uses session cookies:
- Ensure the `Secure` flag is enabled (prevents cookies from being transmitted over HTTP).
- Ensure `HttpOnly` is set (prevents client-side scripts from reading session tokens).
- Set `SameSite=Lax` or `SameSite=Strict` to mitigate Cross-Site Request Forgery (CSRF).

5. Automate Continuous Posture Checks
Manual testing is prone to human error and easily forgotten. Using SiteSecura's automated scanning gives you periodic health checks, immediate alerts on certificate expiration, and clear remediation guides when new risks are identified.""",
            "category_slug": "security-guides",
            "status": "published",
        },
    ]

    post_count = 0
    now_utc = datetime.now(timezone.utc)
    for p_data in posts:
        existing = db.query(BlogPost).filter_by(slug=p_data["slug"]).first()
        if not existing:
            cat_id = cat_map.get(p_data["category_slug"])
            post = BlogPost(
                id=uuid.uuid4(),
                title=p_data["title"],
                slug=p_data["slug"],
                excerpt=p_data["excerpt"],
                content=p_data["content"],
                category_id=cat_id,
                seo_title=p_data["title"],
                meta_description=p_data["excerpt"],
                status=p_data["status"],
                published_at=now_utc,
            )
            db.add(post)
            post_count += 1
    db.commit()
    print(f"[OK] Seeded {post_count} new educational blog posts (total checked: {len(posts)}).")

    db.close()
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    seed_database()
