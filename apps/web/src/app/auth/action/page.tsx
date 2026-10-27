"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import {
  verifyEmailActionCode,
  confirmUserPasswordReset,
  getAuthErrorMessage,
  waitForAuthInit,
  getFirebaseIdToken,
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
  const planParam = searchParams.get("plan");
  const intervalParam = searchParams.get("interval");
  const planQuery = planParam
    ? `?plan=${encodeURIComponent(planParam)}${
        intervalParam ? `&interval=${encodeURIComponent(intervalParam)}` : ""
      }`
    : "";

  const [loading, setLoading] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [syncFailed, setSyncFailed] = useState<boolean>(false);
  const [syncRetrying, setSyncRetrying] = useState<boolean>(false);
  const [destination, setDestination] = useState<string>(`/onboarding/plan${planQuery}`);

  // Password reset specific states
  const [newPassword, setNewPassword] = useState<string>("");
  const [resetSubmitting, setResetSubmitting] = useState<boolean>(false);

  // Prevent duplicate execution under React Strict Mode or rerenders
  const actionProcessedRef = useRef<boolean>(false);

  useEffect(() => {
    if (actionProcessedRef.current) return;
    actionProcessedRef.current = true;

    const processAction = async () => {
      // 1. Validate mode parameter
      if (!mode) {
        setLoading(false);
        setError("Invalid action request. Missing action mode parameter.");
        return;
      }

      // 2. Handle Password Reset mode
      if (mode === "resetPassword") {
        if (!oobCode) {
          setLoading(false);
          setError("Missing password reset code. Please request a new password reset link from the sign-in page.");
          return;
        }
        // Ready for user to enter new password
        setLoading(false);
        return;
      }

      // 3. Handle Email Verification mode
      if (mode === "verifyEmail") {
        // Case B: In-app action code present
        if (oobCode) {
          try {
            await verifyEmailActionCode(oobCode);
          } catch (err: any) {
            // Check if current user is already verified before displaying error
            const currentUser = await waitForAuthInit();
            if (currentUser?.emailVerified) {
              // Code may already have been consumed because user is already verified
            } else {
              setLoading(false);
              setError(getAuthErrorMessage(err));
              return;
            }
          }
        }
        // Case A (Firebase hosted action completion redirect without oobCode)
        // or continuation after Case B

        // Wait for Firebase to finish credential restoration
        const currentUser = await waitForAuthInit();

        if (!currentUser) {
          // User is not signed in on this client (e.g. verified on another device or private window)
          setSuccess(true);
          setLoading(false);
          return;
        }

        // User is signed in: reload from Firebase to fetch fresh emailVerified status
        try {
          await currentUser.reload();
          await getFirebaseIdToken(true);
        } catch (reloadErr) {
          console.warn("Failed to reload user in action handler:", reloadErr);
        }

        if (!currentUser.emailVerified) {
          // Email is not yet verified
          setLoading(false);
          setIsPending(true);
          return;
        }

        // Email IS verified!
        // Refresh AuthContext profile
        await reloadUser();

        // Synchronize with backend
        try {
          const syncRes = await api.syncUser();
          const dest =
            syncRes?.onboarding_status === "pending_plan_selection" || planParam
              ? `/onboarding/plan${planQuery}`
              : "/dashboard";
          setDestination(dest);
          setSuccess(true);
          // Optional short redirect for frictionless UX
          setTimeout(() => {
            router.push(dest);
          }, 1500);
        } catch (syncErr: any) {
          console.error("Backend synchronization failed during action handler:", syncErr);
          setSyncFailed(true);
          setSuccess(true);
        } finally {
          setLoading(false);
        }
        return;
      }

      // 4. Unsupported action mode
      setLoading(false);
      setError(`Unsupported action mode: '${mode}'.`);
    };

    processAction();
  }, [mode, oobCode, planParam, planQuery, reloadUser, router]);

  // Handler for retry backend sync
  const handleRetrySync = async () => {
    if (syncRetrying) return;
    setSyncRetrying(true);
    try {
      await reloadUser();
      const syncRes = await api.syncUser();
      const dest =
        syncRes?.onboarding_status === "pending_plan_selection" || planParam
          ? `/onboarding/plan${planQuery}`
          : "/dashboard";
      setSyncFailed(false);
      router.push(dest);
    } catch (err: any) {
      setError(err?.message || "Account setup synchronization failed. Please try again.");
    } finally {
      setSyncRetrying(false);
    }
  };

  // Handler for re-checking pending status
  const handleCheckPendingStatus = async () => {
    setLoading(true);
    try {
      const refreshed = await reloadUser();
      if (refreshed?.emailVerified) {
        setIsPending(false);
        const syncRes = await api.syncUser();
        const dest =
          syncRes?.onboarding_status === "pending_plan_selection" || planParam
            ? `/onboarding/plan${planQuery}`
            : "/dashboard";
        setDestination(dest);
        setSuccess(true);
        router.push(dest);
      } else {
        setIsPending(true);
      }
    } catch (err: any) {
      console.warn("Error re-checking pending status:", err);
    } finally {
      setLoading(false);
    }
  };

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
          Confirming verification status...
        </p>
        <p className="text-xs text-slate-500">
          Please wait while SiteSecura synchronizes your security identity.
        </p>
      </div>
    );
  }

  // 2. Email Verification: PENDING (user signed in but email not verified yet)
  if (mode === "verifyEmail" && isPending) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Verification Pending
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            We haven&apos;t detected your verification yet. Open the latest verification email, click the link, and check again.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleCheckPendingStatus}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Check Verification Status Again</span>
          </button>
          <Link
            href={`/verify-email${planQuery}`}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition-all"
          >
            <span>Go to Verification Page</span>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Email Verification: SUCCESS (with backend sync failure)
  if (mode === "verifyEmail" && success && syncFailed) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Email Verified Successfully!
          </h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
            Your email has been verified with Firebase. However, we could not finalize your account setup with SiteSecura servers right now. Please click below to retry.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleRetrySync}
            disabled={syncRetrying}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-60"
          >
            {syncRetrying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Finalizing account setup...</span>
              </>
            ) : (
              <>
                <span>Retry Account Setup</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <Link
            href={destination}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-sm transition-all"
          >
            <span>Proceed to Workspace</span>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Email Verification: SUCCESS (Fully synchronized or guest state)
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
            {user
              ? "Your email address has been verified. Your security workspace and scanning rights are now fully active."
              : "Your email address has been verified. Please sign in to access your SiteSecura account."}
          </p>
        </div>

        <div className="pt-2">
          {user ? (
            <Link
              href={destination}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
            >
              <span>{destination.includes("onboarding") ? "Continue to Plan Selection" : "Continue to Dashboard"}</span>
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

  // 5. Password Reset: SUCCESS
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

  // 6. Password Reset Form (when mode === "resetPassword" and not yet submitted)
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

  // 7. Error / Expired Link State
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
          href={`/verify-email${planQuery}`}
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
