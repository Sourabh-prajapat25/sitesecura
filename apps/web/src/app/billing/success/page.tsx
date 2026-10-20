"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowRight,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";

function BillingSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshProfile, isAuthenticated, loading: authLoading } = useAuth();

  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<"verifying" | "active" | "delayed" | "failed">("verifying");
  const [activePlan, setActivePlan] = useState<string>("basic");
  const [pollCount, setPollCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verification Poller
  const checkSessionStatus = useCallback(async () => {
    if (!sessionId) {
      // If no session ID in URL, check current billing status
      try {
        const billing = await api.getBilling();
        if (billing.plan !== "free") {
          setActivePlan(billing.plan);
          setStatus("active");
          await refreshProfile();
          return;
        }
      } catch (err) {
        // Fallback
      }
      setStatus("delayed");
      return;
    }

    try {
      const res = await api.getBillingSessionStatus(sessionId);
      if (res.status === "complete" || res.is_active) {
        setActivePlan(res.plan);
        setStatus("active");
        await refreshProfile();
      } else {
        // Still pending webhook confirmation
        if (pollCount >= 10) {
          // Bounded timeout after 10 attempts (20 seconds)
          setStatus("delayed");
        } else {
          setPollCount((prev) => prev + 1);
        }
      }
    } catch (err: any) {
      console.warn("Polling billing status notice:", err);
      if (pollCount >= 10) {
        setStatus("delayed");
      } else {
        setPollCount((prev) => prev + 1);
      }
    }
  }, [sessionId, pollCount, refreshProfile]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/billing/success${sessionId ? `?session_id=${sessionId}` : ""}`);
      return;
    }

    if (status === "verifying") {
      const timer = setTimeout(() => {
        checkSessionStatus();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isAuthenticated, status, checkSessionStatus, router, sessionId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-sky-500 selection:text-white">
      {/* Brand Header */}
      <div className="mb-8">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-sky-950/20 text-center space-y-6">
        {/* State A: Verifying / Polling Webhook */}
        {status === "verifying" && (
          <div className="space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 border-4 border-sky-900 border-t-sky-400 rounded-full animate-spin" />
              <ShieldCheck className="w-7 h-7 text-sky-400 absolute inset-0 m-auto" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Confirming Your Subscription
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                We are validating your payment confirmation and provisioning your plan entitlements. This usually takes just a few seconds...
              </p>
            </div>

            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-400 font-mono">
                <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                Synchronizing subscription claims...
              </span>
            </div>
          </div>
        )}

        {/* State B: Confirmed & Active Plan */}
        {status === "active" && (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Payment Confirmed
              </span>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                Your SiteSecura {activePlan.toUpperCase()} Plan is Active!
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Thank you for subscribing. Your enhanced scan quotas, continuous monitoring, and security capabilities are now ready in your workspace.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/dashboard"
                className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
              >
                <span>Go to Security Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* State C: Delayed Webhook Notice */}
        {status === "delayed" && (
          <div className="space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-sm">
              <Clock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Payment Received • Activation Processing
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Your payment was received by Stripe. The backend synchronization webhook is taking slightly longer than usual to complete.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStatus("verifying");
                  setPollCount(0);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                <span>Check Status Again</span>
              </button>

              <Link
                href="/dashboard"
                className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 transition-all"
              >
                <span>Continue to Dashboard anyway</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-4" />
          <p className="text-xs font-semibold text-slate-400">Loading payment confirmation...</p>
        </div>
      }
    >
      <BillingSuccessContent />
    </Suspense>
  );
}
