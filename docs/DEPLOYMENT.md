# Demo bersama di Vercel

Gunakan satu proyek Supabase khusus data contoh dan satu proyek Vercel untuk BorrowBuddy. Folder aplikasi berisi `package.json`. Build menggunakan Next.js App Router dan Node.js 22.x. Alur login, pembayaran, dan OCR memerlukan fungsi Node di server.

## Lokasi data

| Bagian | Pengembangan lokal | Demo online |
| --- | --- | --- |
| Akun, hash password, sesi, percobaan login, tiket konfirmasi | SQLite privat di `.borrowbuddy/local.sqlite` | PostgreSQL Supabase, schema privat `borrowbuddy`. Backend BorrowBuddy memeriksa password dan hak akses. Browser menyimpan token sesi dalam cookie HttpOnly. |
| Profil, listing, pinjaman, promosi, moderasi dan bukti pembayaran | SQLite | PostgreSQL. Perubahan satu operasi disimpan dalam satu transaksi. Permintaan dari instance Vercel yang berbeda berbagi data yang sama. |
| Foto barang | Foto unggahan dioptimalkan dan disimpan di SQLite. Foto katalog bawaan ada di `public/catalog.jpg`. | Foto unggahan tersimpan di PostgreSQL. Batas seluruh foto katalog setelah pengodean adalah 3 MiB. Demo ini menggunakan satu snapshot data dan cocok untuk katalog kelas berukuran kecil. |
| KTM dan keputusan admin | File yang dipilih diproses di server. Riwayat dan gambar tersimpan dalam SQLite privat. | Hanya tiga PNG sintetis bawaan dan NIM contoh yang diterima. Server memeriksa hash gambar. PostgreSQL menyimpan referensi gambar, hasil pemeriksaan, dan keputusan. API membatasi akses ke data pengajuan berdasarkan pemilik dan peran admin. |
| OCR dan kamera | OCR memakai Sharp, Tesseract dan model Inggris dari paket aplikasi. Kamera di browser memerlukan izin serta HTTPS atau localhost. | OCR berjalan di fungsi Node dengan model terpaket, batas OCR 45 detik, batas fungsi 60 detik. Form menyediakan tombol **Gunakan Data Contoh**. Kamera dan pemilihan file KTM tersedia pada alur lokal. |
| Email dan QRIS | Tersedia konfirmasi email lokal atau pengiriman Resend jika dikonfigurasi. QRIS simulasi. | Pendaftaran memakai alamat fiktif dan konfirmasi pada browser pendaftar. QRIS, pembayaran, pendapatan dan refund tetap simulasi. |
| Memori dan browser | Tampilan sesi, preview gambar dan notifikasi antartab bersifat sementara. | Memori fungsi digunakan untuk koneksi database dan pekerjaan OCR yang sedang berjalan. Akun dan transaksi bertahan setelah fungsi berhenti. |

Supabase digunakan melalui koneksi PostgreSQL server-side. Aplikasi menangani autentikasi sendiri. Supabase Auth, bucket Storage, anon key dan service-role key tidak diperlukan.

## 1. Siapkan PostgreSQL

1. Di Supabase, pilih atau buat proyek khusus demo yang sesuai dengan kuota yang disetujui. Buka **SQL Editor** dan jalankan isi [deploy/postgres.sql](../deploy/postgres.sql). Skrip membuat schema dan tabel bila belum ada. Simpan database SQLite dan semua dokumen lokal di komputer asal.
2. Biarkan schema `borrowbuddy` privat, di luar daftar schema yang diekspos melalui Data API. Untuk akun koneksi khusus aplikasi, buat role login melalui pengelola database, lalu beri `USAGE ON SCHEMA borrowbuddy` dan `SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA borrowbuddy`. Jalankan pembuatan schema dengan akun pengelola.
3. Di **Connect → Transaction pooler**, salin connection string port 6543. Masukkan kredensial role database pada URL dan lakukan URL-encoding karakter khusus di password. Driver memverifikasi sertifikat TLS dan menonaktifkan prepared statements untuk pooler. Jika rantai sertifikat membutuhkan CA proyek, ambil root CA dari Supabase dan isi `BORROWBUDDY_POSTGRES_CA`. [Panduan koneksi Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)

## 2. Buat katalog dan tiga akun contoh

Jalankan sekali dari folder aplikasi di komputer pengelola dengan Node 22.x. Gunakan password baru dan berbeda, 12–128 karakter. Input password dan URL berikut tersembunyi dari layar. Simpan kredensial admin untuk pengelola. Bagikan akun mahasiswa atau minta peserta mendaftar menggunakan nama samaran.

```powershell
npm.cmd ci
$env:BORROWBUDDY_MODE = 'online-demo'
$dbSecret = Read-Host 'URL Transaction pooler database demo' -AsSecureString
$env:BORROWBUDDY_POSTGRES_URL = [pscredential]::new('db', $dbSecret).GetNetworkCredential().Password
$seedPasswords = @{}
foreach ($id in 'raka','naya','admin') {
  $value = Read-Host "Password baru untuk $id" -AsSecureString
  $seedPasswords[$id] = [pscredential]::new($id, $value).GetNetworkCredential().Password
}
$seedPasswords | ConvertTo-Json -Compress | npm.cmd run seed:online
Remove-Variable seedPasswords,value,dbSecret
Remove-Item Env:BORROWBUDDY_POSTGRES_URL,Env:BORROWBUDDY_MODE
```

Jika CA diperlukan, atur `$env:BORROWBUDDY_POSTGRES_CA` ke isi PEM sebelum seed. Seed membuat enam barang, transaksi contoh, serta `raka@borrowbuddy.test`, `naya@borrowbuddy.test`, dan `admin@borrowbuddy.test`. Raka dan Naya memiliki akses pinjam demo. Menjalankan ulang dengan `'{}' | npm.cmd run seed:online` pada schema yang sudah lengkap mempertahankan data dan password. Seed terpisah dari build dan deploy.

## 3. Hubungkan folder ke Vercel

Workspace ini belum memiliki direktori Git. Gunakan CLI dari folder yang berisi `package.json` dan lakukan login dengan akun Vercel pengelola.

```powershell
npx vercel login
npx vercel link
```

Pilih proyek Vercel BorrowBuddy atau buat proyek kosong dengan kuota yang telah disetujui. Pilih preset **Next.js**, Node.js **22.x**, install command `npm ci`, build command `npm run build`, serta output directory bawaan. `.vercelignore` membatasi unggahan CLI ke sumber dan aset runtime. Data SQLite, dokumen desain, ekspor, dan file environment lokal berada di luar paket. Untuk integrasi Git di kemudian hari, gunakan folder aplikasi sebagai root dan periksa daftar file yang akan di-commit terlebih dahulu.

Di **Project Settings → Environment Variables**, tambahkan variabel untuk deployment target. Nama dan formatnya juga ada di [.env.example](../.env.example).

| Nama | Isi |
| --- | --- |
| `BORROWBUDDY_MODE` | Wajib, `online-demo`. Next.js tetap menggunakan konfigurasi production. |
| `BORROWBUDDY_POSTGRES_URL` | Wajib, connection string Transaction pooler. Simpan sebagai secret server. |
| `BORROWBUDDY_POSTGRES_CA` | Opsional, root CA dalam format PEM. Baris baru asli maupun literal `\n` didukung. |
| `BORROWBUDDY_OCR_CONFIDENCE` | Opsional, ambang 0–100, default 75. |

Pilih region fungsi dekat database. Preview dan Production yang diberi URL database yang sama akan mengubah data yang sama. Gunakan database demo terpisah jika Preview dipakai untuk tes yang perlu diisolasi. Biarkan `NODE_ENV` dikelola Next.js. Variabel database bersifat server-only. Password seed hanya digunakan di komputer pengelola.

## 4. Publikasi dan pemeriksaan melalui HTTPS

Setelah mendapat persetujuan untuk memublikasikan, gunakan `npx vercel` untuk Preview. Setelah uji Preview selesai, gunakan `npx vercel --prod` untuk alamat yang akan dibagikan. Jika deployment memakai Deployment Protection, berikan akses kepada penguji lewat pengaturan berbagi Vercel. Perubahan environment variable berlaku pada deployment berikutnya. [Deploy dengan Vercel CLI](https://vercel.com/docs/cli/deploy)

1. Buka alamat HTTPS yang sama pada dua browser. Masuk sebagai Raka di satu browser dan Naya di browser lain. Ajukan pinjaman, setujui sebagai pemilik, lalu selesaikan QRIS simulasi dan serah terima. Muat ulang untuk memeriksa riwayat.
2. Daftar dengan nama samaran dan alamat unik berakhiran `@student.borrowbuddy.test`. Tekan **Konfirmasi pendaftaran demo** pada browser yang sama dalam 15 menit, lalu masuk. Belum ada email yang dikirim. Tiket di fragmen URL berlaku sekali dan harus dipasangkan dengan cookie HttpOnly pendaftar. Cookie memakai `Secure` pada Vercel.
3. Gunakan kartu sintetis untuk mencoba OCR dan persetujuan admin. Pengguna baru masuk ke katalog dan memperoleh hak transaksi sesudah disetujui. Verifikasi bahwa menu admin hanya dapat dipakai admin dan logout mengakhiri sesi.
4. Coba promosi pada barang sendiri. Periksa badge pada browser lain dan pembayaran berlabel **QRIS — Simulasi**. Untuk melihat perubahan dari pengguna lain, muat ulang katalog.

Konfirmasi aplikasi berada di `/konfirmasi-email` pada origin yang sedang dipakai. Mode demo tidak memerlukan pengirim email, `BORROWBUDDY_APP_URL`, callback OAuth, atau konfigurasi **Site URL / Redirect URLs** di Supabase Auth. Jika aplikasi standar di luar demo memakai Resend, tetapkan `BORROWBUDDY_APP_URL` ke origin HTTPS aplikasi yang sebenarnya dan konfigurasi `BORROWBUDDY_MAIL_KEY` serta `BORROWBUDDY_MAIL_FROM` dengan pengirim terverifikasi. Jika suatu saat beralih ke Supabase Auth, baru daftarkan origin production sebagai Site URL serta URL callback yang ditangani integrasi tersebut dalam Redirect URLs.

Jika katalog gagal dimuat, periksa environment target, koneksi TLS, schema, dan izin role. Katalog kosong pada database baru biasanya berarti seed belum dijalankan. Untuk kendala OCR di runtime hosting, periksa ketersediaan worker, model, durasi, dan ukuran paket di log fungsi tanpa mencatat foto, token, atau isi database. [Batas Vercel Functions](https://vercel.com/docs/functions/limitations)

