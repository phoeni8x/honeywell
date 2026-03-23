"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

type Row = {
  id: string;
  label: string;
  eur?: number;
  huf?: number;
};

export function CryptoTicker({ embedded = false }: { embedded?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const prev = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/crypto/prices");
        const j = await res.json();
        if (!res.ok || !j.prices) return;
        const p = j.prices as Record<string, { eur?: number; huf?: number }>;
        const next: Row[] = ["bitcoin", "ethereum", "tether"].map((id) => {
          const label = id === "bitcoin" ? "BTC" : id === "ethereum" ? "ETH" : "USDT";
          const eur = p[id]?.eur;
          const huf = p[id]?.huf;
          const key = id;
          if (eur !== undefined) prev.current[key] = eur;
          return { id, label, eur, huf };
        });
        if (!cancelled) setRows(next);
      } catch {
        /* offline */
      }
    }

    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const line = rows
    .map((r) => {
      const eur = Number(r.eur);
      const huf = Number(r.huf);
      if (!Number.isFinite(eur) || !Number.isFinite(huf)) return null;
      return `${r.label}: €${eur.toLocaleString("en-GB", { maximumFractionDigits: 0 })} / ${Math.round(huf).toLocaleString("hu-HU")} HUF`;
    })
    .filter(Boolean)
    .join("   ·   ");

  if (!line) {
    return embedded ? null : (
      <div className="border-b border-honey-border bg-surface/80 py-2 text-center text-xs text-honey-muted dark:bg-surface-dark/80">
        Loading crypto rates…
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "overflow-hidden border-b border-honey-border bg-primary/5",
        embedded ? "rounded-xl" : ""
      )}
    >
      <div className="animate-ticker flex whitespace-nowrap py-2 text-xs font-medium text-honey-text">
        <span className="px-6">{line}</span>
        <span className="px-6" aria-hidden>
          {line}
        </span>
      </div>
    </div>
  );
}
