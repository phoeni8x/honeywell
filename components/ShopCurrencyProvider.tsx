"use client";

import { formatPriceAmount, parseShopCurrency, type ShopCurrency } from "@/lib/currency";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ShopCurrencyContextValue = {
  currency: ShopCurrency;
  formatPrice: (n: number) => string;
  refresh: () => void;
};

const ShopCurrencyContext = createContext<ShopCurrencyContextValue | null>(null);

export function ShopCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<ShopCurrency>("HUF");

  const load = useCallback(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.shop_currency === "string") {
          setCurrency(parseShopCurrency(data.shop_currency));
        }
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatPrice = useCallback((n: number) => formatPriceAmount(n, currency), [currency]);

  const value = useMemo(
    () => ({ currency, formatPrice, refresh: load }),
    [currency, formatPrice, load]
  );

  return <ShopCurrencyContext.Provider value={value}>{children}</ShopCurrencyContext.Provider>;
}

export function useShopCurrency(): ShopCurrencyContextValue {
  const ctx = useContext(ShopCurrencyContext);
  if (!ctx) {
    return {
      currency: "HUF",
      formatPrice: (n: number) => formatPriceAmount(n, "HUF"),
      refresh: () => {},
    };
  }
  return ctx;
}
