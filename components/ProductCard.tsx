"use client";

import { useShopCurrency } from "@/components/ShopCurrencyProvider";
import { getPriceForUser } from "@/lib/helpers";
import type { Product, UserType } from "@/types";
import clsx from "clsx";
import Link from "next/link";
import { canDisplayProductImageUrl, ProductImage } from "./ProductImage";

interface ProductCardProps {
  product: Product;
  userType: UserType | null;
  categoryLabel?: string;
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

export function ProductCard({ product, userType, categoryLabel }: ProductCardProps) {
  const { formatPrice } = useShopCurrency();
  const { unit, isDiscounted } = getPriceForUser(product, userType);
  const stockRaw = Number(product.stock_quantity);
  const stock = Number.isFinite(stockRaw) ? stockRaw : 0;
  const out = stock <= 0;
  const preorderEnabled = out && Boolean(product.allow_preorder);
  const canOrder = !out || preorderEnabled;
  const low = stock > 0 && stock <= 5;
  const title = product.name?.trim() ? product.name : "Product";

  return (
    <div
      className={clsx(
        "card-hive group flex flex-col overflow-hidden rounded-lg transition duration-300",
        !canOrder ? "opacity-60" : "",
        preorderEnabled && "ring-2 ring-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
      )}
    >
      <Link
        href={canOrder ? `/product/${product.id}` : "#"}
        className={clsx("relative mx-auto mt-4 block w-[88%]", !canOrder && "pointer-events-none")}
      >
        <div className="hex-border relative aspect-square w-full max-w-[220px] mx-auto">
          <div className="relative h-full w-full overflow-hidden hex-clip bg-bg-secondary">
            {canDisplayProductImageUrl(product.image_url) ? (
              <ProductImage
                src={product.image_url!}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width:768px) 50vw, 25vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 font-display text-lg text-primary/60">
                {title}
              </div>
            )}
            {out && !preorderEnabled && (
              <span className="absolute left-2 top-2 rounded-sm bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-white">
                Out of Stock
              </span>
            )}
            {preorderEnabled && (
              <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                Pre-order open
              </span>
            )}
            {!out && (
              <span className="absolute bottom-2 right-2 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
                {stock} left
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {preorderEnabled && (
          <span className="mb-2 inline-flex w-fit items-center rounded-full border border-amber-400/70 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Pre-order
          </span>
        )}
        <span
          className={clsx(
            "mb-1 inline-block w-fit rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            "bg-primary/15 text-honey-text"
          )}
        >
          {categoryLabel ?? prettyCategory(product.category)}
        </span>
        <h3 className="font-display text-lg font-semibold text-honey-text">{title}</h3>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          {isDiscounted && (
            <span className="text-sm text-honey-muted line-through">{formatPrice(Number(product.price_regular))}</span>
          )}
          <span className={clsx("price text-2xl text-primary", isDiscounted && "font-semibold")}>
            {formatPrice(unit)}
          </span>
        </div>
        {!out && low && (
          <p className="mt-2 text-sm font-medium text-primary">Only {stock} left — order soon!</p>
        )}
        <Link
          href={canOrder ? `/product/${product.id}` : "#"}
          className={clsx(
            "btn-primary mt-4 inline-flex w-full items-center justify-center rounded px-4 py-2.5 text-center text-sm font-semibold",
            !canOrder ? "cursor-not-allowed opacity-50" : ""
          )}
          aria-disabled={!canOrder}
        >
          {preorderEnabled ? "Pre-order now" : canOrder ? "Order now" : "Out of stock"}
        </Link>
      </div>
    </div>
  );
}
