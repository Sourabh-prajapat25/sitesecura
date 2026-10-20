"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Globe,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  TrendingUp,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ScoreRing } from "@/components/ScoreRing";
import { SeverityBadge } from "@/components/SeverityBadge";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { Website, AlertItem } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

export default function DashboardOverviewPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickDomain, setQuickDomain] = useState("");
  const [scanning, setScanning] = useState(false);

  const loadData = async () => {
    try {
      const [sitesData, alertsData] = await Promise.all([
        api.getWebsites().catch(() => []),
        api.getAlerts().catch(() => []),
      ]);
      setWebsites(sitesData);
      setAlerts(alertsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadData();
    }
  }, [authLoading, isAuthenticated]);

  const handleQuickScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDomain.trim()) return;
    setScanning(true);
    try {
      const site = await api.createWebsite({ domain: quickDomain.trim() });
      await api.triggerWebsiteScan(site.id);
      setQuickDomain("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to add website.");
    } finally {
      setScanning(false);
    }
  };

  // Compute aggregate stats from real PostgreSQL data
  const scoredSites = websites.filter((w) => w.last_scan_score !== undefined && w.last_scan_score !== null);
  const averageScore =
    scoredSites.length > 0
      ? Math.round(scoredSites.reduce((acc, s) => acc + (s.last_scan_score || 0), 0) / scoredSites.length)
      : null;

  const criticalIssuesCount = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const expiringSslCount = alerts.filter((a) => a.type === "ssl_expiry").length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Top Header & Quick Scan */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Security Overview</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Live posture metrics and continuous monitoring status across your registered web properties.
            </p>
          </div>

          {/* Quick Add Domain Form */}
          <form onSubmit={handleQuickScan} className="flex gap-2">
            <input
              type="text"
              value={quickDomain}
              onChange={(e) => setQuickDomain(e.target.value)}
              placeholder="Add domain (e.g. app.com)"
              className="px-3.5 py-2 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 w-56 shadow-sm"
              disabled={scanning}
            />
            <button
              type="submit"
              disabled={scanning}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{scanning ? "Adding..." : "Add Website"}</span>
            </button>
          </form>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Aggregate Score Card */}
          <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Average Posture Score
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {averageScore !== null ? `${averageScore}` : "—"}
                </p>
                {averageScore !== null && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    averageScore >= 80
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : averageScore >= 60
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                  }`}>
                    {averageScore >= 80 ? "Good" : averageScore >= 60 ? "Moderate" : "At Risk"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Across {scoredSites.length} assessed {scoredSites.length === 1 ? "domain" : "domains"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-100 dark:border-sky-800">
              <Shield className="w-6 h-6" />
            </div>
          </div>

          {/* Protected Websites Card */}
          <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Protected Websites
              </span>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{websites.length}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {websites.filter((w) => w.monitoring_enabled).length} active monitoring
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800">
              <Globe className="w-6 h-6" />
            </div>
          </div>

          {/* Critical Issues Card */}
          <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Active Critical Issues
              </span>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{criticalIssuesCount}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {criticalIssuesCount === 0 ? "Zero critical exposures" : "Requires remediation"}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              criticalIssuesCount > 0
                ? "bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800"
                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          {/* Expiring SSL Certificates Card */}
          <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                SSL Expiration Alerts
              </span>
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{expiringSslCount}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Expiring in &le; 14 days</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-800">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Websites & Recent Alerts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Monitored Websites Table */}
          <div className="lg:col-span-2 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Protected Websites</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Live defensive posture & monitoring status</p>
              </div>
              <Link
                href="/dashboard/websites"
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1.5"
              >
                View all ({websites.length})
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">Loading protected websites...</div>
            ) : websites.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Globe}
                  title="No websites added yet"
                  description="Add your first domain above to run an automated scan and enable continuous monitoring."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
                {websites.slice(0, 5).map((site) => {
                  const score = site.last_scan_score;
                  const isScored = score !== undefined && score !== null;
                  const scoreBadgeStyle =
                    isScored && score >= 80
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : isScored && score >= 60
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";

                  return (
                    <div
                      key={site.id}
                      className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs uppercase border border-slate-200/80 dark:border-slate-700 shrink-0">
                          {site.domain.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/websites/${site.id}`}
                            className="text-sm font-bold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors truncate block"
                          >
                            {site.name || site.domain}
                          </Link>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate">https://{site.normalized_domain}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                        <div className="text-right hidden sm:block">
                          {isScored ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreBadgeStyle}`}>
                                {score}/100
                              </span>
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {site.last_scan_risk || "Assessed"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Unscanned</span>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {site.monitoring_enabled ? "Continuous monitoring active" : "Monitoring paused"}
                          </p>
                        </div>

                        <Link
                          href={`/dashboard/websites/${site.id}`}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                        >
                          Inspect
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 text-right">
              <Link
                href="/dashboard/websites"
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Manage all registered domains &rarr;
              </Link>
            </div>
          </div>

          {/* Right 1 Col: Recent Alerts */}
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Recent Security Alerts</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Automated change & expiry notifications</p>
              </div>
              <Link
                href="/dashboard/alerts"
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
              >
                View all
              </Link>
            </div>

            {alerts.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-800">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">You're all caught up</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">No active security alerts.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id} className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                        {a.title}
                      </span>
                      <SeverityBadge severity={a.severity} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 line-clamp-2">{a.message}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 text-center">
              <Link
                href="/dashboard/monitoring"
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Configure scan intervals & notifications &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
