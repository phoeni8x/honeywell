"use client";

import { OrderCard } from "@/components/OrderCard";
import { RevolutModal } from "@/components/RevolutModal";
import { getOrCreateCustomerToken } from "@/lib/customer-token";
import type { OrderWithProduct } from "@/types";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function OrderHistoryContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [settings, setSettings] = useState({
    shop_address: "",
    google_maps_url: "",
    apple_maps_url: "",
    revolut_payment_link: "",
  });
  const [loading, setLoading] = useState(true);
  const [revolutOpen, setRevolutOpen] = useState(false);

  const loadOrders = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders/mine", {
        headers: { "x-customer-token": t },
      });
      const data = await res.json();
      if (res.ok) setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders(getOrCreateCustomerToken());
  }, [loadOrders]);

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
              customerToken={getOrCreateCustomerToken()}
              onPhotoUploaded={() => loadOrders(getOrCreateCustomerToken())}
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
