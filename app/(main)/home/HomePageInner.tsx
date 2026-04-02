"use client";

import { CryptoGuideContent } from "@/components/CryptoGuideContent";
import { HoneycombBg } from "@/components/HoneycombBg";
import { LS_REFERRED_BY, LS_USER_TYPE } from "@/lib/constants";
import type { UserType } from "@/types";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type TaglineRow = { title: string; body: string };

export function HomePageInner() {
  const searchParams = useSearchParams();
  const [tagline, setTagline] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref && ref.trim()) {
      const normalized = ref.trim().toUpperCase();
      localStorage.setItem(LS_REFERRED_BY, normalized);
    }
  }, [searchParams]);

  useEffect(() => {
    const v = localStorage.getItem(LS_USER_TYPE) as UserType | null;
    if (v === "team_member" || v === "guest") setUserType(v);
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.hero_tagline) setTagline(d.hero_tagline);
      })
      .catch(() => {});
  }, []);

  const faqs: TaglineRow[] = [
    {
      title: "1. Browse products",
      body: "Open the shop and filter by flowers or vitamins. Stock updates live.",
    },
    {
      title: "2. Add to cart & checkout",
      body: "Choose quantity on the product page and confirm your order. Stock is reserved when you confirm.",
    },
    {
      title: "3. Pay",
      body: "Team members can pay the remainder with bank transfer or cryptocurrency — your choice at checkout. Guests pay with cryptocurrency.",
    },
    {
      title: "4. Collect",
      body: "When your order is ready, you will receive your dead-drop details here. Follow the instructions from the team.",
    },
  ];

  const refInUrl = searchParams.get("ref")?.trim();

  return (
    <div className="space-y-16 pb-16">
      {refInUrl && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm text-honey-text dark:bg-primary/10">
          Referral code saved for checkout. Thanks for visiting through a friend.
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border-2 border-honey-border bg-surface px-6 py-14 text-center shadow-[4px_4px_0_rgba(240,192,64,0.35)] dark:bg-surface-dark md:px-12">
        <HoneycombBg className="opacity-[0.14]" />
        <div className="relative z-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Welcome</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-honey-text md:text-5xl">Honey Well</h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-lg text-honey-muted">
            {tagline ?? "Seasonal blooms, daily vitamins, and calm service — curated for our community."}
          </p>
          <Link href="/shop" className="btn-primary mt-8 inline-flex">
            Browse products
          </Link>
        </div>
      </section>

      {userType === "team_member" && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 px-6 py-5 text-center dark:from-primary/20 dark:via-accent/15">
          <p className="font-display text-lg text-honey-text">
            Welcome back, team member! You have access to exclusive discounts and can pay with bank transfer or crypto.
          </p>
        </div>
      )}

      <section id="crypto-guide" className="scroll-mt-24 rounded-3xl border-2 border-honey-border bg-surface/80 px-6 py-10 dark:bg-surface-dark/80 md:px-10">
        <CryptoGuideContent />
      </section>

      <section>
        <h2 className="font-display text-3xl text-honey-text">How to use this website</h2>
        <div className="mt-6 space-y-2">
          {faqs.map((item, i) => (
            <div key={item.title} className="overflow-hidden rounded-2xl border border-honey-border bg-surface dark:bg-surface-dark">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-honey-text"
              >
                {item.title}
                <ChevronDown
                  className={clsx("h-5 w-5 shrink-0 transition", openFaq === i && "rotate-180")}
                />
              </button>
              {openFaq === i && (
                <div className="border-t border-honey-border px-5 py-4 text-sm text-honey-muted">{item.body}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border-2 border-amber-300 bg-amber-50/70 px-6 py-8 dark:border-amber-500/40 dark:bg-amber-900/10 md:px-8">
        <h2 className="font-display text-3xl text-honey-text">Terms &amp; conditions</h2>
        <p className="mt-2 text-sm text-honey-muted">By using Honey Well, you agree to follow these rules.</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-honey-text">
          <li>No abusive, fraudulent, or mischievous behavior. Serious violations can lead to a permanent ban.</li>
          <li>All payments are treated as instant and final once sent.</li>
          <li>No credits, no pay-later, and no unpaid reservations.</li>
        </ul>
        <p className="mt-4 text-sm font-medium text-honey-text">In case of any issue, feel free to contact support anytime.</p>
      </section>
    </div>
  );
}
