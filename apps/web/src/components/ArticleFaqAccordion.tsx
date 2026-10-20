"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { BlogPostFAQ } from "@/types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface ArticleFaqAccordionProps {
  faqs?: BlogPostFAQ[] | null;
}

export function ArticleFaqAccordion({ faqs }: ArticleFaqAccordionProps) {
  const [openIndices, setOpenIndices] = useState<Record<number, boolean>>({});

  if (!faqs || faqs.length === 0) return null;

  const validFaqs = faqs.filter(
    (f) => f.question && f.question.trim().length > 0 && f.answer && f.answer.trim().length > 0
  );

  if (validFaqs.length === 0) return null;

  const toggleIndex = (idx: number) => {
    setOpenIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <section className="my-10 pt-8 border-t border-slate-200" aria-labelledby="article-faq-heading">
      <div className="flex items-center gap-2 mb-6">
        <HelpCircle className="w-5 h-5 text-sky-600" />
        <h2 id="article-faq-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-3">
        {validFaqs.map((faq, idx) => {
          const isOpen = !!openIndices[idx];
          const faqId = `faq-panel-${idx}`;
          const btnId = `faq-btn-${idx}`;

          return (
            <div
              key={faq.id || idx}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-colors hover:border-slate-300"
            >
              <button
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={faqId}
                onClick={() => toggleIndex(idx)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-semibold text-slate-800 hover:text-slate-900 transition-colors"
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-sky-600" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div
                  id={faqId}
                  role="region"
                  aria-labelledby={btnId}
                  className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-slate-600 border-t border-slate-100"
                >
                  <div className="pt-3">
                    <MarkdownRenderer content={faq.answer} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
