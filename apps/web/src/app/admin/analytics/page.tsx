"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Cpu,
  Users,
  Radio,
  RefreshCw,
  BarChart2,
  PieChart,
  Activity,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminAnalytics();
      setData(res);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Operational Analytics</h1>
            <p className="text-xs text-slate-400 mt-1">
              Historical usage trends, security scans throughput, subscription tier distributions, and AI metrics.
            </p>
          </div>
          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* AI Advisor Telemetry Banner */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-white text-sm">AI Security Advisor Telemetry (ai_generations)</h3>
            </div>
            <span className="text-xs font-mono font-bold text-purple-400">
              {data?.ai_metrics?.total_requests ?? 0} total requests
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400">Fallback Usage</span>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {data?.ai_metrics?.fallback_count ?? 0}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Failover activations</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400">Average Latency</span>
              <p className="text-xl font-bold text-sky-400 mt-1">
                {data?.ai_metrics?.avg_latency_ms ?? 0} ms
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Inference + network roundtrip</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400">By Provider</span>
              <div className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-300">
                <p>groq1: {data?.ai_metrics?.by_provider?.groq1 ?? 0}</p>
                <p>groq2: {data?.ai_metrics?.by_provider?.groq2 ?? 0}</p>
                <p>gemini: {data?.ai_metrics?.by_provider?.gemini ?? 0}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400">By Feature Type</span>
              <div className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-300">
                <p>explain: {data?.ai_metrics?.by_feature?.explain_finding ?? 0}</p>
                <p>fix_guide: {data?.ai_metrics?.by_feature?.fix_guide ?? 0}</p>
                <p>plan: {data?.ai_metrics?.by_feature?.security_plan ?? 0}</p>
                <p>chat: {data?.ai_metrics?.by_feature?.chat ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* User Growth & Scans Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" /> User Registrations Timeline
              </h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {data?.users_growth?.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">No registration timeline data available.</p>
              ) : (
                data?.users_growth?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-900/60">
                    <span className="font-mono text-slate-400">{item.date}</span>
                    <span className="font-bold text-white">+{item.users} users</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" /> Scans Execution Timeline
              </h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {data?.scans_timeline?.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">No scan activity data available.</p>
              ) : (
                data?.scans_timeline?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-slate-900/60">
                    <span className="font-mono text-slate-400">{item.date}</span>
                    <span className="font-bold text-emerald-400">{item.scans} scans run</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Subscription Distribution */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <PieChart className="w-4 h-4 text-purple-400" /> Subscription Plan Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            {Object.entries(data?.plan_distribution || {}).map(([plan, count]: any) => (
              <div key={plan} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="capitalize text-slate-400 font-semibold">{plan}</span>
                <p className="text-lg font-bold text-white mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
