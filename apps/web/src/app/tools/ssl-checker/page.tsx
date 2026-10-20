import React from "react";
import { Metadata } from "next";
import { ShieldCheck, FileCode, Mail, Lock } from "lucide-react";
import { getSiteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import {
  ToolLandingPageLayout,
  ToolCheckItem,
  SiblingToolItem,
  RelatedGuideItem,
} from "@/components/tools/ToolLandingPageLayout";
import { ToolScannerLauncher } from "@/components/tools/ToolScannerLauncher";

export const metadata: Metadata = {
  title: {
    absolute: "Free SSL Certificate Checker | SiteSecura",
  },
  description:
    "Inspect supported SSL/TLS certificate details, validity, hostname matching and expiration information with SiteSecura.",
  alternates: {
    canonical: `${getSiteUrl()}/tools/ssl-checker`,
  },
  openGraph: {
    title: "Free SSL Certificate Checker | SiteSecura",
    description:
      "Inspect supported SSL/TLS certificate details, validity, hostname matching and expiration information with SiteSecura.",
    url: `${getSiteUrl()}/tools/ssl-checker`,
    siteName: "SiteSecura",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free SSL Certificate Checker | SiteSecura",
    description:
      "Inspect SSL/TLS expiration, validity, issuer CA, and SAN coverage with SiteSecura.",
  },
};

export default function SslCheckerPage() {
  const siteUrl = getSiteUrl();

  const checks: ToolCheckItem[] = [
    {
      name: "Certificate Validity & Expiration",
      description:
        "Validates the certificate's active date range, calculating the exact number of days remaining before expiration to prevent unexpected site outages.",
      impact: "Uptime & Trust",
    },
    {
      name: "Hostname & SAN Matching",
      description:
        "Ensures the certificate's Subject Alternative Names (SAN) list correctly covers your apex domain and subdomains (e.g. www vs apex).",
      impact: "Browser Warning Prevention",
    },
    {
      name: "Certificate Authority (CA) Issuer",
      description:
        "Identifies the root and intermediate Certificate Authority that signed the certificate (e.g. Let's Encrypt, DigiCert, Sectigo, Cloudflare).",
      impact: "Trust Chain Verification",
    },
    {
      name: "TLS Protocol Version Support",
      description:
        "Verifies that modern transport protocols (TLS 1.2 and TLS 1.3) are supported and negotiated during connection handshakes.",
      impact: "Cryptographic Strength",
    },
  ];

  const limitations = [
    "Does not evaluate client-side mutual TLS (mTLS) certificates or private internal corporate CAs.",
    "Does not grade or benchmark private cipher-suite lists beyond verifying standard TLS handshake negotiation.",
    "Cannot detect revoked certificates if the issuing CA's OCSP responder or CRL server is temporarily unreachable.",
    "A valid SSL certificate encrypts in-transit data but does not prevent malicious content, phishing forms, or server vulnerabilities.",
    "Does not inspect hardware security module (HSM) key storage or private key entropy.",
  ];

  const steps = [
    {
      step: 1,
      title: "Submit Domain Name",
      description:
        "Enter your website address (e.g. mycompany.com). You do not need to install local agents or modify firewall rules.",
    },
    {
      step: 2,
      title: "Direct TLS Handshake",
      description:
        "SiteSecura establishes an outbound TLS connection on port 443, retrieving and parsing the x509 server certificate.",
    },
    {
      step: 3,
      title: "Inspect Expiration & Chain",
      description:
        "Review expiration alerts, issuer details, SAN coverage, and step-by-step renewal instructions.",
    },
  ];

  const resultInterpretation = [
    {
      status: "pass",
      label: "Valid (Green)",
      description:
        "Certificate is active, signed by a recognized public CA, matches the domain hostname, and has more than 30 days until expiry.",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
    {
      status: "warning",
      label: "Expiring Soon (Amber)",
      description:
        "Certificate expires within 30 days, or supports deprecated legacy fallback protocols that should be retired.",
      badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    },
    {
      status: "fail",
      label: "Expired or Mismatch (Red)",
      description:
        "Certificate has expired, does not match the hostname, or is self-signed, causing severe browser interstitial warnings.",
      badgeClass: "bg-red-50 text-red-700 border border-red-200",
    },
    {
      status: "info",
      label: "Chain Details (Blue)",
      description:
        "Subject Alternative Names (SAN), issuer identity, and cryptographic cipher negotiated during connection.",
      badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
    },
  ];

  const faqs = [
    {
      question: "What does an SSL certificate check look for?",
      answer:
        "The checker initiates a standard TLS connection to port 443 and inspects the x509 certificate presented by the server. It verifies whether the certificate is currently within its validity period, counts days remaining, verifies whether the requested hostname matches the Subject Alternative Name (SAN) list, and identifies the issuing Certificate Authority.",
    },
    {
      question: "What causes a 'Hostname Mismatch' certificate warning?",
      answer:
        "A hostname mismatch occurs when a visitor navigates to a domain (for example, `app.example.com`) but the presented SSL certificate only covers `example.com` or `www.example.com`. To prevent this, ensure your certificate includes all necessary subdomains or a wildcard entry (`*.example.com`).",
    },
    {
      question: "How long before expiration should I renew my SSL certificate?",
      answer:
        "Modern certificates (such as 90-day Let's Encrypt certificates) should ideally be automated to renew 30 days before expiration. For 1-year commercial certificates, renew at least 14 to 30 days in advance to allow time for CA domain verification.",
    },
    {
      question: "Does this tool support checking certificates on custom non-standard ports?",
      answer:
        "The public SiteSecura SSL Checker focuses on standard HTTPS web perimeters on port 443 to align with web security best practices and ensure safe, uniform scanning behavior.",
    },
    {
      question: "What is the difference between SSL and TLS?",
      answer:
        "SSL (Secure Sockets Layer) was the original encryption protocol created in the 1990s. It has been deprecated for many years due to known cryptographic weaknesses. Modern secure websites use TLS (Transport Layer Security, primarily TLS 1.2 and TLS 1.3), although the term 'SSL' is still widely used colloquially.",
    },
  ];

  const siblingTools: SiblingToolItem[] = [
    {
      name: "Website Security Scanner",
      slug: "website-security-checker",
      badge: "Full Scan",
      description:
        "Assess HTTPS, security headers, email authentication records, and overall website posture in one comprehensive scan.",
      iconName: "scanner",
    },
    {
      name: "HTTP Security Headers Checker",
      slug: "security-headers-checker",
      badge: "HTTP Headers",
      description:
        "Inspect HSTS, Content-Security-Policy (CSP), and browser defensive response headers to protect users from XSS.",
      iconName: "headers",
    },
    {
      name: "SPF, DKIM & DMARC Checker",
      slug: "email-security-checker",
      badge: "Email Security",
      description:
        "Verify DNS email-authentication records to stop spoofing and ensure legitimate business email delivery.",
      iconName: "email",
    },
  ];

  const relatedGuides: RelatedGuideItem[] = [
    {
      title: "HTTPS vs SSL vs TLS: What's the Difference?",
      slug: "https-vs-ssl-vs-tls-difference",
      category: "SSL/TLS",
      readingTimeMinutes: 6,
    },
    {
      title: "What Is Website Security? A Complete Beginner's Guide",
      slug: "what-is-website-security-beginners-guide",
      category: "Website Security",
      readingTimeMinutes: 5,
    },
    {
      title: "How to Check Your Website Security",
      slug: "how-to-check-your-website-security",
      category: "Website Security",
      readingTimeMinutes: 6,
    },
  ];

  const breadcrumbSchema = {
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
        name: "SSL Certificate Checker",
        item: `${siteUrl}/tools/ssl-checker`,
      },
    ],
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SiteSecura SSL Certificate Checker",
    url: `${siteUrl}/tools/ssl-checker`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "All",
    description:
      "Inspect SSL/TLS certificate validity, expiration days, issuer chain, and SAN coverage for public websites.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: "SiteSecura",
      url: siteUrl,
    },
  };

  const remediationOverview = (
    <div className="space-y-4">
      <p>
        An expired or misconfigured SSL certificate immediately breaks visitor trust and triggers alarming browser interstitial errors (&ldquo;Your connection is not private&rdquo;). Follow these steps to resolve common SSL/TLS issues:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose pt-2">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Automate Renewals with ACME / Certbot</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Eliminate human error by enabling automatic renewals. If using Nginx or Apache on Linux, configure <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">certbot renew</code> as a scheduled systemd timer or cron job.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Verify Subject Alternative Names (SAN)</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Always request certificates covering both <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">example.com</code> and <code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">www.example.com</code>, or obtain a wildcard certificate (<code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">*.example.com</code>) for multiple subdomains.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Serve the Full Certificate Chain</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Configure your web server to present the full intermediate bundle (<code className="text-sky-700 bg-sky-50 px-1 py-0.5 rounded font-mono text-[11px]">fullchain.pem</code>) rather than just the leaf certificate to avoid trust errors on mobile devices.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-slate-900 text-sm mb-1">Leverage Cloud Managed Certificates</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            If hosting behind Cloudflare, AWS CloudFront, or Vercel, utilize managed edge certificates which handle provisioning, renewal, and OCSP stapling automatically.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={softwareSchema} />
      <ToolLandingPageLayout
        toolName="SSL Certificate Checker"
        eyebrow="TLS TRANSPORT ENCRYPTION AUDIT"
        heading="SSL Certificate Checker"
        description="Verify SSL/TLS certificate validity, expiration dates, issuer authority, and Subject Alternative Names (SAN) to avoid browser warnings and unexpected downtime."
        launcherSlot={
          <ToolScannerLauncher
            toolName="SSL Certificate Checker"
            buttonLabel="Check SSL Certificate"
            placeholder="example.com"
            helperText="Connects via TLS on port 443 to inspect certificate health."
            autoFocus
          />
        }
        checksHeading="SSL/TLS Inspection Points"
        checksDescription="SiteSecura performs cryptographic handshakes against your domain's public IP to verify transport security."
        checks={checks}
        limitations={limitations}
        steps={steps}
        resultInterpretation={resultInterpretation}
        remediationOverview={remediationOverview}
        faqs={faqs}
        siblingTools={siblingTools}
        relatedGuides={relatedGuides}
      />
    </>
  );
}
