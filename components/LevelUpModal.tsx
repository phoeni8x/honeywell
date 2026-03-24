"use client";

import { LEVEL_META } from "@/lib/levels";
import { useEffect } from "react";

export function LevelUpModal({ newLevel, onClose }: { newLevel: number; onClose: () => void }) {
  const meta = LEVEL_META[newLevel];
  useEffect(() => {
    const t = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(t);
  }, [onClose]);

  if (!meta) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog">
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-primary bg-surface p-8 text-center shadow-xl dark:bg-surface-dark"
        style={{ borderColor: meta.color }}
      >
        <p className="font-display text-3xl text-primary">Level up!</p>
        <p className="mt-2 font-display text-2xl font-bold" style={{ color: meta.color }}>
          {meta.name}
        </p>
        <p className="mt-2 text-sm text-honey-muted">+{meta.bonusPointsPct}% bonus points on orders</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-semibold text-on-primary"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
