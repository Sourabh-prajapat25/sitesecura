"use client";

import React, { useState } from "react";
import { X, Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteWebsiteModalProps {
  isOpen: boolean;
  domain: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteWebsiteModal({
  isOpen,
  domain,
  onClose,
  onConfirm,
}: DeleteWebsiteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err.message || "Failed to delete website.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-100 dark:border-red-900/60">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Website Target</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">https://{domain}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs rounded-xl border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        <div className="p-3.5 bg-red-50/70 dark:bg-red-950/30 rounded-xl border border-red-200/80 dark:border-red-900/60 mb-5 text-xs text-red-800 dark:text-red-200 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>Warning: Permanent Deletion</span>
          </div>
          <p className="leading-relaxed pl-5.5 text-red-700 dark:text-red-300">
            Deleting this website will permanently remove all historical scan records, score trend data, automated monitoring schedules, and alert history for <strong>{domain}</strong>.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{deleting ? "Deleting..." : "Delete Website"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
