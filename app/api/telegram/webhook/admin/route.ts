import { runTelegramWebhook } from "@/lib/telegram-webhook-runner";

export const dynamic = "force-dynamic";

/** Internal admin bot — order buttons, /lists, /broadcast (relays via customer bot), /kick /unban via customer bot. */
export async function POST(request: Request) {
  return runTelegramWebhook(request, "admin");
}
