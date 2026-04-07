"use client";

import { OrderCard } from "@/components/OrderCard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getOrCreateCustomerToken, setCustomerToken } from "@/lib/customer-token";
import { syncCustomerTokenFromUrl } from "@/lib/sync-customer-token-from-url";
import type { OrderWithProduct } from "@/types";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function OrderHistoryContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const ctParamRaw = searchParams.get("ct")?.trim() ?? "";
  const queryToken = ctParamRaw.length >= 8 ? ctParamRaw : "";
  const currentToken = useCallback(() => {
    if (orderId) return getOrCreateCustomerToken();
    if (queryToken) return setCustomerToken(queryToken);
    return getOrCreateCustomerToken();
  }, [orderId, queryToken]);
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [settings, setSettings] = useState({
    shop_address: "",
    google_maps_url: "",
    apple_maps_url: "",
    revolut_payment_link: "",
  });
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { state: pushState, subscribe: subscribePush } = usePushNotifications();

  const loadOrders = useCallback(async (t: string, opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      if (!t || t.trim().length < 8) {
        // No valid token — show empty state, don't call API
        setOrders([]);
        return;
      }
      const res = await fetch("/api/orders/mine", {
        headers: { "x-customer-token": t },
      });
      const data = await res.json();
      if (res.ok) setOrders(data.orders ?? []);
    } catch {
      // silently fail — user will see "No orders yet"
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
        await syncCustomerTokenFromUrl(orderId, queryToken);
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

  // Legacy checkout used ?revolut=1 to open a modal; strip it so bookmarks stay clean.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("revolut")) return;
    url.searchParams.delete("revolut");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl text-honey-text">My orders</h1>
      </div>
      {pushState !== "unsupported" && pushState !== "subscribed" && (
        <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="text-honey-text">Enable push notifications for order updates and support replies.</span>
          <button
            type="button"
            onClick={() => void subscribePush()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white"
          >
            Enable notifications
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-honey-muted">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-honey-border py-16 text-center text-honey-muted">
          No orders yet.{" "}
          <a href="/shop" className="text-primary underline">Browse the shop</a>{" "}
          to place your first order.
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

      <p className="text-center text-sm text-honey-muted">
        Want a paginated view?{" "}
        <a href="/account/orders" className="text-primary underline">
          View full order history
        </a>
      </p>
    </div>
  );
}
