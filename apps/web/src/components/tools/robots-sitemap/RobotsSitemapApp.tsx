"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { RobotsSitemapCheckResponse } from "@/types";
import { RobotsSitemapForm } from "./RobotsSitemapForm";
import { RobotsSitemapResults } from "./RobotsSitemapResults";

export function RobotsSitemapApp() {
  const [domain, setDomain] = useState<string>("");
  const [results, setResults] = useState<RobotsSitemapCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    const trimmed = domain.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.checkRobotsSitemap({ domain: trimmed });
      setResults(data);
    } catch (err: any) {
      console.error("Robots.txt & sitemap check error:", err);
      const errMsg =
        err?.message ||
        "Failed to inspect robots.txt and sitemaps. Please check the domain format or try again in a moment.";
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
      <RobotsSitemapForm
        domain={domain}
        setDomain={setDomain}
        onSubmit={handleCheck}
        isLoading={isLoading}
        onClear={handleClear}
      />

      {/* Inspection Results Display */}
      <RobotsSitemapResults
        results={results}
        error={error}
        isLoading={isLoading}
        onRetry={handleCheck}
      />
    </div>
  );
}
