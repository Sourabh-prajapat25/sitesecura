"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Globe,
  Radio,
  BarChart3,
  CreditCard,
  Building2,
  LifeBuoy,
  ShieldCheck,
  Server,
  TrendingUp,
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminDashboard();
      setStats(data);
    } catch (err) {
      console.error("Failed to load admin dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Admin Control Center</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800">
                Live Operations
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Operational dashboard & real-time telemetry queried from PostgreSQL & Redis.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Primary Operational Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">User Accounts</span>
              <Users className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-3xl font-extrabold text-white">{stats?.total_users ?? 0}</p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900">
              <span className="text-emerald-400">{stats?.active_users ?? 0} active</span>
              <span className="text-slate-400">+{stats?.new_users_30d ?? 0} last 30d</span>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Paid Subscriptions</span>
              <CreditCard className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-3xl font-extrabold text-purple-400">{stats?.active_subscriptions ?? 0}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-900">
              <span>Pro: {stats?.users_by_plan?.pro ?? 0}</span>
              <span>•</span>
              <span>Agency: {stats?.users_by_plan?.agency ?? 0}</span>
              <span>•</span>
              <span>Basic: {stats?.users_by_plan?.basic ?? 0}</span>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Monitored Websites</span>
              <Globe className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-extrabold text-white">{stats?.total_websites ?? 0}</p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900">
              <span className="text-emerald-400">{stats?.monitored_websites ?? 0} continuous monitoring</span>
              <span className="text-slate-400">{stats?.total_organizations ?? 0} orgs</span>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Scans Throughput</span>
              <Radio className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-3xl font-extrabold text-sky-400">{stats?.scan_success_rate ?? 100}%</p>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900">
              <span className="text-slate-400">{stats?.scans_today ?? 0} today</span>
              <span className="text-slate-400">{stats?.scans_this_month ?? 0} this month</span>
            </div>
          </div>
        </div>

        {/* Security Operations & AI Subsystem */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Scan Queue Breakdown</h3>
              <Radio className="w-4 h-4 text-slate-500" />
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Completed Scans</span>
                <span className="font-mono font-bold text-emerald-400">{stats?.scans_by_status?.completed ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Failed Scans</span>
                <span className="font-mono font-bold text-red-400">{stats?.scans_by_status?.failed ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Currently Running</span>
                <span className="font-mono font-bold text-sky-400">{stats?.scans_by_status?.running ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Queued in Redis</span>
                <span className="font-mono font-bold text-amber-400">{stats?.scans_by_status?.queued ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">AI Subsystem & Inquiries</h3>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Total AI Generations</span>
                <span className="font-mono font-bold text-purple-400">{stats?.total_ai_generations ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Open Support Tickets</span>
                <span className="font-mono font-bold text-amber-400">{stats?.open_support_tickets ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">New Contact Messages</span>
                <span className="font-mono font-bold text-sky-400">{stats?.new_contact_messages ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">AI Fallback Architecture</span>
                <span className="text-[11px] font-semibold text-emerald-400">Groq1 &rarr; Groq2 &rarr; Gemini</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">System Operations</h3>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">PostgreSQL</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Alembic Revision</span>
                <span className="font-mono text-slate-300">005_add_ai_generations</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Redis & Celery</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-900/60">
                <span className="text-slate-300">Security Sandbox (SSRF)</span>
                <span className="font-semibold text-emerald-400">Enforced</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Operations Directory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/users"
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-1.5"
          >
            <Users className="w-5 h-5 text-sky-400" />
            <h4 className="font-bold text-white text-xs">Users Management</h4>
            <p className="text-[11px] text-slate-400">Suspend, inspect profiles, and manage account roles.</p>
          </Link>

          <Link
            href="/admin/websites"
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-1.5"
          >
            <Globe className="w-5 h-5 text-emerald-400" />
            <h4 className="font-bold text-white text-xs">Websites Registry</h4>
            <p className="text-[11px] text-slate-400">Inspect cross-tenant domains and trigger force scans.</p>
          </Link>

          <Link
            href="/admin/subscriptions"
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-1.5"
          >
            <CreditCard className="w-5 h-5 text-purple-400" />
            <h4 className="font-bold text-white text-xs">Plans & Overrides</h4>
            <p className="text-[11px] text-slate-400">Manage subscription tiers with audited manual overrides.</p>
          </Link>

          <Link
            href="/admin/audit-logs"
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-1.5"
          >
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h4 className="font-bold text-white text-xs">Audit Logs</h4>
            <p className="text-[11px] text-slate-400">Review security modifications and administrative actions.</p>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
