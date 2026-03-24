"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const ORDER_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SupportNewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdRaw = searchParams.get("orderId")?.trim() ?? "";
  const orderId = ORDER_ID_UUID.test(orderIdRaw) ? orderIdRaw : "";
  const subjectFromQuery = searchParams.get("subject") ?? "";

  const [subject, setSubject] = useState(
    subjectFromQuery || (orderId ? `Order issue` : "")
  );
  const [category, setCategory] = useState("other");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const t = getOrCreateCustomerToken();
    if (!t) {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-token": t },
        body: JSON.stringify({
          subject,
          category,
          message,
          ...(orderId ? { order_id: orderId } : {}),
        }),
      });
      const text = await res.text();
      let data: { ticket?: { ticket_number?: string }; error?: string } = {};
      if (text) {
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
          return;
        }
      }
      if (!res.ok) {
        setError(data.error ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        return;
      }
      const num = data.ticket?.ticket_number;
      if (num) router.push(`/support/${encodeURIComponent(num)}`);
      else router.push("/support");
    } catch {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-6">
      {orderId && (
        <p className="rounded-xl border border-honey-border bg-bg/50 px-4 py-3 text-sm text-honey-muted">
          Linked order ID: <span className="font-mono text-honey-text">{orderId}</span>
        </p>
      )}
      <div>
        <label className="text-sm font-medium text-honey-text">Subject</label>
        <input
          className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium text-honey-text">Category</label>
        <select
          className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="order">Order</option>
          <option value="payment">Payment</option>
          <option value="pickup">Pickup</option>
          <option value="product">Product</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-honey-text">Message</label>
        <textarea
          className="mt-1 min-h-[140px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Link href="/support" className="rounded-full border border-honey-border px-5 py-2.5 text-sm font-medium">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Sending…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

export default function SupportNewPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl text-honey-text">New support ticket</h1>
      </div>
      <Suspense fallback={<p className="text-honey-muted">Loading…</p>}>
        <SupportNewForm />
      </Suspense>
    </div>
  );
}
