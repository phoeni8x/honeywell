"use client";

import { ADMIN_BASE_PATH } from "@/lib/constants";
import { parseShopCurrency, type ShopCurrency } from "@/lib/currency";
import { CRYPTO_COIN_OPTIONS, normalizeActiveCryptoCoin } from "@/lib/crypto-coins";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { parseFulfillmentOptionEnabled } from "@/lib/fulfillment-settings";
import { parseShopOpen } from "@/lib/shop-open";
import { formatPrice, truncateToken } from "@/lib/helpers";
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
  subject: string;
  status: string;
  updated_at: string;
  order_id: string | null;
};

const ORDER_STATUSES = [
  "payment_pending",
  "payment_expired",
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
  const [orders, setOrders] = useState<(Order & { product?: Product | null })[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [shopLocations, setShopLocations] = useState<ShopLocationRow[]>([]);
  const [ticketRows, setTicketRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pRes, oRes, aRes, sRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*, products(*)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("*"),
    ]);

    if (pRes.data) setProducts(pRes.data as Product[]);
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
    await supabase.from("settings").upsert({ key, value });
    setSettings((s) => ({ ...s, [key]: value }));
  }

  const shopCurrency = parseShopCurrency(settings.shop_currency);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-honey-text">Dashboard</h1>
        <button
          type="button"
          onClick={leaveAdmin}
          className="inline-flex items-center gap-2 rounded-full border border-honey-border px-4 py-2 text-sm font-medium text-honey-muted transition hover:bg-honey-border/30"
        >
          <LogOut className="h-4 w-4" />
          Back to site
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-honey-muted">
          <div className="hex-spinner" aria-hidden />
          <span>Loading…</span>
        </div>
      )}

      {tab === "overview" && !loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Products" value={products.length} />
          <Stat label="Orders" value={orders.length} />
          <Stat label="Announcements" value={announcements.length} />
        </div>
      )}

      {tab === "products" && !loading && (
        <ProductsSection products={products} onRefresh={loadAll} supabase={supabase} shopCurrency={shopCurrency} />
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

      {tab === "support" && !loading && <SupportTicketsSection supabase={supabase} />}

      {tab === "settings" && !loading && (
        <SettingsSection settings={settings} onSave={upsertSetting} />
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
  onRefresh,
  supabase,
  shopCurrency,
}: {
  products: Product[];
  onRefresh: () => void;
  supabase: ReturnType<typeof createClient>;
  shopCurrency: ShopCurrency;
}) {
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  async function saveProduct() {
    if (!editing?.name) return;
    const payload = {
      name: editing.name,
      description: editing.description ?? null,
      category: editing.category ?? "flower",
      price_regular: Number(editing.price_regular ?? 0),
      price_team_member: Number(editing.price_team_member ?? 0),
      stock_quantity: Number(editing.stock_quantity ?? 0),
      image_url: editing.image_url ?? null,
      is_active: editing.is_active ?? true,
    };
    if (editing.id) {
      await supabase.from("products").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("products").insert(payload);
    }
    setEditing(null);
    onRefresh();
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
    await supabase.from("products").update({ image_url: publicUrl }).eq("id", productId);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() =>
          setEditing({
            name: "",
            category: "flower",
            price_regular: 0,
            price_team_member: 0,
            stock_quantity: 0,
            is_active: true,
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
              <th className="p-3">Stock</th>
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
                <td className="p-3">{p.stock_quantity}</td>
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
                value={editing.category ?? "flower"}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value as Product["category"] })
                }
              >
                <option value="flower">Flower</option>
                <option value="vitamin">Vitamin</option>
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

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  async function setStatus(id: string, status: (typeof ORDER_STATUSES)[number]) {
    await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    onRefresh();
  }

  async function confirmOrder(id: string) {
    const res = await fetch("/api/admin/orders/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ order_id: id }),
    });
    if (!res.ok) {
      await res.json().catch(() => ({}));
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    onRefresh();
  }

  async function cancelOrder(order: Order & { product?: Product | null }) {
    if (!confirm("Cancel this order and restore stock?")) return;
    const { error: rpcErr } = await supabase.rpc("restore_product_stock", {
      p_product_id: order.product_id,
      p_quantity: order.quantity,
    });
    if (rpcErr) {
      console.error("[cancelOrder]", rpcErr);
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    onRefresh();
  }

  async function markPickedUp(order: Order & { product?: Product | null }) {
    if (!order.pickup_photo_url) {
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    await setStatus(order.id, "picked_up");
  }

  function fulfillmentActions(o: Order & { product?: Product | null }) {
    const ft = o.fulfillment_type;
    const isDelivery = ft === "delivery";
    const isDeadDrop = ft === "dead_drop";
    const isPickup = ft === "pickup";
    const legacyPickup = ft == null || ft === "";
    const canPickupFlow = !isDelivery && (isPickup || isDeadDrop || legacyPickup);

    return (
      <>
        {o.status === "payment_pending" && (
          <button
            type="button"
            className="text-left text-xs text-primary hover:underline"
            onClick={() => confirmOrder(o.id)}
          >
            Confirm
          </button>
        )}

        {(isPickup || legacyPickup) && o.status === "confirmed" && (
          <button
            type="button"
            className="text-left text-xs text-primary hover:underline"
            onClick={() => setStatus(o.id, "ready_for_pickup")}
          >
            Ready for pickup
          </button>
        )}

        {isDeadDrop && o.status === "confirmed" && (
          <button
            type="button"
            className="text-left text-xs text-primary hover:underline"
            onClick={() => setStatus(o.id, "ready_at_drop")}
          >
            Ready at drop
          </button>
        )}

        {isDelivery && o.status === "confirmed" && (
          <button
            type="button"
            className="text-left text-xs text-primary hover:underline"
            onClick={() => setStatus(o.id, "out_for_delivery")}
          >
            Out for delivery
          </button>
        )}

        {isDelivery && o.status === "out_for_delivery" && (
          <button
            type="button"
            className="text-left text-xs text-primary hover:underline"
            onClick={() => setStatus(o.id, "delivered")}
          >
            Delivered
          </button>
        )}

        {canPickupFlow && o.status === "pickup_submitted" && (
          <button
            type="button"
            className="text-left text-xs text-amber-700 hover:underline dark:text-amber-400"
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

        {canPickupFlow &&
          !["payment_pending", "picked_up", "cancelled", "payment_expired", "delivered"].includes(o.status) && (
            <button
              type="button"
              className="text-left text-xs text-primary hover:underline"
              onClick={() => markPickedUp(o)}
            >
              Picked up
            </button>
          )}

        {o.status !== "cancelled" && o.status !== "picked_up" && o.status !== "delivered" && (
          <button
            type="button"
            className="text-left text-xs text-red-600 hover:underline"
            onClick={() => cancelOrder(o)}
          >
            Cancel + restore stock
          </button>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
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
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-2">Customer</th>
              <th className="p-2">Product</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Total</th>
              <th className="p-2">Fulfillment</th>
              <th className="p-2">Type</th>
              <th className="p-2">Pay</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-honey-border/60 align-top">
                <td className="p-2 font-mono text-xs">{truncateToken(o.customer_token)}</td>
                <td className="p-2">{o.product?.name ?? "—"}</td>
                <td className="p-2">{o.quantity}</td>
                <td className="p-2">{formatPrice(Number(o.total_price), shopCurrency)}</td>
                <td className="p-2 text-xs">
                  {o.fulfillment_type ?? "—"}
                  {o.fulfillment_type === "delivery" && o.delivery_address && (
                    <span className="mt-1 block max-w-[140px] text-honey-muted">{o.delivery_address}</span>
                  )}
                </td>
                <td className="p-2">{o.user_type}</td>
                <td className="p-2">{o.payment_method ?? "—"}</td>
                <td className="p-2 text-xs">{o.status}</td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">{fulfillmentActions(o)}</div>
                </td>
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
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="mt-1 text-sm text-honey-muted whitespace-pre-wrap">{a.body}</p>
            </div>
            <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => remove(a.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsSection({
  settings,
  onSave,
}: {
  settings: Record<string, string>;
  onSave: (k: string, v: string) => Promise<void>;
}) {
  const keys = [
    { key: "revolut_payment_link", label: "Revolut payment URL" },
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
        <select
          className="mt-2 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          value={settings.shop_currency === "EUR" ? "EUR" : "HUF"}
          onChange={(e) => onSave("shop_currency", e.target.value)}
        >
          <option value="HUF">Hungarian Forint (HUF)</option>
          <option value="EUR">Euro (EUR)</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Shop status</label>
        <p className="mt-1 text-xs text-honey-muted">
          When closed, customers cannot start checkout or place new orders.
        </p>
        <select
          className="mt-2 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          value={parseShopOpen(settings.shop_open) ? "1" : "0"}
          onChange={(e) => onSave("shop_open", e.target.value)}
        >
          <option value="1">Open</option>
          <option value="0">Closed</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Active crypto coin</label>
        <p className="mt-1 text-xs text-honey-muted">
          Checkout and crypto payment pages use this asset for the exact amount to send. Use a wallet address on the
          same network (e.g. Solana address for SOL).
        </p>
        <select
          className="mt-2 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          value={normalizeActiveCryptoCoin(settings.active_crypto_coin)}
          onChange={(e) => onSave("active_crypto_coin", e.target.value)}
        >
          {CRYPTO_COIN_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.symbol})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Crypto network</label>
        <p className="mt-1 text-xs text-honey-muted">
          Shown on the payment page so customers send on the correct chain (e.g. Ethereum mainnet, Solana, Bitcoin
          network, Arbitrum, TRC20 for USDT).
        </p>
        <textarea
          className="mt-2 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          rows={2}
          defaultValue={settings.crypto_network ?? ""}
          onBlur={(e) => onSave("crypto_network", e.target.value)}
          placeholder="e.g. Ethereum mainnet (ERC-20)"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Crypto wallet address (receiving)</label>
        <p className="mt-1 text-xs text-honey-muted">Must match the coin and network above. Customers can copy this on the payment page.</p>
        <textarea
          className="mt-2 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          rows={2}
          defaultValue={settings.crypto_wallet_address ?? ""}
          onBlur={(e) => onSave("crypto_wallet_address", e.target.value)}
          placeholder="Paste the deposit address"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-honey-muted">Team fulfillment options</label>
        <p className="mt-1 text-xs text-honey-muted">
          Guests always use dead drop only (when dead drop is on and a location is active). Team members see the
          options you enable below.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-honey-muted">Dead drop</label>
            <select
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={parseFulfillmentOptionEnabled(settings.fulfillment_dead_drop_enabled) ? "1" : "0"}
              onChange={(e) => onSave("fulfillment_dead_drop_enabled", e.target.value)}
            >
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-honey-muted">Pickup</label>
            <select
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={parseFulfillmentOptionEnabled(settings.fulfillment_pickup_enabled) ? "1" : "0"}
              onChange={(e) => onSave("fulfillment_pickup_enabled", e.target.value)}
            >
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-honey-muted">Delivery</label>
            <select
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={parseFulfillmentOptionEnabled(settings.fulfillment_delivery_enabled) ? "1" : "0"}
              onChange={(e) => onSave("fulfillment_delivery_enabled", e.target.value)}
            >
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
          </div>
        </div>
      </div>
      {keys.map(({ key, label }) => (
        <div key={key}>
          <label className="text-xs font-semibold text-honey-muted">{label}</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            rows={key.includes("TOKEN") || key.includes("address") ? 2 : 2}
            defaultValue={settings[key] ?? ""}
            onBlur={(e) => onSave(key, e.target.value)}
          />
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

function SupportTicketsSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [statusPick, setStatusPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      setRows(data as SupportTicketRow[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(id: string) {
    const message = replyText[id]?.trim();
    if (!message) return;
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
      alert(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setReplyText((r) => ({ ...r, [id]: "" }));
    load();
  }

  if (loading) {
    return <p className="text-honey-muted">Loading support tickets…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-3">Ticket</th>
              <th className="p-3">Customer</th>
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
