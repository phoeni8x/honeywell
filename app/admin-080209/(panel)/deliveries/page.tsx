"use client";

import { truncateToken } from "@/lib/helpers";
import { createClient } from "@/lib/supabase/client";
import type { Order, Product } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export default function AdminDeliveriesPage() {
  const [orders, setOrders] = useState<(Order & { product?: Product | null })[]>([]);
  const [sharingBanner, setSharingBanner] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const supabase = createClient();
    await supabase.from("orders").update({ status: "out_for_delivery", updated_at: new Date().toISOString() }).eq("id", id);
    await fetch("/api/admin/admin-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_sharing: true }),
    });
    setSharingBanner(true);
    startSharing();
    load();
  }

  async function markDelivered(id: string) {
    const supabase = createClient();
    await supabase.from("orders").update({ status: "delivered", updated_at: new Date().toISOString() }).eq("id", id);
    await fetch("/api/admin/admin-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_sharing: false }),
    });
    stopSharing();
    load();
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
      <div>
        <h1 className="font-display text-3xl text-honey-text">Deliveries</h1>
        <p className="mt-2 text-sm text-honey-muted">Queue for delivery orders. Mark &quot;Out for delivery&quot; to start GPS sharing.</p>
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
                      <button type="button" className="text-left text-xs text-primary hover:underline" onClick={() => markOut(o.id)}>
                        Mark out for delivery
                      </button>
                    )}
                    {o.status === "out_for_delivery" && (
                      <button
                        type="button"
                        className="text-left text-xs text-primary hover:underline"
                        onClick={() => markDelivered(o.id)}
                      >
                        Mark delivered
                      </button>
                    )}
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
