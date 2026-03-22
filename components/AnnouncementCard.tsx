import type { Announcement } from "@/types";

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const date = new Date(announcement.created_at).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <article className="rounded-2xl border border-honey-border bg-surface p-5 shadow-sm transition hover:shadow-md dark:bg-surface-dark">
      <h3 className="font-display text-xl text-honey-text">{announcement.title}</h3>
      <p className="mt-1 text-xs text-honey-muted">{date}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-honey-text/90">
        {announcement.body}
      </p>
    </article>
  );
}
