"use client";

import { formatPrice, ORDER_STATUS_LABELS } from "@/lib/helpers";
import type { OrderWithProduct } from "@/types";
import clsx from "clsx";
import { LifeBuoy, MapPin, Navigation, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ConfettiBurst } from "./ConfettiBurst";
import { ProductImage } from "./ProductImage";
import { PickupPhotoModal } from "./PickupPhotoModal";

interface OrderCardProps {
  order: OrderWithProduct;
  shopAddress: string;
  mapsUrl: string;
  appleMapsUrl: string;
  customerToken: string;
  onPhotoUploaded?: () => void;
}

export function OrderCard({
  order,
  shopAddress,
  mapsUrl,
  appleMapsUrl,
  customerToken,
  onPhotoUploaded,
}: OrderCardProps) {
  const [showPhoto, setShowPhoto] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const product = order.product;
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;

  const { displayAddress, googleUrl, appleUrl } = useMemo(() => {
    if (order.fulfillment_type === "dead_drop" && order.dead_drop) {
      return {
        displayAddress: order.dead_drop.name + (order.dead_drop.instructions ? ` — ${order.dead_drop.instructions}` : ""),
        googleUrl: order.dead_drop.google_maps_url ?? mapsUrl,
        appleUrl: order.dead_drop.apple_maps_url ?? appleMapsUrl,
      };
    }
    if (order.fulfillment_type === "pickup" && order.pickup_location) {
      return {
        displayAddress: order.pickup_location.name + (order.pickup_location.admin_message ? ` — ${order.pickup_location.admin_message}` : ""),
        googleUrl: order.pickup_location.google_maps_url ?? mapsUrl,
        appleUrl: order.pickup_location.apple_maps_url ?? appleMapsUrl,
      };
    }
    return { displayAddress: shopAddress, googleUrl: mapsUrl, appleUrl: appleMapsUrl };
  }, [order, shopAddress, mapsUrl, appleMapsUrl]);

  const showPickup =
    order.status === "ready_for_pickup" ||
    order.status === "ready_at_drop" ||
    order.status === "confirmed" ||
    order.status === "customer_arrived" ||
    order.status === "pickup_submitted";

  async function uploadPhoto(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("orderId", order.id);
    form.append("customerToken", customerToken);

    const res = await fetch("/api/orders/pickup-photo", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Upload failed");
    onPhotoUploaded?.();
  }

  return (
    <>
      <ConfettiBurst active={celebrate} />
      <article className="overflow-hidden rounded-2xl border border-honey-border bg-surface shadow-sm dark:bg-surface-dark">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-primary/5 sm:h-24 sm:w-32">
            {product?.image_url ? (
              <ProductImage src={product.image_url} alt={product.name} fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-honey-muted">No image</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-accent text-lg italic text-honey-text">{product?.name ?? "Product"}</h3>
              <span
                className={clsx(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  order.status === "picked_up" && "bg-primary/15 text-primary",
                  order.status === "delivered" && "bg-primary/15 text-primary",
                  order.status === "cancelled" && "bg-red-500/10 text-red-600",
                  order.status === "payment_pending" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                  !["picked_up", "delivered", "cancelled", "payment_pending"].includes(order.status) &&
                    "bg-honey-border/80 text-honey-muted"
                )}
              >
                {statusLabel}
              </span>
            </div>
            {order.fulfillment_type && (
              <p className="mt-1 text-xs uppercase tracking-wide text-primary">
                {order.fulfillment_type.replace(/_/g, " ")}
              </p>
            )}
            <p className="mt-1 text-sm text-honey-muted">
              Qty {order.quantity} · Total {formatPrice(Number(order.total_price))}
            </p>
            {order.order_number && (
              <p className="mt-1 font-mono text-xs text-primary">{order.order_number}</p>
            )}
            <p className="mt-1 text-xs text-honey-muted">
              {new Date(order.created_at).toLocaleString("en-GB")}
            </p>
            {order.fulfillment_type === "delivery" && order.status === "out_for_delivery" && (
              <Link
                href={`/account/orders/${order.id}/track`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25"
              >
                <Truck className="h-3.5 w-3.5" />
                Track delivery
              </Link>
            )}
            <Link
              href={`/support/new?orderId=${encodeURIComponent(order.id)}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Report an issue with this order
            </Link>
          </div>
        </div>

        {showPickup && (
          <div className="border-t border-honey-border bg-bg/50 px-4 py-4 dark:bg-black/20">
            <p className="mb-3 flex items-start gap-2 text-sm text-honey-text">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{displayAddress}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-honey-border px-3 py-1.5 text-xs font-semibold text-honey-text transition hover:border-primary/40"
              >
                <Navigation className="h-3.5 w-3.5" />
                Get Directions
              </a>
              <a
                href={appleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-honey-border px-3 py-1.5 text-xs font-semibold text-honey-text transition hover:border-primary/40"
              >
                Open in Apple Maps
              </a>
              {(order.status === "ready_for_pickup" ||
                order.status === "ready_at_drop" ||
                order.status === "confirmed") && (
                <button
                  type="button"
                  onClick={() => setShowPhoto(true)}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-light"
                >
                  Mark as Picked Up
                </button>
              )}
            </div>
            {order.status === "pickup_submitted" && (
              <p className="mt-3 text-xs text-honey-muted">
                Photo received — we&apos;ll confirm pickup shortly.
              </p>
            )}
          </div>
        )}
      </article>

      <PickupPhotoModal open={showPhoto} onClose={() => setShowPhoto(false)} onSubmit={uploadPhoto} />
    </>
  );
}
