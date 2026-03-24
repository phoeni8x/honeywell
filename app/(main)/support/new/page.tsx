"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function SupportNewForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
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
          order_id: orderId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        return;
      }
      const num = data.ticket?.ticket_number as string | undefined;
      if (num) router.push(`/support/${encodeURIComponent(num)}`);
      else router.push("/support");
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
        <p className="mt-2 text-honey-muted">We typically reply within one business day.</p>
      </div>
      <Suspense fallback={<p className="text-honey-muted">Loading…</p>}>
        <SupportNewForm />
      </Suspense>
    </div>
  );
}
