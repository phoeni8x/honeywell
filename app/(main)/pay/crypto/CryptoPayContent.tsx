"use client";

import { CryptoTicker } from "@/components/CryptoTicker";
import { coinSymbolFromActive } from "@/lib/crypto-coins";
import { getOrCreateCustomerToken, setCustomerToken } from "@/lib/customer-token";
import { syncCustomerTokenFromUrl } from "@/lib/sync-customer-token-from-url";
import { Bitcoin, Check, Copy, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";

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
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const router = useRouter();

  const orderId = searchParams.get("orderId");
  const ctParamRaw = searchParams.get("ct")?.trim() ?? "";
  const queryToken = ctParamRaw.length >= 8 ? ctParamRaw : "";
  const currentToken = useCallback(() => {
    if (orderId) return getOrCreateCustomerToken();
    if (queryToken) return setCustomerToken(queryToken);
    return getOrCreateCustomerToken();
  }, [orderId, queryToken]);

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
    let cancelled = false;
    const end = Date.now() + 30 * 60 * 1000;
    setDeadline(end);
    const tick = setInterval(() => setDeadline((d) => (d && d < Date.now() ? null : d)), 1000);
    void (async () => {
      await syncCustomerTokenFromUrl(orderId, queryToken);
      if (cancelled) return;
      const token = getOrCreateCustomerToken();
      try {
        const ordRes = await fetch(`/api/account/orders/${encodeURIComponent(orderId)}`, {
          headers: { "x-customer-token": token },
        });
        const ordData = (await ordRes.json().catch(() => ({}))) as { order?: { payment_reference_code?: string | null } };
        if (!cancelled && typeof ordData.order?.payment_reference_code === "string") {
          setPaymentRef(ordData.order.payment_reference_code);
        }
        const r = await fetch(`/api/calculate-crypto-amount?orderId=${encodeURIComponent(orderId)}`, {
          headers: { "x-customer-token": token },
        });
        const d = await r.json();
        if (cancelled) return;
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
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [orderId, queryToken]);

  function sent() {
    void (async () => {
      if (orderId) await syncCustomerTokenFromUrl(orderId, queryToken);
      else currentToken();
      fetch("/api/verify-crypto-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      }).finally(() => {
        if (orderId) {
          router.push(`/order-history?orderId=${encodeURIComponent(orderId)}`);
        } else if (queryToken) {
          router.push(`/order-history?ct=${encodeURIComponent(queryToken)}`);
        } else {
          router.push("/order-history");
        }
      });
    })();
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
        <Link href="/home#crypto-guide" className="text-primary underline">
          New to crypto? Read the guide
        </Link>
      </p>
      {orderId && (
        <p className="mt-2 text-xs text-honey-muted">
          Internal order id: <span className="font-mono">{orderId.slice(0, 8)}…</span>
        </p>
      )}
      {paymentRef && (
        <div className="mx-auto mt-4 max-w-md rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-3 text-left">
          <p className="text-xs font-semibold uppercase text-honey-muted">Payment reference (required)</p>
          <p className="mt-1 text-xs text-honey-muted">
            Put this in your wallet&apos;s memo / note field when sending crypto so we can match your payment. Do not reuse a code from an older order.
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-wider text-primary">{paymentRef}</p>
        </div>
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
        <p className="mt-1 inline-flex rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
          Sentz recommended
        </p>
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
        Pay only this coin and network — the shop admin chooses which asset is active. The amount above is what you must
        send for this order.
      </p>

      <button
        type="button"
        data-testid="crypto-ive-sent-payment"
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
