# MoneyMate – Kelola Keuangan Mahasiswa

MoneyMate adalah aplikasi web sederhana untuk mencatat dan mengatur keuangan harian, dibuat khusus untuk kebutuhan mahasiswa. Aplikasi berjalan sepenuhnya di browser, tanpa server, tanpa akun, dan tanpa instalasi.

## Fitur

- **Dashboard**: ringkasan saldo, pemasukan, pengeluaran, grafik, dan anggaran yang sedang berlaku.
- **Transaksi**: tambah, ubah, dan hapus pemasukan atau pengeluaran, lengkap dengan kategori, metode pembayaran (Tunai, Transfer, E-Wallet), dan catatan. Tersedia pencarian dan filter berdasarkan jenis, kategori, metode, serta rentang tanggal.
- **Anggaran**: atur anggaran total dan per kategori, per 10 hari atau bulanan, dengan template pembagian (dengan atau tanpa biaya kos) dan indikator status (Aman, Hampir habis, Terlampaui).
- **Tabungan**: buat target tabungan dengan nominal dan tenggat, lalu tambah atau tarik dana dan pantau progresnya.
- **Laporan**: grafik dan ringkasan per periode (10 hari, bulanan, atau rentang kustom), serta ekspor ke CSV.
- **Kategori khusus**: tambahkan kategori pemasukan atau pengeluaran sendiri.
- **Cadangan data**: ekspor dan impor data dalam format JSON.
- **Responsif**: tampilan sidebar di desktop dan navigasi bawah di ponsel.

## Teknologi

- HTML, CSS, dan JavaScript (vanilla)
- [Bootstrap 5](https://getbootstrap.com/) dan [Bootstrap Icons](https://icons.getbootstrap.com/)
- [Chart.js](https://www.chartjs.org/) untuk grafik
- Font [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- `localStorage` untuk penyimpanan data

## Cara Menjalankan

1. Clone repositori ini:

```bash
   git clone https://github.com/Kaivan45/PengaturKeuangan.git
   cd PengaturKeuangan
```

2. Buka `index.html` langsung di browser, atau jalankan server lokal, misalnya:

```bash
   # dengan Python
   python -m http.server 8000

   # atau dengan Node.js
   npx serve
```

3. Buka `http://localhost:8000` jika memakai server lokal.

> Koneksi internet diperlukan saat pertama kali membuka aplikasi karena Bootstrap, Chart.js, dan font dimuat lewat CDN.

## Struktur Proyek

```
.
├── index.html        # Struktur halaman dan modal
├── css/
│   └── style.css     # Gaya kustom
└── js/
    ├── storage.js    # Lapisan penyimpanan, validasi, dan migrasi data
    └── app.js        # Logika aplikasi, tampilan, dan grafik
```

## Penyimpanan Data

Semua data disimpan di `localStorage` browser dengan kunci `moneymate_data_v1`. Artinya:

- Data **hanya ada di browser dan perangkat yang dipakai**, tidak tersinkron antarperangkat.
- Data **bisa hilang** jika penyimpanan browser dibersihkan.
- Data dapat dilihat siapa pun yang memakai profil browser yang sama.

Gunakan menu **Pengaturan → Ekspor JSON** secara berkala untuk membuat cadangan, dan **Impor** untuk memulihkannya.

## Kategori Bawaan

**Pengeluaran:** Makanan, Transportasi, Kos, Paket Data, Skincare, Gym, Pendidikan, Hiburan, Belanja, Kebutuhan Lainnya

**Pemasukan:** Uang Saku, Beasiswa, Gaji, Penghasilan Sampingan, Lainnya

## Kontribusi

Saran dan perbaikan sangat diterima. Silakan buka *issue* atau kirim *pull request*.
