# NTIC Report

Migrasi tampilan Report_Database ke GitHub Pages.

Halaman utama: https://ari-ntic.github.io/Report/

Tampilan, CSS responsif, bahasa Jepang/Inggris, input satu baris dan terpisah, perpindahan fokus, draf, lampiran, galeri, tindak lanjut, tugas dan pengelolaan laporan dipertahankan dari sumber aslinya.

Data laporan tetap di Google Sheets dan foto tetap di Google Drive. Repositori ini hanya memuat tampilan dan penghubung; tidak memuat isi laporan, daftar peserta, foto, atau token sinkronisasi Excel.

## Berkas
- index.html: antarmuka asli.
- admin.html: pengelola foto orphan asli; tindakan hapus tetap memerlukan konfirmasi.
- auth.js: login Google, token hanya di memori browser.
- rpc.js: penghubung ke Apps Script dengan pemeriksaan asal pesan, daftar fungsi terbatas dan batas waktu. Tidak mengulang otomatis tindakan tulis.
- config.js: alamat deployment dan ID klien Google yang memang bersifat publik. Bukan tempat menyimpan kata sandi/token.

## Akses
Login Google aktif. Akun baru menekan Minta akses; administrator mendapat email dan menyetujui atau menolak melalui tombol Pengguna di aplikasi. Setelah disetujui, halaman pemohon memeriksa izin setiap 20 detik selama terbuka. Pemohon tidak dapat membaca laporan sebelum diizinkan. Admin juga dapat mencabut akses member. Izin selalu diperiksa lagi oleh Apps Script.

## Pembaruan
Unggah perubahan ke cabang main. GitHub Pages menerbitkan dari root. Backend Apps Script diperbarui terpisah.

Draf baru tersimpan di browser pada alamat GitHub ini. Draf belum terkirim dari alamat Apps Script lama tidak otomatis pindah karena penyimpanan browser terpisah menurut alamat situs.
