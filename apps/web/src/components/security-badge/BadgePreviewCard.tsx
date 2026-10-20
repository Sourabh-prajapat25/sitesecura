"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Code2,
  FileCode,
  Shield,
  Eye,
  Sliders,
} from "lucide-react";
import { WebsiteBadgeStatus } from "@/types";
import { API_BASE } from "@/lib/api";

interface BadgePreviewCardProps {
  badgeStatus: WebsiteBadgeStatus | null;
  isEligible: boolean;
}

export function BadgePreviewCard({
  badgeStatus,
  isEligible,
}: BadgePreviewCardProps) {
  const [style, setStyle] = useState<"standard" | "compact">("standard");
  const [activeTab, setActiveTab] = useState<"html" | "markdown">("html");
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isVerified = badgeStatus?.status === "verified";
  const publicToken = badgeStatus?.public_token;

  // Resolve root origin for backend badge SVG
  const rawApiBase = process.env.NEXT_PUBLIC_API_URL || API_BASE || "http://127.0.0.1:8000/api/v1";
  const backendOrigin = rawApiBase.replace(/\/api\/v1\/?$/, "");

  const dynamicSvgUrl = publicToken
    ? `${backendOrigin}/badges/${encodeURIComponent(publicToken)}.svg?style=${style}`
    : null;

  const verificationUrl = badgeStatus?.verification_url || (publicToken ? `/verified/${publicToken}` : "");

  // Generate embed snippets based on current style
  const htmlSnippet = publicToken
    ? `<a href="${verificationUrl}" target="_blank" rel="noopener noreferrer">\n  <img src="${backendOrigin}/badges/${publicToken}.svg?style=${style}" alt="SiteSecura Verified" width="${style === "compact" ? "130" : "200"}" height="${style === "compact" ? "28" : "34"}" />\n</a>`
    : "";

  const markdownSnippet = publicToken
    ? `[![SiteSecura Verified](${backendOrigin}/badges/${publicToken}.svg?style=${style})](${verificationUrl})`
    : "";

  const handleCopySnippet = async () => {
    const textToCopy = activeTab === "html" ? htmlSnippet : markdownSnippet;
    if (!textToCopy) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch (err) {
      console.error("Failed to copy embed snippet:", err);
    }
  };

  const handleCopyUrl = async () => {
    if (!verificationUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(verificationUrl);
      }
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error("Failed to copy verification URL:", err);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>SiteSecura Verified Badge Preview</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Preview the dynamic SVG badge and copy ready-to-use embed snippets.
          </p>
        </div>

        {/* Style Selector Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          <button
            type="button"
            onClick={() => setStyle("standard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              style === "standard"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Standard (200px)
          </button>
          <button
            type="button"
            onClick={() => setStyle("compact")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              style === "compact"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Compact (130px)
          </button>
        </div>
      </div>

      {/* Visual Badge Display Box */}
      <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#0B1220]/60 border border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center space-y-3">
        {isVerified && dynamicSvgUrl ? (
          <div className="flex flex-col items-center space-y-2">
            <img
              src={dynamicSvgUrl}
              alt="SiteSecura Verified Dynamic Badge"
              className={style === "compact" ? "h-7" : "h-9"}
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Live dynamic SVG (served with defensive caching &amp; CSP)
            </span>
          </div>
        ) : isEligible ? (
          <div className="flex flex-col items-center space-y-2 text-center">
            {/* Visual simulation of standard/compact preview */}
            <div
              className={`inline-flex items-center rounded-md border border-emerald-700/30 overflow-hidden shadow-2xs ${
                style === "compact" ? "h-7 text-xs" : "h-9 text-xs"
              }`}
            >
              <div className="bg-slate-900 text-white px-2.5 h-full flex items-center gap-1.5 font-bold">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>SiteSecura</span>
              </div>
              <div className="bg-emerald-600 text-white px-2.5 h-full flex items-center gap-1 font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>VERIFIED</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="inline-block px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[10px] font-bold border border-sky-200 dark:border-sky-800">
                Preview Only
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verification has not yet been issued. Click &ldquo;Verify Website&rdquo; above to activate this badge.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-1.5 py-4">
            <Shield className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Badge preview will appear once your website qualifies.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Run a completed security assessment to check eligibility.
            </p>
          </div>
        )}
      </div>

      {/* Embed Code Snippet (When Verified) */}
      {isVerified && publicToken && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("html")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === "html"
                    ? "bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>HTML Embed</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("markdown")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === "markdown"
                    ? "bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Markdown</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopySnippet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              {copiedSnippet ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Embed Code</span>
                </>
              )}
            </button>
          </div>

          {/* Read-only Code Block (rendered strictly as text, no dangerouslySetInnerHTML) */}
          <div className="relative rounded-xl bg-slate-900 p-4 overflow-x-auto text-slate-200 font-mono text-xs border border-slate-800">
            <pre className="whitespace-pre overflow-x-auto">
              <code>{activeTab === "html" ? htmlSnippet : markdownSnippet}</code>
            </pre>
          </div>

          {/* Public Verification Link Bar */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Public Verification Link
              </span>
              <p className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                {verificationUrl}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>

              <a
                href={verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>Open Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
