"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { DnsLookupResponse } from "@/types";
import { DnsLookupForm, DEFAULT_RECORD_TYPES } from "./DnsLookupForm";
import { DnsLookupResults } from "./DnsLookupResults";

export function DnsLookupApp() {
  const [domain, setDomain] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([...DEFAULT_RECORD_TYPES]);
  const [results, setResults] = useState<DnsLookupResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    const trimmedDomain = domain.trim().toLowerCase();
    if (!trimmedDomain) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.dnsLookup({
        domain: trimmedDomain,
        record_types: selectedTypes,
      });
      setResults(data);
    } catch (err: any) {
      console.error("DNS lookup error:", err);
      const errMsg =
        err?.message ||
        "Failed to query DNS records. Please check the domain format or try again in a few moments.";
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Interactive Query Form */}
      <DnsLookupForm
        domain={domain}
        setDomain={setDomain}
        selectedTypes={selectedTypes}
        setSelectedTypes={setSelectedTypes}
        onSubmit={handleLookup}
        isLoading={isLoading}
      />

      {/* Results View */}
      <DnsLookupResults
        results={results}
        error={error}
        isLoading={isLoading}
        onRetry={handleLookup}
      />
    </div>
  );
}
