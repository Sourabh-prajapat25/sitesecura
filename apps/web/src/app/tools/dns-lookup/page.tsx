import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Globe,
  Layers,
  Sparkles,
  ChevronRight,
  Shield,
  Lock,
  FileCode,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Server,
  Network,
  Cpu,
  Key,
  RefreshCw,
  FileCheck,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { DnsLookupApp } from "@/components/tools/dns/DnsLookupApp";
import { DnsFaqAccordion } from "@/components/tools/dns/DnsFaqAccordion";
import { DNS_TOOL_FAQS } from "@/components/tools/dns/faqData";

export const metadata: Metadata = {
  title: {
    absolute: "DNS Lookup Tool — Check A, AAAA, MX, TXT & NS Records | SiteSecura",
  },
  description:
    "Look up DNS records for a domain with SiteSecura. Inspect supported A, AAAA, CNAME, MX, NS, TXT, SOA, and CAA DNS responses with clear explanations.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/dns-lookup`,
  },
  openGraph: {
    title: "DNS Lookup Tool — Check A, AAAA, MX, TXT & NS Records | SiteSecura",
    description:
      "Look up DNS records for a domain with SiteSecura. Inspect supported A, AAAA, CNAME, MX, NS, TXT and other DNS responses with clear explanations.",
    url: `${getSiteUrl()}/tools/dns-lookup`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DNS Lookup Tool — Check A, AAAA, MX, TXT & NS Records | SiteSecura",
    description:
      "Inspect domain DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA, CAA) with real-time resolution and record explanations.",
  },
};

export default function DnsLookupPage() {
  const siteUrl = getSiteUrl();

  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Resources",
        item: `${siteUrl}/resources`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "DNS Lookup Tool",
        item: `${siteUrl}/tools/dns-lookup`,
      },
    ],
  };

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura DNS Lookup Tool",
    description:
      "Free standalone DNS diagnostic utility for inspecting A, AAAA, CNAME, MX, NS, TXT, SOA, and CAA records without requiring full security scan execution.",
    url: `${siteUrl}/tools/dns-lookup`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "All",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: DNS_TOOL_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const recordTypesInfo = [
    {
      type: "A",
      name: "Address Record",
      description:
        "Maps a hostname to an IPv4 32-bit address (e.g. 93.184.216.34). Essential for directing web browsers and clients to your IPv4 web server.",
      useCase: "Website hosting, API endpoints, IPv4 routing",
      icon: Server,
    },
    {
      type: "AAAA",
      name: "IPv6 Address Record",
      description:
        "Maps a hostname to a 128-bit IPv6 address (e.g. 2606:2800:220:1:248:1863:25c8:1946). Required for seamless connectivity on modern IPv6 mobile networks.",
      useCase: "IPv6 website hosting, next-generation internet routing",
      icon: Network,
    },
    {
      type: "CNAME",
      name: "Canonical Name",
      description:
        "Aliases one domain name to another canonical hostname. Often used for subdomains pointing to CDNs, SaaS services, or cloud load balancers.",
      useCase: "CDNs, Cloudflare, AWS CloudFront, platform subdomains",
      icon: Globe,
    },
    {
      type: "MX",
      name: "Mail Exchanger",
      description:
        "Directs incoming email messages to authoritative mail servers, each paired with a priority number. Lower numbers designate primary mail servers.",
      useCase: "Google Workspace, Microsoft 365, ProtonMail routing",
      icon: Mail,
    },
    {
      type: "NS",
      name: "Name Server",
      description:
        "Delegates a DNS zone to authoritative nameservers. Identifies which DNS provider or server hosts the authoritative records for the domain.",
      useCase: "DNS provider delegation (Cloudflare, Route 53, Namecheap)",
      icon: Cpu,
    },
    {
      type: "TXT",
      name: "Text Record",
      description:
        "Holds arbitrary human or machine-readable text. Extensively used for domain ownership verification, SPF policies, DKIM keys, and DMARC rules.",
      useCase: "SPF records, Google/Search Console verification, DKIM",
      icon: FileCode,
    },
    {
      type: "SOA",
      name: "Start of Authority",
      description:
        "Specifies core administrative information about the DNS zone, including the primary nameserver, admin email, zone serial number, and refresh timers.",
      useCase: "DNS zone synchronization, secondary nameserver updates",
      icon: Layers,
    },
    {
      type: "CAA",
      name: "Certification Authority Authorization",
      description:
        "Defines which Certificate Authorities (CAs) are permitted to issue SSL/TLS certificates for the domain, mitigating rogue certificate issuance.",
      useCase: "Preventing unauthorized SSL certificate issuance (e.g. Let's Encrypt only)",
      icon: Key,
    },
  ];

  const steps = [
    {
      step: 1,
      title: "Enter Your Domain",
      description:
        "Type your domain or subdomain (e.g. example.com). No URL schemes (https://), slashes, or account sign-in required.",
    },
    {
      step: 2,
      title: "Select Record Types",
      description:
        "Choose any combination of A, AAAA, CNAME, MX, NS, TXT, SOA, or CAA records, or use one-click Default / Select All.",
    },
    {
      step: 3,
      title: "Execute Real-Time Query",
      description:
        "Click 'Look Up DNS Records' to trigger parallel queries against authoritative DNS resolvers with a bounded 2-second timeout.",
    },
    {
      step: 4,
      title: "Inspect Values & TTLs",
      description:
        "Review returned IP addresses, mail exchange priorities, and TTL caching durations in an organized, responsive table.",
    },
    {
      step: 5,
      title: "Copy & Troubleshoot",
      description:
        "Copy individual record values or copy the complete structured text report to share with developers or hosting support.",
    },
  ];

  const siblingTools = [
    {
      name: "Website Security Scanner",
      slug: "website-security-checker",
      badge: "Full Assessment",
      description:
        "Run an automated passive inspection across HTTPS, certificates, security headers, and domain security posture.",
      iconName: "scanner" as const,
    },
    {
      name: "SSL/TLS Certificate Checker",
      slug: "ssl-checker",
      badge: "SSL / TLS",
      description:
        "Inspect certificate expiration dates, CA issuer chains, SAN domains, and weak TLS protocol ciphers.",
      iconName: "ssl" as const,
    },
    {
      name: "HTTP Security Headers Checker",
      slug: "security-headers-checker",
      badge: "HTTP Headers",
      description:
        "Audit HSTS preload readiness, Content-Security-Policy (CSP), X-Frame-Options, and referrer policies.",
      iconName: "headers" as const,
    },
    {
      name: "SPF, DKIM & DMARC Checker",
      slug: "email-security-checker",
      badge: "Email Security",
      description:
        "Review email authentication records in DNS to protect domain reputation and prevent spoofing attacks.",
      iconName: "email" as const,
    },
    {
      name: "HTTP Status & Redirect Checker",
      slug: "http-status-checker",
      badge: "HTTP Utility",
      description:
        "Inspect HTTP response status codes and trace redirect chains hop-by-hop with safe header audits.",
      iconName: "http" as const,
    },
    {
      name: "security.txt Validator",
      slug: "security-txt-validator",
      badge: "Compliance Utility",
      description:
        "Validate vulnerability disclosure files against RFC 9116 syntax, mandatory Contact and Expires directives.",
      iconName: "security-txt" as const,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FC] text-slate-900 selection:bg-sky-500 selection:text-white">
      <JsonLd data={breadcrumbsSchema} />
      <JsonLd data={webAppSchema} />
      <JsonLd data={faqSchema} />

      <Navbar />

      <main className="flex-1">
        {/* Top Breadcrumbs */}
        <div className="border-b border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <Link href="/" className="hover:text-slate-900 transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <Link href="/resources" className="hover:text-slate-900 transition-colors">
                Resources
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800 truncate" aria-current="page">
                DNS Lookup Tool
              </span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-slate-200/80 bg-gradient-to-b from-white via-white to-[#F7F9FC]">
          <div className="absolute inset-0 bg-[radial-gradient(#087fe8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>FREE DNS DIAGNOSTIC TOOL</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
              DNS Lookup Tool
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 leading-relaxed">
              Inspect your domain&apos;s DNS records, understand what they mean, and troubleshoot common website,
              nameserver, and email configuration issues in real time.
            </p>

            {/* Interactive Tool Card */}
            <div className="pt-4">
              <DnsLookupApp />
            </div>
          </div>
        </section>

        {/* Informational & Educational Content Sections */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16 text-left">
          {/* Section 1: Supported DNS Record Types */}
          <section aria-labelledby="records-heading" className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>DNS Protocol Reference</span>
              </div>
              <h2 id="records-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Supported DNS Record Types
              </h2>
              <p className="text-sm text-slate-600">
                The Domain Name System uses dedicated resource record types to map internet hostnames to IP
                addresses, email servers, and operational verification metadata.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {recordTypesInfo.map((info) => {
                const Icon = info.icon;
                return (
                  <div
                    key={info.type}
                    className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 border border-sky-200/60">
                          {info.type}
                        </span>
                        <Icon className="w-4 h-4 text-slate-400" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{info.name}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{info.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500 font-medium">
                        <strong className="text-slate-700">Common Use:</strong> {info.useCase}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 2: How to Use the DNS Lookup Tool */}
          <section aria-labelledby="steps-heading" className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Workflow Guide</span>
              </div>
              <h2 id="steps-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                How to Use the DNS Lookup Tool
              </h2>
              <p className="text-sm text-slate-600">
                Execute bounded queries and inspect real-time DNS zone data in five easy steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {steps.map((item) => (
                <div
                  key={item.step}
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center">
                      {item.step}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: Troubleshooting Common DNS Issues */}
          <section aria-labelledby="troubleshooting-heading" className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-slate-200/90 shadow-xs space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>Diagnostic Runbook</span>
              </div>
              <h2 id="troubleshooting-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Troubleshooting Common DNS Issues
              </h2>
              <p className="text-sm text-slate-600">
                Frequent configuration oversights and caching quirks encountered when auditing domain records.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>DNS Propagation &amp; TTL Delays</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  When you update DNS records at your domain registrar or DNS hosting provider, upstream recursive
                  resolvers continue to cache previous values for the duration of the Time-To-Live (TTL) header. If
                  your TTL is set to 86400 (24 hours), changes may take up to a full day to reflect globally.
                </p>
              </div>

              <div className="space-y-2 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Missing or Misconfigured MX Records</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  If sending mail servers cannot resolve valid MX records for your domain, inbound email will bounce.
                  Ensure all mail exchanger hostnames point directly to A or AAAA records, rather than CNAME aliases,
                  to comply with RFC 2181.
                </p>
              </div>

              <div className="space-y-2 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>TXT Record Segmentation &amp; Quotation</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Long TXT entries (such as 2048-bit DKIM public keys) that exceed 255 characters must be split into
                  multiple concatenated character-strings within the same DNS resource record. Our tool correctly
                  reassembles string segments into their full cryptographic representation.
                </p>
              </div>

              <div className="space-y-2 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>CNAME Flattening at Zone Apex</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  RFC 1034 prohibits publishing a CNAME record at the zone apex (e.g. root <span className="font-mono text-slate-800">example.com</span>)
                  because it conflicts with SOA and NS records. Modern DNS providers resolve this using CNAME
                  flattening or ALIAS records that dynamically resolve to A/AAAA records.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Limitations of DNS Lookup */}
          <section aria-labelledby="limitations-heading" className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Scope &amp; Realistic Limitations</span>
              </div>
              <h2 id="limitations-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Limitations of DNS Lookup Tools
              </h2>
              <p className="text-sm text-slate-600">
                Understanding what a DNS lookup tool can and cannot determine about domain health and security.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-2">
                <h3 className="text-base font-bold text-slate-900">Single Resolver Vantage Point</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  DNS results reflect the answers returned to our server-configured resolver at the exact moment of the
                  query. Because recursive DNS servers cache records according to TTL, queries from different locations
                  or ISPs may observe cached variations during active propagation.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-2">
                <h3 className="text-base font-bold text-slate-900">Record Presence ≠ Security Score</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Publishing valid DNS records does not guarantee that a website is hardened against attack. A DNS
                  lookup reports zone pointers, but does not test SSL/TLS certificate chains, evaluate HTTP security
                  headers, or detect web application vulnerabilities.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-2">
                <h3 className="text-base font-bold text-slate-900">DNSSEC Existence vs Cryptographic Validation</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  While DNS queries can verify whether DNSSEC keys and signatures exist, client lookup utilities do not
                  execute end-to-end cryptographic trust chain verification.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs space-y-2">
                <h3 className="text-base font-bold text-slate-900">No Deep Subdomain Enumeration</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  This tool inspects the exact hostname or domain you provide. It does not perform invasive brute-force
                  subdomain brute-forcing, zone transfers (AXFR), or unauthorized network reconnaissance.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Frequently Asked Questions */}
          <section aria-labelledby="faq-heading" className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>Common Questions</span>
              </div>
              <h2 id="faq-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <DnsFaqAccordion />
          </section>

          {/* Section 6: Sibling Security Tools */}
          <section aria-labelledby="sibling-tools-heading" className="space-y-6">
            <div>
              <h2 id="sibling-tools-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
                Related Security Utilities
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Explore dedicated perimeter verification tools in the SiteSecura defensive security toolkit.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {siblingTools.map((sibling, idx) => {
                const getSiblingIcon = (iconName: string) => {
                  switch (iconName) {
                    case "ssl":
                      return Lock;
                    case "headers":
                      return FileCode;
                    case "email":
                      return Mail;
                    case "http":
                      return RefreshCw;
                    case "security-txt":
                      return FileCheck;
                    default:
                      return Shield;
                  }
                };
                const Icon = getSiblingIcon(sibling.iconName);
                return (
                  <Link
                    key={idx}
                    href={`/tools/${sibling.slug}`}
                    className="group bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/80">
                          {sibling.badge}
                        </span>
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                        {sibling.name}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {sibling.description}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-bold text-sky-600 group-hover:text-sky-700">
                      <span>Launch Tool</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Section 7: Contextual Full Scanner Conversion Banner */}
          <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-12 shadow-xl relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative max-w-3xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Shield className="w-3.5 h-3.5" />
                <span>Comprehensive Perimeter Assessment</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Want to check your entire website security posture?
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                A DNS lookup only checks domain record pointers. Run SiteSecura&apos;s full automated perimeter scan to
                evaluate SSL/TLS certificates, HTTP security headers, SPF &amp; DMARC authentication, and server
                fingerprints in under 30 seconds.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link
                  href="/tools/website-security-checker"
                  className="px-6 py-3.5 rounded-2xl bg-[#087FE8] hover:bg-sky-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition-all text-center inline-flex items-center justify-center gap-2"
                >
                  <span>Run Full Security Scan</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/resources"
                  className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors text-center"
                >
                  Explore All Resources
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
