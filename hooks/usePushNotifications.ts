"use client";

import { getOrCreateCustomerToken } from "@/lib/customer-token";
import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushHookState = "unsupported" | "idle" | "prompt" | "subscribed" | "denied" | "error";

export function usePushNotifications() {
  const [state, setState] = useState<PushHookState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
    }
  }, []);

  const subscribe = useCallback(async () => {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      setState("unsupported");
      return;
    }
    const token = getOrCreateCustomerToken();
    if (!token) {
      setError("No customer session");
      setState("error");
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-customer-token": token,
        },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!res.ok) {
        setError("Could not save subscription");
        setState("error");
        return;
      }

      setState("subscribed");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Push failed");
      setState("error");
    }
  }, []);

  return { state, error, subscribe };
}
