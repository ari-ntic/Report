# Analisis migrasi Report_Database

Sumber: empat berkas proyek Apps Script Report_Database, dibaca 18 November 2026. Salinan asli dan tangkapan layar berisi data nyata disimpan lokal, tidak diunggah ke repositori ini.

## Tampilan desktop dan HP

| Bagian | Desktop | HP / layar sempit |
| --- | --- | --- |
| Susunan utama | Lebar di atas 1000 px: kisi 3:3:4; header selebar halaman | Maksimal 1000 px: satu kolom, panel dipindahkan oleh JavaScript |
| Urutan panel | Kiri: perlu tindakan dan tindak lanjut; tengah: input; kanan: tugas dan foto; ringkasan laporan di bawah | Header, tugas, input, perlu tindakan, tindak lanjut, foto, ringkasan laporan |
| Header | Tinggi 74 px, latar gelap, judul dan pengalih Jepang/Inggris | Penyesuaian ukuran teks dan tombol bahasa sesuai CSS asli |
| Input | Satu baris atau beberapa kolom; tanggal kejadian bersama | Kedua mode tetap tersedia; komponen mengikuti lebar layar |
| Daftar | Panel dengan area gulir; tabel laporan dan filter | Penyesuaian tabel/kartu dan modal mengikuti aturan asli |
| Galeri | Kisi menyesuaikan lebar; 8 kolom di atas 1280 px | 5 kolom pada rentang menengah, 4 hingga 768 px, 3 hingga 500 px; aturan tambahan asli dipertahankan |
| Modal dan foto | Detail, edit, galeri, zoom/pan dan navigasi keyboard | Penyesuaian ukuran, tinggi viewport dinamis, sentuh dan gulir asli |

Seluruh style, markup dan skrip interaksi asli dipertahankan secara identik. Tiga pemuat koneksi/login ditambahkan di bagian head. Tidak ada perancangan ulang tata letak.

## Fungsi yang dipertahankan

1. Input satu baris: penanda `!`/`red` untuk mendesak, `?`/`yellow` untuk perhatian, pencarian nama, kategori, isi dan pratinjau.
2. Saran nama: pencocokan nama/kana, urutan kandidat, tombol panah, Enter, klik serta posisi kursor di akhir nama terpilih.
3. Input terpisah: tingkat urgensi, nama, kategori dan catatan; Enter pada nama menuju catatan; Enter pada catatan mengirim. Penghapusan per kata dan perpindahan fokus setelah memilih kategori/urgensi dipertahankan.
4. Kalender tanggal kejadian: sebelumnya/berikutnya, kembali hari ini, pemilih bulan/tanggal, larangan tanggal mendatang dan fokus kembali ke input.
5. Penyimpanan: kunci saat proses, ID pengiriman tetap, hasil belum terkonfirmasi, percobaan ulang dengan ID yang sama, pengamanan pengiriman ganda.
6. Lampiran: maksimal lima gambar; kompresi JPEG kualitas 0,80 dengan sisi maksimum 1920 px; unggah sementara, status/retry, penghapusan lampiran, penyimpanan ke Drive.
7. Draf: teks, mode, tanggal dan foto; localStorage dan IndexedDB, pemulihan draf, pengamanan konflik antar-tab serta pengiriman tertunda.
8. Dashboard: perlu tindakan, selesai/buka kembali, tindak lanjut terbaru, foto terbaru, ringkasan laporan.
9. Daftar laporan: pencarian, perusahaan, kategori, urgensi, halaman, pemilihan laporan dan pengelolaan massal.
10. Detail/editor: edit isi, urgensi, kategori, tanggal, tindak lanjut dan lampiran; kalender laporan/tindak lanjut memiliki ID terpisah.
11. Sampah: pindah ke sampah, pemulihan, pemrosesan sebagian, percobaan ulang dan konfirmasi penghapusan permanen.
12. Foto: galeri berhalaman, pramuat terurut, versi asli, penampil, zoom, pan, tetangga foto dan dukungan drag gambar.
13. Tugas: tambah, selesai/belum selesai, hapus, tampilan ringkas dan modal/filter lengkap.
14. Bahasa Jepang dan Inggris; pemuatan latar, cache antarmuka dan prioritas permintaan.
15. Menu administratif spreadsheet, pemformatan, pemeriksaan foto orphan dan sinkronisasi master Excel tetap di Apps Script.

## Penyesuaian migrasi

- `google.script.run` di tampilan menggunakan penghubung iframe Google dengan kanal acak, pemeriksaan asal pesan, sumber iframe yang dipasangkan, daftar fungsi terbatas dan batas waktu.
- Data tidak diambil sebelum login. Tidak ada otomatisasi percobaan ulang untuk tindakan tulis di lapisan koneksi.
- Login Google diverifikasi di server: tanda tangan RSA, penerbit, tujuan token, masa berlaku, email terverifikasi dan daftar akun yang diizinkan.
- Izin admin diperiksa untuk penghapusan dan administrasi. Fungsi pembantu server dibuat privat supaya tidak menjadi jalur membaca data tanpa pemeriksaan izin.
- Token login hanya di memori browser. Token sinkronisasi Excel tidak ada di repositori ini.
- Draf dipisahkan menurut akun. Draf belum terkirim di alamat Apps Script lama tidak otomatis berpindah ke alamat GitHub karena penyimpanan browser dipisahkan per asal situs.
- Pengiriman master dari Excel memakai jalur POST yang sama secara fungsional.

## Pemeriksaan

Pengujian lokal meliputi kesamaan sumber UI, ketiadaan token rahasia, sintaks server, pengamanan semua fungsi laporan, kesetaraan jalur POST Excel, antrean koneksi, respons bersamaan, penolakan pesan palsu, deduplikasi, token salah/kedaluwarsa, pencabutan izin, larangan hapus oleh anggota, verifikasi RSA di lingkungan tanpa Node, alur fokus/keyboard, parser input, tanggal, draf, dan halaman terkunci sebelum login.

Tampilan aplikasi asli diperiksa di desktop 1440×1000 dan HP 390×844. Pengujian layar sempit pada browser internal adalah simulasi ukuran layar, bukan pengujian Safari/iPhone fisik.

Login dan operasi Google langsung harus diuji lagi setelah ID klien serta deployment backend dikonfigurasi. Berkas migrasi saja tidak berarti seluruh koneksi langsung sudah aktif. Tindakan hapus permanen tidak dijalankan pada data nyata untuk pengujian.
