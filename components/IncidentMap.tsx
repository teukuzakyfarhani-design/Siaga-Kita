'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Konfigurasi ikon kustom agar marker tidak error di Next.js
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export type MapReport = {
  id: string;
  report_code?: string;
  incident_type: string;
  district: string;
  locality?: string;
  latitude: number;
  longitude: number;
  status?: string;
};

interface IncidentMapProps {
  reports: MapReport[];
  selectedLocation?: [number, number] | null;
  onSelect?: (lat: number, lng: number) => void;
  canPick?: boolean;
}

function LocationPicker({ onSelect, canPick }: { onSelect?: (lat: number, lng: number) => void; canPick?: boolean }) {
  useMapEvents({
    click(e) {
      if (canPick && onSelect) {
        onSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapSizeFixer() {
  const map = useMap();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(frame);
  }, [map]);

  return null;
}

export default function IncidentMap({ reports, selectedLocation, onSelect, canPick }: IncidentMapProps) {
  // Titik tengah default Provinsi Aceh (Banda Aceh / Koordinat tengah wilayah Aceh)
  const defaultCenter: [number, number] = [4.6951, 96.7494];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={8}
      scrollWheelZoom={false}
      className={`live-map ${canPick ? 'live-map-pickable' : ''}`}
    >
      <MapSizeFixer />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <LocationPicker onSelect={onSelect} canPick={canPick} />

      {/* Render Marker Laporan yang Sudah Masuk */}
      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.latitude, report.longitude]}
          icon={defaultIcon}
        >
          <Popup>
            <div className="p-1">
              <strong className="text-emerald-700 block text-xs font-bold">{report.incident_type}</strong>
              <span className="text-slate-600 text-[11px] block">{report.locality}, {report.district}</span>
              {report.status && (
                <span className="mt-1 inline-block px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[9px] font-semibold uppercase">
                  Status: {report.status}
                </span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Render Marker Pilihan Saat Warga Ingin Melapor */}
      {selectedLocation && (
        <Marker position={selectedLocation} icon={defaultIcon} />
      )}
    </MapContainer>
  );
}