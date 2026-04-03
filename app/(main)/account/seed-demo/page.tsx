"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { getSupportTelegramUrl } from "@/lib/support-telegram";
import Link from "next/link";
import { useState } from "react";

export default function SeedDemoPage() {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  async function run() {
    setMessage(null);
    setDetail(null);
    const t = getOrCreateCustomerToken();
    if (!t) {
      setMessage("Could not read customer id for this browser.");
      return;
    }
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-customer-token": t,
      };
      if (key.trim()) {
        headers["x-demo-seed-key"] = key.trim();
      }
      const res = await fetch("/api/customer/seed-demo", {
        method: "POST",
        headers,
        body: JSON.stringify(key.trim() ? { demo_seed_key: key.trim() } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        orders?: { order_number?: string | null; status: string }[];
        tickets?: { ticket_number: string; subject: string }[];
      };
      if (!res.ok) {
        setMessage(data.error ?? "Request failed.");
        return;
      }
      setMessage("Demo data created for this browser. Open My orders and reload.");
      const lines: string[] = [];
      if (data.orders?.length) {
        lines.push(
          "Orders: " +
            data.orders.map((o) => `${o.order_number ?? "?"} (${o.status})`).join(", ")
        );
      }
      if (data.tickets?.length) {
        lines.push(
          "Tickets: " + data.tickets.map((x) => `${x.ticket_number}`).join(", ")
        );
      }
      setDetail(lines.join("\n"));
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl text-honey-text">Load demo data</h1>
        <p className="mt-2 text-sm text-honey-muted">
          Creates two sample orders and two support tickets for this device only (same customer token as My orders /
          Support). Safe to run again — it replaces previous <code className="rounded bg-bg px-1">[HW Demo]</code> rows.
        </p>
        <p className="mt-3 text-sm text-honey-muted">
          Each run also sends two Telegram messages to your configured admin chat (<code className="rounded bg-bg px-1">
            TELEGRAM_BOT_TOKEN
          </code>{" "}
          + <code className="rounded bg-bg px-1">TELEGRAM_ORDER_CHAT_ID</code> or{" "}
          <code className="rounded bg-bg px-1">ADMIN_TELEGRAM_USER_ID</code>) with the same format and inline buttons as a
          real purchase — use this to verify a new bot token after deploy.
        </p>
      </div>

      <div className="rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
        <label className="text-sm font-medium text-honey-text">Demo seed key (production)</label>
        <input
          type="password"
          className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Leave empty in local dev, or paste Vercel CUSTOMER_DEMO_SEED_KEY"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => void run()}
          className="mt-4 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Working…" : "Create demo orders & tickets"}
        </button>
      </div>

      {message && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-honey-text">
          {message}
        </p>
      )}
      {detail && (
        <pre className="whitespace-pre-wrap rounded-xl border border-honey-border bg-bg/80 p-4 font-mono text-xs text-honey-muted">
          {detail}
        </pre>
      )}

      <p className="text-sm">
        <Link href="/order-history" className="text-primary underline">
          My orders
        </Link>
        {" · "}
        <a href={getSupportTelegramUrl()} className="text-primary underline" target="_blank" rel="noopener noreferrer">
          Telegram support
        </a>
        {" · "}
        <Link href="/account/orders" className="text-primary underline">
          Order history (paginated)
        </Link>
      </p>
    </div>
  );
}
