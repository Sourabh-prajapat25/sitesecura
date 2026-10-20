"use client";

import React from "react";
import Image from "next/image";

export interface BrandLogoProps {
  variant?: "default" | "light" | "dark-text" | "public" | "icon";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function BrandLogo({
  variant = "default",
  size = "md",
  showText = true,
  className = "",
}: BrandLogoProps) {
  const isLight = variant === "light";
  const isDarkText = variant === "dark-text" || variant === "public";
  const isIconOnly = variant === "icon" || !showText;

  const sizeDimensions = {
    sm: { box: "w-7 h-7", px: 28, text: "text-lg" },
    md: { box: "w-9 h-9", px: 36, text: "text-xl" },
    lg: { box: "w-10 h-10", px: 40, text: "text-2xl" },
  }[size];

  // Box background & border styling:
  // - "light": Used on dark surfaces (e.g. dark footer), uses slate background and ring
  // - "dark-text" / "public": Used on light public surfaces (e.g. public navbar), strictly light styling
  // - "default": Adaptive (used in dashboard), adapts to dark mode when active
  const boxClass = isLight
    ? "bg-slate-900/80 ring-1 ring-white/15"
    : isDarkText
    ? "bg-transparent"
    : "dark:bg-slate-800/80 dark:ring-1 dark:ring-white/15";

  // Image brightness filter
  const imageClass = isLight
    ? "filter brightness-110"
    : isDarkText
    ? ""
    : "dark:brightness-105";

  // Wordmark text color:
  // - "light": Strictly white text
  // - "dark-text" / "public": Strictly slate-900 text (immune to dark mode)
  // - "default": Adaptive (slate-900 in light, white in dark)
  const textClass = isLight
    ? "text-white"
    : isDarkText
    ? "text-slate-900"
    : "text-slate-900 dark:text-white";

  // Accent dot color:
  const dotClass = isLight
    ? "text-sky-400 font-extrabold"
    : isDarkText
    ? "text-sky-600 font-extrabold"
    : "text-sky-600 dark:text-sky-400 font-extrabold";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeDimensions.box} relative shrink-0 rounded-lg overflow-hidden shadow-sm flex items-center justify-center ${boxClass}`}
      >
        <Image
          src="/brand/sitesecura-logo.svg"
          alt="SiteSecura Logo"
          width={sizeDimensions.px}
          height={sizeDimensions.px}
          className={`w-full h-full object-contain ${imageClass}`}
          priority
        />
      </div>

      {!isIconOnly && (
        <span
          className={`font-bold tracking-tight select-none ${sizeDimensions.text} ${textClass}`}
        >
          SiteSecura
          <span className={dotClass}>.</span>
        </span>
      )}
    </div>
  );
}

export default BrandLogo;