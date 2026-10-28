'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  MapPin, 
  AlertTriangle, 
  BookOpen, 
  User, 
  LogOut, 
  LogIn, 
  ShieldAlert, 
  Menu, 
  X
} from 'lucide-react';

interface NavbarProps {
  userRole?: 'guest' | 'citizen' | 'volunteer' | 'officer' | 'admin';
  userEmail?: string | null;
  onLogout?: () => void;
}

export default function Navbar({ userRole = 'guest', userEmail, onLogout }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Helper badge peran pengguna
  const getRoleBadge = () => {
    switch (userRole) {
      case 'officer':
        return <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-rose-300">Petugas / Officer</span>;
      case 'volunteer':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-300">Relawan</span>;
      case 'citizen':
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-300">Warga Terverifikasi</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-0.5 rounded-full border border-slate-300">Pengunjung</span>;
    }
  };

  return (
    <>
      {/* 1. TOP NAVBAR (DESKTOP & TABLET) */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Identitas Brand */}
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-2 group">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl shadow-md group-hover:scale-105 transition-transform duration-200">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                    SiagaKita <span className="text-emerald-400 font-black">ACEH</span>
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium leading-none hidden sm:block">
                    Sistem Koordinasi & Tanggap Bencana
                  </p>
                </div>
              </Link>
            </div>

            {/* Menu Navigasi Desktop */}
            <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
              <Link href="/" className="px-3 py-2 rounded-lg text-slate-200 hover:text-white hover:bg-slate-800 transition flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Peta Kebencanaan</span>
              </Link>
              <Link href="#panduan" className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-teal-400" />
                <span>Panduan Evakuasi</span>
              </Link>
            </nav>

            {/* Profil & Aksi Autentikasi (Desktop) */}
            <div className="hidden md:flex items-center space-x-4">
              {getRoleBadge()}

              {userRole !== 'guest' ? (
                <div className="flex items-center space-x-3 border-l border-slate-700 pl-4">
                  <span className="text-xs text-slate-300 max-w-[120px] truncate" title={userEmail || ''}>
                    {userEmail}
                  </span>
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                    title="Keluar / Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 border-l border-slate-700 pl-4">
                  <Link
                    href="#akun"
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition flex items-center space-x-1"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Masuk / Daftar</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Tombol Hamburger Menu Mobile */}
            <div className="flex md:hidden items-center space-x-2">
              {getRoleBadge()}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-slate-300 hover:bg-slate-800 rounded-lg"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>

        {/* Menu Tautan Dropdown (Mobile Toggle) */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-2">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 text-sm font-medium"
            >
              🗺️ Peta Kebencanaan
            </Link>
            <Link
              href="#panduan"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-800 text-sm font-medium"
            >
              📘 Panduan Evakuasi & Edukasi
            </Link>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              {userRole !== 'guest' ? (
                <>
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{userEmail}</span>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onLogout?.();
                    }}
                    className="text-xs text-rose-400 font-semibold flex items-center space-x-1 bg-rose-950/50 px-3 py-1.5 rounded-lg border border-rose-900"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar</span>
                  </button>
                </>
              ) : (
                <Link
                  href="#akun"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full text-center py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg"
                >
                  Masuk Akun / Daftar
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. BANNER INFORMATIF UNTUK PENGUNJUNG (GUEST BANNER) */}
      {userRole === 'guest' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>
                Anda dalam mode <strong>Pengunjung Umum</strong>. Anda dapat memantau peta kebencanaan publik secara langsung.
              </span>
            </div>
            <Link 
              href="#akun" 
              className="hidden sm:inline-flex items-center font-bold text-amber-300 hover:text-amber-100 underline ml-2 whitespace-nowrap"
            >
              Masuk untuk membuat laporan &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* 3. BOTTOM NAVIGATION BAR (MOBILE ONLY) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-6 py-2 shadow-2xl">
        <div className="flex justify-around items-center">
          <Link href="/" className="flex flex-col items-center text-emerald-400">
            <MapPin className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Peta</span>
          </Link>

          <Link href="#peta-publik" className="flex flex-col items-center text-slate-400 hover:text-emerald-400">
            <div className="p-2 bg-emerald-600 text-white rounded-full -mt-5 shadow-lg border-2 border-slate-900">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 font-medium text-emerald-400">Aksi</span>
          </Link>

          <Link href="#panduan" className="flex flex-col items-center text-slate-400 hover:text-emerald-400">
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Panduan</span>
          </Link>

          {userRole !== 'guest' ? (
            <button onClick={onLogout} className="flex flex-col items-center text-slate-400 hover:text-rose-400">
              <User className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">Profil</span>
            </button>
          ) : (
            <Link href="#akun" className="flex flex-col items-center text-slate-400 hover:text-emerald-400">
              <LogIn className="w-5 h-5" />
              <span className="text-[10px] mt-0.5 font-medium">Masuk</span>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}