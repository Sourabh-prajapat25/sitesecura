"use client";

import React, { useState } from "react";
import { Search, RotateCcw, AlertCircle, Loader2, Sparkles, ShieldCheck, FileCheck, Globe } from "lucide-react";

export interface SecurityTxtFormProps {
  domain: string;
  setDomain: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onClear: () => void;
}

export function SecurityTxtForm({
  domain,
  setDomain,
  onSubmit,
  isLoading,
  onClear,
}: SecurityTxtFormProps) {
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
      setValidationError("Please enter a target domain or website URL to validate.");
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
              Strict HTTPS (RFC 9116)
            </span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Globe className="w-4 h-4" />
            </div>
            <input
              id="target-domain-input"
              type="text"
              value={domain}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="e.g. google.com or github.com"
              autoComplete="off"
              spellCheck="false"
              className={`w-full pl-10 pr-24 py-3.5 bg-slate-50/70 border rounded-2xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                validationError
                  ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
                  : "border-slate-200/90 focus:border-sky-500 focus:ring-sky-100"
              }`}
            />
            {domain && !isLoading && (
              <button
                type="button"
                onClick={onClear}
                className="absolute inset-y-0 right-3 my-auto h-7 px-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors flex items-center gap-1"
                title="Clear input"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Validation Notice or Target Preview */}
          {validationError ? (
            <div className="flex items-center gap-2 text-xs text-rose-600 pt-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          ) : cleanHost ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 pt-1">
              <span className="font-semibold text-slate-700">Primary location:</span>
              <code className="text-sky-700 font-mono bg-sky-50 px-1.5 py-0.5 rounded text-[11px] border border-sky-100">
                https://{cleanHost}/.well-known/security.txt
              </code>
              <span className="text-slate-400">|</span>
              <span className="text-slate-400">Fallback:</span>
              <code className="text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                https://{cleanHost}/security.txt
              </code>
            </div>
          ) : (
            <p className="text-xs text-slate-500 pt-0.5">
              Enter any domain or hostname. The validator will inspect RFC 9116 directives, contact links, expiration timestamps, and signature armor over secure HTTPS.
            </p>
          )}
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Quick-fill presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-sky-500" />
              Examples:
            </span>
            {[
              { label: "Google", domain: "google.com" },
              { label: "GitHub", domain: "github.com" },
              { label: "1Password", domain: "1password.com" },
            ].map((sample) => (
              <button
                key={sample.domain}
                type="button"
                onClick={() => handleQuickFill(sample.domain)}
                disabled={isLoading}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors"
              >
                {sample.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || !domain.trim() || !!validationError}
            className="w-full sm:w-auto px-6 py-3 bg-[#087FE8] hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validating RFC 9116...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                <span>Validate security.txt</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
