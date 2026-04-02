"use client";

import { CRYPTO_COIN_OPTIONS } from "@/lib/crypto-coins";
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
        const next: Row[] = CRYPTO_COIN_OPTIONS.map(({ geckoId, symbol }) => {
          const id = geckoId;
          const label = symbol;
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
      <div className="border-b-2 border-fuchsia-500/35 bg-gradient-to-r from-pink-950/30 via-violet-950/20 to-cyan-950/30 py-2 text-center text-xs text-white/70">
        Loading crypto rates…
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "overflow-hidden border-b-2 border-fuchsia-500/40 bg-gradient-to-r from-pink-950/40 via-violet-900/25 to-cyan-950/40 bg-[length:200%_100%] animate-gradient-shift",
        embedded ? "rounded-xl" : ""
      )}
    >
      <div className="animate-ticker flex whitespace-nowrap py-2 text-xs font-medium text-white/90 [text-shadow:0_0_12px_rgba(255,100,200,0.35)]">
        <span className="px-6">{line}</span>
        <span className="px-6" aria-hidden>
          {line}
        </span>
      </div>
    </div>
  );
}
