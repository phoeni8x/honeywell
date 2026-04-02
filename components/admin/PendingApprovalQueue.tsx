"use client";

import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { formatPrice } from "@/lib/helpers";
import type { Order, Product } from "@/types";
import type { ShopCurrency } from "@/lib/currency";
import clsx from "clsx";
import Image from "next/image";
import { useCallback, useState } from "react";

type OrderRow = Order & { product?: Product | null };

export function PendingApprovalQueue({
  orders,
  shopCurrency,
  onApproved,
  onRejected,
}: {
  orders: OrderRow[];
  shopCurrency: ShopCurrency;
  onApproved: (id: string) => Promise<void>;
  onRejected: (id: string, reason: string) => Promise<void>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = orders
    .filter((o) => o.status === "payment_pending")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const confirmOrder = pending.find((o) => o.id === confirmId);
  const rejectOrder = pending.find((o) => o.id === rejectId);

  const handleApprove = useCallback(async () => {
    if (!confirmId) return;
    setBusy(true);
    try {
      await onApproved(confirmId);
      setConfirmId(null);
    } catch {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setBusy(false);
    }
  }, [confirmId, onApproved]);

  const handleReject = useCallback(async () => {
    if (!rejectId) return;
    setBusy(true);
    try {
      await onRejected(rejectId, rejectReason.trim());
      setRejectId(null);
      setRejectReason("");
    } catch {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setBusy(false);
    }
  }, [rejectId, rejectReason, onRejected]);

  if (pending.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border-2 border-amber-500/60 bg-amber-500/5 p-4 dark:border-amber-400/50">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xl" aria-hidden>
          ⏳
        </span>
        <h2 className="font-display text-lg font-semibold text-amber-800 dark:text-amber-300">Pending approval</h2>
        <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">{pending.length}</span>
        <p className="w-full text-xs text-honey-muted">
          Stock is deducted only after you approve payment (Part 7). Oldest first.
        </p>
      </div>

      <ul className="space-y-3">
        {pending.map((o) => (
          <li
            key={o.id}
            className="flex flex-col gap-3 rounded-xl border border-honey-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-surface-dark"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-honey-border bg-bg">
                {o.product?.image_url ? (
                  <Image src={o.product.image_url} alt="" fill className="object-cover" sizes="48px" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-honey-muted">—</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-primary">{o.order_number ?? o.id.slice(0, 8)}</p>
                {(o as Order & { payment_reference_code?: string | null }).payment_reference_code && (
                  <p className="font-mono text-[11px] text-honey-text">
                    Ref: {(o as Order & { payment_reference_code?: string }).payment_reference_code}
                  </p>
                )}
                <p className="text-xs text-honey-muted">
                  {new Date(o.created_at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {o.customer_username ? (
                  <p className="text-sm font-semibold text-honey-text">@{o.customer_username}</p>
                ) : (
                  <p className="text-xs italic text-honey-muted">Guest / unverified</p>
                )}
                <p className="truncate text-sm font-medium text-honey-text">{o.product?.name ?? "—"}</p>
                <p className="text-xs text-honey-muted">Qty {o.quantity}</p>
              </div>
            </div>
            <div className="text-center sm:px-4">
              <p className="font-semibold text-honey-text">{formatPrice(Number(o.total_price), shopCurrency)}</p>
              <p className="text-xs text-honey-muted">
                {o.payment_method === "revolut"
                  ? "Bank transfer"
                  : o.payment_method === "crypto"
                    ? "Crypto"
                    : o.payment_method}
              </p>
              <p className="text-xs text-honey-muted">{o.user_type === "team_member" ? "VIP" : "Guest"}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:w-36">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmId(o.id)}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRejectId(o.id);
                  setRejectReason("");
                }}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>

      {confirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <h3 className="font-display text-lg text-honey-text">Approve payment?</h3>
            <p className="mt-2 text-sm text-honey-muted">
              Confirm approval for <span className="font-mono text-primary">{confirmOrder.order_number ?? confirmOrder.id}</span>
              {(confirmOrder as Order & { payment_reference_code?: string | null }).payment_reference_code ? (
                <>
                  {" "}
                  · pay ref{" "}
                  <span className="font-mono font-semibold text-honey-text">
                    {(confirmOrder as Order & { payment_reference_code?: string }).payment_reference_code}
                  </span>
                </>
              ) : null}
              . This will deduct{" "}
              <span className="font-semibold text-honey-text">
                {confirmOrder.quantity}× {confirmOrder.product?.name ?? "item"}
              </span>{" "}
              from stock and move the order forward.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className={clsx("rounded-lg border border-honey-border px-4 py-2 text-sm")}
                onClick={() => setConfirmId(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                onClick={() => void handleApprove()}
                disabled={busy}
              >
                {busy ? "…" : "Confirm approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <h3 className="font-display text-lg text-honey-text">Reject order</h3>
            <p className="mt-1 font-mono text-xs text-primary">{rejectOrder.order_number ?? rejectOrder.id}</p>
            <label className="mt-3 block text-xs font-semibold text-honey-muted">Reason (optional)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Shown to the customer in their notification."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-honey-border px-4 py-2 text-sm"
                onClick={() => {
                  setRejectId(null);
                  setRejectReason("");
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => void handleReject()}
                disabled={busy}
              >
                {busy ? "…" : "Confirm rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
