"use client";

import { BeeSvg } from "@/components/BeeSvg";
import { HoneycombBg } from "@/components/HoneycombBg";
import { LS_TELEGRAM_USERNAME, LS_USER_TYPE } from "@/lib/constants";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SplashPage() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [botUrl, setBotUrl] = useState<string | null>(null);

  function continueGuest() {
    localStorage.setItem(LS_USER_TYPE, "guest");
    localStorage.removeItem(LS_TELEGRAM_USERNAME);
    router.push("/home");
  }

  async function verifyTeam() {
    setError(null);
    setInfo(null);
    if (!username.trim()) {
      setError("Enter your Telegram username.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/verify-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_username: username }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        message?: string;
        verified?: boolean;
        needsOpenBot?: boolean;
        botUrl?: string;
      } = {};
      if (raw) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
          return;
        }
      }
      // Never display data.error — APIs must not leak internals; keep one public line only.
      if (!res.ok) {
        setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
        return;
      }
      if (data.needsOpenBot && data.botUrl) {
        setBotUrl(data.botUrl);
        setInfo(data.message ?? "Open Telegram, then return here and tap Verify again.");
        return;
      }
      if (data.verified) {
        setBotUrl(null);
        setInfo(null);
        localStorage.setItem(LS_USER_TYPE, "team_member");
        localStorage.setItem(
          LS_TELEGRAM_USERNAME,
          username.trim().replace(/^@/, "").toLowerCase()
        );
        setModalOpen(false);
        router.push("/home");
      } else {
        setBotUrl(null);
        setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      }
    } catch {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-hive-black px-6 py-16">
      <HoneycombBg className="opacity-[0.18]" variant="dark" />
      <div className="pointer-events-none absolute bottom-[12%] left-[8%] md:bottom-[18%]">
        <BeeSvg size={72} />
      </div>
      <div className="pointer-events-none absolute right-[10%] top-[20%]">
        <BeeSvg size={56} />
      </div>

      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        <h1 className="font-display text-5xl font-semibold tracking-tight text-primary md:text-6xl">Honey Well</h1>
        <p className="mt-4 max-w-md text-balance font-body text-lg italic text-white/90">
          Fresh flowers. Pure wellness. Curated with care.
        </p>

        <div className="mt-12 flex w-full max-w-sm flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setModalOpen(true);
              setError(null);
              setInfo(null);
              setBotUrl(null);
            }}
            className="btn-primary w-full"
          >
            I&apos;m a Team Member
          </button>
          <button
            type="button"
            onClick={continueGuest}
            className="btn-secondary w-full border-white text-white shadow-[3px_3px_0_rgba(255,255,255,0.25)] hover:bg-white/10"
          >
            Continue as Guest
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
            aria-label="Close"
          />
          <div className="card-hive relative w-full max-w-md rounded-xl bg-surface p-6 shadow-2xl dark:bg-surface-dark">
            <h2 className="font-display text-2xl text-honey-text">Team verification</h2>
            <p className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-honey-muted">
              Before using the website, open our bot and type or tap{" "}
              <code className="rounded bg-honey-border/50 px-1 font-mono text-honey-text">/start</code> so you&apos;re
              registered in our cloudProtect.
            </p>
            <p className="mt-2 text-sm text-honey-muted">
              Enter your <strong className="font-semibold text-honey-text">public</strong> Telegram username (Settings
              → Username). Tap <strong className="text-honey-text">Verify</strong>: if needed, we&apos;ll give you a
              Telegram link so our bot can link your account in the background — then tap <strong className="text-honey-text">Verify</strong>{" "}
              again to finish. We&apos;ll check if you belong to our beehive zzzzz.
            </p>
            <p className="mt-2 text-xs text-honey-muted">
              Example: if Telegram shows <span className="font-medium text-honey-text">@Glorilla</span>, type{" "}
              <code className="rounded bg-honey-border/50 px-1">Glorilla</code> or{" "}
              <code className="rounded bg-honey-border/50 px-1">@Glorilla</code> — letters only, no spaces.
            </p>
            <input
              type="text"
              placeholder="e.g. Glorilla or @Glorilla"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setBotUrl(null);
                setInfo(null);
              }}
              className="mt-3 w-full rounded border-2 border-honey-border bg-bg px-4 py-3 text-honey-text outline-none ring-primary/20 focus:ring-2"
            />
            {info && (
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{info}</p>
            )}
            {botUrl && (
              <a
                href={botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center rounded-xl border-2 border-primary bg-primary/10 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
              >
                Open Telegram (link your account)
              </a>
            )}
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className={clsx("btn-secondary flex-1 border-honey-border py-3 text-sm text-honey-text")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={verifyTeam}
                disabled={loading}
                className="btn-primary flex-1 py-3 text-sm disabled:opacity-60"
              >
                {loading ? "Checking…" : "Verify"}
              </button>
            </div>
            <p className="mt-4 text-center text-sm text-honey-muted">
              Not verified?{" "}
              <Link href="/not-a-member" className="font-semibold text-primary underline-offset-2 hover:underline">
                Continue as guest
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
