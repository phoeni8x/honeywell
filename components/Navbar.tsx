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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href="/home"
          className="group flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:min-w-[200px] md:pr-4"
        >
          <RainbowHexLogo className="shrink-0" />
          <BrandHoneyWellTitle size="sm" className="min-w-0 max-w-[58vw] md:hidden" />
          <BrandHoneyWellTitle size="sm" spread className="hidden min-w-0 flex-1 md:flex" />
        </Link>

        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  active
                    ? "shadow-[0_0_18px_rgba(255,255,255,0.15)]"
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

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/shop"
            className="hidden rounded border border-white/20 p-2 text-pink-300 transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10 hover:text-fuchsia-200 sm:inline-flex"
            aria-label="Shop"
          >
            <ShoppingBag className="h-5 w-5" />
          </Link>
          {userType && (
            <span
              className={clsx(
                "hidden max-w-[100px] truncate rounded-sm px-2.5 py-1 text-xs font-semibold sm:inline-block",
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

      <nav className="flex border-t border-white/10 px-2 py-2 md:hidden">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex-1 rounded-lg py-2 text-center text-sm font-medium transition",
                active ? "" : "text-white/85"
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
    </header>
  );
}
