import { createServerSupabase } from "@/lib/supabase/server";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function passcodeMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Single-field admin login: user enters the access code only.
 * 1) Code must match ADMIN_ACCESS_CODE.
 * 2) Server signs in to Supabase with ADMIN_EMAIL so RLS (authenticated) still works.
 *    Use ADMIN_PASSWORD if set; otherwise the entered code is used as the Supabase password (set the admin user’s password in Supabase to match ADMIN_ACCESS_CODE).
 */
export async function POST(request: Request) {
  const access = process.env.ADMIN_ACCESS_CODE;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!access || !email) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "Enter your access code" }, { status: 400 });
  }

  if (!passcodeMatches(code, access)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  const passwordForSupabase = password || code;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwordForSupabase });
    if (error) {
      return NextResponse.json(
        {
          error:
            "Could not start session. Set the Supabase Auth user for ADMIN_EMAIL to use this access code as its password (or set ADMIN_PASSWORD).",
        },
        { status: 401 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
