"use client";

import styles from "./WeatherMonitoring.module.css";
import {
  AlertTriangle,
  Cloud,
  CloudDrizzle,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  MapPin,
  RefreshCw,
  Thermometer,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bmkgWeatherLocations,
  type BmkgWeatherLocationId,
  type BmkgWeatherPoint,
} from "@/lib/bmkgWeather";

type WeatherResponse = {
  source: string;
  sourceUrl: string;
  location: {
    name: string;
    district: string;
    village: string;
    province: string;
    timezone: string;
  };
  timeline: BmkgWeatherPoint[];
  updatedAt: string;
};

type ForecastDay = {
  date: string;
  points: BmkgWeatherPoint[];
};

function weatherIcon(description: string, size = 22) {
  const condition = description.toLowerCase();
  if (condition.includes("hujan") && condition.includes("petir")) {
    return <CloudRain size={size} />;
  }
  if (condition.includes("hujan") || condition.includes("gerimis")) {
    return <CloudDrizzle size={size} />;
  }
  if (condition.includes("cerah") && !condition.includes("berawan")) {
    return <CloudSun size={size} />;
  }
  if (condition.includes("berawan")) {
    return <CloudSun size={size} />;
  }
  return <Cloud size={size} />;
}

function formatDay(date: string, index: number) {
  if (index === 0) return "Hari ini";
  if (index === 1) return "Besok";
  return new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(
    new Date(`${date}T12:00:00`),
  );
}

function formatHour(dateTime: string) {
  const time = dateTime.split(" ")[1] ?? "";
  return time.slice(0, 5);
}

function WeatherTrend({ points }: { points: BmkgWeatherPoint[] }) {
  const temperatures = points.map((point) => point.temperature);
  const lowest = Math.min(...temperatures);
  const highest = Math.max(...temperatures);
  const spread = Math.max(highest - lowest, 1);
  const chartPoints = points.map((point, index) => ({
    x: points.length === 1 ? 180 : 16 + (index * 328) / (points.length - 1),
    y: 58 - ((point.temperature - lowest) / spread) * 34,
    point,
  }));
  const line = chartPoints
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");

  return (
    <div className="weather-trend">
      <div className="weather-trend-legend">
        <span><i /> Suhu</span>
        <span><i /> Curah hujan</span>
      </div>
      <svg
        className="weather-trend-chart"
        viewBox="0 0 360 112"
        role="img"
        aria-label={`Grafik suhu dan curah hujan untuk ${points.length} waktu prakiraan`}
      >
        {[25, 50, 75].map((y) => (
          <line key={y} x1="12" x2="348" y1={y} y2={y} />
        ))}
        {chartPoints.map(({ x, point }) => {
          const barHeight = Math.min(point.rainfall * 5, 28);
          return (
            <rect
              key={`rain-${point.localDateTime}`}
              className="weather-trend-rain"
              x={x - 3}
              y={94 - barHeight}
              width="6"
              height={barHeight}
              rx="3"
            >
              <title>{`${formatHour(point.localDateTime)}: ${point.rainfall} mm`}</title>
            </rect>
          );
        })}
        <path className="weather-trend-line" d={line} />
        {chartPoints.map(({ x, y, point }, index) => (
          <circle
            key={`temperature-${point.localDateTime}`}
            className={index === 0 ? "weather-trend-dot weather-trend-dot-active" : "weather-trend-dot"}
            cx={x}
            cy={y}
            r="4"
          >
            <title>{`${formatHour(point.localDateTime)}: ${point.temperature}°C`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export default function WeatherMonitoring() {
  const [locationId, setLocationId] =
    useState<BmkgWeatherLocationId>("11.71.01.2001");
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadWeather = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setWeather(null);
    try {
      const response = await fetch(`/api/weather?location=${locationId}`, {
        cache: "no-store",
        signal,
      });
      const result = (await response.json()) as WeatherResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Prakiraan cuaca gagal dimuat.");
      }
      setWeather(result);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Prakiraan cuaca gagal dimuat.",
      );
      setWeather(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadWeather(controller.signal);
    return () => controller.abort();
  }, [loadWeather]);

  const days = useMemo<ForecastDay[]>(() => {
    const grouped = new Map<string, BmkgWeatherPoint[]>();
    for (const point of weather?.timeline ?? []) {
      const date = point.localDateTime.split(" ")[0];
      if (!date) continue;
      const points = grouped.get(date) ?? [];
      points.push(point);
      grouped.set(date, points);
    }
    return Array.from(grouped, ([date, points]) => ({ date, points })).slice(
      0,
      3,
    );
  }, [weather]);

  const current = days[0]?.points[0];
  const rainyPeriods = days
    .flatMap((day) => day.points)
    .filter((point) => point.rainfall >= 1).length;
  const updatedTime = weather
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(new Date(weather.updatedAt))
    : "";

  return (
    <div className={`weather-page ${styles.weatherPage}`}>
      <header className="weather-heading">
        <div>
          <div className="weather-eyebrow"><span /> INFORMASI RESMI BMKG</div>
          <h1>Pantauan cuaca</h1>
          <p>Prakiraan cuaca untuk membantu Anda bersiap menghadapi kondisi di Aceh.</p>
        </div>
        <div className="weather-controls">
          <label className="weather-location-select">
            <MapPin size={16} aria-hidden="true" />
            <span className="sr-only">Pilih lokasi prakiraan</span>
            <select
              value={locationId}
              onChange={(event) =>
                setLocationId(event.target.value as BmkgWeatherLocationId)
              }
            >
              {bmkgWeatherLocations.map((location) => (
                <option key={location.id} value={location.id}>{location.label}</option>
              ))}
            </select>
          </label>
          <button
            className="weather-refresh-button"
            type="button"
            aria-label="Perbarui prakiraan"
            onClick={() => void loadWeather()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "weather-spin" : ""} />
          </button>
        </div>
      </header>

      {error && (
        <div className="weather-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadWeather()} disabled={loading}>
            Coba lagi
          </button>
        </div>
      )}

      {loading && !weather ? (
        <div className="weather-loading" role="status">
          <RefreshCw size={18} className="weather-spin" />
          Mengambil prakiraan terbaru dari BMKG…
        </div>
      ) : weather && current ? (
        <>
          <section className="weather-overview" aria-label="Prakiraan terdekat">
            <div className="weather-overview-copy">
              <span className="weather-overview-label"><i /> PRAKIRAAN TERDEKAT</span>
              <div className="weather-current">
                <span className="weather-current-icon">{weatherIcon(current.weather, 38)}</span>
                <strong>{current.temperature}<span>°</span></strong>
                <div>
                  <b>{current.weather}</b>
                  <span>{formatHour(current.localDateTime)} WIB · {weather.location.province}</span>
                </div>
              </div>
              <div className="weather-location-caption">
                <MapPin size={14} />
                <span>{weather.location.district}{weather.location.village ? ` · ${weather.location.village}` : ""}</span>
              </div>
            </div>
            <div className="weather-overview-stats">
              <div><Thermometer size={16} /><span>Suhu</span><strong>{current.temperature}°C</strong></div>
              <div><Droplets size={16} /><span>Kelembapan</span><strong>{current.humidity}%</strong></div>
              <div><Wind size={16} /><span>Angin</span><strong>{current.windSpeed} km/jam</strong></div>
            </div>
            <div className="weather-art" aria-hidden="true">
              <div className="weather-art-halo">
                <span className="weather-art-sun" />
                <div className="weather-art-cloud">{weatherIcon(current.weather, 48)}</div>
              </div>
              <div className="weather-art-label">
                <span>CURAH HUJAN</span>
                <strong>{current.rainfall} <small>mm</small></strong>
              </div>
            </div>
          </section>

          <section className="weather-content-grid">
            <div className="weather-card weather-hourly">
              <div className="weather-card-heading">
                <div><span className="weather-section-mark"><CloudSun size={16} /></span><div><h2>Perkembangan hari ini</h2><p>Perkiraan kondisi per waktu</p></div></div>
                <span className="weather-day-label">{formatDay(days[0].date, 0)}</span>
              </div>
              <WeatherTrend points={days[0].points.slice(0, 6)} />
              <div className="weather-hourly-list">
                {days[0].points.slice(0, 6).map((point, index) => (
                  <div className={`weather-hour-item ${index === 0 ? "weather-hour-current" : ""}`} key={point.localDateTime}>
                    <span>{formatHour(point.localDateTime)}</span>
                    <i>{weatherIcon(point.weather, 21)}</i>
                    <strong>{point.temperature}°</strong>
                    <small><Droplets size={12} /> {point.rainfall} mm</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="weather-card weather-outlook">
              <div className="weather-card-heading">
                <div><span className="weather-section-mark weather-section-blue"><Cloud size={16} /></span><div><h2>Prakiraan 3 hari</h2><p>Ringkasan kondisi harian</p></div></div>
              </div>
              <div className="weather-day-list">
                {days.map((day, index) => {
                  const temperatures = day.points.map((point) => point.temperature);
                  const rainTotal = day.points.reduce((sum, point) => sum + point.rainfall, 0);
                  const representative = day.points[Math.floor(day.points.length / 2)] ?? day.points[0];
                  return (
                    <div className="weather-day-row" key={day.date}>
                      <strong>{formatDay(day.date, index)}</strong>
                      <i>{weatherIcon(representative.weather, 21)}</i>
                      <span>{representative.weather}</span>
                      <small>{Math.min(...temperatures)}° / {Math.max(...temperatures)}°</small>
                      <em><Droplets size={12} /> {rainTotal.toFixed(1)} mm</em>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={`weather-advisory ${rainyPeriods > 0 ? "weather-advisory-rain" : ""}`}>
            <span className="weather-advisory-icon">{rainyPeriods > 0 ? <CloudRain size={19} /> : <AlertTriangle size={18} />}</span>
            <div>
              <strong>{rainyPeriods > 0 ? "Siapkan perlindungan saat beraktivitas" : "Tetap pantau perubahan cuaca"}</strong>
              <p>{rainyPeriods > 0
                ? `BMKG memperkirakan curah hujan pada ${rainyPeriods} waktu prakiraan dalam 3 hari ke depan. Waspadai jalan licin dan sesuaikan rencana perjalanan.`
                : "Kondisi dapat berubah. Periksa kembali prakiraan BMKG sebelum melakukan perjalanan."}</p>
            </div>
          </section>

          <footer className="weather-source">
            <span>Data prakiraan bersumber dari BMKG · Diperbarui {updatedTime} WIB</span>
            <a href={weather.sourceUrl} target="_blank" rel="noreferrer">
              Lihat BMKG <ExternalLink size={13} />
            </a>
          </footer>
          <p className="weather-disclaimer">Prakiraan ini merupakan informasi cuaca, bukan peringatan dini cuaca ekstrem. Ikuti kanal resmi BMKG untuk imbauan dan peringatan terbaru.</p>
        </>
      ) : !error ? (
        <div className="weather-empty" role="status">Prakiraan cuaca belum tersedia untuk lokasi ini.</div>
      ) : null}
    </div>
  );
}
