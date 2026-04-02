"use client";

import { LS_USER_TYPE } from "@/lib/constants";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotAMemberPage() {
  const router = useRouter();

  function shopAsGuest() {
    localStorage.setItem(LS_USER_TYPE, "guest");
    router.push("/home");
  }

  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Sparkles className="h-7 w-7" />
      </span>
      <h1 className="mt-6 font-display text-3xl text-honey-text md:text-4xl">Not a VIP yet</h1>
      <p className="mt-4 text-pretty text-honey-muted">
        It looks like you&apos;re not part of the Honey Well team channel yet. No worries — you can still shop as a
        guest!
      </p>
      <ul className="mt-8 space-y-3 rounded-2xl border border-honey-border bg-surface px-6 py-6 text-left text-sm text-honey-muted dark:bg-surface-dark">
        <li>
          <strong className="text-honey-text">VIPs</strong> get discounted prices and can pay with bank transfer or cryptocurrency.
        </li>
        <li>
          <strong className="text-honey-text">Guests</strong> shop at regular prices and use the crypto checkout flow.
        </li>
      </ul>
      <button
        type="button"
        onClick={shopAsGuest}
        className="mt-10 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-primary-light"
      >
        Shop as Guest
      </button>
      <p className="mt-6 text-sm">
        <Link href="/" className="text-primary underline-offset-2 hover:underline">
          Back to entry
        </Link>
      </p>
    </div>
  );
}
