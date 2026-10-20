"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  Check,
  Zap,
  ArrowRight,
  Sparkles,
  HelpCircle,
  ExternalLink,
  Loader2,
  Users,
  Globe,
  Activity,
  FileText,
  Lock,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { PRICING_PLANS, INR_PRICING_PLANS, getPricingPlans, PlanPricingItem } from "@/lib/constants";
import { BrandLogo } from "@/components/BrandLogo";
import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";
import { RazorpayCheckoutModal } from "@/components/pricing/RazorpayCheckoutModal";
import { CheckoutSessionResponse } from "@/types";

function OnboardingPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, plan: activePlan, onboardingStatus, isAuthenticated, isEmailVerified, loading: authLoading, refreshProfile } = useAuth();

  const paramPlan = searchParams.get("plan")?.toLowerCase();
  const paramInterval = searchParams.get("interval")?.toLowerCase();
  const paramCurrency = searchParams.get("currency")?.toLowerCase();

  const [currency, setCurrency] = useState<"inr" | "usd">(
    paramCurrency === "usd" ? "usd" : "inr"
  );
  const [billingInterval, setBillingInterval] = useState<"month" | "year">(
    paramInterval === "year" || paramInterval === "yearly" ? "year" : "month"
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    paramPlan && ["free", "basic", "pro", "agency"].includes(paramPlan) ? paramPlan : "free"
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [razorpayData, setRazorpayData] = useState<CheckoutSessionResponse | null>(null);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false);

  const pricingPlans = getPricingPlans(currency);
  const currencySymbol = currency === "inr" ? "₹" : "$";

  // Authentication & Verification Guard
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/login?redirect=/onboarding/plan");
      } else if (!isEmailVerified) {
        router.push("/verify-email");
      }
    }
  }, [authLoading, isAuthenticated, isEmailVerified, router]);

  // Handle Plan Confirmation
  const handleSelectPlan = async (plan: PlanPricingItem) => {
    if (actionLoading) return;
    setErrorMessage(null);
    setSelectedPlanId(plan.id);

    if (plan.id === "free") {
      // Free Tier Activation
      setActionLoading("free");
      try {
        await api.activateFreePlan();
        await refreshProfile();
        router.push("/dashboard");
      } catch (err: any) {
        setErrorMessage(
          err.message || "Failed to activate Free plan. Please try again or contact support."
        );
        setActionLoading(null);
      }
    } else {
      // Paid Plan Checkout (Razorpay or Stripe)
      setActionLoading(plan.id);
      try {
        const res = await api.createOnboardingCheckout(plan.id, billingInterval, currency);
        if (res.provider === "razorpay" && res.subscription_id) {
          setRazorpayData(res);
          setIsRazorpayModalOpen(true);
        } else if (res.checkout_url) {
          window.location.href = res.checkout_url;
        } else {
          throw new Error("Billing service did not return a valid checkout session.");
        }
      } catch (err: any) {
        console.error("Onboarding checkout error:", err);
        setErrorMessage(
          err.message || "Failed to initiate Checkout. Please try again."
        );
        setActionLoading(null);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-4" />
        <p className="text-xs font-semibold text-slate-400">Loading plan configuration...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* 1. Header with Logo & Progress Stepper */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo variant="light" size="sm" />
          </Link>

          {/* Stepper Indicator */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-[10px]">
                ✓
              </span>
              <span className="hidden sm:inline">Account & Verification</span>
            </div>
            <span className="text-slate-600">/</span>
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center font-bold text-[10px]">
                2
              </span>
              <span>Select Plan</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Onboarding Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 w-full">
        {/* Title & Description */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Workspace Setup</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Choose the right plan for your website security.
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Start with the essentials or unlock continuous monitoring, automated alerts, and deep vulnerability assessments as your requirements grow.
          </p>

          {/* Currency & Billing Interval Switchers */}
          <div className="pt-4 flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Currency:</span>
              <div className="bg-slate-950 p-1 rounded-full border border-slate-800 inline-flex items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCurrency("inr")}
                  className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
                    currency === "inr" ? "bg-sky-600 text-white shadow-xs font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  ₹ INR (India)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("usd")}
                  className={`px-3.5 py-1 rounded-full transition-all cursor-pointer ${
                    currency === "usd" ? "bg-sky-600 text-white shadow-xs font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  $ USD (Global)
                </button>
              </div>
            </div>

            <div className="bg-slate-950 p-1 rounded-2xl border border-slate-800 inline-flex items-center shadow-inner">
              <button
                type="button"
                onClick={() => setBillingInterval("month")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  billingInterval === "month"
                    ? "bg-sky-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("year")}
                className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  billingInterval === "year"
                    ? "bg-sky-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>Annual Billing</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                  Save 16.7%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="max-w-2xl mx-auto mb-8">
            <AuthErrorAlert message={errorMessage} onDismiss={() => setErrorMessage(null)} />
          </div>
        )}

        {/* 3. Four Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {pricingPlans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            const isPopular = plan.popular;
            const isFree = plan.id === "free";

            const displayedPrice =
              billingInterval === "year" && !isFree
                ? `${currencySymbol}${plan.yearlyEquivalentMonthly.toFixed(currency === "inr" ? 0 : 2)}`
                : `${currencySymbol}${plan.monthlyPrice}`;

            const billingSubtext = isFree
              ? "Free forever • No card required"
              : billingInterval === "year"
              ? `Billed annually at ${currencySymbol}${plan.yearlyAnnualTotal}/yr`
              : "Billed monthly • Cancel anytime";

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                  isPopular
                    ? "bg-slate-950 border-2 border-sky-500 shadow-xl shadow-sky-950/50"
                    : "bg-slate-950/70 border border-slate-800 hover:border-slate-700"
                } ${isSelected ? "ring-2 ring-sky-400" : ""}`}
              >
                {/* Popular / Recommended Badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold bg-sky-500 text-slate-950 uppercase tracking-wider shadow">
                      <Sparkles className="w-3 h-3" />
                      Recommended
                    </span>
                  </div>
                )}

                <div className="p-6">
                  {/* Plan Name & Tag */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-white capitalize">{plan.name}</h3>
                    {isSelected && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                        Selected
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 min-h-[36px] line-clamp-2 mb-5">
                    {plan.description}
                  </p>

                  {/* Pricing Display */}
                  <div className="mb-6 pb-6 border-b border-slate-800">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold text-white tracking-tight">
                        {displayedPrice}
                      </span>
                      {!isFree && (
                        <span className="text-xs font-medium text-slate-400">/ month</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{billingSubtext}</p>
                  </div>

                  {/* Core Capacity Limits */}
                  <div className="space-y-2 mb-6 text-xs font-medium text-slate-300">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>{plan.websiteLimit === 1 ? "1 Website" : `Up to ${plan.websiteLimit} Websites`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>{plan.scansLimit.toLocaleString()} scans per month</span>
                    </div>
                  </div>

                  {/* Feature Highlights */}
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Included capabilities:
                    </p>
                    <ul className="space-y-2 text-xs text-slate-300">
                      {plan.features.slice(0, 6).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card CTA Action */}
                <div className="p-6 pt-0">
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan)}
                    disabled={actionLoading !== null}
                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                      isPopular
                        ? "bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-extrabold"
                        : isFree
                        ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-white border border-slate-700"
                        : "bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {actionLoading === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{isFree ? "Activating Free..." : "Opening Checkout..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{isFree ? "Continue with Free" : `Choose ${plan.name}`}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Help & Transparency Footer Note */}
        <div className="mt-12 text-center text-xs text-slate-400 space-y-2">
          <p>
            Need a custom enterprise agreement or multi-tenant setup?{" "}
            <Link href="/contact" className="text-sky-400 hover:underline">
              Contact our security advisory team
            </Link>
            .
          </p>
          <p className="text-[11px] text-slate-400">
            All paid plans include a 14-day refund policy. Change or cancel anytime directly in your account billing portal.
          </p>
        </div>
      </main>

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
            setErrorMessage(err.message || "Payment verification failed. Please contact support.");
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

export default function OnboardingPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-4" />
          <p className="text-xs font-semibold text-slate-400">Loading plan configuration...</p>
        </div>
      }
    >
      <OnboardingPlanContent />
    </Suspense>
  );
}
