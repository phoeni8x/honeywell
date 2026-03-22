"use client";

import { calculateETA } from "@/lib/eta";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { useMemo } from "react";

const beeIcon = L.divIcon({
  html: `<div style="font-size:28px;line-height:1">🐝</div>`,
  className: "border-0 bg-transparent",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const pinIcon = L.divIcon({
  html: `<div style="font-size:28px;line-height:1">📍</div>`,
  className: "border-0 bg-transparent",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

type Props = {
  adminLat: number;
  adminLon: number;
  destLat: number;
  destLon: number;
  /** Tailwind classes for the map container height/shape */
  mapClassName?: string;
  showEtaFooter?: boolean;
};

export function DeliveryTrackMap({
  adminLat,
  adminLon,
  destLat,
  destLon,
  mapClassName = "h-[320px] w-full rounded-xl",
  showEtaFooter = true,
}: Props) {
  const center = useMemo(
    () => [(adminLat + destLat) / 2, (adminLon + destLon) / 2] as [number, number],
    [adminLat, adminLon, destLat, destLon]
  );

  const line = useMemo(
    () =>
      [
        [adminLat, adminLon],
        [destLat, destLon],
      ] as [number, number][],
    [adminLat, adminLon, destLat, destLon]
  );

  const eta = calculateETA(adminLat, adminLon, destLat, destLon);

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2">
      <MapContainer center={center} zoom={13} className={mapClassName} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[adminLat, adminLon]} icon={beeIcon}>
          <Popup>Honey Well (en route)</Popup>
        </Marker>
        <Marker position={[destLat, destLon]} icon={pinIcon}>
          <Popup>Your address</Popup>
        </Marker>
        <Polyline positions={line} pathOptions={{ color: "#f5a800", weight: 2, opacity: 0.85 }} />
      </MapContainer>
      {showEtaFooter ? (
        <p className="text-center text-sm text-honey-muted">Approx. {eta} min away (straight-line estimate)</p>
      ) : null}
    </div>
  );
}
