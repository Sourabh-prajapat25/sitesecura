"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Check,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Calendar,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/EmptyState";
import { getPricingPlans, PlanPricingItem } from "@/lib/constants";
import { api } from "@/lib/api";
import { SubscriptionInfo, CheckoutSessionResponse } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { RazorpayCheckoutModal } from "@/components/pricing/RazorpayCheckoutModal";

export default function BillingPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, refreshProfile } = useAuth();
  const [billing, setBilling] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"inr" | "usd">("inr");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  // Razorpay Checkout Modal state
  const [razorpayData, setRazorpayData] = useState<CheckoutSessionResponse | null>(null);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false);

  // Cancellation Modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadBilling = async () => {
    try {
      const data = await api.getBilling();
      setBilling(data);
      if (data.currency === "usd") {
        setCurrency("usd");
      } else {
        setCurrency("inr");
      }
    } catch (err) {
      console.error("Failed to load billing:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadBilling();
    }
  }, [authLoading, isAuthenticated]);

  const pricingPlans = getPricingPlans(currency);
  const currencySymbol = currency === "inr" ? "₹" : "$";

  const handleUpgrade = async (planId: string) => {
    setActionLoading(planId);
    setStatusMessage(null);
    try {
      const res = await api.createCheckoutSession(planId, billingInterval, currency);
      if (res.provider === "razorpay" && res.subscription_id) {
        setRazorpayData(res);
        setIsRazorpayModalOpen(true);
      } else if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        throw new Error("No checkout URL or subscription ID returned.");
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to start checkout." });
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading("portal");
    try {
      const res = await api.createCustomerPortal();
      if (res.portal_url) {
        window.location.href = res.portal_url;
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to open customer portal." });
      setActionLoading(null);
    }
  };

  const handleConfirmCancel = async () => {
    setCancelLoading(true);
    try {
      const res = await api.cancelSubscription(cancelAtPeriodEnd);
      setStatusMessage({ type: "success", text: res.message });
      setIsCancelModalOpen(false);
      await loadBilling();
      await refreshProfile();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to cancel subscription." });
    } finally {
      setCancelLoading(false);
    }
  };

  const isPaid = billing?.plan && billing.plan.toLowerCase() !== "free";
  const isRazorpay = billing?.provider === "razorpay";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHeader
          title="Subscription & Billing"
          description="Manage your subscription tier, track quotas, and review billing provider status."
        />

        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
              statusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Current Plan Overview Card */}
        <div className="bg-white dark:bg-[#111C2E] p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Current Active Plan
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {billing?.plan || "Free"}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                  billing?.status === "active"
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : billing?.status === "past_due"
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {billing?.status || "Active"}
              </span>
              {isPaid && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Via {isRazorpay ? "Razorpay (INR)" : "Stripe (USD)"}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white capitalize">
              {billing?.plan || "Free"} Tier
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quotas: {billing?.used_websites || 0} of {billing?.max_websites || 1} websites used •{" "}
              {billing?.used_scans || 0} of {billing?.max_scans_per_month || 10} scans used this month
            </p>

            {billing?.current_period_end && isPaid && (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>
                  {billing.cancel_at_period_end ? "Access ends: " : "Renews on: "}
                  {new Date(billing.current_period_end).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </p>
            )}

            {billing?.cancel_at_period_end && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Cancellation scheduled at end of current billing period.</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isPaid && isRazorpay && !billing?.cancel_at_period_end && (
              <button
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-red-500" />
                <span>Cancel Subscription</span>
              </button>
            )}

            {isPaid && !isRazorpay && (
              <button
                onClick={handleManageBilling}
                disabled={actionLoading === "portal"}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-slate-500" />
                <span>{actionLoading === "portal" ? "Opening..." : "Manage Payment / Invoices"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Upgrade Plans Grid */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Available Plans</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Switch or upgrade your plan anytime with immediate pro-ration.</p>
            </div>

            {/* Currency & Frequency Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Currency Selector */}
              <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200 dark:border-slate-700 inline-flex items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCurrency("inr")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    currency === "inr" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("usd")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    currency === "usd" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  $ USD
                </button>
              </div>

              {/* Interval Toggle */}
              <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200 dark:border-slate-700 inline-flex items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBillingInterval("month")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    billingInterval === "month" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval("year")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    billingInterval === "year" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Annual (-16.7%)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((p) => {
              const isCurrent = (billing?.plan || "free").toLowerCase() === p.id;
              const isYearly = billingInterval === "year";
              const priceDisplay =
                p.id === "free"
                  ? `${currencySymbol}0`
                  : isYearly
                  ? `${currencySymbol}${p.yearlyAnnualTotal.toLocaleString()}`
                  : `${currencySymbol}${p.monthlyPrice.toLocaleString()}`;
              const intervalText = p.id === "free" ? "forever" : isYearly ? "/year" : "/month";

              return (
                <div
                  key={p.id}
                  className={`bg-white dark:bg-[#111C2E] rounded-2xl p-6 border flex flex-col justify-between ${
                    isCurrent
                      ? "border-sky-500 ring-2 ring-sky-500/20 shadow-md"
                      : "border-slate-200 dark:border-slate-800 shadow-sm"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">{p.name}</h4>
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{priceDisplay}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{intervalText}</span>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      {p.features.slice(0, 6).map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold rounded-xl text-xs cursor-not-allowed"
                      >
                        Active Plan
                      </button>
                    ) : p.id === "free" ? (
                      <button
                        disabled
                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold rounded-xl text-xs cursor-not-allowed"
                      >
                        Default Free
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(p.id)}
                        disabled={actionLoading === p.id}
                        className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === p.id ? "Opening..." : `Upgrade to ${p.name}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
            setStatusMessage({ type: "error", text: err.message || "Payment verification failed." });
            setActionLoading(null);
          }
        }}
        onError={(err) => {
          setStatusMessage({ type: "error", text: err.message || "Payment was not completed." });
          setIsRazorpayModalOpen(false);
          setActionLoading(null);
        }}
      />

      {/* In-App Subscription Cancellation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Cancel Subscription</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Plan: {billing?.plan?.toUpperCase()}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to cancel your paid subscription? You will lose access to automated monitoring and advanced features after cancellation.
            </p>

            <div className="bg-slate-50 dark:bg-[#0B1220] p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="cancelType"
                  checked={cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(true)}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <span>Cancel at end of current billing cycle (Recommended)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="cancelType"
                  checked={!cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(false)}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <span>Cancel immediately (Downgrade to Free now)</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Keep Plan
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {cancelLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Canceling...</span>
                  </>
                ) : (
                  "Confirm Cancel"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
