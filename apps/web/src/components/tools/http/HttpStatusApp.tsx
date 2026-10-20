"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { HttpStatusCheckResponse } from "@/types";
import { HttpStatusForm } from "./HttpStatusForm";
import { HttpStatusResults } from "./HttpStatusResults";

export function HttpStatusApp() {
  const [url, setUrl] = useState<string>("");
  const [results, setResults] = useState<HttpStatusCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.checkHttpStatus({ url: trimmed });
      setResults(data);
    } catch (err: any) {
      console.error("HTTP status check error:", err);
      const errMsg =
        err?.message ||
        "Failed to inspect HTTP status and redirects. Please check the URL format or try again in a moment.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setUrl("");
    setResults(null);
    setError(null);
  };

  return (
    <div className="w-full space-y-8">
      {/* Interactive Form */}
      <HttpStatusForm
        url={url}
        setUrl={setUrl}
        onSubmit={handleCheck}
        isLoading={isLoading}
        onClear={handleClear}
      />

      {/* Results View */}
      <HttpStatusResults
        results={results}
        error={error}
        isLoading={isLoading}
        onRetry={handleCheck}
      />
    </div>
  );
}
