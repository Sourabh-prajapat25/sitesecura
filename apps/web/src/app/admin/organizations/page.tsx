"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Search,
  Users,
  Globe,
  Radio,
  Cpu,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const loadOrgs = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminOrganizations({
        search: search.trim() || undefined,
        limit,
        offset: page * limit,
      });
      setOrgs(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadOrgs();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Organization Tenants</h1>
            <p className="text-xs text-slate-400 mt-1">
              Cross-tenant boundary inspection: members, website allocations, and resource consumption.
            </p>
          </div>
          <button
            onClick={loadOrgs}
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
              placeholder="Search organization name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </form>
          <span className="text-xs text-slate-400 font-medium">Total: {total} organizations</span>
        </div>

        {/* Table */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Organization</th>
                  <th className="py-3 px-5">Owner</th>
                  <th className="py-3 px-5">Plan</th>
                  <th className="py-3 px-5">Members</th>
                  <th className="py-3 px-5">Websites</th>
                  <th className="py-3 px-5">Scans</th>
                  <th className="py-3 px-5">AI Requests</th>
                  <th className="py-3 px-5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No organizations found.
                    </td>
                  </tr>
                ) : (
                  orgs.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-sky-400" />
                        <span>{o.name}</span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-300">
                        {o.owner_email || "—"}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                            o.plan === "agency"
                              ? "bg-purple-950 text-purple-400 border border-purple-800"
                              : o.plan === "pro"
                              ? "bg-sky-950 text-sky-400 border border-sky-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {o.plan}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" /> {o.members_count}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-slate-500" /> {o.websites_count}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        <span className="flex items-center gap-1">
                          <Radio className="w-3.5 h-3.5 text-slate-500" /> {o.scans_count}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-purple-400 font-mono font-bold">
                        {o.ai_requests_count}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        {new Date(o.created_at).toLocaleDateString()}
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
    </AdminLayout>
  );
}
