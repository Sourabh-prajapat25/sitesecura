"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe,
  Search,
  Radio,
  Play,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Eye,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminWebsitesPage() {
  const [websites, setWebsites] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Actions
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [websiteToDelete, setWebsiteToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const loadWebsites = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminWebsites({
        search: search.trim() || undefined,
        limit,
        offset: page * limit,
      });
      setWebsites(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load websites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebsites();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadWebsites();
  };

  const handleForceScan = async (site: any) => {
    if (!window.confirm(`Force an immediate security scan for ${site.domain}?`)) return;
    try {
      setTriggeringId(site.id);
      const res = await api.forceAdminScan(site.id);
      alert(`Force scan queued successfully! Scan ID: ${res.scan_id}`);
      loadWebsites();
    } catch (err: any) {
      alert(err.message || "Failed to trigger force scan.");
    } finally {
      setTriggeringId(null);
    }
  };

  const handleDeleteWebsite = async () => {
    if (!websiteToDelete) return;
    try {
      setDeleting(true);
      await api.deleteAdminWebsite(websiteToDelete.id);
      setWebsiteToDelete(null);
      loadWebsites();
    } catch (err: any) {
      alert(err.message || "Failed to delete website.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Websites Registry</h1>
            <p className="text-xs text-slate-400 mt-1">
              Cross-tenant target hostnames, security scores, continuous monitoring statuses, and force-scan actions.
            </p>
          </div>
          <button
            onClick={loadWebsites}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search website domain..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </form>
          <span className="text-xs text-slate-400 font-medium">Total: {total} websites</span>
        </div>

        {/* Websites Table */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Domain</th>
                  <th className="py-3 px-5">Organization</th>
                  <th className="py-3 px-5">Plan</th>
                  <th className="py-3 px-5">Posture Score</th>
                  <th className="py-3 px-5">Monitoring</th>
                  <th className="py-3 px-5">Scans</th>
                  <th className="py-3 px-5">Registered</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {websites.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No registered websites found.
                    </td>
                  </tr>
                ) : (
                  websites.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-white flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold">{w.domain}</span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        {w.organization_name}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-sky-400">
                          {w.plan}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {w.last_scan_score !== null && w.last_scan_score !== undefined ? (
                          <span
                            className={`font-bold font-mono px-2 py-0.5 rounded text-[11px] ${
                              w.last_scan_score >= 80
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : w.last_scan_score >= 60
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-red-950 text-red-400 border border-red-800"
                            }`}
                          >
                            {w.last_scan_score} / 100
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        {w.monitoring_enabled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active ({w.monitoring_frequency || "weekly"})
                          </span>
                        ) : (
                          <span className="text-slate-500">Disabled</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-300 font-mono">
                        {w.scans_count}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/websites/${w.id}`}
                            target="_blank"
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors"
                            title="View Security Command Center"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => handleForceScan(w)}
                            disabled={triggeringId === w.id}
                            className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/60 rounded-lg font-semibold text-[11px] transition-colors flex items-center gap-1"
                            title="Force Scan Pipeline"
                          >
                            <Play className="w-3 h-3" />
                            <span>{triggeringId === w.id ? "Queuing..." : "Force Scan"}</span>
                          </button>
                          <button
                            onClick={() => setWebsiteToDelete(w)}
                            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-lg transition-colors"
                            title="Delete Website"
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

      {/* Delete Confirmation Modal */}
      {websiteToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-red-900 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-white text-base">Remove Registered Website</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <span className="font-mono font-bold text-white">{websiteToDelete.domain}</span>?
              All historical security posture scans, monitoring records, and alerts for this domain will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setWebsiteToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWebsite}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
