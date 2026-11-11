'use client';

import React, { useEffect, useState } from 'react';
import { LayerGroup, LayersControl, MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { getSupabaseClient } from '@/lib/supabase';

export type ReliefSite = {
  id: string;
  name: string;
  district: string;
  locality: string;
  latitude: number;
  longitude: number;
  public_kitchen: boolean;
  clean_water_liters: number;
  food_portions: number;
  medicine_kits: number;
};

// Konfigurasi ikon kustom agar marker tidak error di Next.js
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const reliefSiteIcon = L.divIcon({
  className: 'relief-site-marker',
  html: '<span aria-hidden="true">+</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -13],
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

function MapViewportSync({ location }: { location?: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (location) map.setView(location, 13, { animate: true });
  }, [location, map]);

  return null;
}

export default function IncidentMap({ reports, selectedLocation, onSelect, canPick }: IncidentMapProps) {
  // Titik tengah default Provinsi Aceh (Banda Aceh / Koordinat tengah wilayah Aceh)
  const defaultCenter: [number, number] = [4.6951, 96.7494];
  const supabase = getSupabaseClient();
  const [reliefSites, setReliefSites] = useState<ReliefSite[]>([]);
  const [reliefSiteError, setReliefSiteError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const loadReliefSites = async () => {
      const { data, error } = await supabase
        .from('relief_sites')
        .select('id, name, district, locality, latitude, longitude, public_kitchen, clean_water_liters, food_portions, medicine_kits')
        .eq('is_open', true);
      if (!active) return;
      if (error) {
        setReliefSiteError(`Data posko/logistik gagal dimuat: ${error.message}`);
        return;
      }
      setReliefSites((data ?? []) as ReliefSite[]);
      setReliefSiteError('');
    };
    void loadReliefSites();
    const channel = supabase
      .channel(`relief-sites-map-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'relief_sites' }, () => {
        void loadReliefSites();
      })
      .subscribe((status, error) => {
        if (!active) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setReliefSiteError(`Pembaruan posko realtime bermasalah${error ? `: ${error.message}` : '.'}`);
        }
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={8}
      scrollWheelZoom={false}
      className={`live-map ${canPick ? 'live-map-pickable' : ''}`}
    >
      <MapSizeFixer />
      <MapViewportSync location={selectedLocation} />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Peta dasar">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.Overlay checked name={`Posko & logistik (${reliefSites.length})`}>
          <LayerGroup>
            {reliefSites.map((site) => (
              <Marker key={site.id} position={[site.latitude, site.longitude]} icon={reliefSiteIcon}>
                <Popup>
                  <div className="relief-site-popup">
                    <strong>{site.name}</strong>
                    <span>{site.locality}, {site.district}</span>
                    <span>Dapur umum: {site.public_kitchen ? 'Tersedia' : 'Tidak tersedia'}</span>
                    <span>Air bersih: {site.clean_water_liters.toLocaleString('id-ID')} liter</span>
                    <span>Makanan: {site.food_portions.toLocaleString('id-ID')} porsi</span>
                    <span>Paket obat: {site.medicine_kits.toLocaleString('id-ID')}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>

      {reliefSiteError && (
        <div className="relief-site-map-error" role="alert">{reliefSiteError}</div>
      )}

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