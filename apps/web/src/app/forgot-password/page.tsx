"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { resetUserPassword, getAuthErrorMessage } from "@/lib/auth";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { AuthErrorAlert } from "@/components/auth/AuthErrorAlert";
import { AuthPageFooter } from "@/components/auth/AuthPageFooter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid account email address.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetUserPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      heading="Reset your password"
      subheading="Enter the email associated with your SiteSecura account, and we will send you a secure password recovery link."
      badgeText="Account Recovery"
    >
      {sent ? (
        <div className="text-center space-y-5 py-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Check your inbox
            </h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
              If an account exists for <strong className="text-slate-800 font-mono">{email}</strong>, we have sent instructions to reset your password.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/20 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          {error && (
            <div className="mb-4">
              <AuthErrorAlert message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700">
              Account Email Address
            </label>
            <div className="relative rounded-xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:bg-slate-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md shadow-sky-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/40 mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Sending recovery link...</span>
              </>
            ) : (
              <span>Send Recovery Link</span>
            )}
          </button>
        </form>
      )}

      <AuthPageFooter mode="forgot-password" />
    </AuthSplitLayout>
  );
}
