"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  Eye,
  X,
  FileCode,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 25;

  // Selected Log for JSON Metadata Viewer
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminAuditLogs({
        action: actionFilter !== "all" ? actionFilter : undefined,
        entity_type: entityFilter !== "all" ? entityFilter : undefined,
        limit,
        offset: page * limit,
      });
      setLogs(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, entityFilter]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Security Audit Logs</h1>
            <p className="text-xs text-slate-400 mt-1">
              Immutable security event ledger: user suspensions, manual plan overrides, force scans, and access denials.
            </p>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Actions</option>
              <option value="USER_SUSPENDED">USER_SUSPENDED</option>
              <option value="USER_UNSUSPENDED">USER_UNSUSPENDED</option>
              <option value="USER_DELETED">USER_DELETED</option>
              <option value="MANUAL_PLAN_OVERRIDE">MANUAL_PLAN_OVERRIDE</option>
              <option value="ADMIN_FORCE_SCAN">ADMIN_FORCE_SCAN</option>
              <option value="ADMIN_DELETE_WEBSITE">ADMIN_DELETE_WEBSITE</option>
              <option value="ADMIN_DELETE_SCAN">ADMIN_DELETE_SCAN</option>
              <option value="PERMISSION_DENIED">PERMISSION_DENIED</option>
            </select>

            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Entity Types</option>
              <option value="USER">USER</option>
              <option value="ORGANIZATION">ORGANIZATION</option>
              <option value="WEBSITE">WEBSITE</option>
              <option value="SCAN">SCAN</option>
              <option value="SUPPORT_TICKET">SUPPORT_TICKET</option>
            </select>
          </div>
          <span className="text-xs text-slate-400 font-medium">Total: {total} events</span>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5">Action</th>
                  <th className="py-3 px-5">Actor / Admin</th>
                  <th className="py-3 px-5">Target Entity</th>
                  <th className="py-3 px-5">Target ID</th>
                  <th className="py-3 px-5">IP Address</th>
                  <th className="py-3 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No security audit log entries match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-slate-400">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`font-mono px-2 py-0.5 rounded text-[11px] font-bold ${
                            l.action.includes("DELETED") || l.action.includes("SUSPENDED") || l.action.includes("DENIED")
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : l.action.includes("OVERRIDE")
                              ? "bg-purple-950 text-purple-400 border border-purple-800"
                              : "bg-sky-950 text-sky-400 border border-sky-800"
                          }`}
                        >
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-300">
                        {l.user_email || "System"}
                      </td>
                      <td className="py-3.5 px-5 uppercase text-slate-400 font-semibold">
                        {l.entity_type}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-400 truncate max-w-[140px]">
                        {l.entity_id || "—"}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-400">
                        {l.ip_address || "internal"}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setSelectedLog(l)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
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

      {/* Metadata JSON Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white">
                <FileCode className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-base">Audit Event Metadata</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Action: <strong className="text-white font-mono">{selectedLog.action}</strong></span>
                <span>Entity: <strong className="text-white">{selectedLog.entity_type}</strong></span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block mb-1">Sanitized Payload:</span>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[11px] text-sky-300 overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.metadata_json, null, 2) || "No metadata recorded."}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
