"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

type Loc = {
  id: string;
  name: string;
  is_active: boolean;
  is_pickup_point: boolean | null;
  pickup_available_from?: string | null;
  pickup_available_until?: string | null;
};

export default function AdminPickupPointsPage() {
  const [rows, setRows] = useState<Loc[]>([]);
  const [pickupEnabled, setPickupEnabled] = useState<"1" | "0">("1");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [draftById, setDraftById] = useState<
    Record<string, { from: string; until: string }>
  >({});

  function showToast(msg: string, ok = true) {
    setToast({ ok, msg });
    window.setTimeout(() => setToast(null), 3000);
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

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { data: st }] = await Promise.all([
      supabase.from("shop_locations").select("*").order("name", { ascending: true }),
      supabase.from("settings").select("value").eq("key", "fulfillment_pickup_enabled").maybeSingle(),
    ]);
    const nextRows = (data as Loc[]) ?? [];
    setRows(nextRows);
    const nextDraft: Record<string, { from: string; until: string }> = {};
    for (const row of nextRows) {
      nextDraft[row.id] = {
        from: toInputValue(row.pickup_available_from ?? null),
        until: toInputValue(row.pickup_available_until ?? null),
      };
    }
    setDraftById(nextDraft);
    setPickupEnabled(st?.value === "0" ? "0" : "1");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(id: string, value: boolean) {
    setSavingKey(`toggle:${id}`);
    const supabase = createClient();
    const { error } = await supabase.from("shop_locations").update({ is_pickup_point: value }).eq("id", id);
    if (error) {
      showToast("Failed to update pickup point.", false);
    } else {
      showToast("Pickup point updated.");
      await load();
    }
    setSavingKey(null);
  }

  async function savePickupToggle() {
    setSavingKey("pickup-toggle");
    const supabase = createClient();
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "fulfillment_pickup_enabled", value: pickupEnabled }, { onConflict: "key" });
    if (error) showToast("Failed to save pickup option.", false);
    else showToast("Pickup option saved.");
    setSavingKey(null);
  }

  async function saveWindow(id: string) {
    const d = draftById[id] ?? { from: "", until: "" };
    setSavingKey(`window:${id}`);
    const supabase = createClient();
    const payload = {
      pickup_available_from: d.from ? new Date(d.from).toISOString() : null,
      pickup_available_until: d.until ? new Date(d.until).toISOString() : null,
    };
    const { error } = await supabase.from("shop_locations").update(payload).eq("id", id);
    if (error) showToast("Failed to save pickup time window.", false);
    else {
      showToast("Pickup availability saved.");
      await load();
    }
    setSavingKey(null);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.ok ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
      <div>
        <h1 className="font-display text-3xl text-honey-text">Pickup points</h1>
        <p className="mt-2 text-sm text-honey-muted">Toggle which shop locations appear as pickup options at checkout (team members).</p>
      </div>
      <div className="rounded-2xl border border-honey-border p-4">
        <p className="text-xs font-semibold text-honey-muted">Pickup option for customers</p>
        <div className="mt-2 flex items-center gap-2">
          <select
            className="w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
            value={pickupEnabled}
            onChange={(e) => setPickupEnabled(e.target.value === "0" ? "0" : "1")}
          >
            <option value="1">Enabled</option>
            <option value="0">Disabled</option>
          </select>
          <button
            type="button"
            disabled={savingKey === "pickup-toggle"}
            onClick={() => void savePickupToggle()}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {savingKey === "pickup-toggle" ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="space-y-3 rounded-xl border border-honey-border px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-honey-text">{r.name}</p>
                <p className="text-xs text-honey-muted">{r.is_active ? "Active" : "Inactive"}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(r.is_pickup_point)}
                  disabled={savingKey === `toggle:${r.id}`}
                  onChange={(e) => void toggle(r.id, e.target.checked)}
                />
                Pickup point
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="datetime-local"
                className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                value={draftById[r.id]?.from ?? ""}
                onChange={(e) =>
                  setDraftById((prev) => ({
                    ...prev,
                    [r.id]: { ...(prev[r.id] ?? { from: "", until: "" }), from: e.target.value },
                  }))
                }
              />
              <input
                type="datetime-local"
                className="rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                value={draftById[r.id]?.until ?? ""}
                onChange={(e) =>
                  setDraftById((prev) => ({
                    ...prev,
                    [r.id]: { ...(prev[r.id] ?? { from: "", until: "" }), until: e.target.value },
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-honey-muted">
                Optional window. Empty = always available when pickup is enabled.
              </p>
              <button
                type="button"
                disabled={savingKey === `window:${r.id}`}
                onClick={() => void saveWindow(r.id)}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {savingKey === `window:${r.id}` ? "Saving..." : "Save time"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
