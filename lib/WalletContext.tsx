"use client";

import { LevelUpModal } from "@/components/LevelUpModal";
import { LS_MY_REFERRAL_CODE } from "@/lib/constants";
import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { LEVEL_META } from "@/lib/levels";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type WalletState = {
  bees: number;
  points: number;
  level: number;
  levelName: string;
  loading: boolean;
  referralCode: string | null;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [bees, setBees] = useState(0);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);

  const fetchWallet = useCallback(async () => {
    const t = getOrCreateCustomerToken();
    if (!t) {
      setLoading(false);
      return;
    }
    await fetch("/api/customer/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_token: t }),
    }).catch(() => {});

    const r = await fetch("/api/wallet/summary", { headers: { "x-customer-token": t } });
    const d = await r.json().catch(() => ({}));
    const newLevel = typeof d.buyer_level === "number" ? d.buyer_level : 1;

    if (prevLevelRef.current !== null && newLevel > prevLevelRef.current) {
      setLevelUp(newLevel);
    }
    prevLevelRef.current = newLevel;

    setBees(typeof d.bees === "number" ? d.bees : 0);
    setPoints(typeof d.points === "number" ? d.points : 0);
    setLevel(newLevel);
    if (typeof d.referral_code === "string" && d.referral_code) {
      setReferralCode(d.referral_code);
      try {
        localStorage.setItem(LS_MY_REFERRAL_CODE, d.referral_code);
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchWallet();
    }, 30000);
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchWallet();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchWallet]);

  const value = useMemo(
    () => ({
      bees,
      points,
      level,
      levelName: LEVEL_META[level]?.name ?? "Newbie",
      loading,
      referralCode,
      refresh: fetchWallet,
    }),
    [bees, points, level, loading, referralCode, fetchWallet]
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      {levelUp !== null && <LevelUpModal newLevel={levelUp} onClose={() => setLevelUp(null)} />}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
