"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

interface ToolScannerLauncherProps {
  toolName: string;
  buttonLabel?: string;
  placeholder?: string;
  helperText?: string;
  autoFocus?: boolean;
}

export function ToolScannerLauncher({
  toolName,
  buttonLabel = "Run Free Security Scan",
  placeholder = "example.com",
  helperText = "Instant, non-intrusive assessment. No software installation required.",
  autoFocus = false,
}: ToolScannerLauncherProps) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = domain.trim();
    if (!trimmed) {
      setErrorMessage("Please enter a domain name (e.g. example.com).");
      return;
    }

    // Clean leading protocol or trailing slashes for cleaner submission
    const cleanDomain = trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .trim();

    if (!cleanDomain || !cleanDomain.includes(".")) {
      setErrorMessage("Please enter a valid domain name with a domain extension (e.g. example.com).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const scan = await api.startScan(cleanDomain);
      router.push(`/scan/${scan.id}`);
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to initiate scan. Please verify the domain and try again."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5 p-2 bg-white rounded-2xl border-2 border-slate-200/90 shadow-lg shadow-slate-200/50 hover:border-sky-400/80 transition-all focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100">
          <div className="relative flex-1 flex items-center">
            <label htmlFor="tool-target-domain" className="sr-only">
              Target domain name for {toolName}
            </label>
            <Shield className="w-5 h-5 text-slate-400 ml-3.5 mr-2 shrink-0 pointer-events-none" />
            <input
              id="tool-target-domain"
              type="text"
              required
              autoFocus={autoFocus}
              disabled={isSubmitting}
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={placeholder}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full py-2.5 pr-3 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-md shadow-sky-600/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initiating scan...</span>
              </>
            ) : (
              <>
                <span>{buttonLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Unable to launch scan: </span>
              <span>{errorMessage}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-1 px-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{helperText}</span>
            </span>
            <span className="text-slate-400">
              Free plan: up to 3 scans / 24h
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
