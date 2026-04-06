"use client";

import { composeSlotCustomerLocation } from "@/components/admin/ParcelMachinesSection";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { adminOrderPaymentLabel, formatPrice } from "@/lib/helpers";
import { LOCKER_PROVIDER_OPTIONS } from "@/lib/parcel-locker";
import type { Order, ParcelMachineSlot, Product } from "@/types";
import type { ShopCurrency } from "@/lib/currency";
import clsx from "clsx";
import { RainbowHeading } from "@/components/BrandHoneyWellTitle";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

export type ApproveIssueLockerBody = {
  locker_provider?: string | null;
  locker_location_text: string;
  locker_passcode: string;
};

type OrderRow = Order & { product?: Product | null };

type BulkClearQueueKind = "payment_pending" | "booking";

function isBookingRequest(o: OrderRow): boolean {
  return o.status === "pre_ordered" && o.payment_method === "booking";
}

export function PendingApprovalQueue({
  orders,
  shopCurrency,
  onApproved,
  onRejected,
  onBookingAccepted,
  onBookingRejected,
  onRefresh,
}: {
  orders: OrderRow[];
  shopCurrency: ShopCurrency;
  onApproved: (id: string, issueLocker?: ApproveIssueLockerBody) => Promise<void>;
  onRejected: (id: string, reason: string) => Promise<void>;
  onBookingAccepted: (id: string) => Promise<void>;
  onBookingRejected: (id: string, reason: string) => Promise<void>;
  onRefresh?: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bookingConfirmId, setBookingConfirmId] = useState<string | null>(null);
  const [bookingRejectId, setBookingRejectId] = useState<string | null>(null);
  const [bookingRejectReason, setBookingRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockerProvider, setLockerProvider] = useState("primary");
  const [lockerLocation, setLockerLocation] = useState("");
  const [lockerPasscode, setLockerPasscode] = useState("");
  const [parcelSlots, setParcelSlots] = useState<ParcelMachineSlot[]>([]);
  const [parcelSlotsLoading, setParcelSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [approveParcelError, setApproveParcelError] = useState<string | null>(null);
  const [bulkClearKind, setBulkClearKind] = useState<BulkClearQueueKind | null>(null);
  const [bulkClearReason, setBulkClearReason] = useState("");
  const [bulkToast, setBulkToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const pending = orders
    .filter((o) => o.status === "payment_pending")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const bookings = orders.filter(isBookingRequest).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const confirmOrder = pending.find((o) => o.id === confirmId);
  const rejectOrder = pending.find((o) => o.id === rejectId);
  const confirmBooking = bookings.find((o) => o.id === bookingConfirmId);
  const rejectBooking = bookings.find((o) => o.id === bookingRejectId);

  const needsParcelLockerOnApprove =
    Boolean(confirmOrder) &&
    confirmOrder!.fulfillment_type === "dead_drop" &&
    !confirmOrder!.dead_drop_id;

  useEffect(() => {
    if (!confirmId || !confirmOrder) return;
    if (confirmOrder.fulfillment_type !== "dead_drop" || confirmOrder.dead_drop_id) {
      setParcelSlots([]);
      setSelectedSlotId("");
      setLockerProvider("primary");
      setLockerLocation("");
      setLockerPasscode("");
      setApproveParcelError(null);
      return;
    }
    setLockerProvider("primary");
    setLockerLocation("");
    setLockerPasscode("");
    setSelectedSlotId("");
    setApproveParcelError(null);
    setParcelSlotsLoading(true);
    void fetch("/api/admin/parcel-machine-slots", { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { slots?: ParcelMachineSlot[] };
        if (res.ok) setParcelSlots(data.slots ?? []);
        else setParcelSlots([]);
      })
      .catch(() => setParcelSlots([]))
      .finally(() => setParcelSlotsLoading(false));
  }, [confirmId, confirmOrder]);

  const handleApprove = useCallback(async () => {
    if (!confirmId) return;
    setApproveParcelError(null);
    if (needsParcelLockerOnApprove) {
      const loc = lockerLocation.trim();
      const code = lockerPasscode.trim();
      if (loc.length < 3 || code.length < 2) {
        setApproveParcelError("Enter location details and locker passcode (pick a saved slot or type a custom location).");
        return;
      }
    }
    setBusy(true);
    try {
      if (needsParcelLockerOnApprove) {
        await onApproved(confirmId, {
          locker_provider: lockerProvider.trim() || null,
          locker_location_text: lockerLocation.trim(),
          locker_passcode: lockerPasscode.trim(),
        });
      } else {
        await onApproved(confirmId);
      }
      setConfirmId(null);
    } catch {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setBusy(false);
    }
  }, [
    confirmId,
    needsParcelLockerOnApprove,
    lockerLocation,
    lockerPasscode,
    lockerProvider,
    onApproved,
  ]);

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

  const handleBookingAccept = useCallback(async () => {
    if (!bookingConfirmId) return;
    setBusy(true);
    try {
      await onBookingAccepted(bookingConfirmId);
      setBookingConfirmId(null);
    } catch {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setBusy(false);
    }
  }, [bookingConfirmId, onBookingAccepted]);

  const handleBookingReject = useCallback(async () => {
    if (!bookingRejectId) return;
    setBusy(true);
    try {
      await onBookingRejected(bookingRejectId, bookingRejectReason.trim());
      setBookingRejectId(null);
      setBookingRejectReason("");
    } catch {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setBusy(false);
    }
  }, [bookingRejectId, bookingRejectReason, onBookingRejected]);

  const submitBulkClear = useCallback(async () => {
    if (!bulkClearKind) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/orders/clear-queue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: bulkClearKind, reason: bulkClearReason.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; cleared?: number };
      if (!res.ok) {
        setBulkToast({ msg: data.error ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, ok: false });
        window.setTimeout(() => setBulkToast(null), 4000);
        return;
      }
      const n = typeof data.cleared === "number" ? data.cleared : 0;
      setBulkToast({
        msg: n === 0 ? "No orders in that queue anymore." : `Cancelled ${n} order(s) — customers notified ✓`,
        ok: true,
      });
      window.setTimeout(() => setBulkToast(null), 4000);
      setBulkClearKind(null);
      setBulkClearReason("");
      onRefresh?.();
    } catch {
      setBulkToast({ msg: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, ok: false });
      window.setTimeout(() => setBulkToast(null), 4000);
    } finally {
      setBusy(false);
    }
  }, [bulkClearKind, bulkClearReason, onRefresh]);

  if (pending.length === 0 && bookings.length === 0) return null;

  function orderCard(o: OrderRow, variant: "payment" | "booking") {
    return (
      <li
        key={`${variant}-${o.id}`}
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
            {variant === "payment" && (o as Order & { payment_reference_code?: string | null }).payment_reference_code && (
              <p className="font-mono text-[11px] text-honey-text">
                Ref: {(o as Order & { payment_reference_code?: string }).payment_reference_code}
              </p>
            )}
            {variant === "booking" && (
              <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300">Parcel locker checkout was off</p>
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
          <p className="text-xs text-honey-muted">{adminOrderPaymentLabel(o.payment_method)}</p>
          <p className="text-xs text-honey-muted">{o.user_type === "team_member" ? "VIP" : "Guest"}</p>
        </div>
        <div className="flex w-fit self-center shrink-0 flex-col gap-2 sm:w-36 sm:self-auto">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              variant === "payment" ? setConfirmId(o.id) : setBookingConfirmId(o.id)
            }
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {variant === "payment" ? "Approve" : "Accept booking"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (variant === "payment") {
                setRejectId(o.id);
                setRejectReason("");
              } else {
                setBookingRejectId(o.id);
                setBookingRejectReason("");
              }
            }}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </li>
    );
  }

  return (
    <>
      {bulkToast && (
        <div
          className={clsx(
            "fixed right-4 top-4 z-[60] rounded-xl px-5 py-3 text-sm font-semibold shadow-xl",
            bulkToast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          )}
        >
          {bulkToast.msg}
        </div>
      )}
      {pending.length > 0 && (
        <div className="mb-8 rounded-2xl border-2 border-amber-500/60 bg-amber-500/5 p-4 dark:border-amber-400/50">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xl" aria-hidden>
              ⏳
            </span>
            <h2 className="font-display text-lg font-semibold text-amber-800 dark:text-amber-300">Pending payment</h2>
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">{pending.length}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBulkClearKind("payment_pending");
                setBulkClearReason("");
              }}
              className="ml-auto rounded-lg border border-red-600/80 bg-red-600/10 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-600/20 disabled:opacity-50 dark:text-red-300"
            >
              Cancel all ({pending.length})
            </button>
            <p className="w-full text-xs text-honey-muted">
              Approve after you verify payment. Stock is deducted when you confirm. Oldest first.
            </p>
          </div>
          <ul className="space-y-3">{pending.map((o) => orderCard(o, "payment"))}</ul>
        </div>
      )}

      {bookings.length > 0 && (
        <div className="mb-8 rounded-2xl border-2 border-sky-500/60 bg-sky-500/5 p-4 dark:border-sky-400/40">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xl" aria-hidden>
              📋
            </span>
            <h2 className="font-display text-lg font-semibold text-sky-900 dark:text-sky-200">Booking requests</h2>
            <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-bold text-white">{bookings.length}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBulkClearKind("booking");
                setBulkClearReason("");
              }}
              className="ml-auto rounded-lg border border-red-600/80 bg-red-600/10 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-600/20 disabled:opacity-50 dark:text-red-300"
            >
              Decline all ({bookings.length})
            </button>
            <p className="w-full text-xs text-honey-muted">
              Customers submitted these while parcel locker checkout was off — no payment yet. Accept to confirm the order
              (then arrange payment / pickup), or reject with an optional reason.
            </p>
          </div>
          <ul className="space-y-3">{bookings.map((o) => orderCard(o, "booking"))}</ul>
        </div>
      )}

      {bulkClearKind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <RainbowHeading
              as="h3"
              text={bulkClearKind === "payment_pending" ? "CANCEL ALL PENDING PAYMENTS?" : "DECLINE ALL BOOKINGS?"}
              className="text-lg font-display tracking-[0.12em]"
            />
            <p className="mt-2 text-sm text-honey-muted">
              {bulkClearKind === "payment_pending" ? (
                <>
                  This will cancel <strong className="text-honey-text">{pending.length}</strong> order(s) with status{" "}
                  <strong className="text-honey-text">payment pending</strong>. Customers get a push notification. Where
                  checkout already reduced stock (non-deferred orders), inventory is restored — same rules as cancelling those
                  rows from the order table.
                </>
              ) : (
                <>
                  This will decline <strong className="text-honey-text">{bookings.length}</strong> booking request(s). No
                  stock was held for these. Customers get a push notification.
                </>
              )}
            </p>
            <label className="mt-4 block text-xs font-semibold text-honey-muted">Reason (optional, sent to customers)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              rows={3}
              value={bulkClearReason}
              onChange={(e) => setBulkClearReason(e.target.value)}
              placeholder="Optional message shown in the notification."
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-honey-border px-4 py-2 text-sm"
                disabled={busy}
                onClick={() => {
                  setBulkClearKind(null);
                  setBulkClearReason("");
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => void submitBulkClear()}
              >
                {busy ? "…" : bulkClearKind === "payment_pending" ? "Cancel all" : "Decline all"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <RainbowHeading
              as="h3"
              text="APPROVE PAYMENT?"
              className="text-lg font-display tracking-[0.12em]"
            />
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
              from stock
              {needsParcelLockerOnApprove ? (
                <> and assign the parcel machine below (customer gets location + code immediately).</>
              ) : (
                <> and move the order forward.</>
              )}
            </p>
            {needsParcelLockerOnApprove && (
              <div className="mt-4 space-y-3 rounded-xl border border-honey-border bg-bg/50 p-3">
                <p className="text-xs font-semibold text-honey-text">Parcel machine &amp; code</p>
                <label className="block text-xs font-semibold text-honey-muted">Saved slot (optional)</label>
                <select
                  className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                  value={selectedSlotId}
                  disabled={parcelSlotsLoading}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedSlotId(v);
                    if (!v) return;
                    const slot = parcelSlots.find((s) => s.id === v);
                    if (slot) setLockerLocation(composeSlotCustomerLocation(slot));
                  }}
                >
                  <option value="">{parcelSlotsLoading ? "Loading slots…" : "— Custom location only —"}</option>
                  {parcelSlots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.machine_name} · {s.slot_label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-honey-muted">
                  Manage saved slots under <strong className="text-honey-text">Parcel machines</strong> in the sidebar.
                </p>
                <label className="block text-xs font-semibold text-honey-muted">Network</label>
                <select
                  className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                  value={lockerProvider}
                  onChange={(e) => setLockerProvider(e.target.value)}
                >
                  {LOCKER_PROVIDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-semibold text-honey-muted">Location / machine details</label>
                <textarea
                  className="mt-1 min-h-[88px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                  placeholder="Machine name, address, map link…"
                  value={lockerLocation}
                  onChange={(e) => setLockerLocation(e.target.value)}
                />
                <label className="block text-xs font-semibold text-honey-muted">Locker passcode</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm font-mono"
                  autoComplete="off"
                  value={lockerPasscode}
                  onChange={(e) => setLockerPasscode(e.target.value)}
                />
                {approveParcelError ? <p className="text-xs font-medium text-red-600">{approveParcelError}</p> : null}
              </div>
            )}
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
                className="rounded-lg border-2 border-[#15803d] bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white shadow-[3px_3px_0_#14532d] transition hover:bg-[#4ade80] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_#14532d] active:translate-x-px active:shadow-[1px_1px_0_#14532d] disabled:opacity-50 disabled:translate-x-0 disabled:shadow-none"
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
            <RainbowHeading as="h3" text="REJECT ORDER" className="text-lg font-display tracking-[0.12em]" />
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

      {confirmBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <RainbowHeading
              as="h3"
              text="ACCEPT BOOKING?"
              className="text-lg font-display tracking-[0.12em]"
            />
            <p className="mt-2 text-sm text-honey-muted">
              Confirm <span className="font-mono text-primary">{confirmBooking.order_number ?? confirmBooking.id}</span> for{" "}
              <span className="font-semibold text-honey-text">
                {confirmBooking.quantity}× {confirmBooking.product?.name ?? "item"}
              </span>
              . The order moves to <strong className="text-honey-text">confirmed</strong>. No payment was taken yet — follow
              up with the customer for payment and parcel locker when ready.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-honey-border px-4 py-2 text-sm"
                onClick={() => setBookingConfirmId(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg border-2 border-sky-800 bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[3px_3px_0_#0c4a6e] transition hover:bg-sky-400 disabled:opacity-50"
                onClick={() => void handleBookingAccept()}
                disabled={busy}
              >
                {busy ? "…" : "Accept booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-xl dark:bg-surface-dark">
            <RainbowHeading as="h3" text="REJECT BOOKING" className="text-lg font-display tracking-[0.12em]" />
            <p className="mt-1 font-mono text-xs text-primary">{rejectBooking.order_number ?? rejectBooking.id}</p>
            <label className="mt-3 block text-xs font-semibold text-honey-muted">Reason (optional)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              rows={3}
              value={bookingRejectReason}
              onChange={(e) => setBookingRejectReason(e.target.value)}
              placeholder="Shown to the customer in their notification."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-honey-border px-4 py-2 text-sm"
                onClick={() => {
                  setBookingRejectId(null);
                  setBookingRejectReason("");
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => void handleBookingReject()}
                disabled={busy}
              >
                {busy ? "…" : "Confirm rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
