"use client";

import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { RESOURCE_FAQS, ResourceFaqItem } from "./faqData";

export { RESOURCE_FAQS };
export type { ResourceFaqItem };

export function ResourceFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section aria-labelledby="resources-faq-heading" className="space-y-6 pt-4">
      <div className="max-w-2xl space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
          <span>Frequently Asked Questions</span>
        </div>
        <h2 id="resources-faq-heading" className="text-2xl font-bold text-slate-900 tracking-tight">
          Website Security FAQ
        </h2>
        <p className="text-sm text-slate-600">
          Clear, technically accurate answers about SiteSecura tools, testing capabilities, and assessment boundaries.
        </p>
      </div>

      <div className="space-y-3">
        {RESOURCE_FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-colors"
            >
              <button
                onClick={() => toggle(index)}
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
    </section>
  );
}
