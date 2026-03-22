"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Message = {
  id: string;
  sender: string;
  message: string | null;
  created_at: string;
};

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
};

export default function SupportTicketPage() {
  const params = useParams();
  const ticketNumber = decodeURIComponent(params.ticket_number as string);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const t = getOrCreateCustomerToken();
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/account/tickets/${encodeURIComponent(ticketNumber)}`, {
        headers: { "x-customer-token": t },
      });
      if (res.status === 404) {
        setTicket(null);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setTicket(data.ticket);
        setMessages(data.messages ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [ticketNumber]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    const t = getOrCreateCustomerToken();
    if (!t) return;
    setSending(true);
    try {
      const res = await fetch(`/api/account/tickets/${encodeURIComponent(ticketNumber)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-token": t },
        body: JSON.stringify({ message: reply }),
      });
      if (res.ok) {
        setReply("");
        load();
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <p className="text-honey-muted">Loading…</p>;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <p className="text-honey-muted">Ticket not found.</p>
        <Link href="/support" className="text-primary underline">
          Back to support
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/support" className="text-sm text-primary hover:underline">
          ← All tickets
        </Link>
        <h1 className="mt-4 font-display text-3xl text-honey-text">{ticket.subject}</h1>
        <p className="mt-1 font-mono text-sm text-primary">{ticket.ticket_number}</p>
        <p className="mt-2 text-sm text-honey-muted">Status: {ticket.status}</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.sender === "admin"
                ? "ml-0 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 md:ml-8"
                : "mr-0 rounded-xl border border-honey-border bg-bg/80 px-4 py-3 md:mr-8"
            }
          >
            <p className="text-xs font-semibold uppercase text-honey-muted">{m.sender}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-honey-text">{m.message}</p>
            <p className="mt-2 text-xs text-honey-muted">{new Date(m.created_at).toLocaleString("en-GB")}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" ? (
        <form onSubmit={sendReply} className="space-y-3">
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Write a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-honey-muted">This ticket is closed.</p>
      )}
    </div>
  );
}
