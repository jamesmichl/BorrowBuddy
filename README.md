# BorrowBuddy

Aplikasi demo untuk pinjam dan sewa barang antarmahasiswa BINUS. Dibangun dengan Next.js App Router, TypeScript, Tailwind CSS, ESLint, dan npm.

Untuk demo bersama di Vercel, ikuti [panduan deployment dengan PostgreSQL Supabase](docs/DEPLOYMENT.md). Langkah di bawah menggunakan database SQLite di komputer pengembang.

## Menjalankan di PowerShell

```powershell
npm.cmd ci
npm.cmd run dev
```

Buka http://localhost:3000. Gunakan Node.js 22.23 atau lebih baru dengan dukungan `node:sqlite`. Backend Next.js menyimpan data di `.borrowbuddy/local.sqlite`. Untuk memilih berkas lain, tetapkan `BORROWBUDDY_DB` pada server dan pada perintah seed/migrasi.

Pada Node.js 22, terminal dapat menampilkan `ExperimentalWarning: SQLite is an experimental feature` saat proses pertama kali membuka database lokal. Peringatan ini berasal dari Node.js dan boleh dibiarkan saat development. Jika halaman gagal memuat data atau login gagal, periksa respons `/api/session` dan pesan kesalahan yang menyertainya.

## Akun dan sesi

Pilih **Masuk**, gunakan email dan password dari brief, lalu klik avatar untuk membuka **Profil saya**. Raka dan Naya masuk ke katalog. Admin masuk ke dashboard. Jika masuk dari halaman tertentu, BorrowBuddy kembali ke tujuan yang masih tersedia dan dapat diakses akun tersebut. Untuk berganti akun, tekan **Keluar** di bawah daftar barang pada profil, lalu masuk kembali. Sesi memakai cookie HttpOnly dan kedaluwarsa setelah tujuh hari.

| Akun contoh | Email | Hak akses |
| --- | --- | --- |
| Raka Pratama | raka@borrowbuddy.test | Mahasiswa |
| Naya Putri | naya@borrowbuddy.test | Mahasiswa |
| Admin Demo | admin@borrowbuddy.test | Admin |

### Menyiapkan database demo baru

Jalankan dari direktori proyek. Perintah ini meminta password melalui input tersembunyi dan mengirimkannya ke proses seed melalui stdin. Gunakan password dari brief.

```powershell
$env:BORROWBUDDY_DEMO_SEED = '1'
$demoSecrets = @{}
foreach ($id in 'raka','naya','admin') {
  $secret = Read-Host "Password demo untuk $id" -AsSecureString
  $demoSecrets[$id] = [pscredential]::new($id, $secret).GetNetworkCredential().Password
}
$demoSecrets | ConvertTo-Json -Compress | npm.cmd run seed:demo
Remove-Variable demoSecrets,secret
```

Seed mempertahankan ID, kepemilikan, transaksi, profil yang telah diubah, dan hash password yang ada. Untuk menjalankan ulang setelah database siap, gunakan `'{}' | npm.cmd run seed:demo`. Rotasi ketiga password memerlukan input yang sama dan flag eksplisit `npm.cmd run seed:demo -- --rotate-passwords`. Rotasi mencabut sesi akun contoh. Seed SQLite dan impor lokal dibatasi ke lingkungan pengembangan.

### Konfirmasi email pendaftar baru

Untuk pengujian lokal, jalankan `npm.cmd run dev` dan buka **Daftar**. Saat ketiga variabel email di bawah kosong, backend menawarkan **Konfirmasi pendaftaran demo** di browser tempat pendaftaran dilakukan. Gunakan email fiktif dalam format kampus, misalnya `uji-lokal@binus.ac.id`. Selesaikan konfirmasi dalam 15 menit, lalu masuk untuk membuka katalog. Status KTM awal adalah **Belum diajukan**. Mode ini tidak mengirim email.

Konfirmasi demo memerlukan tiket pendaftaran dan cookie HttpOnly yang berpasangan. Tautan hanya berlaku sekali. Jika kedaluwarsa, daftar kembali dengan kredensial yang sama. Jika beberapa pendaftaran dilakukan di satu browser, selesaikan pendaftaran terakhir terlebih dahulu. Akun yang hanya dikonfirmasi secara lokal memerlukan konfirmasi melalui email untuk masuk di produksi standar.

Untuk pengiriman sungguhan, atur semua variabel server berikut di `.env.local`, lalu mulai ulang Next.js. Pengiriman memakai Resend dengan alamat pengirim yang sudah diverifikasi.

- `BORROWBUDDY_MAIL_KEY` berisi kunci API pengiriman.
- `BORROWBUDDY_MAIL_FROM` berisi alamat pengirim.
- `BORROWBUDDY_APP_URL` berisi origin yang dapat dibuka penerima, misalnya `http://localhost:3000` untuk uji lokal di perangkat yang sama.

Tautan dari Resend berlaku sekali selama 24 jam. Jika pengiriman gagal atau tautan kedaluwarsa, daftar kembali dengan email dan password yang sama untuk menerima tautan baru. Konfigurasi yang terisi sebagian menampilkan pesan layanan belum dikonfigurasi. Untuk memilih demo secara sengaja di development saat konfigurasi email sudah terisi, gunakan `BORROWBUDDY_DEMO_EMAIL=1`. Produksi standar memerlukan layanan pengiriman. Mode online-demo memakai alamat fiktif dan konfirmasi di browser pendaftar. Ketiga alamat `.test` dikonfirmasi saat seed.

### Mengimpor data dari browser versi lama

Bila ada perubahan yang hanya tersimpan di browser lama, buka BorrowBuddy pada **origin, port, dan profil browser yang dipakai sebelumnya**. Di DevTools → Console jalankan kode berikut untuk mengunduh salinan JSON. Simpan di direktori pribadi karena berkas bisa memuat foto KTM dan data transaksi.

```js
const lama = localStorage.getItem("borrowbuddy-demo-v1");
if (lama) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([lama], { type: "application/json" }));
  link.download = "borrowbuddy-legacy.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
```

Gunakan ekspor dari instalasi lokal tepercaya. Dari direktori proyek jalankan perintah berikut dengan lokasi berkas yang sesuai.

```powershell
$env:BORROWBUDDY_DEMO_SEED = '1'
npm.cmd run migrate:legacy -- "$env:USERPROFILE\Downloads\borrowbuddy-legacy.json"
```

Impor mempertahankan ID dan riwayat, mengabaikan pilihan akun aktif lama, dan membatalkan seluruh perubahan jika ada konflik dengan data server yang telah diedit. Ekspor yang sama dapat diproses ulang. Setelah impor, muat ulang halaman. Akun tambahan dari browser lama perlu mengonfirmasi kembali email melalui pendaftaran dengan kredensial lama. Salinan lama tetap berada di browser asal.

## Mencoba alur peminjaman

1. Sebagai **Raka Pratama**, buka **Charger USB-C 65W** dan pilih **Ajukan peminjaman**. Isi jadwal mendatang dalam WIB dan pilih titik serah terima. Tinjau biaya dan kirim permintaan.
2. Keluar dari profil Raka lalu masuk sebagai **Naya Putri**. Buka tab **Saya Meminjamkan** atau lanjutkan dari detail transaksi yang sama, lalu setujui permintaan.
3. Sebagai **Raka**, pilih **Bayar QRIS simulasi** lalu **Sudah Bayar**. QR hanya berisi teks demo dengan ID transaksi. Buka **Lanjut ke serah terima**. Sebagai **Naya**, konfirmasi barang diserahkan. Ganti ke **Raka** untuk konfirmasi penerimaan. Transaksi Rp0 langsung siap untuk serah terima setelah persetujuan.
4. Sebagai **Raka**, konfirmasi barang dikembalikan. Sebagai **Naya**, pilih **Barang sesuai, selesaikan**. Status selesai dan pengembalian deposit penuh tampil di detail transaksi.
5. Untuk mencoba pencatatan barang baru, buka **Pasang Barang**. Isi informasi, tarif atau opsi gratis, titik serah terima dari daftar kampus, foto, dan estimasi nilai barang. Deposit dihitung otomatis sebesar 50% dari estimasi tersebut. Barang muncul di katalog setelah disimpan.

## Verifikasi dan promosi

1. Pilih **Daftar**, gunakan email kampus yang dapat menerima pesan, lalu konfirmasi email lewat tautan yang dikirim. Seed khusus demo memberi Raka dan Naya akses mahasiswa terverifikasi pada mode development.
2. Dari **Profil**, buka **Verifikasi Mahasiswa** dan ikuti langkah pengujian OCR di bawah. Keluar lalu masuk sebagai **Admin Demo** untuk memeriksa pengajuan. Jika ditolak, masuk kembali dengan akun yang didaftarkan untuk membaca alasan dan mengajukan ulang. Pengajuan pinjaman dan pemasangan barang tersedia setelah disetujui.
3. Sebagai **Raka**, buka **Tripod Kamera Portabel**, pilih **Promosikan Barang**, tinjau paket, lalu selesaikan QRIS simulasi. Paket default Rp10.000 untuk 7 hari. Paket berikutnya memperpanjang dari akhir masa tayang terakhir. Katalog menempatkan promosi aktif yang cocok dengan filter di bagian atas. Riwayat pembelian dan pendapatan tersedia di **Admin**.

## Menguji verifikasi tanpa dokumen mahasiswa

Gunakan `npm.cmd run dev` dan buka localhost. Masuk sebagai mahasiswa yang belum terverifikasi. Untuk membuat satu akun penguji lokal tanpa email sungguhan pada database demo yang sudah di-seed, jalankan ini di PowerShell. Pilih password minimal delapan karakter.

```powershell
$env:BORROWBUDDY_DEMO_SEED = '1'
$testerPass = Read-Host 'Password untuk uji-ocr@borrowbuddy.test' -AsSecureString
@{tester = [pscredential]::new('ocr-tester', $testerPass).GetNetworkCredential().Password} | ConvertTo-Json -Compress | npm.cmd run seed:demo -- --with-ocr-tester
Remove-Variable testerPass
```

Perintah tersebut membuat akun penguji dengan email terkonfirmasi. Menjalankannya ulang mempertahankan password dan riwayat verifikasi. Untuk mencoba ketiga skenario pada satu akun, kerjakan dua penolakan sebelum pengajuan yang disetujui.

1. Masuk, buka **Profil saya → Verifikasi Mahasiswa**, lalu pilih kampus.
2. Pilih skenario, tekan **Gunakan Data Contoh**, periksa preview, lalu kirim. Ketiga gambar bertuliskan **CONTOH — BUKAN KTM ASLI**. Input NIM terisi `1234567890`.
3. **Tanpa NIM** memiliki nomor latihan yang tidak berlabel NIM. **NIM berbeda** memuat `9876543210`. Keduanya ditolak otomatis dan dapat diajukan ulang. **NIM cocok** masuk ke antrean admin. Foto yang meragukan meminta pengambilan ulang.
4. Masuk sebagai admin, buka pengajuan berlabel **Demo**, periksa foto dan hasil OCR, lalu pilih setujui, tolak, atau minta perbaikan. Hanya persetujuan admin yang menyelesaikan pengajuan. Untuk mencoba fitur pinjam langsung, gunakan Raka atau Naya di development.
5. Untuk menguji galeri, pilih salah satu PNG sintetis dari `server/samples/`. Untuk kamera laptop, buka localhost dan tekan **Foto KTM**. Di HP, gunakan origin HTTPS lokal dengan sertifikat tepercaya pada HP, atau localhost yang diteruskan melalui USB. Sorot gambar sintetis pada layar lain. Browser meminta akses video saat tombol ditekan. Galeri tetap tersedia bila kamera atau izin tidak tersedia.

### Cara kerja OCR

Server memvalidasi format JPG, PNG, atau WebP, batas 1,5 MB, dan kemampuan dekode gambar sebelum memproses piksel memakai Tesseract.js dan model Inggris yang terpasang melalui npm. Mesin mencari angka 8–15 digit setelah label NIM atau Nomor Induk Mahasiswa. Pemisah spasi, titik, dan tanda hubung dinormalisasi. Pembacaan ambigu atau confidence rendah meminta foto ulang. Ambang confidence default 75 dapat diubah dengan `BORROWBUDDY_OCR_CONFIDENCE` (0–100) di lingkungan server. Batas waktu pemeriksaan 45 detik. Gangguan teknis dapat dicoba ulang tanpa penolakan dokumen.

Confidence mengukur kualitas pembacaan teks. Pemeriksaan nama, kampus, dan indikasi manipulasi tetap menjadi tugas admin. Silau, huruf kecil, tata letak yang berbeda, atau blur dapat menyebabkan salah baca. Dokumen dan hasil terstruktur disimpan di database SQLite privat bersama versi pengajuan, waktu, dan hash foto. Teks lengkap hasil OCR tidak dicatat ke log. Pengajuan lama yang masih menunggu dan belum mempunyai hasil OCR harus dikirim ulang.

Dalam produksi standar tanpa mode demo, tombol dan endpoint gambar contoh dinonaktifkan, gambar contoh yang dikenali ditolak, dan persetujuan demo tidak memberikan hak mahasiswa terverifikasi. Mode online-demo mempunyai database terpisah, seed tersendiri, dan hanya menerima kartu sintetis bawaan.

## Perilaku demo

- Jadwal yang masih berjalan, termasuk permintaan yang menunggu persetujuan, memblokir pengajuan yang waktunya bertumpang tindih. Jadwal diproses dalam WIB. Durasi ditagih per 24 jam dan dibulatkan ke atas.
- Peminjam membayar biaya layanan 10% dari subtotal sewa pada pesanan baru, dibulatkan ke Rupiah terdekat. Pembayaran simulasi mencatat biaya layanan ke kas aplikasi dan mengalokasikan subtotal sewa ke pemilik. Pesanan lama memakai tagihan semula.
- Deposit dikembalikan 100% dalam simulasi setelah pengembalian yang sesuai atau pembatalan sebelum serah terima. Pemeriksaan pengembalian dilakukan pemilik. Potongan atau sengketa belum tersedia. Untuk transaksi berbayar yang dibatalkan sebelum serah terima, admin dapat membuka detail transaksi dan mengonfirmasi refund biaya layanan dengan alasan. Riwayat kas menampilkan penerimaan awal dan pengurangan refund.
- Backend Next.js menangani login, sesi, dan otorisasi. Penyimpanan menggunakan SQLite di komputer pengembang atau PostgreSQL pada demo online. Pemeriksaan KTM memakai dokumen fiktif. Rating contoh, QRIS, pendapatan dan refund tetap simulasi.
- Persentase biaya layanan, mode pembayaran, dan paket promosi diatur di `lib/config.ts`. Pembelian promosi masuk ke pos pendapatan promosi sesuai harga paket.
- Demo online memakai PostgreSQL Supabase. Supabase Auth, Supabase Storage, dan gateway pembayaran sungguhan belum digunakan.

## Pengujian

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```
