"use client";

import { AnnouncementCard } from "@/components/AnnouncementCard";
import { createClient } from "@/lib/supabase/client";
import type { Announcement } from "@/types";
import { useEffect, useState } from "react";

export default function NewsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(24);
      setAnnouncements((data as Announcement[]) ?? []);
    })().catch(() => {});
  }, []);

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl text-honey-text">News</h1>
        <p className="mt-2 text-honey-muted">Latest announcements from the Honey Well team.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {announcements.length === 0 ? (
          <p className="col-span-full rounded-2xl border border-dashed border-honey-border bg-bg/50 px-6 py-12 text-center text-honey-muted">
            No announcements yet — check back soon.
          </p>
        ) : (
          announcements.map((a) => <AnnouncementCard key={a.id} announcement={a} />)
        )}
      </div>
    </div>
  );
}
