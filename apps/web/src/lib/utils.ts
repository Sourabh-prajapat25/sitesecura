import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRiskBadgeColor(risk?: string): string {
  switch (risk) {
    case "Excellent":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "Good":
      return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    case "Medium Risk":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "High Risk":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
    case "Critical Risk":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  }
}

export function getScoreRingColor(score: number): string {
  if (score >= 90) return "#10b981"; // emerald-500
  if (score >= 75) return "#22c55e"; // green-500
  if (score >= 60) return "#f59e0b"; // amber-500
  if (score >= 40) return "#f97316"; // orange-500
  return "#ef4444";                 // red-500
}

/**
 * Resolves a media URL, ensuring relative API media paths (/api/v1/media/...)
 * are mapped to the active API backend host when running in separate origins (dev/prod).
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
    const origin = apiBase.replace(/\/api\/v1\/?$/, "");
    return origin ? `${origin}${trimmed}` : trimmed;
  }
  return trimmed;
}
