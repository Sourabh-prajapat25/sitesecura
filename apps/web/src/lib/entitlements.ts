import { SubscriptionPlan } from "@/types";

/**
 * Normalizes any plan string into a valid SubscriptionPlan tier.
 * Defaults strictly to 'free' if missing or unrecognized.
 */
export function normalizePlan(plan?: string | null): SubscriptionPlan {
  if (!plan) return "free";
  const normalized = plan.toLowerCase().trim();
  if (normalized === "basic") return "basic";
  if (normalized === "pro") return "pro";
  if (normalized === "agency") return "agency";
  if (normalized === "admin") return "admin";
  return "free";
}

/**
 * Continuous Automated Background Monitoring entitlement.
 * Available for: Basic, Pro, Agency, Admin.
 * Locked for: Free.
 */
export function canAccessMonitoring(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "basic" || p === "pro" || p === "agency" || p === "admin";
}

/**
 * Multi-user Workspace & Team Collaboration entitlement.
 * Available for: Pro, Agency, Admin.
 * Locked for: Free, Basic.
 */
export function canAccessTeam(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "pro" || p === "agency" || p === "admin";
}

/**
 * Agency Custom White-Labeling (custom logo, brand colors, custom footer) entitlement.
 * Available for: Agency, Admin.
 * Locked for: Free, Basic, Pro.
 */
export function canAccessWhiteLabel(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "agency" || p === "admin";
}

/**
 * Executive PDF Security Report Download entitlement.
 * Paid plans can download the complete report.
 */
export function canDownloadPdf(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "basic" || p === "pro" || p === "agency" || p === "admin";
}

/**
 * Full security findings visibility (unredacted evidence, how-to-fix remediation guides).
 * Available for: Basic, Pro, Agency, Admin.
 * Free plan sees top 3 findings unlocked and remaining locked.
 */
export function canViewFullFindings(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "basic" || p === "pro" || p === "agency" || p === "admin";
}

/**
 * Full AI Security Advisor (Multi-provider LLM explanations, custom fix guides, prioritized plans, chat).
 * Available for: Pro, Agency, Admin.
 * Locked for: Free, Basic.
 */
export function canAccessAiAdvisor(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "pro" || p === "agency" || p === "admin";
}

/**
 * Deep Website Security Scan entitlement.
 * Available for: Pro, Agency, Admin.
 * Locked for: Free, Basic.
 */
export function canAccessDeepScan(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "pro" || p === "agency" || p === "admin";
}

/**
 * SiteSecura Verified Security Badge & Trust Verification entitlement.
 * Available for: Basic, Pro, Agency, Admin.
 * Locked for: Free.
 */
export function canAccessSecurityBadge(plan?: string | null): boolean {
  const p = normalizePlan(plan);
  return p === "basic" || p === "pro" || p === "agency" || p === "admin";
}


