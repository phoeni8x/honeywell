"use client";

import { BrandHoneyWellTitle } from "@/components/BrandHoneyWellTitle";
import { CryptoGuideContent } from "@/components/CryptoGuideContent";
import { HoneycombBg } from "@/components/HoneycombBg";
import { TermsConditionsSection } from "@/components/TermsConditionsSection";
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
      body: "VIPs can pay the remainder with bank transfer or cryptocurrency — your choice at checkout. Guests pay with cryptocurrency.",
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
        <div className="rounded-2xl border border-fuchsia-500/40 bg-gradient-to-r from-pink-500/10 to-cyan-500/10 px-4 py-3 text-center text-sm text-honey-text">
          Referral code saved for checkout. Thanks for visiting through a friend.
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border-2 border-fuchsia-500/40 bg-surface px-6 py-14 text-center shadow-[0_0_48px_rgba(168,85,247,0.22)] dark:bg-surface-dark md:px-12">
        <HoneycombBg className="opacity-[0.14]" />
        <div className="relative z-10">
          <h1 className="flex flex-col items-center gap-2">
            <BrandHoneyWellTitle size="lg" />
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance bg-gradient-to-r from-pink-300 via-amber-200 to-cyan-300 bg-clip-text text-xl italic text-transparent md:text-2xl">
            Welcome to our magical well
          </p>
          <Link href="/shop" className="btn-cta-green mt-8 inline-flex">
            Browse products
          </Link>
        </div>
      </section>

      {userType === "team_member" && (
        <div className="rounded-2xl border-2 border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-950/40 via-violet-950/35 to-cyan-950/40 px-6 py-5 text-center shadow-[0_0_32px_rgba(236,72,153,0.2)]">
          <p className="font-display text-lg text-white">
            Welcome back, VIP! You have access to exclusive discounts and can pay with bank transfer or crypto.
          </p>
        </div>
      )}

      <section
        id="crypto-guide"
        className="scroll-mt-24 rounded-3xl border-2 border-cyan-500/30 bg-surface/80 px-6 py-10 shadow-[0_0_24px_rgba(34,211,238,0.12)] dark:bg-surface-dark/80 md:px-10"
      >
        <CryptoGuideContent />
      </section>

      <section>
        <h2 className="bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-400 bg-clip-text font-display text-3xl text-transparent">
          How to use this website
        </h2>
        <div className="mt-6 space-y-2">
          {faqs.map((item, i) => (
            <div
              key={item.title}
              className="overflow-hidden rounded-2xl border border-violet-500/25 bg-surface dark:bg-surface-dark"
            >
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
                <div className="border-t border-white/10 px-5 py-4 text-sm text-honey-muted">{item.body}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <TermsConditionsSection />
    </div>
  );
}
