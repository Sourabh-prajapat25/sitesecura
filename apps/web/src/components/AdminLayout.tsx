"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldAlert,
  BarChart3,
  Users,
  Building2,
  Globe,
  Radio,
  CreditCard,
  BookOpen,
  LifeBuoy,
  TrendingUp,
  Server,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Lock,
} from "lucide-react";
import { api } from "@/lib/api";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const verifyAdmin = async () => {
      try {
        const authData = await api.getCurrentUser();
        if (mounted) {
          if (authData?.user?.role === "admin") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setIsAdmin(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    verifyAdmin();
    return () => {
      mounted = false;
    };
  }, []);

  const navItems = [
    { label: "Overview & Metrics", href: "/admin", icon: BarChart3 },
    { label: "Users & Accounts", href: "/admin/users", icon: Users },
    { label: "Organizations", href: "/admin/organizations", icon: Building2 },
    { label: "Websites", href: "/admin/websites", icon: Globe },
    { label: "Scans & Queues", href: "/admin/scans", icon: Radio },
    { label: "Subscriptions & Plans", href: "/admin/subscriptions", icon: CreditCard },
    { label: "Blog CMS", href: "/admin/blog", icon: BookOpen },
    { label: "Support & Inquiries", href: "/admin/support", icon: LifeBuoy },
    { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
    { label: "System Health", href: "/admin/system", icon: Server },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: ShieldCheck },
    { label: "Security Badge Policy", href: "/admin/security-badge/policy", icon: ShieldCheck },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-xs font-medium tracking-wide">Verifying Administrator Privileges...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900 border border-red-900/60 p-8 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-red-950/80 border border-red-800 text-red-400 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Access Denied (403 Forbidden)</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            You do not have administrative permissions to view the SiteSecura Admin Control Center.
            Every admin endpoint strictly enforces backend verification.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Customer Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <span className="font-bold text-sm text-white tracking-wide">
              SiteSecura Admin
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800">
            Root
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? "bg-slate-800 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-sky-400" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Admin Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-y-auto">
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
