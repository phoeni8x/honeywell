"use client";

import { ADMIN_BASE_PATH } from "@/lib/constants";
import { parseShopCurrency, type ShopCurrency } from "@/lib/currency";
import { CRYPTO_COIN_OPTIONS, normalizeActiveCryptoCoin } from "@/lib/crypto-coins";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { parseFulfillmentOptionEnabled } from "@/lib/fulfillment-settings";
import { parseShopOpen } from "@/lib/shop-open";
import { parseSupportEnabled } from "@/lib/support-settings";
import { formatPrice, ORDER_STATUS_LABELS, truncateToken } from "@/lib/helpers";
import { PendingApprovalQueue } from "@/components/admin/PendingApprovalQueue";
import { useAdminPushNotifications } from "@/hooks/useAdminPushNotifications";
import { createClient } from "@/lib/supabase/client";
import type { Announcement, Order, Product } from "@/types";
import clsx from "clsx";
import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ShopLocationRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string | null;
  apple_maps_url: string | null;
  admin_message: string | null;
  photo_url: string | null;
  is_active: boolean;
};

type ProductCategoryRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order?: number;
  created_at: string;
};

type TicketRow = {
  id: string;
  stock_quantity: number;
  is_taken: boolean;
  taken_at: string | null;
  product_name: string;
  location_name: string;
  taken_by_order_id: string | null;
};

type SupportTicketRow = {
  id: string;
  ticket_number: string;
  customer_token: string;
  customer_username?: string | null;
  subject: string;
  status: string;
  updated_at: string;
  order_id: string | null;
};

const ORDER_STATUSES = [
  "payment_pending",
  "awaiting_dead_drop",
  "pre_ordered",
  "payment_expired",
  "waiting",
  "confirmed",
  "ready_at_drop",
  "ready_for_pickup",
  "out_for_delivery",
  "customer_arrived",
  "pickup_submitted",
  "pickup_flagged",
  "delivered",
  "picked_up",
  "cancelled",
] as const;

export default function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";

  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategoryRow[]>([]);
  const [orders, setOrders] = useState<(Order & { product?: Product | null })[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [shopLocations, setShopLocations] = useState<ShopLocationRow[]>([]);
  const [ticketRows, setTicketRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { state: adminPushState, subscribe: subscribeAdminPush } = useAdminPushNotifications();

  const supabase = useMemo(() => createClient(), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pRes, cRes, oRes, aRes, sRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase
        .from("product_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("*, products(*)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("*"),
    ]);

    if (pRes.data) setProducts(pRes.data as Product[]);
    if (cRes.data) setProductCategories(cRes.data as ProductCategoryRow[]);
    if (oRes.data) {
      setOrders(
        (oRes.data as Record<string, unknown>[]).map((row) => {
          const { products: prod, ...rest } = row;
          return { ...(rest as unknown as Order), product: prod as Product | null };
        })
      );
    }
    if (aRes.data) setAnnouncements(aRes.data as Announcement[]);
    if (sRes.data) {
      setSettings(Object.fromEntries(sRes.data.map((r: { key: string; value: string }) => [r.key, r.value])));
    }

    try {
      const locRes = await supabase.from("shop_locations").select("*").order("created_at", { ascending: false });
      if (locRes.data) setShopLocations(locRes.data as ShopLocationRow[]);
      const plsRes = await supabase
        .from("product_location_stock")
        .select("*, products(name), shop_locations(name)")
        .order("id", { ascending: false })
        .limit(300);
      if (plsRes.data) {
        setTicketRows(
          (plsRes.data as Record<string, unknown>[]).map((row) => ({
            id: row.id as string,
            stock_quantity: row.stock_quantity as number,
            is_taken: row.is_taken as boolean,
            taken_at: row.taken_at as string | null,
            product_name: (row.products as { name?: string } | null)?.name ?? "—",
            location_name: (row.shop_locations as { name?: string } | null)?.name ?? "—",
            taken_by_order_id: row.taken_by_order_id as string | null,
          }))
        );
      }
    } catch {
      setShopLocations([]);
      setTicketRows([]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function leaveAdmin() {
    router.push("/");
  }

  async function upsertSetting(key: string, value: string) {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    }
    setSettings((s) => ({ ...s, [key]: value }));
  }

  const shopCurrency = parseShopCurrency(settings.shop_currency);
  const todayKey = new Date().toISOString().slice(0, 10);
  const deliveredStatuses = new Set(["delivered", "picked_up"]);
  const salesToday = orders.filter((o) => o.created_at?.slice(0, 10) === todayKey).length;
  const cancelledTotal = orders.filter((o) => o.status === "cancelled").length;
  const cancelledToday = orders.filter(
    (o) => o.status === "cancelled" && o.created_at?.slice(0, 10) === todayKey
  ).length;
  const completedRevenueToday = orders
    .filter((o) => deliveredStatuses.has(String(o.status)) && o.created_at?.slice(0, 10) === todayKey)
    .reduce((sum, o) => sum + Number(o.total_price ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-honey-text">Dashboard</h1>
        <div className="flex items-center gap-2">
          {adminPushState !== "unsupported" && adminPushState !== "subscribed" && (
            <button
              type="button"
              onClick={() => void subscribeAdminPush()}
              className="rounded-full border border-honey-border px-4 py-2 text-xs font-semibold text-honey-text hover:bg-honey-border/30"
            >
              Enable admin push alerts
            </button>
          )}
          <button
            type="button"
            onClick={leaveAdmin}
            className="inline-flex items-center gap-2 rounded-full border border-honey-border px-4 py-2 text-sm font-medium text-honey-muted transition hover:bg-honey-border/30"
          >
            <LogOut className="h-4 w-4" />
            Back to site
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-honey-muted">
          <div className="hex-spinner" aria-hidden />
          <span>Loading…</span>
        </div>
      )}

      {tab === "overview" && !loading && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Products" value={products.length} />
          <Stat label="Orders" value={orders.length} />
          <Stat label="Announcements" value={announcements.length} />
          <Stat label="Sales today" value={salesToday} />
          <Stat label="Cancelled (today)" value={cancelledToday} />
          <Stat label="Cancelled (all)" value={cancelledTotal} />
          <div className="card-hive flex gap-4 rounded-xl p-6 sm:col-span-3 lg:col-span-2">
            <div className="hex-border relative flex h-14 w-12 shrink-0 items-center justify-center bg-bg-secondary hex-clip">
              <span className="font-display text-lg font-bold text-primary">Ft</span>
            </div>
            <div>
              <p className="text-sm text-honey-muted">Completed revenue today</p>
              <p className="mt-1 font-display text-3xl text-honey-text">
                {formatPrice(Math.round(completedRevenueToday), shopCurrency)}
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "products" && !loading && (
        <ProductsSection
          products={products}
          categories={productCategories}
          onRefresh={loadAll}
          supabase={supabase}
          shopCurrency={shopCurrency}
        />
      )}

      {tab === "orders" && !loading && (
        <OrdersSection orders={orders} onRefresh={loadAll} supabase={supabase} shopCurrency={shopCurrency} />
      )}

      {tab === "announcements" && !loading && (
        <AnnouncementsSection items={announcements} onRefresh={loadAll} supabase={supabase} />
      )}

      {tab === "locations" && !loading && (
        <LocationsSection locations={shopLocations} onRefresh={loadAll} supabase={supabase} />
      )}

      {tab === "tickets" && !loading && (
        <TicketsSection rows={ticketRows} />
      )}

      {tab === "support" && !loading && <SupportTicketsSection />}

      {tab === "settings" && !loading && (
        <SettingsSection settings={settings} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-hive flex gap-4 rounded-xl p-6">
      <div className="hex-border relative flex h-14 w-12 shrink-0 items-center justify-center bg-bg-secondary hex-clip">
        <span className="font-display text-lg font-bold text-primary">#</span>
      </div>
      <div>
        <p className="text-sm text-honey-muted">{label}</p>
        <p className="mt-1 font-display text-3xl text-honey-text">{value}</p>
      </div>
    </div>
  );
}

function ProductsSection({
  products,
  categories,
  onRefresh,
  supabase,
  shopCurrency,
}: {
  products: Product[];
  categories: ProductCategoryRow[];
  onRefresh: () => void;
  supabase: ReturnType<typeof createClient>;
  shopCurrency: ShopCurrency;
}) {
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState<string | null>(null);
  const [categoryOrderIds, setCategoryOrderIds] = useState<string[]>([]);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);

  const activeCategories = categories.filter((c) => c.is_active);
  const fallbackCategory = activeCategories[0]?.slug ?? categories[0]?.slug ?? "flower";
  const orderedCategories = categoryOrderIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is ProductCategoryRow => Boolean(c));

  function reportProductsError(context: string, error: unknown): void {
    console.error(`[admin products:${context}]`, error);
    alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
  }

  useEffect(() => {
    setCategoryOrderIds(categories.map((c) => c.id));
  }, [categories]);

  function slugifyCategoryName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  async function saveProduct() {
    if (!editing?.name) return;
    const payload = {
      name: editing.name,
      description: editing.description ?? null,
      category: editing.category ?? fallbackCategory,
      price_regular: Number(editing.price_regular ?? 0),
      price_team_member: Number(editing.price_team_member ?? 0),
      stock_quantity: Number(editing.stock_quantity ?? 0),
      image_url: editing.image_url ?? null,
      is_active: editing.is_active ?? true,
      allow_preorder: Boolean(editing.allow_preorder),
    };
    try {
      if (editing.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) {
          reportProductsError("saveProduct:update", error);
          return;
        }
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) {
          reportProductsError("saveProduct:insert", error);
          return;
        }
      }
      setEditing(null);
      onRefresh();
    } catch (error) {
      reportProductsError("saveProduct:unexpected", error);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const slug = slugifyCategoryName(name);
    if (!slug) return;
    setCategorySaving("add");
    try {
      const { error } = await supabase
        .from("product_categories")
        .upsert(
          {
            slug,
            name,
            is_active: true,
            sort_order: categories.length + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        );
      if (error) {
        reportProductsError("addCategory", error);
        return;
      }
      setNewCategoryName("");
      onRefresh();
    } catch (error) {
      reportProductsError("addCategory:unexpected", error);
    } finally {
      setCategorySaving(null);
    }
  }

  async function toggleCategory(cat: ProductCategoryRow, isActive: boolean) {
    setCategorySaving(cat.id + String(isActive));
    try {
      const { error } = await supabase
        .from("product_categories")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("id", cat.id);
      if (error) {
        reportProductsError("toggleCategory", error);
        return;
      }
      onRefresh();
    } catch (error) {
      reportProductsError("toggleCategory:unexpected", error);
    } finally {
      setCategorySaving(null);
    }
  }

  async function renameCategory(cat: ProductCategoryRow) {
    const next = prompt("Rename category", cat.name)?.trim();
    if (!next || next === cat.name) return;
    setCategorySaving("rename" + cat.id);
    try {
      const { error } = await supabase
        .from("product_categories")
        .update({ name: next, updated_at: new Date().toISOString() })
        .eq("id", cat.id);
      if (error) {
        reportProductsError("renameCategory", error);
        return;
      }
      onRefresh();
    } catch (error) {
      reportProductsError("renameCategory:unexpected", error);
    } finally {
      setCategorySaving(null);
    }
  }

  async function deleteCategory(cat: ProductCategoryRow) {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const { count, error: countError } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category", cat.slug);
    if (countError) {
      reportProductsError("deleteCategory:count", countError);
      return;
    }
    if ((count ?? 0) > 0) {
      alert("Cannot delete this category because products are still using it.");
      return;
    }
    setCategorySaving("del" + cat.id);
    try {
      const { error } = await supabase.from("product_categories").delete().eq("id", cat.id);
      if (error) {
        reportProductsError("deleteCategory:delete", error);
        return;
      }
      onRefresh();
    } catch (error) {
      reportProductsError("deleteCategory:unexpected", error);
    } finally {
      setCategorySaving(null);
    }
  }

  function moveCategory(dragId: string, targetId: string) {
    if (!dragId || !targetId || dragId === targetId) return;
    setCategoryOrderIds((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }

  function moveCategoryByStep(id: string, step: -1 | 1) {
    setCategoryOrderIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const nextIdx = idx + step;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[nextIdx]!;
      next[nextIdx] = temp!;
      return next;
    });
  }

  async function saveCategoryOrder() {
    setCategorySaving("order");
    try {
      const payload = categoryOrderIds.map((id, idx) => ({
        id,
        sort_order: idx + 1,
        updated_at: new Date().toISOString(),
      }));
      const results = await Promise.all(
        payload.map((p) =>
          supabase
            .from("product_categories")
            .update({ sort_order: p.sort_order, updated_at: p.updated_at })
            .eq("id", p.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        reportProductsError("saveCategoryOrder", failed.error);
        return;
      }
      onRefresh();
    } catch (error) {
      reportProductsError("saveCategoryOrder:unexpected", error);
    } finally {
      setCategorySaving(null);
    }
  }

  async function uploadImage(file: File, productId: string) {
    const path = `${productId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: true });
    if (error) {
      console.error("[admin uploadImage]", error);
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("products").getPublicUrl(path);
    const { error: updateError } = await supabase.from("products").update({ image_url: publicUrl }).eq("id", productId);
    if (updateError) {
      reportProductsError("uploadImage:update", updateError);
      return;
    }
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-honey-border p-4">
        <h2 className="font-display text-lg">Manage categories</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="New category name (e.g. Extracts)"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void addCategory()}
            disabled={categorySaving === "add"}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {categorySaving === "add" ? "Adding..." : "Add"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-honey-muted">Drag categories to reorder shop filter buttons.</p>
          <button
            type="button"
            disabled={categorySaving === "order"}
            onClick={() => void saveCategoryOrder()}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {categorySaving === "order" ? "Saving..." : "Save order"}
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {orderedCategories.map((c) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => setDraggingCategoryId(c.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggingCategoryId) moveCategory(draggingCategoryId, c.id);
                setDraggingCategoryId(null);
              }}
              onDragEnd={() => setDraggingCategoryId(null)}
              className="flex items-center gap-2 rounded-xl border border-honey-border px-3 py-2"
            >
              <span className="cursor-grab text-sm text-honey-muted">::</span>
              <span className="text-xs font-medium text-honey-text">
                {c.name} <span className="text-honey-muted">({c.slug})</span>
              </span>
              <span className="ml-auto text-[10px] text-honey-muted">{c.is_active ? "active" : "inactive"}</span>
              <button
                type="button"
                disabled={categorySaving !== null}
                onClick={() => void renameCategory(c)}
                className="text-xs text-primary hover:underline disabled:opacity-60"
              >
                Rename
              </button>
              <button
                type="button"
                disabled={categorySaving !== null}
                onClick={() => moveCategoryByStep(c.id, -1)}
                className="text-xs text-honey-muted hover:underline disabled:opacity-60"
                aria-label={`Move ${c.name} up`}
              >
                Up
              </button>
              <button
                type="button"
                disabled={categorySaving !== null}
                onClick={() => moveCategoryByStep(c.id, 1)}
                className="text-xs text-honey-muted hover:underline disabled:opacity-60"
                aria-label={`Move ${c.name} down`}
              >
                Down
              </button>
              <button
                type="button"
                disabled={categorySaving !== null}
                onClick={() => void toggleCategory(c, !c.is_active)}
                className="text-xs text-amber-700 hover:underline disabled:opacity-60 dark:text-amber-400"
              >
                {c.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                disabled={categorySaving !== null}
                onClick={() => void deleteCategory(c)}
                className="text-xs text-red-600 hover:underline disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          setEditing({
            name: "",
            category: fallbackCategory,
            price_regular: 0,
            price_team_member: 0,
            stock_quantity: 0,
            is_active: true,
            allow_preorder: false,
          })
        }
        className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
      >
        Add product
      </button>

      <div className="overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-3">Image</th>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Pre-order</th>
              <th className="p-3">Prices</th>
              <th className="p-3">Active</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-honey-border/60">
                <td className="p-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-bg">
                    {p.image_url ? (
                      <Image src={p.image_url} alt="" fill className="object-cover" />
                    ) : (
                      <span className="text-xs text-honey-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3 text-xs">{categories.find((c) => c.slug === p.category)?.name ?? p.category}</td>
                <td className="p-3">{p.stock_quantity}</td>
                <td className="p-3">{p.allow_preorder ? "Enabled" : "Disabled"}</td>
                <td className="p-3">
                  {formatPrice(Number(p.price_regular), shopCurrency)} /{" "}
                  {formatPrice(Number(p.price_team_member), shopCurrency)}
                </td>
                <td className="p-3">{p.is_active ? "Yes" : "No"}</td>
                <td className="p-3">
                  <button type="button" className="text-primary hover:underline" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-honey-border bg-surface p-6 dark:bg-surface-dark">
            <h2 className="font-display text-xl">{editing.id ? "Edit product" : "New product"}</h2>
            <div className="mt-4 space-y-3">
              <Field label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
              <label className="block text-xs font-semibold text-honey-muted">Description</label>
              <textarea
                className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                rows={3}
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
              <label className="text-xs font-semibold text-honey-muted">Category</label>
              <select
                className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                value={editing.category ?? fallbackCategory}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value as Product["category"] })
                }
              >
                {[...activeCategories, ...categories.filter((c) => !c.is_active && c.slug === editing.category)].map(
                  (c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                      {!c.is_active ? " (inactive)" : ""}
                    </option>
                  )
                )}
              </select>
              <Field
                label={`Regular price (${shopCurrency})`}
                type="number"
                value={String(editing.price_regular ?? 0)}
                onChange={(v) => setEditing({ ...editing, price_regular: Number(v) })}
              />
              <Field
                label={`Team price (${shopCurrency})`}
                type="number"
                value={String(editing.price_team_member ?? 0)}
                onChange={(v) => setEditing({ ...editing, price_team_member: Number(v) })}
              />
              <Field
                label="Stock"
                type="number"
                value={String(editing.stock_quantity ?? 0)}
                onChange={(v) => setEditing({ ...editing, stock_quantity: Number(v) })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active ?? true}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(editing.allow_preorder)}
                  onChange={(e) => setEditing({ ...editing, allow_preorder: e.target.checked })}
                />
                Allow pre-order when stock is empty
              </label>
              {editing.id && (
                <div>
                  <label className="text-xs font-semibold text-honey-muted">Upload image</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-1 block w-full text-sm"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && editing.id) uploadImage(f, editing.id);
                    }}
                  />
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-white"
                onClick={saveProduct}
              >
                Save
              </button>
              <button
                type="button"
                className="flex-1 rounded-full border border-honey-border py-2 text-sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
            {!editing.id && (
              <p className="mt-4 text-xs text-honey-muted">Save first, then upload an image using Edit.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-honey-muted">{label}</label>
      <input
        type={type}
        className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function OrdersSection({
  orders,
  onRefresh,
  supabase,
  shopCurrency,
}: {
  orders: (Order & { product?: Product | null })[];
  onRefresh: () => void;
  supabase: ReturnType<typeof createClient>;
  shopCurrency: ShopCurrency;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 3000);
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  async function setStatus(id: string, status: (typeof ORDER_STATUSES)[number]) {
    const key = id + status;
    setActionLoading(key);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        showToast("Failed to update status. Try again.", false);
        return;
      }
      if (status === "delivered" || status === "picked_up") {
        const rewardsRes = await fetch("/api/admin/orders/process-completed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ order_id: id }),
        });
        const rewardsData = (await rewardsRes.json().catch(() => ({}))) as { points_earned?: number };
        if (!rewardsRes.ok) {
          showToast("Status updated, but rewards processing failed. Please retry.", false);
          onRefresh();
          return;
        }
        const earned = Number(rewardsData.points_earned ?? 0);
        showToast(earned > 0 ? `Status updated ✓ +${earned} pts awarded.` : "Status updated ✓");
      } else {
        showToast("Status updated ✓");
      }
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function assignDeadDrop(id: string) {
    setActionLoading(id + "assign-dd");
    try {
      const res = await fetch("/api/admin/orders/assign-dead-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: id }),
      });
      if (!res.ok) {
        showToast("Could not assign dead drop. Check pool or try again.", false);
        return;
      }
      showToast("Dead drop assigned — customer notified ✓");
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmOrder(id: string) {
    setActionLoading(id + "confirm");
    try {
      const res = await fetch("/api/admin/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ order_id: id }),
      });
      if (!res.ok) {
        showToast("Could not confirm order. Try again.", false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        points_earned?: number;
        leveled_up?: boolean;
        level_name?: string;
      };
      let msg = "Order confirmed ✓";
      if (typeof data.points_earned === "number" && data.points_earned > 0) {
        msg += ` +${data.points_earned} pts awarded.`;
      }
      if (data.leveled_up && data.level_name) {
        msg += ` Customer reached ${data.level_name}!`;
      }
      showToast(msg);
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelOrder(order: Order & { product?: Product | null }) {
    const defer = Boolean(order.defer_stock_until_approval);
    const skipRestore =
      order.status === "awaiting_dead_drop" || (order.status === "payment_pending" && defer);
    const msg = skipRestore
      ? "Cancel this order? (No stock was deducted yet.)"
      : "Cancel this order and restore stock?";
    if (!confirm(msg)) return;
    setActionLoading(order.id + "cancel");
    try {
      if (!skipRestore) {
        const { error: rpcErr } = await supabase.rpc("restore_product_stock", {
          p_product_id: order.product_id,
          p_quantity: order.quantity,
        });
        if (rpcErr) {
          showToast("Failed to restore stock. Try again.", false);
          return;
        }
      }
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      if (error) {
        showToast("Failed to cancel order. Try again.", false);
        return;
      }
      showToast(skipRestore ? "Order cancelled ✓" : "Order cancelled and stock restored ✓");
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectOrderApi(id: string, reason: string) {
    const res = await fetch("/api/admin/orders/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order_id: id, reason }),
    });
    if (!res.ok) {
      await res.json().catch(() => ({}));
      showToast(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, false);
      return;
    }
    showToast("Order rejected ✓");
    onRefresh();
  }

  async function markPickedUp(order: Order & { product?: Product | null }) {
    if (!order.pickup_photo_url) {
      showToast(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, false);
      return;
    }
    await setStatus(order.id, "picked_up");
  }

  function fulfillmentActions(o: Order & { product?: Product | null }) {
    const ft = o.fulfillment_type;
    const isDelivery = ft === "delivery";
    const isDeadDrop = ft === "dead_drop";
    const isPickup = ft === "pickup";
    const legacyNoFt = ft == null || ft === "";
    /** Collection proof (photo) — dead drop and legacy orders without pickup/delivery type only */
    const canCollectProofFlow = (isDeadDrop || legacyNoFt) && !isPickup && !isDelivery;

    return (
      <>
        {o.status === "payment_pending" && (
          <button
            type="button"
            disabled={actionLoading !== null}
            className="text-left text-xs text-primary hover:underline disabled:opacity-50"
            onClick={() => confirmOrder(o.id)}
          >
            {o.fulfillment_type === "dead_drop"
              ? "Confirm payment received"
              : o.payment_method === "revolut"
                ? "Approve bank transfer payment"
                : "Confirm"}
          </button>
        )}

        {o.status === "awaiting_dead_drop" && o.fulfillment_type === "dead_drop" && (
          <button
            type="button"
            disabled={actionLoading !== null}
            className="text-left text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            onClick={() => void assignDeadDrop(o.id)}
          >
            Assign dead drop
          </button>
        )}

        {o.status === "pre_ordered" && (
          <>
            <button
              type="button"
              disabled={actionLoading !== null}
              className="text-left text-xs text-primary hover:underline disabled:opacity-50"
              onClick={() => setStatus(o.id, "confirmed")}
            >
              Pre-order accepted
            </button>
            <button
              type="button"
              disabled={actionLoading !== null}
              className="text-left text-xs text-red-600 hover:underline disabled:opacity-50"
              onClick={() => setStatus(o.id, "cancelled")}
            >
              Pre-order rejected/cancelled
            </button>
          </>
        )}

        {isDeadDrop && o.status === "confirmed" && (
          <button
            type="button"
            disabled={actionLoading !== null}
            className="text-left text-xs text-primary hover:underline disabled:opacity-50"
            onClick={() => setStatus(o.id, "ready_at_drop")}
          >
            Ready at drop
          </button>
        )}

        {canCollectProofFlow && o.status === "pickup_submitted" && (
          <button
            type="button"
            disabled={actionLoading !== null}
            className="text-left text-xs text-amber-700 hover:underline disabled:opacity-50 dark:text-amber-400"
            onClick={() => setStatus(o.id, "pickup_flagged")}
          >
            Flag proof for review
          </button>
        )}

        {o.pickup_photo_url && (
          <Link href={o.pickup_photo_url} target="_blank" className="text-xs text-primary hover:underline">
            View photo
          </Link>
        )}

        {canCollectProofFlow &&
          !["payment_pending", "picked_up", "cancelled", "payment_expired", "delivered"].includes(o.status) && (
            <button
              type="button"
              disabled={actionLoading !== null}
              className="text-left text-xs text-primary hover:underline disabled:opacity-50"
              onClick={() => markPickedUp(o)}
            >
              Collected
            </button>
          )}

        {(isPickup || isDelivery) && o.status !== "cancelled" && o.status !== "picked_up" && o.status !== "delivered" && (
          <span className="text-[11px] text-honey-muted">Legacy fulfillment — use cancel or DB if stuck</span>
        )}

        {o.status !== "cancelled" && o.status !== "picked_up" && o.status !== "delivered" && (
          <button
            type="button"
            disabled={actionLoading !== null}
            className="text-left text-xs text-red-600 hover:underline disabled:opacity-50"
            onClick={() => cancelOrder(o)}
          >
            Cancel + restore stock
          </button>
        )}
      </>
    );
  }

  return (
    <div className="relative space-y-4">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
      <PendingApprovalQueue
        orders={orders}
        shopCurrency={shopCurrency}
        onApproved={async (id) => {
          setActionLoading(id + "confirm");
          try {
            const res = await fetch("/api/admin/orders/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ order_id: id }),
            });
            const data = (await res.json().catch(() => ({}))) as {
              points_earned?: number;
              leveled_up?: boolean;
              level_name?: string;
            };
            if (!res.ok) {
              showToast(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, false);
              return;
            }
            let msg = "Order approved.";
            if (typeof data.points_earned === "number" && data.points_earned > 0) {
              msg += ` +${data.points_earned} pts awarded to customer.`;
            }
            if (data.leveled_up && data.level_name) {
              msg += ` Customer reached ${data.level_name}.`;
            }
            showToast(msg);
            onRefresh();
          } finally {
            setActionLoading(null);
          }
        }}
        onRejected={rejectOrderApi}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-medium",
            filter === "all" ? "bg-primary text-white" : "border border-honey-border"
          )}
        >
          All
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-medium",
              filter === s ? "bg-primary text-white" : "border border-honey-border"
            )}
          >
            {ORDER_STATUS_LABELS[s] ?? s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-2">Username</th>
              <th className="p-2">Fulfillment</th>
              <th className="p-2">Total</th>
              <th className="p-2">Actions</th>
              <th className="p-2 whitespace-nowrap">Order</th>
              <th className="p-2 whitespace-nowrap">Pay ref</th>
              <th className="p-2">Product</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Time</th>
              <th className="p-2">Points Used</th>
              <th className="p-2">Type</th>
              <th className="p-2">Pay</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-honey-border/60 align-top">
                <td className="p-2 text-xs">
                  {o.customer_username ? `@${o.customer_username}` : "—"}
                </td>
                <td className="p-2 text-xs">
                  {o.fulfillment_type ?? "—"}
                  {(o.fulfillment_type === "pickup" || o.fulfillment_type === "delivery") && (
                    <span className="mt-1 block text-[10px] uppercase text-amber-700 dark:text-amber-400">legacy</span>
                  )}
                  {o.fulfillment_type === "delivery" && o.delivery_address && (
                    <span className="mt-1 block max-w-[140px] text-honey-muted">{o.delivery_address}</span>
                  )}
                </td>
                <td className="p-2">{formatPrice(Number(o.total_price), shopCurrency)}</td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">{fulfillmentActions(o)}</div>
                </td>
                <td className="p-2">
                  <span className="font-mono text-xs font-bold text-primary whitespace-nowrap">
                    {o.order_number ?? "—"}
                  </span>
                </td>
                <td className="p-2">
                  <span className="font-mono text-[11px] font-semibold text-honey-text">
                    {(o as Order & { payment_reference_code?: string | null }).payment_reference_code ?? "—"}
                  </span>
                </td>
                <td className="p-2">{o.product?.name ?? "—"}</td>
                <td className="p-2">{o.quantity}</td>
                <td className="p-2 text-xs text-honey-muted">
                  <span className="block font-medium text-honey-text">
                    {new Date(o.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <span className="block text-[11px] text-honey-muted">
                    {new Date(o.created_at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </td>
                <td className="p-2 text-xs">
                  {Number(o.points_used ?? 0) > 0 ? `${Number(o.points_used)} pts` : "No"}
                </td>
                <td className="p-2">{o.user_type}</td>
                <td className="p-2">
                  {o.payment_method === "revolut" ? "bank transfer" : (o.payment_method ?? "—")}
                </td>
                <td className="p-2 text-xs">{ORDER_STATUS_LABELS[o.status] ?? o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnnouncementsSection({
  items,
  onRefresh,
  supabase,
}: {
  items: Announcement[];
  onRefresh: () => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBody, setEditingBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function add() {
    if (!title.trim() || !body.trim()) return;
    await supabase.from("announcements").insert({ title, body, is_active: true });
    setTitle("");
    setBody("");
    onRefresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    onRefresh();
  }

  function beginEdit(a: Announcement) {
    setEditingId(a.id);
    setEditingTitle(a.title);
    setEditingBody(a.body);
  }

  async function saveEdit(id: string) {
    if (!editingTitle.trim() || !editingBody.trim()) return;
    setBusyId(id);
    await supabase
      .from("announcements")
      .update({ title: editingTitle.trim(), body: editingBody.trim() })
      .eq("id", id);
    setEditingId(null);
    setBusyId(null);
    onRefresh();
  }

  async function toggleActive(id: string, next: boolean) {
    setBusyId(id);
    await supabase.from("announcements").update({ is_active: next }).eq("id", id);
    setBusyId(null);
    onRefresh();
  }

  async function resend(a: Announcement) {
    setBusyId(a.id);
    await supabase.from("announcements").insert({
      title: a.title,
      body: a.body,
      is_active: true,
    });
    setBusyId(null);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-honey-border p-4">
        <h2 className="font-display text-lg">New announcement</h2>
        <input
          className="mt-2 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="mt-2 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          rows={4}
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          onClick={add}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Publish
        </button>
      </div>

      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-4 rounded-2xl border border-honey-border p-4">
            <div className="flex-1">
              {editingId === a.id ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                  />
                  <textarea
                    className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                    rows={4}
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(a.id)}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-honey-border px-4 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium">{a.title}</p>
                  <p className="mt-1 text-sm text-honey-muted whitespace-pre-wrap">{a.body}</p>
                  <p className="mt-1 text-xs text-honey-muted">{a.is_active ? "Active" : "Inactive"}</p>
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                disabled={busyId === a.id}
                className="text-xs text-honey-text hover:underline disabled:opacity-60"
                onClick={() => beginEdit(a)}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busyId === a.id}
                className="text-xs text-primary hover:underline disabled:opacity-60"
                onClick={() => void resend(a)}
              >
                Send again
              </button>
              <button
                type="button"
                disabled={busyId === a.id}
                className="text-xs text-amber-700 hover:underline disabled:opacity-60 dark:text-amber-400"
                onClick={() => void toggleActive(a.id, !a.is_active)}
              >
                {a.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                disabled={busyId === a.id}
                className="text-xs text-red-600 hover:underline disabled:opacity-60"
                onClick={() => void remove(a.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsSection({
  settings,
}: {
  settings: Record<string, string>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(settings);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  async function saveSetting(key: string, value: string) {
    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        alert("Saved!");
        setSavedKey(key);
        window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1800);
      } else {
        alert("Failed to save: " + res.status);
      }
    } catch (e) {
      alert("Error: " + e);
    } finally {
      setSavingKey(null);
    }
  }

  const keys = [
    {
      key: "revolut_payment_link",
      label: "Bank transfer payment URL (team checkout — pay now link)",
    },
    { key: "crypto_tutorial_video_url", label: "Crypto guide — tutorial video embed URL (YouTube embed)" },
    { key: "crypto_wallet_app_name", label: "Crypto guide — recommended wallet app name" },
    { key: "crypto_wallet_app_url", label: "Crypto guide — wallet download link" },
    { key: "crypto_exchange_name", label: "Crypto guide — recommended exchange name" },
    { key: "crypto_exchange_url", label: "Crypto guide — exchange link" },
    { key: "shop_address", label: "Shop address (display)" },
    { key: "maps_query", label: "Maps search query (optional override)" },
    { key: "hero_tagline", label: "Home hero tagline" },
    { key: "TELEGRAM_BOT_TOKEN", label: "Telegram bot token (server env preferred)" },
    { key: "TELEGRAM_CHANNEL_ID", label: "Telegram channel ID (server env preferred)" },
  ];

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-honey-muted">
        Sensitive keys should live in <code className="rounded bg-honey-border/40 px-1">.env.local</code> for production.
        Values here are stored in Supabase for convenience.
      </p>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Shop display currency</label>
        <p className="mt-1 text-xs text-honey-muted">
          Product and order amounts are stored as numbers; this only changes how prices are shown (shop, checkout, admin).
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={(draft.shop_currency === "EUR" ? "EUR" : "HUF")}
            onChange={(e) => setDraft((d) => ({ ...d, shop_currency: e.target.value }))}
          >
            <option value="HUF">Hungarian Forint (HUF)</option>
            <option value="EUR">Euro (EUR)</option>
          </select>
          <button
            type="button"
            disabled={savingKey === "shop_currency"}
            onClick={() => saveSetting("shop_currency", draft.shop_currency ?? "HUF")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "shop_currency" ? "Saving..." : "Save"}
          </button>
        </div>
        {savedKey === "shop_currency" && <p className="mt-1 text-xs text-green-600">Saved</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Shop status</label>
        <p className="mt-1 text-xs text-honey-muted">
          When closed, customers cannot start checkout or place new orders.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={parseShopOpen(draft.shop_open) ? "1" : "0"}
            onChange={(e) => setDraft((d) => ({ ...d, shop_open: e.target.value }))}
          >
            <option value="1">Open</option>
            <option value="0">Closed</option>
          </select>
          <button
            type="button"
            disabled={savingKey === "shop_open"}
            onClick={() => saveSetting("shop_open", draft.shop_open ?? "1")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "shop_open" ? "Saving..." : "Save"}
          </button>
        </div>
        {savedKey === "shop_open" && <p className="mt-1 text-xs text-green-600">Saved</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Support system</label>
        <p className="mt-1 text-xs text-honey-muted">
          Turn this off when the team is unavailable. Customers can still view old tickets, but cannot open new tickets or send replies.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={parseSupportEnabled(draft.support_enabled) ? "1" : "0"}
            onChange={(e) => setDraft((d) => ({ ...d, support_enabled: e.target.value }))}
          >
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
          <button
            type="button"
            disabled={savingKey === "support_enabled"}
            onClick={() => saveSetting("support_enabled", draft.support_enabled ?? "1")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "support_enabled" ? "Saving..." : "Save"}
          </button>
        </div>
        {savedKey === "support_enabled" && <p className="mt-1 text-xs text-green-600">Saved</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Maintenance mode</label>
        <p className="mt-1 text-xs text-honey-muted">
          When enabled, customers are blocked and only see an under-development message. Admin pages stay available for testing.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={(draft.maintenance_mode === "1" ? "1" : "0")}
            onChange={(e) => setDraft((d) => ({ ...d, maintenance_mode: e.target.value }))}
          >
            <option value="0">Off</option>
            <option value="1">On</option>
          </select>
          <button
            type="button"
            disabled={savingKey === "maintenance_mode"}
            onClick={() => saveSetting("maintenance_mode", draft.maintenance_mode ?? "0")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "maintenance_mode" ? "Saving..." : "Save"}
          </button>
        </div>
        {savedKey === "maintenance_mode" && <p className="mt-1 text-xs text-green-600">Saved</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Maintenance message</label>
        <p className="mt-1 text-xs text-honey-muted">
          Main text customers see while maintenance mode is enabled.
        </p>
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            rows={3}
            value={
              draft.maintenance_message ??
              "Honey Well is currently under maintenance and testing. Please check back later."
            }
            onChange={(e) => setDraft((d) => ({ ...d, maintenance_message: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
          />
          <button
            type="button"
            disabled={savingKey === "maintenance_message"}
            onClick={() => saveSetting("maintenance_message", draft.maintenance_message ?? "")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "maintenance_message" ? "Saving..." : "Save"}
          </button>
          {savedKey === "maintenance_message" && <p className="text-xs text-green-600">Saved</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Maintenance ETA / time (optional)</label>
        <p className="mt-1 text-xs text-honey-muted">
          Optional second line, for example: &quot;Back around 18:30 CET&quot;.
        </p>
        <div className="mt-2 space-y-2">
          <input
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={draft.maintenance_eta ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, maintenance_eta: e.target.value }))}
          />
          <button
            type="button"
            disabled={savingKey === "maintenance_eta"}
            onClick={() => saveSetting("maintenance_eta", draft.maintenance_eta ?? "")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "maintenance_eta" ? "Saving..." : "Save"}
          </button>
          {savedKey === "maintenance_eta" && <p className="text-xs text-green-600">Saved</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Active crypto coin</label>
        <p className="mt-1 text-xs text-honey-muted">
          Checkout and crypto payment pages use this asset for the exact amount to send. Use a wallet address on the
          same network (e.g. Solana address for SOL).
        </p>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={normalizeActiveCryptoCoin(draft.active_crypto_coin)}
            onChange={(e) => setDraft((d) => ({ ...d, active_crypto_coin: e.target.value }))}
          >
            {CRYPTO_COIN_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.symbol})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={savingKey === "active_crypto_coin"}
            onClick={() => saveSetting("active_crypto_coin", draft.active_crypto_coin ?? "")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "active_crypto_coin" ? "Saving..." : "Save"}
          </button>
        </div>
        {savedKey === "active_crypto_coin" && <p className="mt-1 text-xs text-green-600">Saved</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Crypto network</label>
        <p className="mt-1 text-xs text-honey-muted">
          Shown on the payment page so customers send on the correct chain (e.g. Ethereum mainnet, Solana, Bitcoin
          network, Arbitrum, TRC20 for USDT).
        </p>
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            rows={2}
            value={draft.crypto_network ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, crypto_network: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
            placeholder="e.g. Ethereum mainnet (ERC-20)"
          />
          <button
            type="button"
            disabled={savingKey === "crypto_network"}
            onClick={() => saveSetting("crypto_network", draft.crypto_network ?? "")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "crypto_network" ? "Saving..." : "Save"}
          </button>
          {savedKey === "crypto_network" && <p className="text-xs text-green-600">Saved</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Crypto wallet address (receiving)</label>
        <p className="mt-1 text-xs text-honey-muted">Must match the coin and network above. Customers can copy this on the payment page.</p>
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            rows={2}
            value={draft.crypto_wallet_address ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, crypto_wallet_address: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
            placeholder="Paste the deposit address"
          />
          <button
            type="button"
            disabled={savingKey === "crypto_wallet_address"}
            onClick={() => saveSetting("crypto_wallet_address", draft.crypto_wallet_address ?? "")}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "crypto_wallet_address" ? "Saving..." : "Save"}
          </button>
          {savedKey === "crypto_wallet_address" && <p className="text-xs text-green-600">Saved</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Dead drop checkout</label>
        <p className="mt-1 text-xs text-honey-muted">
          All new orders use dead drop. When disabled, customers cannot complete checkout. Manage slots under Fulfillment
          → Dead drops.
        </p>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <select
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={parseFulfillmentOptionEnabled(draft.fulfillment_dead_drop_enabled) ? "1" : "0"}
              onChange={(e) => setDraft((d) => ({ ...d, fulfillment_dead_drop_enabled: e.target.value }))}
            >
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
            <button
              type="button"
              disabled={savingKey === "fulfillment_dead_drop_enabled"}
              onClick={() => saveSetting("fulfillment_dead_drop_enabled", draft.fulfillment_dead_drop_enabled ?? "1")}
              className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {savingKey === "fulfillment_dead_drop_enabled" ? "Saving..." : "Save"}
            </button>
          </div>
          {savedKey === "fulfillment_dead_drop_enabled" && <p className="mt-1 text-xs text-green-600">Saved</p>}
        </div>
      </div>
      {keys.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-semibold text-honey-muted">{label}</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            rows={2}
            value={draft[key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
          />
          <button
            type="button"
            disabled={savingKey === key}
            onClick={() => saveSetting(key, draft[key] ?? "")}
            className="mt-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === key ? "Saving..." : "Save"}
          </button>
          {savedKey === key && <p className="mt-1 text-xs text-green-600">Saved</p>}
        </div>
      ))}
    </div>
  );
}

function LocationsSection({
  locations,
  onRefresh,
  supabase,
}: {
  locations: ShopLocationRow[];
  onRefresh: () => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [draft, setDraft] = useState({
    name: "",
    latitude: "",
    longitude: "",
    google_maps_url: "",
    apple_maps_url: "",
    admin_message: "",
  });

  async function addLocation() {
    if (!draft.name.trim()) return;
    await supabase.from("shop_locations").insert({
      name: draft.name.trim(),
      latitude: Number(draft.latitude) || 0,
      longitude: Number(draft.longitude) || 0,
      google_maps_url: draft.google_maps_url || null,
      apple_maps_url: draft.apple_maps_url || null,
      admin_message: draft.admin_message || null,
      is_active: true,
    });
    setDraft({
      name: "",
      latitude: "",
      longitude: "",
      google_maps_url: "",
      apple_maps_url: "",
      admin_message: "",
    });
    onRefresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this location?")) return;
    await supabase.from("shop_locations").delete().eq("id", id);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-honey-border p-4">
        <h2 className="font-display text-lg">Add location</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <input
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Latitude"
            value={draft.latitude}
            onChange={(e) => setDraft((d) => ({ ...d, latitude: e.target.value }))}
          />
          <input
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Longitude"
            value={draft.longitude}
            onChange={(e) => setDraft((d) => ({ ...d, longitude: e.target.value }))}
          />
          <input
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Google Maps URL"
            value={draft.google_maps_url}
            onChange={(e) => setDraft((d) => ({ ...d, google_maps_url: e.target.value }))}
          />
          <input
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Apple Maps URL"
            value={draft.apple_maps_url}
            onChange={(e) => setDraft((d) => ({ ...d, apple_maps_url: e.target.value }))}
          />
          <textarea
            className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm md:col-span-2"
            rows={2}
            placeholder="Customer message"
            value={draft.admin_message}
            onChange={(e) => setDraft((d) => ({ ...d, admin_message: e.target.value }))}
          />
        </div>
        <button
          type="button"
          onClick={addLocation}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Save location
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Coords</th>
              <th className="p-3">Active</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id} className="border-b border-honey-border/60">
                <td className="p-3 font-medium">{l.name}</td>
                <td className="p-3 text-xs text-honey-muted">
                  {l.latitude}, {l.longitude}
                </td>
                <td className="p-3">{l.is_active ? "Yes" : "No"}</td>
                <td className="p-3">
                  <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => remove(l.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupportTicketsSection() {
  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [statusPick, setStatusPick] = useState<Record<string, string>>({});
  const [replyError, setReplyError] = useState<Record<string, string>>({});

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const res = await fetch("/api/admin/tickets", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { tickets?: SupportTicketRow[] };
      if (res.ok && json.tickets) {
        setRows(json.tickets);
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load({ quiet: true });
    }, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  async function sendReply(id: string) {
    const message = replyText[id]?.trim();
    if (!message) return;
    setReplyError((e) => ({ ...e, [id]: "" }));
    const row = rows.find((r) => r.id === id);
    const nextStatus = statusPick[id] ?? row?.status ?? "open";
    const res = await fetch("/api/admin/tickets/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ticket_id: id, message, status: nextStatus }),
    });
    if (!res.ok) {
      await res.json().catch(() => ({}));
      setReplyError((e) => ({ ...e, [id]: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }));
      return;
    }
    setReplyText((r) => ({ ...r, [id]: "" }));
    setReplyError((e) => ({ ...e, [id]: "" }));
    void load({ quiet: true });
  }

  async function deleteChat(id: string) {
    if (!confirm("Delete this chat history now? This cannot be undone.")) return;
    const res = await fetch("/api/admin/tickets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mode: "ticket", ticket_id: id }),
    });
    if (!res.ok) {
      setReplyError((e) => ({ ...e, [id]: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }));
      return;
    }
    setReplyError((e) => ({ ...e, [id]: "" }));
    void load({ quiet: true });
  }

  if (loading) {
    return <p className="text-honey-muted">Loading support tickets…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-honey-muted">
        For threaded chat and internal notes, use the{" "}
        <Link href={`${ADMIN_BASE_PATH}/tickets`} className="font-medium text-primary underline">
          support inbox
        </Link>
        .
      </p>
      <div className="overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-3">Ticket</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Username</th>
              <th className="p-3">Subject</th>
              <th className="p-3">Updated</th>
              <th className="p-3">Reply</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-honey-border/60 align-top">
                <td className="p-3 font-mono text-xs">{row.ticket_number}</td>
                <td className="p-3 font-mono text-xs">{truncateToken(row.customer_token)}</td>
                <td className="p-3 text-xs">{row.customer_username ? `@${row.customer_username}` : "—"}</td>
                <td className="p-3 max-w-[220px]">{row.subject}</td>
                <td className="p-3 text-xs text-honey-muted">
                  {new Date(row.updated_at).toLocaleString("en-GB")}
                </td>
                <td className="p-3 min-w-[280px]">
                  <p className="mb-1 text-xs text-honey-muted">Status: {row.status}</p>
                  <select
                    className="mb-2 w-full rounded border border-honey-border bg-bg px-2 py-1 text-xs"
                    value={statusPick[row.id] ?? row.status}
                    onChange={(e) => setStatusPick((s) => ({ ...s, [row.id]: e.target.value }))}
                  >
                    <option value="open">open</option>
                    <option value="in_progress">in_progress</option>
                    <option value="resolved">resolved</option>
                    <option value="closed">closed</option>
                  </select>
                  <textarea
                    className="min-h-[64px] w-full rounded border border-honey-border bg-bg px-2 py-1 text-xs"
                    placeholder="Reply to customer…"
                    value={replyText[row.id] ?? ""}
                    onChange={(e) => setReplyText((r) => ({ ...r, [row.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => sendReply(row.id)}
                    className="mt-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Send reply
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteChat(row.id)}
                    className="mt-1 block text-xs font-semibold text-red-600 hover:underline"
                  >
                    Delete chat
                  </button>
                  {replyError[row.id] && (
                    <p className="mt-1 text-xs text-red-600">{replyError[row.id]}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-honey-muted">No support tickets yet.</p>}
    </div>
  );
}

function TicketsSection({ rows }: { rows: TicketRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-honey-border">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
          <tr>
            <th className="p-3">Product</th>
            <th className="p-3">Location</th>
            <th className="p-3">Stock</th>
            <th className="p-3">Slot</th>
            <th className="p-3">Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-honey-border/60">
              <td className="p-3">{r.product_name}</td>
              <td className="p-3">{r.location_name}</td>
              <td className="p-3">{r.stock_quantity}</td>
              <td className="p-3">{r.is_taken ? "TAKEN" : "AVAILABLE"}</td>
              <td className="p-3 font-mono text-xs">{r.taken_by_order_id ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
