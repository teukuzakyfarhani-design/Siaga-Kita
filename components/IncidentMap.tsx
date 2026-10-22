"use client";

import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

export type MapReport = {
  id: string;
  report_code: string;
  incident_type: string;
  district: string;
  latitude: number;
  longitude: number;
  status: string;
};

const acehCenter: LatLngExpression = [4.65, 96.75];
const reportIcon = L.divIcon({
  className: "incident-marker",
  html: '<span class="incident-marker-dot"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function PickLocation({
  onSelect,
}: {
  onSelect?: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onSelect?.(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function IncidentMap({
  reports,
  selectedLocation,
  onSelect,
  canPick = false,
}: {
  reports: MapReport[];
  selectedLocation?: [number, number] | null;
  onSelect?: (latitude: number, longitude: number) => void;
  canPick?: boolean;
}) {
  return (
    <MapContainer
      center={acehCenter}
      zoom={6}
      minZoom={5}
      maxZoom={17}
      maxBounds={[[1, 93], [7, 100]]}
      maxBoundsViscosity={0.7}
      scrollWheelZoom
      className={`live-map ${canPick ? "live-map-pickable" : ""}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PickLocation onSelect={onSelect} />
      {reports.map((report) => {
        const lat = report.latitude;
        const lng = report.longitude;
        return (
          <Marker key={report.id} position={[lat, lng]} icon={reportIcon}>
            <Tooltip>
              <strong>{report.incident_type}</strong>
              <br />
              {report.district}
              <br />
              {report.report_code} · {report.status}
            </Tooltip>
          </Marker>
        );
      })}
      {selectedLocation && (
        <Marker position={selectedLocation} icon={reportIcon}>
          <Tooltip>Pilih lokasi kejadian ini</Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
