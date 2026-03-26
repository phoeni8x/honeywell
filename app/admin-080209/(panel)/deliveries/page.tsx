"use client";

import { truncateToken } from "@/lib/helpers";
import { useAdminPushNotifications } from "@/hooks/useAdminPushNotifications";
import { createClient } from "@/lib/supabase/client";
import type { Order, Product } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export default function AdminDeliveriesPage() {
  const [orders, setOrders] = useState<(Order & { product?: Product | null })[]>([]);
  const [sharingBanner, setSharingBanner] = useState(false);
  const [deliveryEta, setDeliveryEta] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { state: pushState, subscribe: subscribePush } = useAdminPushNotifications();

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 2800);
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*, products(*)")
      .eq("fulfillment_type", "delivery")
      .in("status", ["confirmed", "out_for_delivery"])
      .order("created_at", { ascending: false });
    const mapped =
      (data as Record<string, unknown>[] | null)?.map((row) => {
        const { products: prod, ...rest } = row;
        return { ...(rest as unknown as Order), product: prod as Product | null };
      }) ?? [];
    setOrders(mapped);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markOut(id: string) {
    setBusyKey(`out-${id}`);
    const res = await fetch("/api/admin/orders/delivery-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order_id: id, status: "out_for_delivery" }),
    });
    if (!res.ok) {
      showToast("Could not mark out for delivery.", false);
      setBusyKey(null);
      return;
    }
    await fetch("/api/admin/admin-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_sharing: true }),
    });
    setSharingBanner(true);
    startSharing();
    await load();
    showToast("Marked out for delivery and customer notified.");
    setBusyKey(null);
  }

  async function markDelivered(id: string) {
    setBusyKey(`delivered-${id}`);
    const res = await fetch("/api/admin/orders/delivery-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order_id: id, status: "delivered" }),
    });
    const data = (await res.json().catch(() => ({}))) as { points_earned?: number };
    if (!res.ok) {
      showToast("Could not mark delivered.", false);
      setBusyKey(null);
      return;
    }
    await fetch("/api/admin/admin-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_sharing: false }),
    });
    stopSharing();
    await load();
    const earned = Number(data.points_earned ?? 0);
    showToast(earned > 0 ? `Marked delivered. +${earned} pts awarded.` : "Marked delivered.");
    setBusyKey(null);
  }

  async function notifyDelivery(orderId: string, kind: "ten_min" | "delay" | "arrived" | "custom_eta") {
    const key = `${kind}-${orderId}`;
    setBusyKey(key);
    const minutes = Number(deliveryEta[orderId] ?? 0);
    const res = await fetch("/api/admin/orders/delivery-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order_id: orderId, kind, ...(kind === "custom_eta" ? { minutes } : {}) }),
    });
    if (!res.ok) {
      showToast("Could not send delivery update.", false);
      setBusyKey(null);
      return;
    }
    showToast("Customer notified.");
    setBusyKey(null);
  }

  function startSharing() {
    stopSharing();
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await fetch("/api/admin/admin-location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              is_sharing: true,
            }),
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 12000 }
      );
    }, 15000);
  }

  function stopSharing() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function stopSharingManual() {
    stopSharing();
    await fetch("/api/admin/admin-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_sharing: false }),
    });
    setSharingBanner(false);
  }

  useEffect(() => () => stopSharing(), []);

  const newDelivery = orders.find((o) => o.status === "confirmed");

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-2 text-sm font-semibold shadow-lg ${
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
      <div>
        <h1 className="font-display text-3xl text-honey-text">Deliveries</h1>
        <p className="mt-2 text-sm text-honey-muted">Queue for delivery orders. Mark &quot;Out for delivery&quot; to start GPS sharing.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-honey-border bg-surface p-3 dark:bg-surface-dark">
        {pushState !== "unsupported" && pushState !== "subscribed" && (
          <button
            type="button"
            onClick={() => void subscribePush()}
            className="rounded-full border border-honey-border px-4 py-2 text-xs font-semibold text-honey-text hover:bg-honey-border/30"
          >
            Enable admin push alerts
          </button>
        )}
        {pushState === "subscribed" && (
          <span className="text-xs text-honey-muted">Admin push is enabled for this browser</span>
        )}
      </div>

      {newDelivery && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-honey-text">
          New delivery order — {newDelivery.order_number ?? newDelivery.id.slice(0, 8)}
        </div>
      )}

      {sharingBanner && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-900 dark:text-green-100">
          <span>Your location is being shared with active delivery customers.</span>
          <button type="button" onClick={stopSharingManual} className="rounded-full border border-green-700/40 px-3 py-1 text-xs font-semibold">
            Stop sharing
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-2">Order</th>
              <th className="p-2">Customer</th>
              <th className="p-2">Address</th>
              <th className="p-2">Product</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-honey-border/60 align-top">
                <td className="p-2 font-mono text-xs">{o.order_number ?? o.id.slice(0, 8)}</td>
                <td className="p-2 font-mono text-xs">{truncateToken(o.customer_token)}</td>
                <td className="p-2 max-w-[240px] text-xs">
                  {o.delivery_address}
                  {o.delivery_notes && <span className="block text-honey-muted">Notes: {o.delivery_notes}</span>}
                </td>
                <td className="p-2">{o.product?.name ?? "—"}</td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    {o.status === "confirmed" && (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="text-left text-xs text-primary hover:underline disabled:opacity-50"
                        onClick={() => void markOut(o.id)}
                      >
                        Mark out for delivery
                      </button>
                    )}
                    {o.status === "out_for_delivery" && (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="text-left text-xs text-primary hover:underline disabled:opacity-50"
                        onClick={() => void markDelivered(o.id)}
                      >
                        Mark delivered
                      </button>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="rounded-full border border-honey-border px-2 py-1 text-[11px] text-honey-text disabled:opacity-50"
                        onClick={() => void notifyDelivery(o.id, "ten_min")}
                      >
                        Notify 10 min away
                      </button>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="rounded-full border border-honey-border px-2 py-1 text-[11px] text-honey-text disabled:opacity-50"
                        onClick={() => void notifyDelivery(o.id, "delay")}
                      >
                        Notify slight delay
                      </button>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        className="rounded-full border border-honey-border px-2 py-1 text-[11px] text-honey-text disabled:opacity-50"
                        onClick={() => void notifyDelivery(o.id, "arrived")}
                      >
                        Notify arrived
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={deliveryEta[o.id] ?? ""}
                        onChange={(e) =>
                          setDeliveryEta((prev) => ({ ...prev, [o.id]: e.target.value }))
                        }
                        placeholder="ETA min"
                        className="w-20 rounded-lg border border-honey-border bg-bg px-2 py-1 text-[11px]"
                      />
                      <button
                        type="button"
                        disabled={busyKey !== null || !deliveryEta[o.id]}
                        className="rounded-full border border-primary px-2 py-1 text-[11px] text-primary disabled:opacity-50"
                        onClick={() => void notifyDelivery(o.id, "custom_eta")}
                      >
                        Send ETA
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orders.length === 0 && <p className="text-honey-muted">No active delivery orders.</p>}
    </div>
  );
}
