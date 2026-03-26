"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { LS_REFERRED_BY, LS_TELEGRAM_USERNAME } from "@/lib/constants";
import { useShopCurrency } from "@/components/ShopCurrencyProvider";
import { getPriceForUser } from "@/lib/helpers";
import type { FulfillmentType, Product, UserType } from "@/types";
import clsx from "clsx";
import { AlertCircle, ChevronLeft, MapPin, Package, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  onSuccess: (payload: {
    orderId: string;
    paymentMethod: string;
    remainderHuf: number;
    revolutPayTiming?: "pay_now" | "pay_on_delivery" | null;
    customerToken: string;
  }) => void;
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
  const { formatPrice, shopOpen, fulfillmentOptions } = useShopCurrency();
  const [step, setStep] = useState<Step>(1);
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);

  const [pickupPoints, setPickupPoints] = useState<PickupLoc[]>([]);
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
  /** Delivery + Revolut remainder: pay on delivery vs pay now (admin link). */
  const [revolutPayTiming, setRevolutPayTiming] = useState<"pay_now" | "pay_on_delivery">("pay_on_delivery");
  const [walletPoints, setWalletPoints] = useState(0);
  const [walletBees, setWalletBees] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { unit } = getPriceForUser(product, userType);
  const baseTotal = unit * quantity;
  const isPreorder = Boolean(product.allow_preorder) && Number(product.stock_quantity) < quantity;

  const remainderHuf = useMemo(() => {
    let r = baseTotal - pointsToUse - beesToUse * 10000;
    if (r < 0) r = 0;
    return r;
  }, [baseTotal, pointsToUse, beesToUse]);
  const pointsAllowedForOrder = baseTotal >= 50_000;

  const loadContext = useCallback(async () => {
    const [pkRes, wRes] = await Promise.all([
      fetch("/api/shop-locations/pickup-points"),
      fetch("/api/wallet/summary", { headers: { "x-customer-token": getOrCreateCustomerToken() } }),
    ]);
    const pk = await pkRes.json();
    const w = await wRes.json();
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
    setRevolutPayTiming("pay_on_delivery");
  }, [open, loadContext]);

  useEffect(() => {
    if (!open) return;
    if (userType === "guest") {
      setPointsToUse(0);
      setBeesToUse(0);
      setRemainderPay("crypto");
    }
  }, [open, userType]);

  useEffect(() => {
    if (!open) return;
    if (isPreorder && remainderPay === "revolut" && revolutPayTiming !== "pay_now") {
      setRevolutPayTiming("pay_now");
    }
  }, [open, isPreorder, remainderPay, revolutPayTiming]);

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

  if (!shopOpen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
        <div className="relative w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-2xl dark:bg-surface-dark">
          <h2 className="font-display text-xl text-honey-text">Shop is closed</h2>
          <p className="mt-2 text-sm text-honey-muted">
            We&apos;re not taking new orders right now. Please try again later.
          </p>
          <button type="button" onClick={onClose} className="btn-primary mt-6 w-full py-3 text-sm font-semibold text-on-primary">
            OK
          </button>
        </div>
      </div>
    );
  }

  function pickFulfillment(ft: FulfillmentType) {
    if (!userType) {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    if (userType === "guest" && ft !== "dead_drop") {
      return;
    }
    if (ft === "dead_drop") {
      if (!fulfillmentOptions.deadDrop) {
        setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        return;
      }
    }
    if (ft === "pickup" && !fulfillmentOptions.pickup) {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    if (ft === "delivery" && !fulfillmentOptions.delivery) {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setFulfillment(ft);
    setStep(2);
  }

  const showDeadDropCard = fulfillmentOptions.deadDrop;
  const showPickupCard = userType === "team_member" && fulfillmentOptions.pickup;
  const showDeliveryCard = userType === "team_member" && fulfillmentOptions.delivery;

  function canProceedStep2(): boolean {
    if (!fulfillment) return false;
    if (fulfillment === "dead_drop") {
      return true;
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
    if (!shopOpen) {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setError(null);
    const token = getOrCreateCustomerToken();
    if (!token.trim()) {
      setError("Could not save your session. Refresh the page or allow storage for this site.");
      return;
    }
    if (!fulfillment) {
      setError("Choose how to receive your order (step 1), then continue.");
      return;
    }
    if (fulfillment === "delivery" && !deliveryAddress.trim()) {
      setError("Enter a delivery address.");
      return;
    }
    if (fulfillment === "pickup" && !selectedPickupId) {
      setError("Select a pickup point.");
      return;
    }
    const pm = paymentMethodForSubmit();
    if (userType === "guest" && pm === "revolut") {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setLoading(true);
    try {
      const referred_by =
        typeof window !== "undefined" ? localStorage.getItem(LS_REFERRED_BY) : null;
      const customer_username =
        typeof window !== "undefined" ? localStorage.getItem(LS_TELEGRAM_USERNAME) : null;
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
        ...(customer_username ? { customer_username } : {}),
      };
      if (fulfillment === "pickup") body.location_id = selectedPickupId;
      if (fulfillment === "delivery") {
        body.delivery_address = deliveryAddress;
        body.delivery_apartment = deliveryApt || null;
        body.delivery_notes = deliveryNotes || null;
        body.delivery_phone = deliveryPhone || null;
        body.delivery_lat = deliveryLat;
        body.delivery_lon = deliveryLon;
      }
      if (
        fulfillment === "delivery" &&
        userType === "team_member" &&
        remainderHuf > 0.01 &&
        pm === "revolut"
      ) {
        body.revolut_pay_timing = revolutPayTiming;
      }

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { order_id?: string; error?: string; code?: string };
      if (!res.ok) {
        if (res.status === 429 && typeof data.error === "string") {
          setError(data.error);
        } else if (typeof data.error === "string" && data.error !== PUBLIC_ERROR_TRY_AGAIN_OR_GUEST) {
          setError(data.error);
        } else {
          setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        }
        if (process.env.NODE_ENV === "development" && data.code) {
          console.warn("[checkout] order create failed", res.status, data.code);
        }
        return;
      }
      if (!data.order_id) {
        setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        return;
      }
      onSuccess({
        orderId: data.order_id,
        paymentMethod: pm,
        remainderHuf,
        customerToken: token,
        revolutPayTiming:
          fulfillment === "delivery" && userType === "team_member" && remainderHuf > 0.01 && pm === "revolut"
            ? revolutPayTiming
            : null,
      });
    } catch {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || externalLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div
        className="relative w-full max-w-lg overflow-y-auto rounded-t-3xl border border-honey-border bg-surface p-6 shadow-2xl dark:bg-surface-dark sm:max-h-[90vh] sm:rounded-2xl"
        style={{
          maxHeight: "92dvh",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-honey-border/60 sm:hidden" />
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => {
            if (typeof document !== "undefined") {
              (document.activeElement as HTMLElement)?.blur();
            }
          }}
        />
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
            {userType === "guest" && (
              <p className="text-sm text-honey-muted">
                As a guest, orders are fulfilled via <span className="font-medium text-honey-text">dead drop</span>{" "}
                only. Team members can also use pickup or delivery when enabled.
              </p>
            )}
            {userType === "guest" && !fulfillmentOptions.deadDrop && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                Dead drop is temporarily unavailable. Please contact support.
              </div>
            )}
            <div className="grid gap-3">
              {showDeadDropCard && (
                <button
                  type="button"
                  onClick={() => pickFulfillment("dead_drop")}
                  disabled={false}
                  className={clsx(
                    "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                    "border-honey-border hover:border-primary/40"
                  )}
                >
                  <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-honey-text">Dead drop</p>
                    <p className="text-sm text-honey-muted">A private drop point is assigned after payment.</p>
                  </div>
                </button>
              )}

              {showPickupCard && (
                <button
                  type="button"
                  onClick={() => pickFulfillment("pickup")}
                  className="flex items-start gap-3 rounded-xl border border-honey-border p-4 text-left transition hover:border-primary/40"
                >
                  <Package className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-honey-text">Pickup</p>
                    <p className="text-sm text-honey-muted">Collect at a shop pickup point.</p>
                  </div>
                </button>
              )}

              {showDeliveryCard && (
                <button
                  type="button"
                  onClick={() => pickFulfillment("delivery")}
                  className="flex items-start gap-3 rounded-xl border border-honey-border p-4 text-left transition hover:border-primary/40"
                >
                  <Truck className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-honey-text">Delivery</p>
                    <p className="text-sm text-honey-muted">We bring it to your address.</p>
                  </div>
                </button>
              )}
            </div>
            {userType === "team_member" &&
              !showDeadDropCard &&
              !showPickupCard &&
              !showDeliveryCard && (
                <p className="text-sm text-honey-muted">No fulfillment options are enabled. Please contact the shop.</p>
              )}
          </div>
        )}

        {step === 2 && fulfillment === "dead_drop" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Dead drop allocation</h3>
            <p className="text-sm text-honey-muted">
              For security, exact dead-drop location details are assigned privately after your order is accepted.
            </p>
            <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-3 text-xs text-honey-text">
              If all active dead-drop slots are allocated, checkout will show No dead drop available.
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
            <button
              type="button"
              className="mb-3 ml-auto flex items-center gap-1 rounded-full bg-honey-border/40 px-4 py-1.5 text-xs font-semibold text-honey-text md:hidden"
              onClick={() => (document.activeElement as HTMLElement)?.blur()}
            >
              Done ✓
            </button>
            <h3 className="font-display text-lg text-honey-text">Delivery address</h3>
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Full address *"
              value={deliveryAddress}
              enterKeyHint="next"
              autoComplete="street-address"
              onChange={(e) => setDeliveryAddress(e.target.value)}
              onFocus={(e) => e.target.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Apartment / floor / door (optional)"
              value={deliveryApt}
              enterKeyHint="next"
              autoComplete="address-line2"
              onChange={(e) => setDeliveryApt(e.target.value)}
              onFocus={(e) => e.target.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
            <textarea
              className="min-h-[72px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Delivery notes (optional)"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              onFocus={(e) => e.target.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Phone (optional)"
              value={deliveryPhone}
              enterKeyHint="done"
              autoComplete="tel"
              inputMode="tel"
              onChange={(e) => setDeliveryPhone(e.target.value)}
              onFocus={(e) => e.target.scrollIntoView({ behavior: "smooth", block: "center" })}
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
            {isPreorder && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Pre-order requires payment now. Pay-on-delivery is not available for pre-orders.
              </div>
            )}
            {userType === "guest" ? (
              <p className="text-sm text-honey-muted">
                Order total {formatPrice(baseTotal)}. Guests can use <span className="font-medium text-honey-text">Points and Bees</span>{" "}
                (Points require minimum order {formatPrice(50_000)}), and pay any remainder with{" "}
                <span className="font-medium text-honey-text">cryptocurrency</span>.
              </p>
            ) : (
              <p className="text-sm text-honey-muted">
                Order total {formatPrice(baseTotal)} · Wallet: {walletPoints} pts · {walletBees.toFixed(2)} Bees.
                After Points/Bees, you can pay the remainder with <span className="font-medium text-honey-text">Revolut</span>{" "}
                or <span className="font-medium text-honey-text">cryptocurrency</span> — choose below.
              </p>
            )}
            {userType && (
              <>
                <div>
                  <label className="text-xs font-semibold text-honey-muted">Points to apply (1 pt = 1 HUF)</label>
                  {!pointsAllowedForOrder && (
                    <p className="mt-1 text-xs text-honey-muted">
                      Points can be used only for orders of at least {formatPrice(50_000)}.
                    </p>
                  )}
                  <input
                    type="number"
                    min={0}
                    max={pointsAllowedForOrder ? Math.min(walletPoints, Math.floor(baseTotal)) : 0}
                    className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                    value={pointsToUse || ""}
                    disabled={!pointsAllowedForOrder}
                    onChange={(e) =>
                      setPointsToUse(
                        pointsAllowedForOrder ? Math.max(0, parseInt(e.target.value, 10) || 0) : 0
                      )
                    }
                  />
                </div>
                <div>
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
                </div>
              </>
            )}
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
                      userType === "guest" || remainderPay === "crypto"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-honey-border"
                    )}
                  >
                    Crypto
                  </button>
                </div>
              </div>
            )}
            {fulfillment === "delivery" &&
              userType === "team_member" &&
              remainderHuf > 0.01 &&
              remainderPay === "revolut" && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-3">
                  <p className="text-xs font-semibold text-honey-text">When do you pay the Revolut remainder?</p>
                  <p className="mt-1 text-xs text-honey-muted">
                    Pay after receiving: we place your order and you pay on delivery. Pay right now: open the shop link
                    after you place the order (set by admin).
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {!isPreorder && (
                      <button
                        type="button"
                        onClick={() => setRevolutPayTiming("pay_on_delivery")}
                        className={clsx(
                          "rounded-xl border px-3 py-2 text-left text-sm",
                          revolutPayTiming === "pay_on_delivery"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-honey-border text-honey-text"
                        )}
                      >
                        <span className="font-semibold">Pay after receiving</span>
                        <span className="mt-0.5 block text-xs text-honey-muted">Order is accepted; you&apos;ll pay when you receive it.</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRevolutPayTiming("pay_now")}
                      className={clsx(
                        "rounded-xl border px-3 py-2 text-left text-sm",
                        revolutPayTiming === "pay_now"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-honey-border text-honey-text"
                      )}
                    >
                      <span className="font-semibold">Pay right now</span>
                      <span className="mt-0.5 block text-xs text-honey-muted">Use the admin payment link after placing the order.</span>
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
              {fulfillment === "delivery" &&
                userType === "team_member" &&
                remainderHuf > 0.01 &&
                remainderPay === "revolut" && (
                  <li className="flex justify-between text-xs">
                    <span>Revolut timing</span>
                    <span className="text-honey-text">
                      {revolutPayTiming === "pay_now" ? "Pay right now" : "Pay after receiving"}
                    </span>
                  </li>
                )}
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

      </div>
    </div>
  );
}
