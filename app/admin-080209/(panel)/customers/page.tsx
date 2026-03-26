"use client";

import { ORDER_STATUS_LABELS, truncateToken } from "@/lib/helpers";
import { useState } from "react";

type Profile = {
  customer_token: string;
  customer_username: string | null;
  orders: Array<{
    id: string;
    order_number?: string | null;
    status: string;
    total_price: number;
    payment_method?: string | null;
    fulfillment_type?: string | null;
    points_used?: number | null;
    points_earned?: number | null;
    created_at: string;
    products?: { name?: string } | null;
  }>;
  points_wallet: { balance_points: number; lifetime_points: number } | null;
  bees_wallet: { balance_bees: number } | null;
  points_transactions: Array<{
    id: string;
    type: string;
    points: number;
    delta_points: number;
    order_id?: string | null;
    order_number?: string | null;
    order_status?: string | null;
    order_total_huf?: number | null;
    reason_label?: string;
    created_at: string;
  }>;
  bees_deposits: Array<{
    id: string;
    amount_bees: number;
    amount_huf?: number | null;
    payment_method?: string | null;
    reference?: string | null;
    created_at: string;
  }>;
  total_points_earned: number;
  total_bees_deposited: number;
};

export default function AdminCustomersPage() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(query.trim())}`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { profiles?: Profile[] };
      if (res.ok) {
        setProfiles(json.profiles ?? []);
      } else {
        setProfiles([]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-honey-text">Customer lookup</h1>
        <p className="mt-2 text-sm text-honey-muted">
          Search by Telegram username (or token fragment) to view order history, points, bees deposits, and balances.
        </p>
      </div>

      <div className="rounded-2xl border border-honey-border p-4">
        <div className="flex gap-2">
          <input
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Search username (e.g. @ruby) or token..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={loading}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {profiles.length === 0 && !loading && (
        <p className="text-sm text-honey-muted">No matching customers yet.</p>
      )}

      {profiles.map((p) => (
        <div key={p.customer_token} className="space-y-4 rounded-2xl border border-honey-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-honey-text">
                {p.customer_username ? `@${p.customer_username}` : "Unknown username"}
              </p>
              <p className="font-mono text-xs text-honey-muted">{truncateToken(p.customer_token)}</p>
            </div>
            <div className="text-right text-xs text-honey-muted">
              <p>Orders: {p.orders.length}</p>
              <p>Points earned: {p.total_points_earned}</p>
              <p>Bees deposited: {p.total_bees_deposited.toFixed(4)}</p>
              <p>Bees balance: {Number(p.bees_wallet?.balance_bees ?? 0).toFixed(4)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-honey-border/70 p-3">
              <p className="text-xs font-semibold text-honey-muted">Points wallet</p>
              <p className="mt-1 text-sm text-honey-text">
                Balance: <span className="font-mono">{Number(p.points_wallet?.balance_points ?? 0)}</span>
              </p>
              <p className="text-sm text-honey-text">
                Lifetime: <span className="font-mono">{Number(p.points_wallet?.lifetime_points ?? 0)}</span>
              </p>
            </div>
            <div className="rounded-xl border border-honey-border/70 p-3">
              <p className="text-xs font-semibold text-honey-muted">Bees wallet</p>
              <p className="mt-1 text-sm text-honey-text">
                Current balance: <span className="font-mono">{Number(p.bees_wallet?.balance_bees ?? 0).toFixed(4)}</span>
              </p>
              <p className="text-sm text-honey-text">
                Total deposits: <span className="font-mono">{p.total_bees_deposited.toFixed(4)}</span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-honey-border/70">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-honey-border bg-bg/80 text-honey-muted">
                <tr>
                  <th className="p-2">Order</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Points used</th>
                  <th className="p-2">Points earned</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {p.orders.map((o) => (
                  <tr key={o.id} className="border-t border-honey-border/60">
                    <td className="p-2 font-mono">{o.order_number ?? o.id.slice(0, 8)}</td>
                    <td className="p-2">{o.products?.name ?? "—"}</td>
                    <td className="p-2">{ORDER_STATUS_LABELS[o.status] ?? o.status}</td>
                    <td className="p-2">{Number(o.total_price ?? 0)}</td>
                    <td className="p-2">{Number(o.points_used ?? 0)}</td>
                    <td className="p-2">{Number(o.points_earned ?? 0)}</td>
                    <td className="p-2 text-honey-muted">{new Date(o.created_at).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-honey-border/70">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-honey-border bg-bg/80 text-honey-muted">
                <tr>
                  <th className="p-2">Date</th>
                  <th className="p-2">Reason</th>
                  <th className="p-2">Order</th>
                  <th className="p-2">Order status</th>
                  <th className="p-2">Order total (HUF)</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Points delta</th>
                </tr>
              </thead>
              <tbody>
                {p.points_transactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-honey-border/60">
                    <td className="p-2 text-honey-muted">{new Date(tx.created_at).toLocaleString("en-GB")}</td>
                    <td className="p-2">{tx.reason_label ?? tx.type}</td>
                    <td className="p-2 font-mono">{tx.order_number ?? (tx.order_id ? tx.order_id.slice(0, 8) : "—")}</td>
                    <td className="p-2">{tx.order_status ? ORDER_STATUS_LABELS[tx.order_status] ?? tx.order_status : "—"}</td>
                    <td className="p-2">{typeof tx.order_total_huf === "number" ? Number(tx.order_total_huf) : "—"}</td>
                    <td className="p-2">{tx.type}</td>
                    <td
                      className={`p-2 font-mono font-semibold ${
                        tx.delta_points >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {tx.delta_points >= 0 ? `+${tx.delta_points}` : tx.delta_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
