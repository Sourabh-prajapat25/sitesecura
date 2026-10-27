"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User as UserIcon, Mail, CheckCircle2, Loader2 } from "lucide-react";
import {
  signUpWithEmail,
  signInWithGoogle,
  sendUserEmailVerification,
  getAuthErrorMessage,
} from "@/lib/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { AuthSocialButton } from "@/components/auth/AuthSocialButton";
import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";
import { AuthPageFooter } from "@/components/auth/AuthPageFooter";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isEmailVerified, onboardingStatus, loading: authLoading } = useAuth();

  const planParam = searchParams.get("plan");
  const intervalParam = searchParams.get("interval");
  const planQuery = planParam
    ? `?plan=${encodeURIComponent(planParam)}${
        intervalParam ? `&interval=${encodeURIComponent(intervalParam)}` : ""
      }`
    : "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedConsent, setAgreedConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated and verified, redirect to onboarding or dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (isEmailVerified) {
        if (onboardingStatus === "pending_plan_selection" || planParam) {
          router.push(`/onboarding/plan${planQuery}`);
        } else {
          router.push("/dashboard");
        }
      } else {
        router.push(`/verify-email${planQuery}`);
      }
    }
  }, [isAuthenticated, isEmailVerified, onboardingStatus, authLoading, router, planQuery, planParam]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || socialLoading) return;

    setError(null);

    // Client-side validation
    if (!agreedConsent) {
      setError(
        "Please accept the Terms of Service and acknowledge the Privacy Policy to create your account."
      );
      return;
    }

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid business email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth credential
      const cred = await signUpWithEmail(email, password, name);

      // 2. Trigger Firebase email verification link
      try {
        await sendUserEmailVerification(cred.user, { plan: planParam, interval: intervalParam });
      } catch (emailErr) {
        console.warn("Notice: Initial email verification trigger note:", emailErr);
      }

      // 3. Safe backend user synchronization with 1-time retry
      try {
        await api.syncUser();
      } catch (syncErr) {
        console.warn("Retrying user synchronization...", syncErr);
        try {
          await api.syncUser();
        } catch (retryErr) {
          console.warn("Backend synchronization deferred until next session.", retryErr);
        }
      }

      // 4. Direct user to dedicated verification screen preserving plan selection intent
      router.push(`/verify-email${planQuery}`);
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (loading || socialLoading) return;

    if (!agreedConsent) {
      setError(
        "Please accept the Terms of Service and acknowledge the Privacy Policy before signing up with Google."
      );
      return;
    }

    setSocialLoading(true);
    setError(null);

    try {
      await signInWithGoogle();

      // Safe user synchronization with retry
      try {
        const syncRes = await api.syncUser();
        if (syncRes.onboarding_status === "pending_plan_selection" || planParam) {
          router.push(`/onboarding/plan${planQuery}`);
          return;
        }
      } catch (syncErr) {
        console.warn("Retrying user synchronization...", syncErr);
        try {
          await api.syncUser();
        } catch {
          // Continue to dashboard or onboarding
        }
      }

      // If user had selected a plan, direct to onboarding with preselected plan
      if (planParam) {
        router.push(`/onboarding/plan${planQuery}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
      setSocialLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      heading="Create your SiteSecura account"
      subheading="Get started with continuous security scoring, SSL and header monitoring, and actionable vulnerability remediation."
      badgeText={planParam ? `Selected Plan: ${planParam.toUpperCase()}` : "Start Free • No Credit Card Required"}
    >
      {/* Social Google Signup */}
      <AuthSocialButton
        onClick={handleGoogleRegister}
        loading={socialLoading}
        disabled={loading}
        label="Sign up with Google"
      />

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
            Or with email
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-5">
          <AuthErrorAlert message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleRegister} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1">
          <label htmlFor="name-input" className="block text-xs font-semibold text-slate-700">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <input
              id="name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || socialLoading}
              placeholder="Jane Doe"
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Email Address */}
        <div className="space-y-1">
          <label htmlFor="email-input" className="block text-xs font-semibold text-slate-700">
            Email <span className="text-red-500">*</span>
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || socialLoading}
              placeholder="you@gmail.com"
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1">
          <PasswordInput
            id="password-input"
            label="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || socialLoading}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <PasswordStrengthIndicator password={password} />
        </div>

        {/* Terms & Privacy Consent Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 leading-relaxed select-none">
            <input
              type="checkbox"
              required
              checked={agreedConsent}
              onChange={(e) => setAgreedConsent(e.target.checked)}
              disabled={loading || socialLoading}
              className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 mt-0.5 cursor-pointer shrink-0"
            />
            <span>
              I agree to the SiteSecura{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-semibold text-sky-600 hover:text-sky-700 underline"
              >
                Terms of Service
              </Link>{" "}
              and acknowledge the{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-semibold text-sky-600 hover:text-sky-700 underline"
              >
                Privacy Policy
              </Link>
              . I confirm I am authorized to scan the web domains I submit.
            </span>
          </label>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading || socialLoading}
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/40 mt-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Creating your account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>
      </form>

      {/* Feature Bullet Points */}
      <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-1.5 text-xs text-slate-500">
        <p className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          10 free monthly scans with full score breakdown
        </p>
        <p className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          Immediate verification email link sent to your inbox
        </p>
      </div>

      {/* Footer */}
      <AuthPageFooter mode="register" />
    </AuthSplitLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
