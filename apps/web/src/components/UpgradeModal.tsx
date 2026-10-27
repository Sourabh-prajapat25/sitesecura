"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  Check,
  Lock,
  ArrowRight,
  ShieldCheck,
  FileText,
  Activity,
  BrainCircuit,
  Users,
  Building2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { getPricingPlans } from "@/lib/constants";
import { normalizePlan } from "@/lib/entitlements";
import { RazorpayCheckoutModal } from "@/components/pricing/RazorpayCheckoutModal";
import { CheckoutSessionResponse, SubscriptionPlan } from "@/types";

export type UpgradeContextType =
  | "monitoring"
  | "pdf"
  | "ai_guide"
  | "locked_findings"
  | "history"
  | "deep_scan"
  | "security_badge"
  | "team"
  | "white_label"
  | "general";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextType?: UpgradeContextType;
  featureName?: string;
  customTitle?: string;
  customDescription?: string;
  customBenefits?: string[];
  recommendedPlan?: "basic" | "pro" | "agency";
  currentPlan?: string;
}

const PLAN_TIER_ORDER: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  agency: 3,
  admin: 4,
};

const CONTEXT_CONFIGS: Record<
  UpgradeContextType,
  {
    title: string;
    description: string;
    benefits: string[];
    plan: "basic" | "pro" | "agency";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  deep_scan: {
    title: "Deep Website Security Scan",
    description:
      "Perform a broader passive security assessment across discovered public pages, multi-page security headers, cookies, mixed content, forms, and JavaScript resources.",
    benefits: [
      "Discovery of internal pages and sitemap/robots paths",
      "Multi-page security header consistency checks",
      "Cookie security and mixed-content detection",
      "Public form analysis and resource inventory",
    ],
    plan: "pro",
    icon: ShieldCheck,
  },
  monitoring: {
    title: "Continuous Automated Monitoring",
    description:
      "Automatically check your website on a schedule and receive instant notifications whenever security configurations, SSL certs, or headers change.",
    benefits: [
      "Weekly automated scans (Daily on Pro)",
      "Instant email alerts on score drops",
      "SSL certificate expiration warnings",
      "Security header removal detection",
    ],
    plan: "basic",
    icon: Activity,
  },
  pdf: {
    title: "Executive PDF Security Reports",
    description:
      "Generate clean, professional audit reports that you can download, print, or share with clients, investors, compliance officers, and developers.",
    benefits: [
      "Executive summary & security score",
      "Complete checklist and verified findings",
      "Remediation timelines & guidance",
      "Shareable stakeholder documentation",
    ],
    plan: "basic",
    icon: FileText,
  },
  ai_guide: {
    title: "AI Fix Guidance & Remediation",
    description:
      "Get context-aware explanations and tailored server configuration snippets based on your actual verified scan findings.",
    benefits: [
      "Context-aware remediation snippets (Nginx/Apache/Caddy)",
      "Framework-specific header directives",
      "Includes Pro tier with 10 websites & 500 scans",
      "Up to 3 team member collaboration seats",
    ],
    plan: "pro",
    icon: BrainCircuit,
  },
  locked_findings: {
    title: "Unlock Complete Security Report",
    description:
      "Access all verified findings, in-depth technical evidence records, and remediation action guides detected during the scan.",
    benefits: [
      "All findings and score impacts unlocked",
      "Detailed HTTP response headers & evidence",
      "Step-by-step remediation commands",
      "Automated weekly scans & alerts included",
    ],
    plan: "basic",
    icon: Lock,
  },
  history: {
    title: "Historical Trends & Score Tracking",
    description:
      "Track your website security posture over time and compare audit results across weeks and months.",
    benefits: [
      "30-day historical score graph (90-day on Pro)",
      "Scan-to-scan finding diff comparison",
      "Security posture progression metrics",
      "Exportable trend charts",
    ],
    plan: "basic",
    icon: Sparkles,
  },
  security_badge: {
    title: "SiteSecura Verified Trust Badge",
    description:
      "Display real-time, cryptographic proof of defensive website posture to build visitor and customer trust with an embeddable verified badge.",
    benefits: [
      "Embeddable dynamic trust badge (SVG & HTML)",
      "Interactive verification modal for visitors",
      "Cryptographically backed by automated scans",
      "Available on Basic, Pro, and Agency plans",
    ],
    plan: "basic",
    icon: ShieldCheck,
  },
  team: {
    title: "Team Collaboration & Workspace Access",
    description:
      "Invite security analysts, developers, and DevOps engineers to collaborate on security audits, scan results, and continuous monitoring.",
    benefits: [
      "Invite up to 3 team members (15 on Agency)",
      "Role-based access control (Admin, Member, Viewer)",
      "Shared website portfolios & monitoring logs",
      "Audit logging of team actions",
    ],
    plan: "pro",
    icon: Users,
  },
  white_label: {
    title: "Agency Custom White-Labeling",
    description:
      "Deliver branded executive security audits with your custom agency logo, brand colors, custom email notifications, and custom footer notices.",
    benefits: [
      "Custom agency logo on PDF reports",
      "Brand color customization & theming",
      "Removal of SiteSecura watermarks",
      "Up to 100 websites and 15 team seats",
    ],
    plan: "agency",
    icon: Building2,
  },
  general: {
    title: "Upgrade Your SiteSecura Protection",
    description:
      "Take your website security beyond one-time scans with scheduled monitoring, instant alerts, branded reports, and complete remediation details.",
    benefits: [
      "Weekly or daily background monitoring",
      "Immediate SSL & header change alerts",
      "Executive PDF report exports",
      "Multi-domain management & trends",
    ],
    plan: "basic",
    icon: ShieldCheck,
  },
};

export function UpgradeModal({
  isOpen,
  onClose,
  contextType = "general",
  featureName,
  customTitle,
  customDescription,
  customBenefits,
  recommendedPlan,
  currentPlan,
}: UpgradeModalProps) {
  const router = useRouter();
  const { user, plan: authPlan, isAuthenticated, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Currency & billing interval states
  const [currency, setCurrency] = useState<"inr" | "usd">("inr");
  const [interval, setInterval] = useState<"month" | "year">("month");

  // Razorpay Checkout Modal state
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false);
  const [razorpayData, setRazorpayData] = useState<CheckoutSessionResponse | null>(null);

  // Sync user's existing subscription currency if available
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    let isMounted = true;
    api
      .getBilling()
      .then((billing) => {
        if (!isMounted) return;
        if (billing?.currency === "usd") {
          setCurrency("usd");
        } else if (billing?.currency === "inr") {
          setCurrency("inr");
        }
      })
      .catch(() => {
        // Fallback to INR default
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen, isAuthenticated]);

  // Normalize current user tier
  const normalizedUserPlan = normalizePlan(currentPlan || authPlan);
  const userTier = PLAN_TIER_ORDER[normalizedUserPlan] ?? 0;

  // Context resolution
  const config = CONTEXT_CONFIGS[contextType] || CONTEXT_CONFIGS.general;
  const baseTarget = recommendedPlan || config.plan;
  const baseTargetTier = PLAN_TIER_ORDER[baseTarget] ?? 1;

  // Determine effective primary target plan respecting tier progression
  const effectivePrimaryPlan: "basic" | "pro" | "agency" = useMemo(() => {
    if (userTier === 0) {
      // Free user: target can be basic, pro, or agency
      return baseTarget;
    }
    if (userTier === 1) {
      // Basic user: cannot upgrade to Basic; upgrade to Pro or Agency
      return baseTargetTier > 1 ? baseTarget : "pro";
    }
    if (userTier === 2) {
      // Pro user: cannot upgrade to Basic or Pro; upgrade to Agency
      return "agency";
    }
    // Agency or Admin
    return "agency";
  }, [userTier, baseTarget, baseTargetTier]);

  const isAlreadyAtTopTier = userTier >= 3;

  // Pricing calculations
  const pricingPlans = getPricingPlans(currency);
  const currencySymbol = currency === "inr" ? "₹" : "$";
  const isYearly = interval === "year";

  const getPlanPriceFormatted = (pId: "basic" | "pro" | "agency"): string => {
    const item = pricingPlans.find((p) => p.id === pId);
    if (!item) return "";
    if (isYearly) {
      return `${currencySymbol}${item.yearlyAnnualTotal.toLocaleString()}/yr`;
    }
    return `${currencySymbol}${item.monthlyPrice.toLocaleString()}/mo`;
  };

  const title = customTitle || (featureName ? `Unlock ${featureName}` : config.title);
  const description = customDescription || config.description;
  const benefits = customBenefits || config.benefits;
  const IconComponent = config.icon;

  if (!isOpen) return null;

  const handleUpgrade = async (targetPlan: "basic" | "pro" | "agency") => {
    if (!isAuthenticated) {
      router.push(`/register?plan=${targetPlan}&interval=${interval}&currency=${currency}`);
      return;
    }

    setLoading(true);
    setError(null);
    setNeedsAuth(false);

    try {
      const res = await api.createCheckoutSession(targetPlan, interval, currency);

      if (res.provider === "razorpay" && res.subscription_id) {
        setRazorpayData(res);
        setIsRazorpayModalOpen(true);
        setLoading(false);
      } else if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        throw new Error("Billing service did not return a valid checkout session.");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to start checkout.";
      if (
        msg.toLowerCase().includes("auth") ||
        msg.toLowerCase().includes("sign in") ||
        msg.toLowerCase().includes("log in")
      ) {
        setNeedsAuth(true);
        setError("Please create an account or sign in to start your subscription.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <div className="bg-white dark:bg-[#111C2E] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Controls: Icon + Currency / Interval Badges */}
          <div className="flex items-start justify-between mb-4 pr-8">
            <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-800 shrink-0">
              <IconComponent className="w-6 h-6" />
            </div>

            {/* Currency & Interval Selectors */}
            {!isAlreadyAtTopTier && (
              <div className="flex items-center gap-2 text-xs font-semibold">
                {/* Currency Switcher */}
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCurrency("inr")}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                      currency === "inr"
                        ? "bg-white dark:bg-sky-950 text-sky-600 dark:text-sky-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    ₹ INR
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("usd")}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                      currency === "usd"
                        ? "bg-white dark:bg-sky-950 text-sky-600 dark:text-sky-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    $ USD
                  </button>
                </div>

                {/* Billing Interval Switcher */}
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setInterval("month")}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                      interval === "month"
                        ? "bg-white dark:bg-sky-950 text-sky-600 dark:text-sky-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterval("year")}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                      interval === "year"
                        ? "bg-white dark:bg-sky-950 text-sky-600 dark:text-sky-400 shadow-xs"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <span>Yearly</span>
                    <span className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold">
                      -17%
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <h3 id="upgrade-modal-title" className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">{description}</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex flex-col gap-2">
              <span>{error}</span>
              {needsAuth && (
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/register?plan=${effectivePrimaryPlan}&interval=${interval}&currency=${currency}`}
                    className="font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 underline"
                  >
                    Create Free Account →
                  </Link>
                  <span className="text-slate-400 dark:text-slate-500">or</span>
                  <Link
                    href="/login"
                    className="font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 underline"
                  >
                    Log In
                  </Link>
                </div>
              )}
            </div>
          )}

          {verifying && (
            <div className="mb-4 p-3 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-xl text-xs text-sky-700 dark:text-sky-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-600 shrink-0" />
              <span>Verifying payment and activating subscription entitlements...</span>
            </div>
          )}

          {/* Already at highest tier view */}
          {isAlreadyAtTopTier ? (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Active Plan: {normalizedUserPlan.toUpperCase()}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your organization is already on our highest subscription tier with full feature entitlements unlocked. If you need custom website quotas, dedicated scan workers, or enterprise SLA agreements, please contact our team.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/dashboard/billing"
                  className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs text-center transition-colors"
                >
                  Manage Subscription
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Plan Value Box */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 mb-6 space-y-2 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
                  Included with {effectivePrimaryPlan.toUpperCase()} Plan
                </div>
                {benefits.map((b, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-200 font-medium">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              {/* Action CTAs */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleUpgrade(effectivePrimaryPlan)}
                  disabled={loading || verifying}
                  className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl text-sm transition-colors shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>
                        Connecting to {currency === "inr" ? "Razorpay" : "Stripe"}...
                      </span>
                    </div>
                  ) : (
                    <>
                      <span>
                        Upgrade to {effectivePrimaryPlan.charAt(0).toUpperCase() + effectivePrimaryPlan.slice(1)} — {getPlanPriceFormatted(effectivePrimaryPlan)}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Contextual Secondary Alternative depending on userTier */}
                {userTier === 0 && effectivePrimaryPlan === "basic" && (
                  <button
                    type="button"
                    onClick={() => handleUpgrade("pro")}
                    disabled={loading || verifying}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Need more scale? View Pro Plan ({getPlanPriceFormatted("pro")}) with 10 websites & AI Advisor
                  </button>
                )}

                {userTier === 0 && effectivePrimaryPlan === "pro" && (
                  <button
                    type="button"
                    onClick={() => handleUpgrade("basic")}
                    disabled={loading || verifying}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Or start with Basic Plan ({getPlanPriceFormatted("basic")}) for 2 websites & weekly monitoring
                  </button>
                )}

                {userTier === 1 && effectivePrimaryPlan === "pro" && (
                  <button
                    type="button"
                    onClick={() => handleUpgrade("agency")}
                    disabled={loading || verifying}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Need agency scale? Upgrade to Agency ({getPlanPriceFormatted("agency")}) with 100 websites & white-labeling
                  </button>
                )}

                {userTier === 1 && effectivePrimaryPlan === "agency" && (
                  <button
                    type="button"
                    onClick={() => handleUpgrade("pro")}
                    disabled={loading || verifying}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Or upgrade to Pro Plan ({getPlanPriceFormatted("pro")}) for 10 websites & team seats
                  </button>
                )}
              </div>

              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-4">
                Cancel anytime • 14-day money-back guarantee • Secure checkout via {currency === "inr" ? "Razorpay" : "Stripe"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Razorpay Client Checkout Modal */}
      <RazorpayCheckoutModal
        isOpen={isRazorpayModalOpen}
        onClose={() => {
          setIsRazorpayModalOpen(false);
          setLoading(false);
        }}
        checkoutData={razorpayData}
        userEmail={user?.email || undefined}
        userName={user?.displayName || undefined}
        onSuccess={async (payment) => {
          setIsRazorpayModalOpen(false);
          setVerifying(true);
          try {
            await api.verifyPayment({
              razorpay_payment_id: payment.paymentId,
              razorpay_subscription_id: payment.subscriptionId,
              razorpay_signature: payment.signature,
            });
            await refreshProfile();
            onClose();
            router.push(`/billing/success?session_id=${payment.subscriptionId}&provider=razorpay`);
          } catch (err: any) {
            setError(err.message || "Payment verification failed. Please contact support.");
            setVerifying(false);
          }
        }}
        onError={(err) => {
          setError(err.message || "Payment was not completed.");
          setIsRazorpayModalOpen(false);
          setLoading(false);
        }}
      />
    </>
  );
}
