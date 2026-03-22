import { createServiceClient } from "@/lib/supabase/admin";
import { getDistanceKm } from "@/lib/location";
import { NextResponse } from "next/server";

const MAX_M = 200;

/** POST { orderId, customerToken, lat, lon, locationId } */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, customerToken, lat, lon, locationId } = body as Record<string, unknown>;
    if (!orderId || !customerToken || typeof lat !== "number" || typeof lon !== "number") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, customer_token, status, location_id")
      .eq("id", orderId)
      .single();

    if (oErr || !order || order.customer_token !== customerToken) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const locId = (locationId as string) ?? order.location_id;
    if (!locId) {
      return NextResponse.json({ error: "No pickup location on order" }, { status: 400 });
    }

    const { data: loc } = await supabase
      .from("shop_locations")
      .select("latitude, longitude, name")
      .eq("id", locId)
      .single();

    if (!loc) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const distKm = getDistanceKm(lat, lon, Number(loc.latitude), Number(loc.longitude));
    const distM = distKm * 1000;

    if (distM > MAX_M) {
      return NextResponse.json({
        ok: false,
        message: `You don't appear to be at ${loc.name} yet (${Math.round(distM)} m away, max ${MAX_M} m).`,
        distance_meters: distM,
      });
    }

    await supabase
      .from("orders")
      .update({
        arrival_lat: lat,
        arrival_lon: lon,
        arrived_at: new Date().toISOString(),
        arrival_distance_meters: distM,
        status: "customer_arrived",
        customer_arrived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return NextResponse.json({ ok: true, distance_meters: distM });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
