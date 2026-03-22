"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { LS_REFERRED_BY } from "@/lib/constants";
import { formatPrice, getPriceForUser } from "@/lib/helpers";
import type { FulfillmentType, Product, UserType } from "@/types";
import clsx from "clsx";
import { AlertCircle, ChevronLeft, MapPin, Navigation, Package, Truck } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type DeadDrop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  apple_maps_url: string | null;
  instructions: string | null;
  location_photo_url: string | null;
  active_from: string | null;
  active_until: string | null;
};

type PickupLoc = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  apple_maps_url: string | null;
  admin_message: string | null;
  photo_url: string | null;
};

type Step = 1 | 2 | 3 | 4;

interface CheckoutFlowProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  quantity: number;
  userType: UserType | null;
  onSuccess: (payload: { orderId: string; paymentMethod: string; remainderHuf: number }) => void;
  loading?: boolean;
}

export function CheckoutFlow({
  open,
  onClose,
  product,
  quantity,
  userType,
  onSuccess,
  loading: externalLoading,
}: CheckoutFlowProps) {
  const [step, setStep] = useState<Step>(1);
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  const [guestModal, setGuestModal] = useState(false);

  const [deadDrop, setDeadDrop] = useState<DeadDrop | null>(null);
  const [pickupPoints, setPickupPoints] = useState<PickupLoc[]>([]);
  const [selectedDeadDropId, setSelectedDeadDropId] = useState<string | null>(null);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryApt, setDeliveryApt] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLon, setDeliveryLon] = useState<number | null>(null);

  const [pointsToUse, setPointsToUse] = useState(0);
  const [beesToUse, setBeesToUse] = useState(0);
  const [remainderPay, setRemainderPay] = useState<"revolut" | "crypto">("crypto");
  const [walletPoints, setWalletPoints] = useState(0);
  const [walletBees, setWalletBees] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { unit } = getPriceForUser(product, userType);
  const baseTotal = unit * quantity;

  const remainderHuf = useMemo(() => {
    let r = baseTotal - pointsToUse - beesToUse * 10000;
    if (r < 0) r = 0;
    return r;
  }, [baseTotal, pointsToUse, beesToUse]);

  const loadContext = useCallback(async () => {
    const [ddRes, pkRes, wRes] = await Promise.all([
      fetch("/api/dead-drops/active"),
      fetch("/api/shop-locations/pickup-points"),
      fetch("/api/wallet/summary", { headers: { "x-customer-token": getOrCreateCustomerToken() } }),
    ]);
    const dd = await ddRes.json();
    const pk = await pkRes.json();
    const w = await wRes.json();
    setDeadDrop(dd.dead_drop ?? null);
    if (dd.dead_drop?.id) setSelectedDeadDropId(dd.dead_drop.id);
    setPickupPoints(pk.locations ?? []);
    setWalletPoints(typeof w.points === "number" ? w.points : 0);
    setWalletBees(typeof w.bees === "number" ? w.bees : 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    loadContext().catch(() => {});
    setStep(1);
    setFulfillment(null);
    setError(null);
  }, [open, loadContext]);

  useEffect(() => {
    if (!open || fulfillment !== "delivery") return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryLat(pos.coords.latitude);
        setDeliveryLon(pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [open, fulfillment]);

  if (!open) return null;

  function pickFulfillment(ft: FulfillmentType) {
    if (!userType) {
      setError("Choose Team Member or Guest from the home page first.");
      return;
    }
    if (ft === "dead_drop" && !deadDrop) {
      setError("No active dead drop.");
      return;
    }
    if (userType === "guest" && (ft === "pickup" || ft === "delivery")) {
      setGuestModal(true);
      return;
    }
    setFulfillment(ft);
    setStep(2);
  }

  function canProceedStep2(): boolean {
    if (!fulfillment) return false;
    if (fulfillment === "dead_drop") {
      return Boolean(selectedDeadDropId && deadDrop);
    }
    if (fulfillment === "pickup") {
      return Boolean(selectedPickupId);
    }
    return deliveryAddress.trim().length > 3;
  }

  function paymentMethodForSubmit(): string {
    if (remainderHuf <= 0.01) {
      if (beesToUse > 0 && pointsToUse === 0) return "bees";
      if (pointsToUse > 0) return "points";
      return "crypto";
    }
    return remainderPay;
  }

  async function submitOrder() {
    if (!userType) return;
    setError(null);
    const token = getOrCreateCustomerToken();
    const pm = paymentMethodForSubmit();
    if (remainderHuf > 0.01 && userType === "guest" && pm === "revolut") {
      setError("Guests cannot use Revolut.");
      return;
    }
    setLoading(true);
    try {
      const referred_by =
        typeof window !== "undefined" ? localStorage.getItem(LS_REFERRED_BY) : null;
      const body: Record<string, unknown> = {
        customer_token: token,
        product_id: product.id,
        quantity,
        user_type: userType,
        payment_method: pm,
        fulfillment_type: fulfillment,
        bees_used: beesToUse,
        points_used: pointsToUse,
        ...(referred_by ? { referred_by } : {}),
      };
      if (fulfillment === "dead_drop") body.dead_drop_id = selectedDeadDropId;
      if (fulfillment === "pickup") body.location_id = selectedPickupId;
      if (fulfillment === "delivery") {
        body.delivery_address = deliveryAddress;
        body.delivery_apartment = deliveryApt || null;
        body.delivery_notes = deliveryNotes || null;
        body.delivery_phone = deliveryPhone || null;
        body.delivery_lat = deliveryLat;
        body.delivery_lon = deliveryLon;
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not place order");
        return;
      }
      onSuccess({ orderId: data.order_id as string, paymentMethod: pm, remainderHuf });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || externalLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-honey-border bg-surface p-6 shadow-2xl dark:bg-surface-dark">
        <div className="mb-4 flex items-center justify-between gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                if (step === 2) {
                  setStep(1);
                  setFulfillment(null);
                } else if (step === 3) {
                  setStep(2);
                } else if (step === 4) {
                  setStep(3);
                }
              }}
              className="inline-flex items-center gap-1 text-sm text-honey-muted hover:text-honey-text"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <span className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-honey-muted">
            Checkout · Step {step} of 4
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-honey-text">How would you like to receive your order?</h2>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => pickFulfillment("dead_drop")}
                disabled={!deadDrop}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                  deadDrop
                    ? "border-honey-border hover:border-primary/40"
                    : "cursor-not-allowed border-honey-border/50 opacity-60"
                )}
              >
                <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-honey-text">Dead drop</p>
                  <p className="text-sm text-honey-muted">{deadDrop ? deadDrop.name : "No active dead drop right now."}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => pickFulfillment("pickup")}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                  userType === "guest"
                    ? "cursor-not-allowed border-dashed border-honey-border/60 opacity-70"
                    : "border-honey-border hover:border-primary/40"
                )}
              >
                <Package className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-honey-text">Pickup {userType === "guest" && "(team only)"}</p>
                  <p className="text-sm text-honey-muted">Collect at a shop pickup point.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => pickFulfillment("delivery")}
                className={clsx(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                  userType === "guest"
                    ? "cursor-not-allowed border-dashed border-honey-border/60 opacity-70"
                    : "border-honey-border hover:border-primary/40"
                )}
              >
                <Truck className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-honey-text">Delivery {userType === "guest" && "(team only)"}</p>
                  <p className="text-sm text-honey-muted">We bring it to your address.</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 2 && fulfillment === "dead_drop" && deadDrop && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Dead drop location</h3>
            <p className="font-medium text-honey-text">{deadDrop.name}</p>
            {deadDrop.instructions && <p className="text-sm text-honey-muted">{deadDrop.instructions}</p>}
            {deadDrop.location_photo_url && (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-honey-border">
                <Image src={deadDrop.location_photo_url} alt="" fill className="object-cover" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {deadDrop.google_maps_url && (
                <a
                  href={deadDrop.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-honey-border px-3 py-1.5 text-xs font-semibold"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Google Maps
                </a>
              )}
              {deadDrop.apple_maps_url && (
                <a
                  href={deadDrop.apple_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-honey-border px-3 py-1.5 text-xs font-semibold"
                >
                  Apple Maps
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && fulfillment === "pickup" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Choose pickup point</h3>
            {pickupPoints.length === 0 ? (
              <p className="text-sm text-honey-muted">No pickup points are active. Try dead drop or contact admin.</p>
            ) : (
              <ul className="space-y-2">
                {pickupPoints.map((loc) => (
                  <li key={loc.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedPickupId(loc.id)}
                      className={clsx(
                        "w-full rounded-xl border p-3 text-left text-sm",
                        selectedPickupId === loc.id ? "border-primary bg-primary/5" : "border-honey-border"
                      )}
                    >
                      <p className="font-semibold text-honey-text">{loc.name}</p>
                      {loc.admin_message && <p className="text-honey-muted">{loc.admin_message}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={!canProceedStep2()}
              onClick={() => setStep(3)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && fulfillment === "delivery" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Delivery address</h3>
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Full address *"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Apartment / floor / door (optional)"
              value={deliveryApt}
              onChange={(e) => setDeliveryApt(e.target.value)}
            />
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Delivery notes (optional)"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Phone (optional)"
              value={deliveryPhone}
              onChange={(e) => setDeliveryPhone(e.target.value)}
            />
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-honey-text">
              Delivery is handled personally by Honey Well. We will contact you to confirm your delivery window.
            </div>
            <button
              type="button"
              disabled={!canProceedStep2()}
              onClick={() => setStep(3)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Payment</h3>
            <p className="text-sm text-honey-muted">
              Order total {formatPrice(baseTotal)} · Wallet: {walletPoints} pts · {walletBees.toFixed(2)} Bees
            </p>
            <div>
              <label className="text-xs font-semibold text-honey-muted">Points to apply (1 pt = 1 HUF)</label>
              <input
                type="number"
                min={0}
                max={Math.min(walletPoints, Math.floor(baseTotal))}
                className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                value={pointsToUse || ""}
                onChange={(e) => setPointsToUse(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-honey-muted">Bees to apply (1 Bee = 10,000 HUF)</label>
              <input
                type="number"
                min={0}
                step={0.0001}
                max={walletBees}
                className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                value={beesToUse || ""}
                onChange={(e) => setBeesToUse(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
            {remainderHuf > 0.01 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-honey-muted">Pay remaining {formatPrice(remainderHuf)} with</p>
                <div className="flex gap-2">
                  {userType === "team_member" && (
                    <button
                      type="button"
                      onClick={() => setRemainderPay("revolut")}
                      className={clsx(
                        "flex-1 rounded-full border py-2 text-sm font-medium",
                        remainderPay === "revolut" ? "border-primary bg-primary/10 text-primary" : "border-honey-border"
                      )}
                    >
                      Revolut
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRemainderPay("crypto")}
                    className={clsx(
                      "flex-1 rounded-full border py-2 text-sm font-medium",
                      remainderPay === "crypto" ? "border-primary bg-primary/10 text-primary" : "border-honey-border"
                    )}
                  >
                    Crypto
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setStep(4)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white"
            >
              Review order
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Confirm</h3>
            <ul className="space-y-2 text-sm text-honey-muted">
              <li className="flex justify-between">
                <span>Product</span>
                <span className="text-honey-text">{product.name} × {quantity}</span>
              </li>
              <li className="flex justify-between">
                <span>Fulfillment</span>
                <span className="text-honey-text">{fulfillment}</span>
              </li>
              <li className="flex justify-between">
                <span>Payment</span>
                <span className="text-honey-text">{paymentMethodForSubmit()}</span>
              </li>
              <li className="flex justify-between border-t border-honey-border pt-2 font-semibold text-honey-text">
                <span>Remaining after Bees/Points</span>
                <span>{formatPrice(remainderHuf)}</span>
              </li>
            </ul>
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={submitOrder}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Placing order…" : "Place order"}
            </button>
          </div>
        )}

        {guestModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setGuestModal(false)} />
            <div className="relative max-w-sm rounded-2xl border border-honey-border bg-surface p-6 text-center dark:bg-surface-dark">
              <p className="text-sm text-honey-text">
                This option is for Honey Well team members only. For access, please contact the admin via our Telegram
                channel.
              </p>
              <button
                type="button"
                onClick={() => setGuestModal(false)}
                className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
