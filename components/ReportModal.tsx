'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Siren, 
  MapPin, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Camera
} from 'lucide-react';
import dynamic from 'next/dynamic';
import type { MapReport } from '@/components/IncidentMap';

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
  ssr: false,
  loading: () => <div className="h-48 bg-slate-800 animate-pulse rounded-xl flex items-center justify-center text-xs text-slate-400">Memuat Peta Pilih Lokasi…</div>,
});

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  selectedPoint: [number, number] | null;
  setSelectedPoint: (point: [number, number] | null) => void;
  reportTypes: string[];
  acehDistricts: string[];
  busy: boolean;
}

export default function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  selectedPoint,
  setSelectedPoint,
  reportTypes,
  acehDistricts,
  busy
}: ReportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [locality, setLocality] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) return;

    setStep(1);
    setSelectedType('');
    setDistrict('');
    setLocality('');
    setPreviewImage(null);
    setSelectedPoint(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isOpen, setSelectedPoint]);

  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage);
    };
  }, [previewImage]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewImage) URL.revokeObjectURL(previewImage);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const clearSelectedFile = () => {
    setPreviewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isStep1Valid = selectedType !== '' && district !== '' && locality.trim() !== '';
  const isStep2Valid = selectedPoint !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-white my-auto">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              <Siren className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Buat Laporan Bencana Baru</h2>
              <p className="text-xs text-slate-400">Laporan baru tersimpan privat sebelum diverifikasi petugas</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEPPER INDICATOR */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs font-semibold">
          <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>1</span>
            <span>Jenis & Wilayah</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-800" />
          <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= 2 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>2</span>
            <span>Titik Lokasi</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-800" />
          <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= 3 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>3</span>
            <span>Foto & Detail</span>
          </div>
        </div>

        {/* FORM BODY */}
        <form onSubmit={onSubmit} className="p-6 space-y-5">

          {/* STEP 1: JENIS & WILAYAH */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Pilih Jenis Bencana <span className="text-rose-400">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {reportTypes.map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`p-3 text-left rounded-xl border text-xs font-medium transition flex items-center justify-between ${
                        selectedType === type
                          ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/50'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{type}</span>
                      {selectedType === type && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="incident_type" value={selectedType} required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kabupaten / Kota <span className="text-rose-400">*</span></label>
                  <select 
                    name="district" 
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required 
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="" disabled>Pilih Kabupaten/Kota</option>
                    {acehDistricts.map((d) => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kecamatan / Desa <span className="text-rose-400">*</span></label>
                  <input 
                    name="locality" 
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    required 
                    maxLength={160} 
                    placeholder="Contoh: Kec. Peusangan / Desa Matang" 
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TITIK LOKASI PETA */}
          {step === 2 && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Klik peta untuk menandai lokasi persis bencana:</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${selectedPoint ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                  {selectedPoint ? `${selectedPoint[0].toFixed(4)}, ${selectedPoint[1].toFixed(4)}` : 'Belum dipilih'}
                </span>
              </div>

              <div className="h-60 rounded-xl overflow-hidden border border-slate-800 relative">
                <IncidentMap 
                  reports={[]} 
                  selectedLocation={selectedPoint} 
                  onSelect={(lat, lng) => setSelectedPoint([lat, lng])} 
                  canPick 
                />
              </div>
            </div>
          )}

          {/* STEP 3: KETERANGAN & UNGGAH FOTO */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Keterangan Kejadian <span className="text-slate-500 font-normal">(Opsional)</span>
                </label>
                <textarea 
                  name="description" 
                  rows={3} 
                  maxLength={1000} 
                  placeholder="Jelaskan kondisi saat ini (misal: ketinggian air 1 meter, akses jalan terputus). Hindari menyebutkan data pribadi korban." 
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Bukti Foto Lapangan <span className="text-slate-500 font-normal">(Opsional - JPG/PNG max 5MB)</span>
                </label>
                
                <div className="flex items-center space-x-4">
                  <label className="flex-1 cursor-pointer bg-slate-800/60 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-4 text-center transition group">
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 mx-auto mb-1" />
                    <span className="text-xs text-slate-300 group-hover:text-white font-medium block">Klik untuk memilih foto</span>
                    <input 
                      type="file" 
                      name="evidence" 
                      accept="image/jpeg,image/png,image/webp" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                  </label>

                  {previewImage && (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-emerald-500/50 shadow-md">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewImage} alt="Preview Bukti" className="w-full h-full object-cover" />
                      <button 
                        type="button" 
                        onClick={clearSelectedFile}
                        className="absolute top-1 right-1 bg-slate-900/80 text-rose-400 p-0.5 rounded-full hover:bg-slate-900"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/40 p-3 rounded-xl flex items-start space-x-2.5 text-[11px] text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p>Data lokasi dan foto bersifat privat. Hanya petugas berwenang yang dapat melihat lokasi presisi sebelum dipublikasikan.</p>
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS & NAVIGATION */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                disabled={busy}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition flex items-center space-x-1 font-bold shadow-lg shadow-emerald-500/10"
              >
                <span>Lanjut</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-xl transition flex items-center space-x-2 shadow-lg shadow-emerald-600/20"
              >
                {busy ? <span>Mengirim...</span> : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Kirim Laporan Sekarang</span>
                  </>
                )}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}