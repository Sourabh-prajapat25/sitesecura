"use client";

import React, { useState } from "react";
import {
  FileText,
  Globe,
  RotateCcw,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Search,
  Code2,
  Layers,
} from "lucide-react";

export interface CspPolicyFormProps {
  mode: "paste" | "remote";
  setMode: (m: "paste" | "remote") => void;
  policy: string;
  setPolicy: (p: string) => void;
  policyType: "enforce" | "report_only";
  setPolicyType: (t: "enforce" | "report_only") => void;
  url: string;
  setUrl: (u: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onClear: () => void;
}

const EXAMPLE_STRICT =
  "default-src 'none'; script-src 'strict-dynamic' 'nonce-rAnd0m1234567890' 'unsafe-inline'; style-src 'self' 'nonce-rAnd0m1234567890'; img-src 'self' data:; connect-src 'self' https://api.example.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests;";

const EXAMPLE_TYPICAL =
  "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.example.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';";

const EXAMPLE_WEAK =
  "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *;";

export function CspPolicyForm({
  mode,
  setMode,
  policy,
  setPolicy,
  policyType,
  setPolicyType,
  url,
  setUrl,
  onSubmit,
  isLoading,
  onClear,
}: CspPolicyFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (mode === "paste") {
      const trimmed = policy.trim();
      if (!trimmed) {
        setValidationError("Please paste or type a Content-Security-Policy header string to analyze.");
        return;
      }
    } else {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        setValidationError("Please enter a target website URL to inspect headers for.");
        return;
      }
      if (trimmedUrl.includes("@")) {
        setValidationError("URLs containing embedded credentials ('@') are not permitted.");
        return;
      }
    }

    onSubmit();
  };

  const handleLoadExample = (exampleText: string) => {
    setMode("paste");
    setPolicy(exampleText);
    setPolicyType("enforce");
    setValidationError(null);
  };

  const handleQuickFillUrl = (sampleUrl: string) => {
    setMode("remote");
    setUrl(sampleUrl);
    setValidationError(null);
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 text-left">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              setMode("paste");
              setValidationError(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              mode === "paste"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Code2 className="w-4 h-4 text-sky-600" />
            <span>Paste CSP Policy</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("remote");
              setValidationError(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              mode === "remote"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="w-4 h-4 text-sky-600" />
            <span>Inspect Website Headers</span>
          </button>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          W3C CSP Level 3 • Deterministic
        </span>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {mode === "paste" ? (
          /* Mode A: Paste Policy Textarea */
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label htmlFor="csp-policy-input" className="text-sm font-bold text-slate-800">
                Content Security Policy Header String
              </label>

              {/* Policy Type Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Header Type:</span>
                <select
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value as "enforce" | "report_only")}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="enforce">Content-Security-Policy (Enforce)</option>
                  <option value="report_only">Content-Security-Policy-Report-Only</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <textarea
                id="csp-policy-input"
                rows={5}
                spellCheck="false"
                placeholder="e.g. default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none';"
                value={policy}
                onChange={(e) => {
                  setPolicy(e.target.value);
                  setValidationError(null);
                }}
                disabled={isLoading}
                className={`w-full p-4 bg-slate-50 border rounded-2xl text-slate-900 placeholder-slate-400 font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all leading-relaxed ${
                  validationError
                    ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                    : "border-slate-200 focus:ring-sky-500/20 focus:border-sky-500"
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Separate directives with semicolons (;)</span>
              <span className="font-mono">{policy.length.toLocaleString()} / 100,000 characters</span>
            </div>
          </div>
        ) : (
          /* Mode B: Public Website URL Input */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="target-url-input" className="text-sm font-bold text-slate-800">
                Public Website URL or Hostname
              </label>
              <span className="text-xs text-slate-500">Retrieves HTTP response headers only</span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Globe className="w-5 h-5" />
              </div>
              <input
                id="target-url-input"
                type="text"
                autoComplete="off"
                spellCheck="false"
                placeholder="e.g. example.com or https://example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setValidationError(null);
                }}
                disabled={isLoading}
                className={`w-full pl-11 pr-24 py-3.5 bg-slate-50 border rounded-2xl text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                  validationError
                    ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                    : "border-slate-200 focus:ring-sky-500/20 focus:border-sky-500"
                }`}
              />
              {url && !isLoading && (
                <button
                  type="button"
                  onClick={onClear}
                  className="absolute inset-y-0 right-3 px-2 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 pt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Safe TCP Socket Pinning • SSRF Protected • Zero body bytes downloaded</span>
            </div>
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Action Controls & Quick Examples */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {mode === "paste" ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Load Sample:
              </span>
              <button
                type="button"
                onClick={() => handleLoadExample(EXAMPLE_STRICT)}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
              >
                Strict CSP Level 3
              </button>
              <button
                type="button"
                onClick={() => handleLoadExample(EXAMPLE_TYPICAL)}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
              >
                Typical SaaS
              </button>
              <button
                type="button"
                onClick={() => handleLoadExample(EXAMPLE_WEAK)}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
              >
                Weak Legacy
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Sample Sites:
              </span>
              <button
                type="button"
                onClick={() => handleQuickFillUrl("google.com")}
                className="text-xs font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
              >
                google.com
              </button>
              <button
                type="button"
                onClick={() => handleQuickFillUrl("github.com")}
                className="text-xs font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
              >
                github.com
              </button>
              <button
                type="button"
                onClick={() => handleQuickFillUrl("cloudflare.com")}
                className="text-xs font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-2.5 py-1 rounded-lg transition-colors"
              >
                cloudflare.com
              </button>
            </div>
          )}

          {/* Submit and Reset Buttons */}
          <div className="flex items-center gap-2">
            {(policy || url) && (
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
              disabled={isLoading || (mode === "paste" ? !policy.trim() : !url.trim())}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === "paste" ? "Analyzing Policy..." : "Fetching Headers..."}</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>{mode === "paste" ? "Analyze CSP Policy" : "Fetch & Analyze CSP"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
