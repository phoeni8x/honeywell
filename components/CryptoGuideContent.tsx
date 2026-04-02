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
    crypto_wallet_address: "",
    crypto_network: "",
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
          crypto_wallet_address: d.crypto_wallet_address ?? "",
          crypto_network: d.crypto_network ?? "",
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
        <h3 className="font-display text-2xl text-honey-text">Pay with Sentz</h3>
        <p className="mt-2 text-sm text-honey-muted">
          <a href="https://sentz.com" className="text-primary underline" target="_blank" rel="noreferrer">
            Sentz
          </a>{" "}
          is a payment app for sending stablecoins quickly. Fund with a card, bank, Apple Pay, or Google Pay, then send
          to our address. Always match the <strong className="text-honey-text">exact coin, network, and amount</strong>{" "}
          shown on your Honey Well payment screen.
        </p>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-honey-muted">
          <li>
            Install Sentz — search &quot;Sentz&quot; in the{" "}
            <a
              href="https://apps.apple.com/app/sentz-the-global-payment-app/id1631009610"
              className="text-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              App Store
            </a>{" "}
            or{" "}
            <a
              href="https://play.google.com/store/apps/details?id=com.mobilecoin.moby"
              className="text-primary underline"
              target="_blank"
              rel="noreferrer"
            >
              Google Play
            </a>
            , or open{" "}
            <a href="https://sentz.com" className="text-primary underline" target="_blank" rel="noreferrer">
              sentz.com
            </a>
            .
          </li>
          <li>Create your wallet in the app and complete any sign-up or verification steps Sentz asks for.</li>
          <li>Add funds inside Sentz (for example debit card, bank transfer, Apple Pay, or Google Pay — options vary by region).</li>
          <li>
            On Honey Well, open checkout and choose crypto payment. Note the{" "}
            <strong className="text-honey-text">exact amount</strong>,{" "}
            <strong className="text-honey-text">asset</strong>
            {settings.crypto_network ? (
              <>
                , and <strong className="text-honey-text">network</strong> ({settings.crypto_network})
              </>
            ) : (
              <> and network</>
            )}
            .
          </li>
          <li>
            In Sentz, start a send / transfer to an external wallet address. Choose the same asset (and network, if the app
            asks) as on your Honey Well payment page.
          </li>
          <li>
            Paste our receiving address exactly — same string as on the payment page
            {settings.crypto_wallet_address ? (
              <>
                :
                <br />
                <code className="mt-1 inline-block max-w-full break-all rounded bg-honey-border/40 px-2 py-1 font-mono text-xs text-honey-text sm:text-sm">
                  {settings.crypto_wallet_address}
                </code>
              </>
            ) : (
              <> (shown on the payment page after you place an order).</>
            )}
          </li>
          <li>
            Enter the <strong className="text-honey-text">exact</strong> crypto amount from checkout — not an approximate
            fiat conversion.
          </li>
          <li>
            If Sentz has a memo, note, or reference field, paste your <strong className="text-honey-text">payment reference</strong>{" "}
            from Honey Well checkout so we can match your transfer. Do not reuse a code from an older order.
          </li>
          <li>Confirm the send in Sentz, then return here and tap &quot;I&apos;ve sent payment&quot;. Confirmation usually takes a few minutes.</li>
        </ol>
        <div className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-950 dark:text-cyan-100">
          If the coin on your order isn&apos;t available in Sentz, use any wallet that supports that asset and network,
          and still send the exact amount and address from your Honey Well payment page.
        </div>
      </section>

      <section>
        <h3 className="font-display text-2xl text-honey-text">Other wallets (optional)</h3>
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-honey-muted">
          <li>
            You can use another self-custody or exchange wallet if you prefer
            {settings.crypto_wallet_app_name && settings.crypto_wallet_app_url && (
              <>
                {" "}
                (admin suggestion:{" "}
                <a
                  href={settings.crypto_wallet_app_url}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {settings.crypto_wallet_app_name}
                </a>
                )
              </>
            )}
            .
          </li>
          <li>
            Acquire the coin elsewhere
            {settings.crypto_exchange_name && settings.crypto_exchange_url && (
              <>
                {" "}
                (e.g.{" "}
                <a href={settings.crypto_exchange_url} className="text-primary underline" target="_blank" rel="noreferrer">
                  {settings.crypto_exchange_name}
                </a>
                )
              </>
            )}{" "}
            if needed, then send the checkout amount to our address on the correct network.
          </li>
          <li>Wrong network or wrong asset can mean lost funds — double-check before you send.</li>
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
