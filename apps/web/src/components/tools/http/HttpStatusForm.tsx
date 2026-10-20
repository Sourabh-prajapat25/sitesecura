"use client";

import React, { useState } from "react";
import { Link2, Search, RotateCcw, AlertCircle, Loader2, Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";

export interface HttpStatusFormProps {
  url: string;
  setUrl: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onClear: () => void;
}

export function HttpStatusForm({
  url,
  setUrl,
  onSubmit,
  isLoading,
  onClear,
}: HttpStatusFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setUrl(rawVal);

    if (!rawVal.trim()) {
      setValidationError(null);
      return;
    }

    const trimmed = rawVal.trim().toLowerCase();

    if (trimmed.includes("@")) {
      setValidationError("URLs containing embedded username or password credentials ('@') are not permitted.");
    } else if (trimmed.startsWith("javascript:") || trimmed.startsWith("data:") || trimmed.startsWith("ftp:") || trimmed.startsWith("file:")) {
      setValidationError("Only standard HTTP and HTTPS URLs are permitted.");
    } else if (trimmed.includes("127.0.0.1") || trimmed.includes("localhost") || trimmed.includes("169.254.169.254")) {
      setValidationError("Localhost, loopback, and cloud metadata targets are prohibited by security policy.");
    } else {
      setValidationError(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setValidationError("Please enter a valid URL to inspect.");
      return;
    }

    const trimmed = url.trim().toLowerCase();
    if (trimmed.includes("@")) {
      setValidationError("URLs containing embedded username or password credentials ('@') are not permitted.");
      return;
    }

    setValidationError(null);
    onSubmit();
  };

  const handleQuickFill = (exampleUrl: string) => {
    setUrl(exampleUrl);
    setValidationError(null);
  };

  const getSchemeIndicator = () => {
    const trimmed = url.trim().toLowerCase();
    if (!trimmed) return null;
    if (trimmed.startsWith("https://")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          HTTPS
        </span>
      );
    }
    if (trimmed.startsWith("http://")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <ShieldAlert className="w-3 h-3 text-amber-600" />
          HTTP (Insecure)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
        Auto-HTTPS
      </span>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 text-left">
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="target-url-input" className="text-sm font-bold text-slate-800">
              Website URL to Inspect
            </label>
            {getSchemeIndicator()}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Link2 className="w-5 h-5" />
            </div>
            <input
              id="target-url-input"
              type="text"
              value={url}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="https://example.com/login or example.com"
              className="w-full pl-11 pr-24 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 font-mono text-sm sm:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all disabled:opacity-60"
            />
            {url && (
              <button
                type="button"
                onClick={onClear}
                disabled={isLoading}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {validationError && (
            <div className="flex items-center gap-2 text-rose-600 text-xs font-medium pt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Enter a full URL (with path/query if desired) or domain name. If the scheme is omitted, HTTPS will be used automatically.
          </p>
        </div>

        {/* Action Controls & Preset Examples */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Quick examples:</span>
            <button
              type="button"
              onClick={() => handleQuickFill("https://github.com")}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-slate-700 font-mono text-[11px] transition-colors"
            >
              github.com
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("http://example.com")}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-slate-700 font-mono text-[11px] transition-colors"
            >
              http://example.com
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("https://wikipedia.org")}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-slate-700 font-mono text-[11px] transition-colors"
            >
              wikipedia.org
            </button>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="submit"
              disabled={isLoading || !url.trim() || !!validationError}
              className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold shadow-sm shadow-sky-600/20 hover:shadow-sky-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Inspecting Redirects...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Check HTTP Status</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
