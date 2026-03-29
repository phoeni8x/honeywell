/** Parse settings.value text for on/off flags. */
export function parseMaintenanceEnabled(v: string | null | undefined): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

/**
 * Read maintenance_mode via PostgREST (same path as curl). On production, the JS
 * client's `.eq("key", ...)` path has returned stale/wrong rows while REST matches the DB.
 */
export async function getMaintenanceModeViaRest(): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(`${url}/rest/v1/settings?key=eq.maintenance_mode&select=value`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) return null;
    return body.some((row) => parseMaintenanceEnabled((row as { value?: string }).value));
  } catch {
    return null;
  }
}
