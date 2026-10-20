"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckCircle2, ShieldAlert, Clock, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader, EmptyState } from "@/components/EmptyState";
import { SeverityBadge } from "@/components/SeverityBadge";
import { api } from "@/lib/api";
import { AlertItem } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AlertsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadAlerts();
    }
  }, [authLoading, isAuthenticated]);

  const handleDismiss = async (alertId: string) => {
    try {
      await api.updateAlertStatus(alertId, "dismissed");
      loadAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Security Notifications & Alerts"
          description="Real-time alerts triggered by SSL expiration thresholds, unexpected security score drops, or missing headers."
        />

        <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-sm">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Bell}
                title="All caught up!"
                description="No active alerts. SiteSecura will notify you here and via email whenever an important security condition arises."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="mt-0.5">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</h4>
                        <SeverityBadge severity={a.severity} />
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{a.message}</p>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDismiss(a.id)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
