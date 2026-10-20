"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  ShieldCheck,
  UserX,
  UserCheck,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  X,
  Building,
  Globe,
  Radio,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Selected user for detail modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Delete confirmation
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUsers({
        search: search.trim() || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
        is_active: statusFilter === "all" ? undefined : statusFilter === "active",
        limit,
        offset: page * limit,
      });
      setUsers(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadUsers();
  };

  const handleToggleStatus = async (user: any) => {
    const nextState = !user.is_active;
    const actionName = nextState ? "unsuspend" : "suspend";
    const reason = window.prompt(`Provide an administrative reason to ${actionName} ${user.email}:`);
    if (reason === null) return; // cancelled

    try {
      await api.updateAdminUserStatus(user.id, {
        is_active: nextState,
        reason: reason.trim() || `Administrative ${actionName}`,
      });
      loadUsers();
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, is_active: nextState });
      }
    } catch (err: any) {
      alert(err.message || `Failed to ${actionName} user.`);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (deleteConfirmText !== userToDelete.email) {
      alert("Please type the user's email exactly to confirm deletion.");
      return;
    }

    try {
      setDeleting(true);
      await api.deleteAdminUser(userToDelete.id);
      setUserToDelete(null);
      setDeleteConfirmText("");
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  };

  const openUserDetail = async (userId: string) => {
    try {
      setLoadingDetail(true);
      const detail = await api.getAdminUserDetail(userId);
      setSelectedUser(detail);
    } catch (err: any) {
      alert(err.message || "Failed to load user details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">User Accounts Directory</h1>
            <p className="text-xs text-slate-400 mt-1">
              Cross-tenant identity management, account status controls, and role inspection.
            </p>
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user email or name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </form>

          <div className="flex items-center gap-3">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Roles</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="agency">Agency</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>

            <span className="text-xs text-slate-400 font-medium">
              Showing {users.length} of {total}
            </span>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">User</th>
                  <th className="py-3 px-5">Organization</th>
                  <th className="py-3 px-5">Plan / Role</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Assets</th>
                  <th className="py-3 px-5">Joined</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No user accounts found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => openUserDetail(u.id)}
                            className="text-white hover:text-sky-400 font-semibold text-left transition-colors font-mono"
                          >
                            {u.email}
                          </button>
                          {u.name && <p className="text-[11px] text-slate-400">{u.name}</p>}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">
                        {u.organization_name || "—"}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                            u.role === "admin"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : u.role === "agency"
                              ? "bg-purple-950 text-purple-400 border border-purple-800"
                              : u.role === "pro"
                              ? "bg-sky-950 text-sky-400 border border-sky-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {u.plan || u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-400 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        <div className="flex items-center gap-3 text-[11px]">
                          <span>{u.websites_count} sites</span>
                          <span>•</span>
                          <span>{u.scans_count} scans</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openUserDetail(u.id)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`p-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                              u.is_active
                                ? "bg-amber-950/60 hover:bg-amber-900/60 text-amber-400 border border-amber-800/60"
                                : "bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/60"
                            }`}
                            title={u.is_active ? "Suspend User" : "Unsuspend User"}
                          >
                            {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 rounded-lg transition-colors"
                            title="Delete User"
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

      {/* User Detail Inspect Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="bg-slate-950 border-l border-slate-800 w-full max-w-xl h-full p-6 space-y-6 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">User Profile & Tenant Inspection</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div>
                  <span className="text-slate-500 font-semibold">User ID</span>
                  <p className="text-white font-mono mt-0.5 truncate">{selectedUser.id}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">System Role</span>
                  <p className="text-sky-400 font-bold uppercase mt-0.5">{selectedUser.role}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Account Status</span>
                  <p className={selectedUser.is_active ? "text-emerald-400 font-semibold mt-0.5" : "text-red-400 font-semibold mt-0.5"}>
                    {selectedUser.is_active ? "Active" : "Suspended"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Created Date</span>
                  <p className="text-slate-300 mt-0.5">{new Date(selectedUser.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* Organization Info */}
              {selectedUser.organization && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Building className="w-4 h-4 text-purple-400" />
                    <span>Organization Context</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-slate-500 font-semibold">Organization</span>
                      <p className="text-slate-300">{selectedUser.organization.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold">Subscription Plan</span>
                      <p className="text-purple-400 font-bold uppercase">
                        {selectedUser.subscription?.plan || "Free"} ({selectedUser.subscription?.status || "active"})
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Websites */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" /> Registered Websites ({selectedUser.websites?.length || 0})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedUser.websites?.length === 0 ? (
                    <p className="text-slate-500 italic">No websites registered.</p>
                  ) : (
                    selectedUser.websites?.map((w: any) => (
                      <div key={w.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-950 font-mono text-[11px]">
                        <span className="text-white">{w.domain}</span>
                        <span className="text-emerald-400 font-bold">Score: {w.score ?? "—"}/100</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => handleToggleStatus(selectedUser)}
                  className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                    selectedUser.is_active
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {selectedUser.is_active ? "Suspend Account" : "Unsuspend Account"}
                </button>
                <button
                  onClick={() => {
                    setUserToDelete(selectedUser);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-red-900 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-white text-base">Permanent Account Deletion</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action is destructive and permanent. All associated organizations, membership links, and historical data will be removed.
            </p>
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-400 font-semibold">
                Type <span className="font-mono text-red-400">{userToDelete.email}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={userToDelete.email}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting || deleteConfirmText !== userToDelete.email}
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
