"use client";

import { getSupportTelegramUrl } from "@/lib/support-telegram";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

/**
 * Floating button → Telegram (Chatwoot inbox). If videos fail in Chatwoot, check: Telegram channel
 * "Allow receiving files" in BotFather, Chatwoot attachment size limits, and that the agent inbox accepts video MIME types.
 */
export function SupportTelegramBubble() {
  const pathname = usePathname();
  const href = getSupportTelegramUrl();

  if (pathname === "/under-development") return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-2 ring-primary/30 transition hover:scale-105 hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label="Chat with us on Telegram"
      title="Support — Telegram"
    >
      <MessageCircle className="h-7 w-7" strokeWidth={2} />
    </a>
  );
}
