"use client";

import { createClient } from "@/lib/supabase/client";
import clsx from "clsx";
import {
  Headphones,
  Inbox,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Ticket,
  Users,
  Warehouse,
} from "lucide-react";
import { ADMIN_BASE_PATH } from "@/lib/constants";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RainbowHeading } from "@/components/BrandHoneyWellTitle";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, href: `${ADMIN_BASE_PATH}?tab=overview` },
  { id: "products", label: "Products", icon: Package, href: `${ADMIN_BASE_PATH}?tab=products` },
  { id: "orders", label: "Orders", icon: ShoppingCart, href: `${ADMIN_BASE_PATH}?tab=orders` },
  {
    id: "parcel-machines",
    label: "Parcel machines",
    icon: Warehouse,
    href: `${ADMIN_BASE_PATH}?tab=parcel-machines`,
  },
  { id: "locations", label: "Locations", icon: MapPin, href: `${ADMIN_BASE_PATH}?tab=locations` },
  { id: "tickets", label: "Location stock", icon: Ticket, href: `${ADMIN_BASE_PATH}?tab=tickets` },
  { id: "customers", label: "Customers", icon: Users, href: `${ADMIN_BASE_PATH}/customers` },
  { id: "announcements", label: "Announcements", icon: Megaphone, href: `${ADMIN_BASE_PATH}?tab=announcements` },
  { id: "settings", label: "Settings", icon: Settings, href: `${ADMIN_BASE_PATH}?tab=settings` },
] as const;

export function AdminSidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";
  const supabase = useMemo(() => createClient(), []);
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    async function load() {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["payment_pending", "awaiting_dead_drop"]);
      setPendingOrders(count ?? 0);
    }
    void load();
    const ch = supabase
      .channel("sidebar-pending-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [supabase]);

  return (
    <aside
      className={clsx(
        "flex w-full flex-col gap-1 border-b border-honey-border bg-surface p-4 dark:border-honey-border dark:bg-surface-dark md:w-56 md:border-b-0 md:border-r",
        className
      )}
    >
      <RainbowHeading
        as="p"
        text="HONEY WELL"
        className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide"
      />
      {tabs.map(({ id, label, icon: Icon, href }) => {
        const active = href.includes("?")
          ? pathname === ADMIN_BASE_PATH && tab === id
          : pathname === href || pathname.startsWith(`${href}/`);
        const showBadge = id === "orders" && pendingOrders > 0;
        return (
          <Link
            key={id}
            href={href}
            onClick={onNavigate}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-gradient-to-r from-fuchsia-500/15 via-amber-400/15 to-cyan-500/15 text-honey-text"
                : "text-honey-muted hover:bg-honey-border/40 hover:text-honey-text"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span
                className={clsx(
                  active && "bg-gradient-to-r from-fuchsia-400 via-amber-300 to-cyan-400 bg-clip-text text-transparent"
                )}
              >
                {label}
              </span>
              {showBadge ? (
                <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                  {pendingOrders > 99 ? "99+" : pendingOrders}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
