import React from "react";
import Link from "next/link";
import { Shield, Target, Users, Zap, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="space-y-4 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              About SiteSecura
            </h1>
            <p className="text-slate-600 text-lg leading-relaxed max-w-2xl mx-auto">
              Making website cybersecurity accessible, understandable, and actionable for small businesses and developers worldwide.
            </p>
          </div>

          <div className="prose prose-slate max-w-none text-slate-700 space-y-6 text-sm leading-relaxed bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Our Mission</h2>
            <p>
              Small businesses, agencies, and independent creators manage millions of websites but frequently lack dedicated in-house security teams. Enterprise vulnerability tools are often prohibitively expensive, noisy with false positives, and filled with incomprehensible jargon.
            </p>
            <p>
              SiteSecura was built to provide straightforward defensive posture assessments: testing public domain configurations, calculating transparent scores, explaining findings in plain English, and monitoring for critical certificate or header changes.
            </p>

            <h2 className="text-xl font-bold text-slate-900 pt-4">Core Principles</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li><strong>Passive & Defensive:</strong> We only perform safe, read-only checks without intrusive exploits.</li>
              <li><strong>Deterministic Scoring:</strong> Every score deduction is tied to verified evidence.</li>
              <li><strong>Actionable Remediation:</strong> We explain what is wrong, why it matters, and provide realistic fix code.</li>
              <li><strong>Agency Friendly:</strong> Helping digital agencies protect and audit client websites with white-label reports.</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
