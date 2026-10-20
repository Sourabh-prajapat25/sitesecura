"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, CornerDownRight, HelpCircle } from "lucide-react";
import { CspDirectiveItem } from "@/types";

export interface CspDirectiveTableProps {
  directives: CspDirectiveItem[];
  effectiveDirectives?: Record<string, CspDirectiveItem>;
}

export function CspDirectiveTable({ directives, effectiveDirectives }: CspDirectiveTableProps) {
  if (!directives || directives.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
        No explicit directives parsed in this policy.
      </div>
    );
  }

  // Combine explicit directives and notable inherited fallbacks
  const displayedItems: CspDirectiveItem[] = [...directives];

  // Add key inherited fallback directives if they were missing explicitly but inherited
  if (effectiveDirectives) {
    const keyFallbacks = ["script-src", "object-src", "style-src", "img-src", "connect-src"];
    for (const k of keyFallbacks) {
      if (!directives.some((d) => d.name === k) && effectiveDirectives[k]?.is_fallback) {
        displayedItems.push(effectiveDirectives[k]);
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-4 py-3 min-w-[140px]">Directive</th>
              <th className="px-4 py-3 min-w-[280px]">Source Expressions</th>
              <th className="px-4 py-3 min-w-[140px]">Origin</th>
              <th className="px-4 py-3 min-w-[160px]">Status & Warnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {displayedItems.map((item, idx) => {
              const isFallback = item.is_fallback;
              const hasWarnings = item.warnings && item.warnings.length > 0;

              return (
                <tr
                  key={`${item.name}-${idx}`}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    isFallback ? "bg-purple-50/20" : ""
                  }`}
                >
                  {/* Directive Name */}
                  <td className="px-4 py-3 align-top font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      {isFallback && (
                        <CornerDownRight className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      )}
                      <span className={isFallback ? "text-purple-900" : "text-sky-950"}>
                        {item.name}
                      </span>
                    </div>
                  </td>

                  {/* Source Expressions */}
                  <td className="px-4 py-3 align-top">
                    {item.values.length === 0 ? (
                      <span className="text-slate-400 italic font-sans">(no sources declared)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {item.values.map((val, vIdx) => {
                          const valLower = val.toLowerCase();
                          const isUnsafe = valLower === "'unsafe-inline'" || valLower === "'unsafe-eval'";
                          const isNone = valLower === "'none'";
                          const isWildcard = val === "*";
                          const isStrictDynamic = valLower === "'strict-dynamic'";
                          const isNonce = valLower.startsWith("'nonce-") || valLower.startsWith("'sha");

                          let badgeClass = "bg-slate-100 text-slate-800 border-slate-200";
                          if (isUnsafe || isWildcard) {
                            badgeClass = "bg-rose-50 text-rose-800 border-rose-200 font-bold";
                          } else if (isNone) {
                            badgeClass = "bg-slate-200 text-slate-900 border-slate-300 font-bold";
                          } else if (isStrictDynamic || isNonce) {
                            badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
                          } else if (valLower === "'self'") {
                            badgeClass = "bg-sky-50 text-sky-800 border-sky-200 font-semibold";
                          }

                          return (
                            <span
                              key={vIdx}
                              className={`px-2 py-0.5 rounded border text-[11px] truncate max-w-[220px] ${badgeClass}`}
                              title={val}
                            >
                              {val}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>

                  {/* Origin */}
                  <td className="px-4 py-3 align-top font-sans text-xs">
                    {isFallback ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        Inherited ({item.fallback_source})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Explicit declaration
                      </span>
                    )}
                  </td>

                  {/* Status & Warnings */}
                  <td className="px-4 py-3 align-top font-sans text-xs space-y-1">
                    {item.is_duplicate && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 mr-1">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        Duplicate (Ignored)
                      </div>
                    )}
                    {item.is_deprecated && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mr-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Deprecated
                      </div>
                    )}
                    {item.is_unknown && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 mr-1">
                        Unrecognized
                      </div>
                    )}
                    {!item.is_duplicate && !item.is_deprecated && !item.is_unknown && !hasWarnings && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Valid
                      </span>
                    )}

                    {hasWarnings && (
                      <div className="pt-1 space-y-1">
                        {item.warnings.map((w, wIdx) => (
                          <div
                            key={wIdx}
                            className="text-[10px] text-slate-600 bg-amber-50/60 border border-amber-200/80 p-1.5 rounded leading-tight"
                          >
                            {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
