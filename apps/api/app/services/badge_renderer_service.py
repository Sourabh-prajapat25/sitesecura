"""
Scanly API - Verified Badge Dynamic SVG Renderer (VB-4)
Programmatically generates safe, high-contrast, vector SVG badges
for verified, expired, revoked, and unverified states.
Guarantees zero XSS injection via strict XML character escaping.
"""
import html
from typing import Dict, Any


def render_badge_svg(status: str, style: str = "standard") -> str:
    """
    Renders an SVG string representing the dynamic SiteSecura Verified badge.
    
    Args:
        status: The effective status ('verified', 'expired', 'revoked', 'not_found'/'unverified').
        style: Badge style variant ('standard' or 'compact').
        
    Returns:
        Safe, valid, escaped SVG document string.
    """
    status_lower = (status or "").strip().lower()
    
    # Palette configuration per status
    palettes: Dict[str, Dict[str, str]] = {
        "verified": {
            "label": "VERIFIED",
            "bg_color": "#059669",
            "gradient_top": "#10B981",
            "gradient_bottom": "#047857",
            "border_color": "#065F46",
            "text_color": "#FFFFFF",
            "icon_path": (
                '<path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 '
                '01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 '
                '9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="#FFFFFF" stroke-width="2" '
                'stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
            ),
        },
        "expired": {
            "label": "EXPIRED",
            "bg_color": "#D97706",
            "gradient_top": "#F59E0B",
            "gradient_bottom": "#B45309",
            "border_color": "#92400E",
            "text_color": "#FFFFFF",
            "icon_path": (
                '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#FFFFFF" '
                'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
            ),
        },
        "revoked": {
            "label": "REVOKED",
            "bg_color": "#DC2626",
            "gradient_top": "#EF4444",
            "gradient_bottom": "#B91C1C",
            "border_color": "#991B1B",
            "text_color": "#FFFFFF",
            "icon_path": (
                '<path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 '
                '015.636 5.636m12.728 12.728L5.636 5.636" stroke="#FFFFFF" stroke-width="2" '
                'stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
            ),
        },
        "not_found": {
            "label": "UNVERIFIED",
            "bg_color": "#4B5563",
            "gradient_top": "#6B7280",
            "gradient_bottom": "#374151",
            "border_color": "#1F2937",
            "text_color": "#F3F4F6",
            "icon_path": (
                '<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 '
                '4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="#FFFFFF" '
                'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
            ),
        },
    }

    # Normalize status key
    if status_lower in ("verified",):
        palette = palettes["verified"]
    elif status_lower in ("expired",):
        palette = palettes["expired"]
    elif status_lower in ("revoked",):
        palette = palettes["revoked"]
    else:
        palette = palettes["not_found"]

    label = html.escape(palette["label"])
    brand_title = html.escape("SiteSecura")

    if style.strip().lower() == "compact":
        # Compact style: 130x28 pill
        width = 130
        height = 28
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" fill="none" role="img" aria-label="{brand_title} {label}">
  <title>{brand_title} - {label}</title>
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{palette['gradient_top']}"/>
      <stop offset="100%" stop-color="{palette['gradient_bottom']}"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="120%" filterUnits="objectBoundingBox">
      <feDropShadow dx="0" dy="1" stdDeviation="0.5" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="{width}" height="{height}" rx="6" fill="url(#bgGrad)" stroke="{palette['border_color']}" stroke-width="1"/>
  <g transform="translate(8, 4) scale(0.83)">
    {palette['icon_path']}
  </g>
  <text x="34" y="18" fill="{palette['text_color']}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5" filter="url(#shadow)">
    {label}
  </text>
</svg>"""
    else:
        # Standard style: Dual-pill 198x34
        # Left brand side (slate-950/slate-900): width 96
        # Right status side: width 102
        width = 200
        height = 34
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" fill="none" role="img" aria-label="{brand_title}: {label}">
  <title>{brand_title}: {label}</title>
  <defs>
    <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="statusGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{palette['gradient_top']}"/>
      <stop offset="100%" stop-color="{palette['gradient_bottom']}"/>
    </linearGradient>
    <clipPath id="clipPill">
      <rect width="{width}" height="{height}" rx="6"/>
    </clipPath>
  </defs>
  <g clip-path="url(#clipPill)">
    <!-- Brand Section -->
    <rect x="0" y="0" width="98" height="{height}" fill="url(#brandGrad)"/>
    <!-- Brand Shield Icon -->
    <g transform="translate(8, 7) scale(0.83)">
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    <text x="32" y="21.5" fill="#F8FAFC" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="600" letter-spacing="0.2">
      {brand_title}
    </text>

    <!-- Status Section -->
    <rect x="98" y="0" width="102" height="{height}" fill="url(#statusGrad)"/>
    <g transform="translate(104, 7) scale(0.83)">
      {palette['icon_path']}
    </g>
    <text x="127" y="21.5" fill="{palette['text_color']}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">
      {label}
    </text>
  </g>
  <!-- Outer Border -->
  <rect width="{width}" height="{height}" rx="6" stroke="#334155" stroke-opacity="0.3" stroke-width="1" fill="none"/>
</svg>"""

    return svg.strip()
