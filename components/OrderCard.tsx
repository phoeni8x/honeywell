"use client";

import { useShopCurrency } from "@/components/ShopCurrencyProvider";
import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { fulfillmentTypeDisplay, ORDER_STATUS_LABELS } from "@/lib/helpers";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import {
  extractFirstHttpUrl,
  isParcelLockerPickupIssued,
  lockerProviderDisplayLabel,
  mapsSearchUrlApple,
  mapsSearchUrlGoogle,
} from "@/lib/parcel-locker";
import { getOrderIssueTelegramUrl } from "@/lib/support-telegram";
import type { OrderWithProduct } from "@/types";
import clsx from "clsx";
import { Copy, ExternalLink, LifeBuoy, MapPin, Navigation } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfettiBurst } from "./ConfettiBurst";
import { ProductImage } from "./ProductImage";
import { PickupPhotoModal } from "./PickupPhotoModal";

interface OrderCardProps {
  order: OrderWithProduct;
  shopAddress: string;
  mapsUrl: string;
  appleMapsUrl: string;
  /** Admin-configured bank transfer payment link (settings). */
  revolutPaymentLink?: string;
  customerToken: string;
  onPhotoUploaded?: () => void;
}

function canCustomerCancelOrder(order: OrderWithProduct): boolean {
  if (isParcelLockerPickupIssued(order)) return false;

  const payAfterDelivery =
    (order as { pay_after_delivery?: boolean }).pay_after_delivery === true ||
    order.revolut_pay_timing === "pay_on_delivery";
  return (
    order.payment_method === "revolut" &&
    payAfterDelivery &&
    ["waiting", "confirmed", "out_for_delivery"].includes(order.status)
  );
}

export function OrderCard({
  order,
  shopAddress,
  mapsUrl,
  appleMapsUrl,
  revolutPaymentLink = "",
  customerToken,
  onPhotoUploaded,
}: OrderCardProps) {
  const { formatPrice } = useShopCurrency();
  const [showPhoto, setShowPhoto] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [revolutLinkError, setRevolutLinkError] = useState<string | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [lockerCodeCopied, setLockerCodeCopied] = useState(false);
  const product = order.product;
  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;
  const isFinalStatus = ["delivered", "picked_up", "cancelled", "payment_expired"].includes(order.status);
  const isVipCustomer = order.user_type === "team_member";
  const showRevolutPayNowBanner =
    order.payment_method === "revolut" &&
    order.revolut_pay_timing === "pay_now" &&
    !isFinalStatus;
  const showRevolutPayAfterDeliveryBanner =
    order.payment_method === "revolut" &&
    order.revolut_pay_timing === "pay_on_delivery" &&
    order.status === "delivered";

  const isLegacyPickup = order.fulfillment_type === "pickup";

  const {
    parcelLocker,
    displayAddress,
    googleUrl,
    appleUrl,
    legacyLocationPhotos,
    legacyLocationVideoUrl,
    legacyLocationFindInstructions,
  } = useMemo(() => {
    const locText = order.locker_location_text?.trim() ?? "";
    const pass = order.locker_passcode?.trim() ?? "";
    if (order.fulfillment_type === "dead_drop" && locText && pass && !order.dead_drop_id) {
      const direct = extractFirstHttpUrl(locText);
      const g = direct ?? mapsSearchUrlGoogle(locText);
      const a = direct ?? mapsSearchUrlApple(locText);
      return {
        parcelLocker: {
          providerLabel: lockerProviderDisplayLabel(order.locker_provider),
          location: locText,
          passcode: pass,
        },
        displayAddress: locText,
        googleUrl: g,
        appleUrl: a,
        legacyLocationPhotos: [] as string[],
        legacyLocationVideoUrl: null,
        legacyLocationFindInstructions: null,
      };
    }
    if (order.fulfillment_type === "dead_drop" && order.dead_drop) {
      const dd = order.dead_drop;
      const photos = [dd.location_photo_url, dd.location_photo_url_2, dd.location_photo_url_3].filter(
        (p): p is string => Boolean(p)
      );
      return {
        parcelLocker: null,
        displayAddress: dd.name,
        googleUrl: dd.google_maps_url ?? mapsUrl,
        appleUrl: dd.apple_maps_url ?? appleMapsUrl,
        legacyLocationPhotos: photos,
        legacyLocationVideoUrl: dd.location_video_url ?? null,
        legacyLocationFindInstructions: dd.instructions ?? null,
      };
    }
    if (order.fulfillment_type === "pickup" && order.pickup_location) {
      return {
        parcelLocker: null,
        displayAddress: order.pickup_location.name + (order.pickup_location.admin_message ? ` — ${order.pickup_location.admin_message}` : ""),
        googleUrl: order.pickup_location.google_maps_url ?? mapsUrl,
        appleUrl: order.pickup_location.apple_maps_url ?? appleMapsUrl,
        legacyLocationPhotos: [] as string[],
        legacyLocationVideoUrl: null,
        legacyLocationFindInstructions: null,
      };
    }
    return {
      parcelLocker: null,
      displayAddress: shopAddress,
      googleUrl: mapsUrl,
      appleUrl: appleMapsUrl,
      legacyLocationPhotos: [] as string[],
      legacyLocationVideoUrl: null,
      legacyLocationFindInstructions: null,
    };
  }, [order, shopAddress, mapsUrl, appleMapsUrl]);

  const showLocationSection =
    order.fulfillment_type !== "delivery" &&
    (order.status === "ready_for_pickup" ||
      order.status === "ready_at_drop" ||
      order.status === "confirmed" ||
      order.status === "customer_arrived" ||
      order.status === "pickup_submitted");

  const showMarkPickedUp =
    !isLegacyPickup &&
    (order.status === "ready_for_pickup" || order.status === "ready_at_drop" || order.status === "confirmed");

  async function cancelOrder() {
    if (!canCustomerCancelOrder(order)) return;
    setCancelError(null);
    setCancelLoading(true);
    try {
      let token = getOrCreateCustomerToken().trim();
      if (!token) token = customerToken.trim();
      if (!token) {
        setCancelError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        return;
      }

      let res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-customer-token": token,
        },
        body: JSON.stringify({ order_id: order.id }),
      });

      // If token drifted, re-adopt order token once and retry.
      if (!res.ok) {
        const adopt = await fetch("/api/orders/adopt-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: order.id }),
        });
        const adoptData = (await adopt.json().catch(() => ({}))) as { customer_token?: string };
        const retryToken = typeof adoptData.customer_token === "string" ? adoptData.customer_token.trim() : "";
        if (adopt.ok && retryToken) {
          res = await fetch("/api/orders/cancel", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-customer-token": retryToken,
            },
            body: JSON.stringify({ order_id: order.id }),
          });
        }
      }

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 403) {
          setCancelError(payload.error || "This order cannot be cancelled by the customer.");
        } else if (res.status === 400) {
          setCancelError(payload.error || "This order can no longer be cancelled.");
        } else if (res.status === 401 || res.status === 404) {
          setCancelError("Session mismatch detected. Refresh and try again.");
        } else {
          setCancelError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        }
        return;
      }
      onPhotoUploaded?.();
    } catch {
      setCancelError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setCancelLoading(false);
    }
  }

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
    if (!res.ok) throw new Error(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    onPhotoUploaded?.();
  }

  return (
    <>
      <ConfettiBurst active={celebrate} />
      <article
        id={`order-${order.id}`}
        className="overflow-hidden rounded-2xl border border-honey-border bg-surface shadow-sm dark:bg-surface-dark"
      >
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
                  order.status === "pre_ordered" && "bg-amber-500/20 text-amber-800 dark:text-amber-300",
                  order.status === "payment_pending" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                  order.status === "awaiting_dead_drop" && "bg-sky-500/15 text-sky-800 dark:text-sky-200",
                  order.status === "waiting" && "bg-sky-500/15 text-sky-800 dark:text-sky-200",
                  !["picked_up", "delivered", "cancelled", "pre_ordered", "payment_pending", "awaiting_dead_drop", "waiting"].includes(order.status) &&
                    "bg-honey-border/80 text-honey-muted"
                )}
              >
                {statusLabel}
              </span>
            </div>
            {order.status === "pre_ordered" && (
              <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                {order.payment_method === "booking"
                  ? "Booking request — no payment yet. The team will review and contact you or update this order when pickup is available."
                  : "Pre-order awaiting admin decision. You will see updates here once accepted or rejected."}
              </p>
            )}
            {order.status === "awaiting_dead_drop" && (
              <p className="mt-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100">
                Payment received. Your parcel locker details (machine location and passcode) will show here once the team issues them.
              </p>
            )}
            {order.payment_reference_code &&
              order.payment_method !== "booking" &&
              (order.status === "payment_pending" || order.status === "awaiting_dead_drop") && (
                <div className="mt-3 rounded-2xl border-2 border-primary/35 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-honey-muted">Payment reference</p>
                  <p className="mt-1 text-xs text-honey-muted">
                    Put this in the <strong className="text-honey-text">memo / reference</strong> field when you pay (bank
                    transfer or crypto). Each order has its own code — do not reuse an old one.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-wider text-primary">
                      {order.payment_reference_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(order.payment_reference_code ?? "").then(() => {
                          setRefCopied(true);
                          window.setTimeout(() => setRefCopied(false), 2000);
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-honey-border bg-bg px-3 py-1 text-xs font-semibold text-honey-text hover:bg-honey-border/30"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {refCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            {order.fulfillment_type && (
              <p className="mt-1 text-xs uppercase tracking-wide text-primary">
                {fulfillmentTypeDisplay(order.fulfillment_type)}
              </p>
            )}
            <p className="mt-1 text-sm text-honey-muted">Total {formatPrice(Number(order.total_price))}</p>
            {order.order_number && (
              <p className="mt-1 font-mono text-xs text-primary">{order.order_number}</p>
            )}
            <p className="mt-1 text-xs text-honey-muted">
              {new Date(order.created_at).toLocaleString("en-GB")}
            </p>
            {showRevolutPayNowBanner && (
              <div className="mt-3 rounded-2xl border-2 border-amber-400/60 bg-amber-50 px-4 py-3 dark:bg-amber-400/10">
                <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {isVipCustomer ? "Pay with bank transfer" : "Payment required to confirm your order"}
                </p>
                <a
                  href={revolutPaymentLink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-md transition active:scale-95 hover:bg-primary-light"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  onClick={(e) => {
                    if (!revolutPaymentLink) {
                      e.preventDefault();
                      setRevolutLinkError("Payment link not configured yet. Contact admin.");
                    } else {
                      setRevolutLinkError(null);
                    }
                  }}
                >
                  {isVipCustomer ? "Pay with bank transfer" : "Open bank transfer payment"}
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-400">
                  Tap to open your payment link, send payment, then come back here.
                </p>
                {revolutLinkError && (
                  <p className="mt-1 text-center text-xs text-red-600 dark:text-red-400">{revolutLinkError}</p>
                )}
              </div>
            )}
            {showRevolutPayAfterDeliveryBanner && (
              <div className="mt-3 rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-3 dark:bg-primary/10">
                <p className="mb-2 text-xs font-semibold text-primary">
                  Order delivered - please complete your payment
                </p>
                <a
                  href={revolutPaymentLink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-md transition active:scale-95 hover:bg-primary-light"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  onClick={(e) => {
                    if (!revolutPaymentLink) {
                      e.preventDefault();
                      setRevolutLinkError("Payment link not configured yet. Contact admin.");
                    } else {
                      setRevolutLinkError(null);
                    }
                  }}
                >
                  Pay with bank transfer
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="mt-2 text-center text-xs text-honey-muted">
                  Tap to open your payment link, send payment, then admin marks as paid.
                </p>
                {revolutLinkError && (
                  <p className="mt-1 text-center text-xs text-red-600 dark:text-red-400">{revolutLinkError}</p>
                )}
              </div>
            )}
            {canCustomerCancelOrder(order) && (
              <div className="mt-3">
                <button
                  type="button"
                  disabled={cancelLoading}
                  onClick={() => void cancelOrder()}
                  className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  {cancelLoading ? "Cancelling…" : "Cancel order"}
                </button>
                {cancelError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{cancelError}</p>}
              </div>
            )}
            {!canCustomerCancelOrder(order) &&
              !["delivered", "picked_up", "cancelled", "payment_expired"].includes(order.status) && (
                <p className="mt-2 text-xs text-honey-muted">
                  Need to cancel?{" "}
                  <a
                    href={getOrderIssueTelegramUrl(order.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Contact support
                  </a>
                </p>
              )}
            <a
              href={getOrderIssueTelegramUrl(order.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Report an issue with this order (Telegram)
            </a>
          </div>
        </div>

        {showLocationSection && (
          <div className="border-t border-honey-border bg-bg/50 px-4 py-4 dark:bg-black/20">
            {parcelLocker && (
              <div className="mb-4 rounded-xl border-2 border-primary/35 bg-primary/5 px-4 py-3 dark:bg-primary/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Parcel locker</p>
                <p className="mt-1 text-sm text-honey-text">
                  <span className="text-honey-muted">Carrier:</span> {parcelLocker.providerLabel}
                </p>
                <p className="mt-2 text-sm text-honey-text">
                  <span className="text-honey-muted">Location:</span> {parcelLocker.location}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-honey-muted">Locker code</span>
                  <span className="rounded-lg border border-honey-border bg-bg px-3 py-1.5 font-mono text-base font-bold tracking-wide text-honey-text">
                    {parcelLocker.passcode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(parcelLocker.passcode).then(() => {
                        setLockerCodeCopied(true);
                        window.setTimeout(() => setLockerCodeCopied(false), 2000);
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-honey-border bg-bg px-3 py-1 text-xs font-semibold text-honey-text hover:bg-honey-border/30"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {lockerCodeCopied ? "Copied" : "Copy code"}
                  </button>
                </div>
              </div>
            )}
            {!parcelLocker && (
              <p className="mb-3 flex items-start gap-2 text-sm text-honey-text">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{displayAddress}</span>
              </p>
            )}
            {order.fulfillment_type === "dead_drop" && legacyLocationFindInstructions && (
              <p className="mb-3 rounded-xl border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-900 dark:text-green-100">
                <span className="mr-1 font-semibold">Find:</span>
                {legacyLocationFindInstructions}
              </p>
            )}
            {order.fulfillment_type === "dead_drop" && legacyLocationVideoUrl && (
              <div className="mt-3 overflow-hidden rounded-xl border border-honey-border bg-black/20">
                <video
                  src={legacyLocationVideoUrl}
                  controls
                  preload="metadata"
                  className="max-h-56 w-full object-contain"
                />
              </div>
            )}
            {order.fulfillment_type === "dead_drop" && legacyLocationPhotos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {legacyLocationPhotos.map((url, idx) => (
                  <a
                    key={`${url}-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-lg border border-honey-border/60 bg-black/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Pickup location photo ${idx + 1}`} loading="lazy" className="h-20 w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            {isLegacyPickup && (
              <p className="mb-3 text-xs text-honey-muted">
                Older pickup order — contact support if you need help completing this order.
              </p>
            )}
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
              {showMarkPickedUp && (
                <button
                  type="button"
                  onClick={() => setShowPhoto(true)}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-light"
                >
                  Mark as collected
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
