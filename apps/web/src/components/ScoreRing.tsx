"use client";

import React from "react";
import { getRiskBadgeColor, getScoreRingColor } from "@/lib/utils";
import { RiskLevel } from "@/types";

interface ScoreRingProps {
  score: number;
  riskLevel?: RiskLevel | string;
  size?: "sm" | "md" | "lg";
  showRiskBadge?: boolean;
  themeMode?: "auto" | "light" | "dark";
}

export function ScoreRing({
  score,
  riskLevel,
  size = "md",
  showRiskBadge = true,
  themeMode = "auto",
}: ScoreRingProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const strokeColor = getScoreRingColor(clampedScore);

  const dimensions = {
    sm: { radius: 36, stroke: 6, width: 90, height: 90, fontSize: "text-2xl" },
    md: { radius: 54, stroke: 8, width: 140, height: 140, fontSize: "text-4xl" },
    lg: { radius: 72, stroke: 10, width: 180, height: 180, fontSize: "text-5xl" },
  }[size];

  const circumference = 2 * Math.PI * dimensions.radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  const isStrictLight = themeMode === "light";
  const bgCircleClass = isStrictLight
    ? "text-slate-200"
    : "text-slate-200 dark:text-slate-800";
  const scoreTextClass = isStrictLight
    ? `font-extrabold tracking-tight text-slate-900 ${dimensions.fontSize}`
    : `font-extrabold tracking-tight text-slate-900 dark:text-white ${dimensions.fontSize}`;
  const outOfTextClass = isStrictLight
    ? "text-[10px] font-semibold uppercase tracking-wider text-slate-400"
    : "text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={dimensions.width / 2}
            cy={dimensions.height / 2}
            r={dimensions.radius}
            stroke="currentColor"
            strokeWidth={dimensions.stroke}
            fill="transparent"
            className={bgCircleClass}
          />
          {/* Progress circle */}
          <circle
            cx={dimensions.width / 2}
            cy={dimensions.height / 2}
            r={dimensions.radius}
            stroke={strokeColor}
            strokeWidth={dimensions.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={scoreTextClass}>
            {clampedScore}
          </span>
          <span className={outOfTextClass}>
            out of 100
          </span>
        </div>
      </div>

      {showRiskBadge && riskLevel && (
        <div className="mt-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRiskBadgeColor(
              riskLevel
            )}`}
          >
            {riskLevel}
          </span>
        </div>
      )}
    </div>
  );
}
