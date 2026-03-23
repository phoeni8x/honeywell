"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

export default function AdminDeadDropsPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [draft, setDraft] = useState({
    name: "",
    latitude: "",
    longitude: "",
    google_maps_url: "",
    apple_maps_url: "",
    instructions: "",
    location_photo_url: "",
    active_from: "",
    active_until: "",
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("dead_drops").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveActive() {
    const supabase = createClient();
    await supabase.from("dead_drops").insert({
      name: draft.name.trim(),
      latitude: Number(draft.latitude) || 0,
      longitude: Number(draft.longitude) || 0,
      google_maps_url: draft.google_maps_url || null,
      apple_maps_url: draft.apple_maps_url || null,
      instructions: draft.instructions || null,
      location_photo_url: draft.location_photo_url || null,
      active_from: draft.active_from ? new Date(draft.active_from).toISOString() : null,
      active_until: draft.active_until ? new Date(draft.active_until).toISOString() : null,
      is_active: true,
    });
    setDraft({
      name: "",
      latitude: "",
      longitude: "",
      google_maps_url: "",
      apple_maps_url: "",
      instructions: "",
      location_photo_url: "",
      active_from: "",
      active_until: "",
    });
    load();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-honey-text">Dead drops</h1>
        <p className="mt-2 text-sm text-honey-muted">
          Only one location can be active at a time. Saving a new active dead drop archives the previous one.
        </p>
      </div>

      <div className="rounded-2xl border border-honey-border p-4 space-y-3">
        <h2 className="font-display text-lg">Set today&apos;s dead drop</h2>
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Location name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <div className="grid gap-2 sm:grid-cols-2">
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
        </div>
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Google Maps URL"
          value={draft.google_maps_url}
          onChange={(e) => setDraft((d) => ({ ...d, google_maps_url: e.target.value }))}
        />
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Apple Maps URL"
          value={draft.apple_maps_url}
          onChange={(e) => setDraft((d) => ({ ...d, apple_maps_url: e.target.value }))}
        />
        <textarea
          className="min-h-[80px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Instructions for customers"
          value={draft.instructions}
          onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
        />
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Photo URL (optional)"
          value={draft.location_photo_url}
          onChange={(e) => setDraft((d) => ({ ...d, location_photo_url: e.target.value }))}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={draft.active_from}
            onChange={(e) => setDraft((d) => ({ ...d, active_from: e.target.value }))}
          />
          <input
            type="datetime-local"
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={draft.active_until}
            onChange={(e) => setDraft((d) => ({ ...d, active_until: e.target.value }))}
          />
        </div>
        <button
          type="button"
          onClick={saveActive}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white"
        >
          Save as active dead drop
        </button>
      </div>

      <div>
        <h2 className="font-display text-lg">History</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id as string} className="rounded-xl border border-honey-border px-3 py-2">
              <span className="font-medium text-honey-text">{String(r.name)}</span>{" "}
              <span className="text-honey-muted">{r.is_active ? "· active" : ""}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
