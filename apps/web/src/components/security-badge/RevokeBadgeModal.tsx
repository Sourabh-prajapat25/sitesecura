"use client";

import React, { useState } from "react";
import { X, ShieldAlert, Loader2 } from "lucide-react";

interface RevokeBadgeModalProps {
  isOpen: boolean;
  domain: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RevokeBadgeModal({
  isOpen,
  domain,
  onClose,
  onConfirm,
}: RevokeBadgeModalProps) {
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRevoke = async () => {
    setRevoking(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to revoke verification badge.");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="revoke-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-[#111C2E] rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        <button
          type="button"
          onClick={onClose}
          disabled={revoking}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/40 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 id="revoke-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Revoke SiteSecura Verification?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">https://{domain}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-800">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          <p>
            This action will deactivate the active <strong className="text-slate-900 dark:text-white">SiteSecura Verified</strong> badge for this website.
          </p>
          <p className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs">
            <strong>Immediate effect:</strong> The dynamic badge SVG will transition to the red <em>REVOKED</em> state, and your public verification page will mark the status as revoked.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            You can re-verify at any time by running an eligible scan and issuing a new verification.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={revoking}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={revoking}
            className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {revoking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Revoking...</span>
              </>
            ) : (
              <span>Revoke Verification</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
