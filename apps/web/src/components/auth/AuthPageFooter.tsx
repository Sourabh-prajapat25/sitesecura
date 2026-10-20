"use client";

import React from "react";
import Link from "next/link";

export interface AuthPageFooterProps {
  mode: "login" | "register" | "forgot-password" | "verify";
}

export function AuthPageFooter({ mode }: AuthPageFooterProps) {
  return (
    <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-3">
      {/* Alternate Authentication Link */}
      <p className="text-xs text-slate-600">
        {mode === "login" && (
          <>
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-bold text-sky-600 hover:text-sky-700 underline underline-offset-2 transition-colors"
            >
              Create free account
            </Link>
          </>
        )}
        {mode === "register" && (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-bold text-sky-600 hover:text-sky-700 underline underline-offset-2 transition-colors"
            >
              Sign in
            </Link>
          </>
        )}
        {mode === "forgot-password" && (
          <>
            Remembered your password?{" "}
            <Link
              href="/login"
              className="font-bold text-sky-600 hover:text-sky-700 underline underline-offset-2 transition-colors"
            >
              Back to Sign in
            </Link>
          </>
        )}
        {mode === "verify" && (
          <>
            Want to use another account?{" "}
            <Link
              href="/login"
              className="font-bold text-sky-600 hover:text-sky-700 underline underline-offset-2 transition-colors"
            >
              Sign in with different email
            </Link>
          </>
        )}
      </p>

      {/* Trust & Legal Disclaimers */}
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Protected by enterprise-grade TLS encryption. By continuing, you agree to SiteSecura&apos;s{" "}
        <Link href="/terms" target="_blank" className="hover:text-slate-600 underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="hover:text-slate-600 underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

export default AuthPageFooter;
