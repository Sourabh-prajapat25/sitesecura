"""
SiteSecura - Specialized Email Templates
Generates HTML and plain-text contents for all core transactional and security notifications.
"""
from typing import Dict, Any, Tuple, Optional, List
from app.services.email_templates.base import render_email_envelope, html_to_plain_text, escape
from app.core.config import settings


def render_welcome_email(user_name: Optional[str] = None) -> Tuple[str, str, str]:
    """
    Renders welcome email for newly registered accounts.
    Returns: (subject, html_body, text_body)
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    greeting = f"Hello {escape(user_name)}," if user_name else "Hello,"
    headline = "Welcome to SiteSecura"
    subject = "Welcome to SiteSecura — Your Automated Website Security Suite"

    content_html = f"""
    <p style="margin-top: 0;">{greeting}</p>
    <p>
      Thank you for joining <strong>SiteSecura</strong>. Your account gives you access to enterprise-grade,
      deterministic website cybersecurity inspections, continuous perimeter monitoring, and executive PDF reporting.
    </p>
    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">
        Quick Start Checklist
      </h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
        <li><strong>Run your first perimeter scan:</strong> Audit SSL, HTTP security headers, and DNS records.</li>
        <li><strong>Add your production domain:</strong> Enable automated weekly or daily monitoring.</li>
        <li><strong>Generate executive PDF reports:</strong> Export branded compliance reports for clients or stakeholders.</li>
      </ul>
    </div>
    <p style="color: #64748B; font-size: 13px;">
      Need help getting started? Visit our <a href="{app_url}/docs" style="color: #2563EB; text-decoration: underline;">Technical Documentation</a> or reply to this email.
    </p>
    """

    html_body = render_email_envelope(
        headline=headline,
        content_html=content_html,
        preheader="Get started with your automated website security scanner.",
        cta_text="Go to Dashboard",
        cta_url=f"{app_url}/dashboard",
        badge_label="Account Activated",
        badge_color="#16A34A",
    )
    return subject, html_body, html_to_plain_text(html_body)


def render_ssl_expiry_alert(domain: str, days_remaining: int) -> Tuple[str, str, str]:
    """
    Renders SSL/TLS certificate expiration alert.
    Returns: (subject, html_body, text_body)
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    clean_domain = escape(domain)

    if days_remaining <= 0:
        headline = f"SSL Certificate Expired for {clean_domain}"
        subject = f"🚨 URGENT: SSL certificate expired for {domain}"
        badge_color = "#DC2626"
        badge_label = "Expired"
        status_text = f"The SSL/TLS certificate for <strong>{clean_domain}</strong> has expired. Visitors may encounter security warnings preventing access to your website."
    else:
        headline = f"SSL Certificate Warning: {clean_domain}"
        subject = f"⚠️ Alert: SSL certificate for {domain} expires in {days_remaining} days"
        badge_color = "#EA580C" if days_remaining <= 7 else "#D97706"
        badge_label = f"Expires in {days_remaining} Days"
        status_text = f"SiteSecura automated monitoring detected that the SSL/TLS certificate for <strong>{clean_domain}</strong> will expire in <strong>{days_remaining} days</strong>."

    content_html = f"""
    <p style="margin-top: 0;">{status_text}</p>
    <div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #991B1B;">
        Recommended Immediate Actions
      </h3>
      <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #7F1D1D; line-height: 1.6;">
        <li>Log into your SSL certificate authority or hosting provider (e.g. Let's Encrypt, Cloudflare, AWS ACM).</li>
        <li>Trigger certificate renewal or ensure ACME automated renewal agents (certbot) are operating without errors.</li>
        <li>Run a fresh perimeter scan on SiteSecura to verify the renewed certificate is properly installed.</li>
      </ol>
    </div>
    """

    html_body = render_email_envelope(
        headline=headline,
        content_html=content_html,
        preheader=f"SSL certificate for {domain} expires in {days_remaining} days.",
        cta_text="View SSL Status in Dashboard",
        cta_url=f"{app_url}/dashboard",
        badge_label=badge_label,
        badge_color=badge_color,
    )
    return subject, html_body, html_to_plain_text(html_body)


def render_score_drop_alert(
    domain: str,
    previous_score: int,
    current_score: int,
    website_id: Optional[str] = None,
) -> Tuple[str, str, str]:
    """
    Renders security score drop alert.
    Returns: (subject, html_body, text_body)
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    clean_domain = escape(domain)
    drop = abs(previous_score - current_score)
    headline = f"Security Score Dropped: {clean_domain}"
    subject = f"🚨 Alert: Security score for {domain} dropped by {drop} pts ({previous_score} → {current_score})"
    target_url = f"{app_url}/dashboard/websites/{website_id}" if website_id else f"{app_url}/dashboard"

    content_html = f"""
    <p style="margin-top: 0;">
      SiteSecura monitoring detected a security score drop for <strong>{clean_domain}</strong>.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin: 20px 0; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
      <tr>
        <td align="center" style="padding: 16px; border-right: 1px solid #E2E8F0;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Previous Score</div>
          <div style="font-size: 24px; font-weight: 800; color: #0F172A; margin-top: 4px;">{previous_score} / 100</div>
        </td>
        <td align="center" style="padding: 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #DC2626; text-transform: uppercase;">Current Score</div>
          <div style="font-size: 24px; font-weight: 800; color: #DC2626; margin-top: 4px;">{current_score} / 100</div>
        </td>
      </tr>
    </table>
    <p>
      A drop of <strong>{drop} points</strong> typically indicates that a critical HTTP security header was dropped during a recent deployment,
      an SSL certificate was modified, or DNS email authentication records (SPF/DMARC) were altered.
    </p>
    <p style="font-size: 13px; color: #64748B;">
      Review the diff comparison in your dashboard to view the exact changes and copy ready-to-paste remediation snippets.
    </p>
    """

    html_body = render_email_envelope(
        headline=headline,
        content_html=content_html,
        preheader=f"Score dropped by {drop} points for {domain}.",
        cta_text="Review Score Diff & Fixes",
        cta_url=target_url,
        badge_label=f"-{drop} Points Drop",
        badge_color="#DC2626",
    )
    return subject, html_body, html_to_plain_text(html_body)


def render_critical_finding_alert(
    domain: str,
    finding_title: str,
    severity: str,
    summary: str,
    scan_id: Optional[str] = None,
) -> Tuple[str, str, str]:
    """
    Renders alert for newly discovered critical or high-severity vulnerabilities.
    Returns: (subject, html_body, text_body)
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    clean_domain = escape(domain)
    clean_title = escape(finding_title)
    clean_summary = escape(summary)
    sev_upper = severity.upper()
    badge_color = "#DC2626" if sev_upper == "CRITICAL" else "#EA580C"
    headline = f"New {sev_upper} Vulnerability: {clean_domain}"
    subject = f"🚨 {sev_upper} Security Issue Found on {domain}: {finding_title}"
    target_url = f"{app_url}/scan/{scan_id}" if scan_id else f"{app_url}/dashboard"

    content_html = f"""
    <p style="margin-top: 0;">
      A scheduled perimeter inspection detected a new <strong>{sev_upper}</strong> security finding on <strong>{clean_domain}</strong>.
    </p>
    <div style="background-color: #FEF2F2; border-left: 4px solid {badge_color}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <h3 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #0F172A;">
        {clean_title}
      </h3>
      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
        {clean_summary}
      </p>
    </div>
    <p style="font-size: 13px; color: #475569;">
      Prompt remediation is recommended to prevent protocol downgrade, session hijacking, or cross-site scripting vulnerabilities.
    </p>
    """

    html_body = render_email_envelope(
        headline=headline,
        content_html=content_html,
        preheader=f"{sev_upper} issue found on {domain}: {finding_title}.",
        cta_text="View Finding Details & Remediation",
        cta_url=target_url,
        badge_label=f"{sev_upper} Severity",
        badge_color=badge_color,
    )
    return subject, html_body, html_to_plain_text(html_body)


def render_downtime_alert(
    domain: str,
    error_details: str,
    status_code: Optional[int] = None,
) -> Tuple[str, str, str]:
    """
    Renders website availability and downtime notification.
    Returns: (subject, html_body, text_body)
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    clean_domain = escape(domain)
    clean_error = escape(error_details)
    headline = f"Website Unreachable: {clean_domain}"
    subject = f"🚨 Down Alert: {domain} failed availability inspection"

    status_extra = f" (HTTP {status_code})" if status_code else ""
    content_html = f"""
    <p style="margin-top: 0;">
      SiteSecura automated monitoring was unable to reach <strong>{clean_domain}</strong>{status_extra}.
    </p>
    <div style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <div style="font-size: 11px; font-weight: 700; color: #991B1B; text-transform: uppercase;">Observed Error</div>
      <div style="font-family: monospace; font-size: 13px; color: #B91C1C; margin-top: 4px;">{clean_error}</div>
    </div>
    <p style="font-size: 13px; color: #475569;">
      Our probe received a connection timeout, DNS failure, or server error. Please verify your origin web server and DNS routing.
    </p>
    """

    html_body = render_email_envelope(
        headline=headline,
        content_html=content_html,
        preheader=f"Website {domain} failed availability inspection.",
        cta_text="Check Diagnostics in Dashboard",
        cta_url=f"{app_url}/dashboard",
        badge_label="Availability Incident",
        badge_color="#DC2626",
    )
    return subject, html_body, html_to_plain_text(html_body)


def render_scan_completed_notification(
    domain: str,
    score: int,
    risk_level: str,
    scan_id: str,
    passed_checks: int = 0,
    total_checks: int = 0,
) -> Tuple[str, str, str]:
    """
    Renders notification when a security scan or deep scan is finished.
    Returns: (subject, html_body, text_body)
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    clean_domain = escape(domain)
    clean_risk = escape(risk_level)
    headline = f"Security Scan Finished: {clean_domain}"
    subject = f"Security Scan Completed for {domain} — Score: {score}/100 ({risk_level})"

    badge_color = "#16A34A" if score >= 85 else "#D97706" if score >= 60 else "#DC2626"

    checks_info = f"<p style='font-size: 13px; color: #64748B;'>Passed checks: <strong>{passed_checks}</strong> of {total_checks} evaluated.</p>" if total_checks else ""

    content_html = f"""
    <p style="margin-top: 0;">
      Your security posture audit for <strong>{clean_domain}</strong> is complete and ready for review.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin: 20px 0; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
      <tr>
        <td align="center" style="padding: 16px; border-right: 1px solid #E2E8F0;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Security Score</div>
          <div style="font-size: 28px; font-weight: 800; color: {badge_color}; margin-top: 4px;">{score} / 100</div>
        </td>
        <td align="center" style="padding: 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Risk Level</div>
          <div style="font-size: 18px; font-weight: 700; color: #0F172A; margin-top: 8px;">{clean_risk}</div>
        </td>
      </tr>
    </table>
    {checks_info}
    <p style="font-size: 13px; color: #475569;">
      Access your full executive PDF report, detailed findings catalog, and server configuration remediation snippets in your dashboard.
    </p>
    """

    html_body = render_email_envelope(
        headline=headline,
        content_html=content_html,
        preheader=f"Audit completed for {domain}. Final score: {score}/100.",
        cta_text="View Interactive Scan Report",
        cta_url=f"{app_url}/scan/{scan_id}",
        badge_label=f"Score: {score}/100",
        badge_color=badge_color,
    )
    return subject, html_body, html_to_plain_text(html_body)


def render_weekly_digest(
    organization_name: str,
    website_summaries: List[Dict[str, Any]],
    period_label: str = "Last 7 Days",
) -> Tuple[str, str, str]:
    """
    Renders weekly security report aggregating stored scan history without triggering new scans.
    Returns: (subject, html_body, text_body)
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    clean_org = escape(organization_name)
    headline = f"Weekly Security Digest: {clean_org}"
    subject = f"SiteSecura Weekly Security Digest — {organization_name} ({period_label})"

    rows_html = ""
    for site in website_summaries:
        domain = escape(site.get("domain", "Unknown"))
        score = site.get("score")
        score_str = f"{score}/100" if score is not None else "N/A"
        badge_color = "#16A34A" if (score or 0) >= 80 else "#D97706" if (score or 0) >= 60 else "#DC2626"
        ssl_days = site.get("ssl_days_remaining")
        ssl_str = f"{ssl_days} days" if ssl_days is not None else "Valid"

        rows_html += f"""
        <tr style="border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 12px 8px; font-size: 13px; font-weight: 600; color: #0F172A;">{domain}</td>
          <td align="center" style="padding: 12px 8px; font-size: 13px; font-weight: 700; color: {badge_color};">{score_str}</td>
          <td align="right" style="padding: 12px 8px; font-size: 12px; color: #64748B;">{ssl_str}</td>
        </tr>
        """

    content_html = f"""
    <p style="margin-top: 0;">
      Here is your weekly cybersecurity posture summary for <strong>{clean_org}</strong> covering <strong>{escape(period_label)}</strong>.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
      <tr style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
        <th align="left" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Domain</th>
        <th align="center" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Security Score</th>
        <th align="right" style="padding: 10px 8px; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">SSL Expiry</th>
      </tr>
      {rows_html if rows_html else '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #94A3B8;">No active websites monitored.</td></tr>'}
    </table>
    <p style="font-size: 13px; color: #64748B;">
      Keep your defenses up to date by reviewing open vulnerabilities in your central management dashboard.
    </p>
    """

    html_body = render_email_envelope(
        headline=headline,
        content_html=content_html,
        preheader=f"Weekly security posture summary for {organization_name}.",
        cta_text="Open Security Dashboard",
        cta_url=f"{app_url}/dashboard",
        badge_label="Weekly Digest",
        badge_color="#2563EB",
    )
    return subject, html_body, html_to_plain_text(html_body)
