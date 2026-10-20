"use client";

import React from "react";
import Link from "next/link";
import { Shield, ShieldCheck, Activity, FileCheck, CheckCircle2, Lock } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export interface AuthSplitLayoutProps {
  children: React.ReactNode;
  heading?: string;
  subheading?: string;
  badgeText?: string;
}

export function AuthSplitLayout({
  children,
  heading,
  subheading,
  badgeText = "Continuous Website Security",
}: AuthSplitLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      {/* ========================================================================= */}
      {/* LEFT BRANDED PANEL (Visible on lg+ screens) */}
      {/* ========================================================================= */}
      <aside
        aria-label="SiteSecura Platform Overview"
        className="hidden lg:flex lg:w-5/12 xl:w-1/2 flex-col justify-between bg-slate-950 text-white p-12 xl:p-16 relative overflow-hidden border-r border-slate-800/80 selection:bg-sky-500 selection:text-white"
      >
        {/* Atmospheric Ambient Glows & Grid Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_-10%,rgba(14,165,233,0.22),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_90%,rgba(56,189,248,0.12),transparent_70%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        {/* Top: Brand Header */}
        <div className="relative z-10">
          <Link
            href="/"
            className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
            title="SiteSecura Home"
          >
            <BrandLogo variant="light" size="lg" />
          </Link>
        </div>

        {/* Middle: Brand Narrative & Feature Highlights */}
        <div className="relative z-10 my-auto py-10 space-y-8 max-w-lg">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-semibold tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>{badgeText}</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise-grade defensive cybersecurity posture for your web assets.
            </h1>
            <p className="text-slate-400 text-sm xl:text-base leading-relaxed">
              Detect SSL/TLS weaknesses, security header drift, DNS vulnerabilities, and configuration flaws before attackers do.
            </p>
          </div>

          {/* Core Feature Pillars */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Deterministic Security Scoring</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Transparent 100-point security grade with zero noise and actionable remediation guides.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Continuous Automated Monitoring</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Automated background health checks and immediate email alerts for certificate expiration and score drops.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0 mt-0.5">
                <FileCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">SiteSecura Verified Badges & Reports</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Embeddable dynamic verification badges and executive PDF reports for clients and stakeholders.
                </p>
              </div>
            </div>
          </div>

          {/* Miniature Real Posture Preview Card */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl shadow-black/40 backdrop-blur-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-slate-300">Live Posture Assessment</span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                SCORE 96 / 100
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 text-center text-xs">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">SSL / TLS</div>
                <div className="font-bold text-slate-100 mt-0.5">Grade A+</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Headers</div>
                <div className="font-bold text-slate-100 mt-0.5">Protected</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">DNS / DMARC</div>
                <div className="font-bold text-slate-100 mt-0.5">Enforced</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust & Compliance Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Defensive Cybersecurity • Zero Invasive Testing</span>
          </div>
          <span>Strict Tenant Isolation</span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* RIGHT FORM AREA (Full width on mobile/tablet, right column on desktop) */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-12 xl:px-16 py-8 sm:py-12 overflow-y-auto">
        {/* Mobile / Tablet Header with Brand Logo */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <Link href="/" className="mb-4 inline-flex items-center" title="SiteSecura Home">
            <BrandLogo size="md" />
          </Link>
        </div>

        {/* Content Box */}
        <div className="w-full max-w-md mx-auto">
          {heading && (
            <div className="text-center sm:text-left mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {heading}
              </h2>
              {subheading && (
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {subheading}
                </p>
              )}
            </div>
          )}

          {/* Form / Page Content */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/40">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AuthSplitLayout;
