"use client";

import { Hexagon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const PACKAGES = [
  { bees: 1, huf: 10_000 },
  { bees: 5, huf: 50_000 },
  { bees: 10, huf: 100_000 },
];

export default function BuyBeesPage() {
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<"revolut" | "crypto">("revolut");

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-6">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Hexagon className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-4xl text-honey-text">Buy Bees</h1>
        <p className="mt-2 text-honey-muted">
          1 Bee = 10,000 HUF. Your Bees balance is tied to this browser profile. Team members can use Revolut or crypto
          for top-ups — same options as at shop checkout.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PACKAGES.map((p) => (
          <div
            key={p.bees}
            className="rounded-2xl border border-honey-border bg-surface p-5 text-center shadow-sm dark:bg-surface-dark"
          >
            <p className="font-display text-3xl text-primary">{p.bees} Bees</p>
            <p className="mt-2 text-sm text-honey-muted">{p.huf.toLocaleString("hu-HU")} HUF</p>
            <button
              type="button"
              className="mt-4 w-full rounded-full border border-primary/40 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Select
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-honey-border bg-bg/50 p-6 dark:bg-black/20">
        <label className="text-sm font-medium text-honey-text">Custom Bees amount</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="mt-2 w-full rounded-xl border border-honey-border bg-surface px-4 py-3 text-honey-text dark:bg-surface-dark"
          placeholder="e.g. 2.5"
        />
      </div>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => setMethod("revolut")}
          className={`rounded-full px-6 py-2 text-sm font-semibold ${
            method === "revolut" ? "bg-primary text-white" : "border border-honey-border text-honey-muted"
          }`}
        >
          Revolut
        </button>
        <button
          type="button"
          onClick={() => setMethod("crypto")}
          className={`rounded-full px-6 py-2 text-sm font-semibold ${
            method === "crypto" ? "bg-primary text-white" : "border border-honey-border text-honey-muted"
          }`}
        >
          Crypto
        </button>
      </div>

      <p className="text-center text-sm text-honey-muted">
        After admin confirms payment in the dashboard, Bees are credited to your wallet. This page is the purchase UI;
        wiring to payment confirmation is done in admin.
      </p>

      <p className="text-center text-sm">
        <Link href="/shop" className="text-primary hover:underline">
          Back to shop
        </Link>
      </p>
    </div>
  );
}
