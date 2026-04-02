"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

type DeadDropRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  instructions: string | null;
  latitude: number;
  longitude: number;
  product_id?: string | null;
  google_maps_url?: string | null;
  apple_maps_url?: string | null;
  location_photo_url?: string | null;
  location_video_url?: string | null;
  location_photo_url_2?: string | null;
  location_photo_url_3?: string | null;
  dig_up_when_alone_warning?: string | null;
  active_from?: string | null;
  active_until?: string | null;
};

type ProductOption = { id: string; name: string };

export default function AdminDeadDropsPage() {
  const [rows, setRows] = useState<DeadDropRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [deadDropEnabled, setDeadDropEnabled] = useState<"1" | "0">("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  type UploadKind = "location_photo_url" | "location_photo_url_2" | "location_photo_url_3" | "location_video_url";
  const [uploadingKind, setUploadingKind] = useState<UploadKind | null>(null);
  const [deadDropColumnSet, setDeadDropColumnSet] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState({
    name: "",
    product_id: "",
    latitude: "",
    longitude: "",
    google_maps_url: "",
    apple_maps_url: "",
    instructions: "",
    location_photo_url: "",
    location_video_url: "",
    location_photo_url_2: "",
    location_photo_url_3: "",
    dig_up_when_alone_warning: "",
    active_from: "",
    active_until: "",
  });
  const [editDraft, setEditDraft] = useState({
    name: "",
    product_id: "",
    latitude: "",
    longitude: "",
    google_maps_url: "",
    apple_maps_url: "",
    instructions: "",
    location_photo_url: "",
    location_video_url: "",
    location_photo_url_2: "",
    location_photo_url_3: "",
    dig_up_when_alone_warning: "",
    active_from: "",
    active_until: "",
  });
  const MAX_ACTIVE_DEAD_DROPS = 200;
  const [activeDeadDropCount, setActiveDeadDropCount] = useState(0);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { data: st }, { data: prods }] = await Promise.all([
      supabase.from("dead_drops").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("value").eq("key", "fulfillment_dead_drop_enabled").maybeSingle(),
      supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    ]);
    const list = ((data as DeadDropRow[]) ?? []) as DeadDropRow[];
    setRows(list);
    const first = list[0];
    setDeadDropColumnSet(new Set(first ? Object.keys(first) : []));
    setActiveDeadDropCount(list.filter((r) => r.is_active).length);
    setDeadDropEnabled(st?.value === "0" ? "0" : "1");
    setProducts((prods as ProductOption[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadDeadDropMedia(kind: UploadKind, file: File) {
    setUploadingKind(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);

      const res = await fetch("/api/admin/dead-drops/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        showToast(data.error || "Upload failed. Try again.", false);
        return;
      }

      setDraft((d) => ({ ...d, [kind]: data.url as string }));
      showToast("Upload successful ✓");
    } finally {
      setUploadingKind(null);
    }
  }

  async function saveActive() {
    if (!draft.name.trim()) {
      showToast("Please enter a location name.", false);
      return;
    }
    if (activeDeadDropCount >= MAX_ACTIVE_DEAD_DROPS) {
      showToast(`Max active dead drops reached (${MAX_ACTIVE_DEAD_DROPS}). Deactivate some first.`, false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        product_id: draft.product_id.trim() ? draft.product_id.trim() : null,
        latitude: Number(draft.latitude) || 0,
        longitude: Number(draft.longitude) || 0,
        google_maps_url: draft.google_maps_url || null,
        apple_maps_url: draft.apple_maps_url || null,
        instructions: draft.instructions || null,
        // Photo #1 column exists in the current live schema.
        location_photo_url: draft.location_photo_url || null,
        active_from: draft.active_from ? new Date(draft.active_from).toISOString() : null,
        active_until: draft.active_until ? new Date(draft.active_until).toISOString() : null,
        is_active: true,
      };

      // Only include optional media columns when they exist in the current DB schema.
      if (deadDropColumnSet.has("location_video_url")) payload.location_video_url = draft.location_video_url || null;
      if (deadDropColumnSet.has("location_photo_url_2")) payload.location_photo_url_2 = draft.location_photo_url_2 || null;
      if (deadDropColumnSet.has("location_photo_url_3")) payload.location_photo_url_3 = draft.location_photo_url_3 || null;
      if (deadDropColumnSet.has("dig_up_when_alone_warning")) payload.dig_up_when_alone_warning = draft.dig_up_when_alone_warning || null;

      const { error } = await supabase.from("dead_drops").insert(payload);
      if (error) {
        const msg = String(error.message ?? error.details ?? "").toLowerCase();
        if (msg.includes("max_active_dead_drops_reached")) {
          showToast(`Max active dead drops reached (${MAX_ACTIVE_DEAD_DROPS}). Deactivate some first.`, false);
        } else {
          showToast("Failed to save. Try again.", false);
        }
        return;
      }
      setDraft({
        name: "",
        product_id: "",
        latitude: "",
        longitude: "",
        google_maps_url: "",
        apple_maps_url: "",
        instructions: "",
        location_photo_url: "",
        location_video_url: "",
        location_photo_url_2: "",
        location_photo_url_3: "",
        dig_up_when_alone_warning: "",
        active_from: "",
        active_until: "",
      });
      showToast("Dead drop saved and set as active ✓");
      load();
    } finally {
      setLoading(false);
    }
  }

  async function activate(id: string) {
    setLoading(true);
    try {
      const supabase = createClient();
      const row = rows.find((r) => r.id === id);
      if (row && !row.is_active && activeDeadDropCount >= MAX_ACTIVE_DEAD_DROPS) {
        showToast(`Max active dead drops reached (${MAX_ACTIVE_DEAD_DROPS}). Deactivate some first.`, false);
        return;
      }
      const { error } = await supabase.from("dead_drops").update({ is_active: true }).eq("id", id);
      if (error) {
        const msg = String(error.message ?? error.details ?? "").toLowerCase();
        if (msg.includes("max_active_dead_drops_reached")) {
          showToast(`Max active dead drops reached (${MAX_ACTIVE_DEAD_DROPS}). Deactivate some first.`, false);
        } else {
          showToast("Failed to activate. Try again.", false);
        }
        return;
      }
      showToast("Dead drop activated ✓");
      load();
    } finally {
      setLoading(false);
    }
  }

  async function deactivate(id: string) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("dead_drops").update({ is_active: false }).eq("id", id);
      if (error) {
        showToast("Failed to deactivate. Try again.", false);
        return;
      }
      showToast("Dead drop deactivated ✓");
      load();
    } finally {
      setLoading(false);
    }
  }

  async function deleteRow(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const supabase = createClient();
      // Dead drops can be referenced by existing orders (`orders.dead_drop_id` FK).
      // If referenced, hard delete will fail; we de-activate instead.
      const { data: used, error: usedErr } = await supabase
        .from("orders")
        .select("id")
        .eq("dead_drop_id", id)
        .limit(1);

      if (usedErr) {
        console.error("[dead-drop delete] orders check failed", usedErr);
        showToast("Failed to delete (cannot check usage). Try again.", false);
        return;
      }

      if (used && used.length > 0) {
        const { error: deactivateErr } = await supabase.from("dead_drops").update({ is_active: false }).eq("id", id);
        if (deactivateErr) {
          console.error("[dead-drop delete] deactivate failed", deactivateErr);
          showToast("Failed to deactivate. Try again.", false);
          return;
        }
        showToast("Dead drop is used by existing orders — deactivated instead ✓", true);
        await load();
        return;
      }

      const { error } = await supabase.from("dead_drops").delete().eq("id", id);
      if (error) {
        console.error("[dead-drop delete] hard delete failed", error);
        showToast("Failed to delete. Try again.", false);
        return;
      }
      showToast("Dead drop deleted ✓", true);
      load();
    } finally {
      setLoading(false);
    }
  }

  async function saveDeadDropToggle() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("settings")
        .upsert({ key: "fulfillment_dead_drop_enabled", value: deadDropEnabled }, { onConflict: "key" });
      if (error) {
        showToast("Failed to save dead-drop option.", false);
        return;
      }
      showToast("Dead-drop option saved ✓");
    } finally {
      setLoading(false);
    }
  }

  function toInputValue(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  function startEdit(row: DeadDropRow) {
    setEditingId(row.id);
    setEditDraft({
      name: row.name ?? "",
      product_id: row.product_id ?? "",
      latitude: String(row.latitude ?? ""),
      longitude: String(row.longitude ?? ""),
      google_maps_url: row.google_maps_url ?? "",
      apple_maps_url: row.apple_maps_url ?? "",
      instructions: row.instructions ?? "",
      location_photo_url: row.location_photo_url ?? "",
      location_video_url: row.location_video_url ?? "",
      location_photo_url_2: row.location_photo_url_2 ?? "",
      location_photo_url_3: row.location_photo_url_3 ?? "",
      dig_up_when_alone_warning: row.dig_up_when_alone_warning ?? "",
      active_from: toInputValue(row.active_from),
      active_until: toInputValue(row.active_until),
    });
  }

  async function saveEdit(id: string) {
    setLoading(true);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        name: editDraft.name.trim(),
        product_id: editDraft.product_id.trim() ? editDraft.product_id.trim() : null,
        latitude: Number(editDraft.latitude) || 0,
        longitude: Number(editDraft.longitude) || 0,
        google_maps_url: editDraft.google_maps_url || null,
        apple_maps_url: editDraft.apple_maps_url || null,
        instructions: editDraft.instructions || null,
        location_photo_url: editDraft.location_photo_url || null,
        active_from: editDraft.active_from ? new Date(editDraft.active_from).toISOString() : null,
        active_until: editDraft.active_until ? new Date(editDraft.active_until).toISOString() : null,
      };

      if (deadDropColumnSet.has("location_video_url")) payload.location_video_url = editDraft.location_video_url || null;
      if (deadDropColumnSet.has("location_photo_url_2")) payload.location_photo_url_2 = editDraft.location_photo_url_2 || null;
      if (deadDropColumnSet.has("location_photo_url_3")) payload.location_photo_url_3 = editDraft.location_photo_url_3 || null;
      if (deadDropColumnSet.has("dig_up_when_alone_warning")) payload.dig_up_when_alone_warning = editDraft.dig_up_when_alone_warning || null;

      const { error } = await supabase.from("dead_drops").update(payload).eq("id", id);
      if (error) {
        showToast("Failed to save changes.", false);
        return;
      }
      setEditingId(null);
      showToast("Dead drop updated ✓");
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-xl ${
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
      <div>
        <h1 className="font-display text-3xl text-honey-text">Dead drops</h1>
        <p className="mt-2 text-sm text-honey-muted">
          Add and manage active dead-drop slots. Optional product limits which line can use that slot; product stock
          goes down only after admin confirms payment and the system assigns a free slot to the order.
        </p>
      </div>

      <div className="rounded-2xl border border-honey-border p-4">
        <p className="text-xs font-semibold text-honey-muted">Dead-drop option for customers</p>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={deadDropEnabled}
            onChange={(e) => setDeadDropEnabled(e.target.value === "0" ? "0" : "1")}
          >
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={() => void saveDeadDropToggle()}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-honey-border p-4 space-y-3">
        <h2 className="font-display text-lg">Add active dead drop</h2>
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Location name"
          value={draft.name}
          enterKeyHint="next"
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
        />
        <select
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          value={draft.product_id}
          onChange={(e) => setDraft((d) => ({ ...d, product_id: e.target.value }))}
        >
          <option value="">Product (optional — legacy: any)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Latitude"
            value={draft.latitude}
            enterKeyHint="next"
            onChange={(e) => setDraft((d) => ({ ...d, latitude: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
          />
          <input
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Longitude"
            value={draft.longitude}
            enterKeyHint="next"
            onChange={(e) => setDraft((d) => ({ ...d, longitude: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
          />
        </div>
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Google Maps URL"
          value={draft.google_maps_url}
          enterKeyHint="next"
          onChange={(e) => setDraft((d) => ({ ...d, google_maps_url: e.target.value }))}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
        />
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Apple Maps URL"
          value={draft.apple_maps_url}
          enterKeyHint="next"
          onChange={(e) => setDraft((d) => ({ ...d, apple_maps_url: e.target.value }))}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
        />
        <textarea
          className="min-h-[80px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Instructions for customers"
          value={draft.instructions}
          onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
        />
        <input
          className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
          placeholder="Photo URL (optional)"
          value={draft.location_photo_url}
          enterKeyHint="next"
          onChange={(e) => setDraft((d) => ({ ...d, location_photo_url: e.target.value }))}
          onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
        />
        <div className="mt-2">
          <input
            type="file"
            accept="image/*"
            className="w-full text-xs"
            disabled={uploadingKind === "location_photo_url"}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadDeadDropMedia("location_photo_url", f);
              e.currentTarget.value = "";
            }}
          />
        </div>
        {deadDropColumnSet.has("location_photo_url_2") ? (
          <>
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Photo URL #2 (optional)"
              value={draft.location_photo_url_2}
              enterKeyHint="next"
              onChange={(e) => setDraft((d) => ({ ...d, location_photo_url_2: e.target.value }))}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
            />
            <div className="mt-2">
              <input
                type="file"
                accept="image/*"
                className="w-full text-xs"
                disabled={uploadingKind === "location_photo_url_2"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDeadDropMedia("location_photo_url_2", f);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </>
        ) : null}

        {deadDropColumnSet.has("location_photo_url_3") ? (
          <>
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Photo URL #3 (optional)"
              value={draft.location_photo_url_3}
              enterKeyHint="next"
              onChange={(e) => setDraft((d) => ({ ...d, location_photo_url_3: e.target.value }))}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
            />
            <div className="mt-2">
              <input
                type="file"
                accept="image/*"
                className="w-full text-xs"
                disabled={uploadingKind === "location_photo_url_3"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDeadDropMedia("location_photo_url_3", f);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </>
        ) : null}
        {deadDropColumnSet.has("location_video_url") ? (
          <>
            <input
              className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              placeholder="Video URL (optional)"
              value={draft.location_video_url}
              enterKeyHint="next"
              onChange={(e) => setDraft((d) => ({ ...d, location_video_url: e.target.value }))}
              onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
            />
            <div className="mt-2">
              <input
                type="file"
                accept="video/*"
                className="w-full text-xs"
                disabled={uploadingKind === "location_video_url"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDeadDropMedia("location_video_url", f);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </>
        ) : null}

        {deadDropColumnSet.has("dig_up_when_alone_warning") ? (
          <textarea
            className="min-h-[64px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            placeholder="Dig up when alone warning (optional)"
            value={draft.dig_up_when_alone_warning}
            onChange={(e) => setDraft((d) => ({ ...d, dig_up_when_alone_warning: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
          />
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={draft.active_from}
            enterKeyHint="next"
            onChange={(e) => setDraft((d) => ({ ...d, active_from: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
          />
          <input
            type="datetime-local"
            className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={draft.active_until}
            enterKeyHint="done"
            onChange={(e) => setDraft((d) => ({ ...d, active_until: e.target.value }))}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350)}
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={saveActive}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Saving..." : "Add as active dead drop"}
        </button>
      </div>

      <div>
        <h2 className="font-display text-lg">Active dead drops</h2>
        <p className="mt-1 text-sm text-honey-muted">
          {activeDeadDropCount} active (max {MAX_ACTIVE_DEAD_DROPS})
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {rows
            .filter((r) => r.is_active)
            .slice(0, 30)
            .map((r) => (
              <li key={r.id} className="rounded-xl border border-honey-border px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-honey-text truncate">{r.name}</p>
                    <p className="mt-1 text-xs text-honey-muted">
                      {r.instructions ? r.instructions : "No find instructions yet"}{" "}
                    </p>
                    <p className="mt-1 text-[11px] text-honey-muted">
                      Added:{" "}
                      {new Date(r.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-700 dark:text-green-400">
                    Active
                  </span>
                </div>
              </li>
            ))}
          {rows.filter((r) => r.is_active).length === 0 ? (
            <li className="rounded-xl border border-dashed border-honey-border px-3 py-4 text-center text-xs text-honey-muted">
              No active dead drops yet.
            </li>
          ) : null}
        </ul>
        {rows.filter((r) => r.is_active).length > 30 ? (
          <p className="mt-2 text-xs text-honey-muted">Showing first 30 active drops. Scroll below for full history.</p>
        ) : null}
      </div>

      <div>
        <h2 className="font-display text-lg">History</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-honey-border px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-honey-text">{r.name}</p>
                  <p className="text-xs text-honey-muted">
                    {r.is_active ? "active" : "inactive"} · {new Date(r.created_at).toLocaleString("en-GB")}
                    {r.product_id
                      ? ` · product: ${products.find((x) => x.id === r.product_id)?.name ?? r.product_id.slice(0, 8)}`
                      : " · any product (legacy)"}
                  </p>
                  {r.instructions && <p className="mt-1 text-xs text-honey-muted">{r.instructions}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => startEdit(r)}
                    className="rounded-full border border-honey-border px-3 py-1 text-xs text-honey-text disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={loading || r.is_active}
                    onClick={() => activate(r.id)}
                    className="rounded-full border border-honey-border px-3 py-1 text-xs text-primary disabled:opacity-50"
                  >
                    Activate
                  </button>
                  <button
                    type="button"
                    disabled={loading || !r.is_active}
                    onClick={() => deactivate(r.id)}
                    className="rounded-full border border-honey-border px-3 py-1 text-xs text-amber-700 disabled:opacity-50 dark:text-amber-400"
                  >
                    Deactivate
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => deleteRow(r.id, r.name)}
                    className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {editingId === r.id && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
                    placeholder="Location name"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                  <select
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
                    value={editDraft.product_id}
                    onChange={(e) => setEditDraft((d) => ({ ...d, product_id: e.target.value }))}
                  >
                    <option value="">Product (optional — legacy: any)</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs"
                    placeholder="Latitude"
                    value={editDraft.latitude}
                    onChange={(e) => setEditDraft((d) => ({ ...d, latitude: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs"
                    placeholder="Longitude"
                    value={editDraft.longitude}
                    onChange={(e) => setEditDraft((d) => ({ ...d, longitude: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
                    placeholder="Google Maps URL"
                    value={editDraft.google_maps_url}
                    onChange={(e) => setEditDraft((d) => ({ ...d, google_maps_url: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
                    placeholder="Apple Maps URL"
                    value={editDraft.apple_maps_url}
                    onChange={(e) => setEditDraft((d) => ({ ...d, apple_maps_url: e.target.value }))}
                  />
                  <textarea
                    className="min-h-[64px] rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
                    placeholder="Instructions"
                    value={editDraft.instructions}
                    onChange={(e) => setEditDraft((d) => ({ ...d, instructions: e.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
                    placeholder="Photo URL"
                    value={editDraft.location_photo_url}
                    onChange={(e) => setEditDraft((d) => ({ ...d, location_photo_url: e.target.value }))}
                  />
                  <div className="sm:col-span-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-xs"
                      disabled={uploadingKind === "location_photo_url"}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadDeadDropMedia("location_photo_url", f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
          {deadDropColumnSet.has("location_photo_url_2") ? (
            <>
              <input
                className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs"
                placeholder="Photo URL #2"
                value={editDraft.location_photo_url_2}
                onChange={(e) => setEditDraft((d) => ({ ...d, location_photo_url_2: e.target.value }))}
              />
              <div className="mt-2 sm:col-span-2">
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-xs"
                  disabled={uploadingKind === "location_photo_url_2"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadDeadDropMedia("location_photo_url_2", f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </>
          ) : null}

          {deadDropColumnSet.has("location_photo_url_3") ? (
            <>
              <input
                className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs"
                placeholder="Photo URL #3"
                value={editDraft.location_photo_url_3}
                onChange={(e) => setEditDraft((d) => ({ ...d, location_photo_url_3: e.target.value }))}
              />
              <div className="mt-2 sm:col-span-2">
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-xs"
                  disabled={uploadingKind === "location_photo_url_3"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadDeadDropMedia("location_photo_url_3", f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </>
          ) : null}
          {deadDropColumnSet.has("location_video_url") ? (
            <>
              <input
                className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
                placeholder="Video URL"
                value={editDraft.location_video_url}
                onChange={(e) => setEditDraft((d) => ({ ...d, location_video_url: e.target.value }))}
              />
              <div className="mt-2 sm:col-span-2">
                <input
                  type="file"
                  accept="video/*"
                  className="w-full text-xs"
                  disabled={uploadingKind === "location_video_url"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadDeadDropMedia("location_video_url", f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </>
          ) : null}
          {deadDropColumnSet.has("dig_up_when_alone_warning") ? (
            <textarea
              className="min-h-[64px] rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs sm:col-span-2"
              placeholder="Dig up when alone warning"
              value={editDraft.dig_up_when_alone_warning}
              onChange={(e) => setEditDraft((d) => ({ ...d, dig_up_when_alone_warning: e.target.value }))}
            />
          ) : null}
                  <input
                    type="datetime-local"
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs"
                    value={editDraft.active_from}
                    onChange={(e) => setEditDraft((d) => ({ ...d, active_from: e.target.value }))}
                  />
                  <input
                    type="datetime-local"
                    className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-xs"
                    value={editDraft.active_until}
                    onChange={(e) => setEditDraft((d) => ({ ...d, active_until: e.target.value }))}
                  />
                  <div className="sm:col-span-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit(r.id)}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white"
                    >
                      Save changes
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
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
