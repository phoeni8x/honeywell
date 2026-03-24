"use client";

import { useWallet } from "@/lib/WalletContext";
import { LS_MY_REFERRAL_CODE } from "@/lib/constants";
import { LEVEL_META } from "@/lib/levels";
import clsx from "clsx";
import { ChevronDown, Coins, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function WalletNav() {
  const [open, setOpen] = useState(false);
  const { bees, points, level, levelName, loading, referralCode, refresh } = useWallet();

  useEffect(() => {
    if (!referralCode) return;
    try {
      localStorage.setItem(LS_MY_REFERRAL_CODE, referralCode);
    } catch {
      /* ignore */
    }
  }, [referralCode]);

  if (loading) {
    return (
      <span className="hidden h-8 w-16 animate-pulse rounded-sm bg-white/10 sm:inline-block" />
    );
  }

  const levelMeta = LEVEL_META[level] ?? LEVEL_META[1];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "inline-flex max-w-[220px] items-center gap-1 overflow-hidden text-ellipsis rounded-sm border border-primary/50 px-2 py-1 text-[11px] font-semibold sm:max-w-none sm:gap-2 sm:text-xs",
          "bg-primary text-on-primary"
        )}
      >
        <span className="inline-flex items-center gap-1">
          <Coins className="h-3.5 w-3.5" />
          {bees.toFixed(2)} Bees
        </span>
        <span className="text-on-primary/70">|</span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          {points} pts
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-on-primary/80" />
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border-2 border-honey-border bg-surface p-4 text-sm shadow-xl dark:bg-surface-dark">
            <p className="font-medium text-honey-text">Account</p>
            <div className="mt-2 inline-flex items-center">
              <span className="hex-border relative inline-flex min-w-[2.5rem] items-center justify-center bg-primary px-2 py-1 hex-clip">
                <span className="font-display text-xs font-bold text-on-primary">{level}</span>
              </span>
              <p
                className="ml-2 inline-flex rounded-sm px-2 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: `${levelMeta.color}22`, color: levelMeta.color }}
              >
                {levelName}
              </p>
            </div>
            <p className="mt-3 text-honey-muted">
              {bees.toFixed(2)} Bees (1 Bee = 10,000 HUF)
            </p>
            <p className="mt-1 text-honey-muted">{points} points · 1000 pts = 1000 HUF off</p>
            {referralCode && (
              <p className="mt-2 font-mono text-xs text-honey-text">
                Your code: <span className="text-primary">{referralCode}</span>
              </p>
            )}
            <div className="mt-4 flex flex-col gap-1 border-t border-honey-border pt-3">
              <Link
                href="/account/orders"
                className="rounded-lg px-2 py-1.5 text-honey-text hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                Order history
              </Link>
              <Link
                href="/order-history"
                className="rounded-lg px-2 py-1.5 text-honey-muted hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                My orders (classic)
              </Link>
              <Link
                href="/account/deposits"
                className="rounded-lg px-2 py-1.5 text-honey-text hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                Bees deposits
              </Link>
              <Link
                href="/account/referrals"
                className="rounded-lg px-2 py-1.5 text-honey-text hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                Referrals
              </Link>
              <Link
                href="/support"
                className="rounded-lg px-2 py-1.5 text-honey-text hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                Support
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/bees/buy"
                className="rounded border-2 border-primary-dark bg-primary py-2 text-center text-xs font-semibold text-on-primary shadow-[2px_2px_0_var(--color-primary-dark)]"
                onClick={() => setOpen(false)}
              >
                Buy Bees
              </Link>
              <Link
                href="/crypto-guide"
                className="rounded-lg px-2 py-1.5 text-honey-text hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                Crypto guide
              </Link>
              <Link
                href="/crypto-rates"
                className="text-center text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Crypto rates
              </Link>
              <button
                type="button"
                className="rounded-lg px-2 py-1.5 text-left text-xs text-honey-muted hover:bg-honey-border/30"
                onClick={() => void refresh()}
              >
                Refresh balance
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
