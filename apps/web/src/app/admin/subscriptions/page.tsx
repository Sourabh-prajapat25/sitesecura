"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Building2,
  RefreshCw,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldAlert,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Override Modal
  const [overrideTarget, setOverrideTarget] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminSubscriptions();
      setSubs(data || []);
    } catch (err) {
      console.error("Failed to load subscriptions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideTarget || !overrideReason.trim()) return;

    try {
      setOverriding(true);
      await api.overrideAdminPlan({
        organization_id: overrideTarget.organization_id,
        new_plan: selectedPlan,
        reason: overrideReason.trim(),
      });
      alert(`Plan successfully overridden to ${selectedPlan.toUpperCase()}! Recorded in security audit trail.`);
      setOverrideTarget(null);
      setOverrideReason("");
      loadSubscriptions();
    } catch (err: any) {
      alert(err.message || "Failed to override plan.");
    } finally {
      setOverriding(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Subscriptions & Entitlements</h1>
            <p className="text-xs text-slate-400 mt-1">
              Active plan entitlements, Stripe provider mapping, and audited administrative plan overrides.
            </p>
          </div>
          <button
            onClick={loadSubscriptions}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Info & Promotional Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Billing Provider</span>
            <div className="flex items-center gap-2 pt-0.5">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span className="text-white font-bold text-sm">Stripe Payments</span>
            </div>
            <p className="text-[11px] text-slate-400">Webhook reconciliation active</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Coupons & Promotions</span>
            <div className="flex items-center gap-2 pt-0.5">
              <Tag className="w-4 h-4 text-sky-400" />
              <span className="text-white font-bold text-sm">Stripe Dashboard</span>
            </div>
            <p className="text-[11px] text-slate-400">Discount codes managed via Stripe portal</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit Invariant</span>
            <div className="flex items-center gap-2 pt-0.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="text-white font-bold text-sm">Mandatory Reasons</span>
            </div>
            <p className="text-[11px] text-slate-400">All manual overrides logged immutably</p>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Organization</th>
                  <th className="py-3 px-5">Plan Tier</th>
                  <th className="py-3 px-5">Billing Status</th>
                  <th className="py-3 px-5">Scans Usage</th>
                  <th className="py-3 px-5">Current Period End</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                {subs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No active subscription records found.
                    </td>
                  </tr>
                ) : (
                  subs.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-sky-400" />
                        <span>{s.organization_name}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${
                            s.plan === "agency"
                              ? "bg-purple-950 text-purple-400 border border-purple-800"
                              : s.plan === "pro"
                              ? "bg-sky-950 text-sky-400 border border-sky-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {s.plan}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px] capitalize">
                          <CheckCircle2 className="w-3 h-3" /> {s.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-300">
                        {s.scans_used} / {s.scans_limit} scans
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => {
                            setOverrideTarget(s);
                            setSelectedPlan(s.plan);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Override Plan
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Plan Override Modal */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">Administrative Plan Override</h3>
              <button
                onClick={() => setOverrideTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-300 leading-relaxed">
              Target Organization: <span className="font-bold text-white">{overrideTarget.organization_name}</span>
            </p>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">New Subscription Tier</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-sky-500 capitalize"
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro (AI Advisor Included)</option>
                  <option value="agency">Agency (White-Label & AI Advisor Included)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Administrative Justification Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. VIP partner courtesy upgrade, enterprise custom trial..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOverrideTarget(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overriding || !overrideReason.trim()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold disabled:opacity-40"
                >
                  {overriding ? "Applying Override..." : "Confirm Plan Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
