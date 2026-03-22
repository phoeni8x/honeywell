"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { LS_MY_REFERRAL_CODE } from "@/lib/constants";
import { useEffect, useState } from "react";

export default function AccountReferralsPage() {
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total_referrals: 0,
    successful_referrals: 0,
    bees_earned: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getOrCreateCustomerToken();
    if (!t) return;
    fetch("/api/customer/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_token: t }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.referral_code) {
          setCode(d.referral_code);
          localStorage.setItem(LS_MY_REFERRAL_CODE, d.referral_code);
        }
      })
      .catch(() => {});

    fetch("/api/referrals/summary", { headers: { "x-customer-token": t } })
      .then((r) => r.json())
      .then((d) => {
        if (d.referral_code) setCode(d.referral_code);
        setStats({
          total_referrals: d.total_referrals ?? 0,
          successful_referrals: d.successful_referrals ?? 0,
          bees_earned: d.bees_earned ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shareUrl =
    typeof window !== "undefined" && code ? `${window.location.origin}/home?ref=${encodeURIComponent(code)}` : "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl text-honey-text">Referrals</h1>
        <p className="mt-2 text-honey-muted">
          Share your code. When a friend completes their first paid order with your code, rewards apply after the
          order is confirmed.
        </p>
      </div>

      {loading ? (
        <p className="text-honey-muted">Loading…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-honey-border bg-surface p-6 dark:bg-surface-dark">
            <p className="text-sm font-medium text-honey-muted">Your code</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-primary">{code ?? "—"}</p>
            {shareUrl && (
              <button
                type="button"
                className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                Copy invite link
              </button>
            )}
          </div>
          <div className="rounded-2xl border border-honey-border bg-surface p-6 dark:bg-surface-dark">
            <p className="text-sm font-medium text-honey-muted">Stats</p>
            <ul className="mt-3 space-y-2 text-sm text-honey-text">
              <li>Total linked referrals: {stats.total_referrals}</li>
              <li>Rewarded: {stats.successful_referrals}</li>
              <li>Bees earned from referrals: {stats.bees_earned.toFixed(2)}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
