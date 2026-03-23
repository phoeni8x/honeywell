"use client";

import clsx from "clsx";
import {
  Headphones,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Skull,
  Ticket,
  Truck,
} from "lucide-react";
import { ADMIN_BASE_PATH } from "@/lib/constants";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, href: `${ADMIN_BASE_PATH}?tab=overview` },
  { id: "products", label: "Products", icon: Package, href: `${ADMIN_BASE_PATH}?tab=products` },
  { id: "orders", label: "Orders", icon: ShoppingCart, href: `${ADMIN_BASE_PATH}?tab=orders` },
  { id: "locations", label: "Locations", icon: MapPin, href: `${ADMIN_BASE_PATH}?tab=locations` },
  { id: "tickets", label: "Stock", icon: Ticket, href: `${ADMIN_BASE_PATH}?tab=tickets` },
  { id: "support", label: "Support", icon: Headphones, href: `${ADMIN_BASE_PATH}?tab=support` },
  { id: "announcements", label: "Announcements", icon: Megaphone, href: `${ADMIN_BASE_PATH}?tab=announcements` },
  { id: "settings", label: "Settings", icon: Settings, href: `${ADMIN_BASE_PATH}?tab=settings` },
] as const;

const part4 = [
  { label: "Dead drops", href: `${ADMIN_BASE_PATH}/dead-drops`, icon: Skull },
  { label: "Deliveries", href: `${ADMIN_BASE_PATH}/deliveries`, icon: Truck },
  { label: "Pickup points", href: `${ADMIN_BASE_PATH}/pickup-points`, icon: MapPin },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "overview";

  return (
    <aside className="flex w-full flex-col gap-1 border-b border-honey-border bg-surface p-4 dark:border-honey-border dark:bg-surface-dark md:w-56 md:border-b-0 md:border-r">
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-honey-muted">Honey Well</p>
      {tabs.map(({ id, label, icon: Icon, href }) => {
        const active = pathname === ADMIN_BASE_PATH && tab === id;
        return (
          <Link
            key={id}
            href={href}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary/15 text-primary" : "text-honey-muted hover:bg-honey-border/40 hover:text-honey-text"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
      <p className="mb-1 mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-honey-muted">Fulfillment</p>
      {part4.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary/15 text-primary" : "text-honey-muted hover:bg-honey-border/40 hover:text-honey-text"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
