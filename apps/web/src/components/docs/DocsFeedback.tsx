"use client";

import React, { useState } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle2, MessageSquare, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

interface DocsFeedbackProps {
  articleSlug?: string;
  category?: string;
  articleTitle?: string;
  path?: string;
}

const FEEDBACK_REASONS = [
  { id: "unclear", label: "Explanation was hard to follow" },
  { id: "missing_example", label: "Needs more code / configuration examples" },
  { id: "outdated", label: "Information seems outdated or superseded" },
  { id: "instructions_failed", label: "Directives did not work on my web server" },
  { id: "other", label: "Other reason" },
];

export function DocsFeedback({
  articleSlug = "documentation-article",
  category,
  articleTitle,
  path,
}: DocsFeedbackProps) {
  const [status, setStatus] = useState<"idle" | "reasons" | "submitting" | "submitted" | "error">("idle");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleHelpful = async () => {
    setStatus("submitting");
    try {
      await api.submitDocFeedback({
        article_slug: articleSlug,
        category,
        helpful: true,
        path: path || (typeof window !== "undefined" ? window.location.pathname : undefined),
      });
      setStatus("submitted");
    } catch {
      setErrorMessage("Could not record feedback. Please try again.");
      setStatus("error");
    }
  };

  const handleUnhelpfulPrompt = () => {
    setStatus("reasons");
  };

  const handleUnhelpfulSubmit = async (reasonToSubmit?: string) => {
    setStatus("submitting");
    try {
      await api.submitDocFeedback({
        article_slug: articleSlug,
        category,
        helpful: false,
        reason: reasonToSubmit || selectedReason || undefined,
        path: path || (typeof window !== "undefined" ? window.location.pathname : undefined),
      });
      setStatus("submitted");
    } catch {
      setErrorMessage("Could not record feedback. Please try again.");
      setStatus("error");
    }
  };

  if (status === "submitted") {
    return (
      <div
        role="region"
        aria-live="polite"
        className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 sm:p-5 flex items-center gap-3 text-xs sm:text-sm text-sky-800 transition-all shadow-2xs"
      >
        <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
        <div className="space-y-0.5">
          <p className="font-semibold">Thank you for your feedback!</p>
          <p className="text-xs text-sky-700/90">
            We continually refine our security documentation and technical guides based on user input.
          </p>
        </div>
      </div>
    );
  }

  if (status === "reasons") {
    return (
      <div
        role="region"
        aria-live="polite"
        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs transition-all"
      >
        <div className="space-y-0.5">
          <p className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
            <span>How can we improve this documentation page?</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Select an optional reason to help our security engineering team clarify this guide.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FEEDBACK_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedReason(r.id)}
              className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                selectedReason === r.id
                  ? "bg-sky-50 border-sky-300 text-sky-900 font-semibold"
                  : "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => handleUnhelpfulSubmit()}
            className="text-slate-400 hover:text-slate-600 underline font-medium text-[11px]"
          >
            Skip & submit without reason
          </button>

          <button
            type="button"
            onClick={() => handleUnhelpfulSubmit(selectedReason)}
            className="px-3.5 py-1.5 rounded-xl font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-2xs transition-colors"
          >
            Submit Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Documentation helpfulness feedback"
      className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
    >
      <div className="space-y-0.5">
        <p className="text-xs sm:text-sm font-bold text-slate-900">
          Was this documentation page helpful?
        </p>
        <p className="text-[11px] text-slate-500">
          Your feedback directly informs technical revisions and snippet generator defaults.
        </p>
        {status === "error" && (
          <p className="text-xs text-red-600 font-medium flex items-center gap-1 pt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorMessage}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={status === "submitting"}
          onClick={handleHelpful}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200/80 hover:border-sky-200 transition-colors disabled:opacity-50"
          aria-label="Mark page as helpful"
        >
          {status === "submitting" ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : (
            <ThumbsUp className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>Yes</span>
        </button>

        <button
          type="button"
          disabled={status === "submitting"}
          onClick={handleUnhelpfulPrompt}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 transition-colors disabled:opacity-50"
          aria-label="Mark page as not helpful"
        >
          <ThumbsDown className="w-3.5 h-3.5 text-slate-500" />
          <span>No</span>
        </button>
      </div>
    </div>
  );
}
