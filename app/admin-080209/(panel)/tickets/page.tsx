"use client";

import { ADMIN_BASE_PATH } from "@/lib/constants";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { truncateToken } from "@/lib/helpers";
import { useAdminPushNotifications } from "@/hooks/useAdminPushNotifications";
import { useAdminTicketRealtime } from "@/hooks/useAdminTicketRealtime";
import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TicketRow = {
  id: string;
  ticket_number: string;
  customer_token: string;
  subject: string;
  status: string;
  category: string | null;
  updated_at: string;
  order_id: string | null;
};

type MessageRow = {
  id: string;
  sender: string;
  message: string | null;
  media_urls: string[] | null;
  created_at: string;
  is_read?: boolean | null;
};

export default function AdminTicketsInboxPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [statusPick, setStatusPick] = useState<string>("open");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { state: pushState, subscribe: subscribePush } = useAdminPushNotifications();
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const fetchTickets = useCallback(async () => {
    const res = await fetch("/api/admin/tickets", { credentials: "include" });
    if (!res.ok) {
      if (res.status === 401) {
        setFetchError("Not signed in — ensure ADMIN_EMAIL and ADMIN_PASSWORD are set, then open the admin dashboard once.");
      } else {
        setFetchError("Could not load tickets.");
      }
      console.error("[admin inbox] tickets HTTP", res.status);
      return;
    }
    setFetchError(null);
    const json = (await res.json()) as { tickets?: TicketRow[] };
    setTickets(json.tickets ?? []);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    await fetchTickets();
    setLoadingList(false);
  }, [fetchTickets]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    const res = await fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}/messages`, {
      credentials: "include",
    });
    if (!res.ok) {
      console.error("[admin inbox] messages HTTP", res.status);
      return;
    }
    const json = (await res.json()) as { messages?: MessageRow[] };
    setMessages(json.messages ?? []);
  }, []);

  const loadMessages = useCallback(
    async (ticketId: string) => {
      setLoadingMsgs(true);
      await fetchMessages(ticketId);
      setLoadingMsgs(false);
    },
    [fetchMessages]
  );

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  /** Polling backup when Postgres Realtime is off or misconfigured. */
  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchTickets();
      const sid = selectedIdRef.current;
      if (sid) void fetchMessages(sid);
    }, 5000);
    return () => window.clearInterval(id);
  }, [fetchTickets, fetchMessages]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) setStatusPick(selected.status);
  }, [selected]);

  useAdminTicketRealtime({
    onTicketsChange: fetchTickets,
    onMessageInsert: (tid) => {
      if (tid === selectedIdRef.current) void fetchMessages(tid);
      void fetchTickets();
    },
  });

  const filteredTickets = useMemo(() => {
    if (statusFilter === "all") return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    const res = await fetch("/api/admin/tickets/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ticket_id: selectedId,
        message: reply.trim(),
        status: statusPick,
        internal,
      }),
    });
    if (!res.ok) {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setReply("");
    setInternal(false);
    await fetchMessages(selectedId);
    await fetchTickets();
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`${ADMIN_BASE_PATH}?tab=support`} className="text-sm text-primary hover:underline">
            ← Legacy support table
          </Link>
          <h1 className="mt-2 font-display text-3xl text-honey-text">Support inbox</h1>
          <p className="mt-1 text-sm text-honey-muted">
            Loads from the server so customer chats always show here when you are signed in as admin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pushState !== "unsupported" && pushState !== "subscribed" && (
            <button
              type="button"
              onClick={() => void subscribePush()}
              className="rounded-full border border-honey-border px-4 py-2 text-sm font-medium text-honey-text hover:bg-honey-border/30"
            >
              Enable push alerts
            </button>
          )}
          {pushState === "subscribed" && (
            <span className="text-xs text-honey-muted">Push enabled for this browser</span>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {fetchError}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 lg:max-w-sm">
          <div className="flex flex-wrap gap-2">
            {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  statusFilter === s ? "bg-primary/20 text-primary" : "bg-honey-border/40 text-honey-muted"
                )}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-2xl border border-honey-border bg-surface p-2 dark:bg-surface-dark">
            {loadingList && <p className="p-3 text-sm text-honey-muted">Loading…</p>}
            {!loadingList && filteredTickets.length === 0 && (
              <p className="p-3 text-sm text-honey-muted">No tickets.</p>
            )}
            {filteredTickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={clsx(
                  "w-full rounded-xl px-3 py-2 text-left text-sm transition",
                  selectedId === t.id ? "bg-primary/15 text-honey-text" : "hover:bg-honey-border/30"
                )}
              >
                <p className="font-mono text-xs text-primary">{t.ticket_number}</p>
                <p className="line-clamp-2 font-medium">{t.subject}</p>
                <p className="mt-1 text-xs text-honey-muted">
                  {t.status} · {new Date(t.updated_at).toLocaleString("en-GB")}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-[50vh] flex-1 rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
          {!selected && (
            <p className="text-sm text-honey-muted">Select a ticket to view the thread.</p>
          )}
          {selected && (
            <div className="flex h-full flex-col gap-4">
              <div>
                <h2 className="font-display text-xl text-honey-text">{selected.subject}</h2>
                <p className="mt-1 font-mono text-xs text-primary">{selected.ticket_number}</p>
                <p className="mt-2 text-xs text-honey-muted">
                  Customer: <span className="font-mono">{truncateToken(selected.customer_token)}</span>
                </p>
              </div>

              <div className="max-h-[40vh] flex-1 space-y-3 overflow-y-auto rounded-xl border border-honey-border/60 bg-bg/50 p-3">
                {loadingMsgs && <p className="text-sm text-honey-muted">Loading messages…</p>}
                {!loadingMsgs &&
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={clsx(
                        "rounded-xl border px-3 py-2 text-sm",
                        m.sender === "customer"
                          ? "ml-0 border-honey-border bg-bg/80 md:mr-12"
                          : m.sender === "admin_internal"
                            ? "mx-0 border-amber-500/40 bg-amber-500/10 md:mx-8"
                            : "ml-0 border-primary/30 bg-primary/5 md:ml-12"
                      )}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-honey-muted">
                        {m.sender === "admin_internal" ? "internal note" : m.sender}
                      </p>
                      {m.message && <p className="mt-1 whitespace-pre-wrap text-honey-text">{m.message}</p>}
                      {m.media_urls?.length ? (
                        <ul className="mt-2 space-y-1">
                          {m.media_urls.map((u) => (
                            <li key={u}>
                              <a href={u} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                                {u}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="mt-2 text-[10px] text-honey-muted">
                        {new Date(m.created_at).toLocaleString("en-GB")}
                        {m.sender === "admin" && m.is_read ? " · read" : null}
                      </p>
                    </div>
                  ))}
              </div>

              <div className="space-y-3 border-t border-honey-border pt-4">
                <label className="flex items-center gap-2 text-sm text-honey-muted">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Internal note (not visible to customer, no push)
                </label>
                <div>
                  <p className="text-xs text-honey-muted">Set status on send</p>
                  <select
                    className="mt-1 w-full max-w-xs rounded-lg border border-honey-border bg-bg px-2 py-1 text-sm"
                    value={statusPick}
                    onChange={(e) => setStatusPick(e.target.value)}
                  >
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
                <textarea
                  className="min-h-[100px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                  placeholder={internal ? "Internal note…" : "Reply to customer…"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={!reply.trim()}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
