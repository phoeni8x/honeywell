"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTicketRealtime } from "@/hooks/useTicketRealtime";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

type Message = {
  id: string;
  sender: string;
  message: string | null;
  media_urls: string[] | null;
  created_at: string;
  is_read?: boolean | null;
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
  const { state: pushState, subscribe: subscribePush } = usePushNotifications();

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
        void fetch(`/api/account/tickets/${encodeURIComponent(ticketNumber)}/read`, {
          method: "POST",
          headers: { "x-customer-token": t },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [ticketNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  useTicketRealtime(ticketNumber, load, { enabled: Boolean(ticket), intervalMs: 4000 });

  const vapidReady = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

  const openLightbox = (urls: string[], start: number) => {
    const slides = urls.filter((u) => /^https?:\/\//i.test(u)).map((src) => ({ src }));
    if (slides.length === 0) return;
    setLightboxSlides(slides);
    setLightboxIndex(start);
    setLightboxOpen(true);
  };

  const imageUrlsByMessage = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const m of messages) {
      const urls = (m.media_urls ?? []).filter((u) => /^https?:\/\//i.test(u) && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u));
      if (urls.length) map.set(m.id, urls);
    }
    return map;
  }, [messages]);

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
        await load();
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
      {vapidReady && pushState !== "unsupported" && pushState !== "subscribed" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="text-honey-text">Get notified when we reply.</span>
          <button
            type="button"
            onClick={() => void subscribePush()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white"
          >
            Enable notifications
          </button>
        </div>
      )}

      <div>
        <Link href="/support" className="text-sm text-primary hover:underline">
          ← All tickets
        </Link>
        <h1 className="mt-4 font-display text-3xl text-honey-text">{ticket.subject}</h1>
        <p className="mt-1 font-mono text-sm text-primary">{ticket.ticket_number}</p>
        <p className="mt-2 text-sm text-honey-muted">Status: {ticket.status}</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
        {messages.map((m) => {
          const isAdmin = m.sender === "admin";
          const imgs = imageUrlsByMessage.get(m.id) ?? [];
          return (
            <div
              key={m.id}
              className={
                isAdmin
                  ? "ml-0 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 md:ml-8"
                  : "mr-0 rounded-xl border border-honey-border bg-bg/80 px-4 py-3 md:mr-8"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-honey-muted">{m.sender}</p>
                {isAdmin && m.is_read && (
                  <span className="text-[10px] text-honey-muted" title="Seen">
                    ✓ Read
                  </span>
                )}
              </div>
              {m.message && <p className="mt-1 whitespace-pre-wrap text-sm text-honey-text">{m.message}</p>}
              {imgs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {imgs.map((url, idx) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => openLightbox(imgs, idx)}
                      className="relative h-24 w-24 overflow-hidden rounded-lg border border-honey-border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {m.media_urls?.some((u) => !imgs.includes(u)) && (
                <ul className="mt-2 space-y-1">
                  {m.media_urls
                    ?.filter((u) => !imgs.includes(u))
                    .map((u) => (
                      <li key={u}>
                        <a href={u} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                          {u}
                        </a>
                      </li>
                    ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-honey-muted">{new Date(m.created_at).toLocaleString("en-GB")}</p>
            </div>
          );
        })}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={lightboxSlides}
      />

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
