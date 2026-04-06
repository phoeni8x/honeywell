"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function NotAMemberPage() {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Sparkles className="h-7 w-7" />
      </span>
      <h1 className="mt-6 font-display text-3xl text-honey-text md:text-4xl">Not a VIP yet</h1>
      <p className="mt-4 text-pretty text-honey-muted">
        It looks like you&apos;re not part of the Honey Well team channel yet. Guest shopping is paused for now —
        verify with Telegram on the entry page to unlock the shop and member pricing.
      </p>
      <ul className="mt-8 space-y-3 rounded-2xl border border-honey-border bg-surface px-6 py-6 text-left text-sm text-honey-muted dark:bg-surface-dark">
        <li>
          <strong className="text-honey-text">VIPs</strong> get discounted prices and can pay with bank transfer or
          cryptocurrency.
        </li>
        <li>
          Open our bot, use <code className="rounded bg-honey-border/50 px-1 font-mono text-honey-text">/start</code>,
          then enter your public Telegram username on the home screen to verify.
        </li>
      </ul>
      <p className="mt-10">
        <Link
          href="/"
          className="inline-flex rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-light"
        >
          Back to entry
        </Link>
      </p>
    </div>
  );
}
