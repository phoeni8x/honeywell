import { randomBytes, randomUUID } from "crypto";

const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Random HW-XXXXXX using crypto (stronger than Math.random; avoids predictable codes). */
export function generateReferralCode(): string {
  const bytes = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHANUM[bytes[i]! % ALPHANUM.length];
  }
  return `HW-${s}`;
}

/**
 * Collision-proof format: HW- + 10 alphanumeric chars from UUID (still fits UI).
 * Used only if many random retries hit a duplicate (extremely unlikely).
 */
export function generateReferralCodeFallback(): string {
  const u = randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `HW-${u}`;
}

/** Postgres unique_violation — safe to retry with a new code. */
export function isPgUniqueViolation(err: { code?: string; message?: string } | null | undefined): boolean {
  if (err?.code === "23505") return true;
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("duplicate key") || m.includes("unique constraint");
}
