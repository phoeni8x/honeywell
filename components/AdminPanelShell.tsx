"use client";

import clsx from "clsx";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";

export function AdminPanelShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-honey-border px-4 py-3 md:px-6">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-honey-border px-3 py-1.5 text-sm text-honey-muted transition hover:text-primary md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          Menu
        </button>
        <Link href="/home" className="text-sm font-medium text-honey-muted hover:text-primary">
          ← Back to site
        </Link>
      </header>

      <div className="relative flex">
        <div
          className={clsx(
            "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 md:hidden",
            menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setMenuOpen(false)}
          aria-hidden={!menuOpen}
        />

        <Suspense
          fallback={
            <div className="w-full border-b border-honey-border p-4 text-sm text-honey-muted md:w-56 md:border-b-0 md:border-r">
              Loading...
            </div>
          }
        >
          <AdminSidebar
            className={clsx(
              "fixed left-0 top-0 z-50 h-screen w-72 max-w-[85vw] overflow-y-auto border-r border-honey-border transition-transform duration-300 md:static md:h-auto md:w-56 md:translate-x-0",
              menuOpen ? "translate-x-0" : "-translate-x-full"
            )}
            onNavigate={() => setMenuOpen(false)}
          />
        </Suspense>

        <div className="flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}

