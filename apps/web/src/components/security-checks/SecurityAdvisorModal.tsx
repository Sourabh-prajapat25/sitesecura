"use client";

import React, { useState } from "react";
import { ScanCheck, SubscriptionPlan } from "@/types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  X,
  Sparkles,
  Bot,
  Lock,
  ArrowRight,
  ShieldCheck,
  Terminal,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

interface SecurityAdvisorModalProps {
  isOpen: boolean;
  check: ScanCheck | null;
  plan?: SubscriptionPlan | string;
  onClose: () => void;
  onUpgrade: () => void;
  onTriggerVerificationScan?: () => void;
}

export function SecurityAdvisorModal({
  isOpen,
  check,
  plan = "free",
  onClose,
  onUpgrade,
  onTriggerVerificationScan,
}: SecurityAdvisorModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !check) return null;

  const normPlan = (plan || "free").toLowerCase();
  const isProOrAbove = normPlan === "pro" || normPlan === "agency" || normPlan === "admin";

  const handleCopyRemediation = async () => {
    if (!check.how_to_fix) return;
    try {
      await navigator.clipboard.writeText(check.how_to_fix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Security Advisor</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  Defensive AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ground-truth remediation guidance based strictly on verified scanner findings.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto py-5 space-y-5 text-xs">
          {/* Target Finding Headline */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                Evaluating Check: {check.check_type}
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-300 capitalize text-[11px]">
                Status: {check.status}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{check.title}</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">{check.summary}</p>
          </div>

          {!isProOrAbove ? (
            /* Locked State for Free/Basic Plan */
            <div className="p-6 bg-gradient-to-br from-slate-900 to-sky-950 text-white rounded-2xl border border-slate-800 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-white/10 text-sky-300 flex items-center justify-center mx-auto border border-white/10">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">AI Security Advisor</h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Unlock step-by-step interactive CLI commands, web server remediation snippets, and threat impact analysis tailored specifically for your infrastructure.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onUpgrade();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Upgrade to Pro to Unlock Advisor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Active Advisor View for Pro/Agency Plan */
            <div className="space-y-4">
              {/* Executive Threat & Risk Analysis */}
              <div className="p-4 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-200/80 dark:border-sky-800 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-sky-900 dark:text-sky-200">
                  <Lightbulb className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Executive Risk Perspective</span>
                </div>
                <MarkdownRenderer
                  content={
                    check.why_it_matters ||
                    "This security control enforces baseline defensive parameters to protect users against unauthorized manipulation or passive reconnaissance."
                  }
                  variant="compact"
                />
              </div>

              {/* Remediation Playbook */}
              {check.how_to_fix && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                      Recommended Remediation Playbook
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRemediation}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-700 dark:text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>Copy Commands</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-slate-900 dark:bg-[#0B1220] text-slate-100 p-4 rounded-xl border border-slate-800 dark:border-slate-700 font-mono text-xs overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-all text-emerald-400 leading-relaxed font-mono">
                      {check.how_to_fix}
                    </pre>
                  </div>
                </div>
              )}

              {/* Verification Hint */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Once your configuration changes have propagated through your DNS or server restarts, run a verification scan to confirm the defect has cleared.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 dark:text-slate-500 font-medium">Deterministic Rule Guidance</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            {onTriggerVerificationScan && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerVerificationScan();
                }}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold shadow-xs transition-colors"
              >
                Run Verification Scan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
