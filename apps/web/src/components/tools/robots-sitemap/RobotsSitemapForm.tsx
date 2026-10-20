"use client";

import React, { useState } from "react";
import {
  Search,
  RotateCcw,
  AlertCircle,
  Loader2,
  ShieldCheck,
  FileCode,
  Globe,
  Network,
  Sparkles,
} from "lucide-react";

export interface RobotsSitemapFormProps {
  domain: string;
  setDomain: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onClear: () => void;
}

export function RobotsSitemapForm({
  domain,
  setDomain,
  onSubmit,
  isLoading,
  onClear,
}: RobotsSitemapFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  // Extract a clean preview hostname
  const getCleanHostname = (raw: string): string => {
    let clean = raw.trim().toLowerCase();
    if (clean.startsWith("https://")) clean = clean.substring(8);
    else if (clean.startsWith("http://")) clean = clean.substring(7);
    const slashIdx = clean.indexOf("/");
    if (slashIdx !== -1) clean = clean.substring(0, slashIdx);
    const colonIdx = clean.indexOf(":");
    if (colonIdx !== -1) clean = clean.substring(0, colonIdx);
    return clean;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setDomain(rawVal);

    if (!rawVal.trim()) {
      setValidationError(null);
      return;
    }

    const trimmed = rawVal.trim().toLowerCase();

    if (trimmed.includes("@")) {
      setValidationError("Targets containing embedded credentials ('@') are not permitted.");
    } else if (
      trimmed.startsWith("javascript:") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("ftp:") ||
      trimmed.startsWith("file:")
    ) {
      setValidationError("Only standard HTTP and HTTPS targets are supported.");
    } else if (
      trimmed.includes("127.0.0.1") ||
      trimmed.includes("localhost") ||
      trimmed.includes("169.254.169.254") ||
      trimmed.includes("0.0.0.0")
    ) {
      setValidationError("Localhost, loopback, and cloud metadata targets are prohibited by security policy.");
    } else {
      setValidationError(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = domain.trim();
    if (!trimmed) {
      setValidationError("Please enter a target domain or website URL to inspect.");
      return;
    }

    if (trimmed.includes("@")) {
      setValidationError("Targets containing embedded credentials ('@') are not permitted.");
      return;
    }

    setValidationError(null);
    onSubmit();
  };

  const handleQuickFill = (exampleDomain: string) => {
    setDomain(exampleDomain);
    setValidationError(null);
  };

  const cleanHost = getCleanHostname(domain);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 text-left">
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="target-domain-input" className="text-sm font-bold text-slate-800">
              Target Domain or Website URL
            </label>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              <ShieldCheck className="w-3 h-3 text-sky-600" />
              SSRF Protected • RFC 9309
            </span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-5 h-5" />
            </div>
            <input
              id="target-domain-input"
              type="text"
              autoComplete="off"
              spellCheck="false"
              placeholder="e.g. example.com or https://example.com/robots.txt"
              value={domain}
              onChange={handleInputChange}
              disabled={isLoading}
              className={`w-full pl-11 pr-24 py-3.5 bg-slate-50 border rounded-2xl text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                validationError
                  ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                  : "border-slate-200 focus:ring-sky-500/20 focus:border-sky-500"
              }`}
            />
            {domain && !isLoading && (
              <button
                type="button"
                onClick={onClear}
                className="absolute inset-y-0 right-3 px-2 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear input"
              >
                Clear
              </button>
            )}
          </div>

          {/* Real-time Target Resolution Preview */}
          {cleanHost && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Checking targets:</span>
              <span className="font-mono text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/80">
                https://{cleanHost}/robots.txt
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                https://{cleanHost}/sitemap.xml
              </span>
            </div>
          )}

          {/* Validation Error Banner */}
          {validationError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Quick-fill Example Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Examples:
            </span>
            <button
              type="button"
              onClick={() => handleQuickFill("google.com")}
              className="text-xs font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
            >
              google.com
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("github.com")}
              className="text-xs font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
            >
              github.com
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("wikipedia.org")}
              className="text-xs font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
            >
              wikipedia.org
            </button>
          </div>

          {/* Submit and Reset Buttons */}
          <div className="flex items-center gap-2">
            {domain && (
              <button
                type="button"
                onClick={onClear}
                disabled={isLoading}
                className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !domain.trim()}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Inspecting Directives...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Check Robots & Sitemap</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Safety & Protocol Guarantees */}
      <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <span>RFC 9309 Compliant Parser</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FileCode className="w-3.5 h-3.5" />
          </div>
          <span>XML Sitemaps.org Protocol</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Network className="w-3.5 h-3.5" />
          </div>
          <span>SSRF-Safe Origin Defense</span>
        </div>
      </div>
    </div>
  );
}
