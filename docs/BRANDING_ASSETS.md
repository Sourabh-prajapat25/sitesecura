# SiteSecura — Branding Assets & Logo Architecture Guide

This document defines the single source of truth for SiteSecura brand assets, logo rendering across web and PDF engines, and step-by-step instructions for updating branding globally.

---

## 1. Brand Asset Inventory & Single Source of Truth

All brand graphic assets reside inside the web application public directory and Next.js App Router root:

| Asset Path | Format | Recommended Dimensions | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| `apps/web/public/brand/sitesecura-logo.svg` | SVG (Vector) | 512×512 (Square / 1:1) | **Primary Global Vector Logo**. Used by UI navigation, headers, footers, auth cards, and PDF report header. |
| `apps/web/public/icon.svg` | SVG (Vector) | 512×512 (Square / 1:1) | Modern browser vector favicon (`type="image/svg+xml"`). |
| `apps/web/src/app/icon.svg` | SVG (Vector) | 512×512 (Square / 1:1) | Next.js App Router dynamic icon discovery fallback. |
| `apps/web/public/favicon.ico` | Multi-size ICO | 16×16, 32×32, 48×48 px | Classic browser favicon fallback for tabs, bookmarks, and legacy clients. |

---

## 2. Frontend Component Architecture (`BrandLogo.tsx`)

All UI surfaces in SiteSecura consume the brand logo through a single centralized component:
`apps/web/src/components/BrandLogo.tsx`.

### Component Interface

```tsx
export interface BrandLogoProps {
  variant?: "default" | "light" | "icon";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}
```

### Variants & Display Contexts

1. **`default` (Dark text on light background)**:
   - Used in standard application layouts, dashboard navigation (`DashboardLayout.tsx`), and landing page (`Navbar.tsx` light state).
   - Renders the brand mark with high-contrast slate text `SiteSecura` and sky-blue dot `.`.
2. **`light` (White text on dark/navy background)**:
   - Used in dark auth hero panels (`AuthSplitLayout.tsx`), dark landing page sections, and footers.
   - Applies `bg-slate-900/80` container styling with subtle ring border and brightened icon contrast.
3. **`icon` (Mark only)**:
   - Used in collapsed sidebars, compact headers, or mobile drawers. Suppresses the text label.

---

## 3. Browser Favicon & Metadata Configuration

Favicon linking is centralized in `apps/web/src/app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "SiteSecura - Website Security Scanning & Monitoring",
  description: "Continuous automated security posture, SSL, DNS, and header scanning for websites.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
};
```

This ensures modern SVG-capable browsers render the crisp vector emblem while older browsers and Windows taskbars cleanly resolve `/favicon.ico`.

---

## 4. PDF Generation Engine Integration (`pdf_service.py`)

The PDF generation pipeline (`apps/api/app/services/pdf_service.py`) dynamically discovers the brand logo at report generation time:

```python
LOGO_PATHS = [
    # Primary unified vector logo
    Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / "brand" / "sitesecura-logo.svg",
    # Fallback paths
    Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / "brand" / "sitesecura-logo.png",
    Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / "brand-logo.svg",
    Path(__file__).resolve().parent.parent.parent.parent / "web" / "public" / "brand-logo.png",
]
```

### PDF Report Header Behavior:
1. If the SVG or PNG file is found on disk, ReportLab reads the file and renders it in the top header.
2. If the file is missing or ReportLab SVG rasterization fails, `pdf_service.py` executes an internal fallback routine (`_draw_shield_logo`) that draws a crisp vector shield with keyhole and checkmark directly onto the ReportLab canvas.

---

## 5. How to Update the Logo Globally (Step-by-Step)

To update the SiteSecura logo across the entire SaaS platform:

### Step 1: Update the Primary SVG
Replace `apps/web/public/brand/sitesecura-logo.svg` with your new vector SVG file:
- Ensure the viewBox is square (e.g., `viewBox="0 0 512 512"` or `viewBox="0 0 100 100"`).
- Keep vector paths clean and self-contained (no external font dependencies or linked external assets).

### Step 2: Sync Web Browser Icons
Copy the updated SVG to the icon discovery paths:
```powershell
Copy-Item "apps\web\public\brand\sitesecura-logo.svg" "apps\web\public\icon.svg" -Force
Copy-Item "apps\web\public\brand\sitesecura-logo.svg" "apps\web\src\app\icon.svg" -Force
```

### Step 3: Regenerate `favicon.ico`
Generate a multi-size `.ico` file (containing 16×16, 32×32, and 48×48 pixel layers) and place it at:
`apps/web/public/favicon.ico`.

You can generate this using Python Pillow:
```python
from PIL import Image
img = Image.open("your_logo.png").convert("RGBA")
img.save("apps/web/public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
```

### Step 4: Verify All Surfaces
1. **Frontend App**: Start dev or run `npm run build` in `apps/web`. Open localhost in Chrome/Firefox/Edge. Verify browser tab displays the new logo icon.
2. **Dashboard & Auth**: Check navigation bar (`/dashboard`), sign-in page (`/login`), and footer (`/`).
3. **PDF Generation**: Download a scan report. Inspect the top left header to verify the updated logo appears crisply.
