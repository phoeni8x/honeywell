"use client";

import { CryptoTicker } from "@/components/CryptoTicker";
import { useEffect, useState } from "react";

export default function CryptoRatesPage() {
  const [prices, setPrices] = useState<Record<string, { eur?: number; huf?: number }>>({});
  const [activeCoin, setActiveCoin] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.active_crypto_coin) setActiveCoin(d.active_crypto_coin);
      })
      .catch(() => {});

    fetch("/api/crypto/prices")
      .then((r) => r.json())
      .then((d) => {
        if (d.prices) setPrices(d.prices);
      })
      .catch(() => {});
  }, []);

  const cards = [
    { id: "bitcoin", label: "Bitcoin", sym: "BTC" },
    { id: "ethereum", label: "Ethereum", sym: "ETH" },
    { id: "tether", label: "Tether", sym: "USDT" },
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl text-honey-text">Crypto rates</h1>
        <p className="mt-2 text-honey-muted">Live prices vs EUR and HUF (CoinGecko, ~30s refresh).</p>
      </div>

      <CryptoTicker embedded />

      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((c) => {
          const p = prices[c.id];
          const isActive = activeCoin === c.id;
          return (
            <div
              key={c.id}
              className="rounded-3xl border border-honey-border bg-surface p-6 shadow-sm dark:bg-surface-dark"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-2xl text-honey-text">{c.label}</h2>
                <span className="text-xs font-bold text-honey-muted">{c.sym}</span>
              </div>
              {isActive && (
                <p className="mt-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Active payment coin on Honey Well
                </p>
              )}
              <p className="mt-4 text-3xl font-semibold text-honey-text">
                {p?.eur !== undefined ? `€${p.eur.toLocaleString("en-GB", { maximumFractionDigits: 2 })}` : "—"}
              </p>
              <p className="mt-1 text-sm text-honey-muted">
                {p?.huf !== undefined ? `${Math.round(p.huf).toLocaleString("hu-HU")} HUF` : ""}
              </p>
              <p className="mt-4 text-xs text-honey-muted">24h change: use CoinGecko Pro for extended stats.</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
