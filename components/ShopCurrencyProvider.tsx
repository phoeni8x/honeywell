"use client";

import { formatPriceAmount, parseShopCurrency, type ShopCurrency } from "@/lib/currency";
import { parseFulfillmentOptionEnabled } from "@/lib/fulfillment-settings";
import { parseShopOpen } from "@/lib/shop-open";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type FulfillmentOptions = {
  /** True when parcel locker checkout is enabled (`fulfillment_dead_drop_enabled` in settings). */
  parcelLockerCheckout: boolean;
  pickup: boolean;
  delivery: boolean;
};

type ShopCurrencyContextValue = {
  currency: ShopCurrency;
  shopOpen: boolean;
  fulfillmentOptions: FulfillmentOptions;
  formatPrice: (n: number) => string;
  refresh: () => void;
};

const ShopCurrencyContext = createContext<ShopCurrencyContextValue | null>(null);

export function ShopCurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<ShopCurrency>("HUF");
  const [shopOpen, setShopOpen] = useState(true);
  const [fulfillmentOptions, setFulfillmentOptions] = useState<FulfillmentOptions>({
    parcelLockerCheckout: true,
    pickup: false,
    delivery: false,
  });

  const load = useCallback(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.shop_currency === "string") {
          setCurrency(parseShopCurrency(data.shop_currency));
        }
        if (data && typeof data.shop_open === "string") {
          setShopOpen(parseShopOpen(data.shop_open));
        } else {
          setShopOpen(true);
        }
        if (data && typeof data === "object") {
          setFulfillmentOptions({
            parcelLockerCheckout: parseFulfillmentOptionEnabled(data.fulfillment_dead_drop_enabled),
            pickup: parseFulfillmentOptionEnabled(data.fulfillment_pickup_enabled),
            delivery: parseFulfillmentOptionEnabled(data.fulfillment_delivery_enabled),
          });
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
    () => ({ currency, shopOpen, fulfillmentOptions, formatPrice, refresh: load }),
    [currency, shopOpen, fulfillmentOptions, formatPrice, load]
  );

  return <ShopCurrencyContext.Provider value={value}>{children}</ShopCurrencyContext.Provider>;
}

export function useShopCurrency(): ShopCurrencyContextValue {
  const ctx = useContext(ShopCurrencyContext);
  if (!ctx) {
    return {
      currency: "HUF",
      shopOpen: true,
      fulfillmentOptions: { parcelLockerCheckout: true, pickup: false, delivery: false },
      formatPrice: (n: number) => formatPriceAmount(n, "HUF"),
      refresh: () => {},
    };
  }
  return ctx;
}
