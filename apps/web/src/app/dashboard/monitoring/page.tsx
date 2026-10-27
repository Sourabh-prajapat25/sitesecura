"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  ShieldCheck,
  Clock,
  Bell,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader, EmptyState } from "@/components/EmptyState";
import { UpgradeModal } from "@/components/UpgradeModal";
import { LockedFeaturePreview } from "@/components/LockedFeaturePreview";
import { api } from "@/lib/api";
import { Website } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { canAccessMonitoring } from "@/lib/entitlements";

export default function MonitoringPage() {
  const { isAuthenticated, loading: authLoading, plan } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isLocked = !canAccessMonitoring(plan);

  const loadWebsites = async () => {
    try {
      const sites = await api.getWebsites();
      setWebsites(sites);
    } catch (err) {
      console.error("Failed to load monitored websites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadWebsites();
    }
  }, [authLoading, isAuthenticated]);

  const handleToggleMonitoring = async (website: Website) => {
    if (isLocked) {
      setUpgradeModalOpen(true);
      return;
    }
    setActionLoadingId(website.id);
    try {
      if (website.monitoring_enabled) {
        await api.disableWebsiteMonitoring(website.id);
      } else {
        await api.enableWebsiteMonitoring(website.id, "weekly");
      }
      await loadWebsites();
    } catch (err: any) {
      alert(err.message || "Failed to update monitoring status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleChangeFrequency = async (website: Website, freq: "weekly" | "daily") => {
    if (isLocked) {
      setUpgradeModalOpen(true);
      return;
    }
    setActionLoadingId(website.id);
    try {
      await api.updateWebsiteMonitoring(website.id, { frequency: freq });
      await loadWebsites();
    } catch (err: any) {
      alert(err.message || "Failed to update schedule frequency.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeCount = websites.filter((w) => w.monitoring_enabled).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Automated Background Monitoring"
          description="Continuous scheduled scans alert you before SSL certificates expire or when configuration changes drop your score."
        />

        {isLocked ? (
          <LockedFeaturePreview
            icon={Activity}
            badgeText="Premium Feature"
            title="Automated Monitoring"
            description="Continuously monitor your websites and get alerted when security configurations change, certificates approach expiration, or your security posture drops."
            ctaText="Upgrade to Pro"
            onUpgrade={() => setUpgradeModalOpen(true)}
          >
            {/* Realistic Monitoring UI Preview */}
            <div className="p-6 space-y-6">
              {/* 1. Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">SSL Status</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">Healthy</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">82 days until renewal</p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Security Score</span>
                    <Activity className="w-4 h-4 text-sky-500" />
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">94 / 100</p>
                  <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">+3 pts this month</p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Last Check</span>
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">12 min ago</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Next scheduled in 2h 48m</p>
                </div>

                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Alerts</span>
                    <Bell className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">2 Active</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">0 Critical • 2 Warnings</p>
                </div>
              </div>

              {/* 2. Security Health Trend Sparkline / Chart */}
              <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Security Health History</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Automated baseline comparison across continuous scans</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    99.4% Posture Uptime
                  </span>
                </div>

                {/* SVG Trend Line Visual */}
                <div className="h-28 w-full pt-2 flex flex-col justify-between">
                  <svg className="w-full h-20 overflow-visible" viewBox="0 0 600 80" fill="none">
                    <defs>
                      <linearGradient id="monGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 55 C 50 50, 100 60, 150 45 C 200 30, 250 48, 300 35 C 350 22, 400 38, 450 20 C 500 12, 550 18, 600 10"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 0 55 C 50 50, 100 60, 150 45 C 200 30, 250 48, 300 35 C 350 22, 400 38, 450 20 C 500 12, 550 18, 600 10 L 600 80 L 0 80 Z"
                      fill="url(#monGrad)"
                    />
                    <circle cx="600" cy="10" r="4" fill="#0284c7" />
                  </svg>
                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium px-1">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                    <span>Sun</span>
                  </div>
                </div>
              </div>

              {/* 3. Monitoring Overview Table */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#111C2E]">
                <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>Active Monitored Targets</span>
                  <span className="text-slate-400 dark:text-slate-500">3 of 3 Targets Monitored</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {/* Target 1 */}
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">https://example.com</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Frequency: Daily • Next check in 2h 48m</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Healthy (96/100)
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">12 min ago</span>
                    </div>
                  </div>
                  {/* Target 2 */}
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">https://shop.example.com</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Frequency: Weekly • SSL Cert: Valid 140d</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Healthy (92/100)
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">18 min ago</span>
                    </div>
                  </div>
                  {/* Target 3 */}
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">https://client-site.com</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Frequency: Daily • Warning: HSTS header missing</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Warning (78/100)
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium">31 min ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </LockedFeaturePreview>
        ) : (
          <>
            {/* Informational Banner & Stat Overview */}
            <div className="bg-white dark:bg-[#111C2E] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Continuous Celery Beat Protection Active
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
                    Monitored websites are scanned automatically on a scheduled weekly or daily cycle. Diffs are compared against baseline scans to detect header removals, DNS record changes, and certificate expiration.
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {activeCount} Active Schedule{activeCount === 1 ? "" : "s"}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      Scheduler Heartbeat: Every 15 minutes
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Monitored targets list */}
            <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Registered Monitoring Targets
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {websites.length} total target{websites.length === 1 ? "" : "s"}
                </span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Loading monitored websites...
                </div>
              ) : websites.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Activity}
                    title="No websites configured"
                    description="Add websites to your workspace to schedule background monitoring checks."
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {websites.map((w) => {
                    const mon = w.monitoring;
                    const isEnabled = w.monitoring_enabled;
                    const status = mon?.status || (isEnabled ? "active" : "paused");
                    const frequency = (mon?.frequency || w.monitoring_frequency || "weekly") as "weekly" | "daily";
                    const isUpdating = actionLoadingId === w.id;

                    return (
                      <div
                        key={w.id}
                        className="p-5 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Domain & Schedule Meta */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/websites/${w.id}`}
                              className="font-bold text-slate-900 dark:text-white text-sm hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                            >
                              https://{w.normalized_domain}
                            </Link>
                            {w.name && (
                              <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                                ({w.name})
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              Frequency:{" "}
                              <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                                {frequency}
                              </span>
                            </span>

                            {mon?.next_run_at && isEnabled && (
                              <>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                  <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                  Next scan:{" "}
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {new Date(mon.next_run_at).toLocaleString([], {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </span>
                              </>
                            )}

                            {mon?.last_run_at && (
                              <>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  Last run: {new Date(mon.last_run_at).toLocaleDateString()}
                                </span>
                              </>
                            )}

                            {w.last_scan_score !== undefined && w.last_scan_score !== null && (
                              <>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Score: {w.last_scan_score}/100 ({w.last_scan_risk || "Scanned"})
                                </span>
                              </>
                            )}
                          </div>

                          {status === "failing" && mon?.last_error && (
                            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 mt-1 inline-block">
                              Last issue: {mon.last_error}
                            </p>
                          )}
                        </div>

                        {/* Controls & Badges */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Frequency selector (if enabled) */}
                          {isEnabled && (
                            <select
                              disabled={isUpdating}
                              value={frequency}
                              onChange={(e) =>
                                handleChangeFrequency(w, e.target.value as "weekly" | "daily")
                              }
                              className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-[#0B1220] text-slate-700 dark:text-slate-200 font-medium hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="daily">Daily</option>
                            </select>
                          )}

                          {/* Status badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              status === "active" && isEnabled
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : status === "failing"
                                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {status === "active" && isEnabled ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : status === "failing" ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            {isEnabled ? (status === "failing" ? "Failing" : "Active") : "Paused"}
                          </span>

                          {/* Enable/Disable Button */}
                          <button
                            disabled={isUpdating}
                            onClick={() => handleToggleMonitoring(w)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              isEnabled
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                : "bg-sky-600 text-white hover:bg-sky-700 shadow-sm"
                            }`}
                          >
                            {isUpdating ? "Updating..." : isEnabled ? "Pause" : "Enable"}
                          </button>

                          {/* Link to website details */}
                          <Link
                            href={`/dashboard/websites/${w.id}`}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        contextType="monitoring"
        featureName="Continuous Automated Monitoring"
      />
    </DashboardLayout>
  );
}
