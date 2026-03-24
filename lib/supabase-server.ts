import { createServiceClient } from "@/lib/supabase/admin";

/** Part 8: server-only admin client for API routes (same as `createServiceClient`). */
export function getSupabaseAdmin() {
  return createServiceClient();
}
