import { getFirebaseIdToken } from "./auth";
import {
  Scan,
  Website,
  UserProfile,
  Organization,
  AlertItem,
  SubscriptionInfo,
  AuthResponse,
  SubscriptionPlan,
  MonitoringConfig,
  Resource,
  ResourceListResponse,
  ResourceSitemapItem,
  NewsletterSubscriber,
  ContentAnalyticsEventCreate,
  ContentAnalyticsSummary,
  BadgeEligibilityResult,
  WebsiteBadgeStatus,
  SecurityVerificationResponse,
  BadgeRevocationResponse,
  BadgePolicy,
  BadgePolicyUpdateInput,
  OnboardingStatusResponse,
  SessionStatusResponse,
  CheckoutSessionResponse,
  VerifyPaymentPayload,
  VerifyPaymentResult,
  DnsLookupRequest,
  DnsLookupResponse,
  HttpStatusCheckRequest,
  HttpStatusCheckResponse,
  SecurityTxtValidateRequest,
  SecurityTxtValidateResponse,
  RobotsSitemapCheckRequest,
  RobotsSitemapCheckResponse,
  CspPolicyAnalyzeRequest,
  CspPolicyAnalyzeResponse,
} from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

/**
 * Resolves a full asset or logo URL from a relative path or storage reference,
 * correctly handling backend origin and preventing double `/api/v1` path prefixes.
 */
export function resolveAssetUrl(path?: string | null): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  // Already absolute or browser protocol
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // Determine active API base and root origin
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || API_BASE || "http://127.0.0.1:8000/api/v1").trim();
  const apiBase = rawBase.replace(/\/+$/, "");

  // Separate backend origin (stripping /api/v1 if present at end of apiBase)
  const backendOrigin = apiBase.replace(/\/api\/v1\/?$/, "");

  // Ensure leading slash on relative path
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  // If the path itself already includes /api/v1 (like /api/v1/agency/white-label/logo/...),
  // prepend backend origin instead of apiBase to avoid duplicate /api/v1/api/v1/...
  if (cleanPath.startsWith("/api/v1")) {
    return backendOrigin ? `${backendOrigin}${cleanPath}` : cleanPath;
  }

  return `${apiBase}${cleanPath}`;
}

/**
 * Obtains the active Firebase ID token for authenticated API requests.
 * Reliably waits for Firebase session initialization if called during page load.
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const fbToken = await getFirebaseIdToken(forceRefresh);
  if (fbToken) return fbToken;

  // Development bypass token fallback for offline local testing
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    const devToken = localStorage.getItem("scanly_dev_token");
    if (devToken) return devToken;
  }
  return null;
}

/**
 * Robust fetch wrapper for protected API endpoints.
 * Enforces Authorization: Bearer <Firebase ID token> and handles automatic 1-time token refresh on 401.
 */
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
  isRetry: boolean = false
): Promise<any> {
  const token = await getAuthToken(isRetry);
  if (!token) {
    throw new Error("Authentication required. Please sign in to access this feature.");
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    throw new Error(
      "Unable to connect to the SiteSecura API server. Please ensure the backend is running on http://127.0.0.1:8000."
    );
  }

  // If 401 and this is the first attempt, try refreshing token once
  if (response.status === 401 && !isRetry) {
    const freshToken = await getAuthToken(true);
    if (freshToken && freshToken !== token) {
      return await fetchWithAuth(endpoint, options, true);
    }
  }

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: response.statusText } };
    }

    if (response.status === 429) {
      throw new Error(
        "Rate limit exceeded (maximum 3 free scans per 24 hours for anonymous visitors). Please create a free account or upgrade for more scans."
      );
    }

    if (response.status === 500) {
      throw new Error(
        "A server error occurred while processing the request. Please try again in a moment."
      );
    }

    const message =
      errorData?.error?.message ||
      errorData?.detail?.error?.message ||
      errorData?.detail?.message ||
      (typeof errorData?.detail === "string" ? errorData.detail : null) ||
      errorData?.error ||
      `Request failed with status ${response.status}`;

    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  if (response.status === 204) return null;
  return await response.json();
}

/**
 * Fetch wrapper for public/optional-auth endpoints (such as public scanner and report polling).
 */
async function fetchPublic(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    throw new Error(
      "Unable to connect to the SiteSecura API server. Please ensure the backend is running on http://127.0.0.1:8000."
    );
  }

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: response.statusText } };
    }

    const message =
      errorData?.error?.message ||
      errorData?.detail?.error?.message ||
      errorData?.detail?.message ||
      (typeof errorData?.detail === "string" ? errorData.detail : null) ||
      errorData?.error ||
      `Request failed with status ${response.status}`;

    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  if (response.status === 204) return null;
  return await response.json();
}

export const api = {
  // Scans (Public / Optional Auth)
  startScan: async (domain: string, websiteId?: string): Promise<Scan> => {
    return fetchPublic("/scans", {
      method: "POST",
      body: JSON.stringify({ domain, website_id: websiteId || undefined }),
    });
  },

  getScan: async (scanId: string): Promise<Scan> => {
    return fetchPublic(`/scans/${scanId}`);
  },

  getScanStatus: async (
    scanId: string
  ): Promise<{ id: string; status: string; score?: number; risk_level?: string; error_message?: string }> => {
    return fetchPublic(`/scans/${scanId}/status`);
  },

  getPublicScanResults: async (scanId: string): Promise<Scan> => {
    return fetchPublic(`/scans/${scanId}/results`);
  },

  getScanPdfUrl: (scanId?: string): string => {
    return scanId ? `${API_BASE}/scans/${scanId}/pdf` : "#";
  },

  /**
   * Standalone DNS Lookup Tool: queries DNS records for a domain without full perimeter scan.
   */
  dnsLookup: async (payload: DnsLookupRequest): Promise<DnsLookupResponse> => {
    return fetchPublic("/tools/dns-lookup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Standalone HTTP Status & Redirect Checker:
   * Inspects HTTP response status and follows redirect chains hop-by-hop.
   */
  checkHttpStatus: async (payload: HttpStatusCheckRequest): Promise<HttpStatusCheckResponse> => {
    return fetchPublic("/tools/http-status-check", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Standalone security.txt Validator:
   * Validates security disclosure files strictly according to RFC 9116.
   */
  validateSecurityTxt: async (payload: SecurityTxtValidateRequest): Promise<SecurityTxtValidateResponse> => {
    return fetchPublic("/tools/security-txt-validate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Standalone Robots.txt & Sitemap Checker:
   * Fetches and parses robots.txt (RFC 9309) and discovers/validates sitemaps.
   */
  checkRobotsSitemap: async (payload: RobotsSitemapCheckRequest): Promise<RobotsSitemapCheckResponse> => {
    return fetchPublic("/tools/robots-sitemap-check", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Standalone CSP Policy Analyzer:
   * Analyzes pasted Content-Security-Policy or inspects headers from public website.
   */
  analyzeCspPolicy: async (payload: CspPolicyAnalyzeRequest): Promise<CspPolicyAnalyzeResponse> => {
    return fetchPublic("/tools/csp-policy-analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Authenticated PDF download flow for protected security reports.
   * Sends Authorization: Bearer <token>, receives the binary PDF blob,
   * extracts the sanitized server filename, and triggers native browser file save.
   */
  downloadScanPdf: async (scanId: string, domain?: string): Promise<void> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Authentication required to download PDF report. Please sign in.");
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/scans/${scanId}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (networkErr: any) {
      throw new Error(
        "Unable to connect to the SiteSecura API server. Please ensure the backend is running."
      );
    }

    if (!response.ok) {
      let errorMsg = "Failed to download PDF report.";
      try {
        const errorData = await response.json();
        errorMsg =
          errorData?.error?.message ||
          errorData?.detail?.error?.message ||
          errorData?.detail?.message ||
          (typeof errorData?.detail === "string" ? errorData.detail : null) ||
          errorData?.error ||
          errorMsg;
      } catch {
        if (response.status === 401) {
          errorMsg = "Authentication expired. Please sign in again to download the report.";
        } else if (response.status === 403) {
          errorMsg = "Your current plan does not permit downloading this report. Please upgrade.";
        } else if (response.status === 404) {
          errorMsg = "PDF report not found or you are not authorized to view it.";
        } else if (response.status === 429) {
          errorMsg = "PDF download rate limit exceeded. Please wait a moment before trying again.";
        } else if (response.status === 500) {
          errorMsg = "Server error while generating the PDF. Please try again in a few moments.";
        }
      }
      throw new Error(errorMsg);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition");
    let filename = "";
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, "").trim();
      }
    }
    if (!filename) {
      const cleanDomain = (domain || "Target")
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split("?")[0]
        .split("#")[0]
        .split(":")[0]
        .replace(/[^a-zA-Z0-9_.-]/g, "-")
        .replace(/[-_]{2,}/g, "-")
        .replace(/^[-_.]+|[-_.]+$/g, "")
        .slice(0, 80);
      const dateStr = new Date().toISOString().split("T")[0];
      filename = `SiteSecura-Security-Report-${cleanDomain || "Target"}-${dateStr}.pdf`;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },

  downloadWebsitePdf: async (websiteId: string, domain?: string): Promise<void> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Authentication required to download PDF report. Please sign in.");
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/websites/${websiteId}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (networkErr: any) {
      throw new Error(
        "Unable to connect to the SiteSecura API server. Please ensure the backend is running."
      );
    }

    if (!response.ok) {
      let errorMsg = "Failed to download latest PDF report.";
      try {
        const errorData = await response.json();
        errorMsg =
          errorData?.error?.message ||
          errorData?.detail?.error?.message ||
          errorData?.detail?.message ||
          (typeof errorData?.detail === "string" ? errorData.detail : null) ||
          errorData?.error ||
          errorMsg;
      } catch {
        if (response.status === 401) {
          errorMsg = "Authentication expired. Please sign in again to download the report.";
        } else if (response.status === 403) {
          errorMsg = "Your current plan does not permit downloading this report. Please upgrade.";
        } else if (response.status === 404) {
          errorMsg = "No completed scans found for this website.";
        } else if (response.status === 429) {
          errorMsg = "PDF download rate limit exceeded. Please wait a moment before trying again.";
        } else if (response.status === 500) {
          errorMsg = "Server error while generating the PDF. Please try again in a few moments.";
        }
      }
      throw new Error(errorMsg);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition");
    let filename = "";
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, "").trim();
      }
    }
    if (!filename) {
      const cleanDomain = (domain || "Target")
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split("?")[0]
        .split("#")[0]
        .split(":")[0]
        .replace(/[^a-zA-Z0-9_.-]/g, "-")
        .replace(/[-_]{2,}/g, "-")
        .replace(/^[-_.]+|[-_.]+$/g, "")
        .slice(0, 80);
      const dateStr = new Date().toISOString().split("T")[0];
      filename = `SiteSecura-Security-Report-${cleanDomain || "Target"}-${dateStr}.pdf`;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },

  // Auth & Profile (Protected)
  getCurrentUser: async (): Promise<AuthResponse> => {
    return fetchWithAuth("/auth/me");
  },

  syncUser: async (): Promise<AuthResponse> => {
    return fetchWithAuth("/auth/sync", { method: "POST" });
  },

  // Websites (Protected)
  getWebsites: async (): Promise<Website[]> => {
    return fetchWithAuth("/websites");
  },

  getWebsite: async (id: string): Promise<Website> => {
    return fetchWithAuth(`/websites/${id}`);
  },

  createWebsite: async (data: {
    domain: string;
    name?: string;
    monitoring_enabled?: boolean;
    monitoring_frequency?: string;
  }): Promise<Website> => {
    return fetchWithAuth("/websites", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateWebsite: async (id: string, data: Partial<Website>): Promise<Website> => {
    return fetchWithAuth(`/websites/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteWebsite: async (id: string): Promise<void> => {
    return fetchWithAuth(`/websites/${id}`, { method: "DELETE" });
  },

  triggerWebsiteScan: async (id: string): Promise<Scan> => {
    return fetchWithAuth(`/websites/${id}/scan`, { method: "POST" });
  },

  triggerWebsiteDeepScan: async (id: string): Promise<Scan> => {
    return fetchWithAuth(`/websites/${id}/deep-scan`, { method: "POST" });
  },

  getWebsiteDeepScan: async (websiteId: string, scanId: string): Promise<Scan> => {
    return fetchWithAuth(`/websites/${websiteId}/deep-scans/${scanId}`);
  },

  getWebsiteScans: async (id: string): Promise<Scan[]> => {
    return fetchWithAuth(`/websites/${id}/scans`);
  },

  // Website Monitoring (Protected)
  getWebsiteMonitoring: async (websiteId: string): Promise<MonitoringConfig> => {
    return fetchWithAuth(`/websites/${websiteId}/monitoring`);
  },

  enableWebsiteMonitoring: async (
    websiteId: string,
    frequency: "weekly" | "daily" = "weekly"
  ): Promise<MonitoringConfig> => {
    return fetchWithAuth(`/websites/${websiteId}/monitoring`, {
      method: "POST",
      body: JSON.stringify({ frequency }),
    });
  },

  updateWebsiteMonitoring: async (
    websiteId: string,
    data: { frequency?: "weekly" | "daily"; is_active?: boolean }
  ): Promise<MonitoringConfig> => {
    return fetchWithAuth(`/websites/${websiteId}/monitoring`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  disableWebsiteMonitoring: async (websiteId: string): Promise<void> => {
    return fetchWithAuth(`/websites/${websiteId}/monitoring`, {
      method: "DELETE",
    });
  },

  // Verified Badge (Protected)
  getBadgeEligibility: async (websiteId: string): Promise<BadgeEligibilityResult> => {
    return fetchWithAuth(`/websites/${websiteId}/badge/eligibility`);
  },

  getBadgeStatus: async (websiteId: string): Promise<WebsiteBadgeStatus> => {
    return fetchWithAuth(`/websites/${websiteId}/badge`);
  },

  verifyBadge: async (websiteId: string): Promise<SecurityVerificationResponse> => {
    return fetchWithAuth(`/websites/${websiteId}/badge/verify`, {
      method: "POST",
    });
  },

  revokeBadge: async (websiteId: string): Promise<BadgeRevocationResponse> => {
    return fetchWithAuth(`/websites/${websiteId}/badge`, {
      method: "DELETE",
    });
  },

  // Admin Security Badge Policy (Protected Admin)
  getAdminBadgePolicy: async (): Promise<BadgePolicy> => {
    return fetchWithAuth("/admin/badges/policy");
  },

  updateAdminBadgePolicy: async (data: BadgePolicyUpdateInput): Promise<BadgePolicy> => {
    return fetchWithAuth("/admin/badges/policy", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  listAdminBadgePolicies: async (): Promise<BadgePolicy[]> => {
    return fetchWithAuth("/admin/badges/policies");
  },


  // Alerts (Protected)
  getAlerts: async (): Promise<AlertItem[]> => {
    return fetchWithAuth("/alerts");
  },

  updateAlertStatus: async (id: string, status: "read" | "dismissed"): Promise<AlertItem> => {
    return fetchWithAuth(`/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  // Billing (Protected)
  getBilling: async (): Promise<SubscriptionInfo> => {
    return fetchWithAuth("/billing");
  },

  createCheckoutSession: async (
    plan: string,
    interval: string = "month",
    currency: "inr" | "usd" = "inr",
    provider?: "razorpay" | "stripe"
  ): Promise<CheckoutSessionResponse> => {
    return fetchWithAuth("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, interval, currency, provider }),
    });
  },

  verifyPayment: async (
    payload: VerifyPaymentPayload
  ): Promise<VerifyPaymentResult> => {
    return fetchWithAuth("/billing/verify-payment", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cancelSubscription: async (
    cancelAtPeriodEnd: boolean = true
  ): Promise<{ status: string; message: string; cancel_at_period_end: boolean }> => {
    return fetchWithAuth("/billing/cancel", {
      method: "POST",
      body: JSON.stringify({ cancel_at_period_end: cancelAtPeriodEnd }),
    });
  },

  createCustomerPortal: async (): Promise<{ portal_url: string }> => {
    return fetchWithAuth("/billing/portal", { method: "POST" });
  },

  getBillingSessionStatus: async (
    sessionId: string
  ): Promise<SessionStatusResponse> => {
    return fetchWithAuth(`/billing/session-status?session_id=${encodeURIComponent(sessionId)}`);
  },

  // Onboarding & Plan Selection (Protected)
  getOnboardingStatus: async (): Promise<OnboardingStatusResponse> => {
    return fetchWithAuth("/onboarding/status");
  },

  activateFreePlan: async (): Promise<{ success: boolean; plan: string; onboarding_status: string; message: string }> => {
    return fetchWithAuth("/onboarding/activate-free", { method: "POST" });
  },

  createOnboardingCheckout: async (
    plan: string,
    interval: string = "month",
    currency: "inr" | "usd" = "inr",
    provider?: "razorpay" | "stripe"
  ): Promise<CheckoutSessionResponse> => {
    return fetchWithAuth("/onboarding/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, interval, currency, provider }),
    });
  },

  cancelCheckout: async (
    sessionId?: string
  ): Promise<{ status: string; onboarding_status: string }> => {
    const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    return fetchWithAuth(`/onboarding/cancel-checkout${query}`, { method: "POST" });
  },

  // White Label & Agency (Protected)
  getWhiteLabelSettings: async (): Promise<Organization> => {
    return fetchWithAuth("/agency/white-label");
  },

  updateWhiteLabelSettings: async (data: Partial<Organization>): Promise<Organization> => {
    return fetchWithAuth("/agency/white-label", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  uploadWhiteLabelLogo: async (file: File): Promise<Organization> => {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Authentication required. Please sign in to upload branding assets.");
    }
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/agency/white-label/logo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.detail?.error?.message || err?.detail?.message || err?.detail || "Failed to upload branding logo.");
    }

    return response.json();
  },

  deleteWhiteLabelLogo: async (): Promise<Organization> => {
    return fetchWithAuth("/agency/white-label/logo", { method: "DELETE" });
  },

  getTeamMembers: async (): Promise<any[]> => {
    return fetchWithAuth("/agency/members");
  },

  inviteTeamMember: async (email: string, role: string): Promise<any> => {
    return fetchWithAuth("/agency/invite", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },

  removeTeamMember: async (memberId: string): Promise<void> => {
    return fetchWithAuth(`/agency/members/${memberId}`, { method: "DELETE" });
  },

  updateTeamMemberRole: async (memberId: string, role: string): Promise<any> => {
    return fetchWithAuth(`/agency/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  // CMS & Blog
  getBlogPosts: async (params?: {
    q?: string;
    category?: string;
    tag?: string;
    author?: string;
    featured?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.q) q.set("q", params.q);
    if (params?.category) q.set("category", params.category);
    if (params?.tag) q.set("tag", params.tag);
    if (params?.author) q.set("author", params.author);
    if (params?.featured !== undefined) q.set("featured", String(params.featured));
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.page_size !== undefined) q.set("page_size", String(params.page_size));
    const qs = q.toString();
    return fetchPublic(`/blog/posts${qs ? `?${qs}` : ""}`);
  },

  getBlogPost: async (slug: string): Promise<any> => {
    return fetchPublic(`/blog/posts/${slug}`);
  },

  getBlogRelatedPosts: async (slug: string): Promise<any[]> => {
    try {
      return await fetchPublic(`/blog/posts/${slug}/related`);
    } catch {
      return [];
    }
  },

  getBlogTags: async (): Promise<any[]> => {
    try {
      return await fetchPublic("/blog/tags");
    } catch {
      return [];
    }
  },

  getBlogAuthors: async (): Promise<any[]> => {
    try {
      return await fetchPublic("/blog/authors");
    } catch {
      return [];
    }
  },

  getBlogRedirect: async (slug: string): Promise<any | null> => {
    try {
      return await fetchPublic(`/blog/redirects/${slug}`);
    } catch {
      return null;
    }
  },

  getBlogSitemapPosts: async (): Promise<any[]> => {
    try {
      return await fetchPublic("/blog/sitemap-posts");
    } catch {
      return [];
    }
  },

  getBlogCategories: async (): Promise<any[]> => {
    return fetchPublic("/blog/categories");
  },

  getAdminBlogRedirects: async (): Promise<any[]> => {
    return fetchWithAuth("/admin/blog/redirects");
  },

  // ==========================================
  // Phase E7: Resources & Content Ecosystem
  // ==========================================
  getResources: async (params?: {
    resource_type?: string;
    category?: string;
    q?: string;
    page?: number;
    page_size?: number;
  }): Promise<ResourceListResponse> => {
    const q = new URLSearchParams();
    if (params?.resource_type) q.set("resource_type", params.resource_type);
    if (params?.category) q.set("category", params.category);
    if (params?.q) q.set("q", params.q);
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.page_size !== undefined) q.set("page_size", String(params.page_size));
    const qs = q.toString();
    return fetchPublic(`/resources${qs ? `?${qs}` : ""}`);
  },

  getResource: async (slug: string): Promise<Resource> => {
    return fetchPublic(`/resources/${slug}`);
  },

  getResourceSitemapItems: async (): Promise<ResourceSitemapItem[]> => {
    try {
      return await fetchPublic("/resources/sitemap/items");
    } catch {
      return [];
    }
  },

  subscribeNewsletter: async (
    email: string,
    source: string = "blog"
  ): Promise<{ status: string; message: string }> => {
    return fetchPublic("/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify({ email, source }),
    });
  },

  unsubscribeNewsletter: async (
    email: string
  ): Promise<{ status: string; message: string }> => {
    return fetchPublic("/newsletter/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  recordContentAnalyticsEvent: async (
    eventData: ContentAnalyticsEventCreate
  ): Promise<any> => {
    try {
      return await fetchPublic("/analytics/events", {
        method: "POST",
        body: JSON.stringify(eventData),
      });
    } catch {
      return null;
    }
  },

  submitDocFeedback: async (data: {
    article_slug: string;
    category?: string;
    helpful: boolean;
    reason?: string;
    path?: string;
  }): Promise<{ status: string; message: string; helpful: boolean } | null> => {
    try {
      return await fetchPublic("/docs/feedback", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch {
      return null;
    }
  },

  getAdminContentAnalytics: async (
    days: number = 30
  ): Promise<ContentAnalyticsSummary> => {
    return fetchWithAuth(`/admin/analytics/content?days=${days}`);
  },

  getAdminResources: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<ResourceListResponse> => {
    const q = new URLSearchParams();
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.page_size !== undefined) q.set("page_size", String(params.page_size));
    const qs = q.toString();
    return fetchWithAuth(`/admin/resources${qs ? `?${qs}` : ""}`);
  },

  createAdminResource: async (data: Partial<Resource>): Promise<Resource> => {
    return fetchWithAuth("/admin/resources", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAdminResource: async (
    id: string,
    data: Partial<Resource>
  ): Promise<Resource> => {
    return fetchWithAuth(`/admin/resources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAdminResource: async (id: string): Promise<any> => {
    return fetchWithAuth(`/admin/resources/${id}`, {
      method: "DELETE",
    });
  },

  getAdminNewsletterSubscribers: async (params?: {
    page?: number;
    page_size?: number;
  }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.page !== undefined) q.set("page", String(params.page));
    if (params?.page_size !== undefined) q.set("page_size", String(params.page_size));
    const qs = q.toString();
    return fetchWithAuth(`/admin/newsletter/subscribers${qs ? `?${qs}` : ""}`);
  },

  submitContact: async (data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<any> => {
    return fetchPublic("/contact", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  createSupportTicket: async (data: {
    subject: string;
    message: string;
    priority: string;
  }): Promise<any> => {
    return fetchWithAuth("/support/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Admin (Protected)
  getAdminMetrics: async (): Promise<any> => {
    return fetchWithAuth("/admin/metrics");
  },

  getAdminDashboard: async (): Promise<any> => {
    return fetchWithAuth("/admin/dashboard");
  },

  getAdminUsers: async (params?: { search?: string; role?: string; is_active?: boolean; limit?: number; offset?: number }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.role) q.set("role", params.role);
    if (params?.is_active !== undefined) q.set("is_active", String(params.is_active));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/users${qs ? `?${qs}` : ""}`);
  },

  getAdminUserDetail: async (userId: string): Promise<any> => {
    return fetchWithAuth(`/admin/users/${userId}`);
  },

  updateAdminUserStatus: async (userId: string, data: { is_active: boolean; reason?: string }): Promise<any> => {
    return fetchWithAuth(`/admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAdminUser: async (userId: string): Promise<any> => {
    return fetchWithAuth(`/admin/users/${userId}`, { method: "DELETE" });
  },

  getAdminOrganizations: async (params?: { search?: string; limit?: number; offset?: number }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/organizations${qs ? `?${qs}` : ""}`);
  },

  getAdminWebsites: async (params?: { search?: string; org_id?: string; limit?: number; offset?: number }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.org_id) q.set("org_id", params.org_id);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/websites${qs ? `?${qs}` : ""}`);
  },

  forceAdminScan: async (websiteId: string): Promise<any> => {
    return fetchWithAuth(`/admin/websites/${websiteId}/force-scan`, { method: "POST" });
  },

  deleteAdminWebsite: async (websiteId: string): Promise<any> => {
    return fetchWithAuth(`/admin/websites/${websiteId}`, { method: "DELETE" });
  },

  getAdminScans: async (params?: { status?: string; search?: string; limit?: number; offset?: number }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/scans${qs ? `?${qs}` : ""}`);
  },

  retryAdminScan: async (id: string): Promise<any> => {
    return fetchWithAuth(`/admin/scans/${id}/retry`, { method: "POST" });
  },

  deleteAdminScan: async (id: string): Promise<any> => {
    return fetchWithAuth(`/admin/scans/${id}`, { method: "DELETE" });
  },

  getAdminSubscriptions: async (params?: { limit?: number; offset?: number }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/subscriptions${qs ? `?${qs}` : ""}`);
  },

  overrideAdminPlan: async (data: { organization_id: string; new_plan: string; reason: string }): Promise<any> => {
    return fetchWithAuth("/admin/subscriptions/override-plan", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getAdminCoupons: async (): Promise<any> => {
    return fetchWithAuth("/admin/coupons");
  },

  getAdminBlogPosts: async (): Promise<any[]> => {
    return fetchWithAuth("/admin/blog/posts");
  },

  createAdminBlogPost: async (data: any): Promise<any> => {
    return fetchWithAuth("/admin/blog/posts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAdminBlogPost: async (postId: string, data: any): Promise<any> => {
    return fetchWithAuth(`/admin/blog/posts/${postId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAdminBlogPost: async (postId: string): Promise<any> => {
    return fetchWithAuth(`/admin/blog/posts/${postId}`, { method: "DELETE" });
  },

  getAdminBlogCategories: async (): Promise<any[]> => {
    return fetchWithAuth("/admin/blog/categories");
  },

  createAdminBlogCategory: async (data: { name: string; slug?: string; description?: string }): Promise<any> => {
    return fetchWithAuth("/admin/blog/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAdminBlogCategory: async (categoryId: string, data: { name?: string; slug?: string; description?: string }): Promise<any> => {
    return fetchWithAuth(`/admin/blog/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAdminBlogCategory: async (categoryId: string): Promise<any> => {
    return fetchWithAuth(`/admin/blog/categories/${categoryId}`, { method: "DELETE" });
  },

  // Tags Management (Phase E5)
  getAdminBlogTags: async (): Promise<any[]> => {
    return fetchWithAuth("/admin/blog/tags");
  },

  createAdminBlogTag: async (data: { name: string; slug?: string; description?: string }): Promise<any> => {
    return fetchWithAuth("/admin/blog/tags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAdminBlogTag: async (tagId: string, data: { name?: string; slug?: string; description?: string }): Promise<any> => {
    return fetchWithAuth(`/admin/blog/tags/${tagId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAdminBlogTag: async (tagId: string): Promise<any> => {
    return fetchWithAuth(`/admin/blog/tags/${tagId}`, { method: "DELETE" });
  },

  // Authors Management (Phase E5)
  getAdminBlogAuthors: async (): Promise<any[]> => {
    return fetchWithAuth("/admin/blog/authors");
  },

  createAdminBlogAuthor: async (data: { name: string; slug?: string; bio?: string; avatar_url?: string }): Promise<any> => {
    return fetchWithAuth("/admin/blog/authors", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAdminBlogAuthor: async (authorId: string, data: { name?: string; slug?: string; bio?: string; avatar_url?: string }): Promise<any> => {
    return fetchWithAuth(`/admin/blog/authors/${authorId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAdminBlogAuthor: async (authorId: string): Promise<any> => {
    return fetchWithAuth(`/admin/blog/authors/${authorId}`, { method: "DELETE" });
  },

  // Media Management (Phase E3)
  getAdminBlogMedia: async (params?: { search?: string; limit?: number; offset?: number }): Promise<{ items: any[]; total: number; limit: number; offset: number }> => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/blog/media${qs ? `?${qs}` : ""}`);
  },

  getAdminBlogMediaAsset: async (mediaId: string): Promise<any> => {
    return fetchWithAuth(`/admin/blog/media/${mediaId}`);
  },

  uploadAdminBlogMedia: async (file: File, altText?: string, caption?: string): Promise<any> => {
    const formData = new FormData();
    formData.append("file", file);
    if (altText) formData.append("alt_text", altText);
    if (caption) formData.append("caption", caption);
    return fetchWithAuth("/admin/blog/media", {
      method: "POST",
      body: formData,
    });
  },

  updateAdminBlogMedia: async (mediaId: string, data: { alt_text?: string; caption?: string }): Promise<any> => {
    return fetchWithAuth(`/admin/blog/media/${mediaId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteAdminBlogMedia: async (mediaId: string): Promise<any> => {
    return fetchWithAuth(`/admin/blog/media/${mediaId}`, { method: "DELETE" });
  },

  getAdminSupportTickets: async (params?: { status?: string; limit?: number; offset?: number }): Promise<any[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/support/tickets${qs ? `?${qs}` : ""}`);
  },

  updateAdminSupportTicket: async (ticketId: string, data: { status?: string; priority?: string }): Promise<any> => {
    return fetchWithAuth(`/admin/support/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getAdminContacts: async (params?: { status?: string; limit?: number; offset?: number }): Promise<any[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/support/contacts${qs ? `?${qs}` : ""}`);
  },

  updateAdminContact: async (contactId: string, data: { status: string }): Promise<any> => {
    return fetchWithAuth(`/admin/support/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getAdminAuditLogs: async (params?: { action?: string; entity_type?: string; limit?: number; offset?: number }): Promise<any> => {
    const q = new URLSearchParams();
    if (params?.action) q.set("action", params.action);
    if (params?.entity_type) q.set("entity_type", params.entity_type);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchWithAuth(`/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },

  getAdminSystemHealth: async (): Promise<any> => {
    return fetchWithAuth("/admin/system/health");
  },

  getAdminAnalytics: async (): Promise<any> => {
    return fetchWithAuth("/admin/analytics");
  },

  getAdminEmailTemplates: async (): Promise<any> => {
    return fetchWithAuth("/admin/email-templates");
  },


  // AI Security Advisor (Pro & Agency)
  explainFinding: async (scanId: string, checkId: string, mode: string = "standard"): Promise<any> => {
    return fetchWithAuth("/ai/explain-finding", {
      method: "POST",
      body: JSON.stringify({ scan_id: scanId, check_id: checkId, mode }),
    });
  },

  generateFixGuide: async (scanId: string, checkId: string, targetEnv?: string): Promise<any> => {
    return fetchWithAuth("/ai/fix-guide", {
      method: "POST",
      body: JSON.stringify({ scan_id: scanId, check_id: checkId, target_env: targetEnv }),
    });
  },

  getSecuritySummary: async (scanId: string): Promise<any> => {
    return fetchWithAuth("/ai/security-summary", {
      method: "POST",
      body: JSON.stringify({ scan_id: scanId }),
    });
  },

  getSecurityPlan: async (scanId: string): Promise<any> => {
    return fetchWithAuth("/ai/security-plan", {
      method: "POST",
      body: JSON.stringify({ scan_id: scanId }),
    });
  },

  chatWithAdvisor: async (
    scanId: string,
    message: string,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<any> => {
    return fetchWithAuth("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        scan_id: scanId,
        message,
        conversation_history: conversationHistory,
      }),
    });
  },

  getAiUsage: async (): Promise<{
    plan: string;
    used: number;
    limit: number;
    remaining: number;
    reset_at: string;
  }> => {
    return fetchWithAuth("/ai/usage");
  },

  getAiStatus: async (): Promise<{
    enabled: boolean;
    primary_provider: string;
    provider_order: string[];
    models: Record<string, string>;
  }> => {
    return fetchWithAuth("/ai/status");
  },
};

