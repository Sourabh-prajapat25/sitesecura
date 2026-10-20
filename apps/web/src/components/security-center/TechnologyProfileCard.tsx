"use client";

import React from "react";
import { ScanCheck } from "@/types";
import { Cpu, ArrowRight, ShieldCheck, Check } from "lucide-react";

interface TechnologyProfileCardProps {
  checks: ScanCheck[];
  onSelectCheck: (checkId: string) => void;
}

export function TechnologyProfileCard({
  checks,
  onSelectCheck,
}: TechnologyProfileCardProps) {
  const techCheck = checks.find((c) => c.check_type === "technology_detection");

  // Extract detected technologies from real scanner evidence or summary
  let technologies: string[] = [];

  if (techCheck) {
    if (techCheck.evidence && techCheck.evidence.includes(":")) {
      const parts = techCheck.evidence.split(":");
      if (parts.length > 1) {
        technologies = parts[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else if (techCheck.summary && techCheck.summary.includes(":")) {
      const parts = techCheck.summary.split(":");
      if (parts.length > 1) {
        technologies = parts[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Technology & Infrastructure
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            Passive Signals
          </span>
        </div>

        {technologies.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Passive technology signals identified {technologies.length} active platform and server {technologies.length === 1 ? "technology" : "technologies"}:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {technologies.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs hover:bg-slate-200/80 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  <span>{tech}</span>
                </span>
              ))}
            </div>
          </div>
        ) : techCheck ? (
          <div className="py-6 text-center space-y-2 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Minimal Server Fingerprint Exposed
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              The server does not leak recognizable framework, CMS, or library version signatures in headers or HTML.
            </p>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Technology fingerprinting runs automatically during scans.
          </div>
        )}
      </div>

      <div className="pt-3.5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 dark:text-slate-500">Non-intrusive header & DOM analysis</span>
        {techCheck && (
          <button
            type="button"
            onClick={() => onSelectCheck(techCheck.id)}
            className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline"
          >
            <span>View technical profile</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
