"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Lock,
  Download,
  ArrowRight,
  RefreshCw,
  Clock,
  Globe,
  Sparkles,
  Activity,
  FileText,
  Server,
  KeyRound,
  MailCheck,
  Layers,
  Check,
  HelpCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScoreRing } from "@/components/ScoreRing";
import { FindingCard } from "@/components/FindingCard";
import { LockedFindingCard } from "@/components/LockedFindingCard";
import { ReportConversionSection } from "@/components/ReportConversionSection";
import { SeverityBadge } from "@/components/SeverityBadge";
import { UpgradeModal, UpgradeContextType } from "@/components/UpgradeModal";
import { api } from "@/lib/api";
import { Scan, ScanCheck, RiskLevel } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  canDownloadPdf,
  canAccessMonitoring,
  canViewFullFindings,
  normalizePlan,
} from "@/lib/entitlements";

/**
 * Derives a factual, human-readable executive security assessment summary from actual scan data.
 * Adheres strictly to non-negotiable rules: never claims 100% security or immunity.
 */
function generateSecuritySummary(scan: Scan): string {
  const checks = scan.checks || [];
  const httpsCheck = checks.find(
    (c) => c.check_type === "https_availability" || c.name.toLowerCase().includes("https")
  );
  const sslCheck = checks.find(
    (c) => c.check_type === "ssl_validity" || c.name.toLowerCase().includes("ssl")
  );
  const headerIssues = checks.filter(
    (c) =>
      (c.check_type === "hsts" ||
        c.check_type === "csp" ||
        c.check_type.includes("header") ||
        c.check_type.includes("frame")) &&
      c.status !== "pass"
  );
  const emailIssues = checks.filter(
    (c) =>
      (c.check_type === "spf_record" ||
        c.check_type === "dmarc_record" ||
        c.check_type.includes("dns")) &&
      c.status !== "pass"
  );

  const parts: string[] = [];

  if (httpsCheck?.status === "pass" && sslCheck?.status === "pass") {
    parts.push("Your website is using HTTPS and has a valid SSL certificate.");
  } else if (httpsCheck?.status === "pass") {
    parts.push("Your website is reachable over HTTPS, but SSL certificate configurations require review.");
  } else {
    parts.push("HTTPS encryption is not strictly enforced on this domain, leaving cleartext connections exposed.");
  }

  if (headerIssues.length > 0 && emailIssues.length > 0) {
    parts.push(
      "A few security configuration settings need attention, including HTTP security headers and email authentication records (SPF/DMARC)."
    );
  } else if (headerIssues.length > 0) {
    parts.push("Several defensive HTTP response headers (such as HSTS or CSP) are missing or need adjustment.");
  } else if (emailIssues.length > 0) {
    parts.push("Domain email protection records need attention to prevent unauthorized spoofing.");
  } else {
    parts.push("Core defensive configurations are in place. Maintaining regular monitoring ensures settings do not drift.");
  }

  return parts.join(" ");
}

const CATEGORY_NAMES: Record<string, string> = {
  https_ssl: "HTTPS & TLS",
  security_headers: "Security Headers",
  dns_email: "DNS & Email Security",
  cookie_security: "Cookie Security",
  server_hygiene: "Server Hygiene & Tech",
};

const DEFAULT_CATEGORY_WEIGHTS: Record<string, number> = {
  https_ssl: 30,
  security_headers: 25,
  dns_email: 20,
  cookie_security: 10,
  server_hygiene: 15,
};

export default function ScanResultPage() {
  const params = useParams();
  const scanId = params.id as string;
  const router = useRouter();
  const { isAuthenticated, plan, loading: authLoading } = useAuth();

  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [scoreExplainerOpen, setScoreExplainerOpen] = useState(false);

  // Upgrade Modal State
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalContext, setUpgradeModalContext] = useState<UpgradeContextType>("general");

  // Truthful scanning progress stages
  const [progressStage, setProgressStage] = useState("Starting scan...");

  const openUpgrade = (context: UpgradeContextType) => {
    setUpgradeModalContext(context);
    setUpgradeModalOpen(true);
  };

  const handleExportPdf = async () => {
    if (!scan) return;
    if (isAuthenticated && canDownloadPdf(plan)) {
      setDownloadingPdf(true);
      try {
        await api.downloadScanPdf(scan.id, scan.normalized_domain);
      } catch (err: any) {
        alert(err.message || "Failed to download PDF report.");
      } finally {
        setDownloadingPdf(false);
      }
    } else {
      openUpgrade("pdf");
    }
  };

  useEffect(() => {
    let intervalId: any = null;
    let pollCount = 0;

    const loadScanData = async () => {
      try {
        const data = await api.getScan(scanId);
        setScan(data);
        if (data.status === "completed" || data.status === "failed") {
          setLoading(false);
          if (intervalId) clearInterval(intervalId);
        } else {
          pollCount += 1;
          if (pollCount <= 1) {
            setProgressStage("Starting scan...");
          } else if (pollCount === 2) {
            setProgressStage("Running defensive security checks...");
          } else if (pollCount === 3) {
            setProgressStage("Analyzing response headers & certificates...");
          } else {
            setProgressStage("Finalizing security report...");
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load scan data. Please verify the domain and try again.");
        setLoading(false);
        if (intervalId) clearInterval(intervalId);
      }
    };

    loadScanData();
    intervalId = setInterval(loadScanData, 2000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [scanId]);

  // Derived canonical scan metrics
  const checks = useMemo(() => scan?.checks || [], [scan]);
  const totalCount = checks.length > 0 ? checks.length : scan?.total_checks_count || 13;
  const passedChecks = useMemo(() => checks.filter((c) => c.status === "pass"), [checks]);
  const passedCount = passedChecks.length;

  const issueChecks = useMemo(() => {
    return checks.filter((c) => {
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
  }, [checks]);
  const issueCount = issueChecks.length;

  const infoChecks = useMemo(() => {
    return checks.filter((c) => {
      const st = (c.status || "").toLowerCase();
      return st !== "pass" && !issueChecks.includes(c);
    });
  }, [checks, issueChecks]);
  const infoCount = totalCount - passedCount - issueCount;

  // Top 3 actionable recommendations prioritized by severity and impact
  const topActionableChecks = useMemo(() => {
    return [...issueChecks]
      .sort((a, b) => {
        const sevOrder: Record<string, number> = {
          critical: 4,
          high: 3,
          medium: 2,
          warning: 2,
          low: 1,
          info: 0,
        };
        const diff = (sevOrder[b.severity || ""] || 0) - (sevOrder[a.severity || ""] || 0);
        if (diff !== 0) return diff;
        return Math.abs(b.score_impact || 0) - Math.abs(a.score_impact || 0);
      })
      .slice(0, 3);
  }, [issueChecks]);

  const securitySummary = useMemo(() => {
    if (!scan) return "";
    return generateSecuritySummary(scan);
  }, [scan]);

  // Entitlement-aware finding resolution
  const isPaidUser = isAuthenticated && canViewFullFindings(plan);

  const unlockedFindings = useMemo(() => {
    if (isPaidUser || scan?.is_premium_locked === false) {
      return checks;
    }
    if (scan?.unlocked_findings && scan.unlocked_findings.length > 0) {
      return scan.unlocked_findings;
    }
    return checks.slice(0, 3);
  }, [isPaidUser, scan, checks]);

  const lockedFindings = useMemo(() => {
    if (isPaidUser || scan?.is_premium_locked === false) {
      return [];
    }
    return checks.slice(3);
  }, [isPaidUser, scan, checks]);

  // 6 Core Defensive Security Overview Categories
  const categories = useMemo(() => {
    const findStatus = (types: string[]) => {
      const matchChecks = checks.filter((c) => types.some((t) => c.check_type.includes(t)));
      if (matchChecks.length === 0) return { status: "valid", text: "Checked", passed: true };
      const hasFail = matchChecks.some((c) => c.status === "critical" || c.status === "high");
      const hasWarn = matchChecks.some((c) => c.status === "warning");
      if (hasFail) return { status: "failed", text: "Action Required", passed: false };
      if (hasWarn) return { status: "warning", text: "Needs Attention", passed: false };
      return { status: "passed", text: "Working Well", passed: true };
    };

    return [
      {
        id: "https",
        name: "HTTPS Enforcement",
        icon: Globe,
        desc: "Verifies secure HTTPS connection and port 80 redirection",
        ...findStatus(["https"]),
      },
      {
        id: "ssl",
        name: "SSL/TLS Certificate",
        icon: KeyRound,
        desc: "Checks certificate validity, trust chain, and expiration dates",
        ...findStatus(["ssl", "tls"]),
      },
      {
        id: "dns_email",
        name: "DNS & Email Security",
        icon: MailCheck,
        desc: "Evaluates SPF, DMARC, and DNSSEC to prevent domain spoofing",
        ...findStatus(["spf", "dmarc", "dns", "dkim"]),
      },
      {
        id: "headers",
        name: "Security Headers",
        icon: Layers,
        desc: "Audits HSTS, CSP, X-Frame-Options, and Content-Type directives",
        ...findStatus(["hsts", "csp", "frame", "content_type", "referrer", "header"]),
      },
      {
        id: "cookies",
        name: "Cookie Security",
        icon: Shield,
        desc: "Analyzes Secure, HttpOnly, and SameSite protection flags",
        ...findStatus(["cookie"]),
      },
      {
        id: "hygiene",
        name: "Server Hygiene & Tech",
        icon: Server,
        desc: "Identifies exposed software versions, framework signatures, and leaks",
        ...findStatus(["tech", "server"]),
      },
    ];
  }, [checks]);

  // Grouped Security Checklist for Section 5
  const groupedChecklist = useMemo(() => {
    const groups: Record<string, { label: string; icon: any; items: ScanCheck[] }> = {
      transport: {
        label: "Transport & Encryption",
        icon: Globe,
        items: checks.filter((c) => {
          const t = (c.check_type || "").toLowerCase();
          return t.includes("https") || t.includes("ssl") || t.includes("tls");
        }),
      },
      headers: {
        label: "Security Headers",
        icon: Layers,
        items: checks.filter((c) => {
          const t = (c.check_type || "").toLowerCase();
          return (
            t.includes("hsts") ||
            t.includes("csp") ||
            t.includes("frame") ||
            t.includes("content_type") ||
            t.includes("referrer") ||
            t.includes("header")
          );
        }),
      },
      dns_email: {
        label: "DNS & Email Security",
        icon: MailCheck,
        items: checks.filter((c) => {
          const t = (c.check_type || "").toLowerCase();
          return t.includes("spf") || t.includes("dmarc") || t.includes("dns") || t.includes("dkim");
        }),
      },
      cookies: {
        label: "Cookie Security",
        icon: Shield,
        items: checks.filter((c) => {
          const t = (c.check_type || "").toLowerCase();
          return t.includes("cookie");
        }),
      },
      hygiene: {
        label: "Server Hygiene & Tech",
        icon: Server,
        items: checks.filter((c) => {
          const t = (c.check_type || "").toLowerCase();
          return (
            !t.includes("https") &&
            !t.includes("ssl") &&
            !t.includes("tls") &&
            !t.includes("hsts") &&
            !t.includes("csp") &&
            !t.includes("frame") &&
            !t.includes("content_type") &&
            !t.includes("referrer") &&
            !t.includes("header") &&
            !t.includes("spf") &&
            !t.includes("dmarc") &&
            !t.includes("dns") &&
            !t.includes("dkim") &&
            !t.includes("cookie")
          );
        }),
      },
    };

    return Object.entries(groups).filter(([_, g]) => g.items.length > 0);
  }, [checks]);

  // Smooth scroll helper
  const scrollToTarget = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 1. Loading & Scanning State
  if (loading || (scan && scan.status !== "completed" && scan.status !== "failed")) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="w-20 h-20 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
              <Shield className="w-8 h-8 text-sky-600 absolute inset-0 m-auto" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold border border-sky-200">
                <div className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                <span>Active Security Assessment</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">Scanning Website</h2>
              <p className="text-sm font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded-md max-w-xs mx-auto truncate">
                {scan?.domain || "Resolving target..."}
              </p>
            </div>

            {/* Truthful Progress Stage Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              {progressStage}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              Running passive defensive checks across SSL certificates, DNS records, HTTP security headers, and cookie attributes.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 2. Error / Failed State
  if (error || (scan && scan.status === "failed")) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-16 text-center flex flex-col justify-center">
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-red-200 shadow-xl space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Scan Notice</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {scan?.error_message ||
                  error ||
                  "The scan could not be completed. Please verify that the domain is a publicly accessible hostname and try again."}
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/#scan-hero"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors"
              >
                Scan Another Domain
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // 3. Completed Security Assessment Report
  const targetDomain = scan?.normalized_domain || scan?.domain || "target.com";
  const scanDate = scan?.created_at
    ? new Date(scan.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Recent";
  const durationSec = scan?.scan_duration_ms ? (scan.scan_duration_ms / 1000).toFixed(1) : "1.5";
  const breakdown = scan?.score_breakdown || {};
  const totalScore = scan?.score ?? 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/60">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* ========================================================================= */}
        {/* SECTION 1 — REPORT HEADER */}
        {/* ========================================================================= */}
        <section
          aria-label="Security Assessment Report Header"
          className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/90 shadow-xs"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Scan Complete</span>
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 font-medium">Evaluation date: {scanDate}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 min-w-0">
                <Globe className="w-6 h-6 text-sky-500 shrink-0 hidden sm:inline" />
                <span className="break-all">{targetDomain}</span>
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Completed in {durationSec}s</span>
                </span>
                <span>•</span>
                <span className="font-medium text-slate-700">Normal Security Scan</span>
                <span>•</span>
                <span>Deterministic Defensive Scan</span>
              </div>
            </div>

            {/* Clean, Entitlement-Aware Header Actions */}
            <div className="flex flex-col xs:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
              <Link
                href="/#scan-hero"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs text-center"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Scan Again</span>
              </Link>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors disabled:opacity-50 shadow-2xs text-center cursor-pointer"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>

              {/* Authenticated Dashboard Actions */}
              {isAuthenticated && (
                <Link
                  href={scan?.website_id ? `/dashboard/websites/${scan.website_id}` : "/dashboard"}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-2xs text-center"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2 — EXECUTIVE SECURITY SUMMARY */}
          {/* ========================================================================= */}
          <div className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Score Display Ring */}
            <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-5 bg-slate-50/70 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Security Score
              </span>
              <ScoreRing
                score={totalScore}
                riskLevel={scan?.risk_level || "Unknown"}
                size="lg"
                themeMode="light"
              />
              <p className="text-[11px] text-slate-500 mt-3 max-w-[220px]">
                Deterministic 100-point security baseline evaluated across 5 core defensive categories.
              </p>
            </div>

            {/* Plain-English Narrative & Compact Metrics */}
            <div className="md:col-span-8 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded border border-sky-200">
                    Executive Summary
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Postural Status: <strong className="text-slate-800 capitalize">{scan?.risk_level}</strong>
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug break-words">
                  Security Assessment for <span className="break-all">{targetDomain}</span>
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80 break-words">
                  {securitySummary}
                </p>
              </div>

              {/* Canonical Metric Counter Badges */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold border border-slate-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                  <span>{totalCount} security checks reviewed</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{passedCount} working well</span>
                </span>
                {issueCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold border border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{issueCount} need attention</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>0 critical issues</span>
                  </span>
                )}
                {infoCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 text-slate-700 font-semibold border border-slate-200">
                    <Info className="w-3.5 h-3.5 text-slate-500" />
                    <span>{infoCount} informational</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expandable: How is this score calculated? */}
          <div className="pt-4 mt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setScoreExplainerOpen(!scoreExplainerOpen)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-700 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>How is this score calculated?</span>
              {scoreExplainerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {scoreExplainerOpen && (
              <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-3 leading-relaxed animate-in fade-in">
                <p>
                  SiteSecura starts each assessment at a baseline of <strong>100 points</strong> and applies deductions strictly for verified security misconfigurations and vulnerabilities. Informational observations provide context with zero score penalty.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1 text-center">
                  {[
                    "https_ssl",
                    "security_headers",
                    "dns_email",
                    "cookie_security",
                    "server_hygiene",
                  ].map((catKey) => {
                    const data = breakdown[catKey];
                    const maxScore = data?.max_score ?? DEFAULT_CATEGORY_WEIGHTS[catKey] ?? 20;
                    const catScore = data?.score ?? maxScore;
                    const isZeroWithDeductions = catScore === 0 && (data?.deductions ?? 0) > 0;

                    return (
                      <div
                        key={catKey}
                        className={`p-3 bg-white rounded-xl border border-slate-200/90 space-y-1 shadow-2xs min-w-0 ${
                          catKey === "server_hygiene" ? "col-span-2 sm:col-span-1" : ""
                        }`}
                      >
                        <span className="font-bold text-slate-800 block text-xs truncate">
                          {CATEGORY_NAMES[catKey]}
                        </span>
                        <div className="font-mono font-black text-sm text-slate-900">
                          {catScore} / {maxScore}
                        </div>
                        {isZeroWithDeductions && (
                          <span className="text-[10px] text-amber-700 block">
                            Score reduced by deductions
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3 — WHAT SHOULD I FIX FIRST? */}
        {/* ========================================================================= */}
        {topActionableChecks.length > 0 && (
          <section aria-labelledby="priority-actions-title" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                  Priority Action Plan
                </span>
                <h2 id="priority-actions-title" className="text-xl font-extrabold text-slate-900 tracking-tight">
                  What should you fix first?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your highest-impact recommended improvements prioritized by exploitability and remediation ease.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topActionableChecks.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge status={item.status} severity={item.severity} />
                      {item.score_impact < 0 && (
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 font-mono shrink-0">
                          {item.score_impact} pts
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug break-words">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.summary || "Configuration gap detected requiring remediation."}
                    </p>

                    {item.why_it_matters && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 pt-1 border-t border-slate-100">
                        <strong className="font-semibold text-slate-700">Why it matters:</strong>{" "}
                        {item.why_it_matters}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1 font-medium text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>~{item.estimated_fix_minutes || 5} min fix</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => scrollToTarget(`finding-${item.id}`)}
                      className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-semibold hover:underline text-xs"
                    >
                      <span>View details &rarr;</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* SECTION 4 — SECURITY OVERVIEW */}
        {/* ========================================================================= */}
        <section aria-labelledby="security-overview-title" className="space-y-4">
          <div>
            <h2 id="security-overview-title" className="text-xl font-extrabold text-slate-900 tracking-tight">
              Security Overview
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Core defensive perimeter categories evaluated by the passive scanner.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const IconComp = cat.icon;
              const isPassed = cat.passed;
              return (
                <div
                  key={cat.id}
                  onClick={() => scrollToTarget("security-checklist")}
                  className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer ${
                    isPassed
                      ? "border-slate-200 hover:border-slate-300"
                      : "border-amber-200/90 bg-amber-50/15 hover:border-amber-300"
                  } shadow-xs space-y-3`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                      <IconComp className="w-4 h-4" />
                    </div>
                    {isPassed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>{cat.text}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{cat.text}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{cat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5 — SECURITY CONTROLS CHECKLIST */}
        {/* ========================================================================= */}
        <section
          id="security-checklist"
          aria-labelledby="checklist-title"
          className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200 shadow-xs space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 id="checklist-title" className="text-xl font-extrabold text-slate-900 tracking-tight">
                Website Security Controls Checklist
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Itemized inspection results across standard defensive web configuration protocols.
              </p>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-2xs">
                <span>{passedCount} of {totalCount} checks passed</span>
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {groupedChecklist.map(([groupKey, group]) => {
              const GroupIcon = group.icon;
              return (
                <div key={groupKey} className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider pb-1">
                    <GroupIcon className="w-3.5 h-3.5 text-sky-600" />
                    <span>{group.label}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.items.map((check) => {
                      const isPass = check.status === "pass";
                      return (
                        <div
                          key={check.id}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                            isPass
                              ? "bg-slate-50/60 border-slate-200"
                              : "bg-amber-50/40 border-amber-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isPass ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 block truncate">
                                {check.title}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isPass
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-amber-100 text-amber-900 border-amber-300"
                              }`}
                            >
                              {isPass ? "PASS" : "ATTENTION"}
                            </span>
                            <button
                              type="button"
                              onClick={() => scrollToTarget(`finding-${check.id}`)}
                              className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
            <span>Deterministic verification from real HTTP responses, certificate validation, and DNS lookups.</span>
            <span className="font-mono text-slate-400">Scan ID: {scan?.id.slice(0, 8)}</span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6 — DETAILED SECURITY FINDINGS */}
        {/* ========================================================================= */}
        <section id="detailed-findings" aria-labelledby="findings-title" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 id="findings-title" className="text-xl font-extrabold text-slate-900 tracking-tight">
                Detailed Security Findings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed finding cards with plain-English summaries, why it matters, recommended actions, and progressive technical evidence.
              </p>
            </div>
            {issueCount > 0 && (
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 self-start sm:self-auto">
                {issueCount} items need attention
              </span>
            )}
          </div>

          {/* Unlocked Findings List */}
          <div className="space-y-3.5">
            {unlockedFindings.map((check) => (
              <FindingCard
                key={check.id}
                check={check}
                domain={targetDomain}
                defaultExpanded={check.status !== "pass"}
                anchorId={`finding-${check.id}`}
              />
            ))}
          </div>

          {/* Locked Findings (Only Rendered for Free & Anonymous Viewers) */}
          {lockedFindings.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Additional Security Findings ({lockedFindings.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upgrade to view complete finding evidence, server response records, and step-by-step remediation commands.
                  </p>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                  🔒 Premium Findings
                </span>
              </div>

              <div className="space-y-3">
                {lockedFindings.map((item, idx) => (
                  <LockedFindingCard
                    key={item.id || idx}
                    check={item}
                    index={idx + 4}
                    onUnlock={() => openUpgrade("locked_findings")}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7 — ASSESSMENT METHODOLOGY & DISCLAIMER */}
        {/* ========================================================================= */}
        <section
          aria-label="Assessment Methodology"
          className="bg-white rounded-2xl p-6 border border-slate-200 text-xs text-slate-500 space-y-2 shadow-2xs"
        >
          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>SiteSecura Assessment Methodology</span>
          </div>
          <p className="leading-relaxed">
            SiteSecura performs passive, non-destructive defensive checks using publicly observable website responses, headers, SSL/TLS certificate chains, DNS records, cookies, and related perimeter signals. No intrusive penetration testing, exploitation payloads, or server modifications are executed.
          </p>
          <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
            Security scores reflect verified defensive posture at the time of evaluation and do not guarantee immunity from unknown or zero-day vulnerabilities.
          </p>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 8 — REUSABLE ENTITLEMENT-AWARE REPORT CONVERSION SECTION */}
        {/* Basic / Pro / Agency / Admin => RETURNS NULL (Zero Sales Blocks) */}
        {/* Free => ONE Continuous Monitoring Upgrade Card */}
        {/* Anonymous => ONE Polished Final CTA Card */}
        {/* ========================================================================= */}
        <ReportConversionSection
          plan={plan}
          isAuthenticated={isAuthenticated}
          authLoading={authLoading}
          onUpgrade={openUpgrade}
        />
      </main>

      <Footer />

      {/* Reusable Contextual Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        contextType={upgradeModalContext}
      />
    </div>
  );
}
