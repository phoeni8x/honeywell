"use client";

import { Hexagon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const PACKAGES = [
  { bees: 1, huf: 10_000 },
  { bees: 5, huf: 50_000 },
  { bees: 10, huf: 100_000 },
];

export default function BuyBeesPage() {
  const [custom, setCustom] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [revolutUrl, setRevolutUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.revolut_payment_link) setRevolutUrl(d.revolut_payment_link);
      })
      .catch(() => {});
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3000);
  }

  function selectPackage(huf: number) {
    setSelectedPackage(huf);
    setCustom(String(huf));
  }

  const amountHuf = custom.trim() ? Number(custom) : selectedPackage ?? 0;
  const amountBees = amountHuf / 10_000;

  function handleBuy() {
    if (!amountHuf || amountHuf <= 0) {
      showToast("Please select a package or enter a custom amount.");
      return;
    }
    if (!revolutUrl) {
      showToast("Bank transfer link not configured yet — contact admin.");
      return;
    }
    window.open(revolutUrl, "_blank", "noopener,noreferrer");
    showToast("Opening payment link — send payment then notify admin to credit your Bees.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-6">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Hexagon className="h-8 w-8" />
        </span>
        <h1 className="mt-4 font-display text-4xl text-honey-text">Buy Bees</h1>
        <p className="mt-2 text-honey-muted">
          1 Bee = 10,000 HUF. Your Bees balance is tied to this browser profile.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PACKAGES.map((p) => (
          <button
            key={p.bees}
            type="button"
            onClick={() => selectPackage(p.huf)}
            className={`rounded-2xl border p-5 text-center shadow-sm transition ${
              selectedPackage === p.huf && !custom.trim()
                ? "border-primary bg-primary/10"
                : "border-honey-border bg-surface dark:bg-surface-dark hover:border-primary/40"
            }`}
          >
            <p className="font-display text-3xl text-primary">{p.bees} Bee{p.bees > 1 ? "s" : ""}</p>
            <p className="mt-2 text-sm text-honey-muted">{p.huf.toLocaleString("hu-HU")} HUF</p>
            <p className="mt-3 text-xs font-semibold text-primary">
              {selectedPackage === p.huf && !custom.trim() ? "✓ Selected" : "Select"}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-honey-border bg-bg/50 p-6 dark:bg-black/20">
        <label className="text-sm font-medium text-honey-text">Custom amount (HUF)</label>
        <input
          type="number"
          min={0}
          step={1000}
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            setSelectedPackage(null);
          }}
          className="mt-2 w-full rounded-xl border border-honey-border bg-surface px-4 py-3 text-honey-text dark:bg-surface-dark"
          placeholder="e.g. 25000"
        />
        {amountHuf > 0 && (
          <p className="mt-2 text-sm text-honey-muted">
            = <span className="font-semibold text-honey-text">{amountBees.toFixed(4)} Bees</span>
          </p>
        )}
      </div>

      {amountHuf > 0 && (
        <p className="text-center text-sm font-medium text-honey-text">
          Selected amount: <span className="text-primary">{amountHuf.toLocaleString("hu-HU")} HUF ({amountBees.toFixed(4)} Bees)</span>
        </p>
      )}
      {!amountHuf && (
        <p className="text-center text-sm text-honey-muted">Choose a package or enter custom amount</p>
      )}

      <button
        type="button"
        onClick={handleBuy}
        disabled={!amountHuf || amountHuf <= 0}
        className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        Buy with bank transfer
      </button>

      <p className="text-center text-sm text-honey-muted">
        After admin confirms your payment in the dashboard, Bees are credited to your wallet automatically.
      </p>

      <p className="text-center text-sm">
        <Link href="/shop" className="text-primary hover:underline">
          Back to shop
        </Link>
      </p>
    </div>
  );
}
