"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  X,
  Shield,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Copy,
  ExternalLink,
  ChevronDown,
  Info,
  Lock,
  RefreshCw,
  HelpCircle,
  Zap,
  Users,
  FileText,
  Layers,
  CreditCard,
  Building,
  Laptop,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { SubscriptionInfo, CheckoutSessionResponse } from "@/types";
import {
  PRICING_PLANS,
  INR_PRICING_PLANS,
  getPricingPlans,
  PRICING_COMPARISON_CATEGORIES,
  PLAN_DIFFERENCES,
  SECURITY_TRANSPARENCY_ITEMS,
  PRICING_PAGE_FAQS,
  PlanPricingItem,
} from "@/lib/constants";
import { RazorpayCheckoutModal } from "@/components/pricing/RazorpayCheckoutModal";

export function PricingContent() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, plan: userPlan, onboardingStatus, refreshProfile } = useAuth();
  const [currency, setCurrency] = useState<"inr" | "usd">("inr");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [openFaqIndices, setOpenFaqIndices] = useState<number[]>([0, 1]); // First 2 open by default
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [razorpayData, setRazorpayData] = useState<CheckoutSessionResponse | null>(null);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false);

  const pricingPlans = getPricingPlans(currency);
  const currencySymbol = currency === "inr" ? "₹" : "$";

  // Copy promo code interaction
  const handleCopyPromo = () => {
    navigator.clipboard.writeText("SITESECURA20");
    setCopiedPromo(true);
    setTimeout(() => setCopiedPromo(false), 2500);
  };

  // Toggle FAQ accordion
  const toggleFaq = (index: number) => {
    setOpenFaqIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  // Smooth scroll helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Checkout handling for authenticated users
  const handleCheckout = async (planId: string) => {
    if (!isAuthenticated) {
      router.push(`/register?plan=${planId}&interval=${billingInterval}&currency=${currency}`);
      return;
    }

    if (planId === "free") {
      if (onboardingStatus === "pending_plan_selection") {
        setActionLoading("free");
        try {
          await api.activateFreePlan();
          await refreshProfile();
        } catch {
          // Non-critical, continue to dashboard
        }
      }
      router.push("/dashboard");
      return;
    }

    setActionLoading(planId);
    setErrorMessage(null);

    try {
      const res = await api.createCheckoutSession(planId, billingInterval, currency);
      if (res.provider === "razorpay" && res.subscription_id) {
        setRazorpayData(res);
        setIsRazorpayModalOpen(true);
      } else if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        throw new Error("No checkout URL or subscription ID returned from billing service.");
      }
    } catch (err: any) {
      console.error("Checkout initiation error:", err);
      setErrorMessage(
        err.message || "Failed to start checkout. Please try again or contact support."
      );
      setActionLoading(null);
    }
  };

  return (
    <div className="w-full">
      {/* ========================================================================= */}
      {/* 01. PROMOTIONAL ANNOUNCEMENT BANNER */}
      {/* ========================================================================= */}
      {!bannerDismissed && (
        <aside
          aria-label="Promotional Announcement"
          className="relative bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-950 text-white border-b border-sky-700/50 py-3 px-4 sm:px-6 shadow-sm z-30"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-200 border border-sky-400/30 font-bold uppercase tracking-wider text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                Launch Special
              </span>
              <span className="font-semibold text-slate-100">
                Get 20% OFF Your First Eligible Billing Period
              </span>
              <span className="hidden md:inline text-sky-200/80">•</span>
              <span className="hidden md:inline text-xs text-sky-200/90 font-normal">
                Upgrade your website security and get more protection for less.
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Copy Code Pill */}
              <button
                type="button"
                onClick={handleCopyPromo}
                aria-label="Copy promotion code SITESECURA20"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white border border-white/20 text-xs font-mono font-bold transition-all"
                title="Click to copy promotion code"
              >
                {copiedPromo ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span className="text-emerald-300">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-sky-300" />
                    <span>SITESECURA20</span>
                  </>
                )}
              </button>

              {/* Explore Plans CTA */}
              <button
                type="button"
                onClick={() => scrollToSection("plans-grid")}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-xs"
              >
                <span>Explore Plans</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss promotional banner"
                className="p-1 rounded-md text-sky-300 hover:text-white hover:bg-white/10 transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 02. PRICING HERO & BILLING TOGGLE */}
      {/* ========================================================================= */}
      <section
        id="pricing-hero"
        aria-labelledby="pricing-hero-heading"
        className="relative pt-12 pb-14 lg:pt-16 lg:pb-20 overflow-hidden bg-gradient-to-b from-sky-50/50 via-white to-slate-50/60 border-b border-slate-200/70"
      >
        {/* Subtle Security Dot Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: "radial-gradient(#0284c7 0.65px, transparent 0.65px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center space-y-6">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 text-sky-800 text-xs font-bold border border-sky-200/80 shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-sky-600" />
            <span className="tracking-wider uppercase text-[11px]">SiteSecura Plans</span>
          </div>

          {/* Heading */}
          <div className="max-w-3xl mx-auto space-y-4">
            <h1
              id="pricing-hero-heading"
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.08]"
            >
              Simple, Transparent Pricing for Better Website Security
            </h1>
            <p className="text-base sm:text-lg lg:text-[19px] text-slate-600 leading-relaxed font-normal">
              Start free. Scale as your website portfolio grows. Choose the right tools for
              continuous monitoring, actionable security insights, and reliable website protection.
            </p>
          </div>

          {/* Value Highlights Strip */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm font-medium text-slate-500 pt-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              No long-term contracts
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Flexible monthly & annual billing
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Upgrade or downgrade anytime
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Secure payments via Razorpay & Stripe
            </span>
          </div>

          {/* Currency Toggle & Segmented Billing Toggle */}
          <div className="pt-4 flex flex-col items-center gap-4">
            {/* Currency Selector */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Currency:</span>
              <div
                role="tablist"
                aria-label="Currency selection"
                className="bg-slate-200/80 p-1 rounded-full border border-slate-300 inline-flex items-center gap-1 shadow-inner text-xs font-semibold"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={currency === "inr"}
                  onClick={() => setCurrency("inr")}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    currency === "inr" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ₹ INR (India)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={currency === "usd"}
                  onClick={() => setCurrency("usd")}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    currency === "usd" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  $ USD (Global)
                </button>
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Billing frequency selection"
              className="bg-slate-200/80 p-1.5 rounded-full border border-slate-300 inline-flex items-center gap-1 shadow-inner relative"
            >
              {/* Monthly Button */}
              <button
                type="button"
                role="tab"
                aria-selected={billingInterval === "month"}
                onClick={() => setBillingInterval("month")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  billingInterval === "month"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly Billing
              </button>

              {/* Annual Button */}
              <button
                type="button"
                role="tab"
                aria-selected={billingInterval === "year"}
                onClick={() => setBillingInterval("year")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  billingInterval === "year"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Annual Billing</span>
                <span className="bg-emerald-600 text-white text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-2xs animate-pulse-subtle">
                  Save 16.7% (2 Mo Free)
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2.5 font-medium">
              {billingInterval === "year"
                ? "Billed once annually. Get 2 full months free compared to 12 monthly payments."
                : "Billed monthly with no long-term commitment. Switch to annual anytime."}
            </p>
          </div>
        </div>
      </section>

      {/* Global Error Alert Banner if checkout fails */}
      {errorMessage && (
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <div
            role="alert"
            className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-medium flex items-start gap-3 shadow-xs"
          >
            <div className="shrink-0 mt-0.5">⚠️</div>
            <div className="flex-1">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 03. FOUR PRICING CARDS */}
      {/* ========================================================================= */}
      <section
        id="plans-grid"
        aria-label="Subscription Plans"
        className="py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7 items-stretch">
          {pricingPlans.map((plan: PlanPricingItem) => {
            const isCurrentPlan =
              isAuthenticated && (userPlan || "free").toLowerCase() === plan.id;
            const isYearly = billingInterval === "year";

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                  plan.id === "pro"
                    ? "border-2 border-sky-500 shadow-xl shadow-sky-500/10 ring-2 ring-sky-500/20 relative lg:-translate-y-2 p-6 sm:p-7"
                    : plan.id === "agency"
                    ? "border border-slate-300/90 shadow-md relative p-6 sm:p-7"
                    : "border border-slate-200 shadow-sm p-6 sm:p-7"
                }`}
              >
                {/* Highlight Badge */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-sky-600 text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-5">
                  {/* Plan Name & Audience */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-extrabold text-slate-900">{plan.name}</h2>
                      {isCurrentPlan && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full">
                          Current Plan
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 min-h-[36px] leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  {/* Pricing Display */}
                  <div className="py-4 border-y border-slate-100 space-y-1">
                    {plan.id === "free" ? (
                      <div>
                        <div className="text-4xl font-extrabold text-slate-900">{currencySymbol}0</div>
                        <p className="text-xs text-slate-500 font-medium mt-1">Free forever</p>
                      </div>
                    ) : isYearly ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-extrabold text-slate-900">
                            {currencySymbol}{plan.yearlyAnnualTotal.toLocaleString()}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">/year</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 mt-1">
                          Equivalent to {currencySymbol}{plan.yearlyEquivalentMonthly.toFixed(currency === "inr" ? 0 : 2)}/month
                        </p>
                        <div className="pt-1.5">
                          <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            Save {currencySymbol}{plan.yearlySavings.toLocaleString()}/year (16.7% off)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-slate-400 line-through font-semibold">
                            Reg. {currencySymbol}{plan.referencePrice.toLocaleString()}
                          </span>
                          <span className="text-4xl font-extrabold text-slate-900">
                            {currencySymbol}{plan.monthlyPrice.toLocaleString()}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">/month</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Billed monthly • Cancel anytime
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quotas Pill Strip */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-xs text-slate-700">
                    <div className="flex justify-between font-semibold">
                      <span>Websites</span>
                      <span className="text-slate-900">{plan.websiteLimit} {plan.websiteLimit === 1 ? "site" : "sites"}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Monthly Scans</span>
                      <span className="text-slate-900">{plan.scansLimit.toLocaleString()} scans</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {plan.id === "free" ? "Included Features" : `Everything in Free, plus:`}
                    </p>
                    <ul className="space-y-2.5 text-xs text-slate-600">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-tight">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card CTA & Supporting Text */}
                <div className="pt-6 mt-6 border-t border-slate-100 space-y-2.5">
                  {isCurrentPlan ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold text-center bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    >
                      Active Subscription
                    </button>
                  ) : plan.id === "free" ? (
                    <Link
                      href={isAuthenticated ? "/dashboard" : "/register"}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold text-center block bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors shadow-2xs"
                    >
                      {isAuthenticated ? "Go to Dashboard" : "Start Free"}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCheckout(plan.id)}
                      disabled={actionLoading === plan.id}
                      className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition-all shadow-sm cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ${
                        plan.id === "pro"
                          ? "bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sky-600/20"
                          : "bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white"
                      }`}
                    >
                      {actionLoading === plan.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Connecting to Stripe...</span>
                        </>
                      ) : (
                        <>
                          <span>{isYearly ? plan.ctaYearly : plan.ctaMonthly}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}

                  <p className="text-[11px] text-slate-400 text-center font-medium">
                    {plan.supportingText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 04. TRUST & VALUE PROPOSITION STRIP */}
      {/* ========================================================================= */}
      <section
        aria-label="Platform Trust & Core Guarantees"
        className="bg-white border-y border-slate-200/80 py-8"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Security insights you can act on
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center md:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Clear Security Findings</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Deterministic mathematical score with itemized evidence.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Practical Remediation</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Actionable fix instructions for owners and developers.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Transparent Limits</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Predictable website and monthly scan allowances.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Secure Payments</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Processed via Stripe. No raw credit cards stored.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 col-span-2 md:col-span-1">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Self-Service Portal</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Easily manage billing, invoices, and plans anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 05. DETAILED PLAN COMPARISON TABLE */}
      {/* ========================================================================= */}
      <section
        id="comparison-table"
        aria-labelledby="comparison-heading"
        className="py-20 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10"
      >
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            Feature Matrix
          </div>
          <h2
            id="comparison-heading"
            className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
          >
            Compare Every Plan, Feature by Feature
          </h2>
          <p className="text-base text-slate-600 leading-relaxed font-normal">
            Explore exactly what is included in each plan and choose the subscription that matches
            your security and monitoring needs.
          </p>
        </div>

        {/* Responsive Table Container */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              {/* Table Header */}
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10">
                  <th scope="col" className="py-4 px-5 text-sm font-bold text-slate-900 w-2/5">
                    Feature
                  </th>
                  <th scope="col" className="py-4 px-4 text-sm font-bold text-slate-900 text-center w-[15%]">
                    Free
                  </th>
                  <th scope="col" className="py-4 px-4 text-sm font-bold text-slate-900 text-center w-[15%]">
                    Basic
                  </th>
                  <th scope="col" className="py-4 px-4 text-sm font-bold text-sky-700 bg-sky-50/60 text-center w-[15%]">
                    Pro
                  </th>
                  <th scope="col" className="py-4 px-4 text-sm font-bold text-slate-900 text-center w-[15%]">
                    Agency
                  </th>
                </tr>
              </thead>

              {/* Table Body by Categories */}
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {PRICING_COMPARISON_CATEGORIES.map((category, catIdx) => (
                  <React.Fragment key={catIdx}>
                    {/* Category Header Row */}
                    <tr className="bg-slate-100/70 border-t border-b border-slate-200/80">
                      <th
                        colSpan={5}
                        scope="colgroup"
                        className="py-3 px-5 text-xs font-extrabold uppercase tracking-wider text-slate-700"
                      >
                        {category.title}
                      </th>
                    </tr>

                    {/* Category Feature Rows */}
                    {category.features.map((feature, featIdx) => (
                      <tr
                        key={featIdx}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Feature Name & Tooltip */}
                        <td className="py-3.5 px-5 font-medium text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{feature.name}</span>
                            {feature.tooltip && (
                              <div className="relative inline-block group">
                                <button
                                  type="button"
                                  aria-label={`More info about ${feature.name}`}
                                  className="text-slate-400 hover:text-slate-600 focus:outline-none p-0.5"
                                  onClick={() =>
                                    setActiveTooltip(
                                      activeTooltip === feature.name ? null : feature.name
                                    )
                                  }
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg z-30 pointer-events-none text-center">
                                  {feature.tooltip}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Free Value */}
                        <td className="py-3.5 px-4 text-center">
                          {typeof feature.free === "boolean" ? (
                            feature.free ? (
                              <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )
                          ) : (
                            <span className="font-semibold text-slate-600">{feature.free}</span>
                          )}
                        </td>

                        {/* Basic Value */}
                        <td className="py-3.5 px-4 text-center">
                          {typeof feature.basic === "boolean" ? (
                            feature.basic ? (
                              <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )
                          ) : (
                            <span className="font-semibold text-slate-700">{feature.basic}</span>
                          )}
                        </td>

                        {/* Pro Value */}
                        <td className="py-3.5 px-4 text-center bg-sky-50/30">
                          {typeof feature.pro === "boolean" ? (
                            feature.pro ? (
                              <Check className="w-4 h-4 text-sky-600 mx-auto" />
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )
                          ) : (
                            <span className="font-bold text-sky-900">{feature.pro}</span>
                          )}
                        </td>

                        {/* Agency Value */}
                        <td className="py-3.5 px-4 text-center">
                          {typeof feature.agency === "boolean" ? (
                            feature.agency ? (
                              <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )
                          ) : (
                            <span className="font-bold text-slate-900">{feature.agency}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 06. SECTION 5 — EXPLAIN THE DIFFERENCES BETWEEN PLANS */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="plan-differences-heading"
        className="py-16 lg:py-20 bg-slate-50 border-t border-slate-200/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <h2
              id="plan-differences-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
            >
              Which Plan is Right for You?
            </h2>
            <p className="text-base text-slate-600 font-normal">
              Designed to support web security at every scale—from solo projects to high-volume agency client portfolios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLAN_DIFFERENCES.map((item, idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                      {item.plan}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-100 text-[11px] font-bold text-sky-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span>{item.highlight}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 07. SECTION 6 — SECURITY, BILLING & TRANSPARENCY */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="transparency-heading"
        className="py-16 lg:py-20 bg-white border-t border-slate-200/80"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <h2
              id="transparency-heading"
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
            >
              Built for Transparent and Reliable Security Management
            </h2>
            <p className="text-base text-slate-600 font-normal">
              No hidden fees, no opaque contracts, and no unexpected changes. Everything about our platform is engineered for clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {SECURITY_TRANSPARENCY_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/90 space-y-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                  {idx + 1}
                </div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 08. SECTION 7 — PRICING FAQ */}
      {/* ========================================================================= */}
      <section
        id="pricing-faq"
        aria-labelledby="pricing-faq-heading"
        className="py-20 lg:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10"
      >
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
            Common Questions
          </div>
          <h2
            id="pricing-faq-heading"
            className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight"
          >
            Frequently Asked Questions
          </h2>
          <p className="text-base text-slate-600 font-normal">
            Everything you need to know about SiteSecura pricing, billing, monitoring, and subscriptions.
          </p>
        </div>

        {/* Accordion List */}
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {PRICING_PAGE_FAQS.map((faq, idx) => {
            const isOpen = openFaqIndices.includes(idx);
            return (
              <div key={idx} className="py-4 sm:py-5">
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between text-left gap-4 font-bold text-slate-900 text-base sm:text-lg hover:text-sky-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/40 rounded-lg p-1"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-sky-600" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="mt-3 text-sm text-slate-600 leading-relaxed font-normal pr-6">
                    <p>{faq.a}</p>
                    {faq.linkHref && faq.linkText && (
                      <p className="mt-2">
                        <Link
                          href={faq.linkHref}
                          className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline"
                        >
                          <span>{faq.linkText}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 09. SECTION 8 — FINAL CONVERSION CTA */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="cta-heading"
        className="py-16 lg:py-20 bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-950 text-white relative overflow-hidden"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <h2
            id="cta-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight"
          >
            Ready to Make Your Website Security Easier?
          </h2>
          <p className="text-base sm:text-lg text-sky-100 max-w-2xl mx-auto leading-relaxed font-normal">
            Start with a free scan, explore your website's security posture, and choose a plan when
            you're ready for more visibility and control.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/#scan-hero"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-extrabold text-sm bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 shadow-md shadow-sky-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start Free Scan</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={() => scrollToSection("comparison-table")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 active:bg-white/20 text-white border border-white/20 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>Compare Plans</span>
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Razorpay Checkout Modal */}
      <RazorpayCheckoutModal
        isOpen={isRazorpayModalOpen}
        onClose={() => {
          setIsRazorpayModalOpen(false);
          setActionLoading(null);
        }}
        checkoutData={razorpayData}
        userEmail={user?.email || undefined}
        userName={user?.displayName || undefined}
        onSuccess={async (payment) => {
          setIsRazorpayModalOpen(false);
          setActionLoading("verifying");
          try {
            await api.verifyPayment({
              razorpay_payment_id: payment.paymentId,
              razorpay_subscription_id: payment.subscriptionId,
              razorpay_signature: payment.signature,
            });
            await refreshProfile();
            router.push(`/billing/success?session_id=${payment.subscriptionId}&provider=razorpay`);
          } catch (err: any) {
            setErrorMessage(err.message || "Payment signature verification failed. Please contact support.");
            setActionLoading(null);
          }
        }}
        onError={(err) => {
          setErrorMessage(err.message || "Payment could not be completed.");
          setIsRazorpayModalOpen(false);
          setActionLoading(null);
        }}
      />
    </div>
  );
}
