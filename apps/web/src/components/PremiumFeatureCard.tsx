"use client";

import React from "react";
import { Lock, ArrowRight, Check } from "lucide-react";

export interface PremiumFeatureCardProps {
  featureName: string;
  description: string;
  icon: React.ReactNode;
  requiredPlan?: "Basic" | "Pro" | "Agency";
  ctaText?: string;
  benefits?: string[];
  preview?: React.ReactNode;
  isLocked?: boolean;
  onUnlock: () => void;
}

export function PremiumFeatureCard({
  featureName,
  description,
  icon,
  requiredPlan = "Basic",
  ctaText = "Unlock Feature",
  benefits = [],
  preview,
  isLocked = true,
  onUnlock,
}: PremiumFeatureCardProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group">
      {/* Subtle top indicator */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-600 opacity-80" />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:scale-105 transition-transform">
            {icon}
          </div>
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
              <Lock className="w-3 h-3 text-sky-600" />
              <span>Available with {requiredPlan}</span>
            </span>
          )}
        </div>

        <div>
          <h4 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
            {featureName}
          </h4>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{description}</p>
        </div>

        {benefits.length > 0 && (
          <ul className="space-y-1.5 pt-1 text-xs text-slate-600">
            {benefits.map((b, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {preview && <div className="pt-2">{preview}</div>}
      </div>

      <div className="pt-5 mt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onUnlock}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
        >
          {isLocked ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>{ctaText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              <span>Access Feature</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
