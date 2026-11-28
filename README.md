# DiskLab — Simulator Penjadwalan Disk & Alokasi Berkas
> **Tugas Akhir Mata Kuliah Sistem Operasi (Semester Ganjil 2026/2027)**  
> **Dosen Pengampu:** Muhammad Sidik Asyaky, S.T., M.T.  
> **Kelompok 2 — Teknik Informatika**

---

## 👥 Anggota Kelompok 2
| No | Nama Mahasiswa | NIM | Peran Utama |
|:--:|:---------------|:---:|:------------|
| 1 | **Fikka Alisya Putri Taofik** | 257006111203 | Frontend, UI/UX & Dokumentasi |
| 2 | **Fakhri Dinal Maulana Putra** | 257006111205 | Lead, Disk Scheduling & Deploy |
| 3 | **Anisa Rahmawati** | 257006111199 | Visualizer Canvas & Animasi |
| 4 | **Muhammad Zidan Assuyuti** | 257006111201 | Alokasi Berkas & Defrag |
| 5 | **Muhammad Dava Rayana** | 257006111193 | Chart Benchmark & Pengujian |

---

## 📌 Deskripsi Proyek
**DiskLab** adalah aplikasi web simulasi interaktif yang dirancang untuk memvisualisasikan cara kerja subsistem penyimpanan komputer pada sistem operasi:
1. **Penjadwalan Disk (*Disk Scheduling*):** Mengimplementasikan algoritma **FCFS, SSTF, SCAN, dan C-SCAN** lengkap dengan visualisasi grafik trajektori pergerakan jarum head langkah demi langkah (*step-by-step*), perhitungan jarak silinder, dan perbandingan efisiensi *seek time*.
2. **Alokasi Berkas (*File System Allocation*):** Memvisualisasikan metode alokasi **Contiguous, Linked, dan Indexed Allocation** pada peta 64 blok disk penyimpanan fisik, disertai pembuktian nyata fenomena *External Fragmentation* dan tombol operasi Kompaksi / Defragmentasi.
3. **Perbandingan Efisiensi:** Menampilkan grafik batang Chart.js membandingkan performa Total Seek Time antar 4 algoritma secara real-time.

---

## 🔗 Tautan Resmi Proyek
- **Aplikasi Web Live (HTTPS):** https://so.navia.web.id
- **Video Demo (YouTube Unlisted):** https://youtu.be/pR2R5b46ugI
- **Repositori GitHub:** https://github.com/Yogiri-Ai/UAS-Sistem-Operasi

---

## 📖 Cara Penggunaan Simulator
1. Buka **https://so.navia.web.id** melalui browser desktop maupun smartphone, lalu klik **Buka Simulator DiskLab ↓**.
2. **Tab Penjadwalan Disk (`💿 Penjadwalan Disk`):** Pilih algoritma (`FCFS`, `SSTF`, `SCAN`, atau `C-SCAN`), atur *Posisi Awal Head*, *Maks Silinder*, *Arah Sapuan*, serta antrian track (atau gunakan tombol preset *Buku Silberschatz* / *Kasus Starvation SSTF*), lalu klik **Hitung** dan tekan **▶ Putar** untuk melihat animasi trajektori head beserta statistik *Total Head Movement* dan *Rata-rata Seek Time*.
3. **Tab Alokasi Berkas (`📁 Alokasi Berkas`):** Pilih metode (`Contiguous`, `Linked List`, atau `Indexed Allocation`) pada grid 64 blok (`#00–#63`), buat atau hapus berkas, serta gunakan tombol **Kompaksi / Defrag** untuk memadatkan ruang yang terpecah akibat *External Fragmentation*.
4. **Tab Perbandingan Efisiensi (`📊 Perbandingan Efisiensi`):** Bandingkan total pergerakan head keempat algoritma secara serentak pada grafik batang Chart.js dan tabel risiko *starvation*.

---

## 🚀 Cara Instalasi & Menjalankan Lokal
1. **Buka Langsung di Browser:**
   - Cukup buka berkas `index.html` dengan Google Chrome atau browser modern lainnya.
2. **Menjalankan Dev Server Lokal:**
   ```bash
   node server.js
   ```
   Server lokal akan aktif di `http://localhost:5173/` dan otomatis membuka browser.
3. **Hosting & Custom Domain:**
   - Siap di-deploy langsung ke Vercel, Netlify, atau GitHub Pages tanpa build step (Zero-dependency).
