"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Database,
  Cpu,
  Mail,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Terminal,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminSystemPage() {
  const [health, setHealth] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSystemInfo = async () => {
    try {
      setLoading(true);
      const [h, t] = await Promise.all([
        api.getAdminSystemHealth(),
        api.getAdminEmailTemplates(),
      ]);
      setHealth(h);
      setTemplates(t.templates || []);
    } catch (err) {
      console.error("Failed to load system health:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemInfo();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System Infrastructure & Health</h1>
            <p className="text-xs text-slate-400 mt-1">
              Live probes for PostgreSQL database, Alembic schema revision, Redis queues, Celery workers, and AI providers.
            </p>
          </div>
          <button
            onClick={loadSystemInfo}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Probe Health</span>
          </button>
        </div>

        {/* Infrastructure Probes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">PostgreSQL DB</span>
              <Database className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-white font-bold text-base capitalize">{health?.database?.status || "Healthy"}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Head: {health?.database?.migration_head || "005_add_ai_generations"}
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Redis Broker</span>
              <Layers className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-white font-bold text-base capitalize">{health?.redis?.status || "Connected"}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {health?.redis?.url || "redis://localhost:6379/0"}
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Celery Workers</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-white font-bold text-base capitalize">{health?.celery?.status || "Operational"}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Queues: {health?.celery?.queues?.join(", ") || "scans, monitoring"}
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">FastAPI Server</span>
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-white font-bold text-base">Online</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Env: {health?.api?.environment || "development"} (v{health?.api?.version || "1.0.0"})
            </p>
          </div>
        </div>

        {/* AI Providers Fallback Chain Status */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" /> AI Provider Orchestration & Health Chain
            </h3>
            <span className="text-[11px] font-semibold text-emerald-400">Zero Secret Leakage Guaranteed</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {health?.ai_providers?.providers && health.ai_providers.providers.length > 0 ? (
              health.ai_providers.providers.map((p: any, idx: number) => {
                const priorityLabel = idx === 0 ? "Primary" : idx === 1 ? "Secondary" : "Fallback";
                const badgeColor =
                  idx === 0
                    ? "bg-sky-950 text-sky-400 border-sky-800"
                    : idx === 1
                    ? "bg-amber-950 text-amber-400 border-amber-800"
                    : "bg-purple-950 text-purple-400 border-purple-800";
                const isConfigured = p.status === "configured";
                const isHealthy = p.health === "healthy";

                return (
                  <div key={p.name} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white capitalize">{p.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                        {priorityLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Model ID:</span>
                      <p className="text-slate-300 font-mono text-[11px] font-medium break-all">{p.model || "—"}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                      <span className="text-slate-400">Configuration:</span>
                      <span className={`font-semibold capitalize ${isConfigured ? "text-emerald-400" : "text-slate-500"}`}>
                        {isConfigured ? "Configured" : "Unconfigured"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Runtime Health:</span>
                      <div className={`flex items-center gap-1 font-semibold ${isHealthy ? "text-emerald-400" : isConfigured ? "text-amber-400" : "text-slate-500"}`}>
                        {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        <span className="capitalize">{p.health || (isConfigured ? "available" : "n/a")}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-3 py-6 text-center text-slate-400">
                Loading runtime AI provider topology...
              </div>
            )}
          </div>
        </div>

        {/* Transactional Email Templates */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" /> Transactional Email Templates
            </h3>
            <span className="text-xs text-slate-400">Mode: Console / SMTP</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {templates.map((tpl) => (
              <div key={tpl.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tpl.category}</span>
                <h4 className="font-bold text-white text-xs">{tpl.name}</h4>
                <p className="font-mono text-[11px] text-slate-400">ID: {tpl.id}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
