"use client";

import { CheckoutFlow } from "@/components/CheckoutFlow";
import { LS_USER_TYPE } from "@/lib/constants";
import { setCustomerToken } from "@/lib/customer-token";
import { useShopCurrency } from "@/components/ShopCurrencyProvider";
import { getPriceForUser } from "@/lib/helpers";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createClient } from "@/lib/supabase/client";
import type { Product, UserType } from "@/types";
import { canDisplayProductImageUrl, ProductImage } from "@/components/ProductImage";
import clsx from "clsx";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProductPage() {
  const { formatPrice, shopOpen } = useShopCurrency();
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [qty, setQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const v = localStorage.getItem(LS_USER_TYPE) as UserType | null;
    if (v === "team_member" || v === "guest") setUserType(v);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error: err } = await supabase.from("products").select("*").eq("id", id).single();
      if (err || !data) {
        setProduct(null);
        return;
      }
      setProduct(data as Product);
    })();
  }, [id]);

  useEffect(() => {
    if (!product) return;
    setQty((q) => Math.min(Math.max(1, q), Math.max(1, product.stock_quantity)));
  }, [product]);

  if (!product) {
    return (
      <div className="py-20 text-center">
        <p className="text-honey-muted">Product not found.</p>
        <Link href="/shop" className="mt-4 inline-block text-primary underline">
          Back to shop
        </Link>
      </div>
    );
  }

  const { unit, isDiscounted } = getPriceForUser(product, userType);
  const maxQty = Math.max(1, product.stock_quantity);
  const out = product.stock_quantity <= 0;

  function handleCheckoutSuccess({
    orderId,
    paymentMethod,
    remainderHuf,
    revolutPayTiming,
    customerToken,
  }: {
    orderId: string;
    paymentMethod: string;
    remainderHuf: number;
    revolutPayTiming?: "pay_now" | "pay_on_delivery" | null;
    customerToken: string;
  }) {
    const token = setCustomerToken(customerToken);
    const withToken = (path: string, params: Record<string, string>) => {
      const sp = new URLSearchParams(params);
      if (token) sp.set("ct", token);
      return `${path}?${sp.toString()}`;
    };
    setCheckoutOpen(false);
    if (remainderHuf <= 0.01) {
      router.push(withToken("/order-history", { orderId }));
      return;
    }
    if (paymentMethod === "crypto") {
      router.push(withToken("/pay/crypto", { orderId }));
      return;
    }
    if (paymentMethod === "revolut" && revolutPayTiming === "pay_now") {
      router.push(withToken("/order-history", { revolut: "1", orderId }));
      return;
    }
    router.push(withToken("/order-history", { orderId }));
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="relative mx-auto w-full max-w-md">
        <div className="hex-border relative aspect-square w-full">
          <div className="relative h-full w-full overflow-hidden hex-clip bg-bg-secondary">
            {canDisplayProductImageUrl(product.image_url) ? (
              <ProductImage src={product.image_url!} alt={product.name} fill className="object-cover" priority />
            ) : (
              <div className="flex h-full items-center justify-center font-display text-2xl text-primary/50">
                {product.name}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <span
          className={clsx(
            "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase",
            product.category === "flower"
              ? "bg-blush/80 text-honey-text"
              : "bg-primary/10 text-primary"
          )}
        >
          {product.category === "flower" ? "Flower" : "Vitamin"}
        </span>
        <h1 className="mt-3 font-display text-4xl text-honey-text md:text-5xl">{product.name}</h1>
        {product.description && (
          <p className="mt-4 max-w-prose text-pretty text-honey-muted">{product.description}</p>
        )}

        <div className="mt-6 flex flex-wrap items-baseline gap-3">
          {isDiscounted && (
            <span className="text-lg text-honey-muted line-through">
              {formatPrice(Number(product.price_regular))}
            </span>
          )}
          <span className={clsx("price text-4xl text-primary", isDiscounted && "font-semibold")}>
            {formatPrice(unit)}
          </span>
        </div>

        <p className={clsx("mt-4 text-sm", out ? "text-honey-muted" : "text-honey-muted")}>
          {out ? "Out of Stock" : `${product.stock_quantity} available`}
        </p>

        {!out && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-full border border-honey-border bg-surface dark:bg-surface-dark">
              <button
                type="button"
                className="px-4 py-2 text-lg font-medium"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span className="min-w-[2rem] text-center font-semibold">{qty}</span>
              <button
                type="button"
                className="px-4 py-2 text-lg font-medium"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={!shopOpen}
              onClick={() => {
                if (!shopOpen) {
                  setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
                  return;
                }
                setError(null);
                setCheckoutOpen(true);
              }}
              className={clsx(
                "px-8 py-3 text-sm text-on-primary",
                shopOpen ? "btn-primary" : "cursor-not-allowed rounded-full bg-honey-border/80 text-honey-muted"
              )}
            >
              {shopOpen ? "Proceed to checkout" : "Shop is closed"}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <CheckoutFlow
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          product={product}
          quantity={qty}
          userType={userType}
          onSuccess={handleCheckoutSuccess}
        />
      </div>
    </div>
  );
}
