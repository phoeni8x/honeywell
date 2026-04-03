import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean | string> = {
    supabase: false,
    env_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    env_anon_key: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    env_service_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    env_telegram_admin_token: Boolean(process.env.TELEGRAM_ADMIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN),
    env_telegram_customer_token: Boolean(process.env.TELEGRAM_CUSTOMER_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN),
    env_app_url: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    timestamp: new Date().toISOString(),
  };

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("products").select("id").limit(1);
    checks.supabase = !error;
  } catch {
    checks.supabase = false;
  }

  const allGood =
    Boolean(checks.env_supabase_url) &&
    Boolean(checks.env_anon_key) &&
    Boolean(checks.env_service_key) &&
    Boolean(checks.supabase);

  return NextResponse.json(checks, { status: allGood ? 200 : 500 });
}
