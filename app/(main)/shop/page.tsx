"use client";

import { FulfillmentLocationsInfo } from "@/components/FulfillmentLocationsInfo";
import { LocationBanner } from "@/components/LocationBanner";
import { ProductCard } from "@/components/ProductCard";
import { LS_USER_TYPE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Product, ProductCategory, UserType } from "@/types";
import clsx from "clsx";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Filter = "all" | ProductCategory;

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!error && data) setProducts(data as Product[]);
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_USER_TYPE) as UserType | null;
      if (v === "team_member" || v === "guest") setUserType(v);
    } catch {
      /* Safari private / storage blocked */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    try {
      channel = supabase
        .channel("products-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          () => {
            load();
          }
        )
        .subscribe();
    } catch {
      /* Some Telegram / in-app browsers choke on Realtime WebSocket — polling via load() on focus is enough */
      return;
    }

    return () => {
      try {
        if (channel && supabase) supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [load]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = String(p.name ?? "");
      const desc = String(p.description ?? "");
      return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    });
  }, [products, filter, search]);

  return (
    <div className="space-y-8">
      <LocationBanner />
      <div className="relative overflow-hidden rounded-2xl border-2 border-honey-border bg-surface px-6 py-8 dark:bg-surface-dark">
        <div className="honeycomb-bg pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative z-10">
          <h1 className="font-display text-4xl text-honey-text">Shop</h1>
          <p className="mt-2 text-honey-muted">Flowers and vitamins — live stock, boutique feel.</p>
        </div>
      </div>

      <FulfillmentLocationsInfo />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "flower", "vitamin"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                filter === f
                  ? "bg-primary text-white shadow-md"
                  : "border border-honey-border bg-surface text-honey-muted hover:border-primary/30 dark:bg-surface-dark"
              )}
            >
              {f === "all" ? "All" : f === "flower" ? "Flowers" : "Vitamins"}
            </button>
          ))}
        </div>
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-honey-muted" />
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-honey-border bg-surface py-2.5 pl-10 pr-4 text-sm text-honey-text outline-none ring-primary/20 focus:ring-2 dark:bg-surface-dark"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-honey-border py-16 text-center text-honey-muted">
          No products match your filters. Try adjusting search or category.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} userType={userType} />
          ))}
        </div>
      )}
    </div>
  );
}
