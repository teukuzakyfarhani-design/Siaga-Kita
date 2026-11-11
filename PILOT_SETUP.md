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
- Layer posko menampilkan data lokasi dan stok dari tabel operasional; tidak
  ada stok contoh yang dimasukkan otomatis.
- Petugas/admin dapat mengelola lokasi dan stok melalui halaman Posko &
  logistik; perubahan tampil pada layer peta realtime.
- Tombol SOS mengirim GPS ke antrean petugas realtime. Sinyal dan koordinat
  hanya dapat dibaca pelapor dan petugas/admin.
- Feed gempa BMKG ditampilkan dengan sumber dan waktu feed; ini bukan pengganti
  peringatan aktif atau arahan evakuasi resmi.
- Laporan tanpa foto dapat disimpan di perangkat saat offline dan dikirim
  otomatis setelah koneksi kembali. Aplikasi memiliki app shell PWA.
- Laporan yang diverifikasi memicu notifikasi realtime dalam aplikasi kepada
  relawan yang membagikan lokasi dalam radius 5 km.

Pilot ini tidak menghubungi layanan darurat, SMS/WhatsApp gateway, atau
notifikasi push latar-belakang. Broadcast 5 km hanya tersedia di dashboard saat
relawan online. Integrasi provider tersebut memerlukan layanan dan kredensial
server-side yang belum disediakan. Feed yang digunakan saat ini adalah feed
gempa BMKG, bukan feed peringatan cuaca/banjir lengkap. Peta dan laporan bukan
sumber resmi atau instruksi evakuasi.

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

Di Supabase, buka **Authentication → Providers → Email** dan pastikan
**Allow new users to sign up** aktif. Jika pengguna baru harus langsung dapat
masuk tanpa mengeklik tautan email, nonaktifkan **Confirm email** untuk pilot
terbatas. Jika tetap aktif, pengguna harus mengonfirmasi email terlebih dahulu;
aplikasi tidak dapat melewati verifikasi tersebut dengan aman.

## 2. Buat tabel, aturan akses, dan bucket foto

Di **SQL Editor** Supabase, jalankan isi file
[`supabase/migrations/202610220001_initial_pilot.sql`](./supabase/migrations/202610220001_initial_pilot.sql)
secara keseluruhan. Migrasi membuat tabel profil/laporan/riwayat, kebijakan
RLS, fungsi transisi status, serta bucket foto privat.

Jangan menonaktifkan RLS dan jangan membuat bucket bukti foto publik.

Jika database pilot sudah dibuat sebelumnya, jalankan juga migrasi
[`supabase/migrations/202610310001_add_report_deletion.sql`](./supabase/migrations/202610310001_add_report_deletion.sql)
di SQL Editor. Migrasi ini memberikan hak hapus yang dibatasi hanya untuk
pemilik laporan dan petugas.

Jalankan juga migrasi
[`supabase/migrations/202611110001_emergency_operations.sql`](./supabase/migrations/202611110001_emergency_operations.sql)
setelah migrasi sebelumnya. Migrasi ini menambahkan direktori posko, sinyal
SOS, lokasi relawan privat, broadcast dalam radius 5 km, dan idempotensi untuk
sinkronisasi laporan offline.

Data posko/logistik harus dimasukkan dan diperbarui oleh petugas/admin melalui
halaman Posko & logistik dan proses operasional yang dipercaya. Jangan
memasukkan koordinat atau stok perkiraan sebagai data nyata. Stok yang kosong
berarti nol, bukan jumlah yang belum diketahui.

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
7. Izinkan lokasi pada akun warga, kirim SOS, lalu pastikan sinyal muncul pada
   akun petugas. Uji perubahan status dan penolakan akses akun warga ke sinyal
   orang lain.
8. Pada akun relawan, aktifkan lokasi, verifikasi laporan dalam jarak 5 km,
   lalu pastikan hanya relawan yang cocok menerima notifikasi. Lokasi berbagi
   kedaluwarsa untuk pencocokan setelah 2 jam.
9. Uji antrean laporan tanpa foto saat offline, pulihkan koneksi, lalu pastikan
   satu laporan tersinkron tanpa duplikasi. Lampiran foto tidak masuk antrean
   offline; SOS tidak dijadwalkan untuk terkirim terlambat.
10. Pastikan layer posko hanya berisi data inventaris operasional yang sudah
    diverifikasi dan feed BMKG tetap ditandai sebagai informasi, bukan arahan.

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
