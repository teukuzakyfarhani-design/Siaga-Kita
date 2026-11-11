"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Boxes, Check, Edit3, MapPin, Plus, Save, X } from "lucide-react";
import type { ReliefSite } from "@/components/IncidentMap";
import { getSupabaseClient } from "@/lib/supabase";

type ReliefSiteRecord = ReliefSite & {
  is_open: boolean;
  updated_at: string;
};

type SiteForm = {
  name: string;
  district: string;
  locality: string;
  latitude: string;
  longitude: string;
  public_kitchen: boolean;
  clean_water_liters: string;
  food_portions: string;
  medicine_kits: string;
};

const emptyForm: SiteForm = {
  name: "",
  district: "",
  locality: "",
  latitude: "",
  longitude: "",
  public_kitchen: false,
  clean_water_liters: "0",
  food_portions: "0",
  medicine_kits: "0",
};

const acehDistricts = [
  "Kabupaten Aceh Barat", "Kabupaten Aceh Barat Daya", "Kabupaten Aceh Besar",
  "Kabupaten Aceh Jaya", "Kabupaten Aceh Selatan", "Kabupaten Aceh Singkil",
  "Kabupaten Aceh Tamiang", "Kabupaten Aceh Tengah", "Kabupaten Aceh Tenggara",
  "Kabupaten Aceh Timur", "Kabupaten Aceh Utara", "Kabupaten Bener Meriah",
  "Kabupaten Bireuen", "Kabupaten Gayo Lues", "Kabupaten Nagan Raya",
  "Kabupaten Pidie", "Kabupaten Pidie Jaya", "Kabupaten Simeulue",
  "Kota Banda Aceh", "Kota Langsa", "Kota Lhokseumawe", "Kota Sabang",
  "Kota Subulussalam",
];

export default function ReliefSitesPage({ isStaff }: { isStaff: boolean }) {
  const supabase = getSupabaseClient();
  const [sites, setSites] = useState<ReliefSiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState<ReliefSiteRecord | null>(null);
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSites = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError("Backend Supabase belum tersedia.");
      return;
    }
    const result = await supabase
      .from("relief_sites")
      .select("id, name, district, locality, latitude, longitude, public_kitchen, clean_water_liters, food_portions, medicine_kits, is_open, updated_at")
      .order("district")
      .order("name");
    if (result.error) {
      setError(`Direktori posko gagal dimuat: ${result.error.message}`);
    } else {
      setSites((result.data ?? []) as ReliefSiteRecord[]);
      setError("");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadSites();
    if (!supabase) return;
    const channel = supabase
      .channel(`relief-sites-directory-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "relief_sites" }, () => {
        void loadSites();
      })
      .subscribe((status, channelError) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError(`Pembaruan direktori realtime bermasalah${channelError ? `: ${channelError.message}` : "."}`);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSites, supabase]);

  function beginEdit(site: ReliefSiteRecord) {
    setEditingSite(site);
    setForm({
      name: site.name,
      district: site.district,
      locality: site.locality,
      latitude: String(site.latitude),
      longitude: String(site.longitude),
      public_kitchen: site.public_kitchen,
      clean_water_liters: String(site.clean_water_liters),
      food_portions: String(site.food_portions),
      medicine_kits: String(site.medicine_kits),
    });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingSite(null);
    setShowForm(false);
  }

  async function saveSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isStaff) return;
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const inventory = [
      Number(form.clean_water_liters),
      Number(form.food_portions),
      Number(form.medicine_kits),
    ];
    if (
      !Number.isFinite(latitude) || latitude < 1 || latitude > 7 ||
      !Number.isFinite(longitude) || longitude < 93 || longitude > 100 ||
      inventory.some((value) => !Number.isInteger(value) || value < 0)
    ) {
      setError("Koordinat harus berada di wilayah Aceh dan jumlah stok berupa bilangan bulat nol atau lebih.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      name: form.name.trim(),
      district: form.district,
      locality: form.locality.trim(),
      latitude,
      longitude,
      public_kitchen: form.public_kitchen,
      clean_water_liters: inventory[0],
      food_portions: inventory[1],
      medicine_kits: inventory[2],
      updated_at: new Date().toISOString(),
    };
    try {
      const result = editingSite
        ? await supabase.from("relief_sites").update(payload).eq("id", editingSite.id).select("id").maybeSingle()
        : await supabase.from("relief_sites").insert(payload).select("id").single();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("Data posko tidak ditemukan atau tidak dapat diubah oleh akun ini.");
      setNotice(editingSite ? "Data posko berhasil diperbarui." : "Posko berhasil ditambahkan.");
      resetForm();
      await loadSites();
    } catch (saveError) {
      setError(saveError instanceof Error ? `Data posko gagal disimpan: ${saveError.message}` : "Data posko gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleOpen(site: ReliefSiteRecord) {
    if (!supabase || !isStaff) return;
    const result = await supabase
      .from("relief_sites")
      .update({ is_open: !site.is_open, updated_at: new Date().toISOString() })
      .eq("id", site.id)
      .select("id")
      .maybeSingle();
    if (result.error) {
      setError(`Status posko gagal diperbarui: ${result.error.message}`);
      return;
    }
    if (!result.data) {
      setError("Status posko tidak berubah. Pastikan akun petugas masih memiliki akses.");
      return;
    }
    setNotice(`Posko ${site.name} ${site.is_open ? "ditutup" : "dibuka"}.`);
    await loadSites();
  }

  return (
    <>
      <section className="pilot-welcome">
        <div><div className="pilot-kicker"><i /> DATA OPERASIONAL TERKINI</div><h1>Posko & logistik</h1><p>Lokasi pengungsian, dapur umum, air bersih, makanan, dan paket obat yang dilaporkan petugas.</p></div>
        {isStaff && <button className="pilot-primary" onClick={() => { setEditingSite(null); setForm(emptyForm); setShowForm(true); }}><Plus size={16} /> Tambah posko</button>}
      </section>

      <section className="pilot-panel relief-directory-panel">
        <div className="pilot-panel-heading">
          <div><h2>Direktori posko pengungsian</h2><p>Stok ditampilkan sesuai pembaruan terakhir dari petugas.</p></div>
          <span className="map-count-chip"><Boxes size={14} />{loading ? "Memuat…" : `${sites.filter((site) => site.is_open).length} posko buka`}</span>
        </div>
        {error && <p className="operations-error relief-directory-message" role="alert">{error}</p>}
        {notice && <p className="operations-success relief-directory-message" role="status"><Check size={15} />{notice}</p>}

        {showForm && isStaff && (
          <form className="relief-site-form" onSubmit={saveSite}>
            <div className="relief-form-heading"><strong>{editingSite ? "Perbarui data posko" : "Tambahkan posko terverifikasi"}</strong><button type="button" aria-label="Tutup form" onClick={resetForm}><X size={17} /></button></div>
            <div className="relief-form-grid">
              <label>Nama posko<input required minLength={2} maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Kabupaten/kota<select required value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })}><option value="">Pilih wilayah</option>{acehDistricts.map((district) => <option key={district}>{district}</option>)}</select></label>
              <label>Kecamatan / gampong<input required maxLength={160} value={form.locality} onChange={(event) => setForm({ ...form, locality: event.target.value })} /></label>
              <label>Latitude<input required type="number" step="any" min="1" max="7" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></label>
              <label>Longitude<input required type="number" step="any" min="93" max="100" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></label>
              <label className="relief-checkbox"><input type="checkbox" checked={form.public_kitchen} onChange={(event) => setForm({ ...form, public_kitchen: event.target.checked })} />Dapur umum tersedia</label>
              <label>Air bersih (liter)<input required type="number" min="0" step="1" value={form.clean_water_liters} onChange={(event) => setForm({ ...form, clean_water_liters: event.target.value })} /></label>
              <label>Makanan (porsi)<input required type="number" min="0" step="1" value={form.food_portions} onChange={(event) => setForm({ ...form, food_portions: event.target.value })} /></label>
              <label>Paket obat<input required type="number" min="0" step="1" value={form.medicine_kits} onChange={(event) => setForm({ ...form, medicine_kits: event.target.value })} /></label>
            </div>
            <p className="relief-form-note">Masukkan koordinat dan stok yang telah diverifikasi. Data akan tampil pada peta publik dan diperbarui realtime.</p>
            <div className="relief-form-actions"><button type="button" className="operations-secondary" onClick={resetForm}>Batal</button><button className="pilot-primary" disabled={saving}><Save size={15} />{saving ? "Menyimpan…" : "Simpan data"}</button></div>
          </form>
        )}

        {loading ? <p className="operations-empty">Memuat daftar posko…</p> : sites.length === 0 ? (
          <div className="empty-state"><Boxes size={24} /><strong>Belum ada data posko</strong><span>Informasi lokasi dan stok akan muncul setelah dimasukkan petugas. Jangan mengandalkan peta ini sebagai daftar lengkap tempat pengungsian.</span></div>
        ) : (
          <div className="relief-site-list">
            {sites.map((site) => (
              <article key={site.id} className={`relief-site-card ${site.is_open ? "" : "closed"}`}>
                <div className="relief-site-card-heading"><span className="relief-site-card-icon"><MapPin size={17} /></span><div><strong>{site.name}</strong><span>{site.locality}, {site.district}</span></div><b className={site.is_open ? "open" : "closed"}>{site.is_open ? "BUKA" : "TUTUP"}</b></div>
                <div className="relief-stock-grid">
                  <span><small>Dapur umum</small><strong>{site.public_kitchen ? "Tersedia" : "Tidak ada"}</strong></span>
                  <span><small>Air bersih</small><strong>{site.clean_water_liters.toLocaleString("id-ID")} L</strong></span>
                  <span><small>Makanan</small><strong>{site.food_portions.toLocaleString("id-ID")} porsi</strong></span>
                  <span><small>Paket obat</small><strong>{site.medicine_kits.toLocaleString("id-ID")}</strong></span>
                </div>
                <div className="relief-site-card-footer"><small>Diperbarui {new Date(site.updated_at).toLocaleString("id-ID")}</small><a href={`https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}#map=15/${site.latitude}/${site.longitude}`} target="_blank" rel="noreferrer">Buka peta</a>{isStaff && <div><button onClick={() => beginEdit(site)}><Edit3 size={13} />Edit</button><button onClick={() => void toggleOpen(site)}>{site.is_open ? "Tutup posko" : "Buka posko"}</button></div>}</div>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="map-data-note">Stok harus diperbarui oleh petugas setelah distribusi atau penerimaan bantuan. Hubungi BPBA/BPBD setempat untuk memastikan ketersediaan sebelum menuju lokasi.</p>
    </>
  );
}
