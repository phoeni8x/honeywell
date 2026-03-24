/** CoinGecko `ids` values and admin setting `active_crypto_coin` (stored value). */

export type SupportedCryptoCoinId =
  | "bitcoin"
  | "ethereum"
  | "tether"
  | "litecoin"
  | "solana";

export const CRYPTO_COIN_OPTIONS: ReadonlyArray<{
  id: SupportedCryptoCoinId;
  label: string;
  symbol: string;
  geckoId: string;
}> = [
  { id: "bitcoin", label: "Bitcoin", symbol: "BTC", geckoId: "bitcoin" },
  { id: "ethereum", label: "Ethereum", symbol: "ETH", geckoId: "ethereum" },
  { id: "tether", label: "Tether (USDT)", symbol: "USDT", geckoId: "tether" },
  { id: "litecoin", label: "Litecoin", symbol: "LTC", geckoId: "litecoin" },
  { id: "solana", label: "Solana", symbol: "SOL", geckoId: "solana" },
];

const LEGACY_ALIASES: Record<string, SupportedCryptoCoinId> = {
  "usd-coin": "tether",
  usdc: "tether",
};

/** Comma-separated CoinGecko ids for batch price APIs. */
export const COINGECKO_IDS_ALL = CRYPTO_COIN_OPTIONS.map((c) => c.geckoId).join(",");

export function normalizeActiveCryptoCoin(raw: string | undefined | null): SupportedCryptoCoinId {
  const s = (raw ?? "").trim().toLowerCase();
  if (LEGACY_ALIASES[s]) return LEGACY_ALIASES[s];
  const found = CRYPTO_COIN_OPTIONS.find((c) => c.id === s);
  if (found) return found.id;
  return "ethereum";
}

export function coinGeckoIdFromActive(active: string): string {
  const n = normalizeActiveCryptoCoin(active);
  return CRYPTO_COIN_OPTIONS.find((c) => c.id === n)?.geckoId ?? "ethereum";
}

export function coinSymbolFromActive(active: string): string {
  const n = normalizeActiveCryptoCoin(active);
  return CRYPTO_COIN_OPTIONS.find((c) => c.id === n)?.symbol ?? "ETH";
}

export function coinLabelFromActive(active: string): string {
  const n = normalizeActiveCryptoCoin(active);
  return CRYPTO_COIN_OPTIONS.find((c) => c.id === n)?.label ?? "Ethereum";
}
