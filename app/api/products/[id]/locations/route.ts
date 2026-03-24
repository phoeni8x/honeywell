import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("product_location_stock")
      .select(
        `
        stock_quantity,
        is_taken,
        shop_locations (
          id,
          name,
          latitude,
          longitude,
          google_maps_url,
          apple_maps_url,
          admin_message,
          photo_url,
          is_active
        )
      `
      )
      .eq("product_id", params.id);

    if (error) {
      console.error("[products/locations]", error);
      return NextResponse.json({ locations: [] });
    }

    const rows = (data ?? []) as unknown as Array<{
      stock_quantity: number;
      is_taken: boolean;
      shop_locations: Record<string, unknown> | Record<string, unknown>[] | null;
    }>;

    const locations = rows
      .map((row) => {
        const raw = row.shop_locations;
        const loc = Array.isArray(raw) ? raw[0] : raw;
        if (!loc || loc.is_active === false) return null;
        return {
          id: loc.id,
          name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          google_maps_url: loc.google_maps_url,
          apple_maps_url: loc.apple_maps_url,
          admin_message: loc.admin_message,
          photo_url: loc.photo_url,
          stock_quantity: row.stock_quantity,
          is_taken: row.is_taken,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ locations });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ locations: [] });
  }
}
