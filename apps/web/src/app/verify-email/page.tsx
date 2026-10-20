"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MailCheck,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle2,
  LogOut,
  ArrowRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { sendUserEmailVerification, getAuthErrorMessage } from "@/lib/auth";
import { api } from "@/lib/api";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isEmailVerified, onboardingStatus, reloadUser, logout, loading: authLoading } = useAuth();

  const planParam = searchParams.get("plan");
  const intervalParam = searchParams.get("interval");
  const planQuery = planParam
    ? `?plan=${encodeURIComponent(planParam)}${
        intervalParam ? `&interval=${encodeURIComponent(intervalParam)}` : ""
      }`
    : "";

  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [resendLoading, setResendLoading] = useState<boolean>(false);
  const [checkLoading, setCheckLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // If user is already verified, forward to onboarding or dashboard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (isEmailVerified) {
        if (onboardingStatus === "pending_plan_selection" || planParam) {
          router.push(`/onboarding/plan${planQuery}`);
        } else {
          router.push("/dashboard");
        }
      }
    }
  }, [user, isEmailVerified, onboardingStatus, authLoading, router, planQuery, planParam]);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handler to resend email verification link
  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    try {
      await sendUserEmailVerification(user);
      setSuccessMessage("A fresh verification link has been sent to your email address.");
      setResendCooldown(60);
    } catch (err: any) {
      setErrorMessage(getAuthErrorMessage(err));
    } finally {
      setResendLoading(false);
    }
  };

  // Handler to manually check verification status
  const handleCheckStatus = async () => {
    if (checkLoading) return;

    setCheckLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const refreshedUser = await reloadUser();
      if (refreshedUser?.emailVerified) {
        setSuccessMessage("Your email has been verified! Redirecting to setup...");
        try {
          const syncRes = await api.syncUser();
          setTimeout(() => {
            if (syncRes.onboarding_status === "pending_plan_selection" || planParam) {
              router.push(`/onboarding/plan${planQuery}`);
            } else {
              router.push("/dashboard");
            }
          }, 1000);
        } catch {
          setTimeout(() => {
            router.push(`/onboarding/plan${planQuery}`);
          }, 1000);
        }
      } else {
        setInfoMessage(
          "We haven't detected verification yet. Please open the link in your email and click 'Confirm Verification'."
        );
      }
    } catch (err: any) {
      setErrorMessage("Could not refresh verification status. Please try again.");
    } finally {
      setCheckLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const userEmail = user?.email || "your registered email address";

  return (
    <AuthSplitLayout
      heading="Verify your email address"
      subheading="A verification link has been sent to your inbox to protect your security scanning rights."
      badgeText="Identity Confirmation Required"
    >
      <div className="space-y-6">
        {/* Verification Icon Box */}
        <div className="flex flex-col items-center justify-center text-center p-6 bg-sky-50/60 border border-sky-100 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-400/20 text-sky-600 flex items-center justify-center mb-3 shadow-sm">
            <MailCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Check your inbox</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-xs leading-relaxed">
            We sent a verification link to:
          </p>
          <p className="text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 mt-2 shadow-xs break-all">
            {userEmail}
          </p>
        </div>

        {/* Status Alerts */}
        {successMessage && (
          <AuthErrorAlert
            message={successMessage}
            variant="success"
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        {infoMessage && (
          <AuthErrorAlert
            message={infoMessage}
            variant="warning"
            onDismiss={() => setInfoMessage(null)}
          />
        )}

        {errorMessage && (
          <AuthErrorAlert
            message={errorMessage}
            variant="error"
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Check Verification Status */}
          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checkLoading}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {checkLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>Checking status...</span>
              </>
            ) : (
              <>
                <span>I have verified my email</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Resend Verification Email Button */}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendLoading}
            className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {resendLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Sending new link...</span>
              </>
            ) : resendCooldown > 0 ? (
              <>
                <Send className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Resend email in {resendCooldown}s</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Resend verification email</span>
              </>
            )}
          </button>
        </div>

        {/* Helpful Tips Box */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
            Didn&apos;t receive the email?
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1 text-[11px] leading-relaxed">
            <li>Check your spam, junk, or promotions folder.</li>
            <li>Allow up to 2 minutes for email delivery.</li>
            <li>Ensure your email provider accepts incoming mail from SiteSecura.</li>
          </ul>
        </div>

        {/* Switch Account / Sign Out */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign in with a different account</span>
          </button>
        </div>
      </div>
    </AuthSplitLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
