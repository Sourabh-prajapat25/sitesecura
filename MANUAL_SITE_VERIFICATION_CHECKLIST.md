# SiteSecura SaaS — Manual Site Verification Checklist

**Document Purpose:**  
This checklist provides step-by-step human-executable test workflows to manually verify the complete SiteSecura SaaS platform in a browser against a running production or staging environment.

---

## Pre-Requisites for Manual Verification

1. Backend running: `http://localhost:8000` (or `https://api.yourdomain.com`)
2. Frontend running: `http://localhost:3000` (or `https://app.yourdomain.com`)
3. Redis and Celery worker running (for asynchronous background scan execution).
4. Modern web browser (Chrome, Firefox, Safari, or Edge) with Developer Tools (F12) available.

---

## 1. User Registration & Free User Onboarding

- **ACTION:** Navigate to `/register`. Fill in a valid email address and secure password. Click **Create Account**.
- **EXPECTED RESULT:** Account is created via Firebase. You are redirected to `/dashboard`. A personal workspace organization is automatically provisioned with the **Free** tier.
- [ ] **PASS** / [ ] **FAIL**

---

## 2. Add Website (Free Tier Limit Enforcement)

- **ACTION:** On the `/dashboard/websites` page, click **Add Website**. Enter domain `https://example.com` and submit. Then, attempt to add a second website `https://example.org`.
- **EXPECTED RESULT:** The first website is successfully added (1/1 website used). The second attempt displays a plan limit banner or dialog stating that the Free plan permits a maximum of 1 website, offering an upgrade to Basic or Pro.
- [ ] **PASS** / [ ] **FAIL**

---

## 3. Run Normal Scan (Free User)

- **ACTION:** From the website details page or the dashboard, click **Scan Now** for `example.com`. Wait for completion.
- **EXPECTED RESULT:** Scan status moves from "queued" -> "running" -> "completed". A security score (0–100) and risk level are calculated. The scan completes within 10–30 seconds.
- [ ] **PASS** / [ ] **FAIL**

---

## 4. Verify Scan Quota Accounting (Free Tier)

- **ACTION:** Navigate to `/dashboard/billing` or observe the scan usage widget in the dashboard sidebar.
- **EXPECTED RESULT:** The scan quota reflects `1 / 10 scans used` for the current month. The quota bar increments by exactly 1.
- [ ] **PASS** / [ ] **FAIL**

---

## 5. Verify Server-Side Finding Protection (Free Tier)

- **ACTION:** On the scan results page (`/scan/{id}`), review the listed findings. Open your browser Developer Tools (F12) -> **Network** tab -> inspect the JSON response for `/api/v1/scans/{id}` or `/api/v1/scans/{id}/results`.
- **EXPECTED RESULT:** The top 3 findings show full details. Findings 4 and higher are labeled as "Security Finding #N" with status "locked". In the Network tab JSON response, `evidence`, `how_to_fix`, and `why_it_matters` are strictly `null` (zero DevTools data leakage).
- [ ] **PASS** / [ ] **FAIL**

---

## 6. Verify Deep Scan Entitlement Gate (Free Tier)

- **ACTION:** Attempt to trigger a Deep Scan from `/dashboard/websites/{id}` by clicking the **Run Deep Scan** button, or directly navigating to `/dashboard/websites/{id}/deep-scan`.
- **EXPECTED RESULT:** The UI indicates that Deep Scan is a Pro and Agency feature. If the button is clicked, an upgrade prompt appears. Direct API POST to `/api/v1/websites/{id}/deep-scan` returns HTTP 403 `DEEP_SCAN_FEATURE_REQUIRED`.
- [ ] **PASS** / [ ] **FAIL**

---

## 7. Upgrade Plan (Simulated or Live Checkout)

- **ACTION:** Navigate to `/dashboard/billing`. Click **Upgrade to Pro** ($29/month). Complete the checkout process (using Stripe test card or staging mock session).
- **EXPECTED RESULT:** You are redirected back to `/dashboard/billing?status=success`. Your active plan badge immediately updates to **Pro**. Website limit increases to 10; monthly scan quota increases to 500.
- [ ] **PASS** / [ ] **FAIL**

---

## 8. Run Deep Website Security Scan (Pro Tier)

- **ACTION:** Navigate to `/dashboard/websites/{id}` and click **Run Deep Scan**.
- **EXPECTED RESULT:** The scan begins. The scan type is marked as `deep`. Phases execute sequentially:
  - F1: Surface Discovery & Assets
  - F2: TLS / DNS / Transport
  - F3: Frontend / JavaScript & Secrets
  - F4: HTTP / API / Security Headers
  - F5: Authentication & Session Posture
  - F6: Infrastructure & Cloud Exposure
  - F7: Sensitive Data & Privacy Exposure
  - F8: Correlation & Risk Graph
  Status displays a live step-by-step progress indicator and finishes with status `completed`.
- [ ] **PASS** / [ ] **FAIL**

---

## 9. Verify Unified 1-Credit Model for Deep Scan

- **ACTION:** Check `/dashboard/billing` immediately after the Deep Scan finishes.
- **EXPECTED RESULT:** The monthly scan count increased by **exactly 1 credit** (e.g. from 1 to 2). Deep Scan F1–F8 never consumes multiple credits.
- [ ] **PASS** / [ ] **FAIL**

---

## 10. Verify Security Intelligence Tab (F8 Attack Graph & Correlation)

- **ACTION:** On the completed Deep Scan view (`/dashboard/websites/{id}/deep-scan`), click the **Security Intelligence** tab.
- **EXPECTED RESULT:**
  1. **Executive Posture Card:** Displays overall security grade, posture summary, and attack surface resilience score.
  2. **Attack-Surface Risk Chains:** Shows visualized chains linking root vulnerabilities (e.g., DNS misconfiguration -> Cloud takeover risk).
  3. **Root-Cause Analysis:** Groups findings by underlying cause (e.g., "Missing Defensive Headers", "Insecure Transport").
  4. **Remediation Roadmap:** Lists prioritized fixes grouped into "Immediate (24–48h)", "Short-Term (1–2 weeks)", and "Strategic".
- [ ] **PASS** / [ ] **FAIL**

---

## 11. Verify Unredacted Findings for Pro User

- **ACTION:** Browse the **Findings** tab on the Deep Scan results page.
- **EXPECTED RESULT:** All findings across all categories display full technical descriptions, evidence, remediation instructions, and severity ratings without any "locked" masks.
- [ ] **PASS** / [ ] **FAIL**

---

## 12. Test AI Security Advisor (Pro Tier)

- **ACTION:** Click the **AI Advisor** button or **Explain with AI** on any high-severity finding.
- **EXPECTED RESULT:** The AI Security Advisor modal opens. The AI generates a structured, plain-English explanation, discusses potential exploitation impact, and outlines specific code/configuration remediation steps.
- [ ] **PASS** / [ ] **FAIL**

---

## 13. Generate and Download Executive PDF Report

- **ACTION:** Click **Export PDF** or **Download Security Report** from the scan view.
- **EXPECTED RESULT:** A professional PDF document is generated and downloaded (`SiteSecura-Security-Report-<domain>-<date>.pdf`). The PDF contains the SiteSecura header, executive summary, posture score, categorized findings, and remediation guidance.
- [ ] **PASS** / [ ] **FAIL**

---

## 14. Test Scheduled Monitoring & Alerts

- **ACTION:** Navigate to `/dashboard/monitoring`. Enable monitoring for your website and select frequency (Daily for Pro).
- **EXPECTED RESULT:** Monitoring status toggles to `Active`. Next scheduled run time is displayed. Navigate to `/dashboard/alerts` to confirm the alerts feed loads without errors.
- [ ] **PASS** / [ ] **FAIL**

---

## 15. Verify Multi-Tenant IDOR Protection (Cross-Tenant URL Access)

- **ACTION:**
  1. Open an incognito browser window.
  2. Register or log in as a second user (`User B` in `Org B`).
  3. Copy the URL of a scan or website created by `User A` (`/dashboard/websites/{user_a_site_id}` or `/scan/{user_a_scan_id}`).
  4. Paste and navigate to that URL in `User B`'s session.
- **EXPECTED RESULT:** User B receives a clean **404 Not Found** page. No data, domain names, or finding titles from User A are visible to User B.
- [ ] **PASS** / [ ] **FAIL**

---

## 16. Verify Admin Access Protection

- **ACTION:** While logged in as a normal user (Free, Pro, or Agency), attempt to navigate to `/admin` or call `GET /api/v1/admin/metrics`.
- **EXPECTED RESULT:** The `/admin` web route immediately redirects to `/dashboard` (or displays an Access Denied message). The direct API request returns HTTP 403 `ADMIN_ACCESS_REQUIRED`.
- [ ] **PASS** / [ ] **FAIL**

---

## 17. Verify Dashboard State Persistence After Page Refresh

- **ACTION:** On `/dashboard`, perform a hard browser refresh (Ctrl+F5 / Cmd+Shift+R).
- **EXPECTED RESULT:** The dashboard reloads seamlessly without session loss, infinite loading spinners, or hydration mismatches. Websites, recent scan cards, and quota widgets display up-to-date data.
- [ ] **PASS** / [ ] **FAIL**

---

## 18. Verify Logout & Session Termination

- **ACTION:** Click the user avatar/profile menu in the top right and select **Sign Out**.
- **EXPECTED RESULT:** Firebase session and local auth tokens are cleared. You are redirected to `/login`. Pressing the browser **Back** button does not allow accessing authenticated dashboard pages.
- [ ] **PASS** / [ ] **FAIL**

---

## 19. Verify Mobile & Responsive Layout

- **ACTION:** Open Developer Tools (F12) -> toggle Device Toolbar -> switch to mobile emulation (e.g. iPhone 14 or Pixel 7). Browse `/`, `/pricing`, `/dashboard`, and `/scan/{id}`.
- **EXPECTED RESULT:** Navigation collapses into a responsive hamburger menu. Tables and cards wrap cleanly with zero horizontal scrollbar overflow. Deep Scan graphs and tabs resize appropriately.
- [ ] **PASS** / [ ] **FAIL**

---

## 20. Verify Browser Console for Errors

- **ACTION:** Open Developer Tools (F12) -> **Console** tab while navigating between Dashboard, Scans, Intelligence Graph, and Settings.
- **EXPECTED RESULT:** Zero uncaught JavaScript errors (`Uncaught TypeError`, `Uncaught ReferenceError`). No React hydration mismatch errors.
- [ ] **PASS** / [ ] **FAIL**

---

## Sign-Off Summary

- **Environment Tested:** Staging / Production
- **Tester Name:** ___________________________
- **Date Tested:** ___________________________
- **Total Workflows:** 20
- **Total Passed:** _____ / 20
- **Overall Result:** [ ] READY FOR PRODUCTION / [ ] ISSUES FOUND
