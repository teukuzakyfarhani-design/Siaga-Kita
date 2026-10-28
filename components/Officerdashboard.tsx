'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle, 
  XCircle, 
  Activity, 
  MapPin, 
  Clock, 
  User, 
  FileText, 
  ExternalLink,
  AlertTriangle,
  Check
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { MapReport } from '@/components/IncidentMap';

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
  ssr: false,
  loading: () => <div className="h-full bg-slate-900 flex items-center justify-center text-xs text-slate-400">Memuat Peta Presisi…</div>,
});

type ReportStatus = "pending" | "verified" | "in_progress" | "resolved" | "rejected";

export type OfficerReport = {
  id: string;
  report_code: string;
  reporter_id: string;
  incident_type: string;
  district: string;
  locality: string;
  description: string;
  latitude: number;
  longitude: number;
  evidence_path: string | null;
  status: ReportStatus;
  created_at: string;
  evidence_url?: string;
};

interface OfficerDashboardProps {
  reports: OfficerReport[];
  busyReport: string | null;
  reviewNotes: Record<string, string>;
  setReviewNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onChangeStatus: (report: OfficerReport, nextStatus: ReportStatus) => void;
}

export default function OfficerDashboard({
  reports,
  busyReport,
  reviewNotes,
  setReviewNotes,
  onChangeStatus,
}: OfficerDashboardProps) {
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');

  const selectedReport = reports.find((r) => r.id === selectedReportId) || reports[0];

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" /> Perlu Verifikasi</span>;
      case 'verified':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Terverifikasi</span>;
      case 'in_progress':
        return <span className="bg-teal-500/10 text-teal-400 border border-teal-500/30 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" /> Dalam Penanganan</span>;
      case 'resolved':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Selesai</span>;
      case 'rejected':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 w-fit"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Ditolak</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Dashboard Verifikasi Petugas (Split-Screen)
          </h2>
          <p className="text-xs text-slate-400">Tinjau laporan warga dan perbarui status penanganan secara langsung.</p>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-300 w-fit">
          Total Laporan: {reports.length}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600" />
          <p className="text-sm font-semibold">Tidak ada laporan masuk saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* KOLOM KIRI: DAFTAR ANTREAN LAPORAN (4 Kolom) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[650px]">
            <div className="p-3.5 border-b border-slate-800 bg-slate-900/80 text-xs font-bold text-slate-300">
              Antrean Laporan Masuk
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-800/60">
              {reports.map((r) => {
                const isSelected = r.id === selectedReport?.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReportId(r.id)}
                    className={`w-full text-left p-3.5 transition flex flex-col gap-1.5 relative ${
                      isSelected ? 'bg-emerald-500/10 border-l-4 border-emerald-500' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-slate-200">{r.incident_type}</span>
                      <span className="text-[10px] font-mono text-slate-400">{r.report_code}</span>
                    </div>
                    <div className="flex items-center text-xs text-slate-400 gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="truncate">{r.locality}, {r.district}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">{new Date(r.created_at).toLocaleDateString('id-ID')}</span>
                      {getStatusBadge(r.status)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* KOLOM KANAN: DETAIL & PETA PRESISI (7 Kolom) */}
          {selectedReport && (
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[650px]">
              
              {/* Header Detail */}
              <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100">{selectedReport.incident_type}</h3>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{selectedReport.report_code}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedReport.locality}, {selectedReport.district}</p>
                </div>
                <div>{getStatusBadge(selectedReport.status)}</div>
              </div>

              {/* Konten Scroll Detail */}
              <div className="overflow-y-auto flex-1 p-4 space-y-4">
                
                {/* Deskripsi & Info */}
                <div className="bg-slate-950/50 border border-slate-800/80 p-3.5 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Keterangan Pelapor:</span>
                  <p className="text-xs text-slate-200 leading-relaxed">{selectedReport.description || "Tidak ada keterangan tambahan."}</p>
                </div>

                {/* Peta Presisi Lokasi */}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Titik Koordinat Presisi:</span>
                  <div className="h-48 rounded-xl overflow-hidden border border-slate-800">
                    <IncidentMap reports={[selectedReport as MapReport]} />
                  </div>
                </div>

                {/* Bukti Foto */}
                {selectedReport.evidence_url && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Bukti Foto Lapangan:</span>
                    <a 
                      href={selectedReport.evidence_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl hover:bg-emerald-500/20 transition font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Buka Foto Ukuran Penuh di Tab Baru</span>
                    </a>
                  </div>
                )}

                {/* Panel Kontrol Verifikasi Petugas */}
                {selectedReport.status !== 'resolved' && selectedReport.status !== 'rejected' && (
                  <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-slate-200 block">Aksi Verifikasi & Penanganan:</span>
                    
                    <input 
                      type="text" 
                      value={reviewNotes[selectedReport.id] || ''}
                      onChange={(e) => setReviewNotes(prev => ({ ...prev, [selectedReport.id]: e.target.value }))}
                      placeholder="Catatan verifikasi (opsional, tercatat di riwayat)..."
                      maxLength={500}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />

                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedReport.status === 'pending' && (
                        <>
                          <button
                            disabled={busyReport === selectedReport.id}
                            onClick={() => onChangeStatus(selectedReport, 'verified')}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" /> Verifikasi Laporan
                          </button>
                          <button
                            disabled={busyReport === selectedReport.id}
                            onClick={() => onChangeStatus(selectedReport, 'rejected')}
                            className="px-4 py-2 bg-rose-600/20 border border-rose-600/40 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Tolak
                          </button>
                        </>
                      )}

                      {selectedReport.status === 'verified' && (
                        <>
                          <button
                            disabled={busyReport === selectedReport.id}
                            onClick={() => onChangeStatus(selectedReport, 'in_progress')}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Activity className="w-4 h-4" /> Mulai Penanganan Lapangan
                          </button>
                          <button
                            disabled={busyReport === selectedReport.id}
                            onClick={() => onChangeStatus(selectedReport, 'rejected')}
                            className="px-4 py-2 bg-rose-600/20 border border-rose-600/40 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Tolak
                          </button>
                        </>
                      )}

                      {selectedReport.status === 'in_progress' && (
                        <button
                          disabled={busyReport === selectedReport.id}
                          onClick={() => onChangeStatus(selectedReport, 'resolved')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                        >
                          <Check className="w-4 h-4" /> Tandai Selesai / Ditangani
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}