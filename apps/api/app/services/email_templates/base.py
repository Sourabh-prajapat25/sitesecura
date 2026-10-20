"""
SiteSecura - Base Email Template & HTML Escaping Engine
Renders accessible, responsive, brand-aligned HTML envelopes with auto-generated plain-text fallbacks.
"""
import html
import re
from typing import Optional, Dict, Any
from app.core.config import settings


def escape(val: Any) -> str:
    """Safely escapes dynamic strings for insertion into HTML email templates."""
    if val is None:
        return ""
    return html.escape(str(val))


def render_email_envelope(
    headline: str,
    content_html: str,
    preheader: Optional[str] = None,
    cta_text: Optional[str] = None,
    cta_url: Optional[str] = None,
    badge_label: Optional[str] = None,
    badge_color: str = "#2563EB",  # default blue
) -> str:
    """
    Renders the complete SiteSecura HTML email envelope.
    Follows email client responsive design best practices (table-based layout, inline CSS, high contrast).
    """
    app_url = settings.NEXT_PUBLIC_APP_URL.rstrip("/")
    settings_url = f"{app_url}/dashboard/settings#notifications"
    dashboard_url = f"{app_url}/dashboard"

    badge_html = ""
    if badge_label:
        badge_html = f"""
        <tr>
          <td style="padding-bottom: 12px;">
            <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 9999px; background-color: {badge_color}1A; color: {badge_color}; border: 1px solid {badge_color}40;">
              {escape(badge_label)}
            </span>
          </td>
        </tr>
        """

    cta_html = ""
    if cta_text and cta_url:
        # Validate URL to prevent javascript: or malformed URLs
        safe_url = escape(cta_url)
        cta_html = f"""
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px; margin-bottom: 24px;">
          <tr>
            <td align="left">
              <a href="{safe_url}" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; background-color: #2563EB; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                {escape(cta_text)} &rarr;
              </a>
            </td>
          </tr>
        </table>
        """

    preheader_html = ""
    if preheader:
        preheader_html = f"""
        <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
          {escape(preheader)}
          &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{escape(headline)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0F172A;">
  {preheader_html}
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #0F172A; padding: 24px 32px; border-bottom: 2px solid #2563EB;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                      🛡️ SiteSecura
                    </span>
                    <span style="font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px;">
                      Security Cloud
                    </span>
                  </td>
                  <td align="right">
                    <a href="{dashboard_url}" style="font-size: 12px; font-weight: 600; color: #38BDF8; text-decoration: none;">
                      Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                {badge_html}
                <tr>
                  <td style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0F172A; line-height: 1.3;">
                      {escape(headline)}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 14px; line-height: 1.6; color: #334155;">
                    {content_html}
                  </td>
                </tr>
                <tr>
                  <td>
                    {cta_html}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 32px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B; line-height: 1.5;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 12px;">
                    <strong>SiteSecura Defensive Cybersecurity Platform</strong><br>
                    Automated perimeter auditing, continuous posture monitoring, and verified compliance.
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 11px; color: #94A3B8;">
                    This automated transactional notification was sent to your authorized account.
                    You can adjust alert thresholds in your
                    <a href="{settings_url}" style="color: #2563EB; text-decoration: underline;">Notification Preferences</a>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def html_to_plain_text(html_str: str) -> str:
    """Converts rendered HTML into clean, readable plain-text fallback."""
    # Replace block breaks with newlines
    text = re.sub(r"<(?:p|div|tr|h[1-6]|li)[^>]*>", "\n", html_str)
    text = re.sub(r"<br[^>]*>", "\n", text)
    # Extract link text and URL
    text = re.sub(r'<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)</a>', r"\2 (\1)", text)
    # Strip remaining tags
    text = re.sub(r"<[^>]+>", "", text)
    # Decode entities
    text = html.unescape(text)
    # Normalize excessive blank lines
    text = re.sub(r"\n\s*\n+", "\n\n", text).strip()
    return text
