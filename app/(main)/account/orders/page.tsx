"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { useShopCurrency } from "@/components/ShopCurrencyProvider";
import { ORDER_STATUS_LABELS } from "@/lib/helpers";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type OrderRow = {
  id: string;
  order_number?: string | null;
  status: string;
  total_price: number;
  created_at: string;
  product?: { name?: string; image_url?: string | null } | null;
};

export default function AccountOrdersPage() {
  const { formatPrice } = useShopCurrency();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const load = useCallback(async () => {
    const t = getOrCreateCustomerToken();
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/account/orders?page=${page}`, {
        headers: { "x-customer-token": t },
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders ?? []);
        setTotal(data.total ?? 0);
        setTotalSpent(data.total_spent_huf ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl text-honey-text">Order history</h1>
        <p className="mt-2 text-honey-muted">
          Completed orders spend:{" "}
          <span className="font-mono text-honey-text">{formatPrice(Math.round(totalSpent))}</span>
        </p>
        <p className="mt-1 text-xs text-honey-muted">
          Only delivered and picked up orders are counted.
        </p>
        <p className="mt-1 text-sm text-honey-muted">
          You can also use the classic{" "}
          <Link href="/order-history" className="text-primary underline">
            My orders
          </Link>{" "}
          page.
        </p>
      </div>

      {loading ? (
        <p className="text-honey-muted">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-honey-border py-16 text-center text-honey-muted">
          No orders yet.
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark"
            >
              <div>
                <p className="font-mono text-sm text-primary">{o.order_number ?? o.id.slice(0, 8)}</p>
                <p className="font-medium text-honey-text">{o.product?.name ?? "Product"}</p>
                <p className="text-sm text-honey-muted">{new Date(o.created_at).toLocaleString("en-GB")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-honey-muted">{ORDER_STATUS_LABELS[o.status] ?? o.status}</p>
                <p className="font-semibold text-honey-text">{formatPrice(Number(o.total_price))}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-honey-border px-4 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-honey-muted">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-full border border-honey-border px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
