import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-1 sm:col-span-2 md:col-span-2 space-y-4">
            <Link href="/">
              <BrandLogo variant="light" size="md" />
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              Understand your website security posture in 60 seconds. Real automated checks, clear score, plain-English remediation, and continuous monitoring.
            </p>
            <div className="text-xs text-slate-500 pt-2">
              © {new Date().getFullYear()} SiteSecura. All rights reserved.
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/resources" className="hover:text-white transition-colors">Free Security Tools</Link></li>
              <li><Link href="/status" className="hover:text-white transition-colors">System Status</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/blog" className="hover:text-white transition-colors">Security Blog</Link></li>
              <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Support & Contact</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About SiteSecura</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Legal & Trust
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><Link href="/authorized-scanning" className="hover:text-white transition-colors">Authorized Scanning</Link></li>
              <li><Link href="/fair-usage" className="hover:text-white transition-colors">Fair Usage</Link></li>
              <li><Link href="/refunds" className="hover:text-white transition-colors">Refund Policy</Link></li>
              <li><Link href="/responsible-disclosure" className="hover:text-white transition-colors">Responsible Disclosure</Link></li>
              <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
              <li><Link href="/subprocessors" className="hover:text-white transition-colors">Subprocessors</Link></li>
              <li><Link href="/service-availability" className="hover:text-white transition-colors">Service Availability</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
          <p>
            <strong>Responsible Security Disclaimer:</strong> SiteSecura provides defensive website security and configuration assessments based on supported checks and publicly observable information. Results are informational and do not constitute a penetration test, security certification, compliance certification, or guarantee that a website is secure or free from vulnerabilities. Users are responsible for ensuring that they are authorized to assess the targets they submit.
          </p>
        </div>
      </div>
    </footer>
  );
}
