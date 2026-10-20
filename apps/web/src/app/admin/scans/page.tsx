"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Radio,
  Search,
  RefreshCw,
  Play,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  X,
  AlertCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminScansPage() {
  const [scans, setScans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Modals
  const [failedScanToInspect, setFailedScanToInspect] = useState<any>(null);
  const [scanToDelete, setScanToDelete] = useState<any>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadScans = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminScans({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: search.trim() || undefined,
        limit,
        offset: page * limit,
      });
      setScans(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load scans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadScans();
  };

  const handleRetry = async (scanId: string) => {
    try {
      setRetryingId(scanId);
      await api.retryAdminScan(scanId);
      alert("Scan retry successfully queued into Celery pipeline.");
      loadScans();
      if (failedScanToInspect?.id === scanId) {
        setFailedScanToInspect(null);
      }
    } catch (err: any) {
      alert(err.message || "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  const handleDeleteScan = async () => {
    if (!scanToDelete) return;
    try {
      setDeleting(true);
      await api.deleteAdminScan(scanToDelete.id);
      setScanToDelete(null);
      loadScans();
    } catch (err: any) {
      alert(err.message || "Failed to delete scan.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Scans Queue & Operations Inspector</h1>
            <p className="text-xs text-slate-400 mt-1">
              Cross-tenant security assessment tasks, duration metrics, vulnerability findings, and error inspections.
            </p>
          </div>
          <button
            onClick={loadScans}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search target domain..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </form>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
            </select>
            <span className="text-xs text-slate-400 font-medium">Total: {total} scans</span>
          </div>
        </div>

        {/* Scans Table */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Target Domain</th>
                  <th className="py-3 px-5">Organization</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Score</th>
                  <th className="py-3 px-5">Findings</th>
                  <th className="py-3 px-5">Duration</th>
                  <th className="py-3 px-5">Executed At</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No security scans found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  scans.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-white flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-sky-400" />
                        <span className="font-semibold">{s.domain}</span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        {s.organization_name}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider inline-flex items-center gap-1 ${
                            s.status === "completed"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : s.status === "failed"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-amber-950 text-amber-400 border border-amber-800"
                          }`}
                        >
                          {s.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                          {s.status === "failed" && <XCircle className="w-3 h-3" />}
                          <span>{s.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {s.score !== null && s.score !== undefined ? (
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              s.score >= 80
                                ? "text-emerald-400"
                                : s.score >= 60
                                ? "text-amber-400"
                                : "text-red-400"
                            }`}
                          >
                            {s.score}/100
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span>{s.findings_count} checks</span>
                          {s.critical_count > 0 && (
                            <span className="px-1.5 py-0.2 bg-red-950 text-red-400 rounded font-bold text-[10px]">
                              {s.critical_count} crit
                            </span>
                          )}
                          {s.high_count > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-950 text-amber-400 rounded font-bold text-[10px]">
                              {s.high_count} high
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 font-mono">
                        {s.scan_duration_ms ? `${(s.scan_duration_ms / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {s.status === "failed" && (
                            <button
                              onClick={() => setFailedScanToInspect(s)}
                              className="px-2 py-1 bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/60 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1"
                            >
                              <AlertTriangle className="w-3 h-3" /> Error
                            </button>
                          )}
                          <Link
                            href={`/scan/${s.id}`}
                            target="_blank"
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => handleRetry(s.id)}
                            disabled={retryingId === s.id}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            {retryingId === s.id ? "Retrying..." : "Retry"}
                          </button>
                          <button
                            onClick={() => setScanToDelete(s)}
                            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-lg transition-colors"
                            title="Delete Scan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page + 1} of {Math.ceil(total / limit)}
              </span>
              <button
                disabled={(page + 1) * limit >= total}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Failure Diagnostic Inspection Modal */}
      {failedScanToInspect && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-red-900/80 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Sanitized Scan Diagnostic</h3>
              </div>
              <button
                onClick={() => setFailedScanToInspect(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-semibold">Target Website:</span>
                  <p className="font-mono text-white mt-0.5 break-all font-semibold">{failedScanToInspect.domain}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Scan Status:</span>
                  <p className="mt-0.5">
                    <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider inline-flex items-center gap-1 bg-red-950 text-red-400 border border-red-800">
                      <XCircle className="w-3 h-3" />
                      {failedScanToInspect.status}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 font-semibold">Safe Error Code:</span>
                  <p className="font-mono text-amber-400 font-bold mt-0.5">
                    {failedScanToInspect.safe_error_code || "SCAN_EXECUTION_ERROR"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Execution Timestamp:</span>
                  <p className="text-slate-300 mt-0.5 flex items-center gap-1 font-mono text-[11px]">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {new Date(failedScanToInspect.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold">Scan ID:</span>
                <p className="font-mono text-slate-400 text-[11px] mt-0.5">{failedScanToInspect.id}</p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold">Sanitized Failure Message:</span>
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs mt-1 break-words leading-relaxed font-sans">
                  {failedScanToInspect.error_message || "Target host unreachable or connection timed out during security check probing."}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Raw tracebacks, internal file paths, and database queries are securely sanitized to prevent disclosure.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setFailedScanToInspect(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => handleRetry(failedScanToInspect.id)}
                disabled={retryingId === failedScanToInspect.id}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retryingId === failedScanToInspect.id ? "animate-spin" : ""}`} />
                {retryingId === failedScanToInspect.id ? "Queuing..." : "Retry Scan Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {scanToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-red-900 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-white text-base">Delete Scan Record</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove scan <span className="font-mono font-bold text-white">{scanToDelete.id}</span> for domain <span className="font-mono font-bold text-white">{scanToDelete.domain}</span>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setScanToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteScan}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Delete Scan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
