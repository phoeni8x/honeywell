import { AdminSidebar } from "@/components/AdminSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { Suspense } from "react";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-honey-border px-4 py-3 md:px-6">
        <Link href="/home" className="text-sm font-medium text-honey-muted hover:text-primary">
          ← Back to site
        </Link>
        <ThemeToggle />
      </header>
      <div className="flex flex-col md:flex-row">
        <Suspense fallback={<div className="w-full border-b border-honey-border p-4 text-sm text-honey-muted md:w-56 md:border-b-0 md:border-r">Loading…</div>}>
          <AdminSidebar />
        </Suspense>
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
