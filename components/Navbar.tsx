"use client";

import { BrandHoneyWellTitle, RainbowHexLogo } from "@/components/BrandHoneyWellTitle";
import { LS_USER_TYPE } from "@/lib/constants";
import type { UserType } from "@/types";
import clsx from "clsx";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/home", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/order-history", label: "My Orders" },
  { href: "/news", label: "News" },
];

const TAB_RAINBOW = [
  "#ff1744",
  "#ff6d00",
  "#ffd600",
  "#00e676",
  "#00b0ff",
  "#651fff",
  "#d500f9",
  "#f50057",
];

function pickTabColor() {
  return TAB_RAINBOW[Math.floor(Math.random() * TAB_RAINBOW.length)]!;
}

export function Navbar() {
  const pathname = usePathname();
  const [userType, setUserType] = useState<UserType | null>(null);
  const [activeTabColor, setActiveTabColor] = useState(TAB_RAINBOW[0]!);

  useEffect(() => {
    const v = localStorage.getItem(LS_USER_TYPE) as UserType | null;
    if (v === "team_member" || v === "guest") setUserType(v);
  }, []);

  useEffect(() => {
    setActiveTabColor(pickTabColor());
  }, [pathname]);

  const onPrimary = "#0d0d00";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-hive-black/95 text-white backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6">
        {/* Row 1: logo + full-width spread title + actions (tabs are below on all breakpoints) */}
        <div className="flex items-center gap-1.5 py-2.5 sm:gap-3 sm:py-3">
          <Link
            href="/home"
            className="group flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3"
            aria-label="Honey Well home"
          >
            <RainbowHexLogo className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
            <BrandHoneyWellTitle size="sm" spread className="min-w-0 flex-1" />
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
            <Link
              href="/shop"
              className="hidden rounded border border-white/20 p-1.5 text-pink-300 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10 hover:text-fuchsia-200 sm:inline-flex sm:p-2"
              aria-label="Shop"
            >
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
            {userType && (
              <span
                className={clsx(
                  "max-w-[4.5rem] truncate rounded-sm px-1.5 py-0.5 text-[10px] font-semibold sm:max-w-[100px] sm:px-2.5 sm:py-1 sm:text-xs",
                  userType === "team_member"
                    ? "bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.45)]"
                    : "bg-white/10 text-white/80"
                )}
              >
                {userType === "team_member" ? "VIP" : "Guest"}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: navigation — below title on phone and laptop */}
        <nav
          className="flex border-t border-white/10 py-1.5 sm:py-2 md:justify-center md:gap-1 md:py-2.5"
          aria-label="Main navigation"
        >
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex-1 rounded-lg py-2 text-center text-xs font-medium transition sm:text-sm",
                  "md:flex-none md:rounded-full md:px-4 md:py-2",
                  active
                    ? "shadow-[0_0_18px_rgba(255,255,255,0.12)]"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
                )}
                style={
                  active
                    ? { backgroundColor: activeTabColor, color: onPrimary }
                    : undefined
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
