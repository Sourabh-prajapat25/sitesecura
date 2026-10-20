"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Globe,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EmptyState } from "@/components/EmptyState";
import { LockedFeaturePreview } from "@/components/LockedFeaturePreview";
import { UpgradeModal } from "@/components/UpgradeModal";
import { canAccessSecurityBadge } from "@/lib/entitlements";
import { api } from "@/lib/api";
import { Website, WebsiteBadgeStatus, BadgeEligibilityResult, Scan } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

import { WebsiteBadgeSelector } from "@/components/security-badge/WebsiteBadgeSelector";
import { BadgeStatusHero } from "@/components/security-badge/BadgeStatusHero";
import { BadgePreviewCard } from "@/components/security-badge/BadgePreviewCard";
import { BadgeExplanationCard } from "@/components/security-badge/BadgeExplanationCard";
import { RevokeBadgeModal } from "@/components/security-badge/RevokeBadgeModal";

function SecurityBadgeContent() {
  const { isAuthenticated, loading: authLoading, plan } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isLocked = !canAccessSecurityBadge(plan);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);
  const [websitesLoading, setWebsitesLoading] = useState(true);

  const [badgeStatus, setBadgeStatus] = useState<WebsiteBadgeStatus | null>(null);
  const [eligibility, setEligibility] = useState<BadgeEligibilityResult | null>(null);
  const [latestScanScore, setLatestScanScore] = useState<number | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Initial load of user websites
  useEffect(() => {
    if (authLoading || !isAuthenticated || isLocked) return;

    let active = true;
    setWebsitesLoading(true);

    api
      .getWebsites()
      .then((sites) => {
        if (!active) return;
        setWebsites(sites);

        const querySiteId = searchParams.get("website");
        if (querySiteId && sites.some((s) => s.id === querySiteId)) {
          setSelectedWebsiteId(querySiteId);
        } else if (sites.length > 0) {
          setSelectedWebsiteId(sites[0].id);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load websites:", err);
      })
      .finally(() => {
        if (active) setWebsitesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, searchParams]);

  // Selected website object
  const selectedWebsite = websites.find((w) => w.id === selectedWebsiteId) || null;

  // 2. Fetch badge status and eligibility when selectedWebsiteId changes
  const loadBadgeDetails = useCallback(
    async (websiteId: string) => {
      setDetailsLoading(true);
      setDetailsError(null);

      try {
        const [statusData, eligData] = await Promise.all([
          api.getBadgeStatus(websiteId),
          api.getBadgeEligibility(websiteId),
        ]);

        setBadgeStatus(statusData);
        setEligibility(eligData);

        // Fetch latest scan if available to compare snapshot score vs latest scan score
        const site = websites.find((w) => w.id === websiteId);
        if (site?.last_scan_id) {
          try {
            const scanData = await api.getScan(site.last_scan_id);
            setLatestScanScore(scanData.score ?? null);
          } catch {
            setLatestScanScore(null);
          }
        } else {
          setLatestScanScore(null);
        }
      } catch (err: any) {
        console.error("Failed to fetch badge details:", err);
        setDetailsError(err.message || "Failed to load security badge details.");
      } finally {
        setDetailsLoading(false);
      }
    },
    [websites]
  );

  useEffect(() => {
    if (!selectedWebsiteId) return;

    let active = true;
    setDetailsLoading(true);
    setDetailsError(null);

    Promise.all([
      api.getBadgeStatus(selectedWebsiteId),
      api.getBadgeEligibility(selectedWebsiteId),
    ])
      .then(([statusData, eligData]) => {
        if (!active) return;
        setBadgeStatus(statusData);
        setEligibility(eligData);

        const site = websites.find((w) => w.id === selectedWebsiteId);
        if (site?.last_scan_id) {
          api
            .getScan(site.last_scan_id)
            .then((scanData) => {
              if (active) setLatestScanScore(scanData.score ?? null);
            })
            .catch(() => {
              if (active) setLatestScanScore(null);
            });
        } else {
          setLatestScanScore(null);
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setDetailsError(err.message || "Failed to load security badge details.");
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedWebsiteId, websites]);

  // Handle switching website
  const handleSelectWebsite = (siteId: string) => {
    setSelectedWebsiteId(siteId);
    setFeedbackMessage(null);
    router.replace(`/dashboard/security-badge?website=${encodeURIComponent(siteId)}`);
  };

  // Handle Issue / Verify action
  const handleVerify = async () => {
    if (!selectedWebsiteId) return;
    setIsVerifying(true);
    setFeedbackMessage(null);

    try {
      await api.verifyBadge(selectedWebsiteId);
      setFeedbackMessage({
        type: "success",
        text: "SiteSecura Verified badge issued successfully! Your dynamic SVG and verification page are now live.",
      });
      await loadBadgeDetails(selectedWebsiteId);
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "Verification failed. Please check policy eligibility criteria.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Revoke action
  const handleConfirmRevoke = async () => {
    if (!selectedWebsiteId) return;
    try {
      await api.revokeBadge(selectedWebsiteId);
      setFeedbackMessage({
        type: "success",
        text: "Security badge has been revoked. Public badges will immediately reflect revoked status.",
      });
      await loadBadgeDetails(selectedWebsiteId);
    } catch (err: any) {
      throw new Error(err.message || "Failed to revoke badge.");
    }
  };

  // Handle manual eligibility check
  const handleCheckEligibility = async () => {
    if (!selectedWebsiteId) return;
    setIsCheckingEligibility(true);
    setFeedbackMessage(null);

    try {
      const eligData = await api.getBadgeEligibility(selectedWebsiteId);
      setEligibility(eligData);
      setFeedbackMessage({
        type: "success",
        text: "Eligibility refreshed successfully against active security policy.",
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "Failed to check eligibility.",
      });
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  if (isLocked) {
    return (
      <div className="space-y-6">
        {/* Header (Part 7) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/40">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Security Badge &amp; Trust Verification
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Give visitors verifiable proof of your website&apos;s security posture with a SiteSecura Verified badge.
            </p>
          </div>
        </div>

        {/* Premium Feature Locked Preview */}
        <LockedFeaturePreview
          icon={ShieldCheck}
          badgeText="Premium Feature"
          title="Build trust with verified security"
          description="Display a SiteSecura Verified badge backed by your website security assessment, helping visitors understand that your security posture is actively verified."
          ctaText="Upgrade to Basic"
          onUpgrade={() => setUpgradeModalOpen(true)}
        >
          {/* Static realistic background preview */}
          <div className="p-6 space-y-6">
            {/* Top: Mock Configuration & Target Domain Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">https://example.com</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Target Website • Active Verification Policy</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Eligible for Verified Badge
                </span>
                <span className="px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg shadow-2xs">
                  Embed Snippet
                </span>
              </div>
            </div>

            {/* Main: Badge Verification Hero Card Simulation */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              {/* Left Column (7 cols): Verified Trust Seal Card */}
              <div className="md:col-span-7 bg-white dark:bg-[#111C2E] rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">SiteSecura Verified Seal</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                    STATUS: ACTIVE
                  </span>
                </div>

                {/* Visual Live Badge Preview Box */}
                <div className="p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-xl text-white flex flex-col sm:flex-row items-center justify-between gap-5 border border-slate-800 shadow-inner">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm tracking-tight">SiteSecura</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          VERIFIED
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Automated Website Security</p>
                    </div>
                  </div>

                  <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-5">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Security Score</span>
                    <p className="text-2xl font-black text-emerald-400 tracking-tight">94 <span className="text-xs text-slate-500 font-normal">/ 100</span></p>
                  </div>
                </div>

                {/* Verification Checklist */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Automated Verification Criteria</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>HTTPS &amp; TLS 1.3</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>SSL Certificate Valid</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Security Headers Enforced</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Domain Ownership Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Embed Snippet & Styles Simulation */}
              <div className="md:col-span-5 bg-white dark:bg-[#111C2E] rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 space-y-4 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">Available Badge Styles</h4>
                  <div className="space-y-2">
                    {/* Style 1 */}
                    <div className="p-2.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Dynamic Scorecard Badge</span>
                      <span className="text-[10px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded">Selected</span>
                    </div>
                    {/* Style 2 */}
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Compact Trust Shield</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">Available</span>
                    </div>
                    {/* Style 3 */}
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Minimal Dark Pill</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">Available</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Embed Code (HTML / Script)</span>
                  <div className="p-3 bg-slate-900 rounded-lg text-slate-300 font-mono text-[11px] overflow-hidden truncate">
                    &lt;script src=&quot;https://sitesecura.com/badge.js&quot; data-site=&quot;sc-8841&quot;&gt;&lt;/script&gt;
                  </div>
                  <p className="text-[10px] text-slate-400">Loads in &lt;15ms without render-blocking dependencies.</p>
                </div>
              </div>
            </div>
          </div>
        </LockedFeaturePreview>

        {/* Benefit Cards (Part 14) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/40 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Build Visitor Trust</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Show visitors visible proof of your security posture directly on landing and checkout pages.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40 font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Verified Assessment</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Connect your badge directly to your automated SiteSecura passive security assessments and scores.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111C2E] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/40 font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Shareable Badge</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Use the verified badge wherever your website needs to demonstrate defensive security and reliability.
            </p>
          </div>
        </div>

        <UpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          contextType="security_badge"
          recommendedPlan="basic"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/40">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Security Badge &amp; Trust Verification
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Give visitors verifiable proof of your website&apos;s security posture with a SiteSecura Verified badge.
          </p>
        </div>
      </div>

      {/* Global feedback message toast/banner */}
      {feedbackMessage && (
        <div
          role="status"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border shadow-xs animate-in fade-in ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-xs hover:underline shrink-0 text-slate-500 dark:text-slate-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state for websites */}
      {websitesLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-20 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
          <div className="h-64 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
          <div className="h-48 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
        </div>
      ) : websites.length === 0 ? (
        /* Empty State: No websites configured */
        <EmptyState
          icon={Globe}
          title="No Websites Found"
          description="To earn and display a SiteSecura Verified trust badge, first add a website and run an automated security assessment."
          actionText="Add Website"
          onAction={() => router.push("/dashboard/websites")}
        />
      ) : (
        /* Main Security Badge Workspace */
        <div className="space-y-6">
          {/* Website Selector */}
          <WebsiteBadgeSelector
            websites={websites}
            selectedId={selectedWebsiteId}
            onSelect={handleSelectWebsite}
            loading={detailsLoading}
          />

          {/* Details Loading Skeleton */}
          {detailsLoading && !badgeStatus && (
            <div className="space-y-6 animate-pulse">
              <div className="h-64 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
              <div className="h-64 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
            </div>
          )}

          {/* Details Error Banner */}
          {detailsError && (
            <div className="p-6 bg-white dark:bg-[#111C2E] rounded-2xl border border-rose-200 dark:border-rose-800/60 text-center space-y-3 shadow-xs">
              <AlertTriangle className="w-8 h-8 text-rose-500 dark:text-rose-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Failed to load badge data</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">{detailsError}</p>
              <button
                type="button"
                onClick={() => selectedWebsiteId && loadBadgeDetails(selectedWebsiteId)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Content Loaded */}
          {!detailsLoading && (
            <>
              {/* Badge Status Hero */}
              <BadgeStatusHero
                badgeStatus={badgeStatus}
                eligibility={eligibility}
                latestScanScore={latestScanScore}
                isVerifying={isVerifying}
                isCheckingEligibility={isCheckingEligibility}
                onVerify={handleVerify}
                onOpenRevoke={() => setRevokeModalOpen(true)}
                onCheckEligibility={handleCheckEligibility}
              />

              {/* Dynamic Badge Preview & Embed Code Snippets */}
              <BadgePreviewCard
                badgeStatus={badgeStatus}
                isEligible={Boolean(eligibility?.eligible)}
              />

              {/* Trust Principles & Responsible Security Disclaimer */}
              <BadgeExplanationCard />
            </>
          )}

          {/* Revoke Confirmation Modal */}
          {selectedWebsite && (
            <RevokeBadgeModal
              isOpen={revokeModalOpen}
              domain={selectedWebsite.domain || selectedWebsite.name}
              onClose={() => setRevokeModalOpen(false)}
              onConfirm={handleConfirmRevoke}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function SecurityBadgePage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="space-y-6 animate-pulse">
            <div className="h-14 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
            <div className="h-20 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
            <div className="h-64 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
          </div>
        }
      >
        <SecurityBadgeContent />
      </Suspense>
    </DashboardLayout>
  );
}
