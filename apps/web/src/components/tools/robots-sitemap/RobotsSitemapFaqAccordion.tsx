"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FaqItem, ROBOTS_SITEMAP_FAQS } from "./faqData";

export function RobotsSitemapFaqAccordion({ faqs = ROBOTS_SITEMAP_FAQS }: { faqs?: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-3">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-colors"
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 hover:text-sky-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <span>{faq.question}</span>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
