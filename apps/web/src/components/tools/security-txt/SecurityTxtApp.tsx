"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { SecurityTxtValidateResponse } from "@/types";
import { SecurityTxtForm } from "./SecurityTxtForm";
import { SecurityTxtResults } from "./SecurityTxtResults";

export function SecurityTxtApp() {
  const [domain, setDomain] = useState<string>("");
  const [results, setResults] = useState<SecurityTxtValidateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    const trimmed = domain.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.validateSecurityTxt({ domain: trimmed });
      setResults(data);
    } catch (err: any) {
      console.error("security.txt validation error:", err);
      const errMsg =
        err?.message ||
        "Failed to validate security.txt file. Please check the domain format or try again in a moment.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setDomain("");
    setResults(null);
    setError(null);
  };

  return (
    <div className="w-full space-y-8">
      {/* Interactive Input Form */}
      <SecurityTxtForm
        domain={domain}
        setDomain={setDomain}
        onSubmit={handleValidate}
        isLoading={isLoading}
        onClear={handleClear}
      />

      {/* Validation Results Display */}
      <SecurityTxtResults
        results={results}
        error={error}
        isLoading={isLoading}
        onRetry={handleValidate}
      />
    </div>
  );
}
