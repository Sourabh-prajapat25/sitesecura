"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Receipt,
  Clock,
  RefreshCw,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/EmptyState";
import { getPricingPlans, PlanPricingItem } from "@/lib/constants";
import { api } from "@/lib/api";
import { SubscriptionInfo, CheckoutSessionResponse, PaymentTransactionItem } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { RazorpayCheckoutModal } from "@/components/pricing/RazorpayCheckoutModal";

const TIER_ORDER: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  agency: 3,
  admin: 4,
};

export default function BillingPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, refreshProfile } = useAuth();
  
  // Billing status state
  const [billing, setBilling] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Actions & currency state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"inr" | "usd">("inr");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  // Payment History state
  const [history, setHistory] = useState<PaymentTransactionItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Razorpay Checkout Modal state
  const [razorpayData, setRazorpayData] = useState<CheckoutSessionResponse | null>(null);
  const [isRazorpayModalOpen, setIsRazorpayModalOpen] = useState(false);

  // Cancellation Modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setBillingError(null);
    try {
      const data = await api.getBilling();
      setBilling(data);
      if (data.currency === "usd") {
        setCurrency("usd");
      } else {
        setCurrency("inr");
      }
    } catch (err: any) {
      console.error("Failed to load billing:", err);
      setBillingError(err.message || "Unable to retrieve billing status. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await api.getPaymentHistory(20, 0);
      setHistory(res.items || []);
    } catch (err: any) {
      console.error("Failed to load payment history:", err);
      setHistoryError(err.message || "Unable to load payment history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadBilling();
      loadHistory();
    }
  }, [authLoading, isAuthenticated, loadBilling, loadHistory]);

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
        throw new Error("No checkout URL or subscription ID returned from billing service.");
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
      await Promise.all([loadBilling(), loadHistory(), refreshProfile()]);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to cancel subscription." });
    } finally {
      setCancelLoading(false);
    }
  };

  const planName = (billing?.plan || "free").toLowerCase();
  const currentTier = TIER_ORDER[planName] ?? 0;
  const isPaid = planName !== "free" && billing?.status !== "canceled";
  const isRazorpay = billing?.provider === "razorpay";
  const isScheduledCancel = Boolean(billing?.cancel_at_period_end);

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PageHeader
          title="Subscription & Billing"
          description="Manage your subscription tier, track quotas, review payment receipts, and manage billing settings."
        />

        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-in fade-in duration-200 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300"
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {billingError && (
          <div className="p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{billingError}</span>
            </div>
            <button
              onClick={() => {
                loadBilling();
                loadHistory();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200 dark:bg-amber-900 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Current Plan Overview Card */}
        <div className="bg-white dark:bg-[#111C2E] p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Current Plan
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

            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white capitalize">
                {billing?.plan || "Free"} Tier
              </h2>
              {isPaid && billing?.amount_cents && (
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  ({billing.currency === "inr" ? "₹" : "$"}{(billing.amount_cents / 100).toLocaleString()} / {billing.billing_interval || "month"})
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quotas: {billing?.used_websites || 0} of {billing?.max_websites || 1} websites used •{" "}
              {billing?.used_scans || 0} of {billing?.max_scans_per_month || 10} scans used this month
            </p>

            {billing?.current_period_end && isPaid && (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>
                  {isScheduledCancel ? "Paid access active until: " : "Next scheduled renewal: "}
                  <strong className="font-semibold text-slate-700 dark:text-slate-200">
                    {formatDateTime(billing.current_period_end)}
                  </strong>
                </span>
              </p>
            )}

            {isScheduledCancel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Subscription cancellation scheduled. You retain full access to paid capabilities until {formatDateTime(billing?.current_period_end)}.
                </span>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            {isPaid && !isScheduledCancel && (
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-red-500" />
                <span>Cancel Subscription</span>
              </button>
            )}

            {isPaid && isScheduledCancel && (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Cancellation Scheduled</span>
              </div>
            )}

            {isPaid && !isRazorpay && (
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={actionLoading === "portal"}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4 text-slate-500" />
                <span>{actionLoading === "portal" ? "Opening..." : "Stripe Billing Portal"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Upgrade Plans Grid */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Subscription Plans</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose the security plan that fits your website portfolio and monitoring frequency.
              </p>
            </div>

            {/* Currency & Frequency Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Currency Selector */}
              <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200 dark:border-slate-700 inline-flex items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCurrency("inr")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    currency === "inr"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  ₹ INR
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("usd")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                    currency === "usd"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                    billingInterval === "month"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval("year")}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                    billingInterval === "year"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Yearly</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold">
                    -17%
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((p) => {
              const planTier = TIER_ORDER[p.id] ?? 0;
              const isCurrent = currentTier === planTier && planName === p.id;
              const isLowerTier = planTier < currentTier;
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
                      : "border-slate-200 dark:border-slate-800 shadow-xs"
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">{p.name}</h4>
                      {isCurrent && (
                        <span className="text-[10px] font-bold uppercase bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800">
                          Active Plan
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
                        type="button"
                        disabled
                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold rounded-xl text-xs cursor-default"
                      >
                        Current Plan
                      </button>
                    ) : isLowerTier ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 font-medium rounded-xl text-xs cursor-default border border-dashed border-slate-200 dark:border-slate-800"
                      >
                        Included in {billing?.plan?.toUpperCase()}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpgrade(p.id)}
                        disabled={actionLoading === p.id}
                        className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === p.id ? "Preparing checkout..." : `Upgrade to ${p.name}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment History & Invoices Section */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span>Payment History & Receipts</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official payment records and ledger receipts generated for your subscription.
              </p>
            </div>
            <button
              type="button"
              onClick={loadHistory}
              disabled={historyLoading}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} />
              <span>Refresh History</span>
            </button>
          </div>

          {historyError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
              <span>{historyError}</span>
              <button
                type="button"
                onClick={loadHistory}
                className="underline font-bold ml-2 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {historyLoading ? (
            <div className="bg-white dark:bg-[#111C2E] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading payment ledger...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white dark:bg-[#111C2E] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No completed payments yet
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When subscription charges, plan upgrades, or renewals process, verified transactions and downloadable receipt links will appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Gateway</th>
                      <th className="py-3 px-4">Reference ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Receipt / Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {history.map((tx) => {
                      const amountFormatted = `${tx.currency?.toLowerCase() === "inr" ? "₹" : "$"}${(
                        tx.amount / 100
                      ).toLocaleString()}`;
                      const receiptUrl = tx.invoice_url || tx.receipt_url;

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {formatDateTime(tx.created_at)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-900 dark:text-white capitalize whitespace-nowrap font-bold">
                            {tx.plan ? `${tx.plan} Tier` : "Subscription Charge"} ({tx.billing_interval || "Monthly"})
                          </td>
                          <td className="py-3.5 px-4 text-slate-900 dark:text-white font-mono whitespace-nowrap">
                            {amountFormatted}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 uppercase text-[11px]">
                            {tx.provider}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-[140px] truncate" title={tx.provider_payment_id}>
                            {tx.provider_payment_id}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                tx.status === "succeeded" || tx.status === "paid"
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  : tx.status === "refunded"
                                  ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                  : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {receiptUrl ? (
                              <a
                                href={receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:text-sky-700 font-bold hover:underline"
                              >
                                <span>Receipt</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                                Digital Record
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
            await Promise.all([loadBilling(), loadHistory(), refreshProfile()]);
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
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="cancel-modal-title" className="font-bold text-lg text-slate-900 dark:text-white">
                  Cancel Subscription
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Active Tier: {billing?.plan?.toUpperCase()}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to cancel your paid subscription? You will lose scheduled automated monitoring, prioritized scan queues, and team collaboration features.
            </p>

            <div className="bg-slate-50 dark:bg-[#0B1220] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="radio"
                  name="cancelType"
                  checked={cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(true)}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Cancel at end of current billing cycle (Recommended)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Keep full access to paid features until your current prepaid cycle ends ({formatDateTime(billing?.current_period_end)}). No future renewal charges will be made.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                <input
                  type="radio"
                  name="cancelType"
                  checked={!cancelAtPeriodEnd}
                  onChange={() => setCancelAtPeriodEnd(false)}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Cancel immediately (Immediate downgrade)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Revoke paid subscription entitlements immediately and revert your workspace to the Free tier now.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Keep My Plan
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {cancelLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  "Confirm Cancellation"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
