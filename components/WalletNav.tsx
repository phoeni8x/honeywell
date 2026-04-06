"use client";

import { getSupportTelegramUrl } from "@/lib/support-telegram";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function WalletNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-sm border border-primary/50 bg-primary px-2 py-1 text-xs font-semibold text-on-primary"
        aria-label="Open account menu"
      >
        <Menu className="h-4 w-4" />
        Menu
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border-2 border-honey-border bg-surface p-4 text-sm shadow-xl dark:bg-surface-dark">
            <p className="font-medium text-honey-text">Account</p>
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
              <a
                href={getSupportTelegramUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-2 py-1.5 text-honey-text hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                Support (Telegram)
              </a>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/home#crypto-guide"
                className="rounded-lg px-2 py-1.5 text-honey-text hover:bg-honey-border/30"
                onClick={() => setOpen(false)}
              >
                Payment info (Home)
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
