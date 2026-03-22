"use client";

import { ConfettiBurst } from "@/components/ConfettiBurst";
import { HoneycombBg } from "@/components/HoneycombBg";
import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { LS_USER_TYPE } from "@/lib/constants";
import { calculateETA } from "@/lib/eta";
import { getDistanceKm } from "@/lib/location";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const DeliveryTrackMap = dynamic(() => import("@/components/DeliveryTrackMap").then((m) => m.DeliveryTrackMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[240px] items-center justify-center">
      <div className="hex-spinner" aria-hidden />
      <span className="sr-only">Loading map…</span>
    </div>
  ),
});

const BeeFlyer = dynamic(() => import("@/components/BeeFlyer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[200px] flex-1 items-center justify-center bg-[#0d0d00]">
      <div className="hex-spinner" aria-hidden />
    </div>
  ),
});

type OrderRow = {
  id: string;
  status: string;
  fulfillment_type: string | null;
  delivery_lat: number | null;
  delivery_lon: number | null;
  delivery_address: string | null;
};

export default function DeliveryTrackPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [adminLat, setAdminLat] = useState<number | null>(null);
  const [adminLon, setAdminLon] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [view, setView] = useState<"game" | "map">("game");

  useEffect(() => {
    const ut = localStorage.getItem(LS_USER_TYPE);
    if (ut === "guest") {
      router.replace("/not-a-member");
    }
  }, [router]);

  useEffect(() => {
    const t = getOrCreateCustomerToken();
    function loadOrder() {
      fetch(`/api/account/orders/${encodeURIComponent(orderId)}`, { headers: { "x-customer-token": t } })
        .then((r) => r.json())
        .then((d) => {
          if (d.order) {
            setOrder(d.order);
            if (d.order.status === "delivered") {
              const key = `honeywell_track_celebrated_${orderId}`;
              if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
                sessionStorage.setItem(key, "1");
                setShowConfetti(true);
                window.setTimeout(() => setShowConfetti(false), 3200);
              }
            }
          }
        })
        .finally(() => setLoading(false));
    }
    loadOrder();
    const poll = window.setInterval(loadOrder, 8000);
    return () => clearInterval(poll);
  }, [orderId]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("admin_loc")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_location", filter: "id=eq.1" },
        (payload) => {
          const row = payload.new as { latitude?: number; longitude?: number; is_sharing?: boolean; updated_at?: string };
          if (typeof row.latitude === "number" && typeof row.longitude === "number") {
            setAdminLat(row.latitude);
            setAdminLon(row.longitude);
          }
          setSharing(Boolean(row.is_sharing));
          if (row.updated_at) setUpdatedAt(row.updated_at);
        }
      )
      .subscribe();

    const poll = () => {
      fetch("/api/tracking/admin-location")
        .then((r) => r.json())
        .then((d) => {
          const loc = d.location as { latitude?: number; longitude?: number; is_sharing?: boolean; updated_at?: string } | null;
          if (loc?.latitude != null && loc.longitude != null) {
            setAdminLat(loc.latitude);
            setAdminLon(loc.longitude);
          }
          setSharing(Boolean(loc?.is_sharing));
          if (loc?.updated_at) setUpdatedAt(loc.updated_at);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      clearInterval(id);
      supabase.removeChannel(ch);
    };
  }, []);

  const destLat = order?.delivery_lat ?? 47.5;
  const destLon = order?.delivery_lon ?? 19.0;

  const stale =
    !sharing ||
    !updatedAt ||
    Date.now() - new Date(updatedAt).getTime() > 2 * 60 * 1000;

  const distKm =
    adminLat != null && adminLon != null ? getDistanceKm(adminLat, adminLon, destLat, destLon) : null;
  const etaMinutes =
    adminLat != null && adminLon != null ? calculateETA(adminLat, adminLon, destLat, destLon) : null;

  const etaBarText = useMemo(() => {
    if (!order || order.fulfillment_type !== "delivery") return "";
    if (order.status !== "out_for_delivery") {
      return "Waiting for your order to be dispatched…";
    }
    if (stale) {
      return "Location update paused — your order is still on the way.";
    }
    if (etaMinutes != null && etaMinutes > 0) {
      return `~${etaMinutes} min away`;
    }
    return "Almost there!";
  }, [order, stale, etaMinutes]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="hex-spinner" aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <p className="text-honey-muted">Order not found.</p>
        <Link href="/order-history" className="text-primary underline">
          Back to orders
        </Link>
      </div>
    );
  }

  if (order.fulfillment_type !== "delivery") {
    return (
      <div className="space-y-4">
        <p className="text-honey-muted">Live tracking is only for delivery orders.</p>
        <Link href="/order-history" className="text-primary underline">
          Back to orders
        </Link>
      </div>
    );
  }

  if (order.status === "delivered") {
    return (
      <div className="relative mx-auto max-w-lg space-y-6 text-center">
        <ConfettiBurst active={showConfetti} />
        <div>
          <Link href="/order-history" className="text-sm text-primary hover:underline">
            ← Orders
          </Link>
          <h1 className="mt-6 font-display text-3xl text-honey-text">Delivered!</h1>
          <p className="mt-3 text-honey-muted">Your order has arrived. Enjoy your Honey Well goodies.</p>
        </div>
        <Link
          href="/shop"
          className="btn-primary inline-flex rounded px-8 py-3 text-sm font-semibold text-on-primary"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  const etaForGame = etaMinutes != null && etaMinutes > 0 ? etaMinutes : 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg">
      <HoneycombBg className="opacity-[0.15] dark:opacity-[0.12]" variant="dark" />
      <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-primary px-4 text-on-primary">
        <Link href="/order-history" className="text-sm font-medium text-on-primary/90 hover:underline">
          ← Orders
        </Link>
        <span className="max-w-[min(100%,14rem)] truncate text-center text-sm font-bold text-on-primary">
          {etaBarText}
        </span>
        <button
          type="button"
          onClick={() => setView((v) => (v === "game" ? "map" : "game"))}
          className="shrink-0 rounded border-2 border-primary-dark bg-black px-3 py-1.5 text-xs font-semibold text-primary"
        >
          {view === "game" ? "Map" : "Game"}
        </button>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="absolute inset-0 min-h-0"
          style={{ display: view === "game" ? "block" : "none" }}
          aria-hidden={view !== "game"}
        >
          <BeeFlyer
            etaMinutes={etaForGame}
            onCheckMap={() => setView("map")}
            isPaused={view === "map"}
          />
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col bg-bg"
          style={{ display: view === "map" ? "flex" : "none" }}
        >
          {adminLat != null && adminLon != null ? (
            <>
              <DeliveryTrackMap
                adminLat={adminLat}
                adminLon={adminLon}
                destLat={destLat}
                destLon={destLon}
                mapClassName="h-[min(100%,calc(100vh-3.5rem))] min-h-[280px] w-full rounded-none md:rounded-b-xl"
                showEtaFooter={false}
              />
              {distKm != null && (
                <p className="bg-bg px-4 py-2 text-center text-sm text-honey-muted">
                  {distKm.toFixed(1)} km from your address
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-honey-muted">
              Map will appear when the driver&apos;s location is available.
            </div>
          )}
          <button
            type="button"
            onClick={() => setView("game")}
            className="mx-auto mb-4 rounded-lg border border-honey-border bg-surface px-4 py-2 text-sm font-medium text-honey-text shadow-sm"
          >
            Back to game
          </button>
        </div>
      </div>
    </div>
  );
}
