import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { NextResponse } from "next/server";

const EXPOSE = process.env.ADMIN_API_EXPOSE_DB_ERRORS === "1";

/** Log full error; optionally echo safe technical detail in JSON when ADMIN_API_EXPOSE_DB_ERRORS=1. */
export function logAdminRouteError(tag: string, err: unknown, supabaseError?: { message?: string; code?: string; details?: string; hint?: string }) {
  console.error(`[${tag}]`, err);
  if (supabaseError) {
    console.error(`[${tag}] supabase:`, {
      message: supabaseError.message,
      code: supabaseError.code,
      details: supabaseError.details,
      hint: supabaseError.hint,
    });
  }
}

function isMissingTableError(supabaseError?: { message?: string; code?: string }): boolean {
  if (!supabaseError) return false;
  const msg = String(supabaseError.message ?? "").toLowerCase();
  const code = String(supabaseError.code ?? "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}

export function jsonAdminSupabaseFailure(tag: string, supabaseError: { message?: string; code?: string; details?: string; hint?: string }) {
  logAdminRouteError(tag, "Supabase query failed", supabaseError);

  if (isMissingTableError(supabaseError)) {
    return NextResponse.json(
      {
        error:
          "Parcel machine slots are not set up in the database yet. Open the Supabase SQL editor and run the migration file supabase/migrations/045_parcel_machine_slots.sql (or push migrations), then retry.",
        code: "table_missing",
        ...(EXPOSE ? { debug: supabaseError.message } : {}),
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST,
      ...(EXPOSE ? { debug: supabaseError.message ?? String(supabaseError) } : {}),
    },
    { status: 500 }
  );
}

export function jsonAdminUnexpectedError(tag: string, err: unknown) {
  logAdminRouteError(tag, err);
  const message = err instanceof Error ? err.message : String(err);
  const config = message.includes("SUPABASE_SERVICE_ROLE_KEY") || message.includes("Missing Supabase");

  if (config) {
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set on the deployment for admin database routes.",
        code: "missing_service_role",
        ...(EXPOSE ? { debug: message } : {}),
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: EXPOSE ? message : PUBLIC_ERROR_TRY_AGAIN_OR_GUEST,
      ...(EXPOSE && err instanceof Error && err.stack ? { stack: err.stack } : {}),
    },
    { status: 500 }
  );
}
