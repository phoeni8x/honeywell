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
  const [categoryName, setCategoryName] = useState<string | null>(null);
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
    if (!product?.category) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("name")
        .eq("slug", product.category)
        .maybeSingle();
      setCategoryName(typeof data?.name === "string" ? data.name : null);
    })();
  }, [product?.category]);

  useEffect(() => {
    if (!product) return;
    const out = product.stock_quantity <= 0;
    const preorderEnabled = out && Boolean(product.allow_preorder);
    const max = preorderEnabled ? 10 : Math.max(1, product.stock_quantity);
    setQty((q) => Math.min(Math.max(1, q), max));
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
  const out = product.stock_quantity <= 0;
  const preorderEnabled = out && Boolean(product.allow_preorder);
  const maxQty = preorderEnabled ? 10 : Math.max(1, product.stock_quantity);

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
    if (paymentMethod === "booking") {
      router.push(withToken("/order-history", { orderId }));
      return;
    }
    if (remainderHuf <= 0.01) {
      router.push(withToken("/order-history", { orderId }));
      return;
    }
    if (paymentMethod === "revolut" && revolutPayTiming === "pay_now") {
      router.push(withToken("/order-history", { orderId }));
      return;
    }
    router.push(withToken("/order-history", { orderId }));
  }

  function prettyCategory(raw: string | null | undefined): string {
    const s = String(raw ?? "").trim();
    if (!s) return "Product";
    return s
      .split(/[_-\s]+/g)
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join(" ");
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
            "bg-primary/10 text-primary"
          )}
        >
          {categoryName ?? prettyCategory(product.category)}
        </span>
        <h1 className="mt-3 font-display text-4xl text-honey-text md:text-5xl">{product.name}</h1>
        {product.description && (
          <p className="mt-4 max-w-prose text-pretty text-honey-muted">{product.description}</p>
        )}

        <div className="mt-6 flex flex-wrap items-baseline gap-3">
          {/* VIPs get the team_member price; don't show the crossed-out regular price */}
          {isDiscounted && userType !== "team_member" && (
            <span className="text-lg text-honey-muted line-through">
              {formatPrice(Number(product.price_regular))}
            </span>
          )}
          <span
            className={clsx("price text-4xl text-primary", isDiscounted && "font-semibold")}
            data-testid="product-display-price"
            data-user-type={userType ?? ""}
          >
            {formatPrice(unit)}
          </span>
        </div>

        {(preorderEnabled || out) && (
          <p className={clsx("mt-4 text-sm", "text-honey-muted")}>
            {preorderEnabled ? "Out of stock now, but pre-order is available." : "Out of stock"}
          </p>
        )}

        {(!out || preorderEnabled) && (
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
              data-testid="proceed-to-checkout"
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
