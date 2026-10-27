"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { signInWithEmail, signInWithGoogle, getAuthErrorMessage } from "@/lib/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthSocialButton } from "@/components/auth/AuthSocialButton";
import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";
import { AuthPageFooter } from "@/components/auth/AuthPageFooter";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";
  const { isAuthenticated, isEmailVerified, onboardingStatus, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated and verified, redirect to intended target or onboarding
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (isEmailVerified) {
        if (onboardingStatus === "pending_plan_selection") {
          router.push("/onboarding/plan");
        } else {
          router.push(redirectTarget);
        }
      } else {
        router.push("/verify-email");
      }
    }
  }, [isAuthenticated, isEmailVerified, onboardingStatus, authLoading, router, redirectTarget]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || socialLoading) return;

    if (!email.trim() || !password) {
      setError("Please enter both your email address and password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cred = await signInWithEmail(email, password);

      // Check whether email address is verified
      if (!cred.user.emailVerified) {
        router.push("/verify-email");
        return;
      }

      // Synchronize with backend with retry
      try {
        const syncRes = await api.syncUser();
        if (syncRes.onboarding_status === "pending_plan_selection") {
          router.push("/onboarding/plan");
          return;
        }
      } catch (syncErr) {
        console.warn("Retrying user synchronization...", syncErr);
        try {
          await api.syncUser();
        } catch (retryErr) {
          console.warn("Backend synchronization deferred.", retryErr);
        }
      }

      router.push(redirectTarget);
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || socialLoading) return;

    setSocialLoading(true);
    setError(null);

    try {
      await signInWithGoogle();

      // Synchronize with backend with retry
      try {
        const syncRes = await api.syncUser();
        if (syncRes.onboarding_status === "pending_plan_selection") {
          router.push("/onboarding/plan");
          return;
        }
      } catch (syncErr) {
        console.warn("Retrying user synchronization...", syncErr);
        try {
          await api.syncUser();
        } catch {
          // Continue to dashboard
        }
      }

      router.push(redirectTarget);
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
      setSocialLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      heading="Welcome back to SiteSecura"
      subheading="Sign in to your defensive security workspace to monitor website health and view real-time risk scores."
      badgeText="Secure Infrastructure Login"
    >
      {/* Social Google Login */}
      <AuthSocialButton
        onClick={handleGoogleLogin}
        loading={socialLoading}
        disabled={loading}
        label="Continue with Google"
      />

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
            Or with email credentials
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-5">
          <AuthErrorAlert message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        {/* Email Address */}
        <div className="space-y-1">
          <label htmlFor="email-input" className="block text-xs font-semibold text-slate-700">
            Work Email Address <span className="text-red-500">*</span>
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
              placeholder="you@company.com"
              autoComplete="username"
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
            placeholder="Enter your account password"
            autoComplete="current-password"
            rightAction={
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
              >
                Forgot password?
              </Link>
            }
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || socialLoading}
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/40 mt-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Authenticating...</span>
            </>
          ) : (
            <span>Sign in to Workspace</span>
          )}
        </button>
      </form>

      {/* Security Assurance Bullet */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>TLS 256-bit encrypted session credentials</span>
      </div>

      {/* Footer Links */}
      <AuthPageFooter mode="login" />
    </AuthSplitLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
