export interface ShopLocationCoords {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** Haversine distance in km */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestLocation<T extends ShopLocationCoords>(
  userLat: number,
  userLon: number,
  shopLocations: T[]
): (T & { distance: number }) | null {
  if (!shopLocations.length) return null;
  let best: (T & { distance: number }) | null = null;
  for (const loc of shopLocations) {
    const dist = getDistanceKm(userLat, userLon, loc.latitude, loc.longitude);
    if (!best || dist < best.distance) {
      best = { ...loc, distance: dist };
    }
  }
  return best;
}
