"use client";
import ReportModal from "@/components/ReportModal";
import Navbar from "@/components/Navbar";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowRight,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  CloudSun,
  HeartHandshake,
  Home,
  LogOut,
  Map,
  MapPin,
  Menu,
  Plus,
  Radio,
  ShieldCheck,
  Siren,
  Upload,
  Users,
  Waves,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { MapReport } from "@/components/IncidentMap";
import EmergencyOperations from "@/components/EmergencyOperations";
import ReliefSitesPage from "@/components/ReliefSitesPage";
import WeatherMonitoring from "@/components/WeatherMonitoring";
import {
  getOfflineReports,
  removeOfflineReport,
  saveOfflineReport,
  type OfflineReport,
} from "@/lib/offlineReports";
import SiagaKitaLogo from "@/components/SiagaKitaLogo";
import "./pilot.css";

const IncidentMap = dynamic(() => import("@/components/IncidentMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Memuat peta Aceh…</div>,
});

type Role = "admin" | "officer" | "citizen" | "volunteer";
type ReportStatus = "pending" | "verified" | "in_progress" | "resolved" | "rejected";
type Report = MapReport & {
  reporter_id: string;
  locality: string;
  description: string;
  evidence_path: string | null;
  verified_by: string | null;
  created_at: string;
  updated_at: string;
  evidence_url?: string;
};
type ReportEvent = {
  id: number;
  report_id: string;
  actor_id: string;
  from_status: ReportStatus | null;
  to_status: ReportStatus;
  note: string | null;
  created_at: string;
};
type Profile = { id: string; full_name: string; role: Role };

const reportTypes = [
  "Banjir",
  "Tanah longsor",
  "Gempa bumi",
  "Kebakaran",
  "Angin kencang",
  "Lainnya",
];

const acehDistricts = [
  "Kabupaten Aceh Barat",
  "Kabupaten Aceh Barat Daya",
  "Kabupaten Aceh Besar",
  "Kabupaten Aceh Jaya",
  "Kabupaten Aceh Selatan",
  "Kabupaten Aceh Singkil",
  "Kabupaten Aceh Tamiang",
  "Kabupaten Aceh Tengah",
  "Kabupaten Aceh Tenggara",
  "Kabupaten Aceh Timur",
  "Kabupaten Aceh Utara",
  "Kabupaten Bener Meriah",
  "Kabupaten Bireuen",
  "Kabupaten Gayo Lues",
  "Kabupaten Nagan Raya",
  "Kabupaten Pidie",
  "Kabupaten Pidie Jaya",
  "Kabupaten Simeulue",
  "Kota Banda Aceh",
  "Kota Langsa",
  "Kota Lhokseumawe",
  "Kota Sabang",
  "Kota Subulussalam",
];

const navItems = [
  { title: "Dashboard", icon: Home },
  { title: "Peta kejadian", icon: Map },
  { title: "Posko & logistik", icon: Boxes },
  { title: "Pantauan cuaca", icon: CloudSun },
  { title: "Laporan", icon: ClipboardList },
];

const statusLabels: Record<ReportStatus, string> = {
  pending: "Perlu verifikasi",
  verified: "Terverifikasi",
  in_progress: "Dalam penanganan",
  resolved: "Selesai",
  rejected: "Ditolak",
};

const statusClasses: Record<ReportStatus, string> = {
  pending: "status status-review",
  verified: "status status-verified",
  in_progress: "status status-progress",
  resolved: "status status-verified",
  rejected: "status status-rejected",
};

const roleLabels: Record<Role, string> = {
  admin: "Administrator",
  officer: "Petugas verifikasi",
  citizen: "Masyarakat",
  volunteer: "Relawan",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function PilotPage() {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [mapReports, setMapReports] = useState<MapReport[]>([]);
  const [reportEvents, setReportEvents] = useState<ReportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [showReportForm, setShowReportForm] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [selectedPoint, setSelectedPoint] = useState<[number, number] | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyReport, setBusyReport] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<File | null>(null);
  const [evidencePath, setEvidencePath] = useState<string | null>(null);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const activeUserId = useRef<string | null>(null);
  const reportLoadRequest = useRef(0);
  const reportSubmissionInFlight = useRef(false);
  const evidenceUploadRequest = useRef(0);
  const offlineSyncInFlight = useRef(false);

  const isStaff = profile?.role === "admin" || profile?.role === "officer";
  const loadProfileAndReports = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const requestId = ++reportLoadRequest.current;
      const isCurrentRequest = () =>
        activeUserId.current === userId && reportLoadRequest.current === requestId;
      setLoading(true);
      setError("");
      const profileResult = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .single();
      if (!isCurrentRequest()) return;
      if (profileResult.error) {
        setError(
          `Profil belum dapat dimuat: ${profileResult.error.message}. Pastikan migrasi pilot sudah dijalankan.`,
        );
        setLoading(false);
        return;
      }
      const loadedProfile = profileResult.data as Profile;
      setProfile(loadedProfile);

      const reportsResult = await supabase
        .from("reports")
        .select(
          "id, report_code, reporter_id, incident_type, district, locality, description, latitude, longitude, evidence_path, status, verified_by, created_at, updated_at",
        )
        .order("created_at", { ascending: false });
      if (!isCurrentRequest()) return;
      if (reportsResult.error) {
        setError(`Laporan gagal dimuat: ${reportsResult.error.message}`);
        setLoading(false);
        return;
      }

      const loadedReports = (reportsResult.data ?? []) as Report[];
      const mapResult = await supabase.rpc("published_incident_map");
      if (!isCurrentRequest()) return;
      if (mapResult.error) {
        setError(`Peta laporan terverifikasi gagal dimuat: ${mapResult.error.message}`);
      } else {
        setMapReports((mapResult.data ?? []) as MapReport[]);
      }
      if (loadedReports.length === 0) {
        setReportEvents([]);
      } else {
        const eventResult = await supabase
          .from("report_events")
          .select("id, report_id, actor_id, from_status, to_status, note, created_at")
          .in("report_id", loadedReports.map((report) => report.id))
          .order("created_at", { ascending: true });
        if (!isCurrentRequest()) return;
        if (eventResult.error) {
          setError(`Riwayat status laporan gagal dimuat: ${eventResult.error.message}`);
        } else {
          setReportEvents((eventResult.data ?? []) as ReportEvent[]);
        }
      }
      const withEvidence = await Promise.all(
        loadedReports.map(async (report) => {
          if (!report.evidence_path) return report;
          const canReadEvidence =
            loadedProfile.role === "admin" ||
            loadedProfile.role === "officer" ||
            report.reporter_id === userId;
          if (!canReadEvidence) return report;
          const signed = await supabase.storage
            .from("report-evidence")
            .createSignedUrl(report.evidence_path, 60 * 10);
          if (!isCurrentRequest()) return report;
          if (signed.error) {
            setError(`Bukti ${report.report_code} tidak dapat dibuka: ${signed.error.message}`);
            return report;
          }
          return { ...report, evidence_url: signed.data.signedUrl };
        }),
      );
      if (!isCurrentRequest()) return;
      setReports(withEvidence);
      setLoading(false);
    },
    [supabase],
  );

  const syncOfflineReports = useCallback(async (userId: string) => {
    if (!supabase || !navigator.onLine || offlineSyncInFlight.current) return;
    offlineSyncInFlight.current = true;
    try {
      const queuedReports = await getOfflineReports(userId);
      setOfflineQueueCount(queuedReports.length);
      let syncedCount = 0;
      for (const queued of queuedReports) {
        const result = await supabase.from("reports").insert({
          client_submission_id: queued.id,
          reporter_id: queued.userId,
          incident_type: queued.incidentType,
          district: queued.district,
          locality: queued.locality,
          description: queued.description,
          latitude: queued.latitude,
          longitude: queued.longitude,
          status: "pending",
        });
        if (result.error) {
          if (result.error.code === "23505") {
            const existing = await supabase
              .from("reports")
              .select("id")
              .eq("client_submission_id", queued.id)
              .maybeSingle();
            if (existing.error || !existing.data) {
              setError(`Laporan offline ${queued.id.slice(0, 8)} belum dapat dipastikan tersimpan: ${existing.error?.message ?? result.error.message}`);
              break;
            }
          } else {
            setError(`Laporan offline belum dapat dikirim: ${result.error.message}`);
            break;
          }
        }
        await removeOfflineReport(queued.id);
        syncedCount += 1;
        setOfflineQueueCount(queuedReports.length - syncedCount);
        if (!navigator.onLine) break;
      }
      if (syncedCount > 0) {
        await loadProfileAndReports(userId);
        setNotice(`${syncedCount} laporan offline berhasil dikirim dan menunggu verifikasi petugas.`);
      }
    } catch (error) {
      setError(error instanceof Error ? `Antrean laporan offline gagal diproses: ${error.message}` : "Antrean laporan offline gagal diproses.");
    } finally {
      offlineSyncInFlight.current = false;
    }
  }, [loadProfileAndReports, supabase]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const loadSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError) {
        setError(`Sesi tidak dapat dibaca: ${sessionError.message}`);
        setLoading(false);
        return;
      }
      setSession(data.session);
      activeUserId.current = data.session?.user.id ?? null;
      if (data.session) await loadProfileAndReports(data.session.user.id);
      else setLoading(false);
    };
    void loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user.id ?? null;
      const previousUserId = activeUserId.current;
      activeUserId.current = nextUserId;
      reportLoadRequest.current += 1;
      setSession(nextSession);
      if (previousUserId !== nextUserId) {
        setProfile(null);
        setReports([]);
        setMapReports([]);
        setReportEvents([]);
      }
      if (nextSession) {
        window.setTimeout(() => {
          if (mounted) void loadProfileAndReports(nextSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setReports([]);
        setMapReports([]);
        setReportEvents([]);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
      reportLoadRequest.current += 1;
      data.subscription.unsubscribe();
    };
  }, [supabase, loadProfileAndReports]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setOfflineQueueCount(0);
      return;
    }

    const synchronize = () => void syncOfflineReports(userId);
    void getOfflineReports(userId)
      .then((queuedReports) => setOfflineQueueCount(queuedReports.length))
      .catch((queueError: unknown) => {
        setError(queueError instanceof Error ? `Antrean offline gagal dibaca: ${queueError.message}` : "Antrean offline gagal dibaca.");
      });
    if (navigator.onLine) synchronize();
    window.addEventListener("online", synchronize);
    return () => window.removeEventListener("online", synchronize);
  }, [session?.user.id, syncOfflineReports]);

  async function submitAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    if (!email || !password) {
      setError("Email dan kata sandi wajib diisi.");
      setAuthLoading(false);
      return;
    }
    if (authMode === "signup") {
      const fullName = String(form.get("full_name") || "").trim();
      const requestedRole = String(form.get("requested_role") || "citizen");
      if (fullName.length < 2) {
        setError("Nama lengkap harus berisi minimal 2 karakter.");
        setAuthLoading(false);
        return;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, requested_role: requestedRole } },
      });
      if (signUpError) setError(`Pendaftaran gagal: ${signUpError.message}`);
      else if (!data.session) {
        setNotice("Akun dibuat. Periksa email untuk konfirmasi sebelum masuk.");
        setAuthMode("signin");
      } else {
        setNotice("Akun berhasil dibuat. Peran awal Anda mengikuti pilihan pendaftaran.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const message =
          signInError.message.toLowerCase().includes("email not confirmed")
            ? "Email akun ini belum dikonfirmasi. Periksa inbox email atau konfirmasi akun di Supabase Auth."
            : "Email atau kata sandi salah. Pastikan akun sudah dibuat dan emailnya sudah dikonfirmasi.";
        setError(message);
      }
    }
    setAuthLoading(false);
  }

  async function signOut() {
    if (!supabase) return;
    setLogoutLoading(true);
    const startedAt = Date.now();
    const { error: signOutError } = await supabase.auth.signOut();
    const remaining = Math.max(0, 700 - (Date.now() - startedAt));
    if (remaining) await new Promise((resolve) => window.setTimeout(resolve, remaining));
    if (signOutError) {
      setError(`Gagal keluar: ${signOutError.message}`);
    } else {
      setNotice("Anda telah keluar.");
    }
    setLogoutLoading(false);
  }

  async function handleEvidenceChange(file: File | null) {
    const requestId = ++evidenceUploadRequest.current;
    const previousPath = evidencePath;
    setSelectedEvidence(file);
    setEvidencePath(null);
    if (previousPath && supabase) {
      await supabase.storage.from("report-evidence").remove([previousPath]);
    }
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Bukti harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
      return;
    }
    if (!supabase || !session) return;

    setEvidenceUploading(true);
    setError("");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const nextPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage
      .from("report-evidence")
      .upload(nextPath, file, { contentType: file.type, upsert: false });
    if (requestId !== evidenceUploadRequest.current) {
      await supabase.storage.from("report-evidence").remove([nextPath]);
      return;
    }
    if (upload.error) {
      setError(`Bukti foto gagal diunggah: ${upload.error.message}`);
    } else {
      setEvidencePath(nextPath);
      setNotice("Foto berhasil diunggah. Anda dapat mengirim laporan.");
    }
    setEvidenceUploading(false);
  }

  async function submitReport(draft: {
    incidentType: string;
    district: string;
    locality: string;
    description: string;
  }) {
    if (reportSubmissionInFlight.current) return;
    reportSubmissionInFlight.current = true;

    try {
      if (!supabase || !session || !selectedPoint) {
        setError("Pilih titik lokasi kejadian pada peta sebelum mengirim laporan.");
        return;
      }
      setBusyReport("new");
      setError("");
      setNotice("");
      const type = draft.incidentType;
      const district = draft.district;
      const locality = draft.locality.trim();
      const description = draft.description.trim();
      const evidence = selectedEvidence && selectedEvidence.size > 0 ? selectedEvidence : null;
      if (!type || !district || !locality) {
        setError("Lengkapi jenis kejadian, kabupaten/kota, dan area umum.");
        return;
      }
      if (
        evidence &&
        (!["image/jpeg", "image/png", "image/webp"].includes(evidence.type) ||
          evidence.size > 5 * 1024 * 1024)
      ) {
        setError("Bukti harus berupa JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
        return;
      }

      if (evidenceUploading || (evidence && !evidencePath)) {
        setError("Tunggu sampai upload foto selesai sebelum mengirim laporan.");
        return;
      }
      const clientSubmissionId = crypto.randomUUID();
      const queueOfflineReport = async () => {
        const queued: OfflineReport = {
          id: clientSubmissionId,
          userId: session.user.id,
          incidentType: type,
          district,
          locality,
          description,
          latitude: selectedPoint[0],
          longitude: selectedPoint[1],
          queuedAt: new Date().toISOString(),
        };
        await saveOfflineReport(queued);
        setOfflineQueueCount((count) => count + 1);
        setSelectedEvidence(null);
        setEvidencePath(null);
        setSelectedPoint(null);
        setShowReportForm(false);
        setNotice("Laporan disimpan di perangkat dan akan dikirim otomatis saat koneksi pulih. Foto tidak disertakan.");
        if (navigator.onLine) void syncOfflineReports(session.user.id);
      };

      if (!navigator.onLine) {
        if (evidence) {
          setError("Laporan berfoto tidak dapat disimpan offline. Hapus foto terlebih dahulu atau kirim saat koneksi pulih.");
          return;
        }
        await queueOfflineReport();
        return;
      }
      setNotice("Menyimpan laporan…");

      const insertResult = await supabase
        .from("reports")
        .insert({
          client_submission_id: clientSubmissionId,
          reporter_id: session.user.id,
          incident_type: type,
          district,
          locality,
          description,
          latitude: selectedPoint[0],
          longitude: selectedPoint[1],
          evidence_path: evidencePath,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertResult.error) {
        const networkFailure =
          !navigator.onLine ||
          /network|fetch|timeout|load failed/i.test(insertResult.error.message);
        if (networkFailure && !evidence) {
          await queueOfflineReport();
          return;
        }
        let cleanupMessage = "";
        if (evidencePath) {
          const cleanup = await supabase.storage.from("report-evidence").remove([evidencePath]);
          if (cleanup.error) cleanupMessage = ` Pembersihan file sementara juga gagal: ${cleanup.error.message}`;
        }
        setError(`Laporan gagal disimpan: ${insertResult.error.message}.${cleanupMessage}`);
        return;
      }

      await loadProfileAndReports(session.user.id);
      setSelectedEvidence(null);
      setEvidencePath(null);
      setSelectedPoint(null);
      setShowReportForm(false);
      setActivePage("Laporan");
      setNotice("Laporan tersimpan dan menunggu verifikasi petugas.");
    } catch (submissionError) {
      setError(submissionError instanceof Error
        ? `Laporan gagal disimpan: ${submissionError.message}`
        : "Laporan gagal disimpan. Periksa koneksi dan coba lagi.");
    } finally {
      reportSubmissionInFlight.current = false;
      setBusyReport(null);
    }
  }
  async function changeReportStatus(report: Report, nextStatus: ReportStatus) {
    if (!supabase) return;
    setBusyReport(report.id);
    setError("");
    const { error: reviewError } = await supabase.rpc("review_incident_report", {
      p_report_id: report.id,
      p_next_status: nextStatus,
      p_note: reviewNotes[report.id] || null,
    });
    if (reviewError) {
      setError(`Status laporan gagal diperbarui: ${reviewError.message}`);
    } else {
      setNotice(`${report.report_code} diperbarui menjadi “${statusLabels[nextStatus]}”.`);
      setReviewNotes((previous) => ({ ...previous, [report.id]: "" }));
      await loadProfileAndReports(session!.user.id);
    }
    setBusyReport(null);
  }

  async function deleteReport(report: Report) {
    if (!supabase || !session) return;
    if (!window.confirm(`Hapus laporan ${report.report_code}? Data ini tidak dapat dipulihkan.`)) return;

    setBusyReport(report.id);
    setError("");
    setNotice("");
    const { data: deletedRows, error: deleteError } = await supabase
      .from("reports")
      .delete()
      .eq("id", report.id)
      .select("id");
    if (deleteError) {
      setError(`Laporan gagal dihapus: ${deleteError.message}`);
      setBusyReport(null);
      return;
    }
    if (!deletedRows || deletedRows.length === 0) {
      setError(
        "Laporan tidak terhapus. Hak akses database belum mengizinkan penghapusan laporan ini. Jalankan migrasi penghapusan di Supabase.",
      );
      setBusyReport(null);
      return;
    }

    let cleanupMessage = "";
    if (report.evidence_path) {
      const cleanup = await supabase.storage
        .from("report-evidence")
        .remove([report.evidence_path]);
      if (cleanup.error) {
        cleanupMessage = ` Foto bukti tidak berhasil dibersihkan: ${cleanup.error.message}`;
      }
    }
    setReports((currentReports) =>
      currentReports.filter((currentReport) => currentReport.id !== report.id),
    );
    setReportEvents((currentEvents) =>
      currentEvents.filter((event) => event.report_id !== report.id),
    );
    setMapReports((currentReports) =>
      currentReports.filter((currentReport) => currentReport.id !== report.id),
    );
    await loadProfileAndReports(session.user.id);
    setNotice(`Laporan ${report.report_code} berhasil dihapus.${cleanupMessage}`);
    setBusyReport(null);
  }

  if (!supabase) return <SetupRequired />;
  if (loading && !session) return <BrandSplash message="Menyiapkan SiagaKita…" />;
  if (logoutLoading) return <BrandSplash message="Menutup sesi dengan aman…" />;
  if (!session) {
    return (
      <GuestExperience
        mode={authMode}
        setMode={setAuthMode}
        onSubmit={submitAuthentication}
        busy={authLoading}
        error={error}
        notice={notice}
        onLogout={signOut}
      />
    );
  }

  return (
    <main className="pilot-shell">
      <Navbar
        userRole={profile?.role ?? "citizen"}
        userEmail={session.user.email}
        onLogout={signOut}
      />

      <aside className={`pilot-sidebar ${mobileNavOpen ? "pilot-sidebar-open" : ""}`}>
        <a className="pilot-brand" href="#dashboard" onClick={() => setActivePage("Dashboard")}>
          <span><SiagaKitaLogo size={30} /></span>
          <strong>siaga<span>kita</span></strong>
          <button
            className="pilot-mobile-close"
            aria-label="Tutup navigasi"
            onClick={(event) => {
              event.preventDefault();
              setMobileNavOpen(false);
            }}
          >
            <X size={18} />
          </button>
        </a>
        <div className="pilot-workspace">
          <small>CAKUPAN PILOT</small>
          <strong>Seluruh Provinsi Aceh</strong>
          <span>23 kabupaten/kota</span>
        </div>
        <div className="pilot-nav-label">MENU UTAMA</div>
        <nav className="pilot-nav" aria-label="Navigasi utama">
          {[...navItems, ...(profile?.role === "volunteer" ? [{ title: "Relawan & broadcast", icon: Radio }] : [])].map(({ title, icon: Icon }) => (
            <button
              key={title}
              className={activePage === title ? "active" : ""}
              onClick={() => {
                setActivePage(title);
                setMobileNavOpen(false);
              }}
            >
              <Icon size={18} /> {title}
            </button>
          ))}
        </nav>
        <div className="pilot-side-bottom">
          <div className="pilot-help">
            <CircleHelp size={17} />
            <strong>Pilot terbatas</strong>
            <p>Data laporan hanya ditampilkan sesuai hak akses dan status verifikasi.</p>
          </div>
          <div className="pilot-user">
            <span className="pilot-avatar">{(profile?.full_name || "U").slice(0, 1).toUpperCase()}</span>
            <span><strong>{profile?.full_name ?? session.user.email}</strong><small>{profile ? roleLabels[profile.role] : "Memuat peran…"}</small></span>
            <button aria-label="Keluar" title="Keluar" onClick={signOut}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="pilot-scrim" aria-label="Tutup navigasi" onClick={() => setMobileNavOpen(false)} />}

      <section className="pilot-main">
        <header className="pilot-topbar">
          <div className="pilot-breadcrumb">
            <button className="pilot-menu-button" aria-label="Buka navigasi" onClick={() => setMobileNavOpen(true)}><Menu size={19} /></button>
            <span>SiagaKita Aceh</span><b>/</b><strong>{activePage}</strong>
          </div>
          <div className="pilot-top-actions">
            <span className="pilot-live"><i /> PILOT</span>
            <span className="pilot-role-chip">{profile ? roleLabels[profile.role] : "Pengguna"}</span>
            <button aria-label="Keluar" onClick={signOut}><LogOut size={17} /></button>
          </div>
        </header>
        <div className="pilot-content">
          <div className="pilot-alert"><ShieldCheck size={16} /><span><strong>Lingkungan pilot.</strong> Gunakan untuk uji coba terbatas, bukan layanan darurat resmi. Untuk keadaan darurat, hubungi layanan setempat.</span></div>
          {profile?.role !== "volunteer" && (
            <EmergencyOperations role={profile?.role ?? "citizen"} userId={session.user.id} />
          )}
          {offlineQueueCount > 0 && <div className="offline-sync-status" role="status"><Clock3 size={15} />{offlineQueueCount} laporan tersimpan di perangkat dan menunggu koneksi untuk dikirim.</div>}
          {error && <div className="pilot-error" role="alert">{error}<button aria-label="Tutup pesan" onClick={() => setError("")}><X size={15} /></button></div>}
          {notice && <div className="pilot-success" role="status"><Check size={16} />{notice}<button aria-label="Tutup pesan" onClick={() => setNotice("")}><X size={15} /></button></div>}

          {activePage === "Dashboard" && (
            <Dashboard
              reports={reports}
              mapReports={mapReports}
              profile={profile}
              userId={session.user.id}
              isStaff={Boolean(isStaff)}
              loading={loading}
              onNavigate={setActivePage}
              onCreateReport={() => setShowReportForm(true)}
            />
          )}
          {activePage === "Laporan" && (
            <ReportsPage
              reports={reports}
              reportEvents={reportEvents}
              userId={session.user.id}
              isStaff={Boolean(isStaff)}
              loading={loading}
              busyReport={busyReport}
              reviewNotes={reviewNotes}
              setReviewNotes={setReviewNotes}
              onChangeStatus={changeReportStatus}
              onDeleteReport={deleteReport}
              onCreateReport={() => setShowReportForm(true)}
            />
          )}
          {activePage === "Peta kejadian" && (
            <MapPage reports={mapReports} loading={loading} />
          )}
          {activePage === "Posko & logistik" && (
            <ReliefSitesPage isStaff={Boolean(isStaff)} />
          )}
          {activePage === "Pantauan cuaca" && <WeatherMonitoring />}
          {activePage === "Relawan & broadcast" && profile?.role === "volunteer" && (
            <>
              <section className="pilot-welcome">
                <div>
                  <div className="pilot-kicker"><i /> KOORDINASI RELAWAN TERDEKAT</div>
                  <h1>Relawan & broadcast</h1>
                  <p>Aktifkan lokasi agar menerima laporan bencana terverifikasi dalam radius 5 km.</p>
                </div>
              </section>
              <EmergencyOperations role="volunteer" userId={session.user.id} />
            </>
          )}
          <footer className="pilot-footer">
            <span>SiagaKita Aceh · Pilot terbatas</span>
            <span>Peta © OpenStreetMap contributors · Data laporan milik pengguna</span>
          </footer>
        </div>
      </section>

      <ReportModal
        isOpen={showReportForm}
        onClose={() => setShowReportForm(false)}
        onSubmit={submitReport}
        onEvidenceChange={handleEvidenceChange}
        selectedPoint={selectedPoint}
        setSelectedPoint={setSelectedPoint}
        reportTypes={reportTypes}
        acehDistricts={acehDistricts}
        busy={busyReport === "new" || evidenceUploading}
        evidenceUploading={evidenceUploading}
      />
    </main>
  );
}

function SetupRequired() {
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <span className="setup-icon"><SiagaKitaLogo size={42} /></span>
        <p className="pilot-kicker">SIAGAKITA ACEH · PILOT</p>
        <h1>Hubungkan backend pilot</h1>
        <p>Frontend pilot tidak akan menampilkan data contoh. Tambahkan kredensial publik Supabase agar akun, laporan, foto, dan peta memakai data bersama.</p>
        <ol>
          <li>Buat proyek Supabase khusus pilot.</li>
          <li>Salin <code>.env.example</code> menjadi <code>.env.local</code>.</li>
          <li>Isi URL proyek dan publishable/anon key Supabase.</li>
          <li>Jalankan migrasi yang dijelaskan pada <code>PILOT_SETUP.md</code>.</li>
        </ol>
        <p className="setup-warning">Jangan masukkan service-role key di variabel <code>NEXT_PUBLIC_*</code> atau membagikannya ke tester.</p>
      </section>
    </main>
  );
}

function BrandSplash({ message }: { message: string }) {
  return (
    <main className="brand-splash" role="status" aria-live="polite">
      <div className="brand-splash-orbit brand-splash-orbit-one" />
      <div className="brand-splash-orbit brand-splash-orbit-two" />
      <div className="brand-splash-particles" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </div>
      <div className="brand-splash-content">
        <div className="brand-splash-logo">
          <span className="brand-splash-ring brand-splash-ring-one" />
          <span className="brand-splash-ring brand-splash-ring-two" />
          <span className="brand-splash-scan" />
          <SiagaKitaLogo size={94} animated />
        </div>
        <div className="brand-splash-name">siaga<span>kita</span></div>
        <p className="brand-splash-status"><span className="brand-splash-status-dot" />{message}</p>
        <span className="brand-splash-progress" aria-hidden="true"><i /></span>
        <div className="brand-splash-loading-dots" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </main>
  );
}

function GuestExperience({
  mode,
  setMode,
  onSubmit,
  busy,
  error,
  notice,
  onLogout,
}: {
  mode: "signin" | "signup";
  setMode: (mode: "signin" | "signup") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error: string;
  notice: string;
  onLogout: () => void;
}) {
  const supabase = getSupabaseClient();
  const [reports, setReports] = useState<MapReport[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const loadPublicMap = async () => {
      if (!supabase) {
        setLoadingMap(false);
        setMapError("Peta publik belum dapat dihubungkan ke backend.");
        return;
      }
      setLoadingMap(true);
      setMapError("");
      const result = await supabase.rpc("published_incident_map");
      if (!active) return;
      if (result.error) {
        setMapError(
          `Peta laporan terverifikasi gagal dimuat: ${result.error.message}. Pastikan migrasi pilot terbaru sudah dijalankan.`,
        );
      } else {
        setReports((result.data ?? []) as MapReport[]);
      }
      setLoadingMap(false);
    };
    void loadPublicMap();
    return () => {
      active = false;
    };
  }, [supabase, refreshVersion]);

  return (
    <main className="guest-shell">
      <Navbar
        userRole="guest"
        onLogout={onLogout}
      />

      <div className="guest-warning-wrap">
        <EmergencyOperations role="guest" />
      </div>

      <section className="guest-hero" id="beranda">
        <div>
          <span className="pilot-live"><i /> PILOT TERBATAS · ACEH</span>
          <p className="pilot-kicker"><i /> SELURUH PROVINSI ACEH</p>
          <h1>Informasi bencana, untuk koordinasi bersama.</h1>
          <p className="guest-hero-copy">
            Lihat laporan kejadian yang telah diverifikasi petugas dan panduan
            kesiapsiagaan. SiagaKita masih dalam uji coba terbatas.
          </p>
          <a className="pilot-primary" href="#peta-publik"><MapPin size={16} /> Lihat peta kejadian</a>
          <span className="guest-hero-caveat">Bukan kanal darurat atau sumber peringatan resmi.</span>
        </div>
        <div className="guest-region-card">
          <span><Map size={20} /></span>
          <strong>23</strong>
          <p>kabupaten/kota dalam cakupan pilot</p>
          <small>Data peta hanya menampilkan laporan berstatus terverifikasi, dalam penanganan, atau selesai.</small>
        </div>
      </section>

      <section className="guest-main-grid">
        <div className="guest-public-column">
          <section className="pilot-panel guest-map-panel" id="peta-publik">
            <PanelHeading
              title="Peta kejadian terverifikasi"
              description="Pin lokasi digeneralisasi untuk melindungi privasi pelapor."
            />
            {loadingMap ? (
              <div className="map-loading">Memuat peta dan laporan terverifikasi…</div>
            ) : mapError ? (
              <div className="guest-map-error" role="alert">
                <CircleHelp size={18} />
                <span>{mapError}</span>
                <button onClick={() => setRefreshVersion((version) => version + 1)}>Coba lagi</button>
              </div>
            ) : reports.length === 0 ? (
              <div className="guest-map-empty">
                <IncidentMap reports={[]} />
                <p>Belum ada laporan terverifikasi untuk ditampilkan.</p>
              </div>
            ) : (
              <IncidentMap reports={reports} />
            )}
            <div className="map-privacy-foot"><ShieldCheck size={15} /> Status menunggu verifikasi dan data pribadi tidak ditampilkan.</div>
          </section>
          <section className="guest-guides" id="panduan">
            <div className="guest-section-heading">
              <span><ShieldCheck size={17} /></span>
              <div><h2>Panduan kesiapsiagaan</h2><p>Informasi umum—ikuti arahan petugas dan sumber resmi setempat.</p></div>
            </div>
            <div className="guest-guide-grid">
              <article><span className="guide-number">01</span><h3>Kenali risiko sekitar</h3><p>Ketahui jalur evakuasi, titik kumpul, dan kanal informasi resmi di wilayah Anda.</p></article>
              <article><span className="guide-number">02</span><h3>Siapkan kebutuhan dasar</h3><p>Simpan air minum, obat rutin, lampu, baterai, dokumen penting, dan kontak keluarga.</p></article>
              <article><span className="guide-number">03</span><h3>Utamakan keselamatan</h3><p>Jangan menerobos arus banjir atau memasuki bangunan berisiko. Ikuti arahan petugas.</p></article>
            </div>
            <p className="guest-source-note">Panduan ringkas ini bukan pengganti instruksi BNPB, BPBA/BPBD, BMKG, atau petugas berwenang.</p>
          </section>
        </div>
        <div id="akun">
          <AuthScreen
            mode={mode}
            setMode={setMode}
            onSubmit={onSubmit}
            busy={busy}
            error={error}
            notice={notice}
          />
        </div>
      </section>
      <footer className="guest-footer">
        <span>SiagaKita Aceh · Pilot terbatas</span>
        <span>Peta © OpenStreetMap contributors · Bukan kanal darurat resmi</span>
      </footer>
    </main>
  );
}

function AuthScreen({
  mode,
  setMode,
  onSubmit,
  busy,
  error,
  notice,
}: {
  mode: "signin" | "signup";
  setMode: (mode: "signin" | "signup") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error: string;
  notice: string;
}) {
  const isSignup = mode === "signup";
  return (
    <>
      {busy && <BrandSplash message="Mengamankan akses Anda…" />}
      <section className="auth-card guest-auth-card">
        <div className="auth-brand"><SiagaKitaLogo size={48} showWordmark /></div>
        <span className="pilot-live"><i /> PILOT TERBATAS · ACEH</span>
        <h1>{isSignup ? "Buat akun" : "Selamat datang kembali"}</h1>
        <p>{isSignup ? "Buat akun baru untuk memakai fitur pelaporan SiagaKita." : "Masuk untuk melihat laporan bersama sesuai peran Anda."}</p>
        {error && <div className="auth-message auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-message auth-notice" role="status">{notice}</div>}
        <form onSubmit={onSubmit}>
          {isSignup && <label>Nama lengkap<input name="full_name" required minLength={2} maxLength={120} autoComplete="name" /></label>}
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Kata sandi<input name="password" type="password" required minLength={8} autoComplete={isSignup ? "new-password" : "current-password"} /></label>
          {isSignup && <label>Daftar sebagai<select name="requested_role" defaultValue="citizen"><option value="citizen">Masyarakat</option><option value="volunteer">Relawan</option></select></label>}
          <button className="pilot-primary auth-submit" disabled={busy}>{busy ? "Memproses…" : isSignup ? "Buat akun" : "Masuk"}</button>
        </form>
        <div className="auth-switch">
          {isSignup ? "Sudah punya akun?" : "Belum memiliki akun?"}
          <button onClick={() => setMode(isSignup ? "signin" : "signup")}>{isSignup ? "Kembali ke masuk" : "Buat akun baru"}</button>
        </div>
        <div className="auth-disclaimer"><ShieldCheck size={15} /> Pendaftaran publik hanya memberi peran masyarakat atau relawan. Hak petugas diberikan oleh administrator.</div>
      </section>
    </>
  );
}

function Dashboard({
  reports,
  mapReports,
  profile,
  userId,
  isStaff,
  loading,
  onNavigate,
  onCreateReport,
}: {
  reports: Report[];
  mapReports: MapReport[];
  profile: Profile | null;
  userId: string;
  isStaff: boolean;
  loading: boolean;
  onNavigate: (page: string) => void;
  onCreateReport: () => void;
}) {
  const pending = reports.filter((report) => report.status === "pending").length;
  const active = reports.filter(
    (report) => report.status === "verified" || report.status === "in_progress",
  ).length;
  const mine = reports.filter((report) => report.reporter_id === userId).length;
  return (
    <>
      <section className="pilot-welcome">
        <div><div className="pilot-kicker"><i /> CAKUPAN SELURUH PROVINSI ACEH</div><h1>Halo, {profile?.full_name || "Pengguna"}</h1><p>Ringkasan laporan yang tersedia untuk peran Anda.</p></div>
        <button className="pilot-primary" onClick={onCreateReport}><Plus size={17} /> Buat laporan</button>
      </section>
      <section className="pilot-metrics">
        <Metric icon={<Siren size={18} />} label="Laporan aktif" value={String(active)} note="Terverifikasi atau ditangani" tone="red" />
        <Metric icon={<ClipboardList size={18} />} label={isStaff ? "Menunggu verifikasi" : "Laporan saya"} value={String(isStaff ? pending : mine)} note={isStaff ? "Perlu tindak lanjut petugas" : "Termasuk yang menunggu tinjauan"} tone="blue" />
        <Metric icon={<MapPin size={18} />} label="Wilayah pilot" value="23" note="Kabupaten/kota di Aceh" tone="green" />
        <Metric icon={<Users size={18} />} label="Peran akun" value={profile ? roleLabels[profile.role] : "—"} note="Ditetapkan oleh sistem pilot" tone="purple" />
      </section>
      <section className="pilot-dashboard-grid">
        <article className="pilot-panel pilot-map-panel">
          <PanelHeading title="Peta laporan terverifikasi" description="Titik terverifikasi ditampilkan secara perkiraan." action="Buka peta" onAction={() => onNavigate("Peta kejadian")} />
          {loading ? <div className="map-loading">Memuat laporan…</div> : <IncidentMap reports={mapReports} />}
          <div className="pilot-panel-foot"><span><i className="map-dot" /> Lokasi tepat disamarkan pada peta publik</span><button onClick={() => onNavigate("Peta kejadian")}>Lihat semua titik <ArrowRight size={14} /></button></div>
        </article>
        <article className="pilot-panel pilot-activity-panel">
          <PanelHeading title="Aktivitas laporan" description={isStaff ? "Laporan yang perlu ditinjau" : "Laporan terbaru yang dapat Anda lihat"} action="Semua laporan" onAction={() => onNavigate("Laporan")} />
          {loading ? <p className="empty-state">Memuat data bersama…</p> : reports.length === 0 ? <EmptyReports /> : (
            <div className="compact-report-list">
              {reports.slice(0, 5).map((report) => <CompactReport key={report.id} report={report} />)}
            </div>
          )}
          <button className="pilot-panel-bottom-link" onClick={() => onNavigate("Laporan")}>Buka daftar laporan <ArrowRight size={14} /></button>
        </article>
      </section>
      <div className="pilot-operational-note"><HeartHandshake size={17} /><span>Data situasi, angka, dan lokasi berasal dari laporan yang benar-benar tersimpan. SiagaKita bukan kanal layanan darurat resmi.</span></div>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className="pilot-metric">
      <span className={`pilot-metric-icon ${tone}`}>{icon}</span>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  );
}

function PanelHeading({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="pilot-panel-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      {action && onAction && <button onClick={onAction}>{action}<ArrowRight size={14} /></button>}
    </div>
  );
}

function CompactReport({ report }: { report: Report }) {
  return (
    <article className="compact-report">
      <span className="compact-report-icon"><Waves size={16} /></span>
      <div className="compact-report-info"><div><strong>{report.incident_type}</strong><span className={statusClasses[report.status as ReportStatus]}><i />{statusLabels[report.status as ReportStatus]}</span></div><p><MapPin size={12} />{report.locality}, {report.district}</p><small>{report.report_code} · {formatDate(report.created_at)}</small></div>
    </article>
  );
}

function EmptyReports() {
  return <div className="empty-state"><ClipboardList size={24} /><strong>Belum ada laporan</strong><span>Laporan yang dapat Anda akses akan muncul di sini setelah dikirim.</span></div>;
}

function ReportsPage({
  reports,
  reportEvents,
  userId,
  isStaff,
  loading,
  busyReport,
  reviewNotes,
  setReviewNotes,
  onChangeStatus,
  onDeleteReport,
  onCreateReport,
}: {
  reports: Report[];
  reportEvents: ReportEvent[];
  userId: string;
  isStaff: boolean;
  loading: boolean;
  busyReport: string | null;
  reviewNotes: Record<string, string>;
  setReviewNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onChangeStatus: (report: Report, nextStatus: ReportStatus) => void;
  onDeleteReport: (report: Report) => void;
  onCreateReport: () => void;
}) {
  return (
    <>
      <section className="pilot-welcome">
        <div><div className="pilot-kicker"><i /> DATA BERSAMA · HAK AKSES AKTIF</div><h1>Laporan kejadian</h1><p>{isStaff ? "Tinjau laporan masyarakat dan catat keputusan verifikasi." : "Lihat laporan Anda dan kejadian yang sudah dipublikasikan."}</p></div>
        <button className="pilot-primary" onClick={onCreateReport}><Plus size={17} /> Buat laporan</button>
      </section>
      <section className="pilot-panel reports-list-panel">
        <div className="pilot-list-heading"><div><h2>{loading ? "Memuat laporan…" : `${reports.length} laporan tersedia`}</h2><p>Daftar diperbarui langsung dari database pilot.</p></div><span className="pilot-secure-chip"><ShieldCheck size={14} /> Terbatas sesuai peran</span></div>
        {loading ? <div className="map-loading">Memuat laporan bersama…</div> : reports.length === 0 ? <EmptyReports /> : reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            events={reportEvents.filter((event) => event.report_id === report.id)}
            isStaff={isStaff}
            isOwner={report.reporter_id === userId}
            busy={busyReport === report.id}
            note={reviewNotes[report.id] ?? ""}
            setNote={(value) => setReviewNotes((previous) => ({ ...previous, [report.id]: value }))}
            onChangeStatus={(next) => onChangeStatus(report, next)}
            onDelete={() => onDeleteReport(report)}
          />
        ))}
      </section>
    </>
  );
}

function ReportCard({
  report,
  events,
  isStaff,
  isOwner,
  busy,
  note,
  setNote,
  onChangeStatus,
  onDelete,
}: {
  report: Report;
  events: ReportEvent[];
  isStaff: boolean;
  isOwner: boolean;
  busy: boolean;
  note: string;
  setNote: (value: string) => void;
  onChangeStatus: (status: ReportStatus) => void;
  onDelete: () => void;
}) {
  const status = report.status as ReportStatus;
  return (
    <article className="pilot-report-card">
      <div className="report-card-title">
        <span className="report-card-icon"><Siren size={18} /></span>
        <div><h3>{report.incident_type}<small>{report.report_code}</small></h3><span className={statusClasses[status]}><i />{statusLabels[status]}</span></div>
      </div>
      <div className="report-card-meta"><span><MapPin size={14} />{report.locality}, {report.district}</span><span><Activity size={14} />{formatDate(report.created_at)}</span></div>
      {report.description && <p className="report-description">{report.description}</p>}
      {report.evidence_url && <a href={report.evidence_url} target="_blank" rel="noreferrer" className="evidence-link">Lihat bukti foto <ArrowRight size={14} /></a>}
      {report.latitude && report.longitude && <span className="location-precision"><MapPin size={13} />{isStaff || isOwner ? `Koordinat tersimpan: ${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}` : "Lokasi publik digeneralisasi pada peta"}</span>}
      <div className="report-history">
        <strong>Riwayat status</strong>
        {events.map((event) => (
          <div className="report-history-item" key={event.id}>
            <i />
            <span>
              {event.from_status
                ? `${statusLabels[event.from_status]} → ${statusLabels[event.to_status]}`
                : `Laporan dibuat · ${statusLabels[event.to_status]}`}
              <small>{formatDate(event.created_at)} · {event.actor_id === report.reporter_id ? "Pelapor" : "Petugas"}{event.note ? ` · ${event.note}` : ""}</small>
            </span>
          </div>
        ))}
      </div>
      {isStaff && status !== "resolved" && status !== "rejected" && (
        <div className="review-controls">
          <label>Catatan verifikasi <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Opsional, akan tercatat di riwayat" /></label>
          <div className="review-buttons">
            {status === "pending" && <><button disabled={busy} className="approve-button" onClick={() => onChangeStatus("verified")}><Check size={15} /> Verifikasi</button><button disabled={busy} className="reject-button" onClick={() => onChangeStatus("rejected")}>Tolak</button></>}
            {status === "verified" && <><button disabled={busy} className="approve-button" onClick={() => onChangeStatus("in_progress")}><Activity size={15} /> Mulai penanganan</button><button disabled={busy} className="reject-button" onClick={() => onChangeStatus("rejected")}>Tolak</button></>}
            {status === "in_progress" && <button disabled={busy} className="approve-button" onClick={() => onChangeStatus("resolved")}><Check size={15} /> Tandai selesai</button>}
          </div>
        </div>
      )}
      {!isStaff && isOwner && status === "pending" && <span className="review-hint">Laporan Anda bersifat privat sampai petugas memverifikasinya.</span>}
      {isOwner && status === "rejected" && <span className="review-hint">Laporan ini ditolak oleh petugas. Silakan hubungi koordinator pilot bila perlu klarifikasi.</span>}
      {(isOwner || isStaff) && (
        <button type="button" disabled={busy} className="reject-button" onClick={onDelete}>
          {busy ? "Menghapus…" : "Hapus laporan"}
        </button>
      )}
    </article>
  );
}

function MapPage({ reports, loading }: { reports: MapReport[]; loading: boolean }) {
  return (
    <>
      <section className="pilot-welcome">
        <div><div className="pilot-kicker"><i /> 23 KABUPATEN/KOTA</div><h1>Peta kejadian Aceh</h1><p>Menampilkan titik dari laporan yang sudah diverifikasi atau sedang ditangani.</p></div>
        <span className="map-count-chip"><MapPin size={15} />{loading ? "Memuat titik…" : `${reports.length} titik tampil`}</span>
      </section>
      <section className="pilot-panel full-map-panel">
        {loading ? (
          <div className="map-loading">Memuat peta dan laporan terverifikasi…</div>
        ) : (
          <>
            {reports.length === 0 && <div className="map-empty-overlay">Belum ada laporan terverifikasi untuk ditampilkan di peta.</div>}
            <IncidentMap reports={reports} />
          </>
        )}
        <div className="map-privacy-foot"><ShieldCheck size={15} /> Titik laporan pada peta untuk pengguna non-petugas digeneralisasi demi privasi.</div>
      </section>
      <p className="map-data-note">Peta menggunakan OpenStreetMap. Keakuratan pin berasal dari pelapor dan harus diperiksa petugas; tampilan peta bukan instruksi evakuasi.</p>
    </>
  );
}