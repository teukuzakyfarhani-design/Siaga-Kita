import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SiagaKita Aceh",
    short_name: "SiagaKita",
    description: "Koordinasi dan pelaporan kesiapsiagaan bencana di Aceh.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f5",
    theme_color: "#147b5b",
    lang: "id",
    icons: [
      {
        src: "/siagakita-pwa.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
