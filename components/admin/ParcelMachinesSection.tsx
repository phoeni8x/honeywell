"use client";

import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import type { ParcelMachineSlot } from "@/types";
import { RainbowHeading } from "@/components/BrandHoneyWellTitle";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";

async function fetchSlots(all = true): Promise<ParcelMachineSlot[]> {
  const res = await fetch(`/api/admin/parcel-machine-slots${all ? "?all=1" : ""}`, { credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { slots?: ParcelMachineSlot[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
  return data.slots ?? [];
}

export function ParcelMachinesSection() {
  const [slots, setSlots] = useState<ParcelMachineSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [machineName, setMachineName] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [locationText, setLocationText] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMachine, setEditMachine] = useState("");
  const [editSlot, setEditSlot] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [editActive, setEditActive] = useState(true);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    window.setTimeout(() => setToast(null), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSlots(await fetchSlots(true));
    } catch {
      showToast(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, false);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addSlot() {
    const mn = machineName.trim();
    const sl = slotLabel.trim();
    const loc = locationText.trim();
    if (!mn || !sl || !loc) {
      showToast("Fill machine name, slot, and location text.", false);
      return;
    }
    setBusyId("__add__");
    try {
      const res = await fetch("/api/admin/parcel-machine-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          machine_name: mn,
          slot_label: sl,
          location_text: loc,
          sort_order: Number(sortOrder) || 0,
          is_active: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "Could not save.", false);
        return;
      }
      setMachineName("");
      setSlotLabel("");
      setLocationText("");
      setSortOrder("0");
      showToast("Slot saved ✓");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  function beginEdit(s: ParcelMachineSlot) {
    setEditingId(s.id);
    setEditMachine(s.machine_name);
    setEditSlot(s.slot_label);
    setEditLocation(s.location_text);
    setEditSort(String(s.sort_order ?? 0));
    setEditActive(s.is_active);
  }

  async function saveEdit() {
    if (!editingId) return;
    const mn = editMachine.trim();
    const sl = editSlot.trim();
    const loc = editLocation.trim();
    if (!mn || !sl || !loc) {
      showToast("Fill machine name, slot, and location text.", false);
      return;
    }
    setBusyId(editingId);
    try {
      const res = await fetch(`/api/admin/parcel-machine-slots/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          machine_name: mn,
          slot_label: sl,
          location_text: loc,
          sort_order: Number(editSort) || 0,
          is_active: editActive,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast(data.error ?? "Could not update.", false);
        return;
      }
      setEditingId(null);
      showToast("Updated ✓");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeSlot(id: string) {
    if (!confirm("Delete this saved slot? Orders already issued are unchanged.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/parcel-machine-slots/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        showToast(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST, false);
        return;
      }
      showToast("Deleted ✓");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={clsx(
            "fixed right-4 top-4 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-xl",
            toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
          )}
        >
          {toast.msg}
        </div>
      )}

      <div>
        <RainbowHeading as="h2" text="PARCEL MACHINE SLOTS" className="text-xl font-display tracking-[0.1em]" />
        <p className="mt-2 max-w-2xl text-sm text-honey-muted">
          Save machines and compartments here. When you approve a parcel-locker payment or issue a locker, pick a slot to
          fill in location text, then enter the one-time passcode for that drop.
        </p>
      </div>

      <div className="rounded-2xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
        <h3 className="text-sm font-semibold text-honey-text">Add slot</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-honey-muted">Machine name</label>
            <input
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="e.g. Foxpost — Tesco Kossuth"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-honey-muted">Slot / compartment</label>
            <input
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
              placeholder="e.g. A-14"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-honey-muted">Location text (customer sees this)</label>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Address, map link, how to find the machine…"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-honey-muted">Sort order</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={busyId !== null}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => void addSlot()}
        >
          {busyId === "__add__" ? "Saving…" : "Add slot"}
        </button>
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-honey-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-honey-border bg-bg/80 text-xs uppercase text-honey-muted">
            <tr>
              <th className="p-2">Machine</th>
              <th className="p-2">Slot</th>
              <th className="p-2">Location preview</th>
              <th className="p-2">Order</th>
              <th className="p-2">Active</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-honey-muted">
                  Loading…
                </td>
              </tr>
            ) : slots.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-honey-muted">
                  No slots yet. Add one above.
                </td>
              </tr>
            ) : (
              slots.map((s) => (
                <tr key={s.id} className="border-b border-honey-border/60 align-top">
                  <td className="p-2 font-medium text-honey-text">{s.machine_name}</td>
                  <td className="p-2">{s.slot_label}</td>
                  <td className="p-2 text-xs text-honey-muted">
                    <span className="line-clamp-3 whitespace-pre-wrap">{s.location_text}</span>
                  </td>
                  <td className="p-2 font-mono text-xs">{s.sort_order}</td>
                  <td className="p-2">{s.is_active ? "Yes" : "No"}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                        disabled={busyId !== null}
                        onClick={() => beginEdit(s)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        disabled={busyId !== null}
                        onClick={() => void removeSlot(s.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => (busyId === null ? setEditingId(null) : undefined)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-honey-border bg-surface p-6 shadow-2xl dark:bg-surface-dark">
            <h3 className="font-display text-lg text-honey-text">Edit slot</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-honey-muted">Machine name</label>
                <input
                  className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                  value={editMachine}
                  onChange={(e) => setEditMachine(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-honey-muted">Slot</label>
                <input
                  className="mt-1 w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                  value={editSlot}
                  onChange={(e) => setEditSlot(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-honey-muted">Location text</label>
                <textarea
                  className="mt-1 min-h-[120px] w-full rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="text-xs font-semibold text-honey-muted">Sort order</label>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-28 rounded-xl border border-honey-border bg-bg px-3 py-2 text-sm"
                    value={editSort}
                    onChange={(e) => setEditSort(e.target.value)}
                  />
                </div>
                <label className="flex items-end gap-2 pb-1 text-sm">
                  <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                  Active (shown in pickers)
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busyId !== null}
                className="rounded-xl border border-honey-border px-4 py-2 text-sm font-semibold"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId !== null}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void saveEdit()}
              >
                {busyId === editingId ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function composeSlotCustomerLocation(slot: ParcelMachineSlot): string {
  return `${slot.machine_name} — ${slot.slot_label}\n\n${slot.location_text}`.trim();
}
