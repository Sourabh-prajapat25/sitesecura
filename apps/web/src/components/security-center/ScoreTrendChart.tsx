"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Clock, LineChart as ChartIcon } from "lucide-react";
import { Scan } from "@/types";

interface ScoreTrendChartProps {
  scans: Scan[];
  onViewChanges?: () => void;
}

export function ScoreTrendChart({ scans, onViewChanges }: ScoreTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    score: number;
    date: string;
    risk?: string;
  } | null>(null);

  // Filter completed scans with real scores and sort chronologically (oldest to newest)
  const validScans = scans
    .filter((s) => typeof s.score === "number")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const currentScan = validScans[validScans.length - 1];
  const previousScan = validScans.length >= 2 ? validScans[validScans.length - 2] : null;

  const currentScore = currentScan?.score ?? null;
  const previousScore = previousScan?.score ?? null;
  const scoreDelta =
    currentScore !== null && previousScore !== null ? currentScore - previousScore : null;

  let humanExplanation = "";
  if (scoreDelta !== null) {
    if (scoreDelta < 0) {
      humanExplanation = `Your score decreased by ${Math.abs(scoreDelta)} points since the previous completed assessment.`;
    } else if (scoreDelta > 0) {
      humanExplanation = `Your score improved by ${scoreDelta} points since the previous completed assessment.`;
    } else {
      humanExplanation = `Your score remained stable at ${currentScore}/100 since the previous assessment.`;
    }
  } else if (currentScore !== null) {
    humanExplanation = `Initial baseline security score established at ${currentScore}/100.`;
  }

  // Chart coordinates calculation
  const width = 500;
  const height = 150;
  const padX = 35;
  const padTop = 20;
  const padBottom = 25;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const points = validScans.map((s, idx) => {
    const x =
      validScans.length === 1
        ? width / 2
        : padX + (idx / (validScans.length - 1)) * innerW;
    const y = padTop + innerH - ((s.score || 0) / 100) * innerH;
    return {
      x,
      y,
      score: s.score || 0,
      date: new Date(s.created_at).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: new Date(s.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      risk: s.risk_level,
    };
  });

  // SVG Line path string
  const linePath =
    points.length >= 2
      ? points.reduce(
          (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
          ""
        )
      : "";

  // SVG Area gradient path string
  const areaPath =
    points.length >= 2
      ? `${linePath} L ${points[points.length - 1].x} ${
          padTop + innerH
        } L ${points[0].x} ${padTop + innerH} Z`
      : "";

  return (
    <div className="bg-white dark:bg-[#111C2E] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header & Metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <ChartIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Security Score Trend
            </h3>
          </div>

          {/* Metric Summary Badges */}
          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-slate-400 dark:text-slate-400 block text-[10px] font-semibold uppercase">Current</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {currentScore !== null ? `${currentScore}/100` : "—"}
              </span>
            </div>

            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-slate-400 dark:text-slate-400 block text-[10px] font-semibold uppercase">Previous</span>
              <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                {previousScore !== null ? `${previousScore}/100` : "—"}
              </span>
            </div>

            <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-slate-400 dark:text-slate-400 block text-[10px] font-semibold uppercase">Change</span>
              {scoreDelta !== null ? (
                scoreDelta > 0 ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-mono">
                    <TrendingUp className="w-3 h-3" />+{scoreDelta}
                  </span>
                ) : scoreDelta < 0 ? (
                  <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-0.5 font-mono">
                    <TrendingDown className="w-3 h-3" />{scoreDelta}
                  </span>
                ) : (
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-0.5 font-mono">
                    <Minus className="w-3 h-3" />0
                  </span>
                )
              ) : (
                <span className="font-medium text-slate-400 dark:text-slate-500">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Human Narrative */}
        {humanExplanation && (
          <div className="mb-3 px-3.5 py-2 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">{humanExplanation}</span>
            {onViewChanges && scoreDelta !== null && scoreDelta !== 0 && (
              <button
                type="button"
                onClick={onViewChanges}
                className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>View what changed</span>
                <span>→</span>
              </button>
            )}
          </div>
        )}

        {/* Chart Viewport */}
        {validScans.length < 2 ? (
          <div className="py-10 text-center space-y-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 my-2">
            <Clock className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {validScans.length === 1
                ? "Score trend will appear after additional scans."
                : "No historical scans recorded yet."}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
              {validScans.length === 1
                ? "Subsequent scans on this domain will generate comparative trend analytics."
                : "Initiate a scan to establish the initial security baseline."}
            </p>
          </div>
        ) : (
          <div className="relative pt-2">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-44 overflow-visible select-none"
            >
              <defs>
                <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[100, 75, 50, 25].map((level) => {
                const y = padTop + innerH - (level / 100) * innerH;
                return (
                  <g key={level}>
                    <line
                      x1={padX}
                      y1={y}
                      x2={width - padX}
                      y2={y}
                      stroke="currentColor"
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padX - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[9px] fill-slate-400 dark:fill-slate-500 font-mono"
                    >
                      {level}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Fill */}
              <path d={areaPath} fill="url(#scoreAreaGradient)" />

              {/* Solid Line */}
              <path
                d={linePath}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.date === p.date ? 6 : 4}
                    fill="#ffffff"
                    stroke="#0284c7"
                    strokeWidth={hoveredPoint?.date === p.date ? 3 : 2}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        x: p.x,
                        y: p.y,
                        score: p.score,
                        date: `${p.date} • ${p.time}`,
                        risk: p.risk,
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              ))}
            </svg>

            {/* Accessible Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute pointer-events-none bg-slate-900 dark:bg-black text-white rounded-lg px-2.5 py-1.5 text-xs shadow-lg border border-slate-700/80 transform -translate-x-1/2 -translate-y-full z-20 space-y-0.5"
                style={{
                  left: `${(hoveredPoint.x / width) * 100}%`,
                  top: `${(hoveredPoint.y / height) * 100}%`,
                }}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span>Score: {hoveredPoint.score} / 100</span>
                  {hoveredPoint.risk && (
                    <span className="text-[10px] text-sky-300 font-normal">
                      ({hoveredPoint.risk})
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {hoveredPoint.date}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3.5 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>Historical posture based on verified completed scans</span>
        <span className="font-semibold text-slate-600 dark:text-slate-400 font-mono">
          {validScans.length} data point{validScans.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
