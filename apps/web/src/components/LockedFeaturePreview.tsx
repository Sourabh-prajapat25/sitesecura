"use client";

import React from "react";
import { Lock } from "lucide-react";

export interface LockedFeaturePreviewProps {
  icon: React.ComponentType<{ className?: string }>;
  badgeText?: string;
  title: string;
  description: string;
  ctaText: string;
  onUpgrade: () => void;
  children: React.ReactNode;
  className?: string;
}

export function LockedFeaturePreview({
  icon: Icon,
  badgeText = "Premium Feature",
  title,
  description,
  ctaText,
  onUpgrade,
  children,
  className = "",
}: LockedFeaturePreviewProps) {
  return (
    <div
      className={`relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111C2E] overflow-hidden shadow-xs ${className}`}
    >
      {/* 1. Underlying Realistic UI Preview (intentionally softened & non-interactive) */}
      <div
        className="pointer-events-none select-none filter blur-[2.5px] opacity-60 contrast-95 transition-all motion-reduce:transition-none"
        aria-hidden="true"
        tabIndex={-1}
      >
        {children}
      </div>

      {/* 2. Soft translucent gradient veil with radial focus on center card */}
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-6 bg-slate-900/15 dark:bg-black/40 backdrop-blur-[1.5px]">
        {/* 3. Central Modern SaaS Upgrade Card */}
        <div className="relative w-full max-w-md bg-white/95 dark:bg-[#111C2E]/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xl shadow-slate-900/15 dark:shadow-black/50 p-6 sm:p-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">
          {/* Feature Icon */}
          <div className="mx-auto w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100/90 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-2xs">
            <Icon className="w-6 h-6" />
          </div>

          {/* Badge */}
          {badgeText && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/70 dark:border-sky-800 shadow-2xs">
              <Lock className="w-3 h-3 text-sky-500" />
              <span>{badgeText}</span>
            </div>
          )}

          {/* Title & Description */}
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
              {description}
            </p>
          </div>

          {/* CTA Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onUpgrade}
              className="w-full sm:w-auto min-w-[220px] px-6 py-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-sky-600/25 hover:shadow-lg hover:shadow-sky-500/30 active:scale-[0.99] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 motion-reduce:transition-none"
            >
              {ctaText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LockedFeaturePreview;
