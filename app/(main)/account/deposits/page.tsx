"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DepositRow = {
  id: string;
  created_at: string;
  amount_bees: number;
  amount_huf: number;
  payment_method: string | null;
  reference: string | null;
};

export default function AccountDepositsPage() {
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [balance, setBalance] = useState(0);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [loading, setLoading] = useState(true);

  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const load = useCallback(async () => {
    const t = getOrCreateCustomerToken();
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/account/deposits?page=${page}`, {
        headers: { "x-customer-token": t },
      });
      const data = await res.json();
      if (res.ok) {
        setDeposits(data.deposits ?? []);
        setTotal(data.total ?? 0);
        setBalance(data.current_balance_bees ?? 0);
        setTotalDeposited(data.total_deposited_bees ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function downloadCsv() {
    const t = getOrCreateCustomerToken();
    if (!t) return;
    fetch("/api/account/deposits?format=csv", { headers: { "x-customer-token": t } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "deposits.csv";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-honey-text">Bees deposits</h1>
          <p className="mt-2 text-honey-muted">
            Balance: <span className="font-mono text-honey-text">{balance.toFixed(2)}</span> Bees · Total
            deposited: <span className="font-mono text-honey-text">{totalDeposited.toFixed(2)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="rounded-full border border-honey-border px-4 py-2 text-sm font-medium text-honey-text hover:bg-honey-border/30"
        >
          Download CSV
        </button>
      </div>

      {loading ? (
        <p className="text-honey-muted">Loading…</p>
      ) : deposits.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-honey-border py-16 text-center text-honey-muted">
          No deposit purchases yet.{" "}
          <Link href="/bees/buy" className="text-primary underline">
            Buy Bees
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-honey-border">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Bees</th>
                <th className="p-3">HUF</th>
                <th className="p-3">Method</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} className="border-b border-honey-border/60">
                  <td className="p-3">{new Date(d.created_at).toLocaleString("en-GB")}</td>
                  <td className="p-3 font-mono">{Number(d.amount_bees).toFixed(4)}</td>
                  <td className="p-3">{Number(d.amount_huf).toFixed(0)}</td>
                  <td className="p-3">{d.payment_method ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
