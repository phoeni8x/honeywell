import { getDistanceKm } from "@/lib/location";

/** City driving ETA from straight-line distance (30 km/h average). */
export function calculateETA(
  adminLat: number,
  adminLon: number,
  destLat: number,
  destLon: number
): number {
  const distKm = getDistanceKm(adminLat, adminLon, destLat, destLon);
  const avgSpeedKmH = 30;
  const etaMinutes = Math.ceil((distKm / avgSpeedKmH) * 60);
  return Math.max(1, etaMinutes);
}
