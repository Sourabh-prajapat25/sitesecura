"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
} from "lucide-react";
import {
  verifyEmailActionCode,
  confirmUserPasswordReset,
  getAuthErrorMessage,
} from "@/lib/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";

function AuthActionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, reloadUser } = useAuth();

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  const [loading, setLoading] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Password reset specific states
  const [newPassword, setNewPassword] = useState<string>("");
  const [resetSubmitting, setResetSubmitting] = useState<boolean>(false);

  // Email verification action handler
  useEffect(() => {
    if (!mode || !oobCode) {
      setLoading(false);
      setError("Invalid action request. Missing verification or action parameters.");
      return;
    }

    if (mode === "verifyEmail") {
      const processVerification = async () => {
        try {
          await verifyEmailActionCode(oobCode);
          setSuccess(true);
          // Refresh user context if session active
          try {
            await reloadUser();
            await api.syncUser();
          } catch {
            // Non-critical session sync
          }
        } catch (err: any) {
          setError(getAuthErrorMessage(err));
        } finally {
          setLoading(false);
        }
      };

      processVerification();
    } else if (mode === "resetPassword") {
      // Ready for user to enter new password
      setLoading(false);
    } else {
      setLoading(false);
      setError(`Unsupported action mode: '${mode}'.`);
    }
  }, [mode, oobCode, reloadUser]);

  // Handle password reset submission
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode || resetSubmitting) return;

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setResetSubmitting(true);
    setError(null);

    try {
      await confirmUserPasswordReset(oobCode, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResetSubmitting(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
        <div className="relative w-12 h-12">
          <div className="w-12 h-12 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
          <ShieldCheck className="w-5 h-5 text-sky-600 absolute inset-0 m-auto" />
        </div>
        <p className="text-sm font-semibold text-slate-700">
          Verifying security action code...
        </p>
        <p className="text-xs text-slate-500">
          Please wait while SiteSecura confirms your identity token with Firebase.
        </p>
      </div>
    );
  }

  // 2. Email Verification: SUCCESS
  if (mode === "verifyEmail" && success) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Email Verified Successfully!
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your email address has been verified. Your security workspace and scanning rights are now fully active.
          </p>
        </div>

        <div className="pt-2">
          {user ? (
            <Link
              href="/onboarding/plan"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
            >
              <span>Continue to Plan Selection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
            >
              <span>Sign in to your account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  // 3. Password Reset: SUCCESS
  if (mode === "resetPassword" && success) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Password Updated
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your password has been changed successfully. You can now sign in with your new credentials.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // 4. Password Reset Form (when mode === "resetPassword" and not yet submitted)
  if (mode === "resetPassword" && !success && !error) {
    return (
      <div className="space-y-5 py-2">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">Choose a new password</h3>
          <p className="text-xs text-slate-600">
            Please enter a strong password for your SiteSecura account.
          </p>
        </div>

        <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
          <div className="space-y-1">
            <PasswordInput
              id="new-password"
              label="New Password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={resetSubmitting}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <PasswordStrengthIndicator password={newPassword} />
          </div>

          <button
            type="submit"
            disabled={resetSubmitting}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {resetSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Updating password...</span>
              </>
            ) : (
              <span>Set New Password</span>
            )}
          </button>
        </form>
      </div>
    );
  }

  // 5. Error / Expired Link State
  return (
    <div className="text-center space-y-5 py-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto shadow-sm">
        <AlertCircle className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
          Verification Link Expired or Invalid
        </h3>
        <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
          {error || "This action link is invalid or has already been used. Please request a new one."}
        </p>
      </div>

      <div className="pt-2 flex flex-col gap-2.5">
        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-all"
        >
          <span>Return to Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/verify-email"
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition-all"
        >
          <span>Request New Verification Email</span>
        </Link>
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <AuthSplitLayout
      heading="SiteSecura Security Authorization"
      subheading="Processing your cryptographic email or password action code."
      badgeText="Identity Action Verification"
    >
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-600 mb-2" />
            <p className="text-xs text-slate-500">Loading action handler...</p>
          </div>
        }
      >
        <AuthActionContent />
      </Suspense>
    </AuthSplitLayout>
  );
}
