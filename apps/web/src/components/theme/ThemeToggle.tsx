"use client";

import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or before hydration, render stable light presentation to avoid mismatch
  const isDark = mounted ? theme === "dark" : false;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleTheme();
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} mode`}
      onClick={toggleTheme}
      onKeyDown={handleKeyDown}
      className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 ${
        isDark
          ? "bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/70 hover:border-slate-600 focus-visible:ring-offset-slate-900"
          : "bg-slate-100/80 hover:bg-slate-200/60 text-slate-700 border-slate-200/80 hover:border-slate-300 focus-visible:ring-offset-white"
      } ${className}`}
    >
      {/* Icon + Label */}
      <div className="flex items-center gap-2.5">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
            isDark
              ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
              : "bg-amber-500/15 text-amber-600 border border-amber-500/20"
          }`}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </div>
        <span className="font-semibold tracking-tight text-xs">
          {isDark ? "Dark mode" : "Light mode"}
        </span>
      </div>

      {/* Pill Switch Track & Knob */}
      <div
        className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${
          isDark ? "bg-sky-600" : "bg-slate-300"
        }`}
        aria-hidden="true"
      >
        <div
          className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-out motion-reduce:transition-none ${
            isDark ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}

export default ThemeToggle;
