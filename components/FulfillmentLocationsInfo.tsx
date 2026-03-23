"use client";

import { MapPin, Package } from "lucide-react";
import { useEffect, useState } from "react";

type DeadDropRow = {
  id: string;
  name: string;
  instructions: string | null;
  google_maps_url: string | null;
  apple_maps_url: string | null;
};

type PickupRow = {
  id: string;
  name: string;
  admin_message: string | null;
  google_maps_url: string | null;
  apple_maps_url: string | null;
};

export function FulfillmentLocationsInfo() {
  const [deadDrop, setDeadDrop] = useState<DeadDropRow | null>(null);
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ddRes, pkRes] = await Promise.all([
          fetch("/api/dead-drops/active"),
          fetch("/api/shop-locations/pickup-points"),
        ]);
        const dd = await ddRes.json().catch(() => ({}));
        const pk = await pkRes.json().catch(() => ({}));
        if (cancelled) return;
        setDeadDrop(dd.dead_drop ?? null);
        setPickups(Array.isArray(pk.locations) ? pk.locations : []);
      } catch {
        if (!cancelled) {
          setDeadDrop(null);
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

  const hasDeadDrop = Boolean(deadDrop);
  const hasPickups = pickups.length > 0;
  if (!hasDeadDrop && !hasPickups) {
    return (
      <p className="rounded-2xl border border-dashed border-honey-border bg-surface/50 px-4 py-3 text-sm text-honey-muted dark:bg-surface-dark/50">
        Dead drop and pickup points will appear here when your team configures them in admin.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hasDeadDrop && deadDrop && (
        <div className="rounded-2xl border border-honey-border bg-surface px-5 py-4 dark:bg-surface-dark">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg text-honey-text">Today&apos;s dead drop</h2>
              <p className="mt-1 font-medium text-honey-text">{deadDrop.name}</p>
              {deadDrop.instructions && (
                <p className="mt-2 text-sm text-honey-muted whitespace-pre-wrap">{deadDrop.instructions}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {deadDrop.google_maps_url && (
                  <a
                    href={deadDrop.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary underline"
                  >
                    Open in Google Maps
                  </a>
                )}
                {deadDrop.apple_maps_url && (
                  <a
                    href={deadDrop.apple_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary underline"
                  >
                    Open in Apple Maps
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
