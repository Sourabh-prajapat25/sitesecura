"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Mail,
  Shield,
  UserCheck,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader, EmptyState } from "@/components/EmptyState";
import { UpgradeModal } from "@/components/UpgradeModal";
import { LockedFeaturePreview } from "@/components/LockedFeaturePreview";
import { api } from "@/lib/api";
import { UserProfile, Organization } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { canAccessTeam } from "@/lib/entitlements";

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
}

export default function TeamPage() {
  const { isAuthenticated, loading: authLoading, plan } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Upgrade Modal
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Role modification / deletion loading tracker
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadTeam = async () => {
    try {
      const [userRes, mems] = await Promise.all([
        api.getCurrentUser().catch(() => null),
        api.getTeamMembers().catch(() => []),
      ]);
      if (userRes) {
        setProfile(userRes.user);
        setOrg(userRes.organization);
      }
      setMembers(mems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadTeam();
    }
  }, [authLoading, isAuthenticated]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSubmitting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await api.inviteTeamMember(inviteEmail.trim(), inviteRole);
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      await loadTeam();
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteSuccess(null);
      }, 1500);
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite member.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setActionLoadingId(memberId);
    try {
      await api.updateTeamMemberRole(memberId, newRole);
      await loadTeam();
    } catch (err: any) {
      alert(err.message || "Failed to update role.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from this workspace?`)) return;
    setActionLoadingId(memberId);
    try {
      await api.removeTeamMember(memberId);
      await loadTeam();
    } catch (err: any) {
      alert(err.message || "Failed to remove member.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const isRestricted = !canAccessTeam(plan);

  // Compute summary metrics
  const adminCount = members.filter((m) => m.role === "admin" || m.role === "owner").length;
  const memberCount = members.filter((m) => m.role === "member").length;
  const viewerCount = members.filter((m) => m.role === "viewer").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Team & Workspace Access"
          description="Manage collaborators, assign role permissions, and control security audit sharing."
          action={
            !isRestricted ? (
              <button
                onClick={() => {
                  setInviteError(null);
                  setInviteSuccess(null);
                  setIsInviteModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Member</span>
              </button>
            ) : undefined
          }
        />

        {isRestricted ? (
          <LockedFeaturePreview
            icon={Users}
            badgeText="Premium Feature"
            title="Team Collaboration"
            description="Invite security analysts, developers, and DevOps engineers to collaborate on security audits and monitoring."
            ctaText="Upgrade to Pro"
            onUpgrade={() => setUpgradeModalOpen(true)}
          >
            {/* Realistic Team Collaboration UI Preview */}
            <div className="p-6 space-y-6">
              {/* 1. Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Workspace Members</span>
                    <Users className="w-4 h-4 text-sky-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">8</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Active across engineering & security</p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Security Admins</span>
                    <Shield className="w-4 h-4 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">2</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Full scan & policy authority</p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Invites</span>
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">1</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sent to devops@company.com</p>
                </div>
              </div>

              {/* 2. Action Toolbar Preview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Team Roster</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">• Role-based access control (RBAC)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs rounded-lg font-medium">
                    Filter by Role
                  </span>
                  <span className="px-3.5 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg shadow-2xs">
                    + Invite Member
                  </span>
                </div>
              </div>

              {/* 3. Team Members Table Preview */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#111C2E]">
                <div className="grid grid-cols-12 px-5 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="col-span-5">Member</div>
                  <div className="col-span-3">Role</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Last Active</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {/* Sarah Miller */}
                  <div className="grid grid-cols-12 px-5 py-4 items-center">
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs">
                        SM
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Sarah Miller</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">sarah.miller@example.com</p>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        Security Admin
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-slate-500 dark:text-slate-400 text-[11px]">10 min ago</div>
                  </div>

                  {/* Alex Johnson */}
                  <div className="grid grid-cols-12 px-5 py-4 items-center">
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-bold flex items-center justify-center text-xs">
                        AJ
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Alex Johnson</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">alex.j@example.com</p>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        Developer
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-slate-500 dark:text-slate-400 text-[11px]">2 hours ago</div>
                  </div>

                  {/* Rahul Sharma */}
                  <div className="grid grid-cols-12 px-5 py-4 items-center">
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs">
                        RS
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Rahul Sharma</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">rahul.sharma@example.com</p>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Viewer
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-slate-500 dark:text-slate-400 text-[11px]">Yesterday</div>
                  </div>

                  {/* Elena Rostova */}
                  <div className="grid grid-cols-12 px-5 py-4 items-center">
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
                        ER
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">Elena Rostova</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">e.rostova@example.com</p>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Security Analyst
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-slate-500 dark:text-slate-400 text-[11px]">3 hours ago</div>
                  </div>
                </div>
              </div>
            </div>
          </LockedFeaturePreview>
        ) : (
          <>
            {/* Workspace Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Active Collaborators
                  </span>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{members.length}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {org?.name || "Primary Workspace"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/40">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Access Distribution
                  </span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 pt-1">
                    <span className="text-purple-700 dark:text-purple-400">{adminCount} Admins</span> &bull;
                    <span className="text-sky-700 dark:text-sky-400">{memberCount} Members</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {viewerCount} Read-Only {viewerCount === 1 ? "Viewer" : "Viewers"}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/40">
                  <Shield className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Workspace Plan
                  </span>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white capitalize tracking-tight">{plan}</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Multi-user access enabled
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Team Members Table */}
            <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-5 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Workspace Members</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Users with access to audits, alerts, and settings</p>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Showing {members.length} {members.length === 1 ? "member" : "members"}
                </span>
              </div>

              {loading ? (
                <div className="p-8 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="space-y-1">
                          <div className="w-32 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                          <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      </div>
                      <div className="w-20 h-6 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  No collaborators found. Use the &quot;Invite Member&quot; button to add your team.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-6">Member</th>
                        <th className="py-3 px-6">Role</th>
                        <th className="py-3 px-6">Permissions</th>
                        <th className="py-3 px-6">Joined Date</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                      {members.map((m) => {
                        const isSelf = profile?.id === m.user_id;
                        const isOwner = m.role === "owner" || (org?.owner_id && org.owner_id === m.user_id);
                        const roleColor =
                          isOwner
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                            : m.role === "admin"
                            ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                            : m.role === "member"
                            ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

                        const roleDescription =
                          isOwner
                            ? "Workspace Owner & Primary Account"
                            : m.role === "admin"
                            ? "Full workspace management & billing"
                            : m.role === "member"
                            ? "Can register websites & run scans"
                            : "Read-only access to audit reports";

                        const avatarColor =
                          isOwner
                            ? "from-amber-500 to-amber-700"
                            : m.role === "admin"
                            ? "from-purple-500 to-purple-700"
                            : "from-sky-500 to-sky-700";

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor} text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0`}>
                                  {(m.name || m.email || "U")[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                      {m.name || m.email.split("@")[0]}
                                    </span>
                                    {isSelf && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate">{m.email}</p>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${roleColor}`}>
                                {isOwner ? "Owner" : m.role}
                              </span>
                            </td>

                            <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-[11px]">
                              {roleDescription}
                            </td>

                            <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-[11px]">
                              {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                            </td>

                            <td className="py-4 px-6 text-right">
                              {!isOwner && (
                                <div className="flex items-center justify-end gap-2">
                                  <select
                                    disabled={actionLoadingId === m.id}
                                    value={m.role}
                                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                                    className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer disabled:opacity-50"
                                  >
                                    <option value="admin">Admin</option>
                                    <option value="member">Member</option>
                                    <option value="viewer">Viewer</option>
                                  </select>

                                  <button
                                    disabled={actionLoadingId === m.id}
                                    onClick={() => handleRemoveMember(m.id, m.email)}
                                    title={`Remove ${m.email}`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111C2E] w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/40">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Invite Collaborator</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Grant security workspace permissions</p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4 text-xs">
              {inviteError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              {inviteSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{inviteSuccess}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@company.com"
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Workspace Role
                </label>
                <div className="space-y-2">
                  <label
                    onClick={() => setInviteRole("member")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      inviteRole === "member"
                        ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/30"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={inviteRole === "member"}
                      onChange={() => setInviteRole("member")}
                      className="mt-0.5 text-sky-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">Member</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Can register new websites, trigger manual scans, and download reports.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setInviteRole("admin")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      inviteRole === "admin"
                        ? "border-purple-500 bg-purple-50/50 dark:bg-purple-950/30"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={inviteRole === "admin"}
                      onChange={() => setInviteRole("admin")}
                      className="mt-0.5 text-purple-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">Admin</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Full workspace privileges: manage team members, billing, and all domains.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setInviteRole("viewer")}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      inviteRole === "viewer"
                        ? "border-slate-500 bg-slate-50 dark:bg-slate-800/60"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={inviteRole === "viewer"}
                      onChange={() => setInviteRole("viewer")}
                      className="mt-0.5 text-slate-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">Viewer</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Read-only access to view scan scores, finding details, and PDF reports.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        contextType="team"
        featureName="Team Members & Collaboration"
        recommendedPlan="pro"
      />
    </DashboardLayout>
  );
}
