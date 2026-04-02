"use client";

import { coinLabelFromActive } from "@/lib/crypto-coins";
import { getTelegramStartUrl } from "@/lib/support-telegram";
import { useEffect, useState } from "react";

export function CryptoGuideContent() {
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
    <div className="mx-auto max-w-3xl space-y-12 pb-4">
      <div>
        <h2 className="font-display text-3xl text-honey-text">How to pay with crypto</h2>
        <p className="mt-2 text-honey-muted">Short guide for guests and VIPs paying with cryptocurrency.</p>
      </div>

      <section>
        <h3 className="font-display text-2xl text-honey-text">Video tutorial</h3>
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
        <h3 className="font-display text-2xl text-honey-text">How to buy and send Litecoin using SimpleSwap</h3>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-honey-muted">
          <li>
            Download the SimpleSwap app — search &quot;SimpleSwap&quot; in the App Store or Play Store, or visit
            simpleswap.io
          </li>
          <li>Open the Buy/Sell tab at the bottom of the app</li>
          <li>
            Set &quot;You send&quot; to EUR and &quot;You receive&quot; to LTC (Litecoin)
            <br />
            ⚠️ Important: HUF is not supported in SimpleSwap — use EUR only
          </li>
          <li>Enter the EUR amount that matches your order total shown at checkout</li>
          <li>
            When asked for a receiving address, paste exactly:
            <br />
            <code className="mt-1 inline-block rounded bg-honey-border/40 px-1 py-0.5 font-mono text-honey-text">
              ltc1qwaqh7mzcv2t9ema2nldy789zw2vf88ke09gt6e
            </code>
          </li>
          <li>Tap Börse / Exchange to complete. SimpleSwap converts your EUR to LTC and sends it automatically</li>
          <li>
            Come back to Honey Well and tap &quot;I&apos;ve sent payment&quot; to confirm your order. Confirmation
            usually takes 5–15 minutes
          </li>
        </ol>
        <div className="mt-4 rounded-xl border border-amber-400/60 bg-amber-100/40 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          ⚠️ Common mistake: Do NOT select LTC → HUF as the pair — this is not supported and will show an error. Always
          use EUR → LTC.
        </div>
      </section>

      <section>
        <h3 className="font-display text-2xl text-honey-text">Step by step</h3>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-honey-muted">
          <li>
            Download a crypto wallet
            {settings.crypto_wallet_app_name && settings.crypto_wallet_app_url && (
              <>
                :{" "}
                <a
                  href={settings.crypto_wallet_app_url}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
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
        <h3 className="font-display text-2xl text-honey-text">FAQ</h3>
        <div className="mt-4 space-y-4">
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">Which coins do you accept?</summary>
            <p className="mt-2 text-sm text-honey-muted">
              Currently:{" "}
              <span className="text-honey-text">{coinLabelFromActive(settings.active_crypto_coin)}</span> (set by
              admin). Only the active coin applies at checkout.
            </p>
          </details>
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">Why is there a 1,000 HUF fee?</summary>
            <p className="mt-2 text-sm text-honey-muted">This covers network transaction fees.</p>
          </details>
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">What if I send the wrong amount?</summary>
            <p className="mt-2 text-sm text-honey-muted">
              Message us on Telegram immediately with your transaction hash (use the floating support button).
            </p>
          </details>
          <details className="rounded-xl border border-honey-border bg-surface p-4 dark:bg-surface-dark">
            <summary className="cursor-pointer font-medium text-honey-text">How long does it take?</summary>
            <p className="mt-2 text-sm text-honey-muted">Usually 1–10 minutes depending on network congestion.</p>
          </details>
        </div>
      </section>

      <a
        href={getTelegramStartUrl("crypto_help")}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white"
      >
        Contact support on Telegram
      </a>
    </div>
  );
}
