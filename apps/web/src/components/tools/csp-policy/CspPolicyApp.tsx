"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { CspPolicyAnalyzeResponse } from "@/types";
import { CspPolicyForm } from "./CspPolicyForm";
import { CspPolicyResults } from "./CspPolicyResults";

export function CspPolicyApp() {
  const [mode, setMode] = useState<"paste" | "remote">("paste");
  const [policy, setPolicy] = useState<string>("");
  const [policyType, setPolicyType] = useState<"enforce" | "report_only">("enforce");
  const [url, setUrl] = useState<string>("");
  const [results, setResults] = useState<CspPolicyAnalyzeResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "paste") {
        const trimmedPolicy = policy.trim();
        if (!trimmedPolicy) {
          setError("Please paste a Content Security Policy header string to analyze.");
          setIsLoading(false);
          return;
        }

        const data = await api.analyzeCspPolicy({
          mode: "paste",
          policy: trimmedPolicy,
          policy_type: policyType,
        });
        setResults(data);
      } else {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
          setError("Please provide a valid website domain or HTTPS URL to inspect.");
          setIsLoading(false);
          return;
        }

        const data = await api.analyzeCspPolicy({
          mode: "remote",
          url: trimmedUrl,
        });
        setResults(data);
      }
    } catch (err: any) {
      console.error("CSP Policy analysis error:", err);
      const errMsg =
        err?.message ||
        "An unexpected error occurred while analyzing the Content Security Policy. Please check your input and try again.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setPolicy("");
    setUrl("");
    setResults(null);
    setError(null);
  };

  return (
    <div className="w-full space-y-8">
      {/* Interactive Input Form */}
      <CspPolicyForm
        mode={mode}
        setMode={setMode}
        policy={policy}
        setPolicy={setPolicy}
        policyType={policyType}
        setPolicyType={setPolicyType}
        url={url}
        setUrl={setUrl}
        onSubmit={handleAnalyze}
        isLoading={isLoading}
        onClear={handleClear}
      />

      {/* Analysis Results Display */}
      <CspPolicyResults
        results={results}
        error={error}
        isLoading={isLoading}
        onRetry={handleAnalyze}
      />
    </div>
  );
}
