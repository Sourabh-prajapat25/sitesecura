"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Shield,
  Bot,
  Compass,
  Sparkles,
} from "lucide-react";
import { RobotsUserAgentGroup } from "@/types";

export interface RobotsPathSimulatorProps {
  groups: RobotsUserAgentGroup[];
}

interface SimulationResult {
  isAllowed: boolean;
  matchingRule: string | null;
  ruleLength: number;
  matchedGroup: string;
  explanation: string;
}

export function RobotsPathSimulator({ groups }: RobotsPathSimulatorProps) {
  const [userAgent, setUserAgent] = useState<string>("*");
  const [path, setPath] = useState<string>("/admin/");

  // Extract all user agent names present in the parsed groups
  const availableUserAgents = useMemo(() => {
    const agents = new Set<string>(["*", "Googlebot", "Bingbot"]);
    groups.forEach((g) => {
      g.user_agents.forEach((ua) => agents.add(ua));
    });
    return Array.from(agents);
  }, [groups]);

  // Client-side RFC 9309 rule evaluation
  const simulation = useMemo<SimulationResult>(() => {
    if (!groups || groups.length === 0) {
      return {
        isAllowed: true,
        matchingRule: null,
        ruleLength: 0,
        matchedGroup: "None",
        explanation: "No robots.txt rules or groups defined. All crawler access is allowed by default.",
      };
    }

    const cleanUa = userAgent.trim().toLowerCase();
    let cleanPath = path.trim();
    if (!cleanPath.startsWith("/")) {
      cleanPath = "/" + cleanPath;
    }

    // Step 1: Find matching group (exact match first, wildcard '*' fallback)
    let selectedGroup: RobotsUserAgentGroup | null = null;
    let matchedGroupLabel = "";

    for (const g of groups) {
      if (g.user_agents.some((ua) => ua.trim().toLowerCase() === cleanUa)) {
        selectedGroup = g;
        matchedGroupLabel = `User-agent: ${g.user_agents.join(", ")}`;
        break;
      }
    }

    if (!selectedGroup) {
      for (const g of groups) {
        if (g.user_agents.some((ua) => ua.trim() === "*")) {
          selectedGroup = g;
          matchedGroupLabel = "User-agent: * (fallback wildcard group)";
          break;
        }
      }
    }

    if (!selectedGroup) {
      return {
        isAllowed: true,
        matchingRule: null,
        ruleLength: 0,
        matchedGroup: "None",
        explanation: `No matching rule group found for user-agent '${userAgent}'. Access is allowed by default under RFC 9309.`,
      };
    }

    // Pattern to regex conversion helper
    const testPattern = (pattern: string, testPath: string): boolean => {
      if (!pattern) return false;
      let cleanPat = pattern;
      const hasEndAnchor = cleanPat.endsWith("$");
      if (hasEndAnchor) {
        cleanPat = cleanPat.slice(0, -1);
      }

      // Escape special characters except '*'
      const escaped = cleanPat
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");

      try {
        const regex = new RegExp(hasEndAnchor ? `^${escaped}$` : `^${escaped}`);
        return regex.test(testPath);
      } catch {
        return false;
      }
    };

    // Step 2: Evaluate matching rules
    let bestMatchRule: string | null = null;
    let bestMatchLength = -1;
    let bestIsAllow = true;

    // Check Allow rules
    for (const allowPat of selectedGroup.allows) {
      if (!allowPat) continue;
      if (testPattern(allowPat, cleanPath)) {
        const ruleLen = allowPat.length;
        if (ruleLen > bestMatchLength) {
          bestMatchLength = ruleLen;
          bestMatchRule = `Allow: ${allowPat}`;
          bestIsAllow = true;
        } else if (ruleLen === bestMatchLength) {
          // RFC 9309 Section 2.2.2: Equal specificity gives precedence to Allow
          bestMatchRule = `Allow: ${allowPat}`;
          bestIsAllow = true;
        }
      }
    }

    // Check Disallow rules
    for (const disallowPat of selectedGroup.disallows) {
      if (!disallowPat) {
        // Empty disallow means allow all
        continue;
      }
      if (testPattern(disallowPat, cleanPath)) {
        const ruleLen = disallowPat.length;
        if (ruleLen > bestMatchLength) {
          bestMatchLength = ruleLen;
          bestMatchRule = `Disallow: ${disallowPat}`;
          bestIsAllow = false;
        }
        // If equal length, Allow already won
      }
    }

    if (bestMatchRule === null) {
      return {
        isAllowed: true,
        matchingRule: null,
        ruleLength: 0,
        matchedGroup: matchedGroupLabel,
        explanation: `No matching Allow or Disallow directives matched '${cleanPath}'. In the absence of matching rules, access is allowed by default.`,
      };
    }

    return {
      isAllowed: bestIsAllow,
      matchingRule: bestMatchRule,
      ruleLength: bestMatchLength,
      matchedGroup: matchedGroupLabel,
      explanation: bestIsAllow
        ? `Matched directive '${bestMatchRule}' (pattern length ${bestMatchLength}). Crawler is permitted to access this path.`
        : `Matched directive '${bestMatchRule}' (pattern length ${bestMatchLength}). Crawler is disallowed from fetching this path under RFC 9309.`,
    };
  }, [groups, userAgent, path]);

  const quickPaths = [
    "/admin/",
    "/private/",
    "/wp-admin/",
    "/api/v1/auth",
    "/images/logo.png",
    "/blog/post-1",
  ];

  return (
    <div className="bg-slate-50/80 rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-600" />
            RFC 9309 Path Simulator
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Test any crawler user-agent and path against the parsed robots.txt rules in real time.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs self-start sm:self-auto">
          Longest Match & Equal Allow Precedence
        </span>
      </div>

      {/* Simulator Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User-Agent Selection / Input */}
        <div className="space-y-1.5">
          <label htmlFor="sim-user-agent" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-slate-500" />
            Crawler User-Agent
          </label>
          <div className="flex items-center gap-2">
            <input
              id="sim-user-agent"
              type="text"
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              placeholder="e.g. Googlebot or *"
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
            <select
              value={userAgent}
              onChange={(e) => setUserAgent(e.target.value)}
              className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              aria-label="Select common crawler"
            >
              {availableUserAgents.map((ua) => (
                <option key={ua} value={ua}>
                  {ua}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Path Input */}
        <div className="space-y-1.5">
          <label htmlFor="sim-path" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            Target Path to Test
          </label>
          <input
            id="sim-path"
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="e.g. /admin/settings or /images/logo.png"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
        </div>
      </div>

      {/* Quick Test Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-medium text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" /> Quick test paths:
        </span>
        {quickPaths.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPath(p)}
            className={`text-[11px] font-mono px-2 py-0.5 rounded-md transition-colors ${
              path === p
                ? "bg-sky-100 text-sky-800 font-bold border border-sky-300"
                : "bg-white text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Simulation Result Card */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          simulation.isAllowed
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
            : "bg-rose-50/70 border-rose-200 text-rose-950"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {simulation.isAllowed ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md tracking-wider uppercase ${
                    simulation.isAllowed
                      ? "bg-emerald-600 text-white"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {simulation.isAllowed ? "CRAWL ALLOWED" : "CRAWL DISALLOWED"}
                </span>
                <span className="text-xs font-mono font-medium text-slate-700">
                  {path || "/"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-600">
            {simulation.matchingRule ? (
              <span className="bg-white/90 px-2.5 py-1 rounded-md border border-slate-200 font-semibold">
                {simulation.matchingRule}
              </span>
            ) : (
              <span className="text-slate-500 italic">No explicit matching directive</span>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
          <span>{simulation.explanation}</span>
          <span className="font-semibold text-slate-500 shrink-0">
            {simulation.matchedGroup}
          </span>
        </div>
      </div>
    </div>
  );
}
