"use client";

import React, { useState, useMemo } from "react";
import {
  Terminal,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Info,
  Server,
  Cloud,
  FileCode,
  Sliders,
} from "lucide-react";

export type ServerPlatform = "nginx" | "apache" | "caddy" | "cloudflare";

export interface ConfigGeneratorOptions {
  platform: ServerPlatform;
  // HSTS
  enableHsts: boolean;
  hstsMaxAge: number;
  hstsIncludeSubDomains: boolean;
  hstsPreload: boolean;
  // X-Frame-Options
  xFrameOptions: "SAMEORIGIN" | "DENY" | "NONE";
  // X-Content-Type-Options
  enableNoSniff: boolean;
  // Referrer-Policy
  referrerPolicy: "strict-origin-when-cross-origin" | "no-referrer" | "same-origin" | "no-referrer-when-downgrade";
  // Permissions-Policy
  enablePermissionsPolicy: boolean;
  // CSP
  enableCsp: boolean;
  cspMode: "enforce" | "report-only";
  cspTemplate: "balanced" | "strict" | "starter";
}

const DEFAULT_OPTIONS: ConfigGeneratorOptions = {
  platform: "nginx",
  enableHsts: true,
  hstsMaxAge: 31536000,
  hstsIncludeSubDomains: true,
  hstsPreload: false,
  xFrameOptions: "SAMEORIGIN",
  enableNoSniff: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  enablePermissionsPolicy: true,
  enableCsp: true,
  cspMode: "enforce",
  cspTemplate: "balanced",
};

export function SecurityConfigGenerator() {
  const [options, setOptions] = useState<ConfigGeneratorOptions>(DEFAULT_OPTIONS);
  const [copied, setCopied] = useState(false);

  const resetDefaults = () => {
    setOptions(DEFAULT_OPTIONS);
  };

  // Generate CSP String
  const cspHeaderName = options.cspMode === "report-only"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

  const cspDirectiveValue = useMemo(() => {
    if (!options.enableCsp) return "";
    switch (options.cspTemplate) {
      case "strict":
        return "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';";
      case "starter":
        return "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self';";
      case "balanced":
      default:
        return "default-src 'self'; script-src 'self' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';";
    }
  }, [options.enableCsp, options.cspTemplate]);

  // Generate HSTS Header Value
  const hstsValue = useMemo(() => {
    if (!options.enableHsts) return "";
    let val = `max-age=${options.hstsMaxAge}`;
    if (options.hstsIncludeSubDomains) val += "; includeSubDomains";
    if (options.hstsPreload) val += "; preload";
    return val;
  }, [options.enableHsts, options.hstsMaxAge, options.hstsIncludeSubDomains, options.hstsPreload]);

  // Generate Snippet Content
  const generatedSnippet = useMemo(() => {
    const { platform, enableHsts, xFrameOptions, enableNoSniff, referrerPolicy, enablePermissionsPolicy, enableCsp } = options;

    if (platform === "nginx") {
      const lines: string[] = [
        "# SiteSecura Hardened Defensive HTTP Headers (Nginx)",
        "# Place inside your 'server { listen 443 ssl ... }' block in /etc/nginx/sites-available/",
        "",
      ];
      if (enableHsts) {
        lines.push(`add_header Strict-Transport-Security "${hstsValue}" always;`);
      }
      if (xFrameOptions !== "NONE") {
        lines.push(`add_header X-Frame-Options "${xFrameOptions}" always;`);
      }
      if (enableNoSniff) {
        lines.push(`add_header X-Content-Type-Options "nosniff" always;`);
      }
      lines.push(`add_header Referrer-Policy "${referrerPolicy}" always;`);
      if (enablePermissionsPolicy) {
        lines.push(`add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;`);
      }
      if (enableCsp) {
        lines.push(`add_header ${cspHeaderName} "${cspDirectiveValue}" always;`);
      }
      return lines.join("\n");
    }

    if (platform === "apache") {
      const lines: string[] = [
        "# SiteSecura Hardened Defensive HTTP Headers (Apache)",
        "# Place in .htaccess or <VirtualHost *:443> block in /etc/apache2/sites-available/",
        "<IfModule mod_headers.c>",
      ];
      if (enableHsts) {
        lines.push(`    Header always set Strict-Transport-Security "${hstsValue}"`);
      }
      if (xFrameOptions !== "NONE") {
        lines.push(`    Header always set X-Frame-Options "${xFrameOptions}"`);
      }
      if (enableNoSniff) {
        lines.push(`    Header always set X-Content-Type-Options "nosniff"`);
      }
      lines.push(`    Header always set Referrer-Policy "${referrerPolicy}"`);
      if (enablePermissionsPolicy) {
        lines.push(`    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"`);
      }
      if (enableCsp) {
        lines.push(`    Header always set ${cspHeaderName} "${cspDirectiveValue}"`);
      }
      lines.push("</IfModule>");
      return lines.join("\n");
    }

    if (platform === "caddy") {
      const lines: string[] = [
        "# SiteSecura Hardened Defensive HTTP Headers (Caddy)",
        "# Place inside your site block in Caddyfile",
        "header {",
      ];
      if (enableHsts) {
        lines.push(`    Strict-Transport-Security "${hstsValue}"`);
      }
      if (xFrameOptions !== "NONE") {
        lines.push(`    X-Frame-Options "${xFrameOptions}"`);
      }
      if (enableNoSniff) {
        lines.push(`    X-Content-Type-Options "nosniff"`);
      }
      lines.push(`    Referrer-Policy "${referrerPolicy}"`);
      if (enablePermissionsPolicy) {
        lines.push(`    Permissions-Policy "camera=(), microphone=(), geolocation=()"`);
      }
      if (enableCsp) {
        lines.push(`    ${cspHeaderName} "${cspDirectiveValue}"`);
      }
      lines.push("}");
      return lines.join("\n");
    }

    if (platform === "cloudflare") {
      const lines: string[] = [
        "// SiteSecura Cloudflare Transform Rules Configuration",
        "// Navigate to: Cloudflare Dashboard > Rules > Transform Rules > Modify Response Header",
        "// Expression: (http.request.uri.path matches \".*\")",
        "",
        "Headers to Inject:",
      ];
      if (enableHsts) {
        lines.push(`- Strict-Transport-Security: "${hstsValue}"`);
      }
      if (xFrameOptions !== "NONE") {
        lines.push(`- X-Frame-Options: "${xFrameOptions}"`);
      }
      if (enableNoSniff) {
        lines.push(`- X-Content-Type-Options: "nosniff"`);
      }
      lines.push(`- Referrer-Policy: "${referrerPolicy}"`);
      if (enablePermissionsPolicy) {
        lines.push(`- Permissions-Policy: "camera=(), microphone=(), geolocation=()"`);
      }
      if (enableCsp) {
        lines.push(`- ${cspHeaderName}: "${cspDirectiveValue}"`);
      }
      return lines.join("\n");
    }

    return "";
  }, [options, hstsValue, cspHeaderName, cspDirectiveValue]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(generatedSnippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy configuration", err);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Tool Header */}
      <div className="p-6 sm:p-8 border-b border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            <span>INTERACTIVE SECURITY HELPER</span>
          </div>
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Recommended</span>
          </button>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Security Configuration Snippet Generator
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
          Generate production-ready defensive security headers for your web server or edge proxy. Tailored to prevent clickjacking, SSL stripping, and XSS exploits.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        {/* Controls Column (Left) */}
        <div className="lg:col-span-5 p-6 sm:p-8 space-y-6 bg-slate-50/50">
          {/* Platform Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Web Server / Infrastructure
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "nginx", label: "Nginx" },
                { id: "apache", label: "Apache" },
                { id: "caddy", label: "Caddy" },
                { id: "cloudflare", label: "Cloudflare" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOptions({ ...options, platform: p.id as ServerPlatform })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all text-center border ${
                    options.platform === p.id
                      ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* HSTS Controls */}
          <div className="space-y-3 pt-3 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <label htmlFor="hsts-toggle" className="text-xs font-bold text-slate-900">
                Strict-Transport-Security (HSTS)
              </label>
              <input
                id="hsts-toggle"
                type="checkbox"
                checked={options.enableHsts}
                onChange={(e) => setOptions({ ...options, enableHsts: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
            </div>

            {options.enableHsts && (
              <div className="space-y-3 pl-3 border-l-2 border-sky-200">
                <div className="space-y-1">
                  <label htmlFor="hsts-max-age" className="text-[11px] font-semibold text-slate-600 block">
                    Duration (max-age)
                  </label>
                  <select
                    id="hsts-max-age"
                    value={options.hstsMaxAge}
                    onChange={(e) => setOptions({ ...options, hstsMaxAge: Number(e.target.value) })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                  >
                    <option value={31536000}>1 Year (31,536,000 s) — Recommended</option>
                    <option value={15552000}>6 Months (15,552,000 s)</option>
                    <option value={63072000}>2 Years (63,072,000 s)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="hsts-subdomains"
                    type="checkbox"
                    checked={options.hstsIncludeSubDomains}
                    onChange={(e) => setOptions({ ...options, hstsIncludeSubDomains: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="hsts-subdomains" className="text-xs text-slate-700">
                    Include Subdomains (<code className="text-[11px]">includeSubDomains</code>)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="hsts-preload"
                    type="checkbox"
                    checked={options.hstsPreload}
                    onChange={(e) => setOptions({ ...options, hstsPreload: e.target.checked })}
                    className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="hsts-preload" className="text-xs text-slate-700">
                    HSTS Preload Submission (<code className="text-[11px]">preload</code>)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* X-Frame-Options */}
          <div className="space-y-2 pt-3 border-t border-slate-200/60">
            <label htmlFor="x-frame-select" className="text-xs font-bold text-slate-900 block">
              X-Frame-Options (Clickjacking)
            </label>
            <select
              id="x-frame-select"
              value={options.xFrameOptions}
              onChange={(e) => setOptions({ ...options, xFrameOptions: e.target.value as any })}
              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
            >
              <option value="SAMEORIGIN">SAMEORIGIN — Allow embedding only by same origin (Recommended)</option>
              <option value="DENY">DENY — Block all iframe embedding</option>
              <option value="NONE">Disabled — Defer to CSP frame-ancestors</option>
            </select>
          </div>

          {/* Content Security Policy */}
          <div className="space-y-3 pt-3 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <label htmlFor="csp-toggle" className="text-xs font-bold text-slate-900">
                Content Security Policy (CSP)
              </label>
              <input
                id="csp-toggle"
                type="checkbox"
                checked={options.enableCsp}
                onChange={(e) => setOptions({ ...options, enableCsp: e.target.checked })}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
            </div>

            {options.enableCsp && (
              <div className="space-y-3 pl-3 border-l-2 border-sky-200">
                <div className="space-y-1">
                  <label htmlFor="csp-mode-select" className="text-[11px] font-semibold text-slate-600 block">
                    Policy Mode
                  </label>
                  <select
                    id="csp-mode-select"
                    value={options.cspMode}
                    onChange={(e) => setOptions({ ...options, cspMode: e.target.value as any })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                  >
                    <option value="enforce">Enforcing Mode (Content-Security-Policy)</option>
                    <option value="report-only">Testing Mode (Content-Security-Policy-Report-Only)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="csp-template-select" className="text-[11px] font-semibold text-slate-600 block">
                    Directive Template
                  </label>
                  <select
                    id="csp-template-select"
                    value={options.cspTemplate}
                    onChange={(e) => setOptions({ ...options, cspTemplate: e.target.value as any })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                  >
                    <option value="balanced">Balanced (Self + HTTPS CDNs, Inline styles allowed)</option>
                    <option value="strict">Strict (Self only, zero inline scripts or styles)</option>
                    <option value="starter">Minimal Starter (default-src self, object-src none)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Secondary Headers */}
          <div className="space-y-2.5 pt-3 border-t border-slate-200/60">
            <div className="flex items-center gap-2">
              <input
                id="nosniff-check"
                type="checkbox"
                checked={options.enableNoSniff}
                onChange={(e) => setOptions({ ...options, enableNoSniff: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="nosniff-check" className="text-xs text-slate-800 font-medium">
                X-Content-Type-Options: nosniff
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="permissions-check"
                type="checkbox"
                checked={options.enablePermissionsPolicy}
                onChange={(e) => setOptions({ ...options, enablePermissionsPolicy: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="permissions-check" className="text-xs text-slate-800 font-medium">
                Permissions-Policy (Block camera, mic, geolocation)
              </label>
            </div>
          </div>
        </div>

        {/* Code Output Column (Right) */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-white">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                <Terminal className="w-4 h-4 text-sky-600" />
                <span>Generated Output ({options.platform.toUpperCase()})</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-2xs transition-all active:scale-95"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Configuration"}</span>
              </button>
            </div>

            {/* Monospace Code Display */}
            <div className="relative rounded-2xl bg-slate-950 p-4 border border-slate-800 overflow-x-auto shadow-inner text-xs sm:text-sm font-mono text-slate-100 leading-relaxed max-h-96">
              <pre className="whitespace-pre">{generatedSnippet}</pre>
            </div>

            {/* Contextual Deployment Guidance */}
            <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-sky-50/50 p-4 rounded-2xl border border-sky-100">
              <div className="flex items-center gap-1.5 font-bold text-sky-900">
                <Info className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Deployment Context & Verification</span>
              </div>
              {options.platform === "nginx" && (
                <p>
                  Add these directives inside your active Nginx <code className="text-sky-800 font-mono font-bold">server {"{ ... }"}</code> block. Test your syntax with <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">nginx -t</code> before running <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">systemctl reload nginx</code>.
                </p>
              )}
              {options.platform === "apache" && (
                <p>
                  Ensure Apache&apos;s <code className="font-mono text-sky-800 font-bold">mod_headers</code> module is enabled (<code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">sudo a2enmod headers</code>). Place the block in your <code className="font-mono">.htaccess</code> or VirtualHost file, then reload Apache.
                </p>
              )}
              {options.platform === "caddy" && (
                <p>
                  Paste the <code className="font-mono text-sky-800 font-bold">header {"{ ... }"}</code> block inside your target domain definition in the <code className="font-mono">Caddyfile</code>, then apply with <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">caddy reload</code>.
                </p>
              )}
              {options.platform === "cloudflare" && (
                <p>
                  In the Cloudflare Dashboard, open <strong>Rules</strong> &gt; <strong>Transform Rules</strong> &gt; <strong>Modify Response Header</strong>. Create a rule that injects these headers at the Cloudflare edge.
                </p>
              )}
            </div>

            {/* Security Caution Callouts */}
            {options.hstsPreload && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">HSTS Preload Commitment Caution:</strong>
                  The <code className="font-mono text-[11px]">preload</code> directive requests permanent inclusion in browser vendor source code (Chrome, Firefox, Safari). You cannot revert to HTTP on any subdomain once preloaded.
                </div>
              </div>
            )}

            {options.enableCsp && options.cspMode === "enforce" && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold text-slate-900">CSP Staging Validation Advice:</strong>
                  Always test Content Security Policy in a staging environment or using <code className="font-mono text-[11px]">Report-Only</code> mode first. Monitor browser developer console logs for blocked legitimate assets.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
