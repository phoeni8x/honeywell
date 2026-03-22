"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";

type Loc = {
  id: string;
  name: string;
  is_active: boolean;
  is_pickup_point: boolean | null;
};

export default function AdminPickupPointsPage() {
  const [rows, setRows] = useState<Loc[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("shop_locations").select("*").order("name", { ascending: true });
    setRows((data as Loc[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(id: string, value: boolean) {
    const supabase = createClient();
    await supabase.from("shop_locations").update({ is_pickup_point: value }).eq("id", id);
    load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl text-honey-text">Pickup points</h1>
        <p className="mt-2 text-sm text-honey-muted">Toggle which shop locations appear as pickup options at checkout (team members).</p>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-xl border border-honey-border px-4 py-3">
            <div>
              <p className="font-medium text-honey-text">{r.name}</p>
              <p className="text-xs text-honey-muted">{r.is_active ? "Active" : "Inactive"}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(r.is_pickup_point)}
                onChange={(e) => toggle(r.id, e.target.checked)}
              />
              Pickup point
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
