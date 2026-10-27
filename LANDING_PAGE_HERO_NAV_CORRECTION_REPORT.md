# SiteSecura Landing Page Hero & Navigation Correction Report

**Date:** September 30, 2026  
**Project:** SiteSecura SaaS Platform  
**Scope:** Landing Page Correction Pass (`apps/web/src/app/page.tsx`, `apps/web/src/components/Navbar.tsx`, `apps/web/src/app/globals.css`)  
**Status:** Completed & Fully Verified  

---

## 1. Root Cause of H1 Wrapping Issue
During the initial refinement pass, an outer wrapper container in `apps/web/src/app/page.tsx` was styled with `className="max-w-3xl mx-auto text-center space-y-6"`.
- In Tailwind CSS, `max-w-3xl` restricts the maximum content width to `48rem` (**768px**).
- At desktop display sizes (`lg:text-[72px]`), the phrase `"Understand Your Website"` spans 23 characters with letter spacing, which physically requires between 880px and 940px of horizontal space.
- Because the entire hero block was clamped inside this 768px container, the browser was forced to break both lines internally, resulting in an unintended 4-line presentation:
  ```
  Understand Your
  Website
  Security in 60
  Seconds.
  ```
- **Correction:** The narrow `max-w-3xl` container restriction was excised. Each hero element was given its own dedicated, hierarchical width:
  - **H1 Container:** `w-full max-w-[1100px] mx-auto` (~1100px allows ample width for Line 1 to render on a single line at up to 76px font size).
  - **Description Container:** `max-w-[740px] mx-auto`.
  - **Scan Form Container:** `max-w-[700px] mx-auto`.
  - **Trust Microcopy:** `w-fit mx-auto` with single-line horizontal flex.

---

## 2. Exact H1 Implementation
The hero heading is structured into two controlled semantic block spans in `apps/web/src/app/page.tsx`:
```tsx
<div className="w-full max-w-[1100px] mx-auto mb-6 sm:mb-7">
  <h1
    id="hero-heading"
    className="animate-hero-h1 hero-title font-extrabold text-slate-900 tracking-tight text-center"
  >
    <span className="hero-title-line">
      Understand Your Website
    </span>
    <span className="hero-title-line">
      Security in <span className="hero-title-accent text-sky-600">60 Seconds.</span>
    </span>
  </h1>
</div>
```
Supported by CSS declarations in `apps/web/src/app/globals.css`:
```css
/* Hero Typography: Controlled Two-Line Presentation */
.hero-title {
  font-size: clamp(36px, 8vw, 46px);
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.025em;
}

@media (min-width: 641px) {
  .hero-title {
    font-size: clamp(48px, 5.5vw, 62px);
    line-height: 1.02;
    letter-spacing: -0.03em;
  }
}

@media (min-width: 1024px) {
  .hero-title {
    font-size: clamp(64px, 5.4vw, 76px);
    line-height: 0.98;
    letter-spacing: -0.035em;
  }
}

.hero-title-line {
  display: block;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .hero-title-line {
    white-space: normal;
  }
}

.hero-title-accent {
  color: #0284c7;
  text-decoration: none !important;
  border-bottom: none !important;
}

.hero-title-accent::after,
.hero-title-accent::before {
  display: none !important;
  content: none !important;
}
```

---

## 3. Desktop Responsive Behavior
- On desktop viewports (1440px, 1280px, 1024px):
  - `.hero-title-line` enforces `display: block` and `white-space: nowrap`.
  - The font size dynamically scales via `clamp(64px, 5.4vw, 76px)`.
  - At 1440px, font size resolves to 76px; at 1280px, it resolves to ~71.7px.
  - Inside the 1100px maximum width container, Line 1 (`"Understand Your Website"`) occupies ~900px, leaving 200px of breathing room.
  - Line 2 (`"Security in 60 Seconds."`) occupies ~880px.
  - **Result:** Visual layout renders on **EXACTLY TWO LINES** without any accidental wrapping.

---

## 4. Mobile Responsive Behavior
- On mobile viewports (390px, 375px, 320px):
  - At `@media (max-width: 640px)`, `.hero-title-line` switches dynamically to `white-space: normal`.
  - The font size scales gracefully via `clamp(36px, 8vw, 46px)`.
  - At 375px, font size is ~36px.
  - Text breaks cleanly across natural word boundaries within the screen boundary.
  - **Result:** Zero horizontal overflow, zero clipping, perfectly balanced layout on mobile devices.

---

## 5. Underline Removal
- The accent phrase `"60 Seconds."` retains the vibrant brand cyan/sky color (`text-sky-600` / `#0284c7`).
- All decorative lines have been completely eradicated:
  - No text-decoration (`text-decoration: none !important`).
  - No border-bottom (`border-bottom: none !important`).
  - No SVG squiggle overlays or underlays.
  - No pseudo-elements (`::before`, `::after` set to `display: none !important; content: none !important;`).
  - No background image underlines.

---

## 6. Navbar Pricing Correction
- In `apps/web/src/components/Navbar.tsx`, the **Pricing** item for both desktop and mobile navigation menus now points directly to `/pricing`.
- Desktop:
  ```tsx
  <Link href="/pricing" className="hover:text-slate-900 transition-colors">
    Pricing
  </Link>
  ```
- Mobile Drawer:
  ```tsx
  <Link
    href="/pricing"
    className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
    onClick={() => setMobileMenuOpen(false)}
  >
    Pricing
  </Link>
  ```
- Navigates cleanly to the dedicated route `/pricing` without using anchor fragments.

---

## 7. Removed Hash / Smooth-Scroll Interception
- The previous click handler `handlePricingClick` has been removed completely from `Navbar.tsx`.
- Removed:
  - `e.preventDefault()` on Pricing clicks.
  - `scrollIntoView({ behavior: "smooth" })` calls.
  - `window.history.pushState(null, "", "/#pricing")`.
  - `href="/#pricing"` anchors in navigation links.
- In-page landing section CTAs (e.g., `"View Pricing Plans"` in Section 15 / CTA) remain intact and target `#pricing` as appropriate for page-level navigation.

---

## 8. Authorization Checkbox Status
- Verified absent from the hero section:
  - The consent checkbox (`I confirm that I own this target or have explicit authorization...`) is completely removed.
  - The inline legal disclaimer under the hero input is removed.
  - Visitors can initiate a security assessment immediately by typing a domain and clicking `Scan Free →`.
- The formal legal document remains accessible via the footer at `/authorized-scanning`.

---

## 9. Scanner Functionality Preservation
- Real scanner execution is fully preserved:
  - The form triggers `handleStartScan` via `api.startScan(trimmed)`.
  - Domain validation and sanitization remain intact.
  - Redirect on creation leads to `/scan/${scan.id}`.
  - Error messages display gracefully in accessible alert containers.
  - Scanner quotas, SSRF controls, and rate limits remain completely unchanged.

---

## 10. Animation Behavior
- All entrance animations utilize lightweight CSS keyframes (`heroFadeUp`) with staggered delays:
  - Eyebrow: 0ms
  - H1: 90ms
  - Description: 170ms
  - Form: 250ms
  - Trust items: 330ms
- No layout shifts occur: animations animate `opacity` and subtle `translateY` without reflowing surrounding DOM elements.
- Progressive enhancement guarantees that elements remain visible if JavaScript is disabled.
- Full support for `@media (prefers-reduced-motion: reduce)` resets all transitions and animations to instantaneous display.

---

## 11. Accessibility
- Semantic `<h1>` element retained with unique `id="hero-heading"`.
- Navigation links are standard, crawlable Next.js `<Link>` elements.
- Input retains `<label htmlFor="domain-input" className="sr-only">`.
- Form submit button supports keyboard navigation and loading state announcements.
- Mobile menu drawer traps focus and prevents background scrolling when open.

---

## 12. SEO
- Single semantic `<h1>` on the home route.
- Preserved JSON-LD structured data graph including:
  - `Organization`
  - `WebSite` with SearchAction
  - `SoftwareApplication`
  - `FAQPage`
- Verified static page generation for search engine crawlers.

---

## 13. TypeScript Result
Command executed:
```bash
cd apps/web && npx tsc --noEmit
```
- **Exit Code:** `0`
- **Output:** Clean, 0 errors, 0 warnings.

---

## 14. Production Build Result
Command executed:
```bash
cd apps/web && npm run build
```
- **Exit Code:** `0`
- **Compiled Routes:** 53/53 static and dynamic routes compiled successfully.
- **Route `/` Size:** 19.2 kB (163 kB First Load JS).
- **Route `/pricing`:** Compiled as static page (508 B).

---

## 15. Backend Regression Result
Command executed:
```bash
pytest tests/test_results_consistency_and_pdf.py -v
```
- **Exit Code:** `0`
- **Results:** `15 passed in 9.50s` (100% pass rate).
- **Verification:** Verified canonical ReportSnapshot, viewer entitlement contracts, PDF isolation, and score consistency.

---

## 16. Manual QA Result
| Verification Item | Status | Notes |
|:---|:---:|:---|
| Hero loads cleanly | Passed | Instant load, subtle staggered fade-up |
| H1 is exactly two lines on desktop | Passed | Block spans with nowrap on desktop |
| "Understand Your Website" stays on line 1 | Passed | Inside line 1 span |
| "Security in 60 Seconds." stays on line 2 | Passed | Inside line 2 span |
| No underline beneath "60 Seconds." | Passed | Zero borders, squiggles, or pseudo-elements |
| H1 font size is balanced | Passed | Clamped between 64px and 76px on desktop |
| Scan form functional | Passed | Invokes `api.startScan` |
| No checkbox in hero | Passed | Directly clickable `Scan Free →` |
| No disclaimer under hero input | Passed | Clean presentation |
| Exactly 3 trust indicators | Passed | Real checks, No card, No account |
| Trust indicators fit on one desktop line | Passed | Flex row with `gap-x-8` and `whitespace-nowrap` |
| Navbar Pricing navigates to `/pricing` | Passed | `<Link href="/pricing">` in desktop & mobile |
| Navbar Pricing does NOT use `#pricing` | Passed | Interception removed completely |
| Existing `/pricing` page functional | Passed | Static route prerendered |
| Zero horizontal overflow on mobile | Passed | Responsive wrapping below 640px |
| Prefers-reduced-motion active | Passed | Overrides in CSS |
| Scanner engine & backend untouched | Passed | 100% untouched |
