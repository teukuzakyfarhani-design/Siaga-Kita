import { NextRequest, NextResponse } from "next/server";
import {
  bmkgWeatherLocations,
  type BmkgWeatherPoint,
} from "@/lib/bmkgWeather";

export const revalidate = 1800;

type BmkgForecast = {
  local_datetime?: string;
  t?: number;
  hu?: number;
  tp?: number;
  weather_desc?: string;
  ws?: number;
};

type BmkgLocation = {
  adm4?: string;
  desa?: string;
  kecamatan?: string;
  kotkab?: string;
  provinsi?: string;
  timezone?: string;
};

type BmkgResponse = {
  data?: Array<{
    lokasi?: BmkgLocation;
    cuaca?: BmkgForecast[][];
  }>;
};

export async function GET(request: NextRequest) {
  const requestedLocation = request.nextUrl.searchParams.get("location");
  const selectedLocation = bmkgWeatherLocations.find(
    (location) => location.id === requestedLocation,
  );

  if (!selectedLocation) {
    return NextResponse.json(
      { error: "Pilih lokasi prakiraan cuaca yang tersedia." },
      { status: 400 },
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${selectedLocation.id}`,
      { next: { revalidate } },
    );
  } catch {
    return NextResponse.json(
      { error: "Koneksi ke layanan prakiraan cuaca BMKG gagal." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Prakiraan cuaca BMKG untuk lokasi ini sedang tidak tersedia." },
      { status: 502 },
    );
  }

  let payload: BmkgResponse;
  try {
    payload = (await response.json()) as BmkgResponse;
  } catch {
    return NextResponse.json(
      { error: "Data prakiraan cuaca BMKG tidak dapat dibaca." },
      { status: 502 },
    );
  }

  const entry = payload.data?.find(
    (item) => item.lokasi?.adm4 === selectedLocation.id,
  );
  const location = entry?.lokasi;
  const forecast = entry?.cuaca
    ?.flat()
    .filter(
      (point): point is BmkgForecast & { local_datetime: string } =>
        Boolean(point.local_datetime),
    );

  if (!location || !forecast?.length) {
    return NextResponse.json(
      { error: "Format prakiraan cuaca BMKG belum dapat dibaca." },
      { status: 502 },
    );
  }

  const timeline: BmkgWeatherPoint[] = forecast.map((point) => ({
    localDateTime: point.local_datetime,
    temperature: Number(point.t ?? 0),
    humidity: Number(point.hu ?? 0),
    rainfall: Number(point.tp ?? 0),
    weather: point.weather_desc ?? "Informasi cuaca tidak tersedia",
    windSpeed: Number(point.ws ?? 0),
  }));

  return NextResponse.json({
    source: "BMKG",
    sourceUrl: "https://www.bmkg.go.id/cuaca/prakiraan-cuaca/",
    location: {
      name: location.kotkab ?? selectedLocation.label,
      district: location.kecamatan ?? "",
      village: location.desa ?? "",
      province: location.provinsi ?? "Aceh",
      timezone: location.timezone ?? "+0700",
    },
    timeline,
    updatedAt: new Date().toISOString(),
  });
}
