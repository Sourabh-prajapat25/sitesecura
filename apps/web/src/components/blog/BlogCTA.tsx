"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, CheckCircle2, Lock, FileCode, Mail, Award } from "lucide-react";
import { trackContentEvent } from "@/lib/analytics";

export type BlogCTAVariant = "general" | "ssl" | "headers" | "email" | "compliance";

interface BlogCTAProps {
  className?: string;
  variant?: BlogCTAVariant;
  articleSlug?: string;
  source?: string;
  campaign?: string;
}

const VARIANT_CONFIGS: Record<
  BlogCTAVariant,
  {
    icon: React.ComponentType<{ className?: string }>;
    badge: string;
    title: string;
    description: string;
    bullets: string[];
    buttonText: string;
  }
> = {
  general: {
    icon: ShieldCheck,
    badge: "SiteSecura Defensive Engine",
    title: "Verify your website's defensive posture today",
    description:
      "Run an instant, zero-installation security inspection to discover SSL/TLS expiration risks, missing HTTP security headers (CSP, HSTS), and DNS email authentication misconfigurations.",
    bullets: ["Non-intrusive scan", "Instant report in 30 seconds", "No software required"],
    buttonText: "Run Free Security Scan",
  },
  ssl: {
    icon: Lock,
    badge: "SSL / TLS Inspector",
    title: "Check your SSL/TLS certificates and cipher configuration",
    description:
      "Detect expiring certificates, deprecated TLS 1.0/1.1 protocols, weak cipher suites, and certificate chain misconfigurations before they impact your users.",
    bullets: ["Certificate expiry alerting", "Cipher suite evaluation", "Zero downtime impact"],
    buttonText: "Scan SSL/TLS Posture",
  },
  headers: {
    icon: FileCode,
    badge: "HTTP Security Headers",
    title: "Audit your Content Security Policy & defensive headers",
    description:
      "Verify whether your domain enforces HSTS, strict CSP policies, X-Frame-Options, and secure cookie attributes to protect visitors from XSS and clickjacking.",
    bullets: ["CSP syntax analysis", "HSTS preload readiness", "Clickjacking resistance check"],
    buttonText: "Analyze Security Headers",
  },
  email: {
    icon: Mail,
    badge: "Email Domain Security",
    title: "Verify your SPF, DKIM, and DMARC enforcement",
    description:
      "Prevent attackers from spoofing your domain. Audit SPF syntax, DKIM keys, and DMARC quarantine/reject policies to secure your brand reputation.",
    bullets: ["SPF record validation", "DMARC policy inspection", "Phishing vulnerability check"],
    buttonText: "Audit Email Security",
  },
  compliance: {
    icon: Award,
    badge: "Defensive Baseline",
    title: "Benchmark your domain against industry security standards",
    description:
      "Surface perimeter vulnerabilities and align your infrastructure with OWASP Top 10 recommendations and modern cybersecurity compliance benchmarks.",
    bullets: ["Perimeter posture scoring", "Executive summary report", "Actionable remediation steps"],
    buttonText: "Run Defensive Benchmark",
  },
};

export function BlogCTA({
  className = "",
  variant = "general",
  articleSlug,
  source = "blog",
  campaign,
}: BlogCTAProps) {
  const config = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.general;
  const Icon = config.icon;

  const targetCampaign = campaign || `cta-${variant}`;
  const queryParams = new URLSearchParams();
  queryParams.set("utm_source", source);
  queryParams.set("utm_medium", "blog_cta");
  queryParams.set("utm_campaign", targetCampaign);
  if (articleSlug) {
    queryParams.set("utm_content", articleSlug);
  }

  const destinationUrl = `/#scan-hero?${queryParams.toString()}`;

  const handleClick = () => {
    trackContentEvent({
      event_name: "blog_cta_click",
      content_type: "scanner",
      content_id: articleSlug || "blog_article",
      source,
      campaign: targetCampaign,
    });
  };

  return (
    <aside
      aria-label="Security assessment call to action"
      className={`relative overflow-hidden bg-slate-950 rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-800 text-white shadow-xl ${className}`}
    >
      {/* Decorative Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:20px_20px] opacity-10 pointer-events-none" />

      <div className="relative z-10 max-w-2xl space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-950/80 text-sky-400 border border-sky-800">
          <Icon className="w-3.5 h-3.5 text-sky-400" />
          <span>{config.badge}</span>
        </div>

        <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
          {config.title}
        </h3>

        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
          {config.description}
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
          {config.bullets.map((bullet, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>

        <div className="pt-3">
          <Link
            href={destinationUrl}
            onClick={handleClick}
            className="inline-flex items-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-sky-600/20 hover:shadow-sky-600/30 transition-all group"
          >
            <span>{config.buttonText}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
