"use client";

import React, { useState } from "react";
import { Search, Globe, RotateCcw, CheckSquare, Square, AlertCircle, Loader2, Sparkles } from "lucide-react";

export const ALL_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA"] as const;
export const DEFAULT_RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT"];

export interface DnsLookupFormProps {
  domain: string;
  setDomain: (val: string) => void;
  selectedTypes: string[];
  setSelectedTypes: (types: string[]) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function DnsLookupForm({
  domain,
  setDomain,
  selectedTypes,
  setSelectedTypes,
  onSubmit,
  isLoading,
}: DnsLookupFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setDomain(rawVal);

    if (!rawVal.trim()) {
      setValidationError(null);
      return;
    }

    const trimmed = rawVal.trim().toLowerCase();

    // Contextual client-side validation warnings
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.includes("://")) {
      setValidationError("Please enter only the domain name (e.g. example.com), without the 'https://' scheme.");
    } else if (trimmed.includes("/")) {
      setValidationError("Please enter only the domain name without paths or slashes (e.g. example.com).");
    } else if (trimmed.includes(":") && !trimmed.startsWith("[")) {
      setValidationError("Please remove the port number. Enter only the domain name.");
    } else if (trimmed.includes("@")) {
      setValidationError("Please enter a domain name, not an email address or credentials.");
    } else {
      setValidationError(null);
    }
  };

  const handleToggleType = (type: string) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length === 1) {
        // Prevent deselecting the last one or allow empty with button disabled
        setSelectedTypes([]);
      } else {
        setSelectedTypes(selectedTypes.filter((t) => t !== type));
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    setSelectedTypes([...ALL_RECORD_TYPES]);
  };

  const handleResetDefault = () => {
    setSelectedTypes([...DEFAULT_RECORD_TYPES]);
  };

  const handleClear = () => {
    setSelectedTypes([]);
  };

  const handleExampleDomain = () => {
    setDomain("example.com");
    setValidationError(null);
    setSelectedTypes([...DEFAULT_RECORD_TYPES]);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      setValidationError("Please enter a domain name to look up.");
      return;
    }

    const clean = domain.trim().toLowerCase();
    if (clean.includes("://") || clean.includes("/")) {
      setValidationError("Please enter a valid domain name without schemes or paths (e.g. example.com).");
      return;
    }

    if (selectedTypes.length === 0) {
      setValidationError("Please select at least one DNS record type to query.");
      return;
    }

    setValidationError(null);
    onSubmit();
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 text-left"
    >
      {/* Domain Input Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="domain-input" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-600" />
            <span>Domain name</span>
          </label>
          <button
            type="button"
            onClick={handleExampleDomain}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors inline-flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-sky-500" />
            <span>Try example.com</span>
          </button>
        </div>

        <div className="relative">
          <input
            id="domain-input"
            type="text"
            value={domain}
            onChange={handleInputChange}
            placeholder="example.com"
            disabled={isLoading}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
            className={`w-full px-4 py-3 sm:py-3.5 bg-slate-50 border rounded-2xl text-slate-900 placeholder-slate-400 text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
              validationError
                ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                : "border-slate-200 hover:border-slate-300 focus:border-sky-500 focus:bg-white"
            }`}
          />
        </div>

        <p className="text-xs text-slate-500">
          Enter a domain or subdomain name (e.g. <span className="font-mono text-slate-700">example.com</span> or{" "}
          <span className="font-mono text-slate-700">mail.example.com</span>). Do not include URL schemes or paths.
        </p>

        {validationError && (
          <div className="flex items-center gap-2 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200/80 px-3 py-2 rounded-xl animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </div>

      {/* Record Type Selector */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Select Record Types to Query
          </span>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={isLoading}
              className="text-slate-600 hover:text-sky-600 font-semibold px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleResetDefault}
              disabled={isLoading}
              className="text-slate-600 hover:text-sky-600 font-semibold px-2 py-1 rounded-md hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Default (5)</span>
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              className="text-slate-500 hover:text-rose-600 font-semibold px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {ALL_RECORD_TYPES.map((type) => {
            const isSelected = selectedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleToggleType(type)}
                disabled={isLoading}
                aria-pressed={isSelected}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-sky-50 border-sky-300 text-sky-800 shadow-xs"
                    : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:border-slate-300"
                }`}
              >
                <span className="font-mono">{type}</span>
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-300 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {selectedTypes.length === 0 && (
          <p className="text-xs font-semibold text-rose-500">
            Please select at least one record type to look up.
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading || !domain.trim() || selectedTypes.length === 0 || !!validationError}
          className="w-full py-3.5 px-6 rounded-2xl bg-[#087FE8] hover:bg-sky-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base shadow-md shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-500/25 transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Querying DNS Records...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>Look Up DNS Records ({selectedTypes.length})</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
