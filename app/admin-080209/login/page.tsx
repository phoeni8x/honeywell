"use client";

import { ADMIN_BASE_PATH } from "@/lib/constants";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || ADMIN_BASE_PATH;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Invalid code");
        return;
      }
      router.push(redirect);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <h1 className="font-display text-3xl text-honey-text">Admin sign in</h1>
      <p className="mt-2 text-sm text-honey-muted">Enter your access code.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase text-honey-muted">Access code</label>
          <input
            type="password"
            required
            autoComplete="off"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-honey-border bg-surface px-4 py-3 text-honey-text outline-none ring-primary/20 focus:ring-2 dark:bg-surface-dark"
            placeholder="••••••"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-light disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Link href="/" className="mt-8 text-center text-sm text-primary hover:underline">
        Back to site
      </Link>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-honey-muted">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
