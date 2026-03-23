"use client";

import clsx from "clsx";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

const SESSION_KEY = "honeywell_location_dismissed";

export function LocationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      return;
    }
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-honey-text">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        Enable location to find your nearest pickup point.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={clsx(
            "rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white",
            "hover:bg-primary-light"
          )}
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              () => {
                sessionStorage.removeItem(SESSION_KEY);
                setShow(false);
                window.dispatchEvent(new Event("honeywell:location"));
              },
              () => setShow(false),
              { enableHighAccuracy: true, timeout: 10_000 }
            );
          }}
        >
          Enable
        </button>
        <button
          type="button"
          className="rounded-full border border-honey-border px-4 py-2 text-xs font-semibold text-honey-muted hover:bg-honey-border/30"
          onClick={() => {
            try {
              sessionStorage.setItem(SESSION_KEY, "1");
            } catch {
              /* ignore */
            }
            setShow(false);
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
