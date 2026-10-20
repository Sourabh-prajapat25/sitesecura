"use client";

import React, { useState } from "react";
import { Mail, MessageSquare, Send, Check } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { api } from "@/lib/api";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.submitContact({ name, email, subject, message });
      setSent(true);
    } catch (err: any) {
      alert(err.message || "Failed to send message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              Get in Touch with SiteSecura
            </h1>
            <p className="text-slate-600 text-sm">
              Questions about our automated scanner, agency integrations, or custom plans? Send us a message.
            </p>
          </div>

          <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm">
            {sent ? (
              <div className="text-center space-y-3 py-8">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Message Received</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  Thank you for reaching out. A security engineer from our team will reply to <strong>{email}</strong> shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="General Inquiry / Agency Partnership"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help your team?"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? "Sending..." : "Submit Message"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
