"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Lock,
  Globe,
  FileCode,
  Sparkles,
  RefreshCw,
  Search,
  Server,
  Code,
  FileText,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Key,
  Mail,
  Network,
  Cpu,
  Check,
  X,
  Database,
  Terminal,
  FolderSearch,
  Radio,
  Share2,
  UserCheck,
  KeyRound,
  Cookie,
  Fingerprint,
  Workflow,
  Users,
  FileLock2,
  Cloud,
  HardDrive,
  GitBranch,
  Box,
  Activity,
  CreditCard,
  Eye,
  FileSpreadsheet,
  UserX,
  FileCheck,
  Info,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FindingCard } from "@/components/FindingCard";
import { UpgradeModal } from "@/components/UpgradeModal";
import { SecurityAdvisorModal } from "@/components/security-checks/SecurityAdvisorModal";
import {
  AiSecurityAdvisorDrawer,
  AdvisorTab,
} from "@/components/security-checks/AiSecurityAdvisorDrawer";
import { api } from "@/lib/api";
import { canAccessDeepScan } from "@/lib/entitlements";
import { Website, Scan, ScanCheck, SubscriptionInfo, DeepScanMetadata } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";

function getCategoryMeta(catName: string) {
  const lower = catName.toLowerCase();
  if (lower.includes("transport") || lower.includes("ssl") || lower.includes("tls") || lower.includes("f2")) {
    return { name: "Transport Security & Encryption", phase: "Phase F2", tab: "advanced" as const };
  }
  if (lower.includes("frontend") || lower.includes("javascript") || lower.includes("f3")) {
    return { name: "Website & JavaScript Security", phase: "Phase F3", tab: "frontend" as const };
  }
  if (lower.includes("app") || lower.includes("api") || lower.includes("http") || lower.includes("f4")) {
    return { name: "API Endpoints & Application Security", phase: "Phase F4", tab: "appsec" as const };
  }
  if (lower.includes("identity") || lower.includes("auth") || lower.includes("session") || lower.includes("f5")) {
    return { name: "Authentication & Access Controls", phase: "Phase F5", tab: "identity" as const };
  }
  if (lower.includes("infra") || lower.includes("cloud") || lower.includes("f6")) {
    return { name: "Infrastructure & Cloud Exposure", phase: "Phase F6", tab: "infra" as const };
  }
  if (lower.includes("data") || lower.includes("privacy") || lower.includes("f7")) {
    return { name: "Data Privacy & Sensitive Information", phase: "Phase F7", tab: "privacy" as const };
  }
  if (lower.includes("correlation") || lower.includes("graph") || lower.includes("intelligence") || lower.includes("f8")) {
    return { name: "Attack Surface & Correlated Intelligence", phase: "Phase F8", tab: "risk_intelligence" as const };
  }
  if (lower.includes("discovery") || lower.includes("page") || lower.includes("crawl") || lower.includes("f1")) {
    return { name: "Multi-Page Discovery & Structure", phase: "Phase F1", tab: "pages" as const };
  }
  return { name: catName, phase: "", tab: "findings" as const };
}

export default function DeepScanPage() {
  const { isAuthenticated, loading: authLoading, plan } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const websiteId = params.id as string;
  const initialScanId = searchParams.get("scanId");

  const [website, setWebsite] = useState<Website | null>(null);
  const [billing, setBilling] = useState<SubscriptionInfo | null>(null);
  const [currentScan, setCurrentScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingScan, setStartingScan] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"findings" | "advanced" | "frontend" | "appsec" | "identity" | "infra" | "privacy" | "risk_intelligence" | "pages" | "coverage" | "evidence">("findings");
  const [advancedSubTab, setAdvancedSubTab] = useState<"tls" | "dns" | "email" | "hsts_csp" | "headers">("tls");
  const [frontendSubTab, setFrontendSubTab] = useState<"overview" | "assets" | "endpoints" | "secrets" | "third_party" | "storage_dom" | "sourcemaps">("overview");
  const [frontendSearch, setFrontendSearch] = useState("");
  // Phase F4: Application & API Security state
  const [appsecSubTab, setAppsecSubTab] = useState<"overview" | "api" | "cors" | "errors" | "docs" | "http" | "auth" | "exposure">("overview");
  const [appsecSearch, setAppsecSearch] = useState("");
  // Phase F5: Advanced Authentication, Session, Authorization & Business Logic state
  const [identitySubTab, setIdentitySubTab] = useState<"overview" | "auth" | "session" | "oauth" | "csrf" | "authz" | "business" | "recovery">("overview");
  const [identitySearch, setIdentitySearch] = useState("");
  // Phase F6: Advanced Infrastructure, Cloud, Deployment & Operational Security state
  const [infraSubTab, setInfraSubTab] = useState<"overview" | "cloud" | "origin" | "deployment" | "exposure" | "storage" | "operations" | "relationships">("overview");
  const [infraSearch, setInfraSearch] = useState("");
  // Phase F7: Advanced Data Security, Privacy & Sensitive Exposure state
  const [privacySubTab, setPrivacySubTab] = useState<"overview" | "pii" | "api_data" | "urls" | "forms" | "documents" | "governance" | "tracking">("overview");
  const [privacySearch, setPrivacySearch] = useState("");
  // Phase F8: Advanced Security Correlation, Attack-Surface Risk Graph & Executive Posture state
  const [riskSubTab, setRiskSubTab] = useState<"overview" | "graph" | "chains" | "root_causes" | "roadmap" | "assets">("overview");
  const [riskSearch, setRiskSearch] = useState("");
  const [selectedGraphNode, setSelectedGraphNode] = useState<any | null>(null);

  // AI Security Advisor state
  const [selectedAdvisorCheck, setSelectedAdvisorCheck] = useState<ScanCheck | null>(null);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorDrawerOpen, setAdvisorDrawerOpen] = useState(false);
  const [advisorInitialTab, setAdvisorInitialTab] = useState<AdvisorTab>("explain");

  // Technical evidence sub-tab state
  const [evidenceTab, setEvidenceTab] = useState<"headers" | "cookies" | "forms" | "resources" | "sourcemaps" | "technology">("headers");

  // Premium Deep Scan UX progressive disclosure states
  const [scoreExplainerOpen, setScoreExplainerOpen] = useState(false);
  const [showAllPassedControls, setShowAllPassedControls] = useState(false);
  const [showInfoObservations, setShowInfoObservations] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isEntitled = canAccessDeepScan(plan);
  const planName = plan === "agency" ? "Agency" : plan === "pro" ? "Pro" : "Free";
  const maxPages = plan === "agency" ? 100 : 50;

  // Load initial website, billing usage, and scan data
  const loadInitialData = async () => {
    try {
      const [siteData, billingData, scansData] = await Promise.all([
        api.getWebsite(websiteId),
        api.getBilling().catch(() => null),
        api.getWebsiteScans(websiteId),
      ]);
      setWebsite(siteData);
      setBilling(billingData);

      // If specific scanId passed in query
      if (initialScanId) {
        const targetScan = await api.getScan(initialScanId);
        setCurrentScan(targetScan);
      } else {
        // Find latest deep scan if one exists
        const latestDeep = scansData.find((s) => s.scan_type === "deep");
        if (latestDeep) {
          const fullScan = await api.getScan(latestDeep.id);
          setCurrentScan(fullScan);
        }
      }
    } catch (err) {
      console.error("Failed to load deep scan data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && websiteId) {
      loadInitialData();
    }
  }, [authLoading, isAuthenticated, websiteId]);

  // Polling loop when current scan is running
  useEffect(() => {
    if (currentScan && (currentScan.status === "queued" || currentScan.status === "running")) {
      pollingRef.current = setInterval(async () => {
        try {
          const updated = await api.getScan(currentScan.id);
          setCurrentScan(updated);
          if (updated.status === "completed" || updated.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            // Refresh billing after scan completes
            api.getBilling().then(setBilling).catch(() => null);
          }
        } catch (err) {
          console.error("Error polling scan status:", err);
        }
      }, 2500);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentScan?.id, currentScan?.status]);

  const handleStartDeepScan = async () => {
    setConfirmModalOpen(false);
    setStartingScan(true);
    try {
      const newScan = await api.triggerWebsiteDeepScan(websiteId);
      setCurrentScan(newScan);
      // Immediately refresh billing usage
      api.getBilling().then(setBilling).catch(() => null);
    } catch (err: any) {
      alert(err.message || "Failed to start Deep Website Security Scan.");
    } finally {
      setStartingScan(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl mx-auto py-6 animate-pulse">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          <div className="h-40 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
          <div className="h-96 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800" />
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

  const isScanning = currentScan?.status === "queued" || currentScan?.status === "running";
  const isCompleted = currentScan?.status === "completed";
  const metadata = currentScan?.scan_metadata as DeepScanMetadata | undefined;
  const checks = currentScan?.checks || [];

  const totalObservations = checks.length;
  const f8Count = checks.filter((c) => (c.check_type || "").toLowerCase().includes("risk_chain")).length;
  const deterministicCount = totalObservations - f8Count;

  const criticalCount = metadata?.severity_counts?.critical ?? checks.filter((c) => (c.severity === "critical" || c.status === "critical")).length;
  const highCount = metadata?.severity_counts?.high ?? checks.filter((c) => (c.severity === "high" || c.status === "high")).length;
  const mediumCount = metadata?.severity_counts?.medium ?? checks.filter((c) => (c.severity === "medium" || c.status === "warning")).length;
  const lowCount = metadata?.severity_counts?.low ?? checks.filter((c) => c.severity === "low").length;
  const infoCount = metadata?.severity_counts?.info ?? checks.filter((c) => (c.severity === "info" || c.status === "info" || c.status === "unknown") && c.status !== "pass").length;

  const passedChecks = checks.filter((c) => c.status === "pass");
  const issueChecks = checks.filter(
    (c) =>
      c.status !== "pass" &&
      c.severity !== "info" &&
      c.status !== "info" &&
      c.status !== "unknown"
  );
  const infoChecks = checks.filter(
    (c) =>
      (c.severity === "info" || c.status === "info" || c.status === "unknown") &&
      c.status !== "pass"
  );

  const score = currentScan?.score ?? 0;
  const clampedScore = Math.max(0, Math.min(100, score));
  const scoreStatus =
    clampedScore >= 90
      ? "Excellent"
      : clampedScore >= 75
      ? "Good"
      : clampedScore >= 60
      ? "Needs Attention"
      : "Critical Action Required";

  const scoreBadgeClass =
    clampedScore >= 90
      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
      : clampedScore >= 75
      ? "bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800"
      : clampedScore >= 60
      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
      : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800";

  const scoreNarrative =
    clampedScore >= 90
      ? (issueChecks.length === 0
          ? "Your website demonstrates excellent security hygiene with no critical or high-severity vulnerabilities identified."
          : `Your website demonstrates strong transport security and data privacy controls, with ${issueChecks.length} high-priority improvement${issueChecks.length === 1 ? "" : "s"} recommended.`)
      : clampedScore >= 75
      ? `Your website demonstrates a solid defensive baseline, with ${issueChecks.length} improvement${issueChecks.length === 1 ? "" : "s"} recommended to harden your posture.`
      : clampedScore >= 60
      ? `Your website has moderate risk exposure with ${issueChecks.length} actionable item${issueChecks.length === 1 ? "" : "s"} requiring attention to protect users and systems.`
      : `Critical security vulnerabilities were detected that require immediate remediation to prevent exposure.`;

  const topActionableItems = checks
    .filter((c) => c.status !== "pass" && c.severity !== "info")
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, warning: 2, low: 1, info: 0 };
      const diff = (sevOrder[b.severity || ""] || 0) - (sevOrder[a.severity || ""] || 0);
      if (diff !== 0) return diff;
      return Math.abs(b.score_impact || 0) - Math.abs(a.score_impact || 0);
    })
    .slice(0, 3);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/websites/${websiteId}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {website.name || website.domain}</span>
          </Link>

          {isCompleted && (
            <button
              type="button"
              onClick={() => {
                if (!isEntitled) {
                  setUpgradeModalOpen(true);
                } else {
                  setConfirmModalOpen(true);
                }
              }}
              disabled={startingScan}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run New Deep Scan</span>
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* STATE 1: RUNNING SCREEN */}
        {/* ========================================================================= */}
        {isScanning && (
          <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-indigo-200 dark:border-indigo-900/60 p-8 sm:p-10 shadow-sm space-y-8">
            <div className="text-center space-y-3 max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Deep Website Security Scan in Progress
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Target: https://{website.normalized_domain}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                SiteSecura worker is performing comprehensive multi-page crawling, TLS & DNS certificate inspection,
                deep client-side JavaScript analysis, advanced web application & API security, identity & authorization evaluation,
                infrastructure & cloud exposure intelligence, and data security & privacy governance audits.
              </p>
            </div>

            {/* Stage-based progress display */}
            <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phase F1: Discovery, multi-page crawl & asset inventory</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phase F2: TLS ciphers, DNSSEC, CAA & email authentication</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phase F3: Frontend JS analysis, supply-chain & secret detection</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phase F4: Web application, API endpoints, CORS & HTTP security</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phase F5: Authentication, session cookies, OAuth/OIDC & logic surfaces</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phase F6: Infrastructure, cloud, deployment & operational security</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Phase F7: Advanced data security, privacy & sensitive exposure</span>
              </div>
              <div className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400 font-bold">
                <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                <span>Phase F8: Advanced correlation, attack-surface graph & executive posture</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                <span>Deterministic scoring & AI remediation report</span>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-400 dark:text-slate-500">
              Scans typically take 15 to 45 seconds depending on page count. Results update automatically.
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATE 2: COMPLETED RESULTS DASHBOARD */}
        {/* ========================================================================= */}
        {!isScanning && isCompleted && currentScan && (
          <div className="space-y-6">
              {/* Header / Score Banner (Sections 4.1, 4.2, 4.3) */}
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Comprehensive Security Assessment
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Deep Scan
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                        https://{website.normalized_domain}
                      </span>
                      <span>•</span>
                      <span>
                        Completed:{" "}
                        {currentScan.completed_at
                          ? new Date(currentScan.completed_at).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "Just now"}
                      </span>
                      <span>•</span>
                      <span>Duration: {currentScan.scan_duration_ms ? `${Math.round(currentScan.scan_duration_ms / 1000)}s` : "—"}</span>
                    </div>

                    {/* Executive Narrative */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      {scoreNarrative}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {issueChecks.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-lg border border-amber-200/80 dark:border-amber-800 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>{issueChecks.length} improvements need attention</span>
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-900 dark:text-indigo-300 bg-indigo-50/90 dark:bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/40 font-semibold">
                        <span>
                          {f8Count > 0
                            ? `${totalObservations} security observations reviewed (${deterministicCount} security checks + ${f8Count} correlated insights)`
                            : `${totalObservations} security observations reviewed`}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Score badge & quick stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <div className="text-4xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                        {clampedScore}
                        <span className="text-base text-slate-400 dark:text-slate-500 font-normal"> / 100</span>
                      </div>
                      <div className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${scoreBadgeClass}`}>
                        {scoreStatus}
                      </div>
                    </div>

                    <div className="h-12 w-px bg-slate-200 dark:bg-slate-700" />

                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                        {metadata?.pages_crawled ?? currentScan.total_checks_count}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Pages Analyzed
                      </div>
                    </div>

                    <div className="h-12 w-px bg-slate-200 dark:bg-slate-700" />

                    <div className="text-center">
                      <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                        {totalObservations}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Observations
                      </div>
                    </div>
                  </div>
                </div>

                {/* Severity summary bar (Prioritized, calm, not alarming) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                  {criticalCount > 0 ? (
                    <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                      <div className="text-lg font-bold text-rose-700 dark:text-rose-300 font-mono">
                        {criticalCount}
                      </div>
                      <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Critical</div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 flex flex-col items-center justify-center">
                      <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>0 Critical</span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">None detected</div>
                    </div>
                  )}

                  <div className={`p-3 rounded-xl border ${highCount > 0 ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"}`}>
                    <div className={`text-lg font-bold font-mono ${highCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-400"}`}>
                      {highCount}
                    </div>
                    <div className={`text-[11px] font-semibold ${highCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>High Priority</div>
                  </div>

                  <div className={`p-3 rounded-xl border ${mediumCount > 0 ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"}`}>
                    <div className={`text-lg font-bold font-mono ${mediumCount > 0 ? "text-amber-800 dark:text-amber-300" : "text-slate-600 dark:text-slate-400"}`}>
                      {mediumCount}
                    </div>
                    <div className={`text-[11px] font-semibold ${mediumCount > 0 ? "text-amber-800 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}>Medium</div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="text-lg font-bold text-slate-700 dark:text-slate-300 font-mono">
                      {lowCount}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Low</div>
                  </div>

                  <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <div className="text-lg font-bold text-slate-600 dark:text-slate-400 font-mono">
                      {infoCount}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Informational</div>
                  </div>
                </div>

                {/* Collapsible Score Calculation Explainer (Section 4.2) */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setScoreExplainerOpen(!scoreExplainerOpen)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <span>How is this score calculated?</span>
                    {scoreExplainerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {scoreExplainerOpen && (
                    <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed animate-in fade-in">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Deterministic 100-Point Cybersecurity Baseline
                      </p>
                      <p>
                        Every assessment begins at a perfect baseline score of <strong>100</strong>. Points are deducted based strictly on the severity and real-world exploitability of detected gaps:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1 font-mono text-[11px]">
                        <div className="p-2 rounded-lg bg-white dark:bg-[#111C2E] border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                          <span className="font-bold">Critical</span>
                          <div className="text-xs font-black">-25 pts</div>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-[#111C2E] border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                          <span className="font-bold">High</span>
                          <div className="text-xs font-black">-15 pts</div>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-[#111C2E] border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300">
                          <span className="font-bold">Medium</span>
                          <div className="text-xs font-black">-5 pts</div>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          <span className="font-bold">Low</span>
                          <div className="text-xs font-black">-1 pt</div>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          <span className="font-bold">Info</span>
                          <div className="text-xs font-black">0 pts</div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        The minimum possible score is 0. Informational findings provide contextual insight and software detection with zero score penalty.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Executive Priority Attention Block (Section 5) */}
              <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                      What should you fix first?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Your highest-impact recommended improvements.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("findings")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 transition-colors self-start sm:self-auto"
                  >
                    <span>View all {totalObservations} security observations</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {topActionableItems.length === 0 ? (
                  <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>No critical or high-severity vulnerabilities detected. All baseline security controls are functioning normally.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {topActionableItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.severity === "critical"
                                ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                : item.severity === "high"
                                ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                : "bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
                            }`}>
                              {item.severity || "warning"}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              ~{item.estimated_fix_minutes || 15} min
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {item.title}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {item.why_it_matters || item.summary || "Configuration gap detected requiring remediation."}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("findings");
                              const el = document.getElementById(`finding-${item.id}`);
                              el?.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                          >
                            View details &rarr;
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAdvisorCheck(item);
                              setAdvisorInitialTab("fix");
                              setAdvisorDrawerOpen(true);
                            }}
                            className="font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            Fix Guide
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Scores Breakdown (Section 8) */}
              {currentScan.score_breakdown && Object.keys(currentScan.score_breakdown).length > 0 && (
                <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        Security Score Categories
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        These categories contribute directly to your 100-point security score.
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Deterministic weights totaling 100 points
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(currentScan.score_breakdown).map(([catKey, stats]: [string, any]) => {
                      const meta = getCategoryMeta(catKey);
                      const catScore = stats.score ?? 0;
                      const maxScore = stats.max_score ?? 100;
                      const passed = stats.passed_checks ?? 0;
                      const deductions = stats.deductions ?? 0;
                      const pct = Math.round((catScore / Math.max(maxScore, 1)) * 100);
                      const isZeroWithPassed = catScore === 0 && passed > 0;

                      const catStatus =
                        pct >= 90 ? "Excellent" : pct >= 75 ? "Good" : "Needs attention";
                      const catStatusClass =
                        pct >= 90
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : pct >= 75
                          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";

                      return (
                        <div
                          key={catKey}
                          onClick={() => {
                            if (meta.tab) setActiveTab(meta.tab);
                          }}
                          className="p-4 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer space-y-2.5 flex flex-col justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {meta.phase}
                              </span>
                              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${catStatusClass}`}>
                                {catStatus}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-1">
                              {meta.name}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">Score</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{catScore} / {maxScore}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all rounded-full ${
                                  pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-sky-500" : "bg-amber-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                            <span>{passed} observations reviewed</span>
                            {deductions > 0 && (
                              <span className="text-amber-700 dark:text-amber-400 font-medium" title={`${deductions} points deducted`}>
                                -{deductions} pts
                              </span>
                            )}
                          </div>

                          {isZeroWithPassed && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight bg-white dark:bg-[#111C2E] p-1.5 rounded border border-slate-200 dark:border-slate-700">
                              Score reduced by deductions from severe findings.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Results Navigation Tabs (Section 9) */}
              <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("findings")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "findings"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Security Observations</span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {checks.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("advanced")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "advanced"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Transport & TLS</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Phase F2
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("frontend")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "frontend"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Website & JavaScript</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Phase F3
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("appsec")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "appsec"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>API & Endpoints</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Phase F4
                  </span>
                  {metadata?.application_security?.endpoints_count ? (
                    <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {metadata.application_security.endpoints_count}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("identity")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "identity"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Authentication & Access</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Phase F5
                  </span>
                  {metadata?.identity_security?.auth_endpoints_count ? (
                    <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {metadata.identity_security.auth_endpoints_count}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("infra")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "infra"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Infrastructure & Cloud</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    Phase F6
                  </span>
                  {(metadata?.infrastructure_security?.operational_exposure?.surfaces_count ||
                    metadata?.infrastructure_security?.storage?.length) ? (
                    <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {(metadata.infrastructure_security.operational_exposure?.surfaces_count || 0) +
                       (metadata.infrastructure_security.storage?.length || 0)}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("privacy")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "privacy"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Data Privacy & Sensitive Info</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    Phase F7
                  </span>
                  {metadata?.data_security?.summary?.total_data_findings ? (
                    <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {metadata.data_security.summary.total_data_findings}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("risk_intelligence")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "risk_intelligence"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Security Intelligence & Risk Graph</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                    Phase F8
                  </span>
                  {metadata?.risk_intelligence?.risk_chains_count ? (
                    <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300">
                      {metadata.risk_intelligence.risk_chains_count}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("pages")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === "pages"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Crawled Pages</span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {metadata?.pages?.length ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("coverage")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 ${
                    activeTab === "coverage"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Crawl Scope</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("evidence")}
                  className={`pb-3 border-b-2 transition-colors shrink-0 ${
                    activeTab === "evidence"
                      ? "border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-400"
                      : "border-transparent hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Technical Evidence</span>
                </button>
              </div>

              {/* TAB CONTENT 1: FINDINGS (SECTIONS 11 & 12) */}
              {activeTab === "findings" && (
                <div className="space-y-6">
                  {/* 1. Actionable Issues */}
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Actionable Security Improvements ({issueChecks.length})
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Ranked by severity and score impact
                      </span>
                    </div>

                    {issueChecks.length === 0 ? (
                      <div className="bg-white dark:bg-[#111C2E] p-8 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-center text-xs text-emerald-800 dark:text-emerald-300 space-y-2 shadow-2xs">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 mx-auto" />
                        <p className="font-bold text-sm">No Active Security Vulnerabilities Detected</p>
                        <p className="text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
                          All deterministic security controls and passive intelligence checks passed without actionable deficiencies.
                        </p>
                      </div>
                    ) : (
                      issueChecks.map((check) => (
                        <div key={check.id} id={`finding-${check.id}`}>
                          <FindingCard
                            check={check}
                            domain={website.normalized_domain}
                            onOpenAdvisor={(c, tab) => {
                              setSelectedAdvisorCheck(c);
                              setAdvisorInitialTab(tab || "explain");
                              setAdvisorDrawerOpen(true);
                            }}
                            onUnlock={() => setUpgradeModalOpen(true)}
                          />
                        </div>
                      ))
                    )}
                  </div>

                  {/* 2. Informational Observations (Collapsed by default, Section 12) */}
                  {infoChecks.length > 0 && (
                    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowInfoObservations(!showInfoObservations)}
                        className="w-full flex items-center justify-between text-left group"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              Informational Observations ({infoChecks.length})
                            </h4>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                              0 Score Penalty
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Architectural observations and technology detections that provide security context without being vulnerabilities.
                          </p>
                        </div>
                        <div className="text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors p-1 rounded-lg">
                          {showInfoObservations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {showInfoObservations && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                          {infoChecks.map((check) => (
                            <FindingCard
                              key={check.id}
                              check={check}
                              domain={website.normalized_domain}
                              onOpenAdvisor={(c, tab) => {
                                setSelectedAdvisorCheck(c);
                                setAdvisorInitialTab(tab || "explain");
                                setAdvisorDrawerOpen(true);
                              }}
                              onUnlock={() => setUpgradeModalOpen(true)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Passed Controls (Section 11) */}
                  {passedChecks.length > 0 && (
                    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
                      <div className="space-y-1 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Security controls working well ({passedChecks.length})
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          These security controls and defensive protocols are actively protecting your website.
                        </p>
                      </div>

                      <div className="space-y-2 pt-1">
                        {(showAllPassedControls ? passedChecks : passedChecks.slice(0, 5)).map((check) => (
                          <div
                            key={check.id}
                            className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-start sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{check.title}</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-2 hidden sm:inline font-mono">
                                  {check.check_type}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 shrink-0">
                              Verified
                            </span>
                          </div>
                        ))}
                      </div>

                      {passedChecks.length > 5 && (
                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAllPassedControls(!showAllPassedControls)}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                          >
                            <span>
                              {showAllPassedControls
                                ? "Show top 5 passed controls"
                                : `Show ${passedChecks.length - 5} more passed controls`}
                            </span>
                            {showAllPassedControls ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* TAB CONTENT: ADVANCED SECURITY CONFIGURATION (PHASE F2) */}
            {activeTab === "advanced" && (
              <div className="space-y-6">
                {!metadata?.tls && !metadata?.dns && !metadata?.email_security ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                      <Layers className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Advanced Security Architecture Analysis</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                      This scan was generated with Phase F1 foundation. Advanced TLS 1.3 key analysis, CAA records, DNSSEC, SPF/DMARC deep inspection, and semantic HSTS/CSP validation are generated on all newly initiated deep scans.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Deep Scan with Advanced Analysis
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Advanced Sub-Tabs Navigation */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {[
                        { id:"tls", label:"TLS & Certificate", icon: Key },
                        { id:"dns", label:"DNS Infrastructure", icon: Network },
                        { id:"email", label:"Email Security (SPF / DMARC)", icon: Mail },
                        { id:"hsts_csp", label:"Semantic HSTS & CSP", icon: ShieldCheck },
                        { id:"headers", label:"Headers Quality & Isolation", icon: Globe },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = advancedSubTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setAdvancedSubTab(tab.id as any)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
                              isSelected
                                ?"bg-indigo-600 text-white shadow-xs"
                                :"bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:text-white"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* SUB-PANEL 1: TLS & CERTIFICATE */}
                    {advancedSubTab === "tls" && (
                      <div className="space-y-6">
                        {metadata?.tls ? (
                          <>
                            {/* Summary KPI Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Certificate Status</div>
                                <div className="flex items-center gap-1.5 font-bold text-sm">
                                  {metadata.tls.valid ? (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                      <span className="text-emerald-700 dark:text-emerald-400">Valid & Trusted</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-red-500" />
                                      <span className="text-red-700 dark:text-red-400">Invalid / Expired</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Negotiated Protocol</div>
                                <div className="font-mono font-bold text-sm text-slate-900 flex items-center gap-1.5 dark:text-white">
                                  <span>{metadata.tls.tls_version || "Unknown"}</span>
                                  {metadata.tls.tls_version === "TLSv1.3" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                      Modern
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">ALPN Protocol</div>
                                <div className="font-mono font-bold text-sm text-slate-900 flex items-center gap-1.5 dark:text-white">
                                  <span>{metadata.tls.alpn_selected || "None"}</span>
                                  {metadata.tls.supports_http2 ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800">
                                      HTTP/2 Active
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold dark:bg-slate-800 dark:text-slate-400">
                                      HTTP/1.1
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Forward Secrecy (PFS)</div>
                                <div className="font-bold text-sm flex items-center gap-1.5">
                                  {metadata.tls.has_forward_secrecy ? (
                                    <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Enabled
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 flex items-center gap-1 dark:text-amber-400">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Disabled
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Detailed Certificate Specs */}
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                                <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                Certificate Hierarchy & Cryptographic Properties
                              </h4>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Subject (Common Name)</div>
                                  <div className="font-mono font-bold text-slate-900 break-all dark:text-white">
                                    {metadata.tls.subject || website.normalized_domain}
                                  </div>
                                </div>

                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Certificate Issuer (Authority)</div>
                                  <div className="font-semibold text-slate-900 dark:text-white">
                                    {metadata.tls.issuer || "Unknown CA"}
                                  </div>
                                </div>

                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Validity Period & Expiration</div>
                                  <div className="text-slate-800 flex items-center gap-2 flex-wrap dark:text-slate-200">
                                    <span>Expires: {metadata.tls.not_after ? new Date(metadata.tls.not_after).toLocaleDateString() :"Unknown"}</span>
                                    {metadata.tls.days_remaining !== null && metadata.tls.days_remaining !== undefined && (
                                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        metadata.tls.days_remaining < 0
                                          ?"bg-red-100 text-red-700 dark:text-red-400"
                                          : metadata.tls.days_remaining <= 14
                                          ?"bg-amber-100 text-amber-800 dark:text-amber-400"
                                          :"bg-emerald-100 text-emerald-800 dark:text-emerald-400"
                                      }`}>
                                        {metadata.tls.days_remaining < 0
                                          ? `${Math.abs(metadata.tls.days_remaining)} days expired`
                                          : `${metadata.tls.days_remaining} days remaining`}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Public Key & Signature Algorithm</div>
                                  <div className="font-mono text-slate-900 flex items-center gap-2 flex-wrap dark:text-white">
                                    <span className="font-bold">{metadata.tls.key_algorithm || "RSA"}</span>
                                    {metadata.tls.key_size && (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] font-semibold dark:text-slate-300">
                                        {metadata.tls.key_size} bits
                                      </span>
                                    )}
                                    {metadata.tls.signature_algorithm && (
                                      <span className="text-slate-500 text-[11px] dark:text-slate-400">
                                        ({metadata.tls.signature_algorithm})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 md:col-span-2 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Cipher Suite</div>
                                  <div className="font-mono font-bold text-slate-800 break-all dark:text-slate-200">
                                    {metadata.tls.cipher_name || "Unknown"}
                                    {metadata.tls.cipher_bits && ` (${metadata.tls.cipher_bits} bits)`}
                                  </div>
                                </div>

                                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 md:col-span-2 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500 font-medium dark:text-slate-400">
                                      Subject Alternative Names ({metadata.tls.san_list?.length ?? 0} SANs)
                                    </span>
                                    {metadata.tls.is_wildcard && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800">
                                        Wildcard Certificate (*.)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {metadata.tls.san_list && metadata.tls.san_list.length > 0 ? (
                                      metadata.tls.san_list.map((san, idx) => (
                                        <span
                                          key={idx}
                                          className={`px-2 py-0.5 rounded-md font-mono text-[11px] ${
                                            san.toLowerCase() === website.normalized_domain.toLowerCase()
                                              ?"bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900"
                                              :"bg-white text-slate-600 border border-slate-200 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800"
                                          }`}
                                        >
                                          {san}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-slate-400">None declared</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800">
                            No TLS data recorded for this scan.
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-PANEL 2: DNS INFRASTRUCTURE */}
                    {advancedSubTab === "dns" && (
                      <div className="space-y-6">
                        {metadata?.dns ? (
                          <>
                            {/* Summary KPI Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">IPv6 Connectivity</div>
                                <div className="font-bold text-sm flex items-center gap-1.5">
                                  {metadata.dns.has_ipv6 ? (
                                    <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ready (AAAA)
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 dark:text-slate-400">IPv4 Only</span>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Name Servers</div>
                                <div className="font-bold text-sm flex items-center gap-1.5">
                                  {metadata.dns.has_redundant_ns ? (
                                    <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {metadata.dns.ns_count} Redundant NS
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 flex items-center gap-1 dark:text-amber-400">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> {metadata.dns.ns_count} NS (Risk)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">CAA Protection</div>
                                <div className="font-bold text-sm flex items-center gap-1.5">
                                  {metadata.dns.caa_present ? (
                                    <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active ({metadata.dns.allowed_cas?.length ?? 0} CAs)
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 flex items-center gap-1 dark:text-amber-400">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Missing CAA
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">DNSSEC Signing</div>
                                <div className="font-bold text-sm flex items-center gap-1.5">
                                  {metadata.dns.dnssec_enabled ? (
                                    <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> DNSKEY Active
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 dark:text-slate-400">Not Configured</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* DNS Records Detail */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Left column: A, AAAA, NS */}
                              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                                  <Network className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                  Address & Authority Records
                                </h4>

                                <div className="space-y-3 text-xs">
                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                                    <div className="font-semibold text-slate-700 dark:text-slate-300">A Records (IPv4):</div>
                                    <div className="space-y-1">
                                      {metadata.dns.a_records && metadata.dns.a_records.length > 0 ? (
                                        metadata.dns.a_records.map((ip, idx) => (
                                          <div key={idx} className="font-mono text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200 dark:bg-[#111C2E] dark:text-slate-200 dark:border-slate-800">
                                            {ip}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-slate-400">None detected</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                                    <div className="font-semibold text-slate-700 dark:text-slate-300">AAAA Records (IPv6):</div>
                                    <div className="space-y-1">
                                      {metadata.dns.aaaa_records && metadata.dns.aaaa_records.length > 0 ? (
                                        metadata.dns.aaaa_records.map((ip, idx) => (
                                          <div key={idx} className="font-mono text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200 break-all dark:bg-[#111C2E] dark:text-slate-200 dark:border-slate-800">
                                            {ip}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-slate-400">None published (IPv4 only)</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                                    <div className="font-semibold text-slate-700 dark:text-slate-300">Authoritative Name Servers (NS):</div>
                                    <div className="space-y-1">
                                      {metadata.dns.ns_records && metadata.dns.ns_records.length > 0 ? (
                                        metadata.dns.ns_records.map((ns, idx) => (
                                          <div key={idx} className="font-mono text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200 dark:bg-[#111C2E] dark:text-slate-200 dark:border-slate-800">
                                            {ns}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-slate-400">None detected</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right column: MX & CAA */}
                              <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                                    <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    Mail Exchangers (MX)
                                  </h4>
                                  <div className="space-y-1.5 text-xs">
                                    {metadata.dns.mx_records && metadata.dns.mx_records.length > 0 ? (
                                      metadata.dns.mx_records.map((mx, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                                          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{mx.host}</span>
                                          <span className="font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] dark:bg-indigo-950/40 dark:text-indigo-400">
                                            Priority {mx.priority}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-slate-400 text-xs p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                                        No MX records published for this domain.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                      Certification Authority Authorization (CAA)
                                    </h4>
                                    {metadata.dns.caa_present ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                        Protected
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                        Unrestricted
                                      </span>
                                    )}
                                  </div>

                                  {metadata.dns.caa_present && metadata.dns.caa_records ? (
                                    <div className="space-y-2 text-xs">
                                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                        <div className="text-slate-500 font-medium dark:text-slate-400">Permitted Certificate Authorities:</div>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                          {metadata.dns.allowed_cas?.map((ca, idx) => (
                                            <span key={idx} className="px-2 py-0.5 bg-white text-indigo-700 font-mono font-bold rounded border border-indigo-200 dark:bg-[#111C2E] dark:text-indigo-400 dark:border-indigo-900">
                                              {ca}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400">
                                            <tr>
                                              <th className="py-2 px-3">Tag</th>
                                              <th className="py-2 px-3">Value</th>
                                              <th className="py-2 px-3">Flags</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {metadata.dns.caa_records.map((r, idx) => (
                                              <tr key={idx}>
                                                <td className="py-2 px-3 font-mono font-bold text-indigo-700 dark:text-indigo-400">{r.tag}</td>
                                                <td className="py-2 px-3 font-mono text-slate-800 dark:text-slate-200">{r.value}</td>
                                                <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400">{r.flags}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 text-xs text-amber-800 space-y-1 dark:text-amber-400 dark:border-amber-800">
                                      <div className="font-bold">No CAA Record Detected</div>
                                      <p className="text-[11px] text-amber-700 leading-relaxed dark:text-amber-400">
                                        Without a CAA record, any publicly trusted Certificate Authority can issue SSL certificates for this domain.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800">
                            No DNS data recorded for this scan.
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-PANEL 3: EMAIL SECURITY */}
                    {advancedSubTab === "email" && (
                      <div className="space-y-6">
                        {metadata?.email_security ? (
                          <>
                            {/* Summary KPI Badges */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">SPF Policy</div>
                                <div className="font-mono font-bold text-sm">
                                  {metadata.email_security.spf?.all_qualifier ? (
                                    <span className={
                                      metadata.email_security.spf.all_qualifier.includes("-all") || metadata.email_security.spf.all_qualifier.includes("~all")
                                        ?"text-emerald-700 dark:text-emerald-400"
                                        :"text-amber-700 dark:text-amber-400"
                                    }>
                                      {metadata.email_security.spf.all_qualifier}
                                    </span>
                                  ) : (
                                    <span className="text-red-700 dark:text-red-400">Missing</span>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">SPF DNS Lookups</div>
                                <div className="font-mono font-bold text-sm flex items-center gap-1.5">
                                  <span className={metadata.email_security.spf?.lookup_count_exceeded ?"text-red-700 dark:text-red-400" :"text-slate-900 dark:text-white"}>
                                    {metadata.email_security.spf?.lookup_count ?? 0} / 10
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-sans font-normal dark:text-slate-400">
                                    {metadata.email_security.spf?.lookup_count_exceeded ?"(Limit Breached)" :"(RFC 7208)"}
                                  </span>
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">DMARC Policy</div>
                                <div className="font-mono font-bold text-sm">
                                  {metadata.email_security.dmarc?.policy ? (
                                    <span className={
                                      metadata.email_security.dmarc.policy === "reject" || metadata.email_security.dmarc.policy === "quarantine"
                                        ?"text-emerald-700 dark:text-emerald-400"
                                        :"text-amber-700 dark:text-amber-400"
                                    }>
                                      p={metadata.email_security.dmarc.policy}
                                    </span>
                                  ) : (
                                    <span className="text-red-700 dark:text-red-400">Missing</span>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">DMARC Enforcement</div>
                                <div className="font-bold text-sm text-slate-900 dark:text-white">
                                  {metadata.email_security.dmarc?.percentage !== undefined ? (
                                    `${metadata.email_security.dmarc.percentage}% enforced`
                                  ) : (
                                    "0%"
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* SPF and DMARC Detail Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* SPF Card */}
                              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                                    <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    Sender Policy Framework (SPF)
                                  </h4>
                                  {metadata.email_security.spf?.is_present ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                      Configured
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                      Missing
                                    </span>
                                  )}
                                </div>

                                {metadata.email_security.spf?.raw ? (
                                  <div className="space-y-3 text-xs">
                                    <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto">
                                      {metadata.email_security.spf.raw}
                                    </div>

                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                        <span className="font-medium">DNS Lookup Consumption:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                          {metadata.email_security.spf.lookup_count} / 10 lookups
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            metadata.email_security.spf.lookup_count > 10
                                              ?"bg-red-500"
                                              : metadata.email_security.spf.lookup_count >= 8
                                              ?"bg-amber-500"
                                              :"bg-emerald-500"
                                          }`}
                                          style={{ width: `${Math.min(100, (metadata.email_security.spf.lookup_count / 10) * 100)}%` }}
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <div className="text-slate-500 font-medium dark:text-slate-400">Declared Mechanisms:</div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {metadata.email_security.spf.mechanisms?.map((mech, idx) => (
                                          <span key={idx} className="px-2 py-0.5 bg-slate-100 font-mono text-slate-700 rounded border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                                            {mech}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-red-50/60 rounded-xl border border-red-100 text-xs text-red-800 space-y-1 dark:text-red-400 dark:border-red-800">
                                    <div className="font-bold">No SPF Record Found</div>
                                    <p className="text-[11px] text-red-700 leading-relaxed dark:text-red-400">
                                      Anyone on the internet can forge emails claiming to come from this domain.
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* DMARC Card */}
                              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    DMARC Email Authentication
                                  </h4>
                                  {metadata.email_security.dmarc?.is_present ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                      Configured
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                      Missing
                                    </span>
                                  )}
                                </div>

                                {metadata.email_security.dmarc?.raw ? (
                                  <div className="space-y-3 text-xs">
                                    <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto">
                                      {metadata.email_security.dmarc.raw}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                                        <div className="text-slate-500 font-medium text-[11px] dark:text-slate-400">Enforcement Policy</div>
                                        <div className="font-mono font-bold text-indigo-700 text-sm mt-0.5 dark:text-indigo-400">
                                          p={metadata.email_security.dmarc.policy}
                                        </div>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                                        <div className="text-slate-500 font-medium text-[11px] dark:text-slate-400">Subdomain Policy</div>
                                        <div className="font-mono font-bold text-slate-800 text-sm mt-0.5 dark:text-slate-200">
                                          sp={metadata.email_security.dmarc.subdomain_policy || metadata.email_security.dmarc.policy}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                      <div className="text-slate-500 font-medium dark:text-slate-400">Aggregate Reporting Mailboxes (rua):</div>
                                      <div className="space-y-1 pt-1 font-mono text-[11px] text-slate-800 break-all dark:text-slate-200">
                                        {metadata.email_security.dmarc.rua && metadata.email_security.dmarc.rua.length > 0 ? (
                                          metadata.email_security.dmarc.rua.map((addr, idx) => (
                                            <div key={idx} className="bg-white p-1.5 rounded border border-slate-200 dark:bg-[#111C2E] dark:border-slate-800">
                                              {addr}
                                            </div>
                                          ))
                                        ) : (
                                          <span className="text-amber-600">None configured (No feedback reports received)</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-red-50/60 rounded-xl border border-red-100 text-xs text-red-800 space-y-1 dark:text-red-400 dark:border-red-800">
                                    <div className="font-bold">No DMARC Record Found</div>
                                    <p className="text-[11px] text-red-700 leading-relaxed dark:text-red-400">
                                      Mail servers have no instructions on how to handle SPF or DKIM failures for this domain.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800">
                            No email security data recorded for this scan.
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-PANEL 4: SEMANTIC HSTS & CSP */}
                    {advancedSubTab === "hsts_csp" && (
                      <div className="space-y-6">
                        {/* HSTS Semantic Section */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              Strict-Transport-Security (HSTS) Semantic Analysis
                            </h4>
                            {metadata?.hsts?.status === "strong" ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                Strong Policy
                              </span>
                            ) : metadata?.hsts?.status === "acceptable" ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800">
                                Acceptable
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                Sub-optimal / Missing
                              </span>
                            )}
                          </div>

                          {metadata?.hsts?.is_present ? (
                            <div className="space-y-4 text-xs">
                              {metadata.hsts.raw_header && (
                                <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto">
                                  Strict-Transport-Security: {metadata.hsts.raw_header}
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">max-age Duration</div>
                                  <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                    {metadata.hsts.max_age_seconds !== null && metadata.hsts.max_age_seconds !== undefined
                                      ? `${metadata.hsts.max_age_seconds.toLocaleString()}s (${Math.round(metadata.hsts.max_age_seconds / 86400)} days)`
                                      :"None"}
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">includeSubDomains</div>
                                  <div className="font-bold text-sm">
                                    {metadata.hsts.includes_subdomains ? (
                                      <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 flex items-center gap-1 dark:text-amber-400">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Missing
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Preload Ready</div>
                                  <div className="font-bold text-sm">
                                    {metadata.hsts.preload ? (
                                      <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Eligible
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 dark:text-slate-400">Not Flagged</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-100 text-xs text-amber-800 dark:text-amber-400 dark:border-amber-800">
                              HSTS header was not detected on any analyzed pages.
                            </div>
                          )}
                        </div>

                        {/* CSP Semantic Section */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              Content Security Policy (CSP) Semantic Analysis
                            </h4>
                            {metadata?.csp?.status === "robust" ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                Robust Policy
                              </span>
                            ) : metadata?.csp?.is_present ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                Permissive Directives
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                Missing
                              </span>
                            )}
                          </div>

                          {metadata?.csp?.is_present ? (
                            <div className="space-y-4 text-xs">
                              {/* Flags Row */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">unsafe-inline</div>
                                  <div className="font-bold text-sm">
                                    {metadata.csp.has_unsafe_inline ? (
                                      <span className="text-amber-700 flex items-center gap-1 dark:text-amber-400">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Allowed (Risk)
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Restricted
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">unsafe-eval</div>
                                  <div className="font-bold text-sm">
                                    {metadata.csp.has_unsafe_eval ? (
                                      <span className="text-amber-700 flex items-center gap-1 dark:text-amber-400">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Allowed (Risk)
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Restricted
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Wildcard Sources (*)</div>
                                  <div className="font-bold text-sm">
                                    {metadata.csp.has_wildcards ? (
                                      <span className="text-amber-700 flex items-center gap-1 dark:text-amber-400">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Permissive
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Strict
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-slate-500 font-medium dark:text-slate-400">Nonces / Hashes</div>
                                  <div className="font-bold text-sm">
                                    {metadata.csp.has_nonces_or_hashes ? (
                                      <span className="text-emerald-700 flex items-center gap-1 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 dark:text-slate-400">None detected</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Directives Table */}
                              {metadata.csp.directives && Object.keys(metadata.csp.directives).length > 0 && (
                                <div className="overflow-x-auto border border-slate-200/80 rounded-xl dark:border-slate-800">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                      <tr>
                                        <th className="py-2.5 px-4 w-40">Directive</th>
                                        <th className="py-2.5 px-4">Sources</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {Object.entries(metadata.csp.directives).map(([dirName, sources]: [string, any]) => (
                                        <tr key={dirName} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                          <td className="py-2.5 px-4 font-mono font-bold text-indigo-700 dark:text-indigo-400">{dirName}</td>
                                          <td className="py-2.5 px-4 font-mono text-slate-800 break-all dark:text-slate-200">
                                            {Array.isArray(sources) && sources.length > 0 ? (
                                              sources.map((s: string, sIdx: number) => (
                                                <span
                                                  key={sIdx}
                                                  className={`inline-block mr-1.5 mb-1 px-1.5 py-0.5 rounded text-[11px] ${
                                                    s.includes("unsafe") || s === "*"
                                                      ?"bg-amber-50 text-amber-800 border border-amber-200 font-bold dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                                      :"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                                  }`}
                                                >
                                                  {s}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-slate-400">Empty</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 bg-red-50/60 rounded-xl border border-red-100 text-xs text-red-800 dark:text-red-400 dark:border-red-800">
                              Content Security Policy is not defined on any audited page.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SUB-PANEL 5: HEADERS QUALITY & ISOLATION */}
                    {advancedSubTab === "headers" && (
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                          <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          Security Headers Quality & Cross-Origin Isolation Policies
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Referrer Policy */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">Referrer-Policy:</span>
                              {metadata?.security_headers_quality?.referrer_policy_status === "safe" ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Safe
                                </span>
                              ) : metadata?.security_headers_quality?.referrer_policy_status === "insecure" ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                  Insecure (Leaking URLs)
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-700 font-bold dark:text-slate-300">
                              {metadata?.security_headers_quality?.referrer_policy || "Not declared"}
                            </div>
                          </div>

                          {/* Permissions Policy */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">Permissions-Policy (Feature Policy):</span>
                            <div className="space-y-1">
                              {metadata?.security_headers_quality?.permissions_policy_apis_restricted &&
                              metadata.security_headers_quality.permissions_policy_apis_restricted.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {metadata.security_headers_quality.permissions_policy_apis_restricted.map((api, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-mono text-[11px] rounded border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                      {api}=()
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-slate-400">No hardware APIs restricted</div>
                              )}
                            </div>
                          </div>

                          {/* Cross-Origin Opener Policy (COOP) */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">Cross-Origin-Opener-Policy (COOP):</span>
                              {metadata?.security_headers_quality?.coop ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Configured
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Not Set
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-700 font-bold dark:text-slate-300">
                              {metadata?.security_headers_quality?.coop || "None"}
                            </div>
                          </div>

                          {/* Cross-Origin Resource Policy (CORP) */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">Cross-Origin-Resource-Policy (CORP):</span>
                              {metadata?.security_headers_quality?.corp ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Configured
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Not Set
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-700 font-bold dark:text-slate-300">
                              {metadata?.security_headers_quality?.corp || "None"}
                            </div>
                          </div>

                          {/* Cross-Origin Embedder Policy (COEP) */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">Cross-Origin-Embedder-Policy (COEP):</span>
                              {metadata?.security_headers_quality?.coep ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Active
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Not Set
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-700 font-bold dark:text-slate-300">
                              {metadata?.security_headers_quality?.coep || "None"}
                            </div>
                          </div>

                          {/* X-Content-Type-Options */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">X-Content-Type-Options:</span>
                              {metadata?.security_headers_quality?.x_content_type_options?.toLowerCase() === "nosniff" ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Valid nosniff
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                  Missing / Invalid
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-slate-700 font-bold dark:text-slate-300">
                              {metadata?.security_headers_quality?.x_content_type_options || "None"}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB CONTENT: FRONTEND, JAVASCRIPT & CLIENT-SIDE EXPOSURE (PHASE F3) */}
            {activeTab === "frontend" && (
              <div className="space-y-6">
                {!metadata?.frontend_security ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100 dark:bg-purple-950/40">
                      <Code className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Frontend, JavaScript & Client-Side Exposure Intelligence</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                      This scan was generated with an earlier scan version. Phase F3 adds client-side JavaScript inventory, passive API route discovery, credential exposure scanning, third-party SRI auditing, Web Storage token checks, dangerous DOM sink detection, and deep source map code inspection.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Deep Scan with Frontend Intelligence
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Frontend Sub-Tabs Navigation */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {[
                        { id:"overview", label:"Overview & Exposure", icon: Sparkles },
                        { id:"assets", label:"JS Assets & SRI", icon: FileCode },
                        { id:"endpoints", label:"Discovered API Surface", icon: Network },
                        { id:"secrets", label:"Secrets & Credentials", icon: Lock },
                        { id:"third_party", label:"Third-Party & Supply Chain", icon: Globe },
                        { id:"storage_dom", label:"Storage & DOM Sinks", icon: Code },
                        { id:"sourcemaps", label:"Deep Source Maps", icon: Layers },
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = frontendSubTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFrontendSubTab(tab.id as any)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
                              isSelected
                                ?"bg-purple-600 text-white shadow-xs"
                                :"bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:text-white"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* SUB-PANEL 1: OVERVIEW */}
                    {frontendSubTab === "overview" && (
                      <div className="space-y-6">
                        {/* Primary KPI Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">JavaScript Assets</div>
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.javascript?.total_scripts ?? 0}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {metadata.frontend_security.javascript?.first_party_scripts ?? 0} 1st-party • {metadata.frontend_security.javascript?.third_party_scripts ?? 0} external
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Discovered Endpoints</div>
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.endpoints?.total_discovered ?? 0}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {Object.keys(metadata.frontend_security.endpoints?.categories || {}).length} route categories
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Exposed Credentials</div>
                            <div className="flex items-center gap-1.5 font-bold text-sm">
                              {(metadata.frontend_security.secrets?.secrets_detected_count ?? 0) === 0 ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-emerald-700 font-mono dark:text-emerald-400">0 Detected</span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                  <span className="text-red-700 font-mono dark:text-red-400">
                                    {metadata.frontend_security.secrets?.secrets_detected_count} Found
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="text-[10px] text-purple-600 font-semibold">
                              Protected with Auto-Masking
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Supply Chain SRI</div>
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.javascript?.sri_enforced_count ?? 0}
                              <span className="text-xs text-slate-400 font-normal">
                                {" "}/ {metadata.frontend_security.javascript?.cdn_scripts_count ?? 0} CDN
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {(metadata.frontend_security.javascript?.cdn_scripts_missing_sri ?? 0) === 0 ? (
                                <span className="text-emerald-600 font-medium">All CDNs Verified</span>
                              ) : (
                                <span className="text-amber-600 font-medium">
                                  {metadata.frontend_security.javascript?.cdn_scripts_missing_sri} missing integrity
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Secondary Status Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Client Storage Status */}
                          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-2 dark:text-slate-200">
                                <Code className="w-4 h-4 text-purple-600" />
                                Client-Side Storage Security
                              </span>
                              {metadata.frontend_security.storage?.has_auth_tokens ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                  Auth in Web Storage
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Clean Storage
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {metadata.frontend_security.storage?.has_auth_tokens
                                ?"Detected patterns indicating session or authentication tokens are written to localStorage/sessionStorage, which are vulnerable to XSS exfiltration."
                                :"No hardcoded authentication tokens, API keys, or JWT sessions detected in client-side Web Storage calls."}
                            </p>
                          </div>

                          {/* Source Map & Code Disclosure Status */}
                          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-2 dark:text-slate-200">
                                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                Source Map & Build Disclosure
                              </span>
                              {metadata.frontend_security.source_maps?.has_embedded_source_code ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                  Embedded Code Exposed
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  No Source Leaks
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {metadata.frontend_security.source_maps?.has_embedded_source_code
                                ? `Production source maps disclose full unminified source code across ${metadata.frontend_security.source_maps?.embedded_files_count} original files.`
                                :"Public source map inspection confirmed unminified source code is not exposed to web visitors."}
                            </p>
                          </div>
                        </div>

                        {/* Operational Categories Surface Breakdown */}
                        {metadata.frontend_security.endpoints?.categories && Object.keys(metadata.frontend_security.endpoints.categories).length > 0 && (
                          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-200">
                              Discovered Endpoint Surface by Operational Category
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(metadata.frontend_security.endpoints.categories).map(([cat, cnt]) => {
                                const colorClass =
                                  cat === "AUTH"
                                    ?"bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900"
                                    : cat === "ADMIN"
                                    ?"bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                                    : cat === "GRAPHQL"
                                    ?"bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800"
                                    : cat === "WEBSOCKET"
                                    ?"bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                    : cat === "PAYMENT"
                                    ?"bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                    :"bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800";
                                return (
                                  <div
                                    key={cat}
                                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${colorClass}`}
                                  >
                                    <span>{cat}</span>
                                    <span className="font-mono px-1.5 py-0.2 rounded-full bg-white/70 dark:bg-slate-900/70 text-[10px] dark:text-slate-300">
                                      {cnt}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUB-PANEL 2: JS ASSETS & SRI */}
                    {frontendSubTab === "assets" && (
                      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 dark:border-slate-800">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              JavaScript Asset Inventory ({metadata.frontend_security.javascript?.total_scripts ?? 0})
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Analyzed {metadata.frontend_security.javascript?.scripts_analyzed ?? 0} script bundles ({Math.round((metadata.frontend_security.javascript?.total_bytes_analyzed ?? 0) / 1024)} KB) and {metadata.frontend_security.javascript?.inline_scripts_analyzed ?? 0} inline scripts.
                            </p>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={frontendSearch}
                              onChange={(e) => setFrontendSearch(e.target.value)}
                              placeholder="Filter by script URL or host..."
                              className="px-3 py-1.5 pl-8 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-purple-500 w-56 dark:border-slate-800"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                              <tr>
                                <th className="py-3 px-5">Script URL / Host</th>
                                <th className="py-3 px-3">Origin</th>
                                <th className="py-3 px-3">Category</th>
                                <th className="py-3 px-3">Size</th>
                                <th className="py-3 px-3">SRI Protection</th>
                                <th className="py-3 px-3">Crossorigin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                              {(metadata.frontend_security.javascript?.scripts || [])
                                .filter((s) => !frontendSearch || s.url.toLowerCase().includes(frontendSearch.toLowerCase()) || s.host.toLowerCase().includes(frontendSearch.toLowerCase()))
                                .map((s, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-2.5 px-5 max-w-sm truncate text-slate-800 font-semibold dark:text-slate-200" title={s.url}>
                                      {s.url}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {s.is_external ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                          External
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                                          1st-Party
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 capitalize font-sans text-slate-600 dark:text-slate-400">
                                      {s.third_party_category.replace("_", " ")}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                      {s.bytes ? `${Math.round(s.bytes / 1024)} KB` :"—"}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {s.has_sri ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                          SRI Enforced
                                        </span>
                                      ) : s.is_cdn ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                          Missing SRI
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400">None</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                      {s.crossorigin || "—"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SUB-PANEL 3: DISCOVERED API SURFACE */}
                    {frontendSubTab === "endpoints" && (
                      <div className="space-y-4">
                        {/* Summary & Alerts */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Client Routes</div>
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.endpoints?.total_discovered ?? 0}
                            </div>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Privileged Admin Paths</div>
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.endpoints?.admin_routes_count ?? 0}
                            </div>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Cleartext WebSockets</div>
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {(metadata.frontend_security.endpoints?.insecure_websocket_count ?? 0) > 0 ? (
                                <span className="text-red-600">
                                  {metadata.frontend_security.endpoints?.insecure_websocket_count} Insecure (ws://)
                                </span>
                              ) : (
                                <span className="text-emerald-600">0 Insecure</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Insecure WebSocket Alert */}
                        {(metadata.frontend_security.endpoints?.insecure_websocket_count ?? 0) > 0 && (
                          <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl flex items-start gap-3 dark:border-red-800">
                            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div className="text-xs space-y-1">
                              <div className="font-bold text-red-900">Cleartext WebSocket Protocol Detected (ws://)</div>
                              <p className="text-red-700 dark:text-red-400">
                                Client-side scripts reference unencrypted WebSocket endpoints (ws://). WebSocket traffic over ws:// is not encrypted with TLS, leaving message frames vulnerable to passive eavesdropping and man-in-the-middle manipulation.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Endpoints Table */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="p-4 border-b border-slate-100 flex items-center justify-between dark:border-slate-800">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Catalogued Endpoints</h4>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Passive Extraction</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-mono">
                              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-sans dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-3 px-5">Discovered Endpoint</th>
                                  <th className="py-3 px-3">Category</th>
                                  <th className="py-3 px-3">Type</th>
                                  <th className="py-3 px-3">Discovered In</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(metadata.frontend_security.endpoints?.items || []).map((ep, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-2.5 px-5 font-bold text-slate-800 dark:text-slate-200">
                                      {ep.endpoint}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          ep.category === "AUTH"
                                            ?"bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900"
                                            : ep.category === "ADMIN"
                                            ?"bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                                            : ep.category === "GRAPHQL"
                                            ?"bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800"
                                            : ep.category === "WEBSOCKET"
                                            ?"bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                            : ep.category === "PAYMENT"
                                            ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                            :"bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800"
                                        }`}
                                      >
                                        {ep.category}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 font-sans dark:text-slate-400">
                                      {ep.type}
                                    </td>
                                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-400" title={ep.source}>
                                      {ep.source}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-PANEL 4: SECRETS & CREDENTIALS */}
                    {frontendSubTab === "secrets" && (
                      <div className="space-y-6">
                        {/* Security Masking Guarantee Banner */}
                        <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl flex items-start gap-3 dark:border-purple-800">
                          <Lock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                          <div className="text-xs space-y-1">
                            <div className="font-bold text-purple-900">Zero-Leak Safety Architecture</div>
                            <p className="text-purple-700 dark:text-purple-400">
                              SiteSecura automatically redacts and masks all discovered credentials with cryptographic asterisks. Under no circumstances are raw unmasked secrets stored in the database, displayed in the dashboard, or transmitted to AI advisors.
                            </p>
                          </div>
                        </div>

                        {/* Secret Exposure List */}
                        {(metadata.frontend_security.secrets?.secrets_detected_count ?? 0) === 0 ? (
                          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 text-center space-y-2 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800">
                              <Check className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Hardcoded Credentials Detected</h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                              Audited public bundles and inline scripts for AWS keys, Google API keys, Stripe secret keys, Slack tokens, GitHub tokens, JWTs, and private keys. No credentials were identified.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-200">
                              Detected Secret Exposures ({metadata.frontend_security.secrets?.secrets_detected_count})
                            </h4>
                            <div className="space-y-3">
                              {(metadata.frontend_security.secrets?.items || []).map((sec, idx) => (
                                <div key={idx} className="bg-white p-5 rounded-xl border border-red-200 shadow-2xs space-y-3 dark:bg-[#111C2E] dark:border-red-800">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded uppercase dark:text-red-400">
                                        {sec.severity}
                                      </span>
                                      <span className="font-bold text-sm text-slate-900 dark:text-white">{sec.secret_type}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                      Confidence: <strong className="text-slate-800 dark:text-slate-200">{sec.confidence}</strong>
                                    </span>
                                  </div>

                                  <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs flex items-center justify-between">
                                    <span>{sec.masked_value}</span>
                                    <span className="text-[10px] text-slate-400 font-sans uppercase">Masked</span>
                                  </div>

                                  <div className="text-xs text-slate-600 space-y-1 dark:text-slate-400">
                                    <div><strong>Found in:</strong> {sec.sources.join(", ")}</div>
                                    <p className="text-slate-500 text-[11px] dark:text-slate-400">
                                      Remediation: Immediately revoke and rotate this credential in your provider console. Move sensitive logic to backend server-side API routes.
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Internal IP & Configuration Exposure */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Development & Internal Network Disclosures
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Internal Network / Localhost IPs:</span>
                              {(metadata.frontend_security.configuration?.internal_ips && metadata.frontend_security.configuration.internal_ips.length > 0) ? (
                                <div className="space-y-1">
                                  {metadata.frontend_security.configuration.internal_ips.map((ip, idx) => (
                                    <div key={idx} className="p-2 bg-slate-50 font-mono text-slate-800 rounded border border-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-800">
                                      {ip}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-slate-400">No internal RFC 1918 or localhost IPs detected.</div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Sensitive Framework Environment Variables:</span>
                              {(metadata.frontend_security.configuration?.sensitive_envs && metadata.frontend_security.configuration.sensitive_envs.length > 0) ? (
                                <div className="space-y-1">
                                  {metadata.frontend_security.configuration.sensitive_envs.map((envVar, idx) => (
                                    <div key={idx} className="p-2 bg-amber-50 font-mono text-amber-800 rounded border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                      {envVar}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-slate-400">No sensitive public framework environment variables detected.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-PANEL 5: THIRD-PARTY & SUPPLY CHAIN */}
                    {frontendSubTab === "third_party" && (
                      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between dark:border-slate-800">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Third-Party Dependencies & Supply Chain Risks
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              External CDN dependencies require Subresource Integrity (SRI) to prevent malicious code injection if a CDN provider is breached.
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                            {metadata.frontend_security.third_party?.total_external_hosts ?? 0} External Domains
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                              <tr>
                                <th className="py-3 px-5">Provider Host</th>
                                <th className="py-3 px-3">Classification</th>
                                <th className="py-3 px-3">Script Count</th>
                                <th className="py-3 px-3">CDN Service</th>
                                <th className="py-3 px-3">SRI Enforced</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                              {(metadata.frontend_security.third_party?.providers || []).map((prov, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="py-2.5 px-5 font-bold text-slate-800 dark:text-slate-200">
                                    {prov.host}
                                  </td>
                                  <td className="py-2.5 px-3 capitalize font-sans text-slate-600 dark:text-slate-400">
                                    {prov.category.replace("_", " ")}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                    {prov.script_count}
                                  </td>
                                  <td className="py-2.5 px-3 font-sans">
                                    {prov.is_cdn ? (
                                      <span className="text-indigo-600 font-semibold dark:text-indigo-400">Public CDN</span>
                                    ) : (
                                      <span className="text-slate-400">Direct Host</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {prov.has_sri ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                        Enforced
                                      </span>
                                    ) : prov.is_cdn ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                        Missing SRI
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">Optional</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* SUB-PANEL 6: STORAGE & DOM SINKS */}
                    {frontendSubTab === "storage_dom" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Web Storage */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                            <Code className="w-4 h-4 text-purple-600" />
                            Client-Side Storage Keys
                          </h4>
                          <div className="space-y-2">
                            {(metadata.frontend_security.storage?.sample_items && metadata.frontend_security.storage.sample_items.length > 0) ? (
                              <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                                {metadata.frontend_security.storage.sample_items.map((item, idx) => (
                                  <div key={idx} className="py-2 flex items-center justify-between font-mono">
                                    <span className="text-slate-800 font-bold dark:text-slate-200">{item.key}</span>
                                    {item.is_auth_related ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                        Auth / Token Key
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                                        UI / Preference
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">No Web Storage keys accessed in analyzed bundles.</div>
                            )}
                          </div>
                        </div>

                        {/* DOM Execution Sinks */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                            <AlertCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            DOM Sinks & Cross-Window Messaging
                          </h4>
                          <div className="space-y-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between dark:bg-slate-800/40 dark:border-slate-800">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">postMessage Origin Verification:</span>
                              {metadata.frontend_security.dom_security?.postmessage_missing_origin ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                  Missing event.origin Check
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Validated / None
                                </span>
                              )}
                            </div>

                            <div className="space-y-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Detected Dynamic Sinks:</span>
                              {(metadata.frontend_security.dom_security?.sinks && metadata.frontend_security.dom_security.sinks.length > 0) ? (
                                <div className="space-y-2">
                                  {metadata.frontend_security.dom_security.sinks.map((sink, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                      <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-slate-900 dark:text-white">{sink.sink}</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 dark:text-slate-300">
                                          {sink.count} call site(s)
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{sink.description}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-slate-400">No high-risk dynamic execution sinks (eval, document.write) detected.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-PANEL 7: DEEP SOURCE MAPS */}
                    {frontendSubTab === "sourcemaps" && (
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Deep Source Map (.map) Inspection
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Audited production JavaScript bundles for publicly exposed source maps disclosing unminified code or internal build environments.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.source_maps?.maps_checked ?? 0}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Maps Checked</div>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.source_maps?.exposed_maps_count ?? 0}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Exposed Maps</div>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                              {metadata.frontend_security.source_maps?.embedded_files_count ?? 0}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Embedded Source Files</div>
                          </div>
                        </div>

                        {/* Internal Paths */}
                        {metadata.frontend_security.source_maps?.internal_paths && metadata.frontend_security.source_maps.internal_paths.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Disclosed Build Environment Paths:</span>
                            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs space-y-1 overflow-x-auto">
                              {metadata.frontend_security.source_maps.internal_paths.map((p, idx) => (
                                <div key={idx}>{p}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sample Source Files */}
                        {metadata.frontend_security.source_maps?.sample_sources && metadata.frontend_security.source_maps.sample_sources.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Original Source Files Identified:</span>
                            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                              {metadata.frontend_security.source_maps.sample_sources.map((s, idx) => (
                                <span key={idx} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}


            {/* TAB CONTENT: APPLICATION, API & HTTP SECURITY (PHASE F4) */}
            {activeTab === "appsec" && (() => {
              const appsec = metadata?.application_security;
              if (!appsec) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 dark:bg-emerald-950/40">
                      <Network className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Application, API & HTTP Security Intelligence</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                      This scan was generated with an earlier scan version. Phase F4 adds passive API endpoint discovery, Cross-Origin Resource Sharing (CORS) security validation, verbose error & stack trace exposure detection, API documentation discovery (OpenAPI/Swagger), dangerous HTTP methods, directory indexing, and sensitive field masking.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Deep Scan with Application & API Intelligence
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Sub-tab Navigation */}
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-semibold text-slate-600 dark:text-slate-400 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("overview")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "overview"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Overview & Surface</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("api")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "api"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span>API Surface</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                        {appsec.endpoints_count || 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("cors")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "cors"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>CORS Policies</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                        {appsec.cors?.configurations_count || 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("errors")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "errors"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Errors & Traces</span>
                      {((appsec.errors?.stack_traces_count || 0) +
                        (appsec.errors?.database_errors_count || 0) +
                        (appsec.errors?.debug_pages_count || 0)) > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-600 text-white">
                          {(appsec.errors?.stack_traces_count || 0) +
                            (appsec.errors?.database_errors_count || 0) +
                            (appsec.errors?.debug_pages_count || 0)}
                        </span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("docs")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "docs"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>API Docs & Schemas</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                        {appsec.api_docs?.discovered_count || 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("http")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "http"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Server className="w-3.5 h-3.5" />
                      <span>HTTP & Server Headers</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("auth")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "auth"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Auth & Signals</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                        {appsec.authentication?.auth_endpoints_count || 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAppsecSubTab("exposure")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        appsecSubTab === "exposure"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <FolderSearch className="w-3.5 h-3.5" />
                      <span>Application Exposure</span>
                    </button>
                  </div>

                  {/* SUB-PANEL 1: OVERVIEW & SURFACE */}
                  {appsecSubTab === "overview" && (
                    <div className="space-y-6">
                      {/* KPI Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            API Endpoints
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {appsec.endpoints_count || 0}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {appsec.requests_executed || 0} requests executed
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            CORS Audited
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {appsec.cors?.configurations_count || 0}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {appsec.cors?.evaluations?.filter(e => e.issues && e.issues.length > 0 && !e.issues.includes("secure")).length || 0} policy warnings
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Error Disclosures
                          </div>
                          <div className={`text-xl font-bold font-mono ${
                            ((appsec.errors?.stack_traces_count || 0) +
                             (appsec.errors?.database_errors_count || 0) +
                             (appsec.errors?.debug_pages_count || 0)) > 0
                              ?"text-red-600"
                              :"text-emerald-600"
                          }`}>
                            {(appsec.errors?.stack_traces_count || 0) +
                             (appsec.errors?.database_errors_count || 0) +
                             (appsec.errors?.debug_pages_count || 0)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {appsec.errors?.internal_paths_count || 0} internal paths
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            API Docs / Specs
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {appsec.api_docs?.discovered_count || 0}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            OpenAPI / Swagger
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Cache Observations
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {appsec.cache?.observations_count || 0}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {appsec.cache?.sensitive_cached_count || 0} sensitive cached
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            security.txt
                          </div>
                          <div className={`text-xl font-bold font-mono ${
                            appsec.security_txt?.is_present ?"text-emerald-600" :"text-slate-500 dark:text-slate-400"
                          }`}>
                            {appsec.security_txt?.is_present ?"Present" :"Missing"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            RFC 9116 security policy
                          </div>
                        </div>
                      </div>

                      {/* Overview Highlights */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 dark:text-slate-400">
                            <Server className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                            Web Server & Infrastructure Exposure
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">Server Header:</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {appsec.server_disclosure?.raw_server || "Not Disclosed (Clean)"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">Server Software:</span>
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                {appsec.server_disclosure?.server_software || "Unknown / Hidden"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">Version Precision:</span>
                              {appsec.server_disclosure?.has_detailed_version ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                  Detailed ({appsec.server_disclosure.server_version})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Minimal / Concealed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">Dangerous HTTP Methods:</span>
                              {appsec.http_methods?.dangerous_methods_observed ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                  TRACE / TRACK Allowed
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  TRACE Disabled
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 dark:text-slate-400">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            Security Policy & Controls
                          </h4>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">security.txt Discovery:</span>
                              {appsec.security_txt?.is_present ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Present (RFC 9116)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 dark:text-slate-300">
                                  Not Declared
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">Rate Limiting Headers:</span>
                              {appsec.rate_limiting?.has_standard_headers ||
                               appsec.rate_limiting?.has_legacy_headers ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Active Headers Observed
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700 dark:text-slate-300">
                                  No Standard Rate Headers
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">GraphQL Introspection:</span>
                              <span className="font-mono font-bold text-slate-800 capitalize dark:text-slate-200">
                                {appsec.graphql?.introspection_status || "Not Found"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                              <span className="text-slate-600 font-medium dark:text-slate-400">Open Directory Indexing:</span>
                              {(appsec.directory_exposure?.listings_count || 0) > 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                  {appsec.directory_exposure?.listings_count} Exposed Directory
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                  Disabled / Protected
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 2: API SURFACE */}
                  {appsecSubTab === "api" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5 dark:bg-[#111C2E] dark:border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Discovered API Surface & Endpoints
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Passive analysis of API routes discovered across HTML pages, script bundles, and well-known route probes.
                          </p>
                        </div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search endpoints..."
                            value={appsecSearch}
                            onChange={(e) => setAppsecSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-slate-200/80 rounded-xl dark:border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            <tr>
                              <th className="py-2.5 px-3 w-20">Method</th>
                              <th className="py-2.5 px-4">Endpoint URL</th>
                              <th className="py-2.5 px-3">Category</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Content Type</th>
                              <th className="py-2.5 px-3">Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {(appsec.endpoints || [])
                              .filter((ep) => {
                                if (!appsecSearch) return true;
                                const q = appsecSearch.toLowerCase();
                                return (
                                  ep.url.toLowerCase().includes(q) ||
                                  ep.method.toLowerCase().includes(q) ||
                                  ep.category.toLowerCase().includes(q)
                                );
                              })
                              .map((ep, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/50">
                                  <td className="py-2.5 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      ep.method === "GET"
                                        ?"bg-blue-50 text-blue-700 border border-blue-200"
                                        : ep.method === "POST"
                                        ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                        : ep.method === "OPTIONS"
                                        ?"bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800"
                                        :"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    }`}>
                                      {ep.method}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 font-mono text-slate-800 break-all dark:text-slate-200">
                                    {ep.url}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      ep.category === "AUTH"
                                        ?"bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                        : ep.category === "ADMIN"
                                        ?"bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                        : ep.category === "GRAPHQL"
                                        ?"bg-pink-50 text-pink-800 border border-pink-200"
                                        :"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    }`}>
                                      {ep.category}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono font-semibold">
                                    {ep.status_code ? (
                                      <span className={
                                        ep.status_code < 300
                                          ?"text-emerald-700 dark:text-emerald-400"
                                          : ep.status_code < 400
                                          ?"text-blue-700"
                                          : ep.status_code < 500
                                          ?"text-amber-700 dark:text-amber-400"
                                          :"text-red-700 dark:text-red-400"
                                      }>
                                        {ep.status_code}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] dark:text-slate-400">
                                    {ep.content_type ? ep.content_type.split(";")[0] :"-"}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 text-[11px] dark:text-slate-400">
                                    {ep.source || "Discovered"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 3: CORS SECURITY */}
                  {appsecSubTab === "cors" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Cross-Origin Resource Sharing (CORS) Security
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Evaluation of Access-Control-Allow-* headers for credentialed wildcard leaks, arbitrary origin reflection, and null origin permissions.
                        </p>
                      </div>

                      {(!appsec.cors?.evaluations || appsec.cors.evaluations.length === 0) ? (
                        <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                          No active CORS headers detected on probed endpoints. By default, browsers enforce strict Same-Origin Policy (SOP).
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {appsec.cors.evaluations.map((evalItem, idx) => {
                            const hasIssues = evalItem.issues && evalItem.issues.length > 0 && !evalItem.issues.includes("secure");
                            return (
                              <div key={idx} className={`p-4 rounded-xl border space-y-3 ${
                                evalItem.wildcard_with_credentials || evalItem.reflects_origin
                                  ?"bg-red-50/50 border-red-200 dark:bg-red-950/40 dark:border-red-800"
                                  : hasIssues
                                  ?"bg-amber-50/50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"
                                  :"bg-slate-50/70 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800"
                              }`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="font-mono text-xs font-bold text-slate-900 break-all dark:text-white">
                                    {evalItem.url}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {evalItem.wildcard_with_credentials && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white">
                                        Wildcard + Credentials Leak
                                      </span>
                                    )}
                                    {evalItem.reflects_origin && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 dark:text-red-400 dark:border-red-800">
                                        Origin Reflection
                                      </span>
                                    )}
                                    {evalItem.is_null_origin && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:text-amber-400 dark:border-amber-800">
                                        Null Origin Allowed
                                      </span>
                                    )}
                                    {evalItem.is_wildcard && !evalItem.allow_credentials && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                        Public Wildcard (*)
                                      </span>
                                    )}
                                    {!hasIssues && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
                                        Strict / Safe
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                  <div className="p-2 bg-white rounded border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                    <div className="text-[10px] text-slate-400 font-semibold">Allow-Origin</div>
                                    <div className="font-mono text-slate-800 font-bold truncate dark:text-slate-200">
                                      {evalItem.allow_origin || "None"}
                                    </div>
                                  </div>
                                  <div className="p-2 bg-white rounded border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                    <div className="text-[10px] text-slate-400 font-semibold">Allow-Credentials</div>
                                    <div className="font-mono text-slate-800 font-bold dark:text-slate-200">
                                      {evalItem.allow_credentials ?"true" :"false"}
                                    </div>
                                  </div>
                                  <div className="p-2 bg-white rounded border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                    <div className="text-[10px] text-slate-400 font-semibold">Allow-Methods</div>
                                    <div className="font-mono text-slate-800 truncate dark:text-slate-200">
                                      {evalItem.allow_methods?.length ? evalItem.allow_methods.join(", ") :"Any"}
                                    </div>
                                  </div>
                                  <div className="p-2 bg-white rounded border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                    <div className="text-[10px] text-slate-400 font-semibold">Max-Age</div>
                                    <div className="font-mono text-slate-800 dark:text-slate-200">
                                      {evalItem.max_age ? `${evalItem.max_age}s` :"Default"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-PANEL 4: ERRORS & TRACES */}
                  {appsecSubTab === "errors" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Error & Debug Information Disclosure
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Detection of unhandled exceptions, database error codes, framework debug screens, and internal filesystem paths in HTTP responses.
                        </p>
                      </div>

                      {((appsec.errors?.stack_traces_count || 0) +
                        (appsec.errors?.database_errors_count || 0) +
                        (appsec.errors?.debug_pages_count || 0) +
                        (appsec.errors?.internal_paths_count || 0)) === 0 ? (
                        <div className="p-6 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold">Zero debug disclosures detected.</span> No stack traces, database error messages, or internal server paths were found in audited responses.
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                              <div className="text-lg font-bold font-mono text-red-600">
                                {appsec.errors?.stack_traces_count || 0}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Stack Traces</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                              <div className="text-lg font-bold font-mono text-red-600">
                                {appsec.errors?.database_errors_count || 0}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Database Errors</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                              <div className="text-lg font-bold font-mono text-amber-600">
                                {appsec.errors?.debug_pages_count || 0}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Debug Pages</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                              <div className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">
                                {appsec.errors?.internal_paths_count || 0}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Internal Paths</div>
                            </div>
                          </div>

                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                            <span className="font-bold">Remediation:</span> Disable verbose debugging in production environments (e.g. set <code className="bg-amber-100 px-1 rounded font-mono">DEBUG = False</code> or <code className="bg-amber-100 px-1 rounded font-mono">NODE_ENV=production</code>). Return standard generic JSON error payloads without stack traces.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-PANEL 5: API DOCS & SCHEMAS */}
                  {appsecSubTab === "docs" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Public API Documentation & Schemas
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Automated discovery of OpenAPI v3, Swagger v2, and API explorer definitions on public endpoints.
                        </p>
                      </div>

                      {(!appsec.api_docs?.specs || appsec.api_docs.specs.length === 0) ? (
                        <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                          No public OpenAPI, Swagger, or API documentation specifications exposed on standard paths.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {appsec.api_docs.specs.map((spec, idx) => (
                            <div key={idx} className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 dark:bg-slate-800/40 dark:border-slate-800">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                                    {spec.title || "API Documentation"} {spec.version ? `v${spec.version}` : ""}
                                  </div>
                                  <div className="font-mono text-xs text-indigo-700 break-all dark:text-indigo-400">
                                    {spec.url}
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                                  {spec.type}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="p-2.5 bg-white rounded-lg border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-semibold">Endpoints Declared</div>
                                  <div className="font-mono font-bold text-slate-800 text-sm dark:text-slate-200">
                                    {spec.endpoints_declared}
                                  </div>
                                </div>
                                <div className="p-2.5 bg-white rounded-lg border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-semibold">Exposed Parameters</div>
                                  <div className="font-mono font-bold text-slate-800 text-sm dark:text-slate-200">
                                    {spec.exposed_parameters_count}
                                  </div>
                                </div>
                                <div className="p-2.5 bg-white rounded-lg border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-semibold">Auth Declarations</div>
                                  <div className="font-mono font-bold text-slate-800 text-sm dark:text-slate-200">
                                    {spec.has_auth_declarations ? spec.auth_types?.join(", ") || "Declared" :"None"}
                                  </div>
                                </div>
                                <div className="p-2.5 bg-white rounded-lg border border-slate-100 dark:bg-[#111C2E] dark:border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-semibold">Internal Staging URLs</div>
                                  <div className={`font-mono font-bold text-sm ${spec.internal_server_urls?.length ?"text-amber-700 dark:text-amber-400" :"text-slate-800 dark:text-slate-200"}`}>
                                    {spec.internal_server_urls?.length || 0}
                                  </div>
                                </div>
                              </div>

                              {spec.internal_server_urls && spec.internal_server_urls.length > 0 && (
                                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 space-y-1 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    Internal / Non-Production Server URLs Exposed:
                                  </div>
                                  <div className="font-mono text-[11px] space-y-0.5">
                                    {spec.internal_server_urls.map((u, uIdx) => (
                                      <div key={uIdx}>{u}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-PANEL 6: HTTP METHODS & SERVER HEADERS */}
                  {appsecSubTab === "http" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          HTTP Methods & Server Disclosures
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Verification of allowed HTTP methods, removal of dangerous diagnostic verbs (TRACE/TRACK), and suppression of server fingerprinting banners.
                        </p>
                      </div>

                      {/* HTTP Method Analyses */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider dark:text-slate-300">
                          HTTP Methods Evaluation
                        </h5>
                        {(!appsec.http_methods?.analyses || appsec.http_methods.analyses.length === 0) ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No HTTP method responses recorded.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden dark:border-slate-800 dark:divide-slate-800">
                            {appsec.http_methods.analyses.map((mItem, idx) => (
                              <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                <div className="space-y-0.5">
                                  <div className="font-mono text-xs font-bold text-slate-900 break-all dark:text-white">
                                    {mItem.url}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Allowed: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{mItem.allowed_methods?.join(", ") || "Standard GET/HEAD"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {mItem.dangerous_methods && mItem.dangerous_methods.length > 0 ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                      Dangerous: {mItem.dangerous_methods.join(", ")}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                      Safe Methods
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Framework Headers */}
                      {appsec.server_disclosure?.framework_headers &&
                       Object.keys(appsec.server_disclosure.framework_headers).length > 0 && (
                        <div className="space-y-3">
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider dark:text-slate-300">
                            Disclosed Framework & Runtime Headers
                          </h5>
                          <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 text-xs dark:border-amber-800">
                            {Object.entries(appsec.server_disclosure.framework_headers).map(([hdr, val]: [string, any]) => (
                              <div key={hdr} className="flex items-center justify-between font-mono">
                                <span className="font-bold text-amber-900">{hdr}:</span>
                                <span className="text-amber-800 dark:text-amber-400">{String(val)}</span>
                              </div>
                            ))}
                            <p className="text-[11px] text-amber-700 pt-1 dark:text-amber-400">
                              Recommendation: Strip framework headers (e.g. X-Powered-By, X-AspNet-Version) in your reverse proxy or web server configuration to hinder reconnaissance.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-PANEL 7: AUTH & SIGNALS */}
                  {appsecSubTab === "auth" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Authentication & Authorization Signals
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Passive detection of authentication entry points, administrative paths, CSRF tokens, and query token exposures.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Login Endpoints</div>
                          <div className="font-mono text-xs text-slate-800 space-y-1 dark:text-slate-200">
                            {appsec.authentication?.login_endpoints?.length ? (
                              appsec.authentication.login_endpoints.map((ep, idx) => (
                                <div key={idx} className="truncate" title={ep}>{ep}</div>
                              ))
                            ) : (
                              <span className="text-slate-400">None detected</span>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Registration Endpoints</div>
                          <div className="font-mono text-xs text-slate-800 space-y-1 dark:text-slate-200">
                            {appsec.authentication?.register_endpoints?.length ? (
                              appsec.authentication.register_endpoints.map((ep, idx) => (
                                <div key={idx} className="truncate" title={ep}>{ep}</div>
                              ))
                            ) : (
                              <span className="text-slate-400">None detected</span>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Password Reset</div>
                          <div className="font-mono text-xs text-slate-800 space-y-1 dark:text-slate-200">
                            {appsec.authentication?.password_reset_endpoints?.length ? (
                              appsec.authentication.password_reset_endpoints.map((ep, idx) => (
                                <div key={idx} className="truncate" title={ep}>{ep}</div>
                              ))
                            ) : (
                              <span className="text-slate-400">None detected</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Authorization Signals */}
                      {appsec.authorization_signals &&
                       appsec.authorization_signals.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider dark:text-slate-300">
                            Authorization Signals
                          </h5>
                          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden dark:border-slate-800 dark:divide-slate-800">
                            {appsec.authorization_signals.map((sig, idx) => (
                              <div key={idx} className="p-3 text-xs flex items-center justify-between">
                                <div className="font-mono text-slate-800 dark:text-slate-200">{sig.url}</div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                  {sig.signal_type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-PANEL 8: APPLICATION EXPOSURE */}
                  {appsecSubTab === "exposure" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Application & Infrastructure Exposure
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Detection of unlinked directory indexes, backup archives (.sql, .tar.gz), health monitoring metrics, and GraphQL endpoints.
                        </p>
                      </div>

                      {/* Directory Listings */}
                      {(appsec.directory_exposure?.listings_count || 0) > 0 && (
                        <div className="p-4 bg-red-50/60 rounded-xl border border-red-200 space-y-2 dark:border-red-800">
                          <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            Directory Listing / Indexing Exposed:
                          </div>
                          <div className="space-y-1">
                            {appsec.directory_exposure?.listings?.map((l, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-red-100 text-xs font-mono text-slate-800 flex items-center justify-between dark:bg-[#111C2E] dark:text-slate-200 dark:border-red-800">
                                <span>{l.url}</span>
                                <span className="text-red-700 font-bold dark:text-red-400">{l.files_detected_count} files listed</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sensitive Backup Files */}
                      {(appsec.directory_exposure?.backup_files_count || 0) > 0 && (
                        <div className="p-4 bg-red-50/60 rounded-xl border border-red-200 space-y-2 dark:border-red-800">
                          <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            Sensitive Backup or Config Files Downloadable:
                          </div>
                          <div className="space-y-1">
                            {appsec.directory_exposure?.backup_files?.map((bf, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-red-100 text-xs font-mono text-slate-800 flex items-center justify-between dark:bg-[#111C2E] dark:text-slate-200 dark:border-red-800">
                                <span>{bf.url}</span>
                                <span className="text-red-700 font-bold dark:text-red-400">HTTP {bf.status_code}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Health & Metrics */}
                      {appsec.health_metrics?.endpoints &&
                       appsec.health_metrics.endpoints.length > 0 && (
                        <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 dark:border-amber-800">
                          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <Radio className="w-4 h-4 text-amber-600" />
                            Public Health & Metrics Endpoints:
                          </div>
                          <div className="font-mono text-xs text-slate-800 space-y-1 dark:text-slate-200">
                            {appsec.health_metrics.endpoints.map((hm, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-amber-100 dark:bg-[#111C2E] dark:border-amber-800">{hm}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* GraphQL Details */}
                      {appsec.graphql?.endpoints &&
                       appsec.graphql.endpoints.length > 0 && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 dark:text-slate-200">
                            <Database className="w-4 h-4 text-purple-600" />
                            GraphQL Endpoints:
                          </div>
                          <div className="font-mono text-xs text-slate-800 space-y-1 dark:text-slate-200">
                            {appsec.graphql.endpoints.map((ge, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-slate-100 flex items-center justify-between dark:bg-[#111C2E] dark:border-slate-800">
                                <span>{ge}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800">
                                  Introspection: {appsec.graphql?.introspection_status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Clean Status if none */}
                      {!(appsec.directory_exposure?.listings_count) &&
                       !(appsec.directory_exposure?.backup_files_count) &&
                       !(appsec.health_metrics?.endpoints?.length) &&
                       !(appsec.graphql?.endpoints?.length) && (
                        <div className="p-6 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold">No public application exposures detected.</span> Directory indexing is disabled, no backup files (.sql/.env) were accessible, and no unauthenticated metrics or GraphQL endpoints were found.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* TAB CONTENT: IDENTITY, SESSION & BUSINESS LOGIC (PHASE F5) */}
            {/* ========================================================================= */}
            {activeTab === "identity" && (() => {
              const identity = metadata?.identity_security;
              if (!identity) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100 dark:bg-purple-950/40">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Advanced Authentication, Session & Access Security</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                      This deep scan was generated on a previous version (Phase F1–F4). Phase F5 evaluates credential transport, session cookie attributes, CSRF defenses, OAuth/OIDC PKCE parameters, SAML federation, RBAC privilege boundaries, and critical business-logic surfaces.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Deep Scan with Phase F5 Security
                    </button>
                  </div>
                );
              }

              const authEndpoints = identity.auth_endpoints || [];
              const passwordForms = identity.password_forms || [];
              const sessionCookies = identity.session_security?.session_cookies || identity.session_security?.cookies || [];
              const csrfForms = identity.csrf?.forms || [];
              const insecurePasswordForms = passwordForms.filter(f => f.is_insecure_cleartext || f.is_get_method);
              const missingHttpOnly = identity.session_security?.missing_httponly_count ?? 0;
              const missingSecure = identity.session_security?.missing_secure_count ?? 0;
              const unprotectedCsrf = identity.csrf?.unprotected_sensitive_forms_count ?? 0;
              const rolesIdentified = identity.authorization?.roles_identified || identity.authorization?.roles_observed || [];
              const adminRoutes = identity.authorization?.admin_endpoints || [];
              const objectRoutes = identity.authorization?.object_routes || [];
              const passwordsInUrls = identity.passwords_in_urls || [];
              const sessionTokensInUrls = identity.session_tokens_in_urls || [];
              const magicLinks = identity.business_logic?.magic_links || identity.business_logic?.magic_links_found || [];

              // Search filtering
              const q = identitySearch.toLowerCase().trim();
              const filteredAuthEndpoints = authEndpoints.filter(e => !q || e.url.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
              const filteredPasswordForms = passwordForms.filter(f => !q || f.page_url.toLowerCase().includes(q) || f.action.toLowerCase().includes(q));
              const filteredCookies = sessionCookies.filter(c => !q || c.name.toLowerCase().includes(q) || (c.sample_page && c.sample_page.toLowerCase().includes(q)));
              const filteredCsrfForms = csrfForms.filter(f => !q || f.page_url.toLowerCase().includes(q) || f.action.toLowerCase().includes(q));

              return (
                <div className="space-y-6">
                  {/* Phase F5 Sub-Tabs Navigation */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("overview")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "overview"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Overview & Posture</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("auth")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "auth"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Auth & Credentials</span>
                      {authEndpoints.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                          {authEndpoints.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("session")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "session"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Cookie className="w-3.5 h-3.5" />
                      <span>Session & Tokens</span>
                      {(missingHttpOnly > 0 || missingSecure > 0 || sessionTokensInUrls.length > 0) ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500 text-white">
                          {missingHttpOnly + missingSecure + sessionTokensInUrls.length}
                        </span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("oauth")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "oauth"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>OAuth & OIDC / SAML</span>
                      {identity.oauth_oidc?.oidc_discovered && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-purple-700 text-purple-100">
                          OIDC
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("csrf")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "csrf"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>CSRF Defenses</span>
                      {unprotectedCsrf > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-600 text-white">
                          {unprotectedCsrf} risk
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                          {csrfForms.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("authz")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "authz"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Authorization & RBAC</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                        {rolesIdentified.length + adminRoutes.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("business")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "business"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Workflow className="w-3.5 h-3.5" />
                      <span>Business Logic</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                        {(identity.business_logic?.payment_endpoints_count || 0) +
                         (identity.business_logic?.role_change_endpoints_count || 0) +
                         (identity.business_logic?.refund_endpoints_count || 0) +
                         (identity.business_logic?.invitation_endpoints_count || 0)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIdentitySubTab("recovery")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                        identitySubTab === "recovery"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Account Recovery & Hygiene</span>
                    </button>
                  </div>

                  {/* SUB-PANEL 1: OVERVIEW & POSTURE */}
                  {identitySubTab === "overview" && (
                    <div className="space-y-6">
                      {/* Safety & Protocol Banner */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs dark:bg-slate-800/40 dark:border-slate-800">
                        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong className="font-semibold text-slate-900 dark:text-white">Passive-Only Identity Intelligence:</strong>{" "}
                            Evaluated without credential brute-forcing, password guessing, or state-changing form POSTs.
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700 dark:bg-[#111C2E] dark:text-slate-300 dark:border-slate-800">
                            {identity.requests_executed ?? 0} HTTP probes
                          </span>
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Tokens Masked
                          </span>
                        </div>
                      </div>

                      {/* KPI Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Auth Endpoints
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {identity.auth_endpoints_count ?? authEndpoints.length}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Login, signup, tokens
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Password Forms
                          </div>
                          <div className={`text-xl font-bold font-mono ${insecurePasswordForms.length > 0 ?"text-red-600" :"text-emerald-600"}`}>
                            {passwordForms.length}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {insecurePasswordForms.length > 0 ? `${insecurePasswordForms.length} insecure` :"All HTTPS POST"}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Session Cookies
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {sessionCookies.length}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {missingHttpOnly > 0 ? `${missingHttpOnly} no HttpOnly` :"Flags enforced"}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            CSRF Defenses
                          </div>
                          <div className={`text-xl font-bold font-mono ${unprotectedCsrf > 0 ?"text-amber-600" :"text-emerald-600"}`}>
                            {identity.csrf?.protected_forms_count ?? 0} / {identity.csrf?.forms_evaluated_count ?? csrfForms.length}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {unprotectedCsrf > 0 ? `${unprotectedCsrf} sensitive risk` :"Protected forms"}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Roles & Admin
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {rolesIdentified.length} / {adminRoutes.length}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Roles / admin routes
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Critical Flows
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {(identity.business_logic?.payment_endpoints_count ?? 0) +
                             (identity.business_logic?.role_change_endpoints_count ?? 0) +
                             (identity.business_logic?.refund_endpoints_count ?? 0)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Payments & logic
                          </div>
                        </div>
                      </div>

                      {/* Posture Highlights Matrix */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Identity & Authentication Posture Summary
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="font-semibold text-slate-700 flex items-center justify-between dark:text-slate-300">
                              <span>MFA & WebAuthn / Passkeys</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                identity.mfa_signals?.detected ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" :"bg-slate-200 text-slate-600 dark:text-slate-400"
                              }`}>
                                {identity.mfa_signals?.detected ?"Observed" :"Not Found"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {identity.mfa_signals?.detected
                                ? `Supported methods detected: ${identity.mfa_signals.methods?.join(", ") || "TOTP / Passkey"}`
                                :"No modern multi-factor authentication or WebAuthn signals discovered on crawl."}
                            </p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="font-semibold text-slate-700 flex items-center justify-between dark:text-slate-300">
                              <span>OpenID Connect & OAuth 2.0</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                identity.oauth_oidc?.oidc_discovered ?"bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800" :"bg-slate-200 text-slate-600 dark:text-slate-400"
                              }`}>
                                {identity.oauth_oidc?.oidc_discovered ?"Discovered" :"Not Published"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {identity.oauth_oidc?.oidc_discovered
                                ? `Discovery published. PKCE S256: ${identity.oauth_oidc.oidc_configuration?.has_pkce_s256 ?"Enforced" :"Missing"}`
                                :"No public .well-known/openid-configuration document found."}
                            </p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="font-semibold text-slate-700 flex items-center justify-between dark:text-slate-300">
                              <span>SAML 2.0 Single Sign-On</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                identity.oauth_oidc?.saml_discovered ?"bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900" :"bg-slate-200 text-slate-600 dark:text-slate-400"
                              }`}>
                                {identity.oauth_oidc?.saml_discovered ?"Metadata Found" :"Not Observed"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {identity.oauth_oidc?.saml_discovered
                                ? `SAML federation metadata detected with ${identity.oauth_oidc.saml_metadata?.sso_services_count || 1} SSO endpoint(s).`
                                :"No public SAML 2.0 federation metadata endpoints detected on origin."}
                            </p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="font-semibold text-slate-700 flex items-center justify-between dark:text-slate-300">
                              <span>Credential Transport in URLs</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                (passwordsInUrls.length + sessionTokensInUrls.length > 0)
                                  ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                  :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                              }`}>
                                {(passwordsInUrls.length + sessionTokensInUrls.length > 0) ?"Exposed" :"Clean"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {(passwordsInUrls.length + sessionTokensInUrls.length > 0)
                                ? `${passwordsInUrls.length} password(s) and ${sessionTokensInUrls.length} session token(s) detected in URL query strings.`
                                :"Zero plaintext passwords or session identifiers detected in URL paths or query parameters."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 2: AUTHENTICATION & CREDENTIALS */}
                  {identitySubTab === "auth" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Authentication Endpoints & Credential Transport
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Classification of login, registration, token exchange, and password submission surfaces.
                          </p>
                        </div>
                        <div className="relative w-full sm:w-64">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter auth endpoints..."
                            value={identitySearch}
                            onChange={(e) => setIdentitySearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800/40 dark:border-slate-800"
                          />
                        </div>
                      </div>

                      {/* Password Form Security Table */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Password Form Security Audit ({passwordForms.length})
                          </h5>
                          {insecurePasswordForms.length > 0 && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                              {insecurePasswordForms.length} Insecure Submissions
                            </span>
                          )}
                        </div>

                        {passwordForms.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No HTML password input forms discovered during the crawl.
                          </div>
                        ) : (
                          <div className="border border-slate-200/80 rounded-xl overflow-x-auto dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Form Location</th>
                                  <th className="py-2.5 px-3">Action URL</th>
                                  <th className="py-2.5 px-3">Method</th>
                                  <th className="py-2.5 px-3">Protocol</th>
                                  <th className="py-2.5 px-3">Security Verdict</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                                {filteredPasswordForms.map((form, idx) => {
                                  const isInsecure = form.is_insecure_cleartext || form.is_get_method;
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-700 dark:text-slate-300" title={form.page_url}>
                                        {form.page_url}
                                      </td>
                                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-600 dark:text-slate-400" title={form.resolved_action_url || form.action}>
                                        {form.action || "/"}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          form.is_get_method ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" :"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                        }`}>
                                          {form.method.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          form.is_insecure_cleartext ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                        }`}>
                                          {form.action_protocol ? form.action_protocol.toUpperCase() :"HTTPS"}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        {isInsecure ? (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 dark:text-red-400">
                                            {form.is_insecure_cleartext ?"Cleartext HTTP" :"GET Query Leak"}
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:text-emerald-400">
                                            Secure (HTTPS POST)
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Passwords in URLs Alert */}
                      {passwordsInUrls.length > 0 ? (
                        <div className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-2 dark:bg-red-950/40 dark:border-red-800">
                          <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>Plaintext Password Parameters Exposed in URLs ({passwordsInUrls.length})</span>
                          </div>
                          <p className="text-[11px] text-red-700 dark:text-red-400">
                            Password values transmitted via URL query parameters leak into browser history, web server access logs, reverse proxy logs, and external sites via HTTP Referer headers.
                          </p>
                          <div className="font-mono text-[11px] space-y-1">
                            {passwordsInUrls.map((p, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-red-200 text-slate-800 flex items-center justify-between dark:bg-[#111C2E] dark:text-slate-200 dark:border-red-800">
                                <span className="truncate max-w-lg">{p.url}</span>
                                <span className="px-2 py-0.5 rounded bg-red-50 text-red-800 text-[10px] font-bold shrink-0 dark:bg-red-950/40 dark:text-red-400">
                                  {p.parameter}={p.masked_value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Discovered Authentication Endpoints Table */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Discovered Authentication Endpoints ({filteredAuthEndpoints.length})
                        </h5>
                        {filteredAuthEndpoints.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No authentication endpoints matched the current search filter.
                          </div>
                        ) : (
                          <div className="border border-slate-200/80 rounded-xl overflow-x-auto dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Endpoint URL</th>
                                  <th className="py-2.5 px-3">Classification</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                                {filteredAuthEndpoints.map((ep, idx) => {
                                  const catColor =
                                    ep.category === "LOGIN" ?"bg-blue-50 text-blue-700 border-blue-200" :
                                    ep.category === "REGISTER" ?"bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" :
                                    ep.category === "PASSWORD_RESET" ?"bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" :
                                    ep.category === "ADMIN_AUTH" ?"bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800" :
                                    ep.category === "MFA" ?"bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900" :
                                    "bg-slate-100 text-slate-700 border-slate-200";
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                      <td className="py-2.5 px-3 text-slate-800 break-all dark:text-slate-200">
                                        {ep.url}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${catColor}`}>
                                          {ep.category}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 3: SESSION SECURITY & TOKEN TRANSPORT */}
                  {identitySubTab === "session" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Session Cookies & URL Token Transport
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Security attributes of authentication cookies (HttpOnly, Secure, SameSite) and URL-based session leak prevention.
                        </p>
                      </div>

                      {/* Session Cookies Table */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Authentication & Session Cookies ({filteredCookies.length})
                          </h5>
                          {(missingHttpOnly > 0 || missingSecure > 0) && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                              {missingHttpOnly} missing HttpOnly • {missingSecure} missing Secure
                            </span>
                          )}
                        </div>

                        {filteredCookies.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No session or authentication cookies discovered on inspected responses.
                          </div>
                        ) : (
                          <div className="border border-slate-200/80 rounded-xl overflow-x-auto dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Cookie Name</th>
                                  <th className="py-2.5 px-3">HttpOnly</th>
                                  <th className="py-2.5 px-3">Secure Flag</th>
                                  <th className="py-2.5 px-3">SameSite</th>
                                  <th className="py-2.5 px-3">Persistence</th>
                                  <th className="py-2.5 px-3">Observed On</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                                {filteredCookies.map((cookie, idx) => {
                                  const isHttpOnly = cookie.is_http_only || cookie.http_only;
                                  const isSecure = cookie.is_secure || cookie.secure;
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                        {cookie.name}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isHttpOnly ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" :"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                        }`}>
                                          {isHttpOnly ?"Yes" :"Missing (XSS Risk)"}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          isSecure ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" :"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                        }`}>
                                          {isSecure ?"Yes" :"Missing (Cleartext Risk)"}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          cookie.same_site ?"bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800" :"bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                        }`}>
                                          {cookie.same_site || "Unset"}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                        {cookie.is_persistent ?"Persistent" :"Session Only"}
                                      </td>
                                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-500 dark:text-slate-400" title={cookie.sample_page || ""}>
                                        {cookie.sample_page || "/"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Session Tokens in URLs */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          URL-Based Session Identifiers & JWTs ({sessionTokensInUrls.length})
                        </h5>

                        {sessionTokensInUrls.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong>Clean:</strong> No session identifiers (JSESSIONID, phpsessid), JWTs, or access tokens detected in visited page URLs.
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 space-y-1 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                              <span className="font-bold">Security Violation:</span> Transporting session IDs or JWTs in URLs exposes authentication tokens in browser history, proxy access logs, and HTTP Referer headers. Use <code className="bg-red-100 px-1 rounded font-mono">HttpOnly; Secure; SameSite=Lax</code> cookies or HTTP Authorization headers instead.
                            </div>
                            <div className="border border-slate-200/80 rounded-xl overflow-x-auto dark:border-slate-800">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                  <tr>
                                    <th className="py-2.5 px-3">Page URL</th>
                                    <th className="py-2.5 px-3">Leak Type</th>
                                    <th className="py-2.5 px-3">Parameter</th>
                                    <th className="py-2.5 px-3">Masked Token</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                                  {sessionTokensInUrls.map((tok, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-800 dark:text-slate-200" title={tok.url}>
                                        {tok.url}
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                          {tok.type}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                        {tok.param || "path"}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-900 font-bold dark:text-white">
                                        {tok.masked_token}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 4: OAUTH 2.0, OPENID CONNECT & SAML */}
                  {identitySubTab === "oauth" && (
                    <div className="space-y-6">
                      {/* OIDC Discovery Card */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              OpenID Connect (OIDC) Discovery
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Inspection of <code className="bg-slate-100 px-1 rounded font-mono dark:bg-slate-800">/.well-known/openid-configuration</code>.
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                            identity.oauth_oidc?.oidc_discovered
                              ?"bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800"
                              :"bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            {identity.oauth_oidc?.oidc_discovered ?"Configuration Published" :"Not Published"}
                          </span>
                        </div>

                        {!identity.oauth_oidc?.oidc_discovered ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No OpenID Connect discovery document exposed on standard well-known endpoints.
                          </div>
                        ) : (() => {
                          const oidc = identity.oauth_oidc?.oidc_configuration;
                          return (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase">PKCE S256 Challenge</div>
                                  <div className={`text-sm font-bold font-mono mt-0.5 ${oidc?.has_pkce_s256 ?"text-emerald-700 dark:text-emerald-400" :"text-amber-700 dark:text-amber-400"}`}>
                                    {oidc?.has_pkce_s256 ?"Supported (Secure)" :"Missing (Vulnerable)"}
                                  </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase">Implicit Flow</div>
                                  <div className={`text-sm font-bold font-mono mt-0.5 ${oidc?.has_implicit_flow ?"text-amber-700 dark:text-amber-400" :"text-emerald-700 dark:text-emerald-400"}`}>
                                    {oidc?.has_implicit_flow ?"Enabled (Deprecated)" :"Disabled (Secure)"}
                                  </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase">Password Grant</div>
                                  <div className={`text-sm font-bold font-mono mt-0.5 ${oidc?.has_password_grant ?"text-red-700 dark:text-red-400" :"text-emerald-700 dark:text-emerald-400"}`}>
                                    {oidc?.has_password_grant ?"Enabled (High Risk)" :"Disabled (Secure)"}
                                  </div>
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-xs space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                {oidc?.issuer && <div><span className="text-slate-400">Issuer:</span> {oidc.issuer}</div>}
                                {oidc?.authorization_endpoint && <div><span className="text-slate-400">Auth Endpoint:</span> {oidc.authorization_endpoint}</div>}
                                {oidc?.token_endpoint && <div><span className="text-slate-400">Token Endpoint:</span> {oidc.token_endpoint}</div>}
                                {oidc?.jwks_uri && <div><span className="text-slate-400">JWKS URI:</span> {oidc.jwks_uri}</div>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* OAuth Redirect URIs Table */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            OAuth Redirect URIs ({identity.oauth_oidc?.oauth_redirects?.length || 0})
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Discovered callback URI parameters audited for cleartext HTTP or open-redirect wildcards.
                          </p>
                        </div>

                        {(!identity.oauth_oidc?.oauth_redirects || identity.oauth_oidc.oauth_redirects.length === 0) ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No OAuth redirect URI parameters observed across crawled links.
                          </div>
                        ) : (
                          <div className="border border-slate-200/80 rounded-xl overflow-x-auto dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Source Page</th>
                                  <th className="py-2.5 px-3">Parameter</th>
                                  <th className="py-2.5 px-3">Redirect URI</th>
                                  <th className="py-2.5 px-3">Security Posture</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                                {identity.oauth_oidc.oauth_redirects.map((red, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-700 dark:text-slate-300" title={red.source_url}>
                                      {red.source_url}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                                      {red.parameter}
                                    </td>
                                    <td className="py-2.5 px-3 text-indigo-700 break-all dark:text-indigo-400">
                                      {red.redirect_uri}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {red.is_insecure_http ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                          Insecure HTTP
                                        </span>
                                      ) : red.is_wildcard ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                          Wildcard Pattern
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                          Strict Origin
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* SAML 2.0 Single Sign-On */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            SAML 2.0 Identity Federation
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            identity.oauth_oidc?.saml_discovered ?"bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900" :"bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            {identity.oauth_oidc?.saml_discovered ?"Discovered" :"Not Found"}
                          </span>
                        </div>

                        {!identity.oauth_oidc?.saml_discovered ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No public SAML 2.0 entity metadata or federation documents exposed on standard paths.
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 font-mono text-xs space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                            <div><span className="text-slate-400">Metadata URL:</span> {identity.oauth_oidc.saml_metadata?.url}</div>
                            {identity.oauth_oidc.saml_metadata?.entity_id && (
                              <div><span className="text-slate-400">Entity ID:</span> {identity.oauth_oidc.saml_metadata.entity_id}</div>
                            )}
                            <div><span className="text-slate-400">SSO Services Count:</span> {identity.oauth_oidc.saml_metadata?.sso_services_count || 1}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 5: CSRF DEFENSES */}
                  {identitySubTab === "csrf" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Cross-Site Request Forgery (CSRF) Defenses
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Inspection of HTML form anti-forgery tokens, synchronizer token pattern, and SameSite cookie defense.
                        </p>
                      </div>

                      {/* CSRF Stat Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Forms Evaluated</div>
                          <div className="text-xl font-bold font-mono text-slate-900 mt-0.5 dark:text-white">
                            {identity.csrf?.forms_evaluated_count ?? csrfForms.length}
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Protected Forms</div>
                          <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5 dark:text-emerald-400">
                            {identity.csrf?.protected_forms_count ?? 0}
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Unprotected Sensitive</div>
                          <div className={`text-xl font-bold font-mono mt-0.5 ${unprotectedCsrf > 0 ?"text-red-700 dark:text-red-400" :"text-slate-800 dark:text-slate-200"}`}>
                            {unprotectedCsrf}
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="text-[10px] text-slate-400 font-bold uppercase">SameSite Cookie Defense</div>
                          <div className={`text-sm font-bold font-mono mt-1 ${identity.csrf?.samesite_cookie_defense ?"text-emerald-700 dark:text-emerald-400" :"text-amber-700 dark:text-amber-400"}`}>
                            {identity.csrf?.samesite_cookie_defense ?"Active" :"Not Detected"}
                          </div>
                        </div>
                      </div>

                      {/* CSRF Forms Table */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Evaluated State-Changing Forms ({filteredCsrfForms.length})
                        </h5>

                        {filteredCsrfForms.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No POST or state-changing forms discovered on scanned pages.
                          </div>
                        ) : (
                          <div className="border border-slate-200/80 rounded-xl overflow-x-auto dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Form Location</th>
                                  <th className="py-2.5 px-3">Action URL</th>
                                  <th className="py-2.5 px-3">Method</th>
                                  <th className="py-2.5 px-3">Token Field</th>
                                  <th className="py-2.5 px-3">Sensitivity</th>
                                  <th className="py-2.5 px-3">Protection Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                                {filteredCsrfForms.map((form, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-700 dark:text-slate-300" title={form.page_url}>
                                      {form.page_url}
                                    </td>
                                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-600 dark:text-slate-400" title={form.action}>
                                      {form.action || "/"}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                                      {form.method.toUpperCase()}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                      {form.token_field ? (
                                        <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono text-indigo-700 dark:bg-slate-800 dark:text-indigo-400">
                                          {form.token_field}
                                        </code>
                                      ) : (
                                        <span className="text-slate-400">None</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        form.is_sensitive ?"bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" :"bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                      }`}>
                                        {form.is_sensitive ?"Sensitive" :"Standard"}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {form.is_protected ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                          Protected
                                        </span>
                                      ) : form.is_sensitive ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 dark:text-red-400">
                                          At Risk (Missing CSRF)
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                          Unprotected
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* CSRF Defense Guidance */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-800">
                        <span className="font-bold text-slate-900 dark:text-white">CSRF Remediation:</span> Ensure all state-changing endpoints (<code className="bg-slate-200 px-1 rounded font-mono">POST</code>, <code className="bg-slate-200 px-1 rounded font-mono">PUT</code>, <code className="bg-slate-200 px-1 rounded font-mono">DELETE</code>) require a cryptographically unique anti-forgery synchronizer token or check custom headers (<code className="bg-slate-200 px-1 rounded font-mono">X-CSRF-Token</code>). Combine with <code className="bg-slate-200 px-1 rounded font-mono">SameSite=Lax</code> or <code className="bg-slate-200 px-1 rounded font-mono">SameSite=Strict</code> cookie attributes.
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 6: AUTHORIZATION & RBAC */}
                  {identitySubTab === "authz" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Authorization Architecture & Privilege Boundaries
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Role-based access control (RBAC) tiers, privileged administrative surfaces, and object-level reference routes.
                        </p>
                      </div>

                      {/* Discovered Roles */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Discovered Roles & Privilege Tiers ({rolesIdentified.length})
                        </h5>
                        {rolesIdentified.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No explicit role identifiers observed across analyzed forms and scripts.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {rolesIdentified.map((role, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Admin Routing Surfaces */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Administrative & Back-Office Surfaces ({adminRoutes.length})
                        </h5>
                        {adminRoutes.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No administrative management routes exposed on standard links.
                          </div>
                        ) : (
                          <div className="font-mono text-xs space-y-1.5">
                            {adminRoutes.map((route, idx) => (
                              <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-slate-800 flex items-center justify-between dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-800">
                                <span className="font-semibold text-indigo-700 break-all dark:text-indigo-400">{route}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                  Privileged Surface
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Object-Level Reference Surfaces (BOLA / IDOR) */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Object-Level Reference Routes (BOLA / IDOR Surfaces) ({objectRoutes.length})
                        </h5>
                        {objectRoutes.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No object-level parameterized routes discovered during crawl.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                              <span className="font-bold">BOLA / IDOR Protection Notice:</span> Verify that backend controllers validate whether the authenticated user has explicit rights to access or manipulate the resource referenced by the route parameter.
                            </div>
                            <div className="font-mono text-xs space-y-1">
                              {objectRoutes.map((route, idx) => (
                                <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-800">
                                  {route}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 7: BUSINESS LOGIC SURFACES */}
                  {identitySubTab === "business" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Business-Logic Surfaces & Critical Workflows
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Mapping of high-value transactional flows: payments, refunds, role escalation, invitations, and one-time magic links.
                        </p>
                      </div>

                      {/* Workflow Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Payment & Checkout</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {identity.business_logic?.payment_endpoints_count || 0}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 space-y-1 max-h-32 overflow-y-auto dark:text-slate-400">
                            {(identity.business_logic?.payment_endpoints || []).length > 0 ? (
                              identity.business_logic?.payment_endpoints.map((e, idx) => <div key={idx} className="truncate">{e}</div>)
                            ) : (
                              <div className="text-slate-400 italic">None detected</div>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Role Modification</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {identity.business_logic?.role_change_endpoints_count || 0}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 space-y-1 max-h-32 overflow-y-auto dark:text-slate-400">
                            {(identity.business_logic?.role_change_endpoints || []).length > 0 ? (
                              identity.business_logic?.role_change_endpoints.map((e, idx) => <div key={idx} className="truncate">{e}</div>)
                            ) : (
                              <div className="text-slate-400 italic">None detected</div>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Refunds & Reversals</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {identity.business_logic?.refund_endpoints_count || 0}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 space-y-1 max-h-32 overflow-y-auto dark:text-slate-400">
                            {(identity.business_logic?.refund_endpoints || []).length > 0 ? (
                              identity.business_logic?.refund_endpoints.map((e, idx) => <div key={idx} className="truncate">{e}</div>)
                            ) : (
                              <div className="text-slate-400 italic">None detected</div>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">User Invitations</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {identity.business_logic?.invitation_endpoints_count || 0}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 space-y-1 max-h-32 overflow-y-auto dark:text-slate-400">
                            {(identity.business_logic?.invitation_endpoints || []).length > 0 ? (
                              identity.business_logic?.invitation_endpoints.map((e, idx) => <div key={idx} className="truncate">{e}</div>)
                            ) : (
                              <div className="text-slate-400 italic">None detected</div>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Approvals & Release</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {identity.business_logic?.approval_endpoints_count || 0}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 space-y-1 max-h-32 overflow-y-auto dark:text-slate-400">
                            {(identity.business_logic?.approval_endpoints || []).length > 0 ? (
                              identity.business_logic?.approval_endpoints.map((e, idx) => <div key={idx} className="truncate">{e}</div>)
                            ) : (
                              <div className="text-slate-400 italic">None detected</div>
                            )}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Credits & Balance</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {identity.business_logic?.credit_endpoints_count || 0}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 space-y-1 max-h-32 overflow-y-auto dark:text-slate-400">
                            {(identity.business_logic?.credit_endpoints || []).length > 0 ? (
                              identity.business_logic?.credit_endpoints.map((e, idx) => <div key={idx} className="truncate">{e}</div>)
                            ) : (
                              <div className="text-slate-400 italic">None detected</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Magic Links Table */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Pre-Authenticated Magic Links & Tokens ({magicLinks.length})
                        </h5>

                        {magicLinks.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No pre-authenticated magic link tokens observed in crawled URLs.</span>
                          </div>
                        ) : (
                          <div className="border border-slate-200/80 rounded-xl overflow-x-auto dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-3">Page URL</th>
                                  <th className="py-2.5 px-3">Parameter</th>
                                  <th className="py-2.5 px-3">Masked Token</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                                {magicLinks.map((link, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <td className="py-2.5 px-3 max-w-xs truncate text-slate-800 dark:text-slate-200" title={link.url}>
                                      {link.url}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                      {link.parameter}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-indigo-700 dark:text-indigo-400">
                                      {link.masked_token}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 8: ACCOUNT RECOVERY & HYGIENE */}
                  {identitySubTab === "recovery" && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Account Recovery & Credential Hygiene
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Password recovery endpoints, reset token masking, user enumeration defenses, and password complexity constraints.
                        </p>
                      </div>

                      {/* Password Reset Endpoints */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Password Reset Endpoints ({identity.account_recovery?.reset_endpoints?.length || 0})
                        </h5>
                        {(!identity.account_recovery?.reset_endpoints || identity.account_recovery.reset_endpoints.length === 0) ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                            No password reset endpoints discovered on crawled pages.
                          </div>
                        ) : (
                          <div className="font-mono text-xs space-y-1">
                            {identity.account_recovery.reset_endpoints.map((ep, idx) => (
                              <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-800">
                                {ep}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reset Tokens in URLs */}
                      {identity.account_recovery?.reset_tokens_found && identity.account_recovery.reset_tokens_found.length > 0 && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2 dark:bg-amber-950/40 dark:border-amber-800">
                          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span>Password Reset Tokens Observed in URLs:</span>
                          </div>
                          <div className="font-mono text-xs text-slate-800 space-y-1 dark:text-slate-200">
                            {identity.account_recovery.reset_tokens_found.map((tok, idx) => (
                              <div key={idx} className="p-2 bg-white rounded border border-amber-100 flex items-center justify-between dark:bg-[#111C2E] dark:border-amber-800">
                                <span className="truncate max-w-md">{tok.url}</span>
                                <span className="font-bold text-amber-800 dark:text-amber-400">{tok.parameter}={tok.masked_token}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* User Enumeration Signals */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Account Enumeration Defenses
                        </h5>
                        {(!identity.account_recovery?.enumeration_signals || identity.account_recovery.enumeration_signals.length === 0) ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center gap-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No differential account enumeration responses observed on authentication forms.</span>
                          </div>
                        ) : (
                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                            <div className="font-bold flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              <span>Differential Messaging Signals Detected ({identity.account_recovery.enumeration_signals.length}):</span>
                            </div>
                            <div className="font-mono text-[11px] space-y-1">
                              {identity.account_recovery.enumeration_signals.map((sig, idx) => (
                                <div key={idx} className="p-2 bg-white rounded border border-amber-100 flex items-center justify-between dark:bg-[#111C2E] dark:border-amber-800">
                                  <span>{sig.url}</span>
                                  <span className="font-bold text-amber-900">{sig.signal}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Password Policy */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs dark:bg-slate-800/40 dark:border-slate-800">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Client-Side Password Policy Observations:</span>
                        {identity.account_recovery?.password_policy?.observed ? (
                          <div className="space-y-1">
                            <p className="text-slate-600 dark:text-slate-400">Password complexity constraints enforced on registration forms:</p>
                            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                              {identity.account_recovery.password_policy.rules.map((rule, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 dark:bg-[#111C2E] dark:text-slate-300 dark:border-slate-800">
                                  {rule}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-500 dark:text-slate-400">
                            No explicit client-side password complexity pattern attributes (<code className="bg-slate-200 px-1 rounded font-mono">minlength</code>, <code className="bg-slate-200 px-1 rounded font-mono">pattern</code>) observed on scanned forms.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* TAB CONTENT: INFRASTRUCTURE, CLOUD & DEPLOYMENT (PHASE F6) */}
            {/* ========================================================================= */}
            {activeTab === "infra" && (() => {
              const infra = metadata?.infrastructure_security;
              if (!infra) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100 dark:bg-amber-950/40 dark:border-amber-800">
                      <Cloud className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Advanced Infrastructure, Cloud, Deployment & Operational Security
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                      This deep scan was generated on a previous version (Phase F1–F5). Phase F6 evaluates infrastructure provider fingerprinting, cloud services, CDN/origin leakage, deployment artifact audits (.git/HEAD, Dockerfile), environment classification, and operational exposure intelligence.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Deep Scan with Phase F6 Security
                    </button>
                  </div>
                );
              }

              const allProviders = infra.infrastructure?.all_detected_providers || [];
              const cloudProviders = infra.cloud?.providers || [];
              const cloudServices = infra.cloud?.services || [];
              const metadataRefs = infra.cloud?.metadata_references || [];
              const originSignals = infra.origin?.signals || [];
              const originHostnames = infra.origin?.origin_hostnames || [];
              const originIps = infra.origin?.origin_ips || [];
              const artifacts = infra.deployment?.artifacts || [];
              const environments = infra.environments || [];
              const storageEndpoints = infra.storage || [];
              const operationalSurfaces = infra.operational_exposure?.surfaces || [];
              const managementRoutes = infra.operational_exposure?.management_routes || [];
              const monitoringTools = infra.operational_exposure?.monitoring_tools || [];
              const takeoverSignals = infra.takeover_signals || infra.dns_relationships?.takeover_signals || [];
              const k8sSignals = infra.containers?.kubernetes_signals || [];
              const dockerSignals = infra.containers?.docker_signals || [];

              // Filter helper
              const q = infraSearch.toLowerCase().trim();
              const filteredSurfaces = operationalSurfaces.filter(
                s => !q || s.url.toLowerCase().includes(q) || s.type.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
              );
              const filteredArtifacts = artifacts.filter(
                a => !q || a.url.toLowerCase().includes(q) || a.type.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
              );
              const filteredStorage = storageEndpoints.filter(
                s => !q || s.url.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q) || s.bucket.toLowerCase().includes(q)
              );

              return (
                <div className="space-y-6">
                  {/* Phase F6 Sub-Tabs Navigation */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setInfraSubTab("overview")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "overview"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Overview & Posture</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInfraSubTab("cloud")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "cloud"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Cloud & Hosting</span>
                      {cloudProviders.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                          {cloudProviders.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInfraSubTab("origin")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "origin"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Network className="w-3.5 h-3.5" />
                      <span>Origin & Edge</span>
                      {infra.origin?.signal_detected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-600 text-white">
                          Leak Risk
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInfraSubTab("deployment")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "deployment"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Server className="w-3.5 h-3.5" />
                      <span>Deployment & Envs</span>
                      {environments.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500 text-white">
                          {environments.length} non-prod
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInfraSubTab("exposure")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "exposure"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Artifact Exposure</span>
                      {infra.deployment?.git_exposed && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-600 text-white">
                          Git Exposed
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInfraSubTab("storage")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "storage"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Cloud Storage</span>
                      {storageEndpoints.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                          {storageEndpoints.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInfraSubTab("operations")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "operations"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Operations & Telemetry</span>
                      {operationalSurfaces.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-800 text-slate-200">
                          {operationalSurfaces.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setInfraSubTab("relationships")}
                      className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                        infraSubTab === "relationships"
                          ?"bg-slate-900 text-white"
                          :"hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <Box className="w-3.5 h-3.5" />
                      <span>Topology & DNS</span>
                      {takeoverSignals.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-red-600 text-white">
                          {takeoverSignals.length} signal
                        </span>
                      )}
                    </button>
                  </div>

                  {/* SUB-PANEL 1: OVERVIEW & POSTURE */}
                  {infraSubTab === "overview" && (
                    <div className="space-y-6">
                      {/* Safety & Protocol Banner */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs dark:bg-slate-800/40 dark:border-slate-800">
                        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong className="font-semibold text-slate-900 dark:text-white">Bounded Passive Infrastructure Intelligence:</strong>{" "}
                            Evaluated without port scanning, network sweeps, cloud credential exploitation, or state manipulation.
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-700 dark:bg-[#111C2E] dark:text-slate-300 dark:border-slate-800">
                            {infra.requests_executed ?? 0} HTTP probes
                          </span>
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            SSRF Shield Active
                          </span>
                        </div>
                      </div>

                      {/* KPI Cards Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Primary Provider
                          </div>
                          <div className="text-sm font-bold font-mono text-slate-900 truncate dark:text-white">
                            {infra.infrastructure?.primary_provider || "Direct / Unidentified"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate dark:text-slate-400">
                            {infra.infrastructure?.category || "Infrastructure"}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Edge CDN
                          </div>
                          <div className="text-sm font-bold font-mono text-slate-900 truncate dark:text-white">
                            {infra.cdn?.detected ? (infra.cdn.provider || "Active CDN") :"Direct Origin"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {infra.cdn?.detected ?"Edge Caching Active" :"No CDN Proxy"}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Cloud Hosting
                          </div>
                          <div className="text-sm font-bold font-mono text-slate-900 truncate dark:text-white">
                            {cloudProviders.length > 0 ? cloudProviders.join(", ") :"None Detected"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {cloudServices.length > 0 ? `${cloudServices.length} service(s)` :"Standard Host"}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Deployment
                          </div>
                          <div className="text-sm font-bold font-mono text-slate-900 truncate dark:text-white">
                            {infra.deployment?.platform || "Standard Server"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {infra.deployment?.git_exposed ? (
                              <span className="text-red-600 font-bold">.git Exposed!</span>
                            ) : (
                              "Git Protected"
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Non-Prod Envs
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {infra.environment_summary?.detected_count ?? environments.length}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Staging, dev, preview
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Operational Surfaces
                          </div>
                          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                            {infra.operational_exposure?.surfaces_count ?? 0}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Metrics, Actuator, Debug
                          </div>
                        </div>
                      </div>

                      {/* Posture Highlights Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Edge & Origin Protection Card */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 dark:text-white">
                              <Network className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              Edge & Origin Masking
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              infra.origin?.signal_detected
                                ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            }`}>
                              {infra.origin?.signal_detected ?"Origin Exposed" :"Origin Masked"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {infra.origin?.signal_detected
                              ? `Origin IP or hostname disclosed via response headers or certificate metadata (${originSignals.length} signal(s)).`
                              :"No direct origin server IP addresses or backend hostnames leaked through response headers or SAN certificates."}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 dark:border-slate-800">
                            <span>CDN Provider:</span>
                            <span className="font-bold">{infra.cdn?.provider || "Direct"}</span>
                          </div>
                        </div>

                        {/* Deployment Artifacts Card */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 dark:text-white">
                              <GitBranch className="w-4 h-4 text-purple-600" />
                              Deployment Artifacts
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              infra.deployment?.git_exposed
                                ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            }`}>
                              {infra.deployment?.git_exposed ?"Git Exposed" :"Clean"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {infra.deployment?.git_exposed
                              ?"CRITICAL: Git repository metadata (/.git/HEAD) is publicly accessible on the web root."
                              :"Source control metadata (.git/HEAD) and container build manifests are protected from direct web access."}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 dark:border-slate-800">
                            <span>Platform Engine:</span>
                            <span className="font-bold">{infra.deployment?.platform || "Standard"}</span>
                          </div>
                        </div>

                        {/* Cloud Storage Security Card */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 dark:text-white">
                              <HardDrive className="w-4 h-4 text-sky-600" />
                              Cloud Object Storage
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              storageEndpoints.some(s => s.is_sensitive)
                                ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            }`}>
                              {storageEndpoints.some(s => s.is_sensitive) ?"Sensitive Objects" :"Clean / Protected"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {storageEndpoints.length > 0
                              ? `Identified ${storageEndpoints.length} referenced cloud storage bucket endpoint(s) across S3, GCS, or Azure Blob.`
                              :"Zero public cloud storage bucket URLs or sensitive database backup objects discovered."}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 dark:border-slate-800">
                            <span>Storage Buckets:</span>
                            <span className="font-bold">{storageEndpoints.length} mapped</span>
                          </div>
                        </div>

                        {/* Operational Surfaces Card */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 dark:text-white">
                              <Activity className="w-4 h-4 text-amber-600" />
                              Operational Telemetry
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (infra.operational_exposure?.metrics_exposed || infra.operational_exposure?.debug_exposed || (infra.operational_exposure?.sensitive_actuators_count ?? 0) > 0)
                                ?"bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            }`}>
                              {(infra.operational_exposure?.metrics_exposed || infra.operational_exposure?.debug_exposed || (infra.operational_exposure?.sensitive_actuators_count ?? 0) > 0)
                                ?"Exposures Found"
                                :"Protected"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {(infra.operational_exposure?.metrics_exposed || infra.operational_exposure?.debug_exposed)
                              ?"Public Prometheus /metrics or Go runtime /debug/vars endpoints accessible without authentication."
                              :"Spring Boot Actuators, Prometheus telemetry, and Go runtime debug endpoints are restricted."}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 dark:border-slate-800">
                            <span>Sensitive Actuators:</span>
                            <span className="font-bold">{infra.operational_exposure?.sensitive_actuators_count ?? 0}</span>
                          </div>
                        </div>

                        {/* DNS & Subdomain Takeovers Card */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 dark:text-white">
                              <Box className="w-4 h-4 text-emerald-600" />
                              DNS & Takeover Posture
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              takeoverSignals.length > 0
                                ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            }`}>
                              {takeoverSignals.length > 0 ? `${takeoverSignals.length} Dangling CNAME` :"Clean"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {takeoverSignals.length > 0
                              ?"Dangling CNAME record points to an unallocated or unverified external SaaS host."
                              :"No dangling CNAME records pointing to known takeover-vulnerable SaaS providers."}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 dark:border-slate-800">
                            <span>IPv6 Dual-Stack:</span>
                            <span className="font-bold">{infra.dns_relationships?.ipv6_enabled ?"Enabled" :"IPv4 Only"}</span>
                          </div>
                        </div>

                        {/* Environment Posture Card */}
                        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5 dark:text-white">
                              <Server className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                              Environment Posture
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              environments.length > 0
                                ?"bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                                :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                            }`}>
                              {environments.length > 0 ? `${environments.length} Non-Prod Envs` :"Production"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {environments.length > 0
                              ? `Detected ${environments.map(e => e.type).join(", ")} environment indicators exposed on public hostnames.`
                              :"Origin presents pure production headers and DNS without staging/dev exposure signals."}
                          </p>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 dark:border-slate-800">
                            <span>Internal IP Leaks:</span>
                            <span className="font-bold">{infra.environment_summary?.internal_references_count ?? 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* Methodology & Limitations Note */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-500 space-y-1 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">Passive Intelligence Methodology & Guardrails:</div>
                        <p>
                          SiteSecura gathers infrastructure intelligence safely using passive header correlation, TLS certificate SAN inspection, public DNS record analysis, and strictly bounded HTTP probes (capped at 20 requests per scan).
                          Port scanning, UDP/TCP socket sweeps, cloud API credential validation, SSRF target invocation, and destructive payload injection are strictly prevented by design.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 2: CLOUD & HOSTING */}
                  {infraSubTab === "cloud" && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Cloud Infrastructure & Provider Fingerprinting
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Identified cloud hyperscalers, managed services, and serverless compute platforms.
                            </p>
                          </div>
                          {infra.cloud?.is_serverless && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800">
                              <Cpu className="w-3.5 h-3.5" />
                              Serverless Compute Detected
                            </span>
                          )}
                        </div>

                        {cloudProviders.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cloudProviders.map((provider, idx) => (
                              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 text-xs flex items-center gap-2 dark:text-white">
                                    <Cloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    {provider}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                                    Hyperscaler
                                  </span>
                                </div>
                                <div className="space-y-1 text-xs">
                                  <span className="text-slate-500 dark:text-slate-400">Associated Services:</span>
                                  <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                                    {cloudServices.map((svc, sIdx) => (
                                      <span key={sIdx} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 dark:bg-[#111C2E] dark:text-slate-300 dark:border-slate-800">
                                        {svc}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No major cloud hyperscaler signatures (AWS, GCP, Azure) detected. Host operates on traditional hardware or edge proxy.</span>
                          </div>
                        )}

                        {/* All Detected Infrastructure Providers Table */}
                        {allProviders.length > 0 && (
                          <div className="space-y-2 pt-2">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              All Detected Infrastructure Technologies ({allProviders.length})
                            </h5>
                            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                  <tr>
                                    <th className="py-2.5 px-4">Provider</th>
                                    <th className="py-2.5 px-4">Category</th>
                                    <th className="py-2.5 px-4">Confidence</th>
                                    <th className="py-2.5 px-4">Evidence</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {allProviders.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{item.provider}</td>
                                      <td className="py-2.5 px-4 text-slate-600 capitalize dark:text-slate-400">{item.category}</td>
                                      <td className="py-2.5 px-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          item.confidence === "high"
                                            ?"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                            :"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                        }`}>
                                          {item.confidence}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                        {item.evidence?.slice(0, 2).join(", ") || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Cloud Metadata References Warning Box */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                            <ShieldAlert className="w-4 h-4 text-amber-600" />
                            Cloud Instance Metadata References ({metadataRefs.length})
                          </h4>
                          <span className="text-[11px] text-slate-500 font-mono dark:text-slate-400">
                            SSRF Surface Inspection
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Identifies client-side JavaScript, environment templates, or sourcemaps containing cloud metadata IP addresses (e.g. <code className="bg-slate-100 px-1 rounded font-mono dark:bg-slate-800">169.254.169.254</code> or <code className="bg-slate-100 px-1 rounded font-mono dark:bg-slate-800">metadata.google.internal</code>).
                          SiteSecura does not execute network requests against these addresses.
                        </p>

                        {metadataRefs.length > 0 ? (
                          <div className="space-y-2">
                            {metadataRefs.map((ref, idx) => (
                              <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-200 space-y-1 text-xs dark:bg-red-950/40 dark:border-red-800">
                                <div className="flex items-center justify-between font-mono">
                                  <span className="font-bold text-red-900">{ref.service}</span>
                                  <span className="text-[11px] text-red-700 truncate max-w-xs dark:text-red-400">{ref.source}</span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded border border-red-100 dark:bg-[#111C2E] dark:text-slate-400 dark:border-red-800">
                                  {ref.context}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No cloud instance metadata references or SSRF endpoint templates detected in public client bundles.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 3: ORIGIN & EDGE */}
                  {infraSubTab === "origin" && (
                    <div className="space-y-6">
                      {/* CDN & Edge Details */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Content Delivery Network (CDN) & Edge Cache
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Analysis of reverse proxy routing, edge headers, and cache behavior.
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            infra.cdn?.detected
                              ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                              :"bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800"
                          }`}>
                            {infra.cdn?.detected ? `CDN: ${infra.cdn.provider || "Active"}` :"Direct Origin Hosting"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Edge Provider:</span>
                            <div className="font-bold text-slate-900 font-mono dark:text-white">{infra.cdn?.provider || "None (Direct)"}</div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Cache Behavior:</span>
                            <div className="font-bold text-slate-900 font-mono dark:text-white">{infra.cdn?.cache_behavior || "Uncached / Passthrough"}</div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Detection Confidence:</span>
                            <div className="font-bold text-slate-900 font-mono uppercase dark:text-white">{infra.cdn?.confidence || "N/A"}</div>
                          </div>
                        </div>

                        {infra.cdn?.edge_headers && infra.cdn.edge_headers.length > 0 && (
                          <div className="space-y-1.5 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">Observed Edge Headers:</span>
                            <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                              {infra.cdn.edge_headers.map((h, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                                  {h}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Origin Exposure Signals */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Origin Exposure & Edge Bypass Signals
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Detection of backend origin hostnames or direct IP addresses leaking past edge proxy layers.
                            </p>
                          </div>
                          {infra.origin?.signal_detected ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                              Origin Leak Detected
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                              Origin Protected
                            </span>
                          )}
                        </div>

                        {originSignals.length > 0 ? (
                          <div className="space-y-2">
                            {originSignals.map((sig, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1 text-xs dark:bg-amber-950/40 dark:border-amber-800">
                                <div className="flex items-center justify-between font-mono">
                                  <span className="font-bold text-amber-900">{sig.type}</span>
                                  {sig.header && <span className="text-[11px] text-slate-600 dark:text-slate-400">{sig.header}: {sig.value}</span>}
                                  {sig.hostname && <span className="text-[11px] text-slate-600 font-bold dark:text-slate-400">{sig.hostname}</span>}
                                </div>
                                <p className="text-slate-600 dark:text-slate-400">{sig.description}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Origin server IP and direct hostnames are safely hidden behind edge infrastructure. No bypass leaks observed.</span>
                          </div>
                        )}

                        {(originHostnames.length > 0 || originIps.length > 0) && (
                          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs dark:border-slate-800">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Disclosed Origin Identifiers:</span>
                            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                              {originHostnames.map((h, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                  Hostname: {h}
                                </span>
                              ))}
                              {originIps.map((ip, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                  IP: {ip}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 4: DEPLOYMENT & ENVIRONMENTS */}
                  {infraSubTab === "deployment" && (
                    <div className="space-y-6">
                      {/* Deployment Platform Details */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Deployment Platform Fingerprint
                          </h4>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                            {infra.deployment?.platform || "Standard Server"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Identification of modern automated deployment platforms (Vercel, Netlify, Render, Railway, Fly.io, GitHub Pages, etc.).
                        </p>
                        {infra.deployment?.evidence && infra.deployment.evidence.length > 0 && (
                          <div className="space-y-1 text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Platform Fingerprint Evidence:</span>
                            <div className="space-y-1 font-mono text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                              {infra.deployment.evidence.map((ev, idx) => (
                                <div key={idx}>• {ev}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Non-Production Environment Disclosure */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Non-Production Environments ({environments.length})
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Public exposure of staging, development, preview, or QA deployments.
                            </p>
                          </div>
                          {environments.length > 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                              {environments.length} Exposed
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                              Production Isolated
                            </span>
                          )}
                        </div>

                        {environments.length > 0 ? (
                          <div className="space-y-2">
                            {environments.map((env, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1 text-xs dark:bg-amber-950/40 dark:border-amber-800">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber-900 uppercase">{env.type} Environment</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-amber-200 text-amber-800 dark:bg-[#111C2E] dark:text-amber-400 dark:border-amber-800">
                                    {env.confidence} confidence
                                  </span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                  {env.evidence?.join(", ")}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No exposed non-production environments (staging, dev, test) detected on public hostnames.</span>
                          </div>
                        )}
                      </div>

                      {/* Internal Hostnames & Localhost References */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 dark:bg-[#111C2E] dark:border-slate-800">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Internal Network IP References (RFC 1918)
                          </h5>
                          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                            {infra.environment_summary?.internal_references_count ?? 0}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Occurrences of private internal IP ranges (10.x, 172.16-31.x, 192.168.x) observed in server responses or client scripts.
                          </p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2 dark:bg-[#111C2E] dark:border-slate-800">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Localhost References in Client Code
                          </h5>
                          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                            {infra.environment_summary?.localhost_references_count ?? 0}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Development references to <code className="bg-slate-100 px-1 rounded font-mono dark:bg-slate-800">localhost</code> or <code className="bg-slate-100 px-1 rounded font-mono dark:bg-slate-800">127.0.0.1</code> left in bundled frontend code.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 5: ARTIFACT EXPOSURE */}
                  {infraSubTab === "exposure" && (
                    <div className="space-y-6">
                      {/* Git Metadata Alert Card */}
                      <div className={`p-5 rounded-2xl border shadow-xs space-y-3 ${
                        infra.deployment?.git_exposed
                          ?"bg-red-50/60 border-red-200 dark:border-red-800"
                          :"bg-white border-slate-200/80 dark:bg-[#111C2E] dark:border-slate-800"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <GitBranch className={`w-5 h-5 ${infra.deployment?.git_exposed ?"text-red-600" :"text-emerald-600"}`} />
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Git Version Control Exposure Status
                            </h4>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            infra.deployment?.git_exposed
                              ?"bg-red-600 text-white animate-pulse"
                              :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                          }`}>
                            {infra.deployment?.git_exposed ?"CRITICAL EXPOSURE" :"Protected (404/403)"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-400">
                          {infra.deployment?.git_exposed
                            ?"CRITICAL SECURITY ALERT: The /.git/HEAD repository file is publicly accessible and returns valid Git repository metadata (e.g. 'ref: refs/heads/main'). Attackers can download your entire repository history, source code, and secrets using automated tools."
                            :"The /.git/ directory and /.git/HEAD file are safely protected and return 404 Not Found or 403 Forbidden. Public repository reconstruction attacks are prevented."}
                        </p>
                      </div>

                      {/* Container & Kubernetes Signals */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 dark:text-white">
                            <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            Container & Kubernetes Signals ({k8sSignals.length + dockerSignals.length})
                          </h4>
                          {infra.containers?.kubernetes_detected && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                              Kubernetes Environment
                            </span>
                          )}
                        </div>

                        {(k8sSignals.length > 0 || dockerSignals.length > 0) ? (
                          <div className="space-y-2">
                            {k8sSignals.map((sig, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs dark:bg-slate-800/40 dark:border-slate-800">
                                <div>
                                  <span className="font-bold text-indigo-700 dark:text-indigo-400">Kubernetes: {sig.type}</span>
                                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{sig.match}</div>
                                </div>
                                <span className="font-mono text-[11px] text-slate-400">{sig.source}</span>
                              </div>
                            ))}
                            {dockerSignals.map((sig, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs dark:bg-slate-800/40 dark:border-slate-800">
                                <div>
                                  <span className="font-bold text-sky-700 dark:text-sky-400">Docker: {sig.type}</span>
                                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{sig.match}</div>
                                </div>
                                <span className="font-mono text-[11px] text-slate-400">{sig.source}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Zero Kubernetes internal cluster hostnames or exposed Dockerfile build manifests discovered.</span>
                          </div>
                        )}
                      </div>

                      {/* Inspected Deployment Artifacts Table */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Audited Deployment Artifacts & Manifests ({artifacts.length})
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Bounded passive probes for package manifests, Git metadata, and container configurations.
                            </p>
                          </div>
                          <div className="relative w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Filter artifacts..."
                              value={infraSearch}
                              onChange={(e) => setInfraSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800/40 dark:border-slate-800"
                            />
                          </div>
                        </div>

                        {filteredArtifacts.length > 0 ? (
                          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-4">Artifact URL</th>
                                  <th className="py-2.5 px-4">Type</th>
                                  <th className="py-2.5 px-4">Description</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredArtifacts.map((art, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                                      {art.url}
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {art.type}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                                      {art.description}
                                      {art.sample && (
                                        <div className="mt-1 font-mono text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded truncate max-w-md dark:bg-slate-800/40 dark:text-slate-400">
                                          {art.sample}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            No matching deployment artifacts found.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 6: CLOUD STORAGE */}
                  {infraSubTab === "storage" && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Referenced Cloud Object Storage Buckets ({storageEndpoints.length})
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Passive catalog of AWS S3, Google Cloud Storage, Azure Blob, and Firebase Storage endpoints.
                            </p>
                          </div>
                          <div className="relative w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Filter storage buckets..."
                              value={infraSearch}
                              onChange={(e) => setInfraSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800/40 dark:border-slate-800"
                            />
                          </div>
                        </div>

                        {filteredStorage.length > 0 ? (
                          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-4">Provider</th>
                                  <th className="py-2.5 px-4">Bucket Name</th>
                                  <th className="py-2.5 px-4">Endpoint URL</th>
                                  <th className="py-2.5 px-4">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredStorage.map((ep, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{ep.provider}</td>
                                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">{ep.bucket}</td>
                                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 truncate max-w-xs dark:text-slate-400">{ep.url}</td>
                                    <td className="py-2.5 px-4">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        ep.is_sensitive
                                          ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                          :"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                      }`}>
                                        {ep.is_sensitive ?"Sensitive Object" :"Referenced"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Zero external cloud storage buckets or sensitive backup endpoints referenced on scanned pages.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 7: OPERATIONS & TELEMETRY */}
                  {infraSubTab === "operations" && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Operational Endpoints & Telemetry Surfaces ({operationalSurfaces.length})
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Audited health, metrics, debug, and administrative interfaces.
                            </p>
                          </div>
                          <div className="relative w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Filter operational surfaces..."
                              value={infraSearch}
                              onChange={(e) => setInfraSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800/40 dark:border-slate-800"
                            />
                          </div>
                        </div>

                        {/* Telemetry Status Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Prometheus Metrics:</span>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {infra.operational_exposure?.metrics_exposed ? (
                                <span className="text-red-600">Exposed (/metrics)</span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">Protected / None</span>
                              )}
                            </div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Runtime Debug Vars:</span>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {infra.operational_exposure?.debug_exposed ? (
                                <span className="text-red-600">Exposed (/debug/vars)</span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">Protected / None</span>
                              )}
                            </div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400">Sensitive Actuators:</span>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {(infra.operational_exposure?.sensitive_actuators_count ?? 0) > 0 ? (
                                <span className="text-red-600">{infra.operational_exposure?.sensitive_actuators_count} Actuator(s)</span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">Zero Exposed</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {filteredSurfaces.length > 0 ? (
                          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                                <tr>
                                  <th className="py-2.5 px-4">Endpoint</th>
                                  <th className="py-2.5 px-4">Type</th>
                                  <th className="py-2.5 px-4">Description</th>
                                  <th className="py-2.5 px-4">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredSurfaces.map((s, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                    <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-slate-900 dark:text-white">{s.url}</td>
                                    <td className="py-2.5 px-4">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {s.type}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">{s.description}</td>
                                    <td className="py-2.5 px-4">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        s.is_sensitive
                                          ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                                          :"bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800"
                                      }`}>
                                        {s.is_sensitive ?"Sensitive / Exposed" :"Audited"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Zero unauthenticated operational or telemetry interfaces exposed.</span>
                          </div>
                        )}

                        {/* Management Routes & Monitoring Tools */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 text-xs dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Management & Administration Routes:</span>
                            {managementRoutes.length > 0 ? (
                              <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                                {managementRoutes.map((r, idx) => (
                                  <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 dark:bg-[#111C2E] dark:text-slate-300 dark:border-slate-800">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-500 dark:text-slate-400">No public administration portals detected on standard paths.</p>
                            )}
                          </div>

                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 text-xs dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Discovered Monitoring & Tracing Tools:</span>
                            {monitoringTools.length > 0 ? (
                              <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                                {monitoringTools.map((t, idx) => (
                                  <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 dark:bg-[#111C2E] dark:text-slate-300 dark:border-slate-800">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-slate-500 dark:text-slate-400">No client-side monitoring SDK signatures (Sentry, Datadog) observed.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 8: TOPOLOGY & DNS */}
                  {infraSubTab === "relationships" && (
                    <div className="space-y-6">
                      {/* Architecture Relationship Chain Card */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Infrastructure Topology & Delivery Chain
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center text-center text-xs">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <div className="text-[10px] font-bold uppercase text-slate-400">Target</div>
                            <div className="font-bold text-slate-900 font-mono truncate dark:text-white">{website.normalized_domain}</div>
                          </div>
                          <div className="text-slate-400 font-bold hidden sm:block">→</div>
                          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1 dark:bg-indigo-950/40 dark:border-indigo-900">
                            <div className="text-[10px] font-bold uppercase text-indigo-400">Edge CDN</div>
                            <div className="font-bold text-indigo-900 font-mono truncate">
                              {infra.cdn?.provider || "Direct"}
                            </div>
                          </div>
                          <div className="text-slate-400 font-bold hidden sm:block">→</div>
                          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-1">
                            <div className="text-[10px] font-bold uppercase text-purple-400">Host / Engine</div>
                            <div className="font-bold text-purple-900 font-mono truncate">
                              {infra.deployment?.platform || cloudProviders[0] || "Origin Host"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Dual-Stack IPv4 / IPv6 Consistency */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            IPv4 / IPv6 Dual-Stack Configuration
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            infra.dns_relationships?.ipv6_enabled
                              ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                              :"bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800"
                          }`}>
                            {infra.dns_relationships?.ipv6_enabled ?"Dual-Stack Active" :"IPv4 Only"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 font-sans font-semibold dark:text-slate-400">IPv4 Addresses (A):</span>
                            <div>
                              {infra.dns_relationships?.ipv4_addresses?.length
                                ? infra.dns_relationships.ipv4_addresses.join(", ")
                                :"None recorded"}
                            </div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="text-slate-500 font-sans font-semibold dark:text-slate-400">IPv6 Addresses (AAAA):</span>
                            <div>
                              {infra.dns_relationships?.ipv6_addresses?.length
                                ? infra.dns_relationships.ipv6_addresses.join(", ")
                                :"None recorded"}
                            </div>
                          </div>
                        </div>

                        {infra.dns_relationships?.inconsistencies && infra.dns_relationships.inconsistencies.length > 0 && (
                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1 dark:bg-amber-950/40 dark:border-amber-800">
                            <span className="font-bold">Dual-Stack Inconsistency Warning:</span>
                            <div className="font-mono text-[11px]">
                              {infra.dns_relationships.inconsistencies.join("; ")}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Subdomain Takeover Risk Assessment */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            Subdomain Takeover Signal Analysis ({takeoverSignals.length})
                          </h4>
                          {takeoverSignals.length > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                              Dangling Signal Found
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                              Clean DNS
                            </span>
                          )}
                        </div>

                        {takeoverSignals.length > 0 ? (
                          <div className="space-y-2">
                            {takeoverSignals.map((sig, idx) => (
                              <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-200 text-xs space-y-1 dark:bg-red-950/40 dark:border-red-800">
                                <div className="flex items-center justify-between font-mono">
                                  <span className="font-bold text-red-900">{sig.provider} Takeover Signal</span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{sig.target_domain}</span>
                                </div>
                                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">CNAME: {sig.cname_target}</div>
                                <p className="text-slate-600 dark:text-slate-400">{sig.reason}</p>
                              </div>
                            ))}
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                              <strong>Verification Advisory:</strong> Potential dangling infrastructure signal detected. Further administrative verification is required to confirm whether the target resource is unallocated on the service provider.
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No dangling CNAME records pointing to known takeover-vulnerable SaaS providers detected.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* TAB CONTENT: DATA SECURITY, PRIVACY & SENSITIVE EXPOSURE (PHASE F7) */}
            {/* ========================================================================= */}
            {activeTab === "privacy" && (() => {
              const dataSec = metadata?.data_security;
              if (!dataSec) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto border border-teal-100">
                      <FileLock2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Advanced Data Security, Privacy & Sensitive Information Exposure
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                      This deep scan was generated on a previous version (Phase F1–F6). Phase F7 evaluates PII exposure, financial accounts & credit cards, health & location data, API data minimization, query parameter leaks, public document metadata, privacy policy governance disclosures, and third-party tracking / CMP compliance.
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Deep Scan with Phase F7 Security
                    </button>
                  </div>
                );
              }

              const pii = dataSec.pii || { personal_emails_count: 0, generic_emails_count: 0, phone_numbers_count: 0, government_ids_count: 0, personal_emails: [], generic_emails: [], phone_numbers: [], government_ids: [] };
              const fin = dataSec.financial || { cards_detected_count: 0, ibans_detected_count: 0, cvv_exposed: false, cards: [], ibans: [], cvv_signals: [] };
              const sens = dataSec.sensitive_data || { health_data_count: 0, location_data_count: 0, authentication_data_count: 0, health_records: [], locations: [], auth_records: [] };
              const apiData = dataSec.api_minimization || { endpoints_analyzed_count: 0, sensitive_fields_observed_count: 0, sensitive_fields: [], minimization_signals_count: 0, minimization_signals: [], cache_exposure_count: 0, cache_exposures: [] };
              const urlExp = dataSec.url_exposure || { pii_in_urls_count: 0, secrets_in_urls_count: 0, referrer_leakage_risks_count: 0, pii_parameters: [], secret_parameters: [], referrer_risks: [] };
              const forms = dataSec.forms || { forms_analyzed_count: 0, forms_with_sensitive_fields_count: 0, excessive_collection_forms_count: 0, form_evaluations: [] };
              const docs = dataSec.documents || { analyzed_documents_count: 0, documents_with_internal_metadata_count: 0, exposed_data_files_count: 0, documents: [], exposed_files: [] };
              const privacy = dataSec.privacy || { policy_present: false, gdpr_rights_mentioned: false, ccpa_mentioned: false, retention_period_disclosed: false, data_deletion_disclosed: false, access_request_disclosed: false, dpo_or_contact_email_present: false, disclosures_found: [] };
              const tracking = dataSec.tracking_and_consent || { consent_banner_detected: false, trackers_detected_count: 0, tracker_categories: {}, trackers: [], session_recording_detected: false, session_recording_tools: [], advertising_trackers_detected: false, advertising_tools: [], cookies_classified_count: 0, cookies_by_purpose: {}, tracker_before_consent_observed: false };
              const posture = dataSec.posture_matrix || { pii_exposure:"Not Detected", financial_exposure:"Not Detected", health_exposure:"Not Detected", auth_exposure:"Not Detected", privacy_policy:"Attention", consent_mechanism:"Not Detected", tracking_activity:"Not Detected", public_documents:"Not Detected" };
              const summary = dataSec.summary || { has_pii: false, has_financial_leak: false, has_health_leak: false, has_auth_leak: false, privacy_policy_present: false, consent_banner_present: false, active_trackers_count: 0, total_data_findings: 0 };

              const q = privacySearch.toLowerCase().trim();

              const getPostureColor = (val: string) => {
                switch (val) {
                  case "Risk":
                    return "bg-red-50 text-red-700 border-red-200";
                  case "Attention":
                    return "bg-amber-50 text-amber-700 border-amber-200";
                  case "Observed":
                    return "bg-emerald-50 text-emerald-700 border-emerald-200";
                  default:
                    return "bg-slate-50 text-slate-600 border-slate-200";
                }
              };

              return (
                <div className="space-y-6">
                  {/* Top Header Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900 dark:text-white">
                            Data Security, Privacy & Sensitive Exposure Posture
                          </h2>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            Phase F7
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                          Passive inspection of PII, financial identifiers, sensitive personal context, API minimization, query leakage, document metadata, privacy governance disclosures, and third-party trackers.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs px-2.5 py-1 rounded-lg font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                          {dataSec.status === "completed" ?"Analysis Complete" : dataSec.status}
                        </span>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {dataSec.requests_executed} HTTP Probes Executed
                        </span>
                      </div>
                    </div>

                    {/* Disclaimer Banner */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs flex items-start gap-2.5 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                      <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Notice on Regulatory Frameworks:</span> SiteSecura provides passive technical observations and risk signals to assist your security team. These findings do not constitute legal advice, compliance certification, or formal legal audits under GDPR, CCPA/CPRA, HIPAA, or PCI-DSS.
                      </div>
                    </div>

                    {/* Sub-Navigation Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {[
                        { id:"overview", label:"Overview & Matrix" },
                        { id:"pii", label: `PII & Identities (${pii.personal_emails_count + pii.phone_numbers_count + pii.government_ids_count})` },
                        { id:"api_data", label: `API & Response Data (${apiData.sensitive_fields_observed_count})` },
                        { id:"urls", label: `URLs & Query Leaks (${urlExp.pii_in_urls_count + urlExp.secrets_in_urls_count})` },
                        { id:"forms", label: `Form Data Collection (${forms.forms_analyzed_count})` },
                        { id:"documents", label: `Documents & Exports (${docs.documents_with_internal_metadata_count + docs.exposed_data_files_count})` },
                        { id:"governance", label:"Privacy Governance" },
                        { id:"tracking", label: `Tracking & Consent (${tracking.trackers_detected_count})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPrivacySubTab(tab.id as any)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            privacySubTab === tab.id
                              ?"bg-teal-600 text-white shadow-xs"
                              :"bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SUB-PANEL 1: OVERVIEW & POSTURE MATRIX */}
                  {privacySubTab === "overview" && (
                    <div className="space-y-6">
                      {/* Metric Stat Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">PII Exposure</div>
                          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                            {pii.personal_emails_count + pii.phone_numbers_count + pii.government_ids_count}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {pii.government_ids_count > 0 ? (
                              <span className="text-red-600 font-semibold">{pii.government_ids_count} Government IDs</span>
                            ) : pii.personal_emails_count > 0 ? (
                              <span className="text-amber-600">{pii.personal_emails_count} Personal Emails</span>
                            ) : (
                              "No personal leaks"
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Financial Signals</div>
                          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                            {fin.cards_detected_count + fin.ibans_detected_count}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {fin.cards_detected_count > 0 ? (
                              <span className="text-red-600 font-semibold">{fin.cards_detected_count} Luhn-Valid Cards</span>
                            ) : fin.ibans_detected_count > 0 ? (
                              <span className="text-red-600 font-semibold">{fin.ibans_detected_count} IBANs Found</span>
                            ) : (
                              "No card/bank leaks"
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Privacy Policy</div>
                          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                            {privacy.policy_present ?"Discovered" :"Missing"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {privacy.policy_present ? (
                              <span className="text-emerald-600">{privacy.disclosures_found.length} Disclosures</span>
                            ) : (
                              <span className="text-amber-600 font-semibold">No Policy Found</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Third-Party Trackers</div>
                          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                            {tracking.trackers_detected_count}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {tracking.session_recording_detected ? (
                              <span className="text-amber-600 font-semibold">Session Recording Active</span>
                            ) : tracking.consent_banner_detected ? (
                              <span className="text-emerald-600">CMP Banner Active</span>
                            ) : (
                              "Standard analytics"
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Informational Privacy Posture Matrix */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Informational Privacy Posture Matrix
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            High-level synthesized data governance dimensions
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {[
                            { key:"pii_exposure", title:"PII Exposure", status: posture.pii_exposure, desc:"Personal emails, phone numbers, or government IDs discovered in responses." },
                            { key:"financial_exposure", title:"Financial Exposure", status: posture.financial_exposure, desc:"Luhn-validated payment cards, bank accounts, or CVV disclosures." },
                            { key:"health_exposure", title:"Health / Sensitive", status: posture.health_exposure, desc:"Medical terms or precise GPS coordinates in responses." },
                            { key:"auth_exposure", title:"Authentication Secrets", status: posture.auth_exposure, desc:"Tokens, passwords, or credentials exposed in responses or URLs." },
                            { key:"privacy_policy", title:"Privacy Governance", status: posture.privacy_policy, desc:"Presence of a linked privacy statement and required disclosures." },
                            { key:"consent_mechanism", title:"Consent Management", status: posture.consent_mechanism, desc:"CMP banner presence and tracker-before-consent signals." },
                            { key:"tracking_activity", title:"Tracking Technology", status: posture.tracking_activity, desc:"Advertising pixels, analytics tags, or session replay scripts." },
                            { key:"public_documents", title:"Document Sanitization", status: posture.public_documents, desc:"Internal metadata in PDFs, bulk data exports, or logs." },
                          ].map((item) => (
                            <div key={item.key} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.title}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPostureColor(item.status)}`}>
                                  {item.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-normal dark:text-slate-400">
                                {item.desc}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 2: PII & IDENTITIES */}
                  {privacySubTab === "pii" && (
                    <div className="space-y-6">
                      {/* Government IDs */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Government Identifiers ({pii.government_ids_count})
                            </h3>
                            {pii.government_ids_count > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                High Risk Exposure
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">SSN, National IDs, Aadhaar, PAN</span>
                        </div>

                        {pii.government_ids.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No government identification numbers detected across analyzed responses.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pii.government_ids.map((gid, idx) => (
                              <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 dark:bg-red-950/40 dark:border-red-800">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-red-900 uppercase font-mono">{gid.type}</span>
                                    <span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono font-semibold dark:text-red-400">
                                      {gid.masked_id}
                                    </span>
                                    <span className="text-[10px] text-red-700 uppercase font-bold tracking-wider dark:text-red-400">
                                      {gid.country}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-mono break-all dark:text-slate-400">
                                    {gid.page_url}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Personal Email Addresses */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Personal Email Addresses ({pii.personal_emails_count})
                            </h3>
                            {pii.personal_emails_count > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                Attention
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Excludes generic info/support/sales</span>
                        </div>

                        {pii.personal_emails.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No individual personal email addresses detected in public HTML content.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pii.personal_emails.map((pe, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                    {pe.masked_email}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono break-all dark:text-slate-400">
                                    Found on: {pe.page_url}
                                  </div>
                                </div>
                                {pe.context && (
                                  <span className="text-[11px] text-slate-500 italic bg-white px-2 py-1 rounded border border-slate-200 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800">
                                    "{pe.context}"
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Phone Numbers */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Phone Numbers ({pii.phone_numbers_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">International E.164 and local formats</span>
                        </div>

                        {pii.phone_numbers.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            <Info className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>No phone numbers extracted from analyzed pages.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {pii.phone_numbers.map((ph, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{ph.masked_phone}</span>
                                  {ph.country_hint && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:text-slate-300">
                                      {ph.country_hint}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono break-all truncate dark:text-slate-400">
                                  {ph.page_url}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Financial Card & Bank Accounts */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Payment Cards & Bank Identifiers ({fin.cards_detected_count + fin.ibans_detected_count})
                            </h3>
                            {(fin.cards_detected_count > 0 || fin.ibans_detected_count > 0) && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
                                High Risk
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Luhn-validated PAN & IBAN discovery</span>
                        </div>

                        {fin.cards_detected_count === 0 && fin.ibans_detected_count === 0 && !fin.cvv_exposed ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No payment card numbers or bank account identifiers detected.</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {fin.cards.map((card, idx) => (
                              <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 dark:bg-red-950/40 dark:border-red-800">
                                <div>
                                  <span className="font-bold text-red-900 mr-2">{card.card_brand}</span>
                                  <span className="font-mono font-semibold text-red-800 dark:text-red-400">{card.masked_number}</span>
                                  <div className="text-[11px] text-slate-600 font-mono break-all dark:text-slate-400">{card.page_url}</div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold uppercase dark:text-red-400">
                                  Luhn Validated
                                </span>
                              </div>
                            ))}
                            {fin.ibans.map((iban, idx) => (
                              <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 dark:bg-red-950/40 dark:border-red-800">
                                <div>
                                  <span className="font-bold text-red-900 mr-2">IBAN ({iban.country_code})</span>
                                  <span className="font-mono font-semibold text-red-800 dark:text-red-400">{iban.masked_iban}</span>
                                  <div className="text-[11px] text-slate-600 font-mono break-all dark:text-slate-400">{iban.page_url}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 3: API & RESPONSE DATA */}
                  {privacySubTab === "api_data" && (
                    <div className="space-y-6">
                      {/* Sensitive JSON Fields */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Sensitive Response Fields ({apiData.sensitive_fields_observed_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Observed across JSON endpoints</span>
                        </div>

                        {apiData.sensitive_fields.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No sensitive identity, health, or credential fields detected in API payloads.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {apiData.sensitive_fields.map((f, idx) => (
                              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 dark:bg-slate-800/40 dark:border-slate-800">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{f.field_name}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold uppercase dark:bg-indigo-950/40 dark:text-indigo-400">
                                      {f.category}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono break-all dark:text-slate-400">{f.url}</div>
                                </div>
                                <span className="font-mono text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800">
                                  {f.masked_sample}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Data Minimization Signals */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Data Minimization Signals ({apiData.minimization_signals_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Unneeded user properties in responses</span>
                        </div>

                        {apiData.minimization_signals.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No excessive data exposure or over-fetching patterns detected.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {apiData.minimization_signals.map((sig, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 text-xs space-y-1">
                                <div className="font-bold text-amber-900">{sig.message}</div>
                                <div className="text-[11px] text-slate-600 font-mono break-all dark:text-slate-400">{sig.url}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Intermediate Cache Exposure */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Cache-Control on Sensitive Endpoints ({apiData.cache_exposure_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Checks for public caching of sensitive data</span>
                        </div>

                        {apiData.cache_exposures.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Sensitive endpoints correctly instruct intermediate caches not to store data publicly.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {apiData.cache_exposures.map((ce, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="font-mono text-slate-800 break-all dark:text-slate-200">{ce.url}</div>
                                <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded dark:text-amber-400">
                                  {ce.cache_control}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 4: URLS & QUERY LEAKS */}
                  {privacySubTab === "urls" && (
                    <div className="space-y-6">
                      {/* PII & Secrets in Query Parameters */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Sensitive Query Parameters ({urlExp.pii_in_urls_count + urlExp.secrets_in_urls_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Transmitted via GET query strings</span>
                        </div>

                        {urlExp.pii_in_urls_count === 0 && urlExp.secrets_in_urls_count === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No PII or authentication secrets observed in URL query strings.</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {urlExp.pii_parameters.map((p, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <span className="font-bold text-amber-900 mr-2 font-mono">?{p.param_name}=</span>
                                  <span className="font-mono text-slate-700 dark:text-slate-300">{p.masked_value}</span>
                                  <div className="text-[11px] text-slate-500 font-mono break-all dark:text-slate-400">{p.url}</div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase dark:text-amber-400">
                                  PII in URL
                                </span>
                              </div>
                            ))}
                            {urlExp.secret_parameters.map((s, idx) => (
                              <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 dark:bg-red-950/40 dark:border-red-800">
                                <div>
                                  <span className="font-bold text-red-900 mr-2 font-mono">?{s.param_name}=</span>
                                  <span className="font-mono text-red-700 dark:text-red-400">{s.masked_value}</span>
                                  <div className="text-[11px] text-slate-500 font-mono break-all dark:text-slate-400">{s.url}</div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold uppercase dark:text-red-400">
                                  Secret in URL
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Referrer Leakage Risks */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Referrer Leakage Risks ({urlExp.referrer_leakage_risks_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Query parameters vulnerable to external referrer transmission</span>
                        </div>

                        {urlExp.referrer_risks.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Referrer policy adequately protects sensitive query parameters from third-party leakage.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {urlExp.referrer_risks.map((ref, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">Param: {ref.sensitive_param}</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:text-slate-300">
                                    Policy: {ref.referrer_policy || "unsafe/default"}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono break-all dark:text-slate-400">{ref.url}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 5: FORMS & DATA COLLECTION */}
                  {privacySubTab === "forms" && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Forms Evaluated ({forms.forms_analyzed_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {forms.forms_with_sensitive_fields_count} capture sensitive data
                          </span>
                        </div>

                        {forms.form_evaluations.length === 0 ? (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                            <Info className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>No web forms discovered on crawled pages.</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {forms.form_evaluations.map((fm, idx) => (
                              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 font-mono dark:text-slate-200">{fm.method}</span>
                                    <span className="font-mono text-slate-600 truncate max-w-md dark:text-slate-400">{fm.action || "(same page)"}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {fm.excessive_warning && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                        Excessive Collection
                                      </span>
                                    )}
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                      {fm.fields_count} Inputs
                                    </span>
                                  </div>
                                </div>

                                {fm.sensitive_fields && fm.sensitive_fields.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[11px] text-slate-500 font-semibold mr-1 dark:text-slate-400">Sensitive Fields:</span>
                                    {fm.sensitive_fields.map((fld, fIdx) => (
                                      <span key={fIdx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                                        {fld}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-[11px] text-slate-400 font-mono break-all">{fm.page_url}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 6: DOCUMENTS & EXPORTS */}
                  {privacySubTab === "documents" && (
                    <div className="space-y-6">
                      {/* PDF Internal Metadata */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Documents with Internal Metadata ({docs.documents_with_internal_metadata_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Internal paths & author disclosure</span>
                        </div>

                        {docs.documents.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No internal filesystem paths or infrastructure details detected in published PDFs.</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {docs.documents.map((doc, idx) => (
                              <div key={idx} className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-slate-800 break-all dark:text-slate-200">{doc.url}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase dark:text-amber-400">
                                    {doc.type}
                                  </span>
                                </div>
                                {doc.author && (
                                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Author: <span className="font-semibold">{doc.author}</span></div>
                                )}
                                {doc.internal_paths && doc.internal_paths.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] text-slate-500 font-semibold dark:text-slate-400">Exposed Internal Paths:</div>
                                    {doc.internal_paths.map((p, pIdx) => (
                                      <div key={pIdx} className="font-mono text-[11px] text-red-700 bg-white p-1 rounded border border-red-100 dark:bg-[#111C2E] dark:text-red-400 dark:border-red-800">
                                        {p}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Exposed Data, Backup & Log Files */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Exposed Backups, Dumps & Logs ({docs.exposed_data_files_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">CSV exports, SQL dumps, log files</span>
                        </div>

                        {docs.exposed_files.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No publicly accessible database backups, raw data dumps, or server log files discovered.</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {docs.exposed_files.map((ef, idx) => (
                              <div key={idx} className="p-3 bg-red-50/50 rounded-xl border border-red-200 text-xs space-y-1 dark:bg-red-950/40 dark:border-red-800">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-red-900 break-all">{ef.url}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 uppercase dark:text-red-400">
                                    {ef.type}
                                  </span>
                                </div>
                                {ef.content_sample && (
                                  <pre className="font-mono text-[10px] bg-white p-2 rounded border border-red-100 text-slate-700 overflow-x-auto dark:bg-[#111C2E] dark:text-slate-300 dark:border-red-800">
                                    {ef.content_sample}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 7: PRIVACY GOVERNANCE */}
                  {privacySubTab === "governance" && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Privacy Policy Governance Analysis
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {privacy.policy_present ? (
                                <>Discovered policy at: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{privacy.policy_url}</span></>
                              ) : (
                                "No public privacy policy link detected across crawled pages"
                              )}
                            </p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
                            privacy.policy_present ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" :"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                          }`}>
                            {privacy.policy_present ?"Policy Discovered" :"Missing Policy"}
                          </span>
                        </div>

                        {/* Governance Checklist */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          {[
                            { label:"GDPR User Rights Mentioned", present: privacy.gdpr_rights_mentioned, detail:"Access, rectification, erasure, portability, or restriction rights" },
                            { label:"CCPA / CPRA Notice & Opt-Out", present: privacy.ccpa_mentioned, detail:"California privacy disclosures or 'Do Not Sell' opt-out terms" },
                            { label:"Data Retention Period Disclosed", present: privacy.retention_period_disclosed, detail:"Explicit storage periods or criteria for personal data retention" },
                            { label:"Data Deletion / Erasure Process", present: privacy.data_deletion_disclosed, detail:"Instructions for requesting account or data deletion" },
                            { label:"Subject Access Request (SAR) Procedure", present: privacy.access_request_disclosed, detail:"Channel or email to exercise personal data access requests" },
                            { label:"DPO / Privacy Contact Email", present: privacy.dpo_or_contact_email_present, detail: privacy.dpo_contact || "Designated privacy or legal contact" },
                          ].map((item, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 dark:bg-slate-800/40 dark:border-slate-800">
                              {item.present ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              )}
                              <div className="space-y-0.5">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.detail}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Disclosures Tag Pills */}
                        {privacy.disclosures_found && privacy.disclosures_found.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Observed Disclosure Signals:</span>
                            <div className="flex flex-wrap gap-2">
                              {privacy.disclosures_found.map((disc, idx) => (
                                <span key={idx} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                                  {disc}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 8: TRACKING & CONSENT */}
                  {privacySubTab === "tracking" && (
                    <div className="space-y-6">
                      {/* Consent Management Banner */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              Consent Management Platform (CMP)
                            </h3>
                            {tracking.consent_banner_detected ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                CMP Detected
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                                No CMP Detected
                              </span>
                            )}
                          </div>
                          {tracking.cmp_provider && (
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                              {tracking.cmp_provider}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Tracker-Before-Consent Signal:</span>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {tracking.tracker_before_consent_observed ? (
                                <span className="text-amber-700 font-semibold dark:text-amber-400">Trackers observed executing without prior user consent gate.</span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400">No premature tracker execution observed prior to interaction.</span>
                              )}
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Session Recording Tools:</span>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {tracking.session_recording_detected ? (
                                <span className="text-amber-700 font-semibold dark:text-amber-400">{tracking.session_recording_tools.join(", ")} active</span>
                              ) : (
                                "No session replay tools (Hotjar, Clarity, FullStory) detected."
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Third-Party Trackers Table */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Third-Party Trackers & Scripts ({tracking.trackers_detected_count})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Categorized by privacy purpose</span>
                        </div>

                        {tracking.trackers.length === 0 ? (
                          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>No third-party advertising or analytics trackers detected on analyzed pages.</span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 dark:text-slate-400 dark:border-slate-800">
                                  <th className="pb-2 font-semibold">Service Name</th>
                                  <th className="pb-2 font-semibold">Category</th>
                                  <th className="pb-2 font-semibold">Domain</th>
                                  <th className="pb-2 font-semibold">Privacy Purpose</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {tracking.trackers.map((tr, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{tr.name}</td>
                                    <td className="py-2.5">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {tr.category}
                                      </span>
                                    </td>
                                    <td className="py-2.5 font-mono text-slate-600 dark:text-slate-400">{tr.domain}</td>
                                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{tr.purpose}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* TAB CONTENT: SECURITY INTELLIGENCE, CORRELATION & RISK GRAPH (PHASE F8) */}
            {/* ========================================================================= */}
            {activeTab === "risk_intelligence" && (() => {
              const riskData = metadata?.risk_intelligence;
              if (!riskData || riskData.status === "failed") {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-3 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto border border-violet-100">
                      <Network className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Security Correlation & Risk Intelligence Unavailable
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                      This deep scan was generated on a previous version (Phase F1–F7). Phase F8 evaluates cross-phase security correlations, compound risk chains, systemic root causes, high-attention assets, and an interactive attack-surface relationship graph.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartDeepScan}
                      disabled={startingScan}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run Deep Scan with Phase F8 Intelligence
                    </button>
                  </div>
                );
              }

              const posture = riskData.executive_posture || {};
              const attackSurface = riskData.attack_surface || { metrics: {}, exposure_concentration: {}, high_attention_assets: [] };
              const chains = riskData.risk_chains || [];
              const rootCauses = riskData.root_causes || [];
              const priorityActions = riskData.priority_actions || [];
              const roadmap = riskData.remediation_roadmap || { immediate: [], short_term: [], medium_term: [], long_term: [] };
              const graph = riskData.graph || { nodes: [], edges: [], node_count: 0, edge_count: 0 };
              const positiveSignals = riskData.positive_signals || [];

              const filteredChains = chains.filter((c: any) =>
                !riskSearch ||
                c.title?.toLowerCase().includes(riskSearch.toLowerCase()) ||
                c.description?.toLowerCase().includes(riskSearch.toLowerCase()) ||
                c.check_type?.toLowerCase().includes(riskSearch.toLowerCase())
              );

              return (
                <div className="space-y-6">
                  {/* PHASE F8 BANNER */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 dark:bg-[#111C2E] dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          Security Correlation, Attack-Surface Risk Graph & Executive Posture
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          Phase F8 — Final Intelligence Layer
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 max-w-2xl dark:text-slate-400">
                        Synthesizes multi-phase evidence (F1–F7) into compound security risk chains, systemic root causes, high-attention assets, and a prioritized remediation roadmap without active exploitation.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-800">
                        <Workflow className="w-3.5 h-3.5 text-violet-600" />
                        <span>{chains.length} Risk Chains</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-800">
                        <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{rootCauses.length} Root Causes</span>
                      </div>
                    </div>
                  </div>

                  {/* SUB-TABS NAVIGATION */}
                  <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px text-xs font-semibold text-slate-600 dark:text-slate-400 dark:border-slate-800">
                    {[
                      { id:"overview", label:"Executive Posture", count: positiveSignals.length, badgeColor:"bg-emerald-100 text-emerald-800 dark:text-emerald-400" },
                      { id:"graph", label:"Security Graph", count: graph.node_count, badgeColor:"bg-violet-100 text-violet-800" },
                      { id:"chains", label:"Risk Chains", count: chains.length, badgeColor:"bg-amber-100 text-amber-800 dark:text-amber-400" },
                      { id:"root_causes", label:"Root Causes", count: rootCauses.length, badgeColor:"bg-indigo-100 text-indigo-800" },
                      { id:"roadmap", label:"Remediation Roadmap", count: priorityActions.length, badgeColor:"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
                      { id:"assets", label:"Attack Surface & Assets", count: attackSurface.high_attention_assets?.length || 0, badgeColor:"bg-blue-100 text-blue-800" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRiskSubTab(tab.id as any)}
                        className={`pb-2.5 px-3 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                          riskSubTab === tab.id
                            ?"border-violet-600 text-violet-700 font-bold"
                            :"border-transparent hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${tab.badgeColor}`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* SUB-PANEL 1: EXECUTIVE POSTURE & OVERVIEW */}
                  {riskSubTab === "overview" && (
                    <div className="space-y-6">
                      {/* Score Context & Narrative Card */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center text-indigo-700 shrink-0 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                              <span className="text-xl font-black">{currentScan?.score ?? 100}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500">/ 100</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Deterministic Security Posture Rating</h3>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  (currentScan?.score ?? 100) >= 80 ?"bg-emerald-100 text-emerald-800 dark:text-emerald-400" :
                                  (currentScan?.score ?? 100) >= 60 ?"bg-amber-100 text-amber-800 dark:text-amber-400" :"bg-red-100 text-red-800 dark:text-red-400"
                                }`}>
                                  {currentScan?.risk_level || "Good"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
                                Grounded in {currentScan?.total_checks_count ?? 0} defensive security benchmarks across 7 multi-page audit categories.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Narrative Score Context */}
                        <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/70 text-xs text-slate-700 space-y-2 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-800">
                          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                            <Sparkles className="w-4 h-4 text-violet-600" />
                            <span>Executive Security Intelligence Summary</span>
                          </div>
                          <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                            {posture.score_explanation || "Scan completed with deterministic baseline evaluation across transport, headers, client-side, API, identity, and data layers."}
                          </p>
                        </div>
                      </div>

                      {/* Posture Dimensions Matrix */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Defense-in-Depth Posture Dimensions</h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Evaluated across all architectural tiers</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(posture.posture_dimensions || {}).map(([key, dim]: [string, any]) => {
                            const isOptimal = dim.rating === "SOLID";
                            const isCrit = dim.rating === "CRITICAL_GAPS";
                            const isWarning = dim.rating === "NEEDS_ATTENTION";
                            return (
                              <div key={key} className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-1.5 dark:bg-slate-800/40 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800 capitalize dark:text-slate-200">
                                    {key.replace(/_/g, " ")}
                                  </span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    isOptimal ?"bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" :
                                    isCrit ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" :
                                    isWarning ?"bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" :
                                    "bg-slate-100 text-slate-700"
                                  }`}>
                                    {dim.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{dim.summary}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Positive Defensive Signals (Strengths) */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Observed Positive Defensive Controls</h3>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Verified strengths in your deployment</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {positiveSignals.map((sig: any, idx: number) => (
                            <div key={idx} className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 text-xs space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{sig.title}</span>
                              </div>
                              <p className="text-[11px] text-emerald-700 pl-5 dark:text-emerald-400">{sig.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Non-Exploitation Disclaimers */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-1 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                        <div className="font-semibold text-slate-700 flex items-center gap-1.5 dark:text-slate-300">
                          <Info className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>Assessment Boundaries & Methodology</span>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1">
                          {(posture.limitations || []).map((lim: string, idx: number) => (
                            <li key={idx}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 2: INTERACTIVE SECURITY RELATIONSHIP GRAPH */}
                  {riskSubTab === "graph" && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Security Relationship Graph</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Visual representation of attack surface entities, infrastructure components, and correlated security findings.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 font-bold border border-violet-200">
                              {graph.node_count} Entities
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold dark:bg-slate-800 dark:text-slate-300">
                              {graph.edge_count} Relationships
                            </span>
                          </div>
                        </div>

                        {/* Graph Legend */}
                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Entity Types:</span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span> Website Root
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span> Perimeter / CDN / Cloud
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> API / Endpoints
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Admin / Auth Surface
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span> Documents & Storage
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Security Findings
                          </span>
                        </div>

                        {/* Interactive Graph Canvas / Nodes Explorer */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* Nodes Grid */}
                          <div className="lg:col-span-2 p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 space-y-4 min-h-[360px] max-h-[500px] overflow-y-auto">
                            <div className="text-[11px] text-slate-400 flex items-center justify-between border-b border-slate-800 pb-2">
                              <span>Select any entity node to inspect connected relationships and findings:</span>
                              {graph.graph_truncated && (
                                <span className="text-amber-400 font-bold text-[10px]">Graph bounded at {graph.max_nodes_configured} nodes</span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {graph.nodes.map((node: any) => {
                                const isSelected = selectedGraphNode?.id === node.id;
                                let nodeBg = "bg-slate-800 border-slate-700 text-slate-300";
                                if (node.type === "website") nodeBg = "bg-indigo-950 border-indigo-600 text-indigo-200";
                                else if (node.type === "cdn" || node.type === "cloud_provider") nodeBg = "bg-cyan-950 border-cyan-600 text-cyan-200";
                                else if (node.type === "api") nodeBg = "bg-emerald-950 border-emerald-600 text-emerald-200";
                                else if (node.type === "admin_surface" || node.type === "auth_surface") nodeBg = "bg-purple-950 border-purple-600 text-purple-200";
                                else if (node.type === "document" || node.type === "storage_bucket") nodeBg = "bg-amber-950 border-amber-600 text-amber-200";
                                else if (node.type === "finding") nodeBg = "bg-red-950 border-red-600 text-red-200";

                                return (
                                  <button
                                    key={node.id}
                                    type="button"
                                    onClick={() => setSelectedGraphNode(node)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 ${nodeBg} ${
                                      isSelected ?"ring-2 ring-white scale-105 font-bold shadow-lg" :"hover:border-slate-400"
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    <span>{node.label}</span>
                                    {node.finding_ids?.length > 0 && (
                                      <span className="text-[10px] px-1 rounded bg-black/40 text-red-300 font-bold">
                                        {node.finding_ids.length}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Node Inspector Panel */}
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 dark:bg-slate-800/40 dark:border-slate-800">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider dark:text-white">
                              Entity Inspector
                            </h4>
                            {selectedGraphNode ? (
                              <div className="space-y-3 text-xs">
                                <div>
                                  <span className="text-slate-500 font-medium dark:text-slate-400">Label:</span>
                                  <div className="font-mono font-bold text-slate-800 break-all dark:text-slate-200">{selectedGraphNode.label}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-slate-500 font-medium dark:text-slate-400">Type:</span>
                                    <div className="font-semibold text-slate-700 capitalize dark:text-slate-300">{selectedGraphNode.type.replace(/_/g, " ")}</div>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 font-medium dark:text-slate-400">Source Phase:</span>
                                    <div className="font-semibold text-indigo-700 dark:text-indigo-400">{selectedGraphNode.phase || "F1 Discovery"}</div>
                                  </div>
                                </div>

                                {/* Relationships for this node */}
                                <div>
                                  <span className="text-slate-500 font-medium dark:text-slate-400">Active Relationships:</span>
                                  <div className="space-y-1 mt-1">
                                    {graph.edges
                                      .filter((e: any) => e.source === selectedGraphNode.id || e.target === selectedGraphNode.id)
                                      .slice(0, 6)
                                      .map((edge: any, idx: number) => {
                                        const isOutbound = edge.source === selectedGraphNode.id;
                                        return (
                                          <div key={idx} className="p-1.5 bg-white rounded border border-slate-200 text-[11px] font-mono text-slate-600 flex items-center justify-between dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800">
                                            <span>{isOutbound ? `→ ${edge.relationship}` : `← ${edge.relationship}`}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{edge.confidence}</span>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>

                                {selectedGraphNode.metadata && Object.keys(selectedGraphNode.metadata).length > 0 && (
                                  <div>
                                    <span className="text-slate-500 font-medium dark:text-slate-400">Telemetry Details:</span>
                                    <pre className="mt-1 p-2 bg-white rounded border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto max-h-32 dark:bg-[#111C2E] dark:text-slate-400 dark:border-slate-800">
                                      {JSON.stringify(selectedGraphNode.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="py-8 text-center text-slate-400 space-y-2">
                                <Network className="w-8 h-8 mx-auto text-slate-300" />
                                <p className="text-xs">Click on any node in the graph canvas to inspect its technical details, relationships, and attached findings.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 3: CORRELATED RISK CHAINS */}
                  {riskSubTab === "chains" && (
                    <div className="space-y-4">
                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={riskSearch}
                          onChange={(e) => setRiskSearch(e.target.value)}
                          placeholder="Filter risk chains by title, description, or keyword..."
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-violet-500 dark:bg-[#111C2E] dark:border-slate-800"
                        />
                      </div>

                      {filteredChains.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-2 shadow-xs dark:bg-[#111C2E] dark:border-slate-800">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Compound Risk Chains Detected</h4>
                          <p className="text-xs text-slate-500 max-w-md mx-auto dark:text-slate-400">
                            No high-risk combinations of multi-phase findings (e.g. public API + PII, admin + weak auth, source maps + secrets) were identified on the target website.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredChains.map((chain: any) => {
                            const isCrit = chain.severity?.toLowerCase() === "critical";
                            const isHigh = chain.severity?.toLowerCase() === "high";
                            const sevColor = isCrit ?"bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" : isHigh ?"bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" :"bg-blue-50 text-blue-700 border-blue-200";

                            return (
                              <div key={chain.chain_id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 hover:border-slate-300 transition-colors dark:bg-[#111C2E] dark:border-slate-800 dark:hover:border-slate-700">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{chain.title}</h4>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${sevColor}`}>
                                      {chain.severity}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      Confidence: {chain.confidence}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {(chain.source_phases || []).map((ph: string, pIdx: number) => (
                                      <span key={pIdx} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                                        Phase {ph}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-400">
                                  {chain.description}
                                </p>

                                {/* Affected Assets & Evidence */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-slate-500 font-medium dark:text-slate-400">Affected Assets:</span>
                                    {(chain.affected_assets || []).length > 0 ? (
                                      chain.affected_assets.map((ast: string, aIdx: number) => (
                                        <span key={aIdx} className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                          {ast}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">Root Host</span>
                                    )}
                                  </div>
                                  <span className="text-slate-500 text-[11px] dark:text-slate-400">
                                    {chain.evidence_count || chain.evidence_findings?.length || 0} correlated observations
                                  </span>
                                </div>

                                {/* Recommendation Banner */}
                                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs dark:bg-indigo-950/40 dark:border-indigo-900">
                                  <div className="space-y-0.5">
                                    <span className="font-bold text-indigo-900">Recommended Action:</span>
                                    <p className="text-indigo-800 text-[11px]">{chain.recommendation}</p>
                                  </div>
                                  <Link
                                    href="/blog/website-vulnerability-scanning-guide"
                                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors dark:bg-[#111C2E] dark:text-indigo-400 dark:border-indigo-900"
                                  >
                                    <span>Knowledge Base</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-PANEL 4: SYSTEMIC ROOT CAUSES */}
                  {riskSubTab === "root_causes" && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2 dark:bg-[#111C2E] dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Systemic Root Cause Groupings</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Rather than remediating individual security findings as isolated symptoms, addressing these underlying systemic causes will resolve multiple related vulnerabilities simultaneously.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rootCauses.map((rc: any) => (
                          <div key={rc.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 flex flex-col justify-between dark:bg-[#111C2E] dark:border-slate-800">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{rc.title}</h4>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  rc.severity === "critical" ?"bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800" :
                                  rc.severity === "high" ?"bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" :
                                  "bg-slate-100 text-slate-700"
                                }`}>
                                  {rc.findings_count} Findings
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-400">
                                {rc.description}
                              </p>
                            </div>

                            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                                <span className="font-bold text-slate-800 dark:text-slate-200">Architectural Remediation:</span>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400">{rc.recommended_action}</p>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>Confidence: <b>{rc.confidence}</b></span>
                                <Link
                                  href="/blog/website-vulnerability-scanning-guide"
                                  className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                  <span>Remediation Guide</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 5: REMEDIATION ROADMAP */}
                  {riskSubTab === "roadmap" && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-2 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Security Improvement Roadmap</h3>
                          <span className="text-xs text-slate-500 font-semibold dark:text-slate-400">{priorityActions.length} prioritized actions</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Structured by business urgency and compound exposure impact. Focus on Immediate actions first to dismantle critical attack paths.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Immediate */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs font-bold text-red-900 dark:bg-red-950/40 dark:border-red-800">
                            <span>Immediate Actions</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-red-200 text-red-900 text-[10px]">
                              {roadmap.immediate?.length || 0}
                            </span>
                          </div>
                          {(!roadmap.immediate || roadmap.immediate.length === 0) ? (
                            <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400 dark:bg-[#111C2E] dark:border-slate-800">
                              No immediate blocking issues.
                            </div>
                          ) : (
                            roadmap.immediate.map((act: any, idx: number) => (
                              <div key={idx} className="p-3.5 bg-white rounded-xl border border-red-200 shadow-xs space-y-2 text-xs dark:bg-[#111C2E] dark:border-red-800">
                                <div className="font-bold text-slate-900 dark:text-white">{act.title}</div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{act.reason}</p>
                                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                                  <span>Est: ~{act.estimated_minutes}m</span>
                                  <span className="font-semibold text-red-600">Urgent</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* High Priority */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:border-amber-800">
                            <span>High Priority</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px]">
                              {roadmap.short_term?.length || 0}
                            </span>
                          </div>
                          {(!roadmap.short_term || roadmap.short_term.length === 0) ? (
                            <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400 dark:bg-[#111C2E] dark:border-slate-800">
                              No high priority actions.
                            </div>
                          ) : (
                            roadmap.short_term.map((act: any, idx: number) => (
                              <div key={idx} className="p-3.5 bg-white rounded-xl border border-amber-200 shadow-xs space-y-2 text-xs dark:bg-[#111C2E] dark:border-amber-800">
                                <div className="font-bold text-slate-900 dark:text-white">{act.title}</div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{act.reason}</p>
                                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                                  <span>Est: ~{act.estimated_minutes}m</span>
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">Recommended</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Normal Priority */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-xs font-bold text-blue-900">
                            <span>Medium Term</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-blue-200 text-blue-900 text-[10px]">
                              {roadmap.medium_term?.length || 0}
                            </span>
                          </div>
                          {(!roadmap.medium_term || roadmap.medium_term.length === 0) ? (
                            <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400 dark:bg-[#111C2E] dark:border-slate-800">
                              No medium term actions.
                            </div>
                          ) : (
                            roadmap.medium_term.map((act: any, idx: number) => (
                              <div key={idx} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="font-bold text-slate-900 dark:text-white">{act.title}</div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{act.reason}</p>
                                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                                  <span>Est: ~{act.estimated_minutes}m</span>
                                  <span className="text-slate-600 dark:text-slate-400">Standard</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Long Term */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-800">
                            <span>Hardening</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 text-[10px] dark:text-slate-200">
                              {roadmap.long_term?.length || 0}
                            </span>
                          </div>
                          {(!roadmap.long_term || roadmap.long_term.length === 0) ? (
                            <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400 dark:bg-[#111C2E] dark:border-slate-800">
                              No hardening items.
                            </div>
                          ) : (
                            roadmap.long_term.map((act: any, idx: number) => (
                              <div key={idx} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs dark:bg-[#111C2E] dark:border-slate-800">
                                <div className="font-bold text-slate-900 dark:text-white">{act.title}</div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">{act.reason}</p>
                                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                                  <span>Est: ~{act.estimated_minutes}m</span>
                                  <span className="text-slate-500 dark:text-slate-400">Best Practice</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-PANEL 6: ATTACK SURFACE & HIGH-ATTENTION ASSETS */}
                  {riskSubTab === "assets" && (
                    <div className="space-y-6">
                      {/* Attack Surface Metrics Grid */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Attack Surface Inventory Metrics</h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Passive endpoint & entity inventory</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {[
                            { label:"Public Endpoints", count: attackSurface.metrics?.public_endpoints ?? 0, icon: Globe },
                            { label:"API Endpoints", count: attackSurface.metrics?.api_endpoints ?? 0, icon: Terminal },
                            { label:"Admin Surfaces", count: attackSurface.metrics?.admin_surfaces ?? 0, icon: Lock },
                            { label:"Auth Surfaces", count: attackSurface.metrics?.auth_surfaces ?? 0, icon: KeyRound },
                            { label:"Sensitive Data", count: attackSurface.metrics?.sensitive_data_surfaces ?? 0, icon: ShieldAlert },
                            { label:"Public Docs", count: attackSurface.metrics?.documents ?? 0, icon: FileText },
                            { label:"Third Parties", count: attackSurface.metrics?.third_party_integrations ?? 0, icon: Share2 },
                            { label:"Cloud Assets", count: attackSurface.metrics?.cloud_components ?? 0, icon: Cloud },
                            { label:"Exposed Infra", count: attackSurface.metrics?.exposed_infrastructure ?? 0, icon: Server },
                          ].map((item, idx) => (
                            <div key={idx} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] dark:text-slate-400">
                                <item.icon className="w-3.5 h-3.5" />
                                <span>{item.label}</span>
                              </div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white">{item.count}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Exposure Concentration Alert */}
                      {attackSurface.exposure_concentration?.concentration_detected && (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3 dark:bg-amber-950/40 dark:border-amber-800">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-bold">
                              Exposure Concentration Alert: {attackSurface.exposure_concentration.concentrated_domain} ({attackSurface.exposure_concentration.concentration_percentage}%)
                            </span>
                            <p className="text-[11px] text-amber-800 leading-relaxed dark:text-amber-400">
                              {attackSurface.exposure_concentration.message}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* High-Attention Assets Table */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            High-Attention Assets ({attackSurface.high_attention_assets?.length || 0})
                          </h3>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Ranked by correlated finding density and risk weight</span>
                        </div>

                        {(!attackSurface.high_attention_assets || attackSurface.high_attention_assets.length === 0) ? (
                          <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 dark:bg-slate-800/40">
                            No high-attention assets identified.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 dark:text-slate-400 dark:border-slate-800">
                                  <th className="pb-2 font-semibold">Asset / Path</th>
                                  <th className="pb-2 font-semibold">Finding Count</th>
                                  <th className="pb-2 font-semibold">Highest Severity</th>
                                  <th className="pb-2 font-semibold">Connected Domains</th>
                                  <th className="pb-2 font-semibold">Sample Finding</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {attackSurface.high_attention_assets.map((ast: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 font-mono font-bold text-slate-800 max-w-xs truncate dark:text-slate-200" title={ast.asset}>
                                      {ast.display_label || ast.asset}
                                    </td>
                                    <td className="py-2.5">
                                      <span className="px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                        {ast.findings_count}
                                      </span>
                                    </td>
                                    <td className="py-2.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                        ast.highest_severity === "critical" ?"bg-red-100 text-red-800 dark:text-red-400" :
                                        ast.highest_severity === "high" ?"bg-amber-100 text-amber-800 dark:text-amber-400" :
                                        "bg-blue-100 text-blue-800"
                                      }`}>
                                        {ast.highest_severity}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-slate-500 text-[11px] dark:text-slate-400">
                                      {(ast.categories || []).slice(0, 2).join(", ")}
                                    </td>
                                    <td className="py-2.5 text-slate-600 truncate max-w-xs dark:text-slate-400">
                                      {ast.sample_finding}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* TAB CONTENT 2: ANALYZED PAGES TABLE */}
            {activeTab === "pages" && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden dark:bg-[#111C2E] dark:border-slate-800">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Analyzed Pages Inventory ({metadata?.pages?.length ?? 0})
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Depth: Level {metadata?.crawl_depth ?? 2} same-origin BFS crawl
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-5">URL / Path</th>
                        <th className="py-3 px-3">Depth</th>
                        <th className="py-3 px-3">HTTP Status</th>
                        <th className="py-3 px-3">Latency</th>
                        <th className="py-3 px-3">Headers</th>
                        <th className="py-3 px-3">Cookies</th>
                        <th className="py-3 px-3">Forms</th>
                        <th className="py-3 px-3">Resources</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(metadata?.pages || []).map((page: any, idx: number) => {
                        const pathOnly = page.url.replace(/^https?:\/\/[^\/]+/, "") || "/";
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-5 font-mono text-slate-800 max-w-xs truncate dark:text-slate-200" title={page.url}>
                              <div className="flex items-center gap-1.5">
                                <span className={page.is_https ?"text-emerald-600 font-bold" :"text-amber-600 font-bold"}>
                                  {page.is_https ?"https" :"http"}
                                </span>
                                <span className="truncate">{pathOnly}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{page.depth}</td>
                            <td className="py-3 px-3 font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  page.status_code && page.status_code < 400
                                    ?"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    :"bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                                }`}
                              >
                                {page.status_code ??"ERR"}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{page.elapsed_ms}ms</td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{page.headers_count}</td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{page.cookies_count}</td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{page.forms_count}</td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">{page.resources_count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: CRAWL & DISCOVERY SCOPE */}
            {activeTab === "coverage" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                      Pages Discovered
                    </div>
                    <div className="text-2xl font-bold text-slate-900 font-mono dark:text-white">
                      {metadata?.pages_discovered ?? 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total internal URLs identified</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                      Pages Crawled
                    </div>
                    <div className="text-2xl font-bold text-indigo-700 font-mono dark:text-indigo-400">
                      {metadata?.pages_crawled ?? 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Successfully fetched and parsed</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1 dark:bg-[#111C2E] dark:border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                      Pages Skipped
                    </div>
                    <div className="text-2xl font-bold text-slate-600 font-mono dark:text-slate-400">
                      {metadata?.pages_skipped ?? 0}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Excluded by depth, asset type or robots</p>
                  </div>
                </div>

                {/* Skipped URLs breakdown table */}
                {metadata?.skipped_urls && metadata.skipped_urls.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3 dark:bg-[#111C2E] dark:border-slate-800">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Excluded & Skipped URL Reasons
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      To protect performance and respect crawler boundaries, certain candidate URLs were filtered out:
                    </p>
                    <div className="divide-y divide-slate-100 text-xs font-mono dark:divide-slate-800">
                      {metadata.skipped_urls.map((item: any, idx: number) => (
                        <div key={idx} className="py-2 flex items-center justify-between gap-4">
                          <span className="truncate text-slate-700 max-w-lg dark:text-slate-300">{item.url}</span>
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600 shrink-0 capitalize dark:bg-slate-800 dark:text-slate-400">
                            {item.reason.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 4: TECHNICAL EVIDENCE */}
            {activeTab === "evidence" && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
                {/* Evidence sub-navigation */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  {[
                    { key:"headers", label:"Security Headers" },
                    { key:"cookies", label:"Cookies" },
                    { key:"forms", label:"Public Forms" },
                    { key:"resources", label:"Resources & Domains" },
                    { key:"sourcemaps", label:"Source Maps" },
                    { key:"technology", label:"Technology Stack" },
                  ].map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setEvidenceTab(sub.key as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        evidenceTab === sub.key
                          ?"bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900"
                          :"text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Sub-tab: Security Headers */}
                {evidenceTab === "headers" && (
                  <div className="space-y-3 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">Multi-Page Security Header Observations</h4>
                    <p className="text-slate-500 dark:text-slate-400">
                      Security headers audited across all crawled endpoints for policy consistency:
                    </p>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 font-mono text-[11px] space-y-2 dark:bg-slate-800/40 dark:border-slate-800">
                      <div>Audited Headers: Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy</div>
                      <div>Sample Page Headers:</div>
                      {metadata?.pages && metadata.pages[0] && (
                        <div className="text-slate-600 pl-3 dark:text-slate-400">
                          • {metadata.pages[0].url} (Status {metadata.pages[0].status_code})
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab: Resources */}
                {evidenceTab === "resources" && (
                  <div className="space-y-3 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">External Domains & Dependencies</h4>
                    <p className="text-slate-500 dark:text-slate-400">
                      External domains referenced by scripts, stylesheets, and embedded assets:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {metadata?.resources?.external_domains?.map((d: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-100 font-mono text-xs text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                          {d}
                        </span>
                      )) || <span className="text-slate-400">None detected.</span>}
                    </div>
                  </div>
                )}

                {/* Sub-tab: Technology Stack */}
                {evidenceTab === "technology" && (
                  <div className="space-y-3 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">Multi-Page Technology Stack</h4>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {metadata?.technologies?.map((t: any, idx: number) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{t.name}</span>
                            <span className="text-slate-400 ml-2">({t.category})</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                            Confidence: {t.confidence}
                          </span>
                        </div>
                      )) || <div className="text-slate-400">No technology fingerprints recorded.</div>}
                    </div>
                  </div>
                )}

                {/* Sub-tab: Source Maps */}
                {evidenceTab === "sourcemaps" && (
                  <div className="space-y-3 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">Production Source Map Exposure</h4>
                    {metadata?.source_maps_detected && metadata.source_maps_detected.length > 0 ? (
                      <div className="space-y-2">
                        {metadata.source_maps_detected.map((sm: any, idx: number) => (
                          <div key={idx} className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-mono text-[11px] dark:bg-amber-950/40 dark:border-amber-800">
                            <div>Script: {sm.script_url}</div>
                            <div>Exposed Map: {sm.map_url} (HTTP {sm.status_code})</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                        Zero exposed JavaScript source maps detected.
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab: Forms */}
                {evidenceTab === "forms" && (
                  <div className="space-y-3 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">Public Form Action Endpoints</h4>
                    <p className="text-slate-500 dark:text-slate-400">
                      Forms detected on public pages were analyzed passively without dispatching submissions.
                    </p>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                      Total forms analyzed: {metadata?.pages?.reduce((acc: number, p: any) => acc + (p.forms_count || 0), 0) ?? 0}
                    </div>
                  </div>
                )}

                {/* Sub-tab: Cookies */}
                {evidenceTab === "cookies" && (
                  <div className="space-y-3 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm dark:text-white">Cookie Configuration Audit</h4>
                    <p className="text-slate-500 dark:text-slate-400">
                      Set-Cookie response headers observed across crawled pages:
                    </p>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
                      Total pages setting cookies: {metadata?.pages?.filter((p: any) => (p.cookies_count || 0) > 0).length ?? 0}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATE 3: INFORMATION & LAUNCH SCREEN (Initial View) */}
        {/* ========================================================================= */}
        {!isScanning && (!isCompleted || !currentScan) && (
          <div className="space-y-8">
            {/* Hero / Overview Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6 dark:bg-[#111C2E] dark:border-slate-800">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight dark:text-white">
                        Deep Website Security Scan
                      </h1>
                      <div className="text-xs text-slate-500 font-mono dark:text-slate-400">
                        Target: https://{website.normalized_domain}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-2 dark:text-slate-400">
                    Deep Scan performs a broader passive security assessment of your public website surface.
                    While a standard scan analyzes your primary landing response, Deep Scan crawls internal
                    subpages, audits security header consistency across pages, inspects cookies, analyzes public forms,
                    checks for mixed content, and inventories third-party dependencies.
                  </p>
                </div>

                {/* Quota transparent indicator */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 shrink-0 text-center lg:text-right space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                    Monthly Scan Allowance
                  </div>
                  <div className="text-lg font-bold text-slate-900 font-mono dark:text-white">
                    {billing?.used_scans ?? 0} / {billing?.max_scans_per_month ?? 10} scans
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Remaining: {Math.max(0, (billing?.max_scans_per_month ?? 10) - (billing?.used_scans ?? 0))}
                  </div>
                  <div className="text-[10px] text-indigo-600 font-medium pt-1 dark:text-indigo-400">
                    Deep Scan consumes 1 standard scan credit
                  </div>
                </div>
              </div>

              {/* Start Scan CTA Banner */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isEntitled ? (
                    <span className="flex items-center gap-1.5 text-emerald-700 font-semibold dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Ready to execute with {planName} plan entitlement (up to {maxPages} pages)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-700 font-semibold dark:text-amber-400">
                      <Lock className="w-4 h-4 text-amber-600" />
                      Deep Scan requires an active Pro or Agency subscription plan
                    </span>
                  )}
                </div>

                {isEntitled ? (
                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)}
                    disabled={startingScan}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0 disabled:opacity-50"
                  >
                    {startingScan ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Starting Deep Scan...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Start Deep Scan</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Upgrade to Pro & Agency</span>
                  </button>
                )}
              </div>
            </div>

            {/* WHAT THIS SCAN ANALYZES */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  What This Scan Analyzes
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprehensive Phase F1 & F2 passive security inspection modules implemented in SiteSecura:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    title:"1. Multi-Page BFS Crawler",
                    desc:"Performs same-origin breadth-first crawl within strict depth & plan page limits.",
                    icon: Search,
                  },
                  {
                    title:"2. Security Headers Consistency",
                    desc:"Compares HSTS, CSP, and framing protections across multiple subpages.",
                    icon: Server,
                  },
                  {
                    title:"3. Cookie Security",
                    desc:"Audits Secure, HttpOnly, and SameSite attributes on all Set-Cookie directives.",
                    icon: Lock,
                  },
                  {
                    title:"4. TLS 1.3 & Certificate Hierarchy (F2)",
                    desc:"Validates public key size (2048+ bits), signature algorithms, SANs, PFS, and ALPN HTTP/2.",
                    icon: Key,
                  },
                  {
                    title:"5. DNS, CAA & DNSSEC (F2)",
                    desc:"Audits A/AAAA IPv6 readiness, name server redundancy, CAA authority restrictions, and DNSSEC keys.",
                    icon: Network,
                  },
                  {
                    title:"6. Email Security (SPF & DMARC) (F2)",
                    desc:"Parses SPF mechanisms, enforces RFC 7208 10-lookup limits, and validates DMARC enforcement policies.",
                    icon: Mail,
                  },
                  {
                    title:"7. Semantic HSTS & CSP Engine (F2)",
                    desc:"Evaluates HSTS max-age thresholds, subdomains, and detects CSP unsafe-inline, unsafe-eval, and wildcards.",
                    icon: ShieldCheck,
                  },
                  {
                    title:"8. Cross-Origin Isolation (F2)",
                    desc:"Inspects COOP, CORP, COEP headers and audits Referrer-Policy URL leakage protection.",
                    icon: Globe,
                  },
                  {
                    title:"9. robots.txt & sitemap.xml",
                    desc:"Safely parses crawl restrictions, sitemap links, and indexing guidance.",
                    icon: FileCode,
                  },
                  {
                    title:"10. Mixed Content",
                    desc:"Finds cleartext http:// scripts, styles, and images on encrypted https:// pages.",
                    icon: AlertTriangle,
                  },
                  {
                    title:"11. Public Forms",
                    desc:"Passively inspects form action URLs, protocols, and password field exposure.",
                    icon: FileText,
                  },
                  {
                    title:"12. JavaScript & Technology Inventory",
                    desc:"Inventories scripts, source maps, and aggregates tech stack signals with multi-page confidence.",
                    icon: Sparkles,
                  },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2 hover:border-slate-300 transition-colors dark:bg-[#111C2E] dark:border-slate-800 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 dark:bg-indigo-950/40 dark:text-indigo-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</h4>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed pl-10 dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SCAN SCOPE & SAFETY BOUNDARIES */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 dark:bg-[#111C2E] dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Scan Scope & Safety Policy
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deep Scan operates strictly in a passive, defensive, and non-destructive manner:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="text-slate-500 font-medium dark:text-slate-400">Pages Limit</div>
                  <div className="text-slate-900 font-bold font-mono dark:text-white">
                    {maxPages} pages per Deep Scan
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="text-slate-500 font-medium dark:text-slate-400">Maximum Crawl Depth</div>
                  <div className="text-slate-900 font-bold font-mono dark:text-white">
                    Depth Level 2 (BFS)
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="text-slate-500 font-medium dark:text-slate-400">Same-Domain Only</div>
                  <div className="text-emerald-700 font-bold font-mono flex items-center gap-1 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Yes (Strict)
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="text-slate-500 font-medium dark:text-slate-400">External Domains</div>
                  <div className="text-slate-700 font-bold dark:text-slate-300">
                    Observed, never crawled recursively
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="text-slate-500 font-medium dark:text-slate-400">Destructive Testing</div>
                  <div className="text-slate-700 font-bold dark:text-slate-300">
                    Disabled (Zero write payloads)
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 dark:bg-slate-800/40 dark:border-slate-800">
                  <div className="text-slate-500 font-medium dark:text-slate-400">Credential Attacks</div>
                  <div className="text-slate-700 font-bold dark:text-slate-300">
                    Disabled (No brute-force or auth bypass)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* START CONFIRMATION MODAL */}
        {/* ========================================================================= */}
        {confirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150 dark:bg-[#111C2E] dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Start Deep Website Security Scan?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono dark:text-slate-400">
                    Target: https://{website.normalized_domain}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs dark:bg-slate-800/40 dark:border-slate-800">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  Monthly Scan Quota Transparency:
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Current usage:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {billing?.used_scans ?? 0} / {billing?.max_scans_per_month ?? 10} scans
                  </span>
                </div>
                <div className="flex items-center justify-between text-indigo-700 font-semibold dark:text-indigo-400">
                  <span>After starting:</span>
                  <span className="font-mono font-bold text-indigo-800">
                    {(billing?.used_scans ?? 0) + 1} / {billing?.max_scans_per_month ?? 10} scans
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 pt-1 dark:text-slate-400">
                  This scan will use 1 scan from your monthly scan allowance. Normal Scans and Deep Scans share the same quota.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartDeepScan}
                  disabled={startingScan}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {startingScan ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Starting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Confirm & Start Scan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Upgrade Modal */}
        <UpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          contextType="deep_scan"
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
        />

        {/* AI Security Advisor Drawer */}
        <AiSecurityAdvisorDrawer
          isOpen={advisorDrawerOpen}
          onClose={() => {
            setAdvisorDrawerOpen(false);
            setSelectedAdvisorCheck(null);
          }}
          scan={currentScan}
          check={selectedAdvisorCheck}
          domain={website.normalized_domain}
          plan={plan}
          initialTab={advisorInitialTab}
          onUpgrade={() => setUpgradeModalOpen(true)}
        />
      </div>
    </DashboardLayout>
  );
}
