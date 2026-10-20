"use client";

import React from "react";
import Link from "next/link";
import {
  Compass,
  ArrowRight,
  Globe,
  RefreshCw,
  FileCheck,
  Bot,
  ShieldCheck,
  FileCode,
  Lock,
  Shield,
  Mail,
} from "lucide-react";
import { trackContentEvent } from "@/lib/analytics";

export interface ToolPromptItem {
  prompt: string;
  toolName: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}

export const TOOL_PROMPT_ITEMS: ToolPromptItem[] = [
  {
    prompt: "Review website security",
    toolName: "Website Security Scanner",
    href: "/tools/website-security-checker",
    icon: Shield,
    tag: "Full Assessment",
  },
  {
    prompt: "Check SSL/TLS configuration",
    toolName: "SSL/TLS Certificate Checker",
    href: "/tools/ssl-checker",
    icon: Lock,
    tag: "Certificates",
  },
  {
    prompt: "Inspect security headers",
    toolName: "Security Headers Checker",
    href: "/tools/security-headers-checker",
    icon: FileCode,
    tag: "HTTP Headers",
  },
  {
    prompt: "Verify SPF, DKIM & DMARC",
    toolName: "SPF, DKIM & DMARC Checker",
    href: "/tools/email-security-checker",
    icon: Mail,
    tag: "Email Security",
  },
  {
    prompt: "Check DNS records",
    toolName: "DNS Lookup Tool",
    href: "/tools/dns-lookup",
    icon: Globe,
    tag: "DNS Records",
  },
  {
    prompt: "Inspect HTTP status & redirects",
    toolName: "HTTP Status & Redirect Checker",
    href: "/tools/http-status-checker",
    icon: RefreshCw,
    tag: "Redirect Chains",
  },
  {
    prompt: "Validate security.txt",
    toolName: "security.txt Validator",
    href: "/tools/security-txt-validator",
    icon: FileCheck,
    tag: "RFC 9116",
  },
  {
    prompt: "Check robots.txt & XML sitemaps",
    toolName: "Robots.txt & Sitemap Checker",
    href: "/tools/robots-sitemap-checker",
    icon: Bot,
    tag: "Crawlability",
  },
  {
    prompt: "Analyze a Content Security Policy",
    toolName: "CSP Policy Analyzer",
    href: "/tools/csp-policy-analyzer",
    icon: ShieldCheck,
    tag: "W3C CSP Level 3",
  },
];

export function QuickToolFinder() {
  const handlePromptClick = (item: ToolPromptItem) => {
    trackContentEvent({
      event_name: "resource_view",
      content_type: "tool_finder",
      content_id: item.toolName,
      source: "quick_tool_finder",
    });
  };

  return (
    <section aria-labelledby="quick-tool-finder-heading" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span>Quick Tool Finder</span>
          </div>
          <h2 id="quick-tool-finder-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            What do you want to inspect today?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Select your immediate objective to launch the right specialized utility:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOL_PROMPT_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={idx}
              href={item.href}
              onClick={() => handlePromptClick(item)}
              className="group p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-sky-300 hover:bg-sky-50/20 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-sky-100 text-slate-600 group-hover:text-sky-700 flex items-center justify-center shrink-0 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors block truncate">
                    {item.prompt}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-500 truncate">
                      {item.toolName}
                    </span>
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
