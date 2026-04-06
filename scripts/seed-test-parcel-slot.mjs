/**
 * One-off: ensure test parcel slot exists (uses service role from env).
 * Run: node --env-file=.env.local scripts/seed-test-parcel-slot.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const raw = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* use existing process.env only */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const row = {
  machine_name: "[TEST] Demo parcel machine",
  slot_label: "SLOT-01",
  location_text:
    "Test compartment for development. Customer-facing text example: corner of Example Square, locker bank next to entrance. Replace or delete in production. Passcode is entered by you when approving an order.",
  sort_order: 0,
  is_active: true,
};

const { data: existing, error: selErr } = await supabase
  .from("parcel_machine_slots")
  .select("id")
  .eq("machine_name", row.machine_name)
  .eq("slot_label", row.slot_label)
  .maybeSingle();

if (selErr) {
  console.error("Select failed:", selErr.message, selErr.code, selErr.details ?? "");
  if (String(selErr.message).toLowerCase().includes("does not exist") || selErr.code === "42P01") {
    console.error("\nTable parcel_machine_slots is missing. Run supabase/migrations/045_parcel_machine_slots.sql in the Supabase SQL editor first.");
  }
  process.exit(1);
}

if (existing) {
  console.log("Test slot already exists (id:", existing.id, "). No change.");
  process.exit(0);
}

const { data, error } = await supabase.from("parcel_machine_slots").insert(row).select("id").single();
if (error) {
  console.error("Insert failed:", error.message, error.code, error.details ?? "");
  process.exit(1);
}

console.log("Inserted test parcel slot:", data.id);
