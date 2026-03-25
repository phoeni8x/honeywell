"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { parseSupportEnabled } from "@/lib/support-settings";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
  created_at?: string;
  updated_at?: string;
};

function normalizeMessageList(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): Message | null => {
      if (!item || typeof item !== "object") return null;
      const rec = item as Record<string, unknown>;
      const id =
        typeof rec.id === "string" ? rec.id : typeof rec.id === "number" ? String(rec.id) : "";
      if (!id) return null;
      return {
        id,
        sender: typeof rec.sender === "string" ? rec.sender : "customer",
        message: typeof rec.message === "string" || rec.message === null ? rec.message : null,
        media_urls: Array.isArray(rec.media_urls)
          ? rec.media_urls.filter((u): u is string => typeof u === "string")
          : null,
        created_at:
          typeof rec.created_at === "string" ? rec.created_at : new Date().toISOString(),
        is_read: typeof rec.is_read === "boolean" ? rec.is_read : null,
      };
    })
    .filter((m): m is Message => Boolean(m))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export default function SupportTicketPage() {
  const params = useParams();
  const ticketNumber = decodeURIComponent(params.ticket_number as string);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [supportEnabled, setSupportEnabled] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state: pushState, subscribe: subscribePush } = usePushNotifications();
  const mountedTicketRef = useRef(ticketNumber);

  useEffect(() => {
    mountedTicketRef.current = ticketNumber;
    setTicket(null);
    setMessages([]);
    setReply("");
    setSelectedImages([]);
    setInitialLoading(true);
    setLoadError(null);
  }, [ticketNumber]);

  function showFeedback(msg: string, ok = true) {
    setFeedback({ msg, ok });
    window.setTimeout(() => setFeedback(null), 3000);
  }

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const t = getOrCreateCustomerToken();
    if (!t) {
      setInitialLoading(false);
      return;
    }
    setLoadError(null);
    if (!opts?.silent) setInitialLoading(true);
    try {
      const url = `/api/account/tickets/${encodeURIComponent(ticketNumber)}?t=${Date.now()}`;
      const res = await fetch(url, {
        headers: { "x-customer-token": t },
        cache: "no-store",
      });
      if (res.status === 404) {
        setTicket(null);
        setMessages([]);
        if (!opts?.silent) setInitialLoading(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ticket?: Ticket;
        messages?: unknown;
        error?: string;
      };
      if (!res.ok) {
        if (!opts?.silent) setLoadError(data.error ?? "Failed to load thread.");
        return;
      }
      if (data.ticket) {
        if (mountedTicketRef.current !== ticketNumber) return;
        setTicket(data.ticket);
        setMessages(normalizeMessageList(data.messages));
        void fetch(`/api/account/tickets/${encodeURIComponent(ticketNumber)}/read`, {
          method: "POST",
          headers: { "x-customer-token": t },
          cache: "no-store",
        });
      }
    } catch (e) {
      console.error("[ticket load]", e);
      if (!opts?.silent) setLoadError("Failed to load thread.");
    } finally {
      if (!opts?.silent) setInitialLoading(false);
    }
  }, [ticketNumber]);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d: { support_enabled?: string }) => {
        setSupportEnabled(parseSupportEnabled(d.support_enabled));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (messages.length === 0) return;
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }, [messages]);

  const vapidReady = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

  async function sendReply() {
    const trimmed = reply.trim();
    if ((!trimmed && selectedImages.length === 0) || sending) return;
    const t = getOrCreateCustomerToken();
    if (!t) return;

    setSending(true);
    try {
      const imagesToUpload = [...selectedImages];
      let mediaUrls: string[] | null = null;
      let failedUploads = 0;
      if (imagesToUpload.length > 0) {
        setUploadingImages(true);
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const uploaded: string[] = [];
        for (const file of imagesToUpload) {
          const safeName = file.name.replace(/\s+/g, "_");
          const path = `ticket-${ticketNumber}/${Date.now()}-${safeName}`;
          const { error } = await supabase.storage.from("pickup-proofs").upload(path, file, { upsert: true });
          if (!error) {
            const {
              data: { publicUrl },
            } = supabase.storage.from("pickup-proofs").getPublicUrl(path);
            uploaded.push(publicUrl);
          } else {
            failedUploads += 1;
          }
        }
        if (uploaded.length > 0) mediaUrls = uploaded;
        setUploadingImages(false);
        if (uploaded.length === 0) {
          showFeedback("Could not upload image(s). Please try again.", false);
          return;
        }
        if (failedUploads > 0) {
          showFeedback(`${failedUploads} image(s) failed to upload. Sent remaining files.`, false);
        }
      }

      const res = await fetch(
        `/api/account/tickets/${encodeURIComponent(ticketNumber)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-customer-token": t,
          },
          body: JSON.stringify({
            message: trimmed || "(attachment)",
            ...(mediaUrls ? { media_urls: mediaUrls } : {}),
          }),
        }
      );

      if (res.ok) {
        setReply("");
        setSelectedImages([]);
        await load({ silent: true });
      } else {
        showFeedback("Failed to send reply. Please try again.", false);
      }
    } catch {
      showFeedback("Network error. Please try again.", false);
    } finally {
      setSending(false);
      setUploadingImages(false);
    }
  }

  if (initialLoading) {
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
    <div className="space-y-6 pb-24">
      {feedback && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-2 text-sm font-semibold shadow-lg ${
            feedback.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {feedback.msg}
        </div>
      )}
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

      {!supportEnabled && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Support is currently offline. You can read this chat, but new replies are temporarily disabled.
        </p>
      )}

      {loadError && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </p>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
        {messages.length === 0 && (
          <p className="text-sm text-honey-muted">No messages yet.</p>
        )}
        {messages.map((m) => {
          const isAdmin = m.sender === "admin";
          const mediaUrls: string[] = Array.isArray(m.media_urls) ? m.media_urls : [];
          return (
            <div
              key={m.id}
              className={`rounded-2xl px-4 py-3 ${
                isAdmin
                  ? "mr-auto border border-primary/30 bg-primary/10 dark:bg-primary/15"
                  : "ml-auto max-w-[85%] border border-honey-border bg-surface dark:bg-surface-dark"
              }`}
            >
              <p
                className={`mb-1 text-xs font-bold uppercase tracking-wide ${
                  isAdmin ? "text-primary" : "text-honey-muted"
                }`}
              >
                {isAdmin ? "ADMIN" : "YOU"}
              </p>
              {m.message && m.message !== "(attachment)" && (
                <p className="whitespace-pre-wrap text-sm text-honey-text">
                  {m.message}
                </p>
              )}
              {mediaUrls.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${m.message && m.message !== "(attachment)" ? "mt-2" : ""}`}>
                  {mediaUrls.map((url, idx) => (
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
              <p className="mt-1.5 text-[10px] text-honey-muted">
                {new Date(m.created_at).toLocaleString("en-GB")}
              </p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {ticket.status !== "closed" && supportEnabled ? (
        <div className="space-y-3">
          {/* Image previews */}
          {selectedImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedImages.map((file, idx) => (
                <div key={idx} className="relative h-20 w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="h-full w-full rounded-xl border border-honey-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImages((imgs) =>
                        imgs.filter((_, i) => i !== idx)
                      )
                    }
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            className="min-h-[100px] w-full rounded-2xl border border-honey-border bg-bg/60 px-4 py-3 text-sm text-honey-text placeholder:text-honey-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Write a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            enterKeyHint="send"
            onFocus={(e) =>
              setTimeout(
                () =>
                  e.target.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  }),
                350
              )
            }
          />

          <div className="flex items-center gap-3">
            {/* Photo attach button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-honey-border text-honey-muted transition hover:border-primary/40 hover:text-primary"
              title="Attach photo"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length === 0) return;
                setSelectedImages((prev) => {
                  const next = [...prev, ...files].slice(0, 5);
                  if (prev.length + files.length > 5) {
                    showFeedback("Maximum 5 photos per message.", false);
                  }
                  return next;
                });
                e.target.value = "";
              }}
            />

            {/* Send button */}
            <button
              type="button"
              disabled={sending || (!reply.trim() && selectedImages.length === 0)}
              onClick={() => void sendReply()}
              className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-light disabled:opacity-50"
            >
              {sending
                ? uploadingImages
                  ? "Uploading…"
                  : "Sending…"
                : "Send reply"}
            </button>
          </div>

          <p className="text-center text-xs text-honey-muted">
            You can attach up to 5 photos per message
          </p>
        </div>
      ) : ticket.status === "closed" ? (
        <p className="text-sm text-honey-muted">This ticket is closed.</p>
      ) : (
        <p className="text-sm text-honey-muted">Reply is unavailable while support is offline.</p>
      )}
    </div>
  );
}
