"use client";

import { MapPin, Package } from "lucide-react";
import { useEffect, useState } from "react";

type PickupRow = {
  id: string;
  name: string;
  admin_message: string | null;
  google_maps_url: string | null;
  apple_maps_url: string | null;
};

export function FulfillmentLocationsInfo() {
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pkRes = await fetch("/api/shop-locations/pickup-points");
        const pk = await pkRes.json().catch(() => ({}));
        if (cancelled) return;
        setPickups(Array.isArray(pk.locations) ? pk.locations : []);
      } catch {
        if (!cancelled) {
          setPickups([]);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="rounded-2xl border border-honey-border bg-surface/80 px-4 py-3 text-sm text-honey-muted dark:bg-surface-dark/80">
        Loading pickup options…
      </div>
    );
  }

  const hasPickups = pickups.length > 0;
  if (!hasPickups) {
    return (
      <p className="rounded-2xl border border-dashed border-honey-border bg-surface/50 px-4 py-3 text-sm text-honey-muted dark:bg-surface-dark/50">
        Pickup points will appear here when your team configures them in admin.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-honey-border bg-surface px-5 py-4 dark:bg-surface-dark">
        <div className="flex items-start gap-3">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg text-honey-text">Dead drop</h2>
            <p className="mt-1 text-sm text-honey-muted">
              Dead-drop locations are assigned privately per order after checkout.
            </p>
          </div>
        </div>
      </div>

      {hasPickups && (
        <div className="rounded-2xl border border-honey-border bg-surface px-5 py-4 dark:bg-surface-dark">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg text-honey-text">Pickup points</h2>
              <p className="mt-1 text-sm text-honey-muted">
                Team members can choose these at checkout (when available).
              </p>
              <ul className="mt-4 space-y-4">
                {pickups.map((p) => (
                  <li key={p.id} className="border-b border-honey-border/60 pb-4 last:border-0 last:pb-0">
                    <p className="font-medium text-honey-text">{p.name}</p>
                    {p.admin_message && <p className="mt-1 text-sm text-honey-muted">{p.admin_message}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.google_maps_url && (
                        <a
                          href={p.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline"
                        >
                          Google Maps
                        </a>
                      )}
                      {p.apple_maps_url && (
                        <a
                          href={p.apple_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary underline"
                        >
                          Apple Maps
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-honey-muted">
        At checkout you can choose dead drop, pickup, or delivery when your account type allows it.
      </p>
    </div>
  );
}
