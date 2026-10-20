"use client";

import React, { useState } from "react";
import { Check, Copy, ShieldAlert, AlertCircle } from "lucide-react";
import { SeverityBadge } from "@/components/SeverityBadge";

export function RemediationSnippetPreview() {
  const [activeTab, setActiveTab] = useState<"nginx" | "apache" | "cloudflare">("nginx");
  const [copied, setCopied] = useState(false);

  const snippets = {
    nginx: `# /etc/nginx/conf.d/security-headers.conf
# Baseline defensive headers - customize allowed origins for your app
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;`,
    apache: `# .htaccess or /etc/apache2/conf-available/security.conf
# Requires mod_headers (sudo a2enmod headers)
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self';"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
</IfModule>`,
    cloudflare: `// Cloudflare Dashboard -> Rules -> Transform Rules -> Modify Response Header
Rule: (http.host eq "example.com")
Action: Set static
Header name: Content-Security-Policy
Header value: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self';`,
  };

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(snippets[activeTab]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else if (typeof document !== "undefined") {
        // Fallback for restricted iframe or non-secure contexts
        const textarea = document.createElement("textarea");
        textarea.value = snippets[activeTab];
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          setCopied(false);
        }
      }
    } catch {
      // Do not falsely report success if clipboard access was rejected
      setCopied(false);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Finding Header */}
      <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <SeverityBadge status="high" severity="high" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Security Headers
            </span>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80">
            -15 Points
          </span>
        </div>

        <h4 className="text-base sm:text-lg font-bold text-white mb-1.5 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          Missing Content-Security-Policy (CSP) Header
        </h4>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          The web server does not issue a <code className="text-rose-300 font-mono text-xs">Content-Security-Policy</code> response header, leaving browsers vulnerable to Cross-Site Scripting (XSS), malicious iframe embedding, and untrusted asset injection.
        </p>
      </div>

      {/* Snippet Selector & Action */}
      <div className="px-5 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Web server configuration selection">
          {(["nginx", "apache", "cloudflare"] as const).map((tab) => (
            <button
              key={tab}
              id={`remediation-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`remediation-panel-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                activeTab === tab
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${activeTab} configuration snippet`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Display with Tabpanel Semantics */}
      <div
        id={`remediation-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`remediation-tab-${activeTab}`}
        className="p-5 font-mono text-xs text-sky-200 bg-slate-950 overflow-x-auto leading-relaxed focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
      >
        <pre tabIndex={0} aria-label={`${activeTab} configuration snippet`}>
          <code>{snippets[activeTab]}</code>
        </pre>
      </div>

      {/* Verification Footer & Safety Disclaimer */}
      <div className="px-5 py-3 bg-slate-900 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          HSTS Preload: PASS ✓ (+10 pts)
        </span>
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-slate-500 shrink-0" />
          Review and test in staging before deploying to production
        </span>
      </div>
    </div>
  );
}
