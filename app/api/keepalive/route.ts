import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Optional cron ping to reduce Supabase free-tier pause risk (Part 8). */
export async function GET() {
  try {
    const supabase = createServiceClient();
    await supabase.from("products").select("id").limit(1);
  } catch {
    /* still return 200 so cron does not retry aggressively */
  }
  return new Response("alive", { status: 200 });
}
