"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
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
      <p className="mt-2 text-sm text-honey-muted">Supabase Auth (email / password).</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase text-honey-muted">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-honey-border bg-surface px-4 py-3 text-honey-text outline-none ring-primary/20 focus:ring-2 dark:bg-surface-dark"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-honey-muted">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-honey-border bg-surface px-4 py-3 text-honey-text outline-none ring-primary/20 focus:ring-2 dark:bg-surface-dark"
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
