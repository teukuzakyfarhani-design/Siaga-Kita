# Menyiapkan pilot SiagaKita Aceh

Pilot ini menggunakan Supabase Auth, Postgres dengan Row Level Security (RLS),
Supabase Storage privat, dan peta OpenStreetMap. Data contoh lama tidak
digunakan: tanpa konfigurasi Supabase aplikasi menampilkan layar setup, bukan
angka kejadian palsu.

## Fitur dalam cakupan pilot

- Pendaftaran dan masuk menggunakan email/kata sandi.
- Peran `citizen` dan `volunteer` dapat mendaftar sendiri. Pendaftaran tidak
  dapat memberikan peran petugas atau administrator.
- Petugas/admin melihat laporan yang menunggu verifikasi dan dapat
  memverifikasi, menolak, memulai penanganan, atau menandai selesai.
- Status, aktor yang mengubah status, catatan, dan waktu perubahan disimpan
  sebagai riwayat laporan.
- Laporan tersimpan bersama, berisi jenis kejadian, wilayah, area umum,
  keterangan, koordinat pilihan pelapor, dan foto opsional.
- Foto tersimpan di bucket privat; foto hanya dapat dibaca pelapor dan petugas.
- Peta menggunakan tile OpenStreetMap dan titik laporan dari database. Titik
  publik digeneralisasi; petugas dan pelapor dapat melihat koordinat tepat.

Pilot ini belum menyediakan integrasi layanan darurat, SMS/WhatsApp, notifikasi
push, sinkronisasi offline, atau manajemen logistik/posko. Peta dan laporan
bukan sumber resmi atau instruksi evakuasi.

## 1. Buat proyek Supabase

1. Buat proyek baru di Supabase untuk pilot, terpisah dari produksi.
2. Di **Project Settings → API**, salin Project URL dan publishable key (atau
   anon key lama). Jangan gunakan service-role key di browser.
3. Buat `.env.local` dengan menyalin `.env.example`, lalu isi:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
   ```

4. Pastikan `.env.local` tidak dibagikan atau dikomit.

## 2. Buat tabel, aturan akses, dan bucket foto

Di **SQL Editor** Supabase, jalankan isi file
[`supabase/migrations/202610220001_initial_pilot.sql`](./supabase/migrations/202610220001_initial_pilot.sql)
secara keseluruhan. Migrasi membuat tabel profil/laporan/riwayat, kebijakan
RLS, fungsi transisi status, serta bucket foto privat.

Jangan menonaktifkan RLS dan jangan membuat bucket bukti foto publik.

## 3. Buat akun petugas/admin untuk tester

1. Jalankan aplikasi dan daftarkan semua tester lewat halaman pendaftaran.
2. Konfirmasi email jika pengaturan Auth proyek mengharuskannya.
3. Untuk akun yang perlu memverifikasi laporan, buka **SQL Editor** dan
   promosikan hanya email yang sudah disepakati. Ganti alamat contoh:

   ```sql
   update public.profiles
   set role = 'officer'
   where id = (
     select id from auth.users
     where email = 'petugas@example.org'
   );
   ```

   Peran yang tersedia: `officer`, `admin`, `citizen`, dan `volunteer`.
   Pengguna baru tidak dapat memberi dirinya sendiri peran `officer` atau
   `admin`. Jalankan perubahan peran hanya sebagai pemilik proyek.

Jika migrasi telah dijalankan sebelum dukungan mode pengunjung ditambahkan,
jalankan kembali file migrasi terbaru secara keseluruhan agar fungsi peta
terverifikasi dapat dipanggil oleh peran `anon`. Fungsi tersebut hanya
mengembalikan laporan yang sudah ditinjau, tanpa deskripsi, foto, identitas,
atau koordinat tepat.

## 4. Jalankan dan uji lokal

```powershell
npm install
npm run dev
```

Buka `http://localhost:3000`. Uji dengan minimal dua akun berbeda:

1. Akun masyarakat mengirim laporan tanpa dan dengan foto, lalu memeriksa
   statusnya.
2. Akun petugas memverifikasi laporan; akun masyarakat kedua harus melihatnya
   muncul hanya setelah status dipublikasikan.
3. Petugas menguji alur `Perlu verifikasi → Terverifikasi → Dalam penanganan
   → Selesai`, serta penolakan.
4. Pastikan akun masyarakat tidak dapat membaca laporan pending pengguna lain,
   bukti foto privat, atau melakukan transisi status petugas.
5. Periksa titik pada peta, batas wilayah, dan perbedaan koordinat tepat
   petugas/pelapor dengan titik publik yang digeneralisasi.
6. Uji kata sandi salah, konfirmasi email, foto tipe/ukuran tidak sah, dan
   gangguan jaringan; pesan kegagalan harus terlihat dan tidak memberi kesan
   data berhasil tersimpan.

Koordinat dipilih manual dan dibatasi pada rentang luas di Aceh, bukan divalidasi
terhadap batas kabupaten resmi. Petugas harus memeriksa wilayah, lokasi, dan
foto sebelum memverifikasi laporan.

## 5. Bagikan pilot online

Untuk akses dari perangkat tester yang berbeda, deploy aplikasi ke layanan
hosting Next.js (misalnya Vercel), lalu tambahkan dua environment variable yang
sama pada pengaturan proyek hosting. Atur URL callback/site URL Supabase untuk
domain deployment, deploy ulang, dan bagikan URL HTTPS hanya kepada tester.
Uji alur akun dari domain deployment sebelum mengundang pengguna.

Gunakan proyek Supabase khusus pilot, undang tester yang disepakati, siapkan
backup, dan hapus/arsipkan data uji setelah periode pilot. Tidak ada credential
atau URL proyek Supabase yang disertakan di repository ini.
