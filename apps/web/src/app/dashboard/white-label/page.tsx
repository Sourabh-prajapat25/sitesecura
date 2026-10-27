"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Palette,
  Check,
  Upload,
  Trash2,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Shield,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/EmptyState";
import { UpgradeModal } from "@/components/UpgradeModal";
import { LockedFeaturePreview } from "@/components/LockedFeaturePreview";
import { api, resolveAssetUrl } from "@/lib/api";
import { Organization, UserProfile } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { canAccessWhiteLabel } from "@/lib/entitlements";

const COLOR_PRESETS = [
  { name: "SiteSecura Blue", hex: "#0284c7" },
  { name: "Indigo Tech", hex: "#4f46e5" },
  { name: "Emerald Security", hex: "#059669" },
  { name: "Violet Enterprise", hex: "#7c3aed" },
  { name: "Slate Corporate", hex: "#334155" },
  { name: "Crimson Defensive", hex: "#dc2626" },
];

export default function WhiteLabelPage() {
  const { isAuthenticated, loading: authLoading, plan } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0284c7");
  const [footerText, setFooterText] = useState("");
  const [saving, setSaving] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const load = async () => {
        try {
          const res = await api.getCurrentUser();
          setProfile(res.user);
          setOrg(res.organization);
          setBrandName(res.organization.brand_name || "");
          setPrimaryColor(res.organization.primary_color || "#0284c7");
          setFooterText(res.organization.footer_text || "");
          if (res.organization.logo_url) {
            setLocalLogoPreview(resolveAssetUrl(res.organization.logo_url));
            setImageLoadError(false);
          } else {
            setLocalLogoPreview(null);
            setImageLoadError(false);
          }
        } catch (e) {
          console.error(e);
        }
      };
      load();
    }
  }, [authLoading, isAuthenticated]);

  const isRestricted = !canAccessWhiteLabel(plan);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await api.updateWhiteLabelSettings({
        brand_name: brandName.trim() || undefined,
        primary_color: primaryColor,
        footer_text: footerText.trim() || undefined,
      });
      setOrg(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to update branding settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setLogoError("File size exceeds 2MB limit. Please upload a smaller logo.");
      return;
    }

    setUploadingLogo(true);
    setLogoError(null);
    setLogoSuccess(null);

    try {
      const updatedOrg = await api.uploadWhiteLabelLogo(file);
      setOrg(updatedOrg);
      if (updatedOrg.logo_url) {
        const resolved = resolveAssetUrl(updatedOrg.logo_url);
        setLocalLogoPreview(resolved ? `${resolved}?t=${Date.now()}` : null);
        setImageLoadError(false);
      }
      setLogoSuccess("Logo uploaded successfully and applied to all client reports!");
      setTimeout(() => setLogoSuccess(null), 4000);
    } catch (err: any) {
      setLogoError(err.message || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm("Are you sure you want to remove your custom agency logo? Reports will fall back to the standard vector logo.")) {
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const updatedOrg = await api.deleteWhiteLabelLogo();
      setOrg(updatedOrg);
      setLocalLogoPreview(null);
      setImageLoadError(false);
      setLogoSuccess("Logo removed successfully.");
      setTimeout(() => setLogoSuccess(null), 3000);
    } catch (err: any) {
      setLogoError(err.message || "Failed to delete logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title="Agency White-Label Branding"
          description="Customize the brand identity, logo, and color theme displayed across generated client PDF security assessment reports."
        />

        {isRestricted ? (
          <LockedFeaturePreview
            icon={Palette}
            badgeText="Agency Plan Exclusive"
            title="Agency White-Label"
            description="Deliver professional security assessments under your own agency brand with customizable client reports."
            ctaText="Upgrade to Agency"
            onUpgrade={() => setUpgradeModalOpen(true)}
          >
            {/* Realistic Agency White-Label UI Preview */}
            <div className="p-6 space-y-6">
              {/* Top: Agency Customizer Simulation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Agency Brand</span>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Apex Cyber Intelligence</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Custom logo & unbranded PDF delivery</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Theme Color</span>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 ring-2 ring-emerald-200 dark:ring-emerald-800"></span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">Emerald Security (#059669)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Accent color on badges, charts & covers</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Client Recipient</span>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">Acme Digital Corporation</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">White-label PDF ready for client delivery</p>
                </div>
              </div>

              {/* Main: Branded Client Security Report Document Simulation */}
              <div className="bg-white dark:bg-[#111C2E] rounded-xl border-2 border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6 max-w-3xl mx-auto">
                {/* Report Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-emerald-600/30">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                      A
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base tracking-tight">APEX CYBER INTELLIGENCE</h3>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">Independent Cybersecurity Assessment</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right space-y-0.5">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Report Ref</span>
                    <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">#ACI-2026-8841</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Audited: October 2026</p>
                  </div>
                </div>

                {/* Client Metadata & Big Score */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center p-5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="sm:col-span-7 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Target Website & Organization</span>
                    <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">Acme Digital Corporation</h4>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-400">https://acme-digital.example.com</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
                      Comprehensive passive security evaluation covering perimeter headers, SSL/TLS cryptography, and DNS reputation.
                    </p>
                  </div>

                  <div className="sm:col-span-5 text-center sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-6 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Security Score</span>
                    <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">92 <span className="text-lg font-bold text-slate-400 dark:text-slate-500">/ 100</span></div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                      Grade A • Low Risk
                    </span>
                  </div>
                </div>

                {/* Verification Checklist Breakdown */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Verified Inspection Areas</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        HTTPS & TLS 1.3
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Valid (2048-bit)</span>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        Security Headers
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">HSTS, CSP, X-Frame</span>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        SPF & Email Auth
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Configured</span>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-[10px] shrink-0">!</span>
                        DMARC Enforcement
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Policy: p=none</span>
                    </div>
                  </div>
                </div>

                {/* Security Recommendations Snippet */}
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Executive Recommendation:</p>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                    Strengthen DMARC policy from monitoring mode (<code className="text-slate-800 dark:text-slate-200 font-mono">p=none</code>) to quarantine (<code className="text-slate-800 dark:text-slate-200 font-mono">p=quarantine</code>) to protect domain reputation against phishing and unauthorized spoofing.
                  </p>
                </div>

                {/* Branded Footer */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  CONFIDENTIAL ASSESSMENT • PREPARED BY APEX CYBER INTELLIGENCE FOR ACME DIGITAL CORPORATION • ALL RIGHTS RESERVED
                </div>
              </div>
            </div>
          </LockedFeaturePreview>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (7 cols): Configuration Forms */}
            <div className="lg:col-span-7 space-y-6">
              {/* Logo Upload Card */}
              <div className="bg-white dark:bg-[#111C2E] p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    Agency Logo Asset
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Rendered in the header of all client PDF security reports and cover scorecards.
                  </p>
                </div>

                {logoError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{logoError}</span>
                  </div>
                )}

                {logoSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{logoSuccess}</span>
                  </div>
                )}

                {/* Logo Preview & Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-14 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                      {localLogoPreview && !imageLoadError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={localLogoPreview}
                          alt="Agency Logo"
                          onError={() => setImageLoadError(true)}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : imageLoadError ? (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium text-center px-1">Logo preview unavailable</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">No Logo</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {localLogoPreview && !imageLoadError ? "Active Custom Logo" : "Default SiteSecura Logo"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Supports PNG, JPG, or SVG. Maximum file size 2MB.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                      id="agency-logo-file-input"
                    />
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-400" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{uploadingLogo ? "Uploading..." : localLogoPreview ? "Change Logo" : "Upload Logo"}</span>
                    </button>

                    {localLogoPreview && (
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        onClick={handleDeleteLogo}
                        title="Remove custom logo"
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Branding Typography & Theme Form */}
              <div className="bg-white dark:bg-[#111C2E] p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    Report Branding & Typography
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Customize the corporate identity applied to the document cover and running headers.
                  </p>
                </div>

                {saveSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    Branding settings updated successfully!
                  </div>
                )}

                <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Agency / Brand Display Name
                    </label>
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Apex Security Consultants"
                      className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Replaces all default SiteSecura titles on page 1 of client assessment reports.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Primary Theme Color
                    </label>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setPrimaryColor(p.hex)}
                          className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                            primaryColor.toLowerCase() === p.hex.toLowerCase()
                              ? "scale-110 border-slate-900 dark:border-white shadow-sm"
                              : "border-white dark:border-slate-800 hover:scale-105"
                          }`}
                          style={{ backgroundColor: p.hex }}
                          title={p.name}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-9 h-9 p-1 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer bg-white dark:bg-slate-900"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-32 px-3 py-1.5 font-mono text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl uppercase text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Confidential Footer Notice & Tagline
                    </label>
                    <textarea
                      rows={2}
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      placeholder="e.g. Prepared by Apex Security • security@apexagency.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-sky-500 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Printed at the bottom of every page beside dynamic page numbering.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? "Saving Branding Changes..." : "Save Branding Settings"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column (5 cols): Live Interactive Client Report Preview Card */}
            <div className="lg:col-span-5 sticky top-6 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Live Client PDF Preview</span>
                </div>
                <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-full border border-sky-100 dark:border-sky-800 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Real-time
                </span>
              </div>

              {/* Realistic Report Preview Sheet */}
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-md p-6 space-y-5 text-slate-800 dark:text-slate-200 font-sans select-none">
                {/* Simulated Report Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="h-8 max-w-[120px] flex items-center justify-start">
                      {localLogoPreview && !imageLoadError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={localLogoPreview}
                          alt="Preview Logo"
                          onError={() => setImageLoadError(true)}
                          className="h-7 max-w-[120px] object-contain"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                          <Shield className="w-4 h-4 text-sky-600 dark:text-sky-400 fill-sky-100 dark:fill-sky-950" />
                          <span>{brandName || "SiteSecura"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">RPT-2026-X7K2</span>
                </div>

                {/* Colored Theme Bar */}
                <div
                  className="h-1.5 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: primaryColor }}
                />

                {/* Report Title */}
                <div className="space-y-1">
                  <h4
                    className="text-base font-extrabold tracking-tight transition-colors duration-300"
                    style={{ color: primaryColor }}
                  >
                    Website Security Assessment Report
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Automated Defensive Posture, Infrastructure & Vulnerability Analysis
                  </p>
                </div>

                {/* Simulated Target Metadata Box */}
                <div className="p-3 bg-slate-50/90 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[10px] space-y-1.5 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Assessed Target:</span>
                    <span className="font-bold text-slate-900 dark:text-white">https://clientportal.acme.com</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Prepared By:</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                      {brandName || "SiteSecura"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Evaluation Tier:</span>
                    <span className="font-bold capitalize text-slate-900 dark:text-white">Agency Audit</span>
                  </div>
                </div>

                {/* Scorecard Widget Preview */}
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-800/50 shadow-2xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                      Overall Security Posture
                    </span>
                    <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">94 / 100</p>
                    <span className="inline-block mt-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.2 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Low Risk • Excellent
                    </span>
                  </div>

                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-xs transition-colors duration-300"
                    style={{ backgroundColor: primaryColor }}
                  >
                    A+
                  </div>
                </div>

                {/* Simulated Page Footer */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[9px] text-slate-400 dark:text-slate-500 flex items-center justify-between font-mono">
                  <span className="truncate max-w-[190px]">
                    {footerText || `Website Security Assessment • ${brandName || "SiteSecura"}`}
                  </span>
                  <span>Page 1 of 6</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                This preview dynamically adapts to your custom logo, brand color, and footer tagline.
              </p>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        contextType="white_label"
        featureName="Agency White-Labeling"
        recommendedPlan="agency"
      />
    </DashboardLayout>
  );
}
