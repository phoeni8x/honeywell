import type { SupabaseClient } from "@supabase/supabase-js";

type OrderRow = Record<string, unknown> & {
  product_id?: string | null;
  dead_drop_id?: string | null;
  location_id?: string | null;
};

/**
 * Load orders + product / dead_drop / pickup_location without PostgREST embeds
 * (avoids ambiguous FK hints and works across schema tweaks).
 */
export async function enrichOrdersForCustomer(
  supabase: SupabaseClient,
  rows: OrderRow[] | null
) {
  const orders = rows ?? [];
  const productIds = Array.from(
    new Set(orders.map((o) => o.product_id).filter((id): id is string => Boolean(id)))
  );
  const deadIds = Array.from(
    new Set(orders.map((o) => o.dead_drop_id).filter((id): id is string => Boolean(id)))
  );
  const locIds = Array.from(
    new Set(orders.map((o) => o.location_id).filter((id): id is string => Boolean(id)))
  );

  const [productsRes, deadRes, locRes] = await Promise.all([
    productIds.length
      ? supabase.from("products").select("*").in("id", productIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    deadIds.length
      ? supabase.from("dead_drops").select("*").in("id", deadIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    locIds.length
      ? supabase.from("shop_locations").select("*").in("id", locIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const productById = new Map(
    (productsRes.data ?? []).map((p) => [(p as { id: string }).id, p])
  );
  const deadById = new Map(
    (deadRes.data ?? []).map((d) => [(d as { id: string }).id, d])
  );
  const locById = new Map(
    (locRes.data ?? []).map((l) => [(l as { id: string }).id, l])
  );

  return orders.map((o) => {
    const pid = o.product_id as string | null | undefined;
    const did = o.dead_drop_id as string | null | undefined;
    const lid = o.location_id as string | null | undefined;
    return {
      ...o,
      product: pid ? productById.get(pid) ?? null : null,
      dead_drop: did ? deadById.get(did) ?? null : null,
      pickup_location: lid ? locById.get(lid) ?? null : null,
    };
  });
}
