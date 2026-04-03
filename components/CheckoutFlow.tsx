"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { LS_REFERRED_BY, LS_TELEGRAM_USERNAME } from "@/lib/constants";
import { useShopCurrency } from "@/components/ShopCurrencyProvider";
import { getPriceForUser } from "@/lib/helpers";
import type { Product, UserType } from "@/types";
import clsx from "clsx";
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

  const [remainderPay, setRemainderPay] = useState<"revolut" | "crypto">("crypto");
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

  useEffect(() => {
    if (!open) return;
    if (userType === "guest") setRemainderPay("crypto");
  }, [open, userType]);

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

  function paymentMethodForSubmit(): string {
    if (remainderHuf <= 0.01) return "crypto";
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
    if (!fulfillmentOptions.deadDrop) {
      setError("Dead drop is not available right now. Please contact support.");
      return;
    }
    const pm = paymentMethodForSubmit();
    if (userType === "guest" && pm === "revolut") {
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

  const deadDropOff = !fulfillmentOptions.deadDrop;

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
            <h2 className="font-display text-xl text-honey-text">Dead drop</h2>
            {userType === "guest" && (
              <p className="text-sm text-honey-muted">
                Orders are fulfilled via <span className="font-medium text-honey-text">dead drop</span>. Exact location
                details are shared privately after your order is accepted.
              </p>
            )}
            {userType === "team_member" && (
              <p className="text-sm text-honey-muted">
                All orders use <span className="font-medium text-honey-text">dead drop</span>. Exact location details are
                assigned privately after payment.
              </p>
            )}
            {deadDropOff && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                Dead drop is temporarily unavailable. Please contact support.
              </div>
            )}
            <div className="flex items-start gap-3 rounded-xl border border-honey-border p-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold text-honey-text">How it works</p>
                <p className="mt-1 text-sm text-honey-muted">
                  For security, exact dead-drop location details are assigned privately after your order is accepted.
                </p>
                <p className="mt-2 text-xs text-honey-muted">
                  Your exact drop is assigned privately after payment is approved.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={deadDropOff}
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Payment</h3>
            {isPreorder && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Pre-order requires payment now.
              </div>
            )}
            <p className="text-sm text-honey-muted">
              Order total {formatPrice(baseTotal)}. Choose how you want to pay:
              {userType === "team_member" ? " bank transfer or cryptocurrency." : " cryptocurrency."}
            </p>
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
                      Bank transfer
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
            {isPreorder && userType === "team_member" && remainderPay === "revolut" && (
              <p className="text-xs text-honey-muted">Pre-orders require bank transfer payment now.</p>
            )}
            <button type="button" onClick={() => setStep(3)} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white">
              Review order
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg text-honey-text">Confirm</h3>
            <ul className="space-y-2 text-sm text-honey-muted">
              <li className="flex justify-between">
                <span>Product</span>
                <span className="text-honey-text">
                  {product.name} × {quantity}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Fulfillment</span>
                <span className="text-honey-text">dead drop</span>
              </li>
              <li className="flex justify-between">
                <span>Payment</span>
                <span className="text-honey-text">{paymentMethodForSubmit()}</span>
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
              disabled={busy}
              onClick={() => void submitOrder()}
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
