"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import Link from "next/link";
import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  category: string;
  updated_at: string;
  created_at: string;
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-400/20 dark:text-green-400",
  closed: "bg-honey-border/60 text-honey-muted",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getOrCreateCustomerToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch("/api/account/tickets", {
      headers: { "x-customer-token": token },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-honey-text">Support</h1>
          <p className="mt-1 text-sm text-honey-muted">
            Your conversations with Honey Well.
          </p>
        </div>
        <Link
          href="/support/new"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-light"
        >
          New ticket
        </Link>
      </div>

      {loading && <p className="text-sm text-honey-muted">Loading…</p>}

      {!loading && tickets.length === 0 && (
        <div className="rounded-2xl border border-dashed border-honey-border py-16 text-center">
          <p className="text-honey-muted">No tickets yet.</p>
          <Link
            href="/support/new"
            className="mt-3 inline-block text-sm font-medium text-primary underline"
          >
            Open a ticket
          </Link>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="flex flex-col divide-y divide-honey-border overflow-hidden rounded-2xl border border-honey-border">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/support/${t.ticket_number}`}
              className="flex items-start justify-between gap-3 px-4 py-4 transition hover:bg-honey-border/20 active:bg-honey-border/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">
                    {t.ticket_number}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      STATUS_COLOR[t.status] ?? STATUS_COLOR.closed
                    }`}
                  >
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-honey-text">
                  {t.subject}
                </p>
                <p className="mt-0.5 text-[11px] text-honey-muted">
                  {new Date(t.updated_at).toLocaleString("en-GB")}
                </p>
              </div>
              <span className="mt-1 text-honey-muted">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
