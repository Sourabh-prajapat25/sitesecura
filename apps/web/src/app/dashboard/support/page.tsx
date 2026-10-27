"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Mail,
  MessageSquare,
  BookOpen,
  Send,
  Check,
  Search,
  ShieldCheck,
  Radar,
  CreditCard,
  Globe,
  Users,
  Settings,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/EmptyState";
import { api } from "@/lib/api";

interface SupportCategory {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  iconColor: string;
  keywords: string[];
}

interface SupportResource {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  emailValue?: string;
  isExternal?: boolean;
  keywords: string[];
}

const CATEGORIES: SupportCategory[] = [
  {
    id: "security",
    title: "Website Security & Checks",
    description: "Understand vulnerability classifications, SSL/TLS, headers, and remediation specs.",
    href: "/docs",
    icon: ShieldCheck,
    tag: "Documentation",
    iconColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
    keywords: ["security", "checks", "vulnerability", "cve", "ssl", "tls", "hsts", "remediation", "headers"],
  },
  {
    id: "scanning",
    title: "Scanning Engine & Reports",
    description: "Learn about scan queues, deep scan coverage, timeout policies, and PDF report downloads.",
    href: "/docs",
    icon: Radar,
    tag: "Engine & Docs",
    iconColor: "text-sky-600 bg-sky-50 border-sky-100",
    keywords: ["scan", "scanner", "engine", "reports", "pdf", "deep scan", "normal scan", "queue"],
  },
  {
    id: "billing",
    title: "Billing & Subscriptions",
    description: "Manage your plan, invoices, upgrade tiers, billing cycle, and payment methods.",
    href: "/dashboard/billing",
    icon: CreditCard,
    tag: "Account Billing",
    iconColor: "text-indigo-600 bg-indigo-50 border-indigo-100",
    keywords: ["billing", "subscription", "stripe", "razorpay", "invoices", "pricing", "plans", "payment", "receipts"],
  },
  {
    id: "websites",
    title: "Websites & Assets",
    description: "Configure monitored domains, discovery settings, schedules, and asset lists.",
    href: "/dashboard/websites",
    icon: Globe,
    tag: "Asset Inventory",
    iconColor: "text-amber-600 bg-amber-50 border-amber-100",
    keywords: ["websites", "domains", "monitoring", "assets", "targets", "uptime", "urls"],
  },
  {
    id: "team",
    title: "Team & Workspace",
    description: "Manage workspace members, role permissions, invite teammates, and access controls.",
    href: "/dashboard/team",
    icon: Users,
    tag: "Access Control",
    iconColor: "text-blue-600 bg-blue-50 border-blue-100",
    keywords: ["team", "members", "workspace", "roles", "collaboration", "invites", "permissions"],
  },
  {
    id: "settings",
    title: "Account & Settings",
    description: "Update your profile credentials, notification alerts, digest preferences, and security.",
    href: "/dashboard/settings",
    icon: Settings,
    tag: "Profile & Preferences",
    iconColor: "text-slate-600 bg-slate-100 border-slate-200",
    keywords: ["settings", "account", "profile", "notifications", "email", "security", "preferences"],
  },
];

const RESOURCES: SupportResource[] = [
  {
    id: "docs",
    title: "Documentation",
    description: "Learn how SiteSecura scans websites, interprets findings, and recommends security improvements.",
    href: "/docs",
    actionLabel: "Read Documentation",
    icon: BookOpen,
    iconColor: "text-sky-600 bg-sky-50 border-sky-100",
    keywords: ["documentation", "docs", "specifications", "manual", "guide"],
  },
  {
    id: "articles",
    title: "Security Articles",
    description: "Deep dives into HTTPS, SSL/TLS, SPF, DMARC, security headers, and common web risks.",
    href: "/blog",
    actionLabel: "Browse Security Guides",
    icon: MessageSquare,
    iconColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
    keywords: ["articles", "blog", "guides", "https", "ssl", "tls", "spf", "dmarc", "headers"],
  },
  {
    id: "email",
    title: "Direct Email",
    description: "Need direct assistance or enterprise inquiries? Reach our engineering team directly.",
    href: "mailto:support@sitesecura.com",
    actionLabel: "Email Support",
    emailValue: "support@sitesecura.com",
    icon: Mail,
    iconColor: "text-purple-600 bg-purple-50 border-purple-100",
    isExternal: true,
    keywords: ["email", "direct", "support@sitesecura.com", "contact", "helpdesk"],
  },
];

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCategories = CATEGORIES.filter((category) => {
    if (!normalizedQuery) return true;
    return (
      category.title.toLowerCase().includes(normalizedQuery) ||
      category.description.toLowerCase().includes(normalizedQuery) ||
      category.keywords.some((k) => k.includes(normalizedQuery))
    );
  });

  const filteredResources = RESOURCES.filter((resource) => {
    if (!normalizedQuery) return true;
    return (
      resource.title.toLowerCase().includes(normalizedQuery) ||
      resource.description.toLowerCase().includes(normalizedQuery) ||
      (resource.emailValue && resource.emailValue.toLowerCase().includes(normalizedQuery)) ||
      resource.keywords.some((k) => k.includes(normalizedQuery))
    );
  });

  const hasMatches = filteredCategories.length > 0 || filteredResources.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await api.createSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        priority,
      });
      setSubmitted(true);
      setSubject("");
      setMessage("");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit support ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-10 max-w-5xl">
        {/* Support Center Header */}
        <div>
          <PageHeader
            title="Support Center"
            description="Get help with SiteSecura, security scans, reports, billing, and your account."
          />

          {/* Prominent Search Bar */}
          <div className="relative mt-2">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search help topics, guides, or categories (e.g., SSL, billing, scan)..."
                className="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-xs transition-all"
                aria-label="Search help topics"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {searchQuery && (
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>
                  Showing {filteredCategories.length + filteredResources.length} matching result
                  {filteredCategories.length + filteredResources.length === 1 ? "" : "s"} for &ldquo;
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{searchQuery}</span>&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium underline underline-offset-2"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>

        {/* If searching and no results found */}
        {searchQuery && !hasMatches && (
          <div className="p-8 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No matching help topics found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              We couldn&apos;t find any documentation or categories matching &ldquo;{searchQuery}&rdquo;. You can reset
              your search or send a direct support inquiry using the form below.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs"
              >
                Reset Search
              </button>
              <a
                href="#contact-support"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Contact Support ↓
              </a>
            </div>
          </div>
        )}

        {/* Section: How can we help? (Support Categories) */}
        {filteredCategories.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">How can we help?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Quickly navigate to guides, tools, and management portals.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <Link
                    key={category.id}
                    href={category.href}
                    className="group p-5 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${category.iconColor}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded-full">
                          {category.tag}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        {category.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                      <span>View details</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Section: Support Resources */}
        {filteredResources.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Support Resources</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official documentation, deep-dive guides, and direct engineering contact.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {filteredResources.map((resource) => {
                const Icon = resource.icon;
                const isMail = resource.id === "email";

                return (
                  <div
                    key={resource.id}
                    className="p-6 bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center border mb-4 ${resource.iconColor}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{resource.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                        {resource.description}
                      </p>
                      {resource.emailValue && (
                        <p className="text-xs font-mono font-medium text-purple-700 dark:text-purple-300 bg-purple-50/70 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-800 px-2.5 py-1 rounded-lg mt-3 inline-block">
                          {resource.emailValue}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                      {isMail ? (
                        <a
                          href={resource.href}
                          className="inline-flex items-center justify-center w-full py-2 px-3 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 rounded-xl text-xs font-semibold transition-colors gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{resource.actionLabel}</span>
                        </a>
                      ) : (
                        <Link
                          href={resource.href}
                          className="inline-flex items-center justify-center w-full py-2 px-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors gap-1.5 group"
                        >
                          <span>{resource.actionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Section: Need more help? / Contact Support Form */}
        <section id="contact-support" className="space-y-4 pt-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Need more help?</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Can&apos;t find what you need? Send us a support request.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111C2E] p-6 sm:p-8 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Contact Support</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Submit an inquiry directly to our engineering and support specialists.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Priority Response Available</span>
              </div>
            </div>

            {/* Error Feedback Banner */}
            {errorMessage && (
              <div
                role="status"
                className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start justify-between gap-3 animate-in fade-in"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Error submitting inquiry:</span>
                    <p className="mt-0.5 text-rose-700 dark:text-rose-400">{errorMessage}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 p-0.5"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Success State */}
            {submitted ? (
              <div
                role="status"
                className="p-6 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 space-y-3 animate-in fade-in"
              >
                <div className="flex items-center gap-2.5 font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/80 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                  </div>
                  <span>Ticket Submitted Successfully</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed max-w-xl">
                  Our engineering team has received your ticket and will reply to your registered email address shortly.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-white underline underline-offset-4"
                  >
                    Submit another inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 space-y-1.5">
                    <label htmlFor="support-subject" className="block font-semibold text-slate-700 dark:text-slate-300">
                      Subject <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="support-subject"
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Assistance with HSTS configuration on Nginx"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="support-priority" className="block font-semibold text-slate-700 dark:text-slate-300">
                      Priority <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="support-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High (Service Disruption)</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="support-message" className="block font-semibold text-slate-700 dark:text-slate-300">
                    Message Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="support-message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide details about your domain or the specific check you have questions about..."
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all leading-relaxed"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 order-2 sm:order-1">
                    Replies are delivered to your registered email address.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting || !subject.trim() || !message.trim()}
                    className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 order-1 sm:order-2 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Support Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
