"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { LS_REFERRED_BY, LS_TELEGRAM_USERNAME } from "@/lib/constants";
import { useShopCurrency } from "@/components/ShopCurrencyProvider";
import { getPriceForUser } from "@/lib/helpers";
import type { Product, UserType } from "@/types";
import { AlertCircle, ChevronLeft, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Step = 1 | 2 | 3;

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { unit } = getPriceForUser(product, userType);
  const baseTotal = unit * quantity;
  const isPreorder = Boolean(product.allow_preorder) && Number(product.stock_quantity) < quantity;

  const remainderHuf = useMemo(() => baseTotal, [baseTotal]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
  }, [open]);

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

  const bookingMode = !fulfillmentOptions.parcelLockerCheckout;

  function paymentMethodForSubmit(): string {
    if (bookingMode) return "booking";
    return "revolut";
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
    const pm = paymentMethodForSubmit();
    if (bookingMode && pm !== "booking") {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setLoading(true);
    try {
      const referred_by = typeof window !== "undefined" ? localStorage.getItem(LS_REFERRED_BY) : null;
      const customer_username = typeof window !== "undefined" ? localStorage.getItem(LS_TELEGRAM_USERNAME) : null;
      const body: Record<string, unknown> = {
        customer_token: token,
        product_id: product.id,
        quantity,
        user_type: userType,
        payment_method: pm,
        fulfillment_type: "dead_drop",
        bees_used: 0,
        points_used: 0,
        ...(referred_by ? { referred_by } : {}),
        ...(customer_username ? { customer_username } : {}),
        ...(bookingMode ? { booking_without_parcel_locker: true } : {}),
      };
      if (pm === "revolut") {
        body.revolut_pay_timing = "pay_now";
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
        } else if (res.status === 409) {
          setError(
            typeof data.error === "string"
              ? data.error
              : "Parcel pickup is paused. Use the booking flow when locker checkout is off."
          );
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
        revolutPayTiming: pm === "revolut" && remainderHuf > 0.01 ? "pay_now" : null,
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
        <div className="mb-4 flex items-center justify-between gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                if (step === 2) setStep(1);
                else if (step === 3) setStep(2);
              }}
              className="inline-flex items-center gap-1 text-sm text-honey-muted hover:text-honey-text"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <span className="flex-1 text-center text-xs font-semibold uppercase tracking-wide text-honey-muted">
            Checkout · Step {step} of 3
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-display text-xl text-honey-text">
              {bookingMode ? "Booking request" : "Parcel locker"}
            </h2>
            {!bookingMode && userType === "guest" && (
              <p className="text-sm text-honey-muted">
                Pickup is at a <span className="font-medium text-honey-text">parcel machine</span>.
                After your payment is accepted, the team sends the exact machine location and a{" "}
                <span className="font-medium text-honey-text">locker passcode</span> to open your compartment.
              </p>
            )}
            {!bookingMode && userType === "team_member" && (
              <p className="text-sm text-honey-muted">
                Pickup uses a <span className="font-medium text-honey-text">parcel locker</span>. After payment is
                approved, you&apos;ll get the machine location and <span className="font-medium text-honey-text">passcode</span>{" "}
                in your order.
              </p>
            )}
            {bookingMode && (
              <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-900 dark:text-sky-100">
                Parcel locker checkout is paused. You can still{" "}
                <span className="font-semibold text-honey-text">request this item</span> — no payment now. The team will
                review your booking and follow up when pickup is available again.
              </div>
            )}
            <div className="flex items-start gap-3 rounded-xl border border-honey-border p-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-honey-text">How it works</p>
                {bookingMode ? (
                  <>
                    <p className="mt-1 text-sm text-honey-muted">
                      Submit your request on the next steps. Your order stays as a booking until an admin accepts it.
                    </p>
                    <p className="mt-2 text-xs text-honey-muted">
                      Payment and pickup details are arranged after the team confirms.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-honey-muted">
                      For security, the team assigns the parcel machine and passcode only after your payment is approved.
                    </p>
                    <p className="mt-2 text-xs text-honey-muted">
                      You&apos;ll see carrier, location, and locker code on your order page.
                    </p>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              data-testid="checkout-parcel-locker-continue"
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">{bookingMode ? "Booking" : "Payment"}</h3>
            {bookingMode && (
              <p className="text-sm text-honey-muted">
                Order total <span className="font-medium text-honey-text">{formatPrice(baseTotal)}</span> — no payment is
                taken for this booking. If the team accepts, they will guide you on payment and pickup.
              </p>
            )}
            {!bookingMode && isPreorder && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Pre-order requires payment now.
              </div>
            )}
            {!bookingMode && (
              <p className="text-sm text-honey-muted">
                Order total {formatPrice(baseTotal)}. Pay with <strong className="text-honey-text">bank transfer</strong>{" "}
                (you will get a unique payment reference on the next step).
              </p>
            )}
            {!bookingMode && remainderHuf > 0.01 && (
              <div
                className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center"
                data-testid="checkout-pay-revolut"
              >
                <p className="text-sm font-semibold text-honey-text">Bank transfer</p>
                <p className="mt-1 text-xs text-honey-muted">Crypto checkout is paused — use the team&apos;s bank link and your order reference.</p>
              </div>
            )}
            {!bookingMode && isPreorder && userType === "team_member" && (
              <p className="text-xs text-honey-muted">Pre-orders require bank transfer payment now.</p>
            )}
            <button
              type="button"
              data-testid="checkout-review-order"
              onClick={() => setStep(3)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white"
            >
              {bookingMode ? "Review booking" : "Review order"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">{bookingMode ? "Confirm booking" : "Confirm"}</h3>
            <ul className="space-y-2 text-sm text-honey-muted">
              <li className="flex justify-between">
                <span>Product</span>
                <span className="text-honey-text">
                  {product.name} × {quantity}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Fulfillment</span>
                <span className="text-honey-text">{bookingMode ? "booking (locker paused)" : "parcel locker"}</span>
              </li>
              <li className="flex justify-between">
                <span>Payment</span>
                <span className="text-honey-text">{bookingMode ? "none now (booking)" : "Bank transfer"}</span>
              </li>
              <li className="flex justify-between border-t border-honey-border pt-2 font-semibold text-honey-text">
                <span>Total</span>
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
              data-testid="checkout-place-order"
              disabled={busy}
              onClick={() => void submitOrder()}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? (bookingMode ? "Sending…" : "Placing order…") : bookingMode ? "Submit booking" : "Place order"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
