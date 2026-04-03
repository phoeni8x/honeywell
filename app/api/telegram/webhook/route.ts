import { runTelegramWebhook } from "@/lib/telegram-webhook-runner";

export const dynamic = "force-dynamic";

/** Honey Well customer bot — /start, verify, broadcast opt-in/out (set webhook to …/api/telegram/webhook). */
export async function POST(request: Request) {
  return runTelegramWebhook(request, "customer");
}
