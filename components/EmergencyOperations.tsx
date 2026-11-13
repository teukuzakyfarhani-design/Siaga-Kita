"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Check,
  Clock3,
  ExternalLink,
  HeartPulse,
  MapPin,
  Radio,
  ShieldAlert,
  Siren,
  Waves,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type UserRole = "admin" | "officer" | "citizen" | "volunteer" | "guest";
type EarthquakeWarning = {
  date: string;
  time: string;
  magnitude: string;
  depth: string;
  area: string;
  potential: string;
  felt: string;
};
type EmergencySignal = {
  id: string;
  latitude: number;
  longitude: number;
  status: "pending" | "acknowledged" | "resolved";
  created_at: string;
};
type VolunteerNotification = {
  id: string;
  report_id: string;
  report_code: string;
  incident_type: string;
  district: string;
  locality: string;
  latitude: number;
  longitude: number;
  created_at: string;
  read_at: string | null;
};

const warningRefreshInterval = 3 * 60 * 1000;

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function playAlarm(context: AudioContext) {
  const now = context.currentTime;
  [0, 0.24, 0.48].forEach((offset) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.14, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.18);
  });
}

export default function EmergencyOperations({
  role,
  userId,
}: {
  role: UserRole;
  userId?: string;
}) {
  const supabase = getSupabaseClient();
  const [earthquake, setEarthquake] = useState<EarthquakeWarning | null>(null);
  const [warningError, setWarningError] = useState("");
  const [signalError, setSignalError] = useState("");
  const [signalNotice, setSignalNotice] = useState("");
  const [submittingSignal, setSubmittingSignal] = useState(false);
  const [signals, setSignals] = useState<EmergencySignal[]>([]);
  const [volunteerNotifications, setVolunteerNotifications] = useState<VolunteerNotification[]>([]);
  const [locationShared, setLocationShared] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [realtimeError, setRealtimeError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const isStaff = role === "admin" || role === "officer";

  const loadWarnings = useCallback(async () => {
    try {
      const response = await fetch("/api/warnings", { cache: "no-store" });
      const result = (await response.json()) as {
        earthquake?: EarthquakeWarning;
        error?: string;
      };
      if (!response.ok || !result.earthquake) {
        throw new Error(result.error ?? "Feed BMKG belum dapat dimuat.");
      }
      setEarthquake(result.earthquake);
      setWarningError("");
    } catch (error) {
      setWarningError(error instanceof Error ? error.message : "Feed BMKG gagal dimuat.");
    }
  }, []);

  useEffect(() => {
    void loadWarnings();
    const timer = window.setInterval(() => void loadWarnings(), warningRefreshInterval);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Service worker SiagaKita gagal didaftarkan.", error);
      });
    }
    return () => window.clearInterval(timer);
  }, [loadWarnings]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;

    const loadRoleData = async () => {
      if (isStaff) {
        const result = await supabase
          .from("emergency_signals")
          .select("id, latitude, longitude, status, created_at")
          .in("status", ["pending", "acknowledged"])
          .order("created_at", { ascending: false });
        if (!active) return;
        if (result.error) {
          setRealtimeError(`Sinyal SOS gagal dimuat: ${result.error.message}`);
        } else {
          setSignals((result.data ?? []) as EmergencySignal[]);
          setRealtimeError("");
        }
      }

      if (role === "volunteer") {
        const [locationResult, notificationsResult] = await Promise.all([
          supabase
            .from("volunteer_locations")
            .select("volunteer_id")
            .eq("volunteer_id", userId)
            .maybeSingle(),
          supabase
            .from("volunteer_notifications")
            .select("id, report_id, report_code, incident_type, district, locality, latitude, longitude, created_at, read_at")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);
        if (!active) return;
        if (locationResult.error) {
          setRealtimeError(`Status lokasi relawan gagal dimuat: ${locationResult.error.message}`);
        } else {
          setLocationShared(Boolean(locationResult.data));
        }
        if (notificationsResult.error) {
          setRealtimeError(`Notifikasi relawan gagal dimuat: ${notificationsResult.error.message}`);
        } else {
          setVolunteerNotifications((notificationsResult.data ?? []) as VolunteerNotification[]);
        }
      }
    };

    void loadRoleData();
    const channel = supabase
      .channel(`emergency-operations-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_signals" },
        (payload) => {
          if (!active || !isStaff) return;
          if (payload.eventType === "INSERT") {
            const signal = payload.new as EmergencySignal;
            if (signal.status === "pending") {
              setSignals((current) => [signal, ...current.filter((item) => item.id !== signal.id)]);
              if (audioContext.current && soundEnabled) playAlarm(audioContext.current);
              if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 500]);
            }
          } else if (payload.eventType === "UPDATE") {
            const signal = payload.new as EmergencySignal;
            setSignals((current) =>
              signal.status === "resolved"
                ? current.filter((item) => item.id !== signal.id)
                : current.map((item) => item.id === signal.id ? signal : item),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "volunteer_notifications",
          filter: `volunteer_id=eq.${userId}`,
        },
        (payload) => {
          if (!active || role !== "volunteer") return;
          if (payload.eventType === "INSERT") {
            const notification = payload.new as VolunteerNotification;
            setVolunteerNotifications((current) => [
              notification,
              ...current.filter((item) => item.id !== notification.id),
            ].slice(0, 10));
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`Laporan baru dekat Anda: ${notification.incident_type}`, {
                body: `${notification.locality}, ${notification.district} · ${notification.report_code}`,
                tag: notification.id,
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const notification = payload.new as VolunteerNotification;
            setVolunteerNotifications((current) =>
              current.map((item) => item.id === notification.id ? notification : item),
            );
          }
        },
      )
      .subscribe((status, error) => {
        if (!active) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeError(`Koneksi notifikasi realtime bermasalah${error ? `: ${error.message}` : "."}`);
        } else if (status === "SUBSCRIBED") {
          setRealtimeError("");
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [isStaff, role, soundEnabled, supabase, userId]);

  async function sendEmergencySignal() {
    if (!supabase || !userId) {
      setSignalError("Masuk ke akun terlebih dahulu untuk mengirim sinyal SOS.");
      return;
    }
    if (!navigator.onLine) {
      setSignalError("Tidak ada koneksi. Sinyal SOS belum terkirim; hubungi layanan darurat setempat jika memungkinkan.");
      return;
    }
    if (!navigator.geolocation) {
      setSignalError("Perangkat ini tidak menyediakan GPS. Sinyal SOS belum terkirim.");
      return;
    }

    setSubmittingSignal(true);
    setSignalError("");
    setSignalNotice("");
    try {
      const position = await getCurrentPosition();
      const existingSignal = await supabase
        .from("emergency_signals")
        .select("id")
        .eq("reporter_id", userId)
        .in("status", ["pending", "acknowledged"])
        .maybeSingle();
      if (existingSignal.error) throw new Error(existingSignal.error.message);
      if (existingSignal.data) {
        setSignalNotice("Sinyal SOS Anda masih aktif. Petugas telah menerima sinyal tersebut.");
        return;
      }
      const result = await supabase.from("emergency_signals").insert({
        reporter_id: userId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }).select("id").single();
      if (result.error) throw new Error(result.error.message);
      setSignalNotice("Sinyal SOS dan koordinat GPS terkirim ke dashboard petugas.");
    } catch (error) {
      setSignalError(
        error instanceof Error
          ? `Sinyal SOS belum terkirim: ${error.message}`
          : "Sinyal SOS gagal dikirim. Coba lagi atau hubungi layanan darurat setempat.",
      );
    } finally {
      setSubmittingSignal(false);
    }
  }

  async function updateSignal(signal: EmergencySignal, status: "acknowledged" | "resolved") {
    if (!supabase) return;
    const result = await supabase
      .from("emergency_signals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", signal.id)
      .select("id")
      .maybeSingle();
    if (result.error) setSignalError(`Status SOS gagal diperbarui: ${result.error.message}`);
    else if (!result.data) setSignalError("Status SOS tidak berubah. Periksa hak akses petugas.");
  }

  async function shareVolunteerLocation() {
    if (!supabase || !userId) return;
    setSharingLocation(true);
    setRealtimeError("");
    try {
      const position = await getCurrentPosition();
      const result = await supabase.from("volunteer_locations").upsert({
        volunteer_id: userId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        updated_at: new Date().toISOString(),
      });
      if (result.error) throw new Error(result.error.message);
      setLocationShared(true);
    } catch (error) {
      setRealtimeError(error instanceof Error ? `Lokasi relawan gagal dibagikan: ${error.message}` : "Lokasi relawan gagal dibagikan.");
    } finally {
      setSharingLocation(false);
    }
  }

  async function stopSharingLocation() {
    if (!supabase || !userId) return;
    const result = await supabase.from("volunteer_locations").delete().eq("volunteer_id", userId);
    if (result.error) {
      setRealtimeError(`Berbagi lokasi gagal dihentikan: ${result.error.message}`);
      return;
    }
    setLocationShared(false);
  }

  async function markNotificationRead(notification: VolunteerNotification) {
    if (!supabase) return;
    const result = await supabase
      .from("volunteer_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notification.id)
      .select("id")
      .maybeSingle();
    if (result.error) {
      setRealtimeError(`Notifikasi gagal diperbarui: ${result.error.message}`);
      return;
    }
    if (!result.data) {
      setRealtimeError("Status notifikasi tidak berubah. Muat ulang daftar dan coba lagi.");
      return;
    }
    setVolunteerNotifications((current) =>
      current.map((item) => item.id === notification.id
        ? { ...item, read_at: new Date().toISOString() }
        : item),
    );
  }

  async function enableSound() {
    if (!("AudioContext" in window)) {
      setRealtimeError("Browser ini tidak mendukung alarm suara.");
      return;
    }
    try {
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      await context.resume();
      setSoundEnabled(true);
      setRealtimeError("");
    } catch (error) {
      setRealtimeError(error instanceof Error ? `Alarm suara gagal diaktifkan: ${error.message}` : "Alarm suara gagal diaktifkan.");
    }
  }

  if (role === "guest") {
    return <EarlyWarningPanel earthquake={earthquake} error={warningError} onRefresh={loadWarnings} />;
  }

  return (
    <section className="emergency-operations" aria-label="Informasi dan tindakan darurat">
      <EarlyWarningPanel earthquake={earthquake} error={warningError} onRefresh={loadWarnings} />

      {role === "citizen" && (
        <div className="sos-panel">
          <div className="sos-copy">
            <span className="sos-icon"><Siren size={20} /></span>
            <div>
              <strong>Butuh pertolongan segera?</strong>
              <p>Tekan sekali untuk mengirim sinyal dan lokasi GPS ke dashboard petugas. Izinkan akses lokasi saat diminta.</p>
            </div>
          </div>
          <button className="sos-button" onClick={sendEmergencySignal} disabled={submittingSignal}>
            <ShieldAlert size={18} />
            {submittingSignal ? "Mengirim sinyal…" : "KIRIM SOS"}
          </button>
          {signalError && <p className="operations-error" role="alert">{signalError}</p>}
          {signalNotice && <p className="operations-success" role="status"><Check size={15} />{signalNotice}</p>}
          <small>SOS SiagaKita adalah kanal pilot dan tidak menggantikan layanan darurat resmi. Jika memungkinkan, hubungi petugas setempat.</small>
        </div>
      )}

      {isStaff && (
        <div className="sos-inbox">
          <div className="operations-heading">
            <div><h2><BellRing size={17} /> Sinyal SOS warga</h2><p>Masuk realtime dengan koordinat GPS privat.</p></div>
            <button className="operations-secondary" onClick={enableSound}>
              <Radio size={15} />{soundEnabled ? "Alarm aktif" : "Aktifkan alarm"}
            </button>
          </div>
          {realtimeError && <p className="operations-error" role="alert">{realtimeError}</p>}
          {signalError && <p className="operations-error" role="alert">{signalError}</p>}
          {signals.length === 0 ? (
            <p className="operations-empty">Belum ada sinyal SOS aktif.</p>
          ) : (
            <div className="sos-list">
              {signals.map((signal) => (
                <article key={signal.id} className="sos-list-item">
                  <span className="sos-list-icon"><HeartPulse size={17} /></span>
                  <div className="sos-list-details">
                    <strong>{signal.status === "pending" ? "SOS baru" : "Sedang ditindaklanjuti"}</strong>
                    <span><MapPin size={13} />{signal.latitude.toFixed(5)}, {signal.longitude.toFixed(5)}</span>
                    <small><Clock3 size={12} />{new Date(signal.created_at).toLocaleString("id-ID")}</small>
                    <a href={`https://www.openstreetmap.org/?mlat=${signal.latitude}&mlon=${signal.longitude}#map=16/${signal.latitude}/${signal.longitude}`} target="_blank" rel="noreferrer">Buka koordinat peta</a>
                  </div>
                  <div className="sos-list-actions">
                    {signal.status === "pending" && <button onClick={() => void updateSignal(signal, "acknowledged")}>Tindak lanjuti</button>}
                    <button className="resolve" onClick={() => void updateSignal(signal, "resolved")}>Selesai</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {role === "volunteer" && (
        <div className="volunteer-alerts">
          <div className="operations-heading">
            <div><h2><Radio size={17} /> Peringatan relawan terdekat</h2><p>Broadcast laporan terverifikasi dalam radius 5 km dari lokasi Anda.</p></div>
            <button className="operations-secondary" onClick={locationShared ? stopSharingLocation : shareVolunteerLocation} disabled={sharingLocation}>
              <MapPin size={15} />
              {sharingLocation ? "Mengambil GPS…" : locationShared ? "Hentikan berbagi lokasi" : "Aktifkan lokasi"}
            </button>
          </div>
          <p className="location-privacy-note">
            {locationShared
              ? "Lokasi terakhir dibagikan secara privat kepada sistem; relawan lain tidak dapat melihatnya. Lokasi berlaku untuk broadcast selama 2 jam."
              : "Lokasi hanya digunakan secara privat untuk mencocokkan broadcast. GPS tidak dibagikan ke peta publik."}
          </p>
          {realtimeError && <p className="operations-error" role="alert">{realtimeError}</p>}
          {volunteerNotifications.length === 0 ? (
            <p className="operations-empty">Belum ada broadcast laporan di sekitar Anda.</p>
          ) : (
            <div className="volunteer-notification-list">
              {volunteerNotifications.map((notification) => (
                <article key={notification.id} className={`volunteer-notification ${notification.read_at ? "" : "unread"}`}>
                  <div><strong>{notification.incident_type} · {notification.report_code}</strong><span>{notification.locality}, {notification.district}</span><small>{new Date(notification.created_at).toLocaleString("id-ID")}</small></div>
                  <a href={`https://www.openstreetmap.org/?mlat=${notification.latitude}&mlon=${notification.longitude}#map=15/${notification.latitude}/${notification.longitude}`} target="_blank" rel="noreferrer">Peta</a>
                  {!notification.read_at && <button onClick={() => void markNotificationRead(notification)} aria-label="Tandai sudah dibaca"><Check size={15} /></button>}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EarlyWarningPanel({
  earthquake,
  error,
  onRefresh,
}: {
  earthquake: EarthquakeWarning | null;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <section className="early-warning-panel" aria-label="Informasi gempa terbaru dari BMKG" aria-live="polite">
      <span className="early-warning-icon"><Waves size={19} /></span>
      <div className="early-warning-content">
        <div className="early-warning-heading">
          <strong>Info gempa terakhir BMKG</strong>
          <span className="early-warning-feed-status"><i /> Diperbarui otomatis tiap 3 menit</span>
        </div>
        {error ? (
          <p className="early-warning-error"><AlertTriangle size={14} />{error}<button onClick={onRefresh}>Coba lagi</button></p>
        ) : earthquake ? (
          <div className="early-warning-detail">
            <strong className="early-warning-magnitude">M {earthquake.magnitude}</strong>
            <span className="early-warning-area"><MapPin size={13} />{earthquake.area}</span>
            <span className="early-warning-meta"><Clock3 size={13} />{earthquake.date} · {earthquake.time}</span>
            <span className="early-warning-meta"><Waves size={13} />Kedalaman {earthquake.depth}</span>
            {earthquake.potential && <p className="early-warning-context">{earthquake.potential}</p>}
            {earthquake.felt && <p className="early-warning-context">Dirasakan: {earthquake.felt}</p>}
          </div>
        ) : (
          <p className="early-warning-loading"><Clock3 size={14} />Memuat data BMKG…</p>
        )}
      </div>
      <a href="https://www.bmkg.go.id/gempabumi/" target="_blank" rel="noreferrer">Sumber BMKG <ExternalLink size={13} /></a>
      <small><AlertTriangle size={13} />Info gempa terakhir, bukan jaminan status peringatan aktif. Ikuti kanal resmi BMKG/BPBA.</small>
    </section>
  );
}
