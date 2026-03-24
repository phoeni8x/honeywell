"use client";

import { OrderCard } from "@/components/OrderCard";
import { RevolutModal } from "@/components/RevolutModal";
import { getOrCreateCustomerToken, setCustomerToken } from "@/lib/customer-token";
import type { OrderWithProduct } from "@/types";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function OrderHistoryContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const ctParamRaw = searchParams.get("ct")?.trim() ?? "";
  const queryToken = ctParamRaw.length >= 8 ? ctParamRaw : "";
  const currentToken = useCallback(
    () => (queryToken ? setCustomerToken(queryToken) : getOrCreateCustomerToken()),
    [queryToken]
  );
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [settings, setSettings] = useState({
    shop_address: "",
    google_maps_url: "",
    apple_maps_url: "",
    revolut_payment_link: "",
  });
  const [loading, setLoading] = useState(true);
  const [revolutOpen, setRevolutOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async (t: string, opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const res = await fetch("/api/orders/mine", {
        headers: { "x-customer-token": t },
      });
      const data = await res.json();
      if (res.ok) setOrders(data.orders ?? []);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  /**
   * When `orderId` is in the URL, adopt that order's customer_token first so localStorage
   * matches (cookie alone was not enough — getOrCreateCustomerToken prefers storage).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (queryToken) {
          setCustomerToken(queryToken);
        }
        if (orderId && !queryToken) {
          const r = await fetch("/api/orders/adopt-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderId }),
          });
          const body = (await r.json().catch(() => ({}))) as { customer_token?: string };
          if (r.ok && body.customer_token) {
            setCustomerToken(body.customer_token);
          }
        }
        if (cancelled) return;
        const t = getOrCreateCustomerToken();
        await loadOrders(t, { quiet: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, queryToken, loadOrders]);

  // Remove token from URL after syncing to storage/cookie.
  useEffect(() => {
    if (!queryToken || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("ct")) return;
    url.searchParams.delete("ct");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [queryToken]);

  /** Refetch when returning to the tab (e.g. after admin marks delivered). */
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void loadOrders(currentToken(), { quiet: true });
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadOrders, currentToken]);

  // After checkout redirect (?orderId=) — retry briefly so the new row appears even if the first request races the insert.
  useEffect(() => {
    if (!orderId) return;
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      void loadOrders(currentToken(), { quiet: true });
      if (n >= 8) clearInterval(iv);
    }, 1500);
    return () => clearInterval(iv);
  }, [orderId, loadOrders, currentToken]);

  /** While any order is still in progress, refresh every 15s so completed/delivered states appear. */
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    const terminal = new Set([
      "delivered",
      "picked_up",
      "cancelled",
      "payment_expired",
    ]);
    const hasOpen = orders.some((o) => !terminal.has(o.status));
    if (!hasOpen || orders.length === 0) return;
    pollRef.current = setInterval(() => {
      void loadOrders(currentToken(), { quiet: true });
    }, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orders, loadOrders, currentToken]);

  /** Scroll to the order highlighted in the URL. */
  useEffect(() => {
    const id = searchParams.get("orderId");
    if (!id || orders.length === 0) return;
    const found = orders.some((o) => o.id === id);
    if (!found) return;
    const t = window.setTimeout(() => {
      document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [orders, searchParams]);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.shop_address !== undefined)
          setSettings({
            shop_address: d.shop_address,
            google_maps_url: d.google_maps_url,
            apple_maps_url: d.apple_maps_url,
            revolut_payment_link: d.revolut_payment_link,
          });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get("revolut") === "1") {
      setRevolutOpen(true);
    }
  }, [searchParams]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl text-honey-text">My orders</h1>
      </div>

      {loading ? (
        <p className="text-honey-muted">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-honey-border py-16 text-center text-honey-muted">
          No orders yet. Browse the shop to place your first order.
        </p>
      ) : (
        <div className="space-y-6">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              shopAddress={settings.shop_address}
              mapsUrl={settings.google_maps_url}
              appleMapsUrl={settings.apple_maps_url}
              revolutPaymentLink={settings.revolut_payment_link}
              customerToken={currentToken()}
              onPhotoUploaded={() => void loadOrders(currentToken(), { quiet: true })}
            />
          ))}
        </div>
      )}

      <RevolutModal
        open={revolutOpen}
        onClose={() => setRevolutOpen(false)}
        revolutUrl={settings.revolut_payment_link}
      />
    </div>
  );
}
