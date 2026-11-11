import { NextResponse } from "next/server";

export const revalidate = 180;

type BmkgEarthquake = {
  Tanggal?: string;
  Jam?: string;
  Magnitude?: string;
  Kedalaman?: string;
  Wilayah?: string;
  Potensi?: string;
  Dirasakan?: string;
};

type BmkgResponse = {
  Infogempa?: {
    gempa?: BmkgEarthquake;
  };
};

export async function GET() {
  let response: Response;
  try {
    response = await fetch(
      "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
      { next: { revalidate: 180 } },
    );
  } catch {
    return NextResponse.json(
      { error: "Koneksi ke feed gempa BMKG gagal." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Informasi gempa BMKG sedang tidak dapat diakses." },
      { status: 502 },
    );
  }

  let payload: BmkgResponse;
  try {
    payload = (await response.json()) as BmkgResponse;
  } catch {
    return NextResponse.json(
      { error: "Feed gempa BMKG mengembalikan data yang tidak dapat dibaca." },
      { status: 502 },
    );
  }
  const earthquake = payload.Infogempa?.gempa;
  if (!earthquake?.Tanggal || !earthquake.Wilayah) {
    return NextResponse.json(
      { error: "Format feed gempa BMKG belum dapat dibaca." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    source: "BMKG",
    sourceUrl: "https://www.bmkg.go.id/gempabumi/",
    earthquake: {
      date: earthquake.Tanggal,
      time: earthquake.Jam ?? "",
      magnitude: earthquake.Magnitude ?? "—",
      depth: earthquake.Kedalaman ?? "—",
      area: earthquake.Wilayah,
      potential: earthquake.Potensi ?? "",
      felt: earthquake.Dirasakan ?? "",
    },
  });
}
