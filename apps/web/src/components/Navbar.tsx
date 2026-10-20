"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight, User as UserIcon } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open to prevent background scrolling
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);



  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-in-out ${
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200/90"
          : "bg-white/80 backdrop-blur-sm border-b border-slate-200/50"
      }`}
    >
      <div
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-all duration-300 ease-in-out ${
          isScrolled ? "h-14 sm:h-15" : "h-18 sm:h-20"
        }`}
      >
        {/* Left: Brand Logo */}
        <Link
          href="/"
          className="flex items-center group focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg p-1 transition-transform"
        >
          <BrandLogo variant="dark-text" size={isScrolled ? "sm" : "md"} />
        </Link>

        {/* Center: Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 lg:gap-8 text-sm font-medium text-slate-600">
          <Link href="/features" className="hover:text-slate-900 transition-colors">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-slate-900 transition-colors">
            Pricing
          </Link>
          <Link href="/blog" className="hover:text-slate-900 transition-colors">
            Blog
          </Link>
          <Link href="/docs" className="hover:text-slate-900 transition-colors">
            Docs
          </Link>
          <Link href="/resources" className="hover:text-slate-900 transition-colors">
            Resources
          </Link>
        </nav>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors"
            >
              <UserIcon className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20 hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                <span>Start Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white/98 backdrop-blur-md px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-1">
            <Link
              href="/features"
              className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="/docs"
              className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Docs
            </Link>
            <Link
              href="/resources"
              className="px-3 py-2.5 rounded-lg text-base font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Resources
            </Link>
          </nav>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2.5">
            {user ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-sky-50 text-sky-700 font-bold text-sm border border-sky-200"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-sm"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
