import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiagaKita Aceh — Pilot Koordinasi Bencana",
  description:
    "Pilot terbatas pelaporan, verifikasi, dan pemetaan kejadian di Provinsi Aceh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
