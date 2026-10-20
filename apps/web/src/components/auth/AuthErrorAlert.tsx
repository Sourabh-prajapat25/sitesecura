"use client";

import React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, X } from "lucide-react";

export interface AuthErrorAlertProps {
  message: string | null;
  variant?: "error" | "warning" | "success";
  onDismiss?: () => void;
  actionText?: string;
  onAction?: () => void;
}

export function AuthErrorAlert({
  message,
  variant = "error",
  onDismiss,
  actionText,
  onAction,
}: AuthErrorAlertProps) {
  if (!message) return null;

  const styles = {
    error: {
      container: "bg-red-50 border-red-200 text-red-800",
      icon: <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
      action: "text-red-700 hover:text-red-900 underline",
    },
    warning: {
      container: "bg-amber-50 border-amber-200 text-amber-800",
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
      action: "text-amber-700 hover:text-amber-900 underline",
    },
    success: {
      container: "bg-emerald-50 border-emerald-200 text-emerald-800",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
      action: "text-emerald-700 hover:text-emerald-900 underline",
    },
  }[variant];

  return (
    <div
      role="alert"
      className={`p-3.5 border rounded-xl flex items-start gap-2.5 text-xs font-medium animate-in fade-in duration-200 shadow-sm ${styles.container}`}
    >
      {styles.icon}
      <div className="flex-1 leading-relaxed">
        <span>{message}</span>
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className={`block mt-1 font-bold ${styles.action} cursor-pointer`}
          >
            {actionText}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert message"
          className="text-slate-400 hover:text-slate-600 shrink-0 p-0.5 focus:outline-none"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default AuthErrorAlert;
