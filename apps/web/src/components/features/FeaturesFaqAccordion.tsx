"use client";

import React, { useState, useId } from "react";
import { ChevronDown } from "lucide-react";
import { FEATURES_PAGE_FAQS, FeatureFaqItem } from "./faqData";

export function FeaturesFaqAccordion({ faqs = FEATURES_PAGE_FAQS }: { faqs?: FeatureFaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        const btnId = `${baseId}-faq-btn-${idx}`;
        const panelId = `${baseId}-faq-panel-${idx}`;

        return (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors"
          >
            <button
              type="button"
              id={btnId}
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="w-full text-left px-6 py-4.5 sm:py-5 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
            >
              <span className="flex items-center gap-3">
                <span className="text-sky-600 dark:text-sky-400 font-mono text-xs">
                  {idx < 9 ? `0${idx + 1}.` : `${idx + 1}.`}
                </span>
                <span>{faq.question}</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                  isOpen ? "rotate-180 text-sky-600 dark:text-sky-400" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800"
              >
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
