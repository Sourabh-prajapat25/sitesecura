"use client";

import React, { useState, useEffect, useRef } from "react";
import { ScanCheck, Scan, SubscriptionPlan } from "@/types";
import { api } from "@/lib/api";
import { canAccessAiAdvisor } from "@/lib/entitlements";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  X,
  Sparkles,
  Bot,
  Lock,
  ArrowRight,
  ShieldCheck,
  Code2,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Send,
  Loader2,
  RefreshCw,
  Terminal,
  FileText,
  ListOrdered,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

export type AdvisorTab = "explain" | "fix" | "plan" | "chat";

interface AiSecurityAdvisorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scan: Scan | null;
  check?: ScanCheck | null;
  domain?: string;
  plan?: SubscriptionPlan | string;
  initialTab?: AdvisorTab;
  onUpgrade: () => void;
  onTriggerVerificationScan?: () => void;
}

export function AiSecurityAdvisorDrawer({
  isOpen,
  onClose,
  scan,
  check: initialCheck,
  domain,
  plan = "free",
  initialTab = "explain",
  onUpgrade,
  onTriggerVerificationScan,
}: AiSecurityAdvisorDrawerProps) {
  const [activeTab, setActiveTab] = useState<AdvisorTab>(initialTab);
  const [selectedCheck, setSelectedCheck] = useState<ScanCheck | null>(initialCheck || null);
  const [explainMode, setExplainMode] = useState<"standard" | "business" | "technical">("standard");

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature contents
  const [explanation, setExplanation] = useState<any | null>(null);
  const [fixGuide, setFixGuide] = useState<any | null>(null);
  const [securityPlan, setSecurityPlan] = useState<any | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; structured?: any }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Quota usage
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const isEntitled = canAccessAiAdvisor(plan);

  useEffect(() => {
    if (initialCheck) {
      setSelectedCheck(initialCheck);
    } else if (scan?.checks && scan.checks.length > 0 && !selectedCheck) {
      // Pick first non-pass check or first check
      const firstIssue = scan.checks.find((c) => c.status !== "pass") || scan.checks[0];
      setSelectedCheck(firstIssue);
    }
  }, [initialCheck, scan]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Load usage when drawer opens
  useEffect(() => {
    if (isOpen && isEntitled) {
      api.getAiUsage()
        .then((u) => setUsage(u))
        .catch(() => {});
    }
  }, [isOpen, isEntitled]);

  // Load data based on active tab
  useEffect(() => {
    if (!isOpen || !isEntitled || !scan) return;

    if (activeTab === "explain" && selectedCheck) {
      fetchExplanation();
    } else if (activeTab === "fix" && selectedCheck) {
      fetchFixGuide();
    } else if (activeTab === "plan") {
      fetchSecurityPlan();
    }
  }, [activeTab, selectedCheck?.id, explainMode, isOpen, isEntitled]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const fetchExplanation = async () => {
    if (!scan || !selectedCheck) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.explainFinding(scan.id, selectedCheck.id, explainMode);
      setExplanation(res.structured_data || { what_we_found: res.content });
    } catch (err: any) {
      setError(err.message || "Unable to load explanation.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFixGuide = async () => {
    if (!scan || !selectedCheck) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.generateFixGuide(scan.id, selectedCheck.id);
      setFixGuide(res.structured_data || { steps: [], title: selectedCheck.title });
    } catch (err: any) {
      setError(err.message || "Unable to load fix guide.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityPlan = async () => {
    if (!scan) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSecurityPlan(scan.id);
      setSecurityPlan(res.structured_data || { phases: [] });
    } catch (err: any) {
      setError(err.message || "Unable to load security improvement plan.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendChat = async (textToSend?: string) => {
    const query = (textToSend || chatInput).trim();
    if (!query || !scan || chatLoading) return;

    const newMessages = [...messages, { role: "user" as const, content: query }];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const history = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.chatWithAdvisor(scan.id, query, history);
      const answerText = res.structured_data?.answer || res.content;
      setMessages([...newMessages, { role: "assistant", content: answerText, structured: res.structured_data }]);
      // Refresh usage count
      api.getAiUsage().then((u) => setUsage(u)).catch(() => {});
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Security Advisor is temporarily unavailable. Please verify your connection or try again shortly.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopy = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-[#111C2E] shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
          {/* HEADER */}
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                <Sparkles className="w-5 h-5 text-sky-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    Security Advisor
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    Defensive AI
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                  <span>{domain || scan?.domain || "Target Website"}</span>
                  <span>•</span>
                  <span>Score: {scan?.score ?? "—"}/100</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* TAB NAVIGATION */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 px-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold text-slate-600 dark:text-slate-400">
              <button
                type="button"
                onClick={() => setActiveTab("explain")}
                className={`py-3 px-2 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === "explain"
                    ? "border-sky-600 dark:border-sky-500 text-sky-700 dark:text-sky-400"
                    : "border-transparent hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Explain Finding</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("fix")}
                className={`py-3 px-2 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === "fix"
                    ? "border-sky-600 dark:border-sky-500 text-sky-700 dark:text-sky-400"
                    : "border-transparent hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>AI Fix Guide</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("plan")}
                className={`py-3 px-2 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === "plan"
                    ? "border-sky-600 dark:border-sky-500 text-sky-700 dark:text-sky-400"
                    : "border-transparent hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Security Plan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`py-3 px-2 border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === "chat"
                    ? "border-sky-600 dark:border-sky-500 text-sky-700 dark:text-sky-400"
                    : "border-transparent hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Ask Advisor</span>
              </button>
            </div>

            {/* Quota Badge */}
            {isEntitled && usage && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                <Sparkles className="w-3 h-3 text-sky-500" />
                <span>{usage.remaining} / {usage.limit} credits left</span>
              </div>
            )}
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!isEntitled ? (
              /* LOCKED VALUE PROPOSITION FOR FREE/BASIC */
              <div className="p-8 bg-gradient-to-br from-slate-900 to-sky-950 text-white rounded-2xl border border-slate-800 space-y-5 text-center shadow-lg my-auto">
                <div className="w-14 h-14 rounded-2xl bg-white/10 text-sky-300 flex items-center justify-center mx-auto border border-white/15">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-white">AI Security Advisor is a Pro Feature</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Transform complex security scan findings into plain-English explanations, tailored code remediation guides, and multi-phase security plans.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left p-4 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">Step-by-step Nginx & DNS guides</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">Executive business risk breakdowns</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">Multi-provider failover (Groq & Gemini)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">Zero hallucinations on real scans</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onUpgrade();
                  }}
                  className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Upgrade to Pro to Unlock Advisor</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Check Selector Pill Bar if in Explain or Fix tab */}
                {(activeTab === "explain" || activeTab === "fix") && (scan?.checks?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Active Finding Target:
                    </label>
                    <select
                      value={selectedCheck?.id || ""}
                      onChange={(e) => {
                        const found = (scan?.checks || []).find((c) => c.id === e.target.value);
                        if (found) setSelectedCheck(found);
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-slate-800 dark:text-slate-100 shadow-2xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      {(scan?.checks || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.severity?.toUpperCase() || c.status?.toUpperCase()}] {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}


                {/* ERROR BANNER */}
                {error && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Security Advisor Notice</p>
                      <p className="mt-0.5 text-rose-700 dark:text-rose-400">{error}</p>
                    </div>
                  </div>
                )}

                {/* TAB 1: EXPLAIN FINDING */}
                {activeTab === "explain" && (
                  <div className="space-y-4 text-xs">
                    {/* Perspective Switcher */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg w-fit text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <button
                        type="button"
                        onClick={() => setExplainMode("standard")}
                        className={`px-3 py-1 rounded-md transition-all ${
                          explainMode === "standard" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs" : "hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => setExplainMode("business")}
                        className={`px-3 py-1 rounded-md transition-all ${
                          explainMode === "business" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs" : "hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        Executive Risk
                      </button>
                      <button
                        type="button"
                        onClick={() => setExplainMode("technical")}
                        className={`px-3 py-1 rounded-md transition-all ${
                          explainMode === "technical" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs" : "hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        Deep Technical
                      </button>
                    </div>

                    {loading ? (
                      <div className="py-16 text-center space-y-3">
                        <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Synthesizing verified scan evidence with Defensive AI...
                        </p>
                      </div>
                    ) : explanation ? (
                      <div className="space-y-4">
                        {/* What we found */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                          <h5 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                            What We Found
                          </h5>
                          <MarkdownRenderer
                            content={explanation.what_we_found || explanation.summary || ""}
                            variant="compact"
                          />
                        </div>

                        {/* Why it matters */}
                        <div className="p-4 bg-sky-50/70 dark:bg-sky-950/40 rounded-xl border border-sky-200/80 dark:border-sky-900/50 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-sky-950 dark:text-sky-300 text-[11px] uppercase tracking-wider">
                            <Lightbulb className="w-3.5 h-3.5 text-sky-600" />
                            <span>Why It Matters</span>
                          </div>
                          <MarkdownRenderer
                            content={explanation.why_it_matters || ""}
                            variant="compact"
                          />
                        </div>

                        {/* What this does NOT mean */}
                        <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/50 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-300 text-[11px] uppercase tracking-wider">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>What This Does Not Mean</span>
                          </div>
                          <MarkdownRenderer
                            content={
                              explanation.what_this_does_not_mean ||
                              "This finding is an external configuration observation and does not mean that your system or data has been compromised."
                            }
                            variant="compact"
                          />
                        </div>

                        {/* Recommended Next Step */}
                        <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-950 dark:text-emerald-300 text-[11px] uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Recommended Next Step</span>
                          </div>
                          <MarkdownRenderer
                            content={explanation.recommended_next_step || ""}
                            variant="compact"
                          />
                        </div>

                        <div className="pt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setActiveTab("fix")}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Generate Fix Guide</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* TAB 2: AI FIX GUIDE */}
                {activeTab === "fix" && (
                  <div className="space-y-4 text-xs">
                    {loading ? (
                      <div className="py-16 text-center space-y-3">
                        <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
                        <p className="text-xs text-slate-500 font-medium">
                          Formulating step-by-step remediation playbook...
                        </p>
                      </div>
                    ) : fixGuide ? (
                      <div className="space-y-5">
                        {/* Header Box */}
                        <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                              Remediation Playbook
                            </span>
                            <h4 className="text-sm font-bold text-white mt-0.5">
                              {fixGuide.title || selectedCheck?.title}
                            </h4>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Estimated Effort
                            </span>
                            <span className="text-xs font-extrabold text-emerald-400">
                              {fixGuide.estimated_effort || "~5 minutes"}
                            </span>
                          </div>
                        </div>

                        {/* Pre-requisites */}
                        {fixGuide.before_you_begin && (
                          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 space-y-1">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
                              Before You Begin
                            </span>
                            <MarkdownRenderer content={fixGuide.before_you_begin} variant="compact" />
                          </div>
                        )}

                        {/* Numbered Steps */}
                        <div className="space-y-3">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider block">
                            Recommended Steps
                          </span>
                          {(fixGuide.steps || []).map((step: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-4 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-black text-xs flex items-center justify-center shrink-0">
                                  {step.step_number || idx + 1}
                                </span>
                                <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{step.title}</h5>
                              </div>
                              <div className="pl-8">
                                <MarkdownRenderer content={step.instruction} variant="compact" />
                              </div>

                              {step.code_or_config && (
                                <div className="ml-8 relative">
                                  <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto">
                                    <pre className="text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
                                      {step.code_or_config}
                                    </pre>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(step.code_or_config, idx)}
                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                                  >
                                    {copiedIndex === idx ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Verification & Rescan Banner */}
                        <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-emerald-950 dark:text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-300">
                              {fixGuide.verification ||
                                "Publish your configuration updates and trigger a verification scan to confirm clearance."}
                            </p>
                          </div>
                          {onTriggerVerificationScan && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onTriggerVerificationScan();
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
                            >
                              Run Verification Scan
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* TAB 3: SECURITY PLAN */}
                {activeTab === "plan" && (
                  <div className="space-y-4 text-xs">
                    {loading ? (
                      <div className="py-16 text-center space-y-3">
                        <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Synthesizing prioritized remediation roadmap across all scan findings...
                        </p>
                      </div>
                    ) : securityPlan ? (
                      <div className="space-y-5">
                        <div className="p-4 bg-gradient-to-r from-sky-900 to-indigo-900 text-white rounded-xl shadow-md flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-sky-300 tracking-wider">
                              Prioritized Roadmap
                            </span>
                            <h4 className="text-sm font-bold text-white mt-0.5">
                              Security Improvement Plan
                            </h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-300 block">
                              Total Estimate
                            </span>
                            <span className="text-xs font-black text-emerald-300">
                              {securityPlan.estimated_total_time || "~45 minutes"}
                            </span>
                          </div>
                        </div>

                        {(securityPlan.phases || []).map((phase: any, pIdx: number) => (
                          <div key={pIdx} className="space-y-2.5">
                            <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-sky-600" />
                              <span>{phase.phase_name || `Phase ${pIdx + 1}`}</span>
                            </h5>

                            <div className="space-y-2">
                              {(phase.items || []).map((item: any, iIdx: number) => (
                                <div
                                  key={iIdx}
                                  className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                        {item.rank ? `#${item.rank} ` : ""}{item.title}
                                      </span>
                                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                                        {item.severity}
                                      </span>
                                    </div>
                                    <MarkdownRenderer content={item.action_summary} variant="compact" />
                                  </div>

                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    {item.estimated_effort}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Rescan note */}
                        <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-slate-600 dark:text-slate-300 text-xs flex items-center justify-between gap-2">
                          <p>{securityPlan.post_remediation_advice || "Rescan once all items are resolved."}</p>
                          {onTriggerVerificationScan && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onTriggerVerificationScan();
                              }}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition-colors shrink-0"
                            >
                              Rescan Now
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* TAB 4: INTERACTIVE CHAT */}
                {activeTab === "chat" && (
                  <div className="flex flex-col h-[520px]">
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                      {messages.length === 0 ? (
                        <div className="py-8 text-center space-y-4">
                          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto border border-sky-100 dark:border-sky-900/50">
                            <Bot className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Ask About Your Website Security</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                              Ask questions about your latest scan score, specific vulnerabilities, or how to fix configuration issues.
                            </p>
                          </div>

                          {/* Quick Suggestion Pills */}
                          <div className="pt-2 flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                            {[
                              "What is lowering my score?",
                              "What should I fix first?",
                              "Explain my highest priority issue.",
                              "How can I improve my DNS security?",
                              "Explain finding in simple terms.",
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSendChat(q)}
                                className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-sky-50 dark:hover:bg-sky-950/60 hover:border-sky-200 dark:hover:border-sky-800 text-slate-700 dark:text-slate-300 hover:text-sky-800 dark:hover:text-sky-300 font-semibold text-xs border border-slate-200/80 dark:border-slate-700 transition-all text-left"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        messages.map((m, idx) => (
                          <div
                            key={idx}
                            className={`flex flex-col ${
                              m.role === "user" ? "items-end" : "items-start"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                                m.role === "user"
                                  ? "bg-sky-600 text-white font-medium rounded-br-xs"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs"
                              }`}
                            >
                              {m.role === "user" ? (
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              ) : (
                                <MarkdownRenderer content={m.content} variant="compact" />
                              )}
                            </div>
                          </div>
                        ))
                      )}

                      {chatLoading && (
                        <div className="flex items-center gap-2 text-slate-400 text-xs p-3">
                          <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                          <span>Advisor is analyzing scan context...</span>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChat();
                          }
                        }}
                        placeholder="Ask a security question about this scan..."
                        className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500 bg-white dark:bg-[#0B1220] text-slate-900 dark:text-white"
                        disabled={chatLoading}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendChat()}
                        disabled={chatLoading || !chatInput.trim()}
                        className="p-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl transition-colors disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs shrink-0">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Ground truth strictly verified by SiteSecura scanner
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
