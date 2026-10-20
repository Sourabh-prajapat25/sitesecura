"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Download, Globe, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader, EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { Website } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ReportsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const load = async () => {
        try {
          const sites = await api.getWebsites();
          setWebsites(sites.filter((s) => s.last_scan_id));
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      load();
    }
  }, [authLoading, isAuthenticated]);

  const handleDownloadPdf = async (scanId?: string, domain?: string) => {
    if (!scanId) return;
    setDownloadingId(scanId);
    setDownloadError(null);
    try {
      await api.downloadScanPdf(scanId, domain);
    } catch (err: any) {
      setDownloadError(err.message || "Failed to download PDF report.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Security Audit Reports"
          description="Download formal PDF security assessments suitable for client presentation, compliance, or executive review."
        />

        {downloadError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{downloadError}</span>
            </div>
            <button
              onClick={() => setDownloadError(null)}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading reports...</div>
          ) : websites.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title="No reports generated yet"
                description="Reports are automatically compiled into PDF format whenever a security scan completes."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-6">Domain / Target</th>
                    <th className="py-3 px-6">Score</th>
                    <th className="py-3 px-6">Risk Rating</th>
                    <th className="py-3 px-6">Generated Date</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {websites.map((w) => {
                    const score = w.last_scan_score;
                    const isScored = score !== undefined && score !== null;
                    const scoreBadgeStyle =
                      isScored && score >= 80
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : isScored && score >= 60
                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";

                    return (
                      <tr key={w.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                          https://{w.normalized_domain}
                        </td>
                        <td className="py-4 px-6">
                          {isScored ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreBadgeStyle}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"
                              }`} />
                              {score}/100
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 font-medium">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {w.last_scan_risk || "Assessed"}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(w.updated_at).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(w.last_scan_id, w.normalized_domain)}
                            disabled={downloadingId === w.last_scan_id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {downloadingId === w.last_scan_id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" />
                                <span>Export PDF</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
