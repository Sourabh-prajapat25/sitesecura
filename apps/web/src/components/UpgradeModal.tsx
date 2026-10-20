"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X, Sparkles, Check, Lock, ArrowRight, ShieldCheck, FileText, Activity, BrainCircuit } from "lucide-react";
import { api } from "@/lib/api";

export type UpgradeContextType =
  | "monitoring"
  | "pdf"
  | "ai_guide"
  | "locked_findings"
  | "history"
  | "deep_scan"
  | "security_badge"
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
}

const CONTEXT_CONFIGS: Record<
  UpgradeContextType,
  {
    title: string;
    description: string;
    benefits: string[];
    plan: "basic" | "pro" | "agency";
    planPrice: string;
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
    planPrice: "$49/mo",
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
    planPrice: "$9/mo",
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
    planPrice: "$9/mo",
    icon: FileText,
  },
  ai_guide: {
    title: "AI Fix Guidance & Remediation",
    description:
      "Get context-aware explanations and tailored server configuration snippets based on your actual verified scan findings.",
    benefits: [
      "Context-aware remediation snippets (Nginx/Apache/Caddy)",
      "Framework-specific header directives",
      "Includes Pro tier with 10 websites & 250 scans",
      "Up to 3 team member collaboration seats",
    ],
    plan: "pro",
    planPrice: "$49/mo",
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
    planPrice: "$9/mo",
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
    planPrice: "$9/mo",
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
    planPrice: "$9/mo",
    icon: ShieldCheck,
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
    planPrice: "$9/mo",
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
}: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  if (!isOpen) return null;

  const config = CONTEXT_CONFIGS[contextType] || CONTEXT_CONFIGS.general;
  const plan = recommendedPlan || config.plan;
  const title = customTitle || (featureName ? `Unlock ${featureName}` : config.title);
  const description = customDescription || config.description;
  const benefits = customBenefits || config.benefits;
  const IconComponent = config.icon;

  const handleUpgrade = async (targetPlan: string) => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const res = await api.createCheckoutSession(targetPlan);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
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

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 border border-sky-100 dark:border-sky-800">
          <IconComponent className="w-6 h-6" />
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
                  href="/register"
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

        {/* Plan Value Box */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 mb-6 space-y-2 text-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
            Included with {plan.toUpperCase()} Plan
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
            onClick={() => handleUpgrade(plan)}
            disabled={loading}
            className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-xl text-sm transition-colors shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Redirecting to Stripe...</span>
              </div>
            ) : (
              <>
                <span>Upgrade to {plan.charAt(0).toUpperCase() + plan.slice(1)} — {plan === "pro" ? "$49/mo" : "$9/mo"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {plan !== "pro" ? (
            <button
              type="button"
              onClick={() => handleUpgrade("pro")}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors"
            >
              Need more? View Pro Plan ($49/mo) with 10 websites & daily scans
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleUpgrade("basic")}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors"
            >
              Or start with Basic Plan ($9/mo) for 3 websites
            </button>
          )}
        </div>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-4">
          Cancel anytime • 14-day money-back guarantee • Secure checkout via Stripe
        </p>
      </div>
    </div>
  );
}

