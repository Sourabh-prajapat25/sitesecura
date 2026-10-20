import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  Lock,
  Globe,
  Calendar,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { API_BASE } from "@/lib/api";
import { PublicVerificationResponse } from "@/types";

interface PageProps {
  params: {
    token: string;
  };
}

export const metadata: Metadata = {
  title: "SiteSecura Verified Security Status",
  description:
    "Point-in-time security check verification status provided by SiteSecura defensive security scanner.",
  robots: {
    index: false,
    follow: false,
  },
};

async function fetchVerificationData(token: string): Promise<PublicVerificationResponse | null> {
  try {
    const rawApiBase = process.env.NEXT_PUBLIC_API_URL || API_BASE || "http://127.0.0.1:8000/api/v1";
    const apiBase = rawApiBase.replace(/\/+$/, "");
    const res = await fetch(`${apiBase}/public/verified/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return isoString;
  }
}

export default async function PublicVerificationPage({ params }: PageProps) {
  const token = params.token;
  const data = await fetchVerificationData(token);

  const status = data?.status || "not_found";
  const domain = data?.domain || "Unknown Domain";
  const isVerified = status === "verified";
  const isExpired = status === "expired";
  const isRevoked = status === "revoked";
  const isNotFound = status === "not_found";

  const rawApiBase = process.env.NEXT_PUBLIC_API_URL || API_BASE || "http://127.0.0.1:8000/api/v1";
  const backendOrigin = rawApiBase.replace(/\/api\/v1\/?$/, "");
  const badgeSvgUrl = `${backendOrigin}/badges/${encodeURIComponent(token)}.svg`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="flex-1 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
          {/* Main Status Hero Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-10 space-y-6">
            {/* Header Badge */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {isVerified && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified & Active</span>
                </div>
              )}
              {isExpired && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Verification Expired</span>
                </div>
              )}
              {isRevoked && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 text-rose-800 text-xs font-semibold border border-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Verification Revoked</span>
                </div>
              )}
              {isNotFound && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>Verification Not Found</span>
                </div>
              )}

              {/* Dynamic SVG Badge Preview */}
              {!isNotFound && (
                <div className="inline-flex items-center">
                  <img
                    src={badgeSvgUrl}
                    alt="SiteSecura Verified Dynamic Badge"
                    className="h-8 max-w-[200px]"
                  />
                </div>
              )}
            </div>

            {/* Title & Domain Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {isVerified && "SiteSecura Verified"}
                {isExpired && "SiteSecura Verification Expired"}
                {isRevoked && "SiteSecura Verification Revoked"}
                {isNotFound && "Verification Record Not Found"}
              </h1>

              {!isNotFound ? (
                <div className="flex items-center gap-2 text-lg sm:text-xl font-mono text-slate-700 font-semibold break-all">
                  <Globe className="w-5 h-5 text-slate-400 shrink-0" />
                  <span>{domain}</span>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  The verification token specified in the URL is invalid, does not exist, or has been removed.
                </p>
              )}
            </div>

            {/* Status Narrative */}
            <div className="text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              {isVerified && (
                <p>
                  This website satisfies the requirements of the{" "}
                  <strong className="text-slate-900">SiteSecura Verification Policy</strong> based
                  on its most recent completed automated security scan.
                </p>
              )}
              {isExpired && (
                <p>
                  The verification assessment for this website has lapsed past its validity window.
                  A new completed security assessment is required to re-establish verification.
                </p>
              )}
              {isRevoked && (
                <p>
                  The verified status for this website was revoked by the site administrator or
                  organization owner. This badge is no longer active.
                </p>
              )}
              {isNotFound && (
                <p>
                  If you are the website owner, please verify that you have initiated badge verification
                  from your SiteSecura dashboard.
                </p>
              )}
            </div>

            {/* Assessment Metadata Grid */}
            {!isNotFound && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Assessment Date</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatDate(data?.verified_at)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Valid Until</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatDate(data?.expires_at)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Verification Tier</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {data?.verification_tier || "Security Check Verified"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Point-in-Time Scope & Verification Standard */}
          {!isNotFound && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-600" />
                <span>Scope of Security Verification</span>
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                The SiteSecura Verified badge indicates that automated defensive checks were
                performed on the target website&apos;s public perimeter at the specified assessment date:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                <li className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>HTTPS / TLS Encryption & Certificate Validity</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Defensive HTTP Security Headers (HSTS, CSP, XFO)</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Email Spoofing Defense (SPF, DMARC, DNSSEC)</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Cookie Security Flags (Secure, HttpOnly, SameSite)</span>
                </li>
              </ul>
            </div>
          )}

          {/* Responsible Security Notice & Disclaimer */}
          <div className="bg-amber-50/70 rounded-2xl border border-amber-200/80 p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Responsible Security Notice & Limitation</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-950/80 leading-relaxed">
              {data?.disclaimer ||
                "SiteSecura Verified confirms that this website met defined security configuration standards at the time of its latest completed assessment. This verification does not guarantee absolute security, immunity from cyber threats, or absence of undetected vulnerabilities."}
            </p>
            <p className="text-xs text-amber-900/70 leading-relaxed pt-1">
              SiteSecura assessments are point-in-time perimeter evaluations. They do not constitute an
              application code audit, penetration test, or guarantee against social engineering or zero-day exploits.
            </p>
          </div>

          {/* CTA Card for Visitors */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold">
                Scan Your Own Website for Free
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                Get an instant deterministic security score, posture checklist, and verified fixes in 60 seconds.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition-all shadow-sm shrink-0"
            >
              <span>Scan Website Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
