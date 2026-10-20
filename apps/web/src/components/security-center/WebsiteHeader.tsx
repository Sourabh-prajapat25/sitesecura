"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Download,
  Play,
  MoreVertical,
  Copy,
  Check,
  Pencil,
  Trash2,
  Sliders,
  Loader2,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Website, Scan } from "@/types";

interface WebsiteHeaderProps {
  website: Website;
  latestScan: Scan | null;
  scanning: boolean;
  downloadingPdf: boolean;
  onScanNow: () => void;
  onDownloadPdf: () => void;
  onRename: () => void;
  onDelete: () => void;
  onGoToMonitoring: () => void;
}

export function WebsiteHeader({
  website,
  latestScan,
  scanning,
  downloadingPdf,
  onScanNow,
  onDownloadPdf,
  onRename,
  onDelete,
  onGoToMonitoring,
}: WebsiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(`https://${website.normalized_domain}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setMenuOpen(false);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  // Determine dynamic status
  const getStatusBadge = () => {
    if (scanning || latestScan?.status === "running" || latestScan?.status === "queued") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          <Loader2 className="w-3 h-3 animate-spin text-sky-600 dark:text-sky-400" />
          <span>Scan Running</span>
        </span>
      );
    }

    if (latestScan?.status === "failed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
          <ShieldAlert className="w-3 h-3 text-red-600 dark:text-red-400" />
          <span>Scan Failed</span>
        </span>
      );
    }

    if (website.monitoring_enabled) {
      if (website.monitoring?.status === "failing") {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Monitoring Issue</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Monitoring Active</span>
        </span>
      );
    }

    if (!latestScan) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>Never Scanned</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
        <span>Monitoring Paused</span>
      </span>
    );
  };

  const domainInitial = (website.normalized_domain || website.domain || "S")
    .replace(/^www\./, "")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left: Back & Target Info */}
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/websites"
            aria-label="Back to all websites"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Favicon / Initial Badge */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-lg shadow-2xs shrink-0 select-none">
            {domainInitial}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {website.name || website.domain}
              </h1>
              {getStatusBadge()}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <a
                href={`https://${website.normalized_domain}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline font-mono"
              >
                <span>https://{website.normalized_domain}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {latestScan?.created_at && (
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  <span>
                    Last scanned:{" "}
                    {new Date(latestScan.created_at).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
              )}

              {!latestScan && (
                <span className="text-slate-400 dark:text-slate-500">Ready for initial security scan</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 sm:self-center shrink-0">
          {latestScan && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-2xs transition-colors disabled:opacity-50"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 dark:text-slate-400" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onScanNow}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Scanning Target...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Scan Now</span>
              </>
            )}
          </button>

          {/* Three-dot context menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="More website actions"
              aria-expanded={menuOpen}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-2xs"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#111C2E] rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg py-1.5 z-20 text-xs font-medium text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-center gap-2.5 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">URL Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>Copy Website URL</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onRename();
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-center gap-2.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Rename Website</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onGoToMonitoring();
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-center gap-2.5 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Monitoring Settings</span>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  <span>Delete Website</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
