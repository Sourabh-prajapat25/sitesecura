"use client";

import React, { useState } from "react";
import { Mail, CheckCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { trackContentEvent } from "@/lib/analytics";

interface NewsletterSignupProps {
  className?: string;
  source?: string;
  variant?: "banner" | "inline" | "compact";
  title?: string;
  description?: string;
}

export function NewsletterSignup({
  className = "",
  source = "blog",
  variant = "banner",
  title = "Get Actionable Security Advisories",
  description = "Join cybersecurity engineers receiving weekly zero-day breakdowns, security checklists, and technical defense guidelines.",
}: NewsletterSignupProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setStatus("error");
      setMessage("Please provide a valid corporate or professional email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await api.subscribeNewsletter(cleanEmail, source);
      setStatus("success");
      setMessage(res.message || "Thank you for subscribing to SiteSecura security insights!");
      setEmail("");

      trackContentEvent({
        event_name: "newsletter_signup",
        content_type: "newsletter",
        content_id: cleanEmail,
        source,
      });
    } catch (err: any) {
      setStatus("error");
      setMessage(
        err.message || "Unable to subscribe at this moment. Please try again shortly."
      );
    }
  };

  if (variant === "compact") {
    return (
      <div className={`p-4 rounded-2xl bg-slate-900 border border-slate-800 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Mail className="w-4 h-4 text-sky-400" />
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Security Newsletter
          </h4>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Weekly CVE alerts & defensive best practices. No spam.
        </p>

        {status === "success" ? (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                disabled={status === "loading"}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              {status === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Subscribe</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            {status === "error" && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{message}</span>
              </p>
            )}
          </form>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-6 sm:p-8 lg:p-10 shadow-xl ${className}`}
    >
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-400 border border-sky-800/80 mb-4">
          <Mail className="w-3.5 h-3.5 text-sky-400" />
          <span>SiteSecura Security Dispatch</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          {description}
        </p>

        {status === "success" ? (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Subscription Confirmed</p>
              <p className="text-xs text-emerald-400/90 mt-0.5">{message}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email address"
                disabled={status === "loading"}
                className="w-full px-4 py-3 bg-slate-950/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all shrink-0"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Subscribing...</span>
                </>
              ) : (
                <>
                  <span>Subscribe</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {status === "error" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-500 mt-3">
          Zero marketing spam. One-click unsubscribe anytime. Read our privacy policy.
        </p>
      </div>
    </div>
  );
}
