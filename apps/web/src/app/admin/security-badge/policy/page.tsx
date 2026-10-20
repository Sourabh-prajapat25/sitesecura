"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  Info,
  Clock,
  Sliders,
  RotateCcw,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";
import { BadgePolicy, BadgePolicyUpdateInput } from "@/types";

export default function AdminBadgePolicyPage() {
  const [policy, setPolicy] = useState<BadgePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    minimum_score: number;
    maximum_scan_age_days: number;
    verification_validity_days: number;
    disallow_critical_findings: boolean;
    disallow_high_findings: boolean;
    require_successful_scan: boolean;
    require_authorized_website: boolean;
    require_monitoring: boolean;
  }>({
    minimum_score: 70,
    maximum_scan_age_days: 30,
    verification_validity_days: 30,
    disallow_critical_findings: true,
    disallow_high_findings: false,
    require_successful_scan: true,
    require_authorized_website: true,
    require_monitoring: false,
  });

  const loadPolicy = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAdminBadgePolicy();
      setPolicy(data);
      setFormData({
        minimum_score: data.minimum_score,
        maximum_scan_age_days: data.maximum_scan_age_days,
        verification_validity_days: data.verification_validity_days,
        disallow_critical_findings: data.disallow_critical_findings,
        disallow_high_findings: data.disallow_high_findings,
        require_successful_scan: data.require_successful_scan,
        require_authorized_website: data.require_authorized_website,
        require_monitoring: data.require_monitoring,
      });
    } catch (err: any) {
      console.error("Failed to load badge policy:", err);
      setError(err.message || "Failed to load security badge policy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSuccessMessage(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Frontend pre-flight validation
    if (formData.minimum_score < 0 || formData.minimum_score > 100) {
      setError("Minimum security score must be between 0 and 100.");
      return;
    }
    if (formData.maximum_scan_age_days <= 0) {
      setError("Maximum scan age must be a positive integer greater than 0.");
      return;
    }
    if (formData.verification_validity_days <= 0) {
      setError("Verification validity duration must be a positive integer greater than 0.");
      return;
    }

    try {
      setSaving(true);
      const payload: BadgePolicyUpdateInput = {
        minimum_score: Number(formData.minimum_score),
        maximum_scan_age_days: Number(formData.maximum_scan_age_days),
        verification_validity_days: Number(formData.verification_validity_days),
        disallow_critical_findings: Boolean(formData.disallow_critical_findings),
        disallow_high_findings: Boolean(formData.disallow_high_findings),
        require_successful_scan: Boolean(formData.require_successful_scan),
        require_authorized_website: Boolean(formData.require_authorized_website),
        require_monitoring: Boolean(formData.require_monitoring),
      };

      const updated = await api.updateAdminBadgePolicy(payload);
      setPolicy(updated);
      setSuccessMessage("Security badge policy updated successfully! Changes will govern all future verification requests.");
    } catch (err: any) {
      console.error("Failed to save badge policy:", err);
      setError(err.message || "Failed to save security badge policy.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!policy) return;
    setFormData({
      minimum_score: policy.minimum_score,
      maximum_scan_age_days: policy.maximum_scan_age_days,
      verification_validity_days: policy.verification_validity_days,
      disallow_critical_findings: policy.disallow_critical_findings,
      disallow_high_findings: policy.disallow_high_findings,
      require_successful_scan: policy.require_successful_scan,
      require_authorized_website: policy.require_authorized_website,
      require_monitoring: policy.require_monitoring,
    });
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Security Badge Policy Governance
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Centrally configure platform eligibility criteria, validity windows, and security thresholds for the SiteSecura Verified trust badge.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadPolicy}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Feedback Banners */}
        {successMessage && (
          <div
            role="status"
            className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Informational Callout: Point-in-time Snapshot Immutability */}
        <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-800/50 flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
            <p className="font-semibold text-sky-200">
              Point-in-Time Snapshot Immutability Rule
            </p>
            <p>
              Updating policy parameters applies <span className="font-semibold text-white">only to future eligibility checks and new badge verifications</span>. Previously issued verifications remain immutable historical snapshots and will not have their recorded score or policy association silently rewritten.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 animate-pulse">
            <div className="h-6 w-48 bg-slate-800 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-20 bg-slate-800 rounded-xl" />
              <div className="h-20 bg-slate-800 rounded-xl" />
              <div className="h-20 bg-slate-800 rounded-xl" />
            </div>
            <div className="h-32 bg-slate-800 rounded-xl" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Policy Parameters Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Active Verification Policy: <span className="text-sky-400 font-mono">{policy?.name}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {policy?.description || "Platform-wide defensive trust requirements"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active Policy
                </span>
              </div>

              {/* Numerical Constraints */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>Quantitative Thresholds</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Minimum Score */}
                  <div className="space-y-2">
                    <label
                      htmlFor="minimum_score"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Minimum Security Score (0–100)
                    </label>
                    <input
                      id="minimum_score"
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formData.minimum_score}
                      onChange={(e) => handleInputChange("minimum_score", parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      Minimum defensive score required to qualify. Current default: 70.
                    </p>
                  </div>

                  {/* Maximum Scan Age */}
                  <div className="space-y-2">
                    <label
                      htmlFor="maximum_scan_age_days"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Maximum Scan Age (Days)
                    </label>
                    <input
                      id="maximum_scan_age_days"
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={formData.maximum_scan_age_days}
                      onChange={(e) => handleInputChange("maximum_scan_age_days", parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      Scans older than this duration cannot be used for verification.
                    </p>
                  </div>

                  {/* Verification Validity Duration */}
                  <div className="space-y-2">
                    <label
                      htmlFor="verification_validity_days"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Verification Validity (Days)
                    </label>
                    <input
                      id="verification_validity_days"
                      type="number"
                      min={1}
                      max={365}
                      required
                      value={formData.verification_validity_days}
                      onChange={(e) => handleInputChange("verification_validity_days", parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors"
                    />
                    <p className="text-[11px] text-slate-400">
                      Days until an active verification expires and requires re-assessment.
                    </p>
                  </div>
                </div>
              </div>

              {/* Boolean Safety Guards */}
              <div className="pt-4 border-t border-slate-800/80">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Defensive Safety Guards</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Disallow Critical */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.disallow_critical_findings}
                      onChange={(e) => handleInputChange("disallow_critical_findings", e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">
                        Disallow Critical Security Findings
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        Disqualifies any website with unmitigated critical vulnerabilities (recommended).
                      </span>
                    </div>
                  </label>

                  {/* Disallow High */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.disallow_high_findings}
                      onChange={(e) => handleInputChange("disallow_high_findings", e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">
                        Disallow High-Severity Findings
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        Strict mode: also disqualifies sites with high-severity defects.
                      </span>
                    </div>
                  </label>

                  {/* Require Successful Scan */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.require_successful_scan}
                      onChange={(e) => handleInputChange("require_successful_scan", e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">
                        Require Completed Successful Scan
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        Guarantees that partial or failed scan attempts are rejected.
                      </span>
                    </div>
                  </label>

                  {/* Require Authorized Website */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.require_authorized_website}
                      onChange={(e) => handleInputChange("require_authorized_website", e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">
                        Require Authorized Tenant Website
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        Enforces organization ownership and domain verification before badge issuance.
                      </span>
                    </div>
                  </label>

                  {/* Require Continuous Monitoring */}
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.require_monitoring}
                      onChange={(e) => handleInputChange("require_monitoring", e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white block">
                        Require Active Continuous Monitoring
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-tight">
                        When enabled, badges can only be issued to websites with active monitoring.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Current</span>
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Policy Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Policy Governance</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
