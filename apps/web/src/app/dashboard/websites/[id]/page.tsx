"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Search,
  X,
  ChevronsDown,
  ChevronsUp,
  ExternalLink,
  Loader2,
  Download,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FindingCard, getCategoryLabel } from "@/components/FindingCard";
import { SeverityBadge } from "@/components/SeverityBadge";
import { api } from "@/lib/api";
import { UpgradeModal, UpgradeContextType } from "@/components/UpgradeModal";
import { canAccessMonitoring } from "@/lib/entitlements";
import { Website, Scan, ScanCheck } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

// Security Command Center Components
import { WebsiteHeader } from "@/components/security-center/WebsiteHeader";
import { DeepScanCard } from "@/components/security-center/DeepScanCard";
import { SecurityPostureCard } from "@/components/security-center/SecurityPostureCard";
import { ScoreExplanationCard } from "@/components/security-center/ScoreExplanationCard";
import { SecurityHealthCard } from "@/components/security-center/SecurityHealthCard";
import { AttentionRequiredCard } from "@/components/security-center/AttentionRequiredCard";
import { SecurityChecklistCard } from "@/components/security-center/SecurityChecklistCard";
import { ScoreTrendChart } from "@/components/security-center/ScoreTrendChart";
import { RecentChangesCard } from "@/components/security-center/RecentChangesCard";
import { MonitoringSummaryCard } from "@/components/security-center/MonitoringSummaryCard";
import { WebsiteDetailBadgeCard } from "@/components/security-center/WebsiteDetailBadgeCard";
import { TechnologyProfileCard } from "@/components/security-center/TechnologyProfileCard";
import { RenameWebsiteModal } from "@/components/security-center/RenameWebsiteModal";
import { DeleteWebsiteModal } from "@/components/security-center/DeleteWebsiteModal";
import { ScanTimelineList } from "@/components/security-center/ScanTimelineList";

// Phase 2: Professional Findings & Advisor Components
import {
  SecurityChecksHeader,
  QuickFilterType,
} from "@/components/security-checks/SecurityChecksHeader";
import { SecurityAdvisorModal } from "@/components/security-checks/SecurityAdvisorModal";
import { AiSecurityAdvisorCard } from "@/components/security-center/AiSecurityAdvisorCard";
import {
  AiSecurityAdvisorDrawer,
  AdvisorTab,
} from "@/components/security-checks/AiSecurityAdvisorDrawer";


function getFindingPriority(c: ScanCheck): number {
  const sev = (c.severity || "").toLowerCase();
  const st = (c.status || "").toLowerCase();
  if (sev === "critical" || st === "critical") return 5;
  if (sev === "high" || st === "high") return 4;
  if (sev === "medium" || sev === "warning" || st === "warning" || st === "fail") return 3;
  if (sev === "info" || st === "info" || st === "unknown") return 2;
  if (st === "pass") return 1;
  return 0;
}

export default function WebsiteDetailPage() {
  const { isAuthenticated, loading: authLoading, plan } = useAuth();
  const params = useParams();
  const siteId = params.id as string;
  const router = useRouter();

  const [website, setWebsite] = useState<Website | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [latestScan, setLatestScan] = useState<Scan | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "checks" | "history" | "monitoring">("overview");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingScanId, setDownloadingScanId] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<UpgradeContextType>("monitoring");
  const [actionLoading, setActionLoading] = useState(false);

  // Modals & Navigation state
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [highlightedCheckId, setHighlightedCheckId] = useState<string | null>(null);

  // Phase 2: Security Checks Filtering & Multi-facet state
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedCheckIds, setExpandedCheckIds] = useState<Set<string>>(new Set());

  // Security Advisor state
  const [selectedAdvisorCheck, setSelectedAdvisorCheck] = useState<ScanCheck | null>(null);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorDrawerOpen, setAdvisorDrawerOpen] = useState(false);
  const [advisorInitialTab, setAdvisorInitialTab] = useState<AdvisorTab>("explain");

  const loadData = async () => {
    try {
      const [siteData, scansData] = await Promise.all([
        api.getWebsite(siteId),
        api.getWebsiteScans(siteId),
      ]);
      setWebsite(siteData);
      setScans(scansData);
      if (scansData.length > 0) {
        // Fetch full check details of latest scan
        const fullScan = await api.getScan(scansData[0].id);
        setLatestScan(fullScan);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && siteId) {
      loadData();
    }
  }, [authLoading, isAuthenticated, siteId]);

  const handleScanNow = async () => {
    setScanning(true);
    try {
      await api.triggerWebsiteScan(siteId);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to start scan.");
    } finally {
      setScanning(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!website) return;
    setDownloadingPdf(true);
    try {
      await api.downloadWebsitePdf(website.id, website?.normalized_domain);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF report.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadScanPdf = async (scanId: string) => {
    setDownloadingScanId(scanId);
    try {
      await api.downloadScanPdf(scanId, website?.normalized_domain);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF report.");
    } finally {
      setDownloadingScanId(null);
    }
  };

  const handleToggleMonitoring = async () => {
    if (!website) return;
    if (!canAccessMonitoring(plan)) {
      setUpgradeModalOpen(true);
      return;
    }
    setActionLoading(true);
    try {
      if (website.monitoring_enabled) {
        await api.disableWebsiteMonitoring(siteId);
      } else {
        await api.enableWebsiteMonitoring(siteId, website.monitoring_frequency || "weekly");
      }
      const updated = await api.getWebsite(siteId);
      setWebsite(updated);
    } catch (err: any) {
      alert(err.message || "Failed to update monitoring status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFrequencyChange = async (frequency: "weekly" | "daily") => {
    if (!website) return;
    if (!canAccessMonitoring(plan)) {
      setUpgradeModalOpen(true);
      return;
    }
    setActionLoading(true);
    try {
      await api.updateWebsiteMonitoring(siteId, { frequency });
      const updated = await api.getWebsite(siteId);
      setWebsite(updated);
    } catch (err: any) {
      alert(err.message || "Failed to update frequency.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameSave = async (newName: string) => {
    if (!website) return;
    const updated = await api.updateWebsite(siteId, { name: newName });
    setWebsite(updated);
  };

  const handleDeleteConfirm = async () => {
    if (!website) return;
    await api.deleteWebsite(siteId);
    router.push("/dashboard/websites");
  };

  // Navigates directly to a target check in the Security Checks tab
  const handleSelectCheck = (checkId: string) => {
    setActiveTab("checks");
    setSearchQuery("");
    setQuickFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSeverityFilter("all");
    setHighlightedCheckId(checkId);
    setExpandedCheckIds((prev) => {
      const next = new Set(prev);
      next.add(checkId);
      return next;
    });

    // Smooth scroll into view after DOM update
    setTimeout(() => {
      const el = document.getElementById(`check-${checkId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  };

  const handleExpandAllIssues = () => {
    if (!latestScan?.checks) return;
    const issueIds = latestScan.checks
      .filter((c) => c.status !== "pass")
      .map((c) => c.id);
    setExpandedCheckIds(new Set(issueIds));
  };

  const handleCollapseAll = () => {
    setExpandedCheckIds(new Set());
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          {/* Header Skeleton */}
          <div className="h-28 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6" />
          {/* Tab Skeleton */}
          <div className="h-10 w-96 bg-slate-200/70 dark:bg-slate-800 rounded-xl" />
          {/* Grid Skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 h-64 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800" />
            <div className="lg:col-span-5 h-64 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 h-72 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800" />
            <div className="lg:col-span-5 h-72 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!website) {
    return (
      <DashboardLayout>
        <div className="p-12 text-center bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg mx-auto my-12 shadow-xs">
          <Shield className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Website Not Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            The requested website does not exist or you do not have permission to view it.
          </p>
          <Link
            href="/dashboard/websites"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Websites</span>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const checks = latestScan?.checks || [];
  const previousScan = scans.length >= 2 ? scans[1] : null;

  // Compute breakdown stats for Security Checks header
  const totalCount = checks.length;
  const passedChecks = checks.filter((c) => (c.status || "").toLowerCase() === "pass");
  const passedCount = passedChecks.length;

  const criticalCount = checks.filter(
    (c) => (c.severity || "").toLowerCase() === "critical" || (c.status || "").toLowerCase() === "critical"
  ).length;
  const highCount = checks.filter(
    (c) => (c.severity || "").toLowerCase() === "high" || (c.status || "").toLowerCase() === "high"
  ).length;
  const warningCount = checks.filter((c) => {
    const sev = (c.severity || "").toLowerCase();
    const st = (c.status || "").toLowerCase();
    return (sev === "medium" || sev === "warning" || st === "warning" || st === "fail") && st !== "critical" && sev !== "critical" && st !== "high" && sev !== "high";
  }).length;

  const issueChecks = checks.filter((c) => {
    const st = (c.status || "").toLowerCase();
    const sev = (c.severity || "").toLowerCase();
    return (
      st === "critical" ||
      st === "high" ||
      st === "warning" ||
      st === "fail" ||
      sev === "critical" ||
      sev === "high" ||
      sev === "medium" ||
      sev === "warning"
    );
  });

  const infoChecks = checks.filter((c) => {
    const st = (c.status || "").toLowerCase();
    return st !== "pass" && !issueChecks.includes(c);
  });
  const infoCount = infoChecks.length;

  const topActionableChecks = [...issueChecks]
    .sort((a, b) => {
      const pDiff = getFindingPriority(b) - getFindingPriority(a);
      if (pDiff !== 0) return pDiff;
      return Math.abs(b.score_impact || 0) - Math.abs(a.score_impact || 0);
    })
    .slice(0, 3);

  const isFilterActive =
    quickFilter !== "all" ||
    searchQuery.trim().length > 0 ||
    categoryFilter !== "all" ||
    severityFilter !== "all" ||
    statusFilter !== "all";

  // Multi-facet Filter for Tab 2
  const filteredChecks = checks.filter((c) => {
    const st = (c.status || "").toLowerCase();
    const sev = (c.severity || "").toLowerCase();
    const ct = (c.check_type || "").toLowerCase();
    const catLabel = getCategoryLabel(c.check_type).toLowerCase();

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (c.title || "").toLowerCase().includes(q);
      const matchSummary = (c.summary || "").toLowerCase().includes(q);
      const matchName = (c.name || "").toLowerCase().includes(q);
      const matchCat = catLabel.includes(q);
      if (!matchTitle && !matchSummary && !matchName && !matchCat) {
        return false;
      }
    }

    // 2. Quick Filter Pills
    if (quickFilter === "attention") {
      const isIssue = st === "fail" || st === "warning" || st === "high" || st === "critical" || sev === "critical" || sev === "high" || sev === "medium";
      if (!isIssue) return false;
    } else if (quickFilter === "pass") {
      if (st !== "pass") return false;
    } else if (quickFilter === "critical") {
      if (sev !== "critical" && st !== "critical") return false;
    } else if (quickFilter === "high") {
      if (sev !== "high" && st !== "high") return false;
    } else if (quickFilter === "warning") {
      if (sev !== "medium" && sev !== "warning" && st !== "warning" && st !== "fail") return false;
    } else if (quickFilter === "info") {
      if (sev !== "info" && st !== "info" && st !== "unknown") return false;
    }

    // 3. Category Dropdown Filter
    if (categoryFilter !== "all") {
      if (categoryFilter === "https_ssl" || categoryFilter === "transport") {
        if (!ct.includes("https") && !ct.includes("ssl") && !ct.includes("tls")) return false;
      } else if (categoryFilter === "security_headers" || categoryFilter === "headers") {
        if (
          !ct.includes("hsts") &&
          !ct.includes("csp") &&
          !ct.includes("frame") &&
          !ct.includes("content_type") &&
          !ct.includes("referrer") &&
          !ct.includes("header") &&
          !ct.includes("permissions")
        )
          return false;
      } else if (categoryFilter === "dns_email" || categoryFilter === "email") {
        if (!ct.includes("spf") && !ct.includes("dmarc") && !ct.includes("dns") && !ct.includes("dkim"))
          return false;
      } else if (categoryFilter === "cookie_security" || categoryFilter === "cookies") {
        if (!ct.includes("cookie")) return false;
      } else if (categoryFilter === "server_hygiene" || categoryFilter === "server") {
        if (
          ct.includes("https") ||
          ct.includes("ssl") ||
          ct.includes("hsts") ||
          ct.includes("csp") ||
          ct.includes("spf") ||
          ct.includes("cookie")
        )
          return false;
      }
    }

    // 4. Severity Dropdown Filter
    if (severityFilter !== "all") {
      if (severityFilter === "critical" && sev !== "critical" && st !== "critical") return false;
      if (severityFilter === "high" && sev !== "high" && st !== "high") return false;
      if (severityFilter === "medium" && sev !== "medium" && sev !== "warning" && st !== "warning" && st !== "fail") return false;
      if (severityFilter === "low" && sev !== "low") return false;
      if (severityFilter === "info" && sev !== "info" && st !== "info") return false;
    }

    // 5. Status Dropdown Filter
    if (statusFilter !== "all") {
      if (statusFilter === "pass" && st !== "pass") return false;
      if (statusFilter === "fail" && (st === "pass" || st === "unknown")) return false;
      if (statusFilter === "unknown" && st !== "unknown") return false;
    }

    return true;
  });

  // Prioritize findings by severity/relevance
  const sortedFilteredChecks = [...filteredChecks].sort((a, b) => {
    const pDiff = getFindingPriority(b) - getFindingPriority(a);
    if (pDiff !== 0) return pDiff;
    return Math.abs(b.score_impact || 0) - Math.abs(a.score_impact || 0);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* UPGRADED WEBSITE HEADER */}
        {/* ========================================================================= */}
        <WebsiteHeader
          website={website}
          latestScan={latestScan}
          scanning={scanning}
          downloadingPdf={downloadingPdf}
          onScanNow={handleScanNow}
          onDownloadPdf={handleDownloadPdf}
          onRename={() => setRenameModalOpen(true)}
          onDelete={() => setDeleteModalOpen(true)}
          onGoToMonitoring={() => setActiveTab("monitoring")}
        />

        {/* ========================================================================= */}
        {/* TAB NAVIGATION BAR */}
        {/* ========================================================================= */}
        <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 sm:gap-8 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-colors shrink-0 ${
              activeTab === "overview"
                ? "border-sky-600 text-sky-700 dark:text-sky-400"
                : "border-transparent hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Overview & Score
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("checks")}
            className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
              activeTab === "checks"
                ? "border-sky-600 text-sky-700 dark:text-sky-400"
                : "border-transparent hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>Security Checks</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "checks"
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {checks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
              activeTab === "history"
                ? "border-sky-600 text-sky-700 dark:text-sky-400"
                : "border-transparent hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>Scan History</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "history"
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {scans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("monitoring")}
            className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
              activeTab === "monitoring"
                ? "border-sky-600 text-sky-700 dark:text-sky-400"
                : "border-transparent hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>Monitoring Settings</span>
            {website.monitoring_enabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & SCORE — SECURITY COMMAND CENTER */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {!latestScan ? (
              <div className="bg-white dark:bg-[#111C2E] p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto border border-sky-100 dark:border-sky-900/60">
                  <Shield className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    No completed scans yet
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Run your first defensive security scan to inspect SSL certificates, DNS configurations, security headers, and software hygiene.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleScanNow}
                  disabled={scanning}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {scanning ? "Executing Security Scan..." : "Start Initial Scan"}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 2. PRIMARY SCORE SECTION: SCORE POSTURE & SCORE TREND */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5">
                    <SecurityPostureCard
                      latestScan={latestScan}
                      previousScan={previousScan}
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <ScoreTrendChart scans={scans} />
                  </div>
                </div>

                {/* 3. WHAT NEEDS ATTENTION? & AI SECURITY ADVISOR */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7">
                    <AttentionRequiredCard
                      checks={checks}
                      onSelectCheck={handleSelectCheck}
                      onViewAllFindings={() => setActiveTab("checks")}
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <AiSecurityAdvisorCard
                      latestScan={latestScan}
                      plan={plan}
                      onOpenAdvisor={(tab) => {
                        setAdvisorInitialTab(tab || "explain");
                        setAdvisorDrawerOpen(true);
                      }}
                      onUpgrade={() => {
                        setUpgradeContext("deep_scan");
                        setUpgradeModalOpen(true);
                      }}
                    />
                  </div>
                </div>

                {/* 4. COMPREHENSIVE SECURITY ASSESSMENT (DEEP SCAN) */}
                <DeepScanCard
                  websiteId={siteId}
                  domain={website.normalized_domain || website.domain}
                  plan={plan}
                  scans={scans}
                  onUpgrade={() => {
                    setUpgradeContext("deep_scan");
                    setUpgradeModalOpen(true);
                  }}
                />

                {/* 5. SECURITY HEALTH BY AREA & SCORE EXPLANATION */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7">
                    <SecurityHealthCard
                      latestScan={latestScan}
                      onSelectCategory={(catId) => {
                        setCategoryFilter(catId);
                        setActiveTab("checks");
                      }}
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <ScoreExplanationCard latestScan={latestScan} />
                  </div>
                </div>

                {/* 6. SCAN HISTORY TIMELINE (RECENT ACTIVITY) */}
                <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Recent Scan Timeline
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Historical posture progression and assessment runs
                      </p>
                    </div>
                    {scans.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("history")}
                        className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                      >
                        View all {scans.length} scans &rarr;
                      </button>
                    )}
                  </div>
                  <ScanTimelineList
                    scans={scans}
                    websiteId={siteId}
                    downloadingScanId={downloadingScanId}
                    onDownloadScanPdf={handleDownloadScanPdf}
                    maxItems={3}
                    onViewAll={() => setActiveTab("history")}
                  />
                </div>

                {/* 7. VERIFIED BADGE & MONITORING STATUS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <WebsiteDetailBadgeCard
                      websiteId={siteId}
                      latestScanScore={latestScan.score}
                    />
                  </div>
                  <div>
                    <MonitoringSummaryCard
                      website={website}
                      onConfigureMonitoring={() => setActiveTab("monitoring")}
                      onToggleMonitoring={handleToggleMonitoring}
                      actionLoading={actionLoading}
                    />
                  </div>
                </div>

                {/* 8. CHANGES & TECH PROFILE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <TechnologyProfileCard
                      checks={checks}
                      onSelectCheck={handleSelectCheck}
                    />
                  </div>
                  <div>
                    <RecentChangesCard
                      latestScan={latestScan}
                      previousScan={previousScan}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SECURITY CHECKS — PROFESSIONAL FINDINGS & EVIDENCE */}
        {/* ========================================================================= */}
        {activeTab === "checks" && (
          <div className="space-y-6">
            {/* H1 & H2: HERO AND EXECUTIVE SUMMARY STRIP */}
            <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-xs space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-100 dark:border-sky-900/60">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Security Checks
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Your website&apos;s security review
                      </h2>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
                    SiteSecura checks your website&apos;s security controls automatically. You don&apos;t need to understand the technical details to know what needs attention.
                  </p>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{totalCount} checks reviewed</span>
                    <span>•</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{passedCount} working well</span>
                    <span>•</span>
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">{issueChecks.length} need attention</span>
                    <span>•</span>
                    <span className="text-slate-600 dark:text-slate-400">{infoCount} informational</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start lg:self-center">
                  <button
                    type="button"
                    onClick={handleScanNow}
                    disabled={scanning}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
                    <span>{scanning ? "Scanning..." : "Re-test Security"}</span>
                  </button>
                </div>
              </div>

              {/* H2: Executive Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {/* 1. Need attention */}
                <button
                  type="button"
                  onClick={() => setQuickFilter(quickFilter === "attention" ? "all" : "attention")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    quickFilter === "attention"
                      ? "bg-amber-100/70 border-amber-300 ring-2 ring-amber-400/30 dark:bg-amber-950/50 dark:border-amber-700 dark:ring-amber-500/30"
                      : "bg-amber-50/60 border-amber-200/80 hover:bg-amber-50 hover:border-amber-300 dark:bg-amber-950/20 dark:border-amber-900/60 dark:hover:bg-amber-950/30 dark:hover:border-amber-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {issueChecks.length} Need attention
                    </span>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 block">
                    {issueChecks.length === 0 ? "No active issues" : "Improvements required"}
                  </span>
                </button>

                {/* 2. Working well */}
                <button
                  type="button"
                  onClick={() => setQuickFilter(quickFilter === "pass" ? "all" : "pass")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    quickFilter === "pass"
                      ? "bg-emerald-100/70 border-emerald-300 ring-2 ring-emerald-400/30 dark:bg-emerald-950/50 dark:border-emerald-700 dark:ring-emerald-500/30"
                      : "bg-emerald-50/60 border-emerald-200/80 hover:bg-emerald-50 hover:border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-900/60 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      {passedCount} Working well
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">
                    Verified defensive controls
                  </span>
                </button>

                {/* 3. Informational */}
                <button
                  type="button"
                  onClick={() => setQuickFilter(quickFilter === "info" ? "all" : "info")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    quickFilter === "info"
                      ? "bg-slate-200/80 border-slate-300 ring-2 ring-slate-400/20 dark:bg-slate-800 dark:border-slate-600 dark:ring-slate-500/20"
                      : "bg-slate-50 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300 dark:bg-slate-800/40 dark:border-slate-800 dark:hover:bg-slate-800/60 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {infoCount} Informational
                    </span>
                    <Info className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Context · 0 score penalty
                  </span>
                </button>

                {/* 4. Critical */}
                <button
                  type="button"
                  onClick={() => setQuickFilter(quickFilter === "critical" ? "all" : "critical")}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    criticalCount > 0
                      ? quickFilter === "critical"
                        ? "bg-rose-100/80 border-rose-300 ring-2 ring-rose-400/30 text-rose-900 dark:bg-rose-950/50 dark:border-rose-700 dark:ring-rose-500/30 dark:text-rose-200"
                        : "bg-rose-50/60 border-rose-200/80 hover:bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/60 dark:hover:bg-rose-950/30 dark:text-rose-300"
                      : "bg-emerald-50/30 border-emerald-100 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${criticalCount > 0 ? "text-rose-900 dark:text-rose-200" : "text-emerald-900 dark:text-emerald-200"}`}>
                      {criticalCount} Critical
                    </span>
                    {criticalCount > 0 ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </div>
                  <span className={`text-[11px] block ${criticalCount > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                    {criticalCount > 0 ? "Immediate urgency" : "None detected"}
                  </span>
                </button>
              </div>
            </div>

            {/* H3: "WHAT SHOULD I DO FIRST?" RECOMMENDATION STRIP */}
            {topActionableChecks.length > 0 && (
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                    Priority Action Plan
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    WHAT SHOULD I DO FIRST?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Your highest-impact recommended improvements prioritized by exploitability and remediation ease.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {topActionableChecks.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <SeverityBadge status={item.status} severity={item.severity} />
                          {item.score_impact < 0 && (
                            <span className="text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded border border-red-100 dark:border-red-900/50 font-mono">
                              {item.score_impact} pts
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {item.title}
                        </h4>

                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {item.why_it_matters || item.summary || "Configuration gap detected requiring remediation."}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>~{item.estimated_fix_minutes || 15} min fix</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handleSelectCheck(item.id)}
                          className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold hover:underline text-xs"
                        >
                          <span>View recommendation &rarr;</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* H4: SECONDARY FILTER & EXPLORE TOOLBAR */}
            <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search security checks..."
                    className="w-full pl-8.5 pr-8 py-1.5 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Expand / Collapse Controls */}
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={handleExpandAllIssues}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronsDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>Expand Issues</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronsUp className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>Collapse All</span>
                  </button>
                </div>
              </div>

              {/* Multi-facet Dropdowns */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase">Category:</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All Categories</option>
                      <option value="https_ssl">HTTPS & SSL/TLS</option>
                      <option value="security_headers">Security Headers</option>
                      <option value="dns_email">DNS & Email Security</option>
                      <option value="cookie_security">Cookie Security</option>
                      <option value="server_hygiene">Server & Technology</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase">Severity:</span>
                    <select
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                      className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium / Warning</option>
                      <option value="low">Low</option>
                      <option value="info">Informational</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold text-[11px] uppercase">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pass">Passed</option>
                      <option value="fail">Failed / Warning</option>
                      <option value="unknown">Unable to Verify</option>
                    </select>
                  </div>
                </div>

                {isFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setQuickFilter("all");
                      setCategoryFilter("all");
                      setSeverityFilter("all");
                      setStatusFilter("all");
                    }}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* H5, H6, H7: CHECK LIST RENDERING */}
            {isFilterActive ? (
              /* FILTERED VIEW */
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Showing {sortedFilteredChecks.length} of {checks.length} checks matching filters
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setQuickFilter("all");
                      setCategoryFilter("all");
                      setSeverityFilter("all");
                      setStatusFilter("all");
                    }}
                    className="font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>

                {sortedFilteredChecks.length === 0 ? (
                  <div className="bg-white dark:bg-[#111C2E] p-12 text-center text-slate-400 dark:text-slate-500 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                    <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">No Security Checks Found</p>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                      No check records match the selected filter or search criteria.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setQuickFilter("all");
                        setCategoryFilter("all");
                        setSeverityFilter("all");
                        setStatusFilter("all");
                      }}
                      className="mt-2 px-4 py-1.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold rounded-lg text-xs transition-colors border border-sky-200 dark:border-sky-800"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {sortedFilteredChecks.map((check) => (
                      <FindingCard
                        key={check.id}
                        check={check}
                        domain={website.normalized_domain}
                        defaultExpanded={expandedCheckIds.has(check.id)}
                        highlighted={highlightedCheckId === check.id}
                        anchorId={`check-${check.id}`}
                        onOpenAdvisor={(c, tab) => {
                          setSelectedAdvisorCheck(c);
                          setAdvisorInitialTab(tab || "explain");
                          setAdvisorDrawerOpen(true);
                        }}
                        onRescan={handleScanNow}
                        onUnlock={() => setUpgradeModalOpen(true)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* UNFILTERED VIEW: 3 DISTINCT STRUCTURED SECTIONS */
              <div className="space-y-8">
                {/* SECTION 1: NEEDS ATTENTION */}
                {issueChecks.length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                          NEEDS ATTENTION ({issueChecks.length})
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Improvements recommended to harden your website
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {issueChecks.map((check) => (
                        <FindingCard
                          key={check.id}
                          check={check}
                          domain={website.normalized_domain}
                          defaultExpanded={expandedCheckIds.has(check.id)}
                          highlighted={highlightedCheckId === check.id}
                          anchorId={`check-${check.id}`}
                          onOpenAdvisor={(c, tab) => {
                            setSelectedAdvisorCheck(c);
                            setAdvisorInitialTab(tab || "explain");
                            setAdvisorDrawerOpen(true);
                          }}
                          onRescan={handleScanNow}
                          onUnlock={() => setUpgradeModalOpen(true)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION 2: WORKING WELL */}
                {passedChecks.length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                          WORKING WELL ({passedChecks.length})
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Verified active security controls
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {passedChecks.map((check) => (
                        <FindingCard
                          key={check.id}
                          check={check}
                          domain={website.normalized_domain}
                          defaultExpanded={expandedCheckIds.has(check.id)}
                          highlighted={highlightedCheckId === check.id}
                          anchorId={`check-${check.id}`}
                          onOpenAdvisor={(c, tab) => {
                            setSelectedAdvisorCheck(c);
                            setAdvisorInitialTab(tab || "explain");
                            setAdvisorDrawerOpen(true);
                          }}
                          onRescan={handleScanNow}
                          onUnlock={() => setUpgradeModalOpen(true)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION 3: INFORMATIONAL */}
                {infoChecks.length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                          INFORMATIONAL ({infoChecks.length})
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Passive observations · 0 score penalty
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {infoChecks.map((check) => (
                        <FindingCard
                          key={check.id}
                          check={check}
                          domain={website.normalized_domain}
                          defaultExpanded={expandedCheckIds.has(check.id)}
                          highlighted={highlightedCheckId === check.id}
                          anchorId={`check-${check.id}`}
                          onOpenAdvisor={(c, tab) => {
                            setSelectedAdvisorCheck(c);
                            setAdvisorInitialTab(tab || "explain");
                            setAdvisorDrawerOpen(true);
                          }}
                          onRescan={handleScanNow}
                          onUnlock={() => setUpgradeModalOpen(true)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SCAN HISTORY */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Complete Assessment Timeline
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full historical record of Quick Checks and Comprehensive Deep Scans run on {website.domain}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 w-fit">
                {scans.length} {scans.length === 1 ? "Assessment Record" : "Assessment Records"}
              </span>
            </div>

            <ScanTimelineList
              scans={scans}
              websiteId={siteId}
              downloadingScanId={downloadingScanId}
              onDownloadScanPdf={handleDownloadScanPdf}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: MONITORING SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === "monitoring" && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white dark:bg-[#111C2E] p-6 sm:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Continuous Monitoring Schedule</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  SiteSecura Celery Beat background scheduler performs automated scans to detect SSL certificate expiration, security header alterations, DNS tampering, and score drops.
                </p>
              </div>

              {/* Status Banner */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Automated Background Scanning</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        website.monitoring_enabled
                          ? website.monitoring?.status === "failing"
                            ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                            : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {website.monitoring_enabled ? (
                        website.monitoring?.status === "failing" ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Failing
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Active
                          </>
                        )
                      ) : (
                        "Paused"
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {website.monitoring_enabled
                      ? `Target is actively monitored on a ${website.monitoring?.frequency || website.monitoring_frequency || "weekly"} schedule.`
                      : "Monitoring is currently paused for this domain."}
                  </p>
                </div>

                <button
                  disabled={actionLoading}
                  onClick={handleToggleMonitoring}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                    website.monitoring_enabled
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                  }`}
                >
                  {actionLoading
                    ? "Updating..."
                    : website.monitoring_enabled
                    ? "Pause Monitoring"
                    : "Enable Monitoring"}
                </button>
              </div>

              {/* Failing state error alert */}
              {website.monitoring?.status === "failing" && website.monitoring?.last_error && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Last Monitored Scan Encountered an Issue
                  </div>
                  <p className="text-amber-700 dark:text-amber-400 pl-5">{website.monitoring.last_error}</p>
                </div>
              )}

              {/* Schedule Configuration Details */}
              {website.monitoring_enabled && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1.5">Scan Frequency</label>
                      <div className="flex items-center gap-2">
                        <select
                          disabled={actionLoading}
                          value={website.monitoring?.frequency || website.monitoring_frequency || "weekly"}
                          onChange={(e) =>
                            handleFrequencyChange(e.target.value as "weekly" | "daily")
                          }
                          className="bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        >
                          <option value="weekly">Weekly Schedule</option>
                          <option value="daily">Daily Schedule</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 font-medium block mb-1">Next Scheduled Scan</span>
                      <span className="text-slate-800 dark:text-slate-100 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        {website.monitoring?.next_run_at
                          ? new Date(website.monitoring.next_run_at).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Scheduled on next Beat cycle"}
                      </span>
                    </div>

                    {website.monitoring?.last_run_at && (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium block mb-1">Last Run</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {new Date(website.monitoring.last_run_at).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    )}

                    {website.monitoring?.last_success_at && (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-medium block mb-1">Last Successful Diff</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          {new Date(website.monitoring.last_success_at).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* What We Monitor Checklist */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Automated Security Diff Checks
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>SSL Certificate Expiration (30d, 14d, 7d)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Security Headers Removal (HSTS, CSP, XFO)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>DNS Record Tampering (A, MX, SPF, DMARC)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Security Score Drop Alert (≥ 5 points)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Website Management Modals */}
      <RenameWebsiteModal
        isOpen={renameModalOpen}
        currentName={website.name || ""}
        domain={website.normalized_domain}
        onClose={() => setRenameModalOpen(false)}
        onSave={handleRenameSave}
      />

      <DeleteWebsiteModal
        isOpen={deleteModalOpen}
        domain={website.normalized_domain}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Subscription Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        contextType={upgradeContext}
      />

      {/* AI Security Advisor Modal */}
      <SecurityAdvisorModal
        isOpen={advisorModalOpen}
        check={selectedAdvisorCheck}
        plan={plan}
        onClose={() => {
          setAdvisorModalOpen(false);
          setSelectedAdvisorCheck(null);
        }}
        onUpgrade={() => setUpgradeModalOpen(true)}
        onTriggerVerificationScan={handleScanNow}
      />

      {/* Phase 3: Full AI Security Advisor Drawer */}
      <AiSecurityAdvisorDrawer
        isOpen={advisorDrawerOpen}
        onClose={() => {
          setAdvisorDrawerOpen(false);
          setSelectedAdvisorCheck(null);
        }}
        scan={latestScan}
        check={selectedAdvisorCheck}
        domain={website.normalized_domain}
        plan={plan}
        initialTab={advisorInitialTab}
        onUpgrade={() => setUpgradeModalOpen(true)}
        onTriggerVerificationScan={handleScanNow}
      />
    </DashboardLayout>
  );
}

