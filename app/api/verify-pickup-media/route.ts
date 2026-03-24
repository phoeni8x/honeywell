import { NextResponse } from "next/server";

/** Media checks — server-side validation can be extended without exposing internals to clients. */
export async function POST() {
  return NextResponse.json({ ok: true, flagged: false });
}
