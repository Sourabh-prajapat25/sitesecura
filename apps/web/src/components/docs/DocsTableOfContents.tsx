"use client";

import React, { useEffect, useState } from "react";
import { AlignLeft, ArrowUp } from "lucide-react";
import { TocItem } from "@/components/blog/blogUtils";

interface DocsTableOfContentsProps {
  items: TocItem[];
}

export function DocsTableOfContents({ items }: DocsTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (!items || items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "0% 0% -60% 0%",
        threshold: 0.1,
      }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  if (!items || items.length === 0) {
    return null;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <aside className="hidden xl:block w-56 shrink-0" aria-label="Table of contents">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pl-4 border-l border-slate-200/80 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900">
          <AlignLeft className="w-3.5 h-3.5 text-sky-600" />
          <span>On this page</span>
        </div>

        <nav aria-label="On this page" className="space-y-1">
          {items.map((item) => {
            const isActive = activeId === item.id;
            const isH3 = item.level === 3;

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`block text-xs leading-snug transition-colors py-1 ${
                  isH3 ? "pl-3 text-slate-500 hover:text-slate-800" : "text-slate-600 hover:text-slate-900"
                } ${
                  isActive
                    ? "text-sky-600 font-semibold border-l-2 border-sky-600 -ml-[17px] pl-[15px]"
                    : ""
                }`}
              >
                {item.text}
              </a>
            );
          })}
        </nav>

        <div className="pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={scrollToTop}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-sky-600 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Back to top</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
