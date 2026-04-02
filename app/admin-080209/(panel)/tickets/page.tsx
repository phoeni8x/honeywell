"use client";

import { ADMIN_BASE_PATH } from "@/lib/constants";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { truncateToken } from "@/lib/helpers";
import { parseSupportEnabled } from "@/lib/support-settings";
import { useAdminPushNotifications } from "@/hooks/useAdminPushNotifications";
import { useAdminTicketRealtime } from "@/hooks/useAdminTicketRealtime";
import clsx from "clsx";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TicketRow = {
  id: string;
  ticket_number: string;
  customer_token: string;
  customer_username?: string | null;
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

type ModerationRow = {
  customer_token: string;
  is_banned: boolean;
  ban_reason: string | null;
  channel_kicked: boolean;
  updated_at: string;
};

function mergeTicketsById(prev: TicketRow[], incoming: TicketRow[]): TicketRow[] {
  const byId = new Map<string, TicketRow>();
  for (const t of prev) byId.set(t.id, t);
  for (const t of incoming) byId.set(t.id, t);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function mergeMessagesById(prev: MessageRow[], incoming: MessageRow[]): MessageRow[] {
  const byId = new Map<string, MessageRow>();
  for (const m of prev) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export default function AdminTicketsInboxPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [internal, setInternal] = useState(false);
  const [statusPick, setStatusPick] = useState<string>("open");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [moderationRows, setModerationRows] = useState<ModerationRow[]>([]);
  const [moderationReason, setModerationReason] = useState("");
  const [moderationBusy, setModerationBusy] = useState<string | null>(null);
  const [customerSupportEnabled, setCustomerSupportEnabled] = useState<boolean | null>(null);
  const { state: pushState, subscribe: subscribePush } = useAdminPushNotifications();
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const loadTickets = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setInitialLoading(true);
    try {
      const res = await fetch("/api/admin/tickets", { credentials: "include", cache: "no-store" });
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
      const nextTickets = json.tickets ?? [];
      setTickets((prev) => {
        const merged = opts?.silent ? mergeTicketsById(prev, nextTickets) : nextTickets;
        const newJson = JSON.stringify(merged);
        const prevJson = JSON.stringify(prev);
        if (newJson === prevJson) return prev;
        return merged;
      });
    } finally {
      if (!opts?.silent) setInitialLoading(false);
    }
  }, []);

  const fetchModeration = useCallback(async () => {
    const res = await fetch("/api/admin/moderation", { credentials: "include" });
    if (!res.ok) return;
    const json = (await res.json().catch(() => ({}))) as { rows?: ModerationRow[] };
    setModerationRows(json.rows ?? []);
  }, []);

  const fetchCustomerSupportStatus = useCallback(async () => {
    const res = await fetch("/api/settings/public", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json().catch(() => ({}))) as { support_enabled?: string };
    setCustomerSupportEnabled(parseSupportEnabled(json.support_enabled));
  }, []);

  const loadMessages = useCallback(async (ticketId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}/messages`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        console.error("[admin inbox] messages HTTP", res.status);
        return;
      }
      const json = (await res.json()) as { messages?: MessageRow[] };
      const nextMessages = json.messages ?? [];
      if (selectedIdRef.current !== ticketId) return;
      setMessages((prev) => {
        const merged = opts?.silent ? mergeMessagesById(prev, nextMessages) : nextMessages;
        const newJson = JSON.stringify(merged);
        const prevJson = JSON.stringify(prev);
        if (newJson === prevJson) return prev;
        return merged;
      });
    } finally {
      if (!opts?.silent) setLoadingMsgs(false);
    }
  }, []);

  async function sendReply() {
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
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
      await loadMessages(selectedId, { silent: true });
      await loadTickets({ silent: true });
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    void loadTickets();
    void fetchModeration();
    void fetchCustomerSupportStatus();
  }, [loadTickets, fetchModeration, fetchCustomerSupportStatus]);

  useEffect(() => {
    setMessages([]);
    setReply("");
    setInternal(false);
    if (selectedId) void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void loadTickets({ silent: true });
      void fetchModeration();
      void fetchCustomerSupportStatus();
    }, 8000);
    return () => window.clearInterval(id);
  }, [loadTickets, fetchModeration, fetchCustomerSupportStatus]);

  useEffect(() => {
    const sid = selectedIdRef.current;
    if (!sid) return;
    const id = window.setInterval(() => {
      const current = selectedIdRef.current;
      if (current) void loadMessages(current, { silent: true });
    }, 5000);
    return () => window.clearInterval(id);
  }, [selectedId, loadMessages]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) setStatusPick(selected.status);
  }, [selected]);

  useAdminTicketRealtime({
    onTicketsChange: () => {
      void loadTickets({ silent: true });
    },
    onMessageInsert: (tid) => {
      if (tid === selectedIdRef.current) void loadMessages(tid, { silent: true });
      void loadTickets({ silent: true });
    },
  });

  const filteredTickets = useMemo(() => {
    if (statusFilter === "all") return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  async function deleteHistory(mode: "ticket" | "customer" | "all") {
    if (mode === "ticket" && !selectedId) return;
    if (mode === "customer" && !selected?.customer_token) return;
    if ((mode === "ticket" || mode === "customer") && selected && !["resolved", "closed"].includes(selected.status)) {
      alert("Resolve or close the ticket first before deleting history.");
      return;
    }
    if (mode === "all") {
      const ok = window.prompt('Type "DELETE ALL CHATS" to confirm') === "DELETE ALL CHATS";
      if (!ok) return;
    } else {
      const ok = confirm("Delete chat history? This cannot be undone.");
      if (!ok) return;
    }
    const payload: Record<string, string> = { mode };
    if (mode === "ticket" && selectedId) payload.ticket_id = selectedId;
    if (mode === "customer" && selected?.customer_token) payload.customer_token = selected.customer_token;
    const res = await fetch("/api/admin/tickets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setMessages([]);
    if (mode !== "all") setSelectedId(null);
    await loadTickets({ silent: true });
  }

  async function moderate(action: "ban" | "unban" | "kick_channel" | "unkick_channel") {
    if (!selected?.customer_token) return;
    setModerationBusy(action);
    const res = await fetch("/api/admin/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action,
        customer_token: selected.customer_token,
        reason: moderationReason.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error || PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    }
    setModerationBusy(null);
    await fetchModeration();
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mt-2 font-display text-3xl text-honey-text">Support inbox</h1>
          <p className="mt-1 text-sm text-honey-muted">
            Loads from the server so customer chats always show here when you are signed in as admin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold",
              customerSupportEnabled === null
                ? "bg-honey-border/40 text-honey-muted"
                : customerSupportEnabled
                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                  : "bg-amber-500/20 text-amber-800 dark:text-amber-300"
            )}
          >
            Customer support:{" "}
            {customerSupportEnabled === null ? "checking..." : customerSupportEnabled ? "online" : "offline"}
          </span>
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
            {initialLoading && <p className="p-3 text-sm text-honey-muted">Loading…</p>}
            {!initialLoading && filteredTickets.length === 0 && (
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
                <p className="mt-1 text-xs text-honey-muted">
                  Username:{" "}
                  <span className="font-mono text-primary">
                    {selected.customer_username ? `@${selected.customer_username}` : "—"}
                  </span>
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
                      {Array.isArray(m.media_urls) && m.media_urls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(m.media_urls as string[]).map((url, idx) => (
                            <a
                              key={`${url}${idx}`}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block overflow-hidden rounded-xl border border-honey-border"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Attachment ${idx + 1}`}
                                className="max-h-48 max-w-[240px] object-cover"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      )}
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
                  disabled={sending || !reply.trim()}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send"}
                </button>

                <div className="rounded-xl border border-honey-border/60 bg-bg/30 p-3">
                  <p className="text-xs font-semibold text-honey-text">Moderation</p>
                  <textarea
                    className="mt-2 min-h-[64px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs"
                    placeholder="Ban reason (optional)"
                    value={moderationReason}
                    onChange={(e) => setModerationReason(e.target.value)}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={moderationBusy !== null}
                      onClick={() => void moderate("ban")}
                      className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Ban customer
                    </button>
                    <button
                      type="button"
                      disabled={moderationBusy !== null}
                      onClick={() => void moderate("unban")}
                      className="rounded-full border border-green-600 px-3 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-60 dark:text-green-400"
                    >
                      Unban customer
                    </button>
                    <button
                      type="button"
                      disabled={moderationBusy !== null}
                      onClick={() => void moderate("kick_channel")}
                      className="rounded-full border border-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-60 dark:text-amber-400"
                    >
                      Kick from Telegram channel
                    </button>
                    <button
                      type="button"
                      disabled={moderationBusy !== null}
                      onClick={() => void moderate("unkick_channel")}
                      className="rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-60"
                    >
                      Reverse channel kick
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-honey-border/60 bg-bg/30 p-3">
                  <p className="text-xs font-semibold text-honey-text">Chat history controls</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void deleteHistory("ticket")}
                      className="rounded-full border border-honey-border px-3 py-1.5 text-xs"
                    >
                      Delete this ticket history
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteHistory("customer")}
                      className="rounded-full border border-honey-border px-3 py-1.5 text-xs"
                    >
                      Delete all chats for this customer
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteHistory("all")}
                      className="rounded-full bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Ultra: delete all chat history
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
        <p className="text-sm font-semibold text-honey-text">Banned / moderated customers</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="text-honey-muted">
              <tr>
                <th className="p-2">Customer</th>
                <th className="p-2">Banned</th>
                <th className="p-2">Channel kicked</th>
                <th className="p-2">Reason</th>
                <th className="p-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {moderationRows.length === 0 && (
                <tr>
                  <td className="p-2 text-honey-muted" colSpan={5}>
                    No moderation records yet.
                  </td>
                </tr>
              )}
              {moderationRows.map((r) => (
                <tr key={r.customer_token} className="border-t border-honey-border/50">
                  <td className="p-2 font-mono">{truncateToken(r.customer_token)}</td>
                  <td className="p-2">{r.is_banned ? "Yes" : "No"}</td>
                  <td className="p-2">{r.channel_kicked ? "Yes" : "No"}</td>
                  <td className="p-2">{r.ban_reason ?? "—"}</td>
                  <td className="p-2 text-honey-muted">{new Date(r.updated_at).toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
