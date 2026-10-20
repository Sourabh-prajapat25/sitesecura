"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Terminal, Code2 } from "lucide-react";
import { resolveMediaUrl } from "@/lib/utils";
import { slugify, extractTextFromNode } from "@/components/blog/blogUtils";

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  theme?: "light" | "dark";
  variant?: "article" | "compact";
}

/**
 * Validates URLs against safe protocols.
 * Allows http, https, mailto, and relative paths.
 * Strictly neutralizes javascript:, vbscript:, and data: schemes.
 */
export function isSafeUrl(url?: string): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("data:")
  ) {
    return false;
  }
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#")
  );
}

/**
 * Professional Code Block Component with Language Indicator and Copy-to-Clipboard.
 */
export interface CodeBlockProps {
  code: string;
  language?: string;
  variant?: "article" | "compact";
}

export function CodeBlock({ code, language, variant = "article" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isCompact = variant === "compact";

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy code to clipboard", err);
    }
  };

  const displayLang = language ? language.toUpperCase() : "CODE";

  return (
    <div
      className={`bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-md group ${
        isCompact ? "my-2.5 max-w-full" : "my-5 shadow-lg"
      }`}
    >
      {/* Code Block Header */}
      <div
        className={`flex items-center justify-between bg-slate-900/90 border-b border-slate-800/80 ${
          isCompact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs"
        }`}
      >
        <div className="flex items-center gap-1.5 text-slate-400 font-mono font-semibold text-[10px] tracking-wider">
          <Terminal className="w-3 h-3 text-sky-400" />
          <span>{displayLang}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Block Content */}
      <pre
        className={`overflow-x-auto font-mono text-slate-100 whitespace-pre max-w-full leading-relaxed ${
          isCompact ? "p-3 text-xs" : "p-4 text-xs sm:text-sm"
        }`}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Defensive Error Boundary for Markdown parsing failures.
 * Gracefully falls back to escaped plain text.
 */
class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackText: string; className?: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn("Markdown rendering fallback:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`whitespace-pre-wrap font-sans ${this.props.className || ""}`}>
          {this.props.fallbackText}
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Reusable Safe Markdown Renderer Component.
 * Supports GFM (tables, strikethrough, autolinks), safe links, code blocks,
 * and adaptive variants (article for public blog, compact for AI Advisor and finding modals).
 */
export function MarkdownRenderer({
  content,
  className = "",
  theme = "light",
  variant = "article",
}: MarkdownRendererProps) {
  if (!content) return null;

  const isDark = theme === "dark";
  const isCompact = variant === "compact";

  return (
    <MarkdownErrorBoundary fallbackText={content} className={className}>
      <div
        className={`markdown-content leading-relaxed ${
          isDark ? "text-slate-200" : "text-slate-800"
        } ${isCompact ? "text-xs space-y-2" : ""} ${className}`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={(url) => (isSafeUrl(url) ? url : "")}
          components={{
            // Headings
            h1: ({ children }) =>
              isCompact ? (
                <h1 className={`text-sm sm:text-base font-bold tracking-tight mt-3 mb-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {children}
                </h1>
              ) : (
                <h1
                  className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-8 mb-4 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {children}
                </h1>
              ),
            h2: ({ children }) => {
              if (isCompact) {
                return (
                  <h2 className={`text-xs sm:text-sm font-bold tracking-tight mt-2.5 mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {children}
                  </h2>
                );
              }
              const rawText = extractTextFromNode(children);
              const id = slugify(rawText);
              return (
                <h2
                  id={id || undefined}
                  className={`group scroll-mt-24 text-xl sm:text-2xl font-bold tracking-tight mt-8 mb-3 flex items-center gap-2 ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  <span>{children}</span>
                  {id && (
                    <a
                      href={`#${id}`}
                      aria-label={`Direct link to ${rawText}`}
                      className="opacity-0 group-hover:opacity-100 text-sky-500 hover:text-sky-600 transition-opacity text-base font-normal"
                    >
                      #
                    </a>
                  )}
                </h2>
              );
            },
            h3: ({ children }) => {
              if (isCompact) {
                return (
                  <h3 className={`text-xs font-bold tracking-tight mt-2 mb-1 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    {children}
                  </h3>
                );
              }
              const rawText = extractTextFromNode(children);
              const id = slugify(rawText);
              return (
                <h3
                  id={id || undefined}
                  className={`group scroll-mt-24 text-lg sm:text-xl font-bold tracking-tight mt-6 mb-2.5 flex items-center gap-2 ${
                    isDark ? "text-slate-100" : "text-slate-800"
                  }`}
                >
                  <span>{children}</span>
                  {id && (
                    <a
                      href={`#${id}`}
                      aria-label={`Direct link to ${rawText}`}
                      className="opacity-0 group-hover:opacity-100 text-sky-500 hover:text-sky-600 transition-opacity text-sm font-normal"
                    >
                      #
                    </a>
                  )}
                </h3>
              );
            },
            h4: ({ children }) => (
              <h4
                className={`${isCompact ? "text-xs font-semibold mt-1.5 mb-1" : "text-base font-semibold mt-4 mb-2"} ${
                  isDark ? "text-slate-200" : "text-slate-800"
                }`}
              >
                {children}
              </h4>
            ),

            // Paragraphs
            p: ({ children }) => (
              <p
                className={`${isCompact ? "text-xs leading-relaxed mb-2 last:mb-0" : "text-sm sm:text-base leading-relaxed mb-4"} ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {children}
              </p>
            ),

            // Lists
            ul: ({ children }) => (
              <ul
                className={`list-disc ${isCompact ? "pl-5 mb-2 space-y-1 text-xs" : "pl-6 mb-4 space-y-1.5 text-sm sm:text-base"} ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol
                className={`list-decimal ${isCompact ? "pl-5 mb-2 space-y-1 text-xs" : "pl-6 mb-4 space-y-1.5 text-sm sm:text-base"} ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {children}
              </ol>
            ),
            li: ({ children }) => <li className={`leading-relaxed ${isCompact ? "text-xs" : ""}`}>{children}</li>,

            // Blockquote
            blockquote: ({ children }) => (
              <blockquote
                className={`border-l-4 rounded-r-xl ${isCompact ? "pl-3 py-1.5 my-2 text-xs italic" : "pl-4 py-2.5 my-5 text-sm sm:text-base italic"} ${
                  isDark
                    ? "border-sky-500 bg-sky-950/30 text-sky-200"
                    : "border-sky-600 bg-sky-50/70 text-sky-950"
                }`}
              >
                {children}
              </blockquote>
            ),

            // Links
            a: ({ href, children, ...props }) => {
              const safe = isSafeUrl(href);
              const targetHref = safe && href ? href : "#";
              const isExternal =
                safe && (targetHref.startsWith("http://") || targetHref.startsWith("https://"));

              return (
                <a
                  href={targetHref}
                  {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={`font-semibold underline underline-offset-2 transition-colors break-words ${
                    isDark
                      ? "text-sky-400 hover:text-sky-300"
                      : "text-sky-600 hover:text-sky-700"
                  }`}
                  {...props}
                >
                  {children}
                </a>
              );
            },

            // Code
            code: ({ node, className: codeClassName, children, ...props }) => {
              const match = /language-(\w+)/.exec(codeClassName || "");
              const language = match ? match[1] : "";
              const codeString = String(children).replace(/\n$/, "");

              // If multi-line or language specified, render CodeBlock
              const isBlock = Boolean(match) || codeString.includes("\n");

              if (isBlock) {
                return <CodeBlock code={codeString} language={language} variant={variant} />;
              }

              return (
                <code
                  className={`px-1.5 py-0.5 rounded font-mono border ${
                    isCompact ? "text-[11px]" : "text-[13px]"
                  } ${
                    isDark
                      ? "bg-slate-800 text-sky-300 border-slate-700/70"
                      : "bg-slate-100 text-sky-800 border-slate-200"
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            },

            // GFM Tables
            table: ({ children }) => (
              <div
                className={`overflow-x-auto border rounded-xl shadow-sm ${
                  isCompact ? "my-2 max-w-full text-xs" : "my-6 text-xs sm:text-sm"
                } ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-white"}`}
              >
                <table className="w-full text-left border-collapse">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead
                className={`border-b font-semibold uppercase tracking-wider text-[11px] ${
                  isDark
                    ? "bg-slate-900 border-slate-800 text-slate-400"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody
                className={`divide-y ${
                  isDark ? "divide-slate-800/80 text-slate-300" : "divide-slate-100 text-slate-700"
                }`}
              >
                {children}
              </tbody>
            ),
            th: ({ children }) => <th className={isCompact ? "py-2 px-3" : "py-3 px-4"}>{children}</th>,
            td: ({ children }) => <td className={isCompact ? "py-2 px-3" : "py-3 px-4"}>{children}</td>,

            // Horizontal Rule
            hr: () => (
              <hr className={`${isCompact ? "my-3" : "my-8"} border-t ${isDark ? "border-slate-800" : "border-slate-200"}`} />
            ),

            // Emphasis
            strong: ({ children }) => (
              <strong className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                {children}
              </strong>
            ),
            em: ({ children }) => <em className="italic">{children}</em>,
            del: ({ children }) => <del className="line-through opacity-75">{children}</del>,

            // Images (only in article mode)
            img: ({ src, alt, title }) => {
              const safe = isSafeUrl(src);
              if (!safe || !src) return null;
              const resolvedSrc = resolveMediaUrl(src);
              return (
                <figure className={isCompact ? "my-2" : "my-6"}>
                  <img
                    src={resolvedSrc}
                    alt={alt || "Illustration"}
                    title={title}
                    className={`rounded-xl border max-w-full h-auto shadow-sm mx-auto object-cover ${
                      isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"
                    }`}
                    loading="lazy"
                  />
                  {title && (
                    <figcaption
                      className={`text-center text-xs mt-2 italic ${
                        isDark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {title}
                    </figcaption>
                  )}
                </figure>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
}

export default MarkdownRenderer;
