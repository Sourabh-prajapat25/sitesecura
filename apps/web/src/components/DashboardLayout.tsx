"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
  ShieldCheck,
  LayoutDashboard,
  Globe,
  FileText,
  Activity,
  Bell,
  Users,
  Palette,
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { UserProfile, Organization } from "@/types";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useTheme } from "@/components/theme/ThemeProvider";
import { canAccessMonitoring, canAccessTeam, canAccessWhiteLabel, canAccessSecurityBadge } from "@/lib/entitlements";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { user, profile: authProfile, organization: authOrg, plan, onboardingStatus, loading: authLoading, isAuthenticated, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(authProfile);
  const [org, setOrg] = useState<Organization | null>(authOrg);
  const syncInProgressRef = useRef(false);

  // Sync profile when authProfile changes
  useEffect(() => {
    if (authProfile) setProfile(authProfile);
    if (authOrg) setOrg(authOrg);
  }, [authProfile, authOrg]);

  // Client-side route protection & Onboarding guard
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (onboardingStatus === "pending_plan_selection") {
        router.push("/onboarding/plan");
      }
    }
  }, [authLoading, isAuthenticated, onboardingStatus, router]);

  interface NavGroup {
    title: string;
    items: {
      label: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
      locked?: boolean;
    }[];
  }

  const navGroups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "Security",
      items: [
        { label: "Websites", href: "/dashboard/websites", icon: Globe },
        { label: "Reports", href: "/dashboard/reports", icon: FileText },
        { label: "Monitoring", href: "/dashboard/monitoring", icon: Activity, locked: !canAccessMonitoring(plan) },
        { label: "Security Badge", href: "/dashboard/security-badge", icon: ShieldCheck, locked: !canAccessSecurityBadge(plan) },
      ],
    },
    {
      title: "Workspace",
      items: [
        { label: "Team", href: "/dashboard/team", icon: Users, locked: !canAccessTeam(plan) },
        { label: "White Label", href: "/dashboard/white-label", icon: Palette, locked: !canAccessWhiteLabel(plan) },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
        { label: "Settings", href: "/dashboard/settings", icon: Settings },
        { label: "Support", href: "/dashboard/support", icon: HelpCircle },
      ],
    },
  ];

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  // 1. Initial Auth Loading State - Prevents redirect flash
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1220] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative w-12 h-12">
            <div className="w-12 h-12 border-4 border-sky-100 dark:border-sky-900/60 border-t-sky-600 rounded-full animate-spin" />
            <Shield className="w-5 h-5 text-sky-600 absolute inset-0 m-auto" />
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state (Redirecting to /login)
  if (!isAuthenticated) {
    return null;
  }

  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "User";
  const displayEmail = profile?.email || user?.email || "";
  const avatarLetter = (displayName || displayEmail || "U")[0].toUpperCase();

  return (
    <div className={`${isDark ? "dark" : ""} min-h-screen bg-slate-50 dark:bg-[#0B1220] text-slate-900 dark:text-slate-100 transition-colors duration-150`}>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 border-r border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0F172A] h-screen transition-colors duration-150">
        {/* Brand */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <Link href="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2.5 py-0.5 rounded-full border border-sky-200/70 dark:border-sky-500/20">
            {plan || profile?.role || "Free"}
          </span>
        </div>

        {/* Grouped Navigation Links */}
        <nav className="flex-1 px-3 py-2.5 space-y-2.5 overflow-y-auto min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2.5 pb-0.5">
                {group.title}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 shadow-xs border border-sky-100 dark:border-sky-500/25"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${active ? "text-sky-600 dark:text-sky-400" : "text-slate-400 dark:text-slate-500"}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.locked && (
                      <span title="Upgrade required">
                        <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Bottom Area: Theme Toggle + User profile + Logout */}
        <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 shrink-0 mt-auto space-y-1.5">
          {/* Theme Toggle - Immediately above account/profile details */}
          <ThemeToggle />

          <div className="flex items-center gap-2.5 p-1.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-sky-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
              {avatarLetter}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{displayEmail || org?.name || "Workspace"}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] px-4 flex items-center justify-between transition-colors duration-150">
          <Link href="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl"
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile menu drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] px-4 py-3 space-y-3 shadow-lg dark:shadow-2xl transition-colors duration-150">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2.5 pb-0.5">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                        active
                          ? "bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-500/25"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${active ? "text-sky-600 dark:text-sky-400" : "text-slate-400 dark:text-slate-500"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.locked && <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />}
                    </Link>
                  );
                })}
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <ThemeToggle />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {isAuthenticated && user && !user.emailVerified && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold">Email verification pending</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                    Please confirm your email address to ensure continuous background monitoring and uninterrupted security alerts.
                  </p>
                </div>
              </div>
              <Link
                href="/verify-email"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 shadow-xs transition-colors self-start sm:self-auto"
              >
                <span>Verify Email</span>
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
