"use client";

import { coinLabelFromActive } from "@/lib/crypto-coins";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CryptoGuidePage() {
  const [settings, setSettings] = useState({
    crypto_tutorial_video_url: "",
    crypto_wallet_app_name: "",
    crypto_wallet_app_url: "",
    crypto_exchange_name: "",
    crypto_exchange_url: "",
    active_crypto_coin: "ethereum",
  });

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) =>
        setSettings((s) => ({
          ...s,
          crypto_tutorial_video_url: d.crypto_tutorial_video_url ?? "",
          crypto_wallet_app_name: d.crypto_wallet_app_name ?? "",
          crypto_wallet_app_url: d.crypto_wallet_app_url ?? "",
          crypto_exchange_name: d.crypto_exchange_name ?? "",
          crypto_exchange_url: d.crypto_exchange_url ?? "",
          active_crypto_coin: d.active_crypto_coin ?? "ethereum",
        }))
      )
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-12 pb-16">
      <div>
        <h1 className="font-display text-4xl text-honey-text">How to pay with crypto</h1>
        <p className="mt-2 text-honey-muted">Short guide for guests and team members paying with cryptocurrency.</p>
      </div>

      <section>
        <h2 className="font-display text-2xl text-honey-text">Video tutorial</h2>
        {settings.crypto_tutorial_video_url ? (
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-honey-border bg-black/80">
            <iframe
              title="Crypto tutorial"
              src={settings.crypto_tutorial_video_url}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-honey-border px-6 py-12 text-center text-honey-muted">
            Video not configured yet — ask admin to add a URL in Settings.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-honey-text">Step by step</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-honey-muted">
          <li>
            Download a crypto wallet
            {settings.crypto_wallet_app_name && settings.crypto_wallet_app_url && (
              <>
                :{" "}
                <a href={settings.crypto_wallet_app_url} className="text-primary underline" target="_blank" rel="noreferrer">
                  {settings.crypto_wallet_app_name}
                </a>
              </>
            )}
          </li>
          <li>
            Buy crypto
            {settings.crypto_exchange_name && settings.crypto_exchange_url && (
              <>
                {" "}
                via{" "}
                <a href={settings.crypto_exchange_url} className="text-primary underline" target="_blank" rel="noreferrer">
                  {settings.crypto_exchange_name}
                </a>
              </>
            )}
          </li>
          <li>Send the exact amount shown at checkout to our wallet address.</li>
          <li>Wait for confirmation (usually 1–5 minutes).</li>
          <li>Your order will be confirmed automatically after verification.</li>
        </ol>
      </section>

      <section>
        <h2 className="font-display text-2xl text-honey-text">FAQ</h2>
        <div className="mt-4 space-y-4">
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">Which coins do you accept?</summary>
            <p className="mt-2 text-sm text-honey-muted">
              Currently:{" "}
              <span className="text-honey-text">{coinLabelFromActive(settings.active_crypto_coin)}</span> (set by admin).
              Rates page lists BTC, ETH, USDT, LTC, and SOL — only the active coin applies at checkout.
            </p>
          </details>
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">Why is there a 1,000 HUF fee?</summary>
            <p className="mt-2 text-sm text-honey-muted">This covers network transaction fees.</p>
          </details>
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">What if I send the wrong amount?</summary>
            <p className="mt-2 text-sm text-honey-muted">
              Open a support ticket immediately with your transaction hash — Support → New ticket.
            </p>
          </details>
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">How long does it take?</summary>
            <p className="mt-2 text-sm text-honey-muted">Usually 1–10 minutes depending on network congestion.</p>
          </details>
        </div>
      </section>

      <Link
        href="/support/new?subject=Crypto%20Payment%20Help"
        className="inline-flex rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white"
      >
        Contact support
      </Link>
    </div>
  );
}
