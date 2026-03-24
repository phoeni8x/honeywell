"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import Link from "next/link";
import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  updated_at: string;
};

export default function SupportListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const t = getOrCreateCustomerToken();
    if (!t) return;
    setLoadError(null);
    fetch("/api/account/tickets", { headers: { "x-customer-token": t } })
      .then(async (r) => {
        let d: { tickets?: Ticket[]; error?: string } = {};
        try {
          d = (await r.json()) as typeof d;
        } catch {
          setLoadError("Could not load tickets. Please refresh.");
          return;
        }
        if (!r.ok) {
          setLoadError(d.error ?? "Could not load tickets. Please refresh.");
          return;
        }
        setTickets(d.tickets ?? []);
      })
      .catch(() => setLoadError("Could not load tickets. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-honey-text">Support</h1>
          <p className="mt-2 text-honey-muted">Your conversations with Honey Well.</p>
        </div>
        <Link
          href="/support/new"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-light"
        >
          New ticket
        </Link>
      </div>

      {loadError && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="text-honey-muted">Loading…</p>
      ) : tickets.length === 0 && !loadError ? (
        <p className="rounded-2xl border border-dashed border-honey-border py-16 text-center text-honey-muted">
          No tickets yet.{" "}
          <Link href="/support/new" className="text-primary underline">
            Open a ticket
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {tickets.map((tk) => (
            <li key={tk.id}>
              <Link
                href={`/support/${encodeURIComponent(tk.ticket_number)}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-honey-border bg-surface p-4 transition hover:border-primary/40 dark:bg-surface-dark"
              >
                <div>
                  <p className="font-mono text-sm text-primary">{tk.ticket_number}</p>
                  <p className="font-medium text-honey-text">{tk.subject}</p>
                </div>
                <div className="text-right text-sm text-honey-muted">
                  <p>{tk.status}</p>
                  <p>{new Date(tk.updated_at).toLocaleString("en-GB")}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
