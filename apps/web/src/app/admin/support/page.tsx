"use client";

import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  Mail,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/lib/api";

export default function AdminSupportPage() {
  const [activeTab, setActiveTab] = useState<"tickets" | "contacts">("tickets");
  const [tickets, setTickets] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === "tickets") {
        const data = await api.getAdminSupportTickets();
        setTickets(data || []);
      } else {
        const data = await api.getAdminContacts();
        setContacts(data || []);
      }
    } catch (err) {
      console.error("Failed to load support inquiries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleUpdateTicketStatus = async (ticketId: string, nextStatus: string) => {
    try {
      await api.updateAdminSupportTicket(ticketId, { status: nextStatus });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update ticket.");
    }
  };

  const handleUpdateContactStatus = async (contactId: string, nextStatus: string) => {
    try {
      await api.updateAdminContact(contactId, { status: nextStatus });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update contact message.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Support & Contact Inquiries</h1>
            <p className="text-xs text-slate-400 mt-1">
              Customer assistance tickets, escalation priority levels, and public website contact submissions.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === "tickets"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <LifeBuoy className="w-4 h-4 text-sky-400" />
            <span>Support Tickets ({tickets.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === "contacts"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Mail className="w-4 h-4 text-emerald-400" />
            <span>Contact Submissions ({contacts.length})</span>
          </button>
        </div>

        {/* Tickets Content */}
        {activeTab === "tickets" && (
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Subject & Details</th>
                    <th className="py-3 px-5">Requester</th>
                    <th className="py-3 px-5">Priority</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Created</th>
                    <th className="py-3 px-5 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No support tickets currently open.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-5 max-w-sm">
                          <p className="font-bold text-white text-xs">{t.subject}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{t.message}</p>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-slate-300">
                          {t.user_email || "Anonymous"}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.priority === "urgent" || t.priority === "high"
                                ? "bg-red-950 text-red-400 border border-red-800"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === "open"
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : t.status === "pending"
                                ? "bg-sky-950 text-sky-400 border border-sky-800"
                                : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">
                          {new Date(t.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <select
                            value={t.status}
                            onChange={(e) => handleUpdateTicketStatus(t.id, e.target.value)}
                            className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-[11px] font-semibold focus:outline-none focus:border-sky-500 capitalize"
                          >
                            <option value="open">Open</option>
                            <option value="pending">Pending</option>
                            <option value="closed">Closed / Resolved</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Contacts Content */}
        {activeTab === "contacts" && (
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Sender</th>
                    <th className="py-3 px-5">Subject & Inquiries</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Submitted At</th>
                    <th className="py-3 px-5 text-right">Mark Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No contact submissions recorded.
                      </td>
                    </tr>
                  ) : (
                    contacts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-white">{c.name}</p>
                          <p className="font-mono text-slate-400 text-[11px]">{c.email}</p>
                        </td>
                        <td className="py-3.5 px-5 max-w-sm">
                          <p className="font-bold text-white text-xs">{c.subject}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{c.message}</p>
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === "new"
                                ? "bg-sky-950 text-sky-400 border border-sky-800"
                                : c.status === "reviewed"
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <select
                            value={c.status}
                            onChange={(e) => handleUpdateContactStatus(c.id, e.target.value)}
                            className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 text-[11px] font-semibold focus:outline-none focus:border-sky-500 capitalize"
                          >
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
