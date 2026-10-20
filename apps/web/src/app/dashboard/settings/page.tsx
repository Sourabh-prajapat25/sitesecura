"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Bell,
  Shield,
  Check,
  CreditCard,
  Building2,
  Sparkles,
  Lock,
  ArrowRight,
  ShieldCheck,
  Save,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/EmptyState";
import { UpgradeModal } from "@/components/UpgradeModal";
import { api } from "@/lib/api";
import { UserProfile, Organization } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

type SettingsSection = "profile" | "plan" | "security" | "notifications" | "workspace";

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function SettingsPage() {
  const { isAuthenticated, loading: authLoading, user, plan, isEmailVerified } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [saved, setSaved] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const load = async () => {
        try {
          const res = await api.getCurrentUser();
          setProfile(res.user);
          setOrg(res.organization);
          setName(res.user.name || "");
        } catch (e) {
          console.error("Failed to fetch settings profile:", e);
        }
      };
      load();
    }
  }, [authLoading, isAuthenticated]);

  // Support direct initial anchor navigation if navigated with hash
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as SettingsSection;
      if (["profile", "plan", "security", "notifications", "workspace"].includes(hash)) {
        setActiveSection(hash);
      }
    }
  }, []);

  const handleSelectSection = (section: SettingsSection) => {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const navItems: NavItem[] = [
    { id: "profile", label: "Profile Information", icon: User },
    { id: "plan", label: "Account & Plan", icon: CreditCard },
    { id: "security", label: "Account Security", icon: Shield },
    { id: "notifications", label: "Notification Preferences", icon: Bell },
    { id: "workspace", label: "Workspace Details", icon: Building2 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Settings"
          description="Manage your account, security preferences, notifications, and workspace information."
        />

        {/* Global Save Feedback Banner */}
        {saved && (
          <div
            role="status"
            className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between shadow-xs animate-in fade-in"
          >
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Settings updated successfully.</span>
            </div>
            <button
              type="button"
              onClick={() => setSaved(false)}
              className="text-emerald-700 dark:text-emerald-400 hover:underline text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Mobile Section Selector */}
        <div className="lg:hidden bg-white dark:bg-[#111C2E] p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-1.5">
          <label htmlFor="mobile-settings-nav" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Settings Section
          </label>
          <select
            id="mobile-settings-nav"
            value={activeSection}
            onChange={(e) => handleSelectSection(e.target.value as SettingsSection)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B1220] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 cursor-pointer"
          >
            {navItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Main Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Left Navigation Sidebar */}
          <div className="lg:col-span-3 sticky top-6 hidden lg:block">
            <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-2 shadow-xs space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold border border-sky-100 dark:border-sky-800/60"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Settings Section Panel (One section displayed at a time) */}
          <div className="lg:col-span-9">
            {/* 1. Profile Information */}
            {activeSection === "profile" && (
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100/90 dark:border-sky-800/60 shadow-2xs">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Profile Information</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Manage your basic account identity and contact name.</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {profile?.role || "Owner"}
                  </span>
                </div>

                <form onSubmit={handleSave} className="space-y-4 text-xs">
                  <div>
                    <label htmlFor="settings-name" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="settings-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="settings-email" className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="settings-email"
                      type="email"
                      disabled
                      value={profile?.email || user?.email || ""}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 rounded-xl text-sm cursor-not-allowed select-all"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      Identity managed via Firebase Authentication.
                    </p>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-sky-600/20 cursor-pointer flex items-center gap-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. Account & Plan Summary */}
            {activeSection === "plan" && (
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100/90 dark:border-purple-800/60 shadow-2xs">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Current Plan & Subscription</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Your active SiteSecura subscription tier and entitlements.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    {plan.toUpperCase()} PLAN
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                      {plan} Tier Active
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
                      {plan === "free"
                        ? "Get started with essential website security checks, deterministic scoring, and top 3 findings."
                        : plan === "basic"
                        ? "Includes automated weekly monitoring, verified trust badges, email alerts, and full PDF report exports."
                        : plan === "pro"
                        ? "Includes Deep Scan F1–F8, daily automated monitoring, AI Security Advisor, and up to 3 team seats."
                        : "Includes custom white-label reports, multi-domain agency monitoring, and priority scan pipelines."}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {plan === "free" ? (
                      <button
                        type="button"
                        onClick={() => setUpgradeModalOpen(true)}
                        className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Explore Plans</span>
                      </button>
                    ) : (
                      <Link
                        href="/dashboard/billing"
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs transition-colors flex items-center gap-1.5"
                      >
                        <span>Manage Billing</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Account Security */}
            {activeSection === "security" && (
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-5 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/90 dark:border-emerald-800/60 shadow-2xs">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account Security</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Review your authentication credentials and verification state.</p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {/* Email Verification */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white">Email Verification</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Required for receiving critical security alerts and password recoveries.
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                        isEmailVerified
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isEmailVerified ? "bg-emerald-500" : "bg-amber-500"}`}
                      />
                      {isEmailVerified ? "Verified" : "Pending Verification"}
                    </span>
                  </div>

                  {/* Authentication Provider */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white">Authentication Authority</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Single-tenant token issuance backed by Google Firebase Identity Services.
                      </p>
                    </div>
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                      Firebase Auth (JWT)
                    </span>
                  </div>

                  {/* Session Status */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white">Active Session</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Authenticated session for {profile?.email || user?.email || "current user"}.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Notification Preferences */}
            {activeSection === "notifications" && (
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-5 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100/90 dark:border-sky-800/60 shadow-2xs">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notification Preferences</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Choose which security updates SiteSecura sends to your email.</p>
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  {/* Critical Security Alerts Item */}
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Critical Security Alerts</p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            emailAlerts ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {emailAlerts ? "ON" : "OFF"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Receive instant emails on SSL expiration (&le; 14 days) or security score drops (&gt; 10 pts).
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={emailAlerts}
                      onClick={() => setEmailAlerts(!emailAlerts)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                        emailAlerts ? "bg-sky-600" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-200 shadow-sm ring-0 transition duration-200 ease-in-out ${
                          emailAlerts ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Weekly Security Summary Item */}
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Weekly Security Summary</p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            weeklyDigest ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {weeklyDigest ? "ON" : "OFF"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Receive a weekly overview of your security posture improvements and resolved issues.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={weeklyDigest}
                      onClick={() => setWeeklyDigest(!weeklyDigest)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                        weeklyDigest ? "bg-sky-600" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-200 shadow-sm ring-0 transition duration-200 ease-in-out ${
                          weeklyDigest ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-sky-600/20 cursor-pointer flex items-center gap-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Preferences</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 5. Workspace Details */}
            {activeSection === "workspace" && (
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100/90 dark:border-amber-800/60 shadow-2xs">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Workspace Details</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Organization configuration and multi-tenant isolation.</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Default Organization
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workspace Name</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {org?.name || "Personal Workspace"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Isolated database namespace</p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workspace ID</span>
                    <p className="text-sm font-mono font-bold text-slate-900 dark:text-white truncate">
                      {org?.id ? `#${org.id.slice(0, 8)}...` : "Default"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-tenant security isolation</p>
                  </div>
                </div>

                {/* Informational Workspace Upgrade Note */}
                {plan === "free" || plan === "basic" ? (
                  <div className="p-4 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-bold text-sky-950 dark:text-sky-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-sky-600" />
                        Team Collaboration Available on Pro
                      </p>
                      <p className="text-sky-700 dark:text-sky-400 text-[11px]">
                        Invite teammates and DevOps engineers to collaborate on defensive audits and monitoring.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUpgradeModalOpen(true)}
                      className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs shadow-2xs transition-colors shrink-0 cursor-pointer"
                    >
                      Upgrade
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 flex justify-end">
                    <Link
                      href="/dashboard/team"
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 flex items-center gap-1"
                    >
                      <span>Manage Workspace Collaborators</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        contextType="general"
      />
    </DashboardLayout>
  );
}
