"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { usePathname } from "next/navigation";

export type Theme = "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_STORAGE_KEY = "sitesecura-theme";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: ThemeProviderProps) {
  const pathname = usePathname();
  // Always default to 'light' to respect the requirement that default theme is Light.
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Read saved preference from localStorage safely after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        setThemeState(stored);
      }
    } catch {
      // Storage unavailable / private mode fallback
    }
    setMounted(true);
  }, []);

  // Dynamically synchronize the documentElement class:
  // - Dashboard routes (/dashboard*): inherit active user theme preference (light or dark)
  // - Public marketing & legal routes: strictly preserve light appearance
  useEffect(() => {
    const isDashboard = pathname?.startsWith("/dashboard");
    if (isDashboard && theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [pathname, theme]);

  const setTheme = (newTheme: Theme) => {
    if (newTheme !== "light" && newTheme !== "dark") return;
    setThemeState(newTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore storage errors in restricted contexts
    }

    const isDashboard = pathname?.startsWith("/dashboard");
    if (isDashboard && newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
