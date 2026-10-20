"use client";

import React, { useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";

function BillingCancelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  // Inform backend that checkout was canceled to record recoverable state
  useEffect(() => {
    const notifyCancel = async () => {
      try {
        await api.cancelCheckout(sessionId || undefined);
      } catch (err) {
        // Non-critical tracking call
      }
    };
    notifyCancel();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-sky-500 selection:text-white">
      {/* Brand Header */}
      <div className="mb-8">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto shadow-sm">
          <ShieldAlert className="w-8 h-8 text-amber-400" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Checkout Incomplete
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Checkout was canceled
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            No payment was charged and your account details remain intact. You can pick another plan or resume anytime.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/onboarding/plan"
            className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Return to Plan Selection</span>
          </Link>

          <Link
            href="/dashboard"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-700"
          >
            <span>Continue with Free Plan to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="pt-4 border-t border-slate-800/80">
          <p className="text-[11px] text-slate-500">
            Questions about our plans?{" "}
            <Link href="/pricing" className="text-sky-400 hover:underline">
              Compare plan limits
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="text-sky-400 hover:underline">
              contact support
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BillingCancelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
          <p className="text-xs font-semibold text-slate-400">Loading checkout cancellation...</p>
        </div>
      }
    >
      <BillingCancelContent />
    </Suspense>
  );
}
