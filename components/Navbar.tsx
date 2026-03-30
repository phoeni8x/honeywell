"use client";

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
  { href: "/crypto-rates", label: "Rates" },
  { href: "/crypto-guide", label: "Crypto guide" },
];

export function Navbar() {
  const pathname = usePathname();
  const [userType, setUserType] = useState<UserType | null>(null);

  useEffect(() => {
    const v = localStorage.getItem(LS_USER_TYPE) as UserType | null;
    if (v === "team_member" || v === "guest") setUserType(v);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[#3d3000] bg-hive-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/home" className="group flex items-center gap-3">
          <span className="hex-border relative flex h-10 w-10 shrink-0 items-center justify-center bg-primary hex-clip">
            <span className="font-display text-sm font-bold text-on-primary">H</span>
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-primary md:text-2xl">Honey Well</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                pathname === href ? "bg-primary text-on-primary" : "text-white/90 hover:bg-primary/15 hover:text-primary"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/shop"
            className="hidden rounded border border-primary/50 p-2 text-primary transition hover:bg-primary/15 sm:inline-flex"
            aria-label="Shop"
          >
            <ShoppingBag className="h-5 w-5" />
          </Link>
          {userType && (
            <span
              className={clsx(
                "hidden max-w-[140px] truncate rounded-sm px-2.5 py-1 text-xs font-semibold sm:inline-block",
                userType === "team_member" ? "bg-primary text-on-primary" : "bg-white/10 text-white/80"
              )}
            >
              {userType === "team_member" ? "Team Member" : "Guest"}
            </span>
          )}
        </div>
      </div>

      <nav className="flex border-t border-white/10 px-2 py-2 md:hidden">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex-1 rounded-lg py-2 text-center text-sm font-medium",
              pathname === href ? "bg-primary text-on-primary" : "text-white/85"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
