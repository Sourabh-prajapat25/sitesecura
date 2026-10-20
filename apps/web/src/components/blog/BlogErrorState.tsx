import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface BlogErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function BlogErrorState({
  message = "Failed to load security articles. Please check your network connection.",
  onRetry,
}: BlogErrorStateProps) {
  return (
    <div className="py-16 text-center bg-white rounded-3xl border border-rose-200 p-8 space-y-4 shadow-sm max-w-lg mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-600">
        <AlertCircle className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900">Unable to load publications</h3>
        <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
      </div>

      {onRetry && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      )}
    </div>
  );
}
