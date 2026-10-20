"use client";

import React from "react";
import { Check, X } from "lucide-react";

export interface PasswordStrengthIndicatorProps {
  password: string;
}

export function computePasswordScore(password: string): {
  score: number;
  label: "Weak" | "Fair" | "Strong";
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    symbol: boolean;
  };
} {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };

  const passedCount = Object.values(checks).filter(Boolean).length;

  let label: "Weak" | "Fair" | "Strong" = "Weak";
  let score = 1;

  if (passedCount <= 2 || !checks.length) {
    label = "Weak";
    score = 1;
  } else if (passedCount <= 4) {
    label = "Fair";
    score = 2;
  } else {
    label = "Strong";
    score = 3;
  }

  return { score, label, checks };
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const { score, label, checks } = computePasswordScore(password);

  const getBarColor = (index: number) => {
    if (score < index) return "bg-slate-200";
    if (score === 1) return "bg-amber-500";
    if (score === 2) return "bg-sky-500";
    return "bg-emerald-500";
  };

  const getLabelColor = () => {
    if (score === 1) return "text-amber-600";
    if (score === 2) return "text-sky-600";
    return "text-emerald-600";
  };

  return (
    <div className="mt-2.5 space-y-2 text-xs" aria-live="polite">
      {/* Visual meter bar & text rating */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 flex gap-1.5 h-1.5 rounded-full overflow-hidden">
          <div className={`flex-1 transition-all duration-300 rounded-full ${getBarColor(1)}`} />
          <div className={`flex-1 transition-all duration-300 rounded-full ${getBarColor(2)}`} />
          <div className={`flex-1 transition-all duration-300 rounded-full ${getBarColor(3)}`} />
        </div>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${getLabelColor()}`}>
          {label}
        </span>
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-500 pt-1">
        <div className="flex items-center gap-1.5">
          {checks.length ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          )}
          <span className={checks.length ? "text-slate-700 font-medium" : "text-slate-400"}>
            8+ characters
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {checks.uppercase && checks.lowercase ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          )}
          <span
            className={
              checks.uppercase && checks.lowercase ? "text-slate-700 font-medium" : "text-slate-400"
            }
          >
            Upper & lower case
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {checks.number ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          )}
          <span className={checks.number ? "text-slate-700 font-medium" : "text-slate-400"}>
            At least 1 number
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {checks.symbol ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          )}
          <span className={checks.symbol ? "text-slate-700 font-medium" : "text-slate-400"}>
            Special symbol (!@#$)
          </span>
        </div>
      </div>
    </div>
  );
}

export default PasswordStrengthIndicator;
