"use client";

import { CryptoTicker } from "@/components/CryptoTicker";
import { coinSymbolFromActive } from "@/lib/crypto-coins";
import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { Bitcoin, Check, Copy, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

export function CryptoPayContent() {
  const searchParams = useSearchParams();
  const [wallet, setWallet] = useState("");
  const [calc, setCalc] = useState<{
    expected_crypto: number;
    total_huf: number;
    conversion_fee_huf: number;
    coin: string;
    coin_symbol: string;
    crypto_network: string;
  } | null>(null);
  const [cryptoNetworkHint, setCryptoNetworkHint] = useState("");
  const [copied, setCopied] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const router = useRouter();

  const orderId = searchParams.get("orderId");

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d.crypto_wallet_address) setWallet(d.crypto_wallet_address);
        if (typeof d.crypto_network === "string") setCryptoNetworkHint(d.crypto_network);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const token = getOrCreateCustomerToken();
    fetch(`/api/calculate-crypto-amount?orderId=${encodeURIComponent(orderId)}`, {
      headers: { "x-customer-token": token },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.expected_crypto) {
          setCalc({
            expected_crypto: d.expected_crypto,
            total_huf: d.total_huf,
            conversion_fee_huf: d.conversion_fee_huf,
            coin: d.coin,
            coin_symbol:
              typeof d.coin_symbol === "string" ? d.coin_symbol : coinSymbolFromActive(String(d.coin ?? "ethereum")),
            crypto_network: typeof d.crypto_network === "string" ? d.crypto_network : "",
          });
        }
      })
      .catch(() => {});
    const end = Date.now() + 30 * 60 * 1000;
    setDeadline(end);
    const t = setInterval(() => setDeadline((d) => (d && d < Date.now() ? null : d)), 1000);
    return () => clearInterval(t);
  }, [orderId]);

  function sent() {
    getOrCreateCustomerToken();
    fetch("/api/verify-crypto-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    }).finally(() => {
      router.push("/order-history");
    });
  }

  const remaining =
    deadline && deadline > Date.now() ? Math.max(0, Math.floor((deadline - Date.now()) / 1000)) : null;

  const networkLabel = (calc?.crypto_network ?? cryptoNetworkHint).trim();

  async function copyWallet() {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <CryptoTicker embedded />
      <div className="mb-6 mt-6 flex justify-center gap-4 text-honey-muted">
        <Bitcoin className="h-10 w-10" />
        <Wallet className="h-10 w-10" />
      </div>
      <h1 className="font-display text-3xl text-honey-text">Complete your payment</h1>
      <p className="mt-4 text-pretty text-honey-muted">
        Send the exact crypto amount below (includes a 1,000 HUF conversion buffer). Your order reference is tied to
        this browser.{" "}
        <Link href="/crypto-guide" className="text-primary underline">
          New to crypto? Read the guide
        </Link>
      </p>
      {orderId && (
        <p className="mt-2 text-xs text-honey-muted">
          Order reference: <span className="font-mono">{orderId}</span>
        </p>
      )}

      {calc && (
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left">
          <p className="text-xs font-semibold uppercase text-honey-muted">Send exactly</p>
          <p className="mt-1 font-mono text-lg text-honey-text">
            {calc.expected_crypto.toFixed(8)} {calc.coin_symbol}
          </p>
          <p className="mt-2 text-xs text-honey-muted">
            Total ≈ {Math.round(calc.total_huf)} HUF (incl. {calc.conversion_fee_huf} HUF fee)
          </p>
        </div>
      )}

      {networkLabel ? (
        <div className="mt-6 rounded-2xl border border-honey-border bg-surface px-4 py-3 text-left dark:bg-surface-dark">
          <p className="text-xs font-semibold uppercase tracking-wide text-honey-muted">Network</p>
          <p className="mt-1 text-sm font-medium text-honey-text">{networkLabel}</p>
          <p className="mt-1 text-xs text-honey-muted">Use this network in your wallet — wrong network can mean lost funds.</p>
        </div>
      ) : null}

      <div className="mt-10 rounded-2xl border border-honey-border bg-surface p-6 text-left dark:bg-surface-dark">
        <p className="text-xs font-semibold uppercase tracking-wide text-honey-muted">Receiving wallet address</p>
        <p className="mt-2 break-all font-mono text-sm text-honey-text">
          {wallet || "Configure address in admin settings"}
        </p>
        {wallet && (
          <>
            <button
              type="button"
              onClick={copyWallet}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-honey-border bg-bg py-2.5 text-sm font-semibold text-honey-text transition hover:bg-honey-border/30"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy address"}
            </button>
            <div className="mt-4 flex justify-center">
              <QRCodeSVG value={wallet} size={160} includeMargin />
            </div>
          </>
        )}
      </div>

      {remaining !== null && (
        <p className="mt-4 text-sm text-honey-muted">
          Please send within{" "}
          <span className="font-semibold text-honey-text">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          </span>
        </p>
      )}

      <p className="mt-6 text-sm text-honey-muted">
        Pay only this coin and network — the shop admin chooses which asset is active. Live rates on this page include
        BTC, ETH, USDT, LTC, and SOL for reference.
      </p>

      <button
        type="button"
        onClick={sent}
        className="mt-10 w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white transition hover:bg-primary-light"
      >
        I&apos;ve sent payment
      </button>

      <Link href="/order-history" className="mt-6 inline-block text-sm text-primary underline-offset-2 hover:underline">
        View my orders
      </Link>
    </div>
  );
}
