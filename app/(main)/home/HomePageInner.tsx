"use client";

import { AnnouncementCard } from "@/components/AnnouncementCard";
import { HoneycombBg } from "@/components/HoneycombBg";
import { LS_REFERRED_BY, LS_USER_TYPE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Announcement, UserType } from "@/types";
import clsx from "clsx";
import { ChevronDown, Leaf } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type TaglineRow = { title: string; body: string };

export function HomePageInner() {
  const searchParams = useSearchParams();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(12);
      setAnnouncements((data as Announcement[]) ?? []);
    })().catch(() => {
      /* Supabase offline */
    });

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
      body: "Team members pay via Revolut. Guests follow the crypto instructions on the payment page.",
    },
    {
      title: "4. Pick up",
      body: "When your order is ready, pick up at our location. Upload a quick photo when you collect.",
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
            {tagline ??
              "Seasonal blooms, daily vitamins, and calm service — curated for our community."}
          </p>
          <Link href="/shop" className="btn-primary mt-8 inline-flex">
            Browse products
          </Link>
        </div>
      </section>

      {userType === "team_member" && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 px-6 py-5 text-center dark:from-primary/20 dark:via-accent/15">
          <p className="font-display text-lg text-honey-text">
            Welcome back, team member! You have access to exclusive discounts and Revolut payments.
          </p>
        </div>
      )}

      <section>
        <h2 className="font-display text-3xl text-honey-text">News &amp; updates</h2>
        <p className="mt-2 text-honey-muted">Latest announcements from the Honey Well team.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {announcements.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-dashed border-honey-border bg-bg/50 px-6 py-12 text-center text-honey-muted">
              No announcements yet — check back soon.
            </p>
          ) : (
            announcements.map((a) => <AnnouncementCard key={a.id} announcement={a} />)
          )}
        </div>
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
        <div className="mt-8 rounded-2xl border border-honey-border bg-bg/50 p-6 dark:bg-black/20">
          <p className="text-sm font-semibold text-honey-text">Pickup location</p>
          <p className="mt-2 text-sm text-honey-muted">
            Address and map are configured in admin. Embed a Google Map here once your address is set in Settings.
          </p>
          <div className="mt-4 flex h-48 items-center justify-center rounded-xl border border-dashed border-honey-border bg-surface text-sm text-honey-muted dark:bg-surface-dark">
            Map embed placeholder
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border-2 border-honey-border bg-gradient-to-br from-blush/40 via-bg to-primary/10 px-6 py-12 dark:from-[#1a1400] dark:via-bg dark:to-surface-dark md:px-10">
        <Leaf className="absolute -right-8 -top-8 h-24 w-24 text-primary/25" />
        <div className="relative grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl text-honey-text">About Honey Well</h2>
            <p className="mt-4 text-sm leading-relaxed text-honey-muted">
              Honey Well brings together botanical beauty and thoughtful wellness. We source fresh flowers and
              quality vitamin supplements so you can brighten your space and support your routine in one calm,
              trustworthy place.
            </p>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl bg-surface/80 p-5 shadow-sm dark:bg-surface-dark/80">
              <h3 className="font-accent text-xl italic text-primary">Flowers</h3>
              <p className="mt-2 text-sm text-honey-muted">
                Seasonal stems, soft palettes, and arrangements that feel hand-picked — never mass-produced.
              </p>
            </div>
            <div className="rounded-2xl bg-surface/80 p-5 shadow-sm dark:bg-surface-dark/80">
              <h3 className="font-accent text-xl italic text-primary">Vitamins</h3>
              <p className="mt-2 text-sm text-honey-muted">
                B, C, and D supplements chosen for clarity and consistency — clear labels, honest pricing.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
