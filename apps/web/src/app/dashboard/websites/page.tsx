"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe,
  Plus,
  Search,
  Upload,
  Play,
  Trash2,
  ExternalLink,
  Shield,
  Activity,
  CheckCircle2,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/EmptyState";
import { SeverityBadge } from "@/components/SeverityBadge";
import { api, API_BASE } from "@/lib/api";
import { Website } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

export default function WebsitesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form states
  const [newDomain, setNewDomain] = useState("");
  const [newName, setNewName] = useState("");
  const [enableMonitoring, setEnableMonitoring] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Bulk import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any | null>(null);

  const loadWebsites = async () => {
    try {
      const data = await api.getWebsites();
      setWebsites(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadWebsites();
    }
  }, [authLoading, isAuthenticated]);

  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const site = await api.createWebsite({
        domain: newDomain.trim(),
        name: newName.trim() || undefined,
        monitoring_enabled: enableMonitoring,
      });
      // Automatically trigger initial scan
      await api.triggerWebsiteScan(site.id);
      setIsAddModalOpen(false);
      setNewDomain("");
      setNewName("");
      loadWebsites();
    } catch (err: any) {
      setModalError(err.message || "Failed to create website.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanNow = async (siteId: string) => {
    try {
      await api.triggerWebsiteScan(siteId);
      loadWebsites();
    } catch (err: any) {
      alert(err.message || "Failed to trigger scan.");
    }
  };

  const handleDeleteSite = async (siteId: string, domain: string) => {
    if (!confirm(`Are you sure you want to delete ${domain}? All past scan records will be removed.`)) return;
    try {
      await api.deleteWebsite(siteId);
      loadWebsites();
    } catch (err: any) {
      alert(err.message || "Failed to delete website.");
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const token = localStorage.getItem("scanly_dev_token");

      const res = await fetch(`${API_BASE}/websites/bulk-import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Import failed");
      setImportResults(data);
      loadWebsites();
    } catch (err: any) {
      alert(err.message || "Bulk import failed.");
    } finally {
      setImporting(false);
    }
  };

  const filtered = websites.filter(
    (w) =>
      w.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Websites & Domains"
          description="Manage registered domain targets, trigger on-demand security scans, and manage continuous monitoring."
          action={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Website</span>
              </button>
            </div>
          }
        />

        {/* Filter Bar */}
        <div className="bg-white dark:bg-[#111C2E] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search domains or labels..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-[#0B1220] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
            Showing {filtered.length} of {websites.length} websites
          </span>
        </div>

        {/* Websites List Table */}
        <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="space-y-1.5">
                      <div className="w-36 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                  <div className="w-24 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No websites found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-6">Domain / Name</th>
                    <th className="py-3.5 px-6">Score & Risk</th>
                    <th className="py-3.5 px-6">Monitoring</th>
                    <th className="py-3.5 px-6">Added Date</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {filtered.map((site) => {
                    const score = site.last_scan_score;
                    const isScored = score !== undefined && score !== null;
                    const scoreBadgeStyle =
                      isScored && score >= 80
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : isScored && score >= 60
                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";

                    return (
                      <tr key={site.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold border border-sky-100 dark:border-sky-800 shrink-0">
                              <Globe className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/dashboard/websites/${site.id}`}
                                className="font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 text-sm block truncate"
                              >
                                {site.name || site.domain}
                              </Link>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                <span className="truncate">https://{site.normalized_domain}</span>
                                <a
                                  href={`https://${site.normalized_domain}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          {isScored ? (
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreBadgeStyle}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"
                                }`} />
                                {score}/100
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 text-[11px]">({site.last_scan_risk || "Assessed"})</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                              Not Scanned
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          {site.monitoring_enabled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {site.monitoring_frequency ? `${site.monitoring_frequency.charAt(0).toUpperCase() + site.monitoring_frequency.slice(1)}` : "Weekly"}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px]">Disabled</span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(site.created_at).toLocaleDateString()}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/websites/${site.id}`}
                              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
                            >
                              View Details
                            </Link>
                            <button
                              onClick={() => handleDeleteSite(site.id, site.domain)}
                              title={`Delete ${site.domain}`}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Add Website Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Add Website Target</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter the domain to initialize automated posture evaluation.
            </p>

            {modalError && (
              <div className="mb-4 p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddWebsite} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Domain Name (Required)
                </label>
                <input
                  type="text"
                  required
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] rounded-xl text-sm focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Friendly Label (Optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Primary Production Site"
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] rounded-xl text-sm focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mon-toggle"
                  checked={enableMonitoring}
                  onChange={(e) => setEnableMonitoring(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <label htmlFor="mon-toggle" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  Enable weekly automated background monitoring
                </label>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-sm disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add & Scan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
            <button
              onClick={() => {
                setIsImportModalOpen(false);
                setImportResults(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Bulk CSV Domain Import</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Upload a CSV file containing columns: <code>domain,name</code>
            </p>

            {importResults ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="font-bold text-slate-900 dark:text-white mb-1">Import Summary:</p>
                  <p className="text-emerald-600 dark:text-emerald-400">✓ Imported: {importResults.imported_count}</p>
                  <p className="text-slate-500 dark:text-slate-400">⚠ Skipped / Duplicate: {importResults.skipped_count}</p>
                </div>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportResults(null);
                  }}
                  className="w-full py-2 bg-sky-600 text-white font-semibold rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleBulkImport} className="space-y-4 text-xs">
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 dark:text-slate-400"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importing || !importFile}
                    className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold disabled:opacity-50"
                  >
                    {importing ? "Importing..." : "Process CSV"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
