# DiskLab — Simulator Penjadwalan Disk & Alokasi Berkas
> **Tugas Akhir Mata Kuliah Sistem Operasi (Semester Ganjil 2026/2027)**  
> **Dosen Pengampu:** Muhammad Sidik Asyaky, S.T., M.T.  
> **Kelompok 2 — Teknik Informatika**

---

## 👥 Anggota Kelompok 2
| No | Nama Mahasiswa | NIM | Peran Utama |
|:--:|:---------------|:---:|:------------|
| 1 | **Fikka Alisya Putri Taofik** | 257006111203 | Frontend & UI Layout |
| 2 | **Fakhri Dinal Maulana Putra** | 257006111205 | Lead & Algoritma Engine |
| 3 | **Anisa ** | 257006111199 | Visualizer & Canvas |
| 4 | **Muhammad Zidan ** | 257006111201 | Alokasi Berkas |
| 5 | **Muhammad Dava ** | 257006111193 | Chart & Benchmark |
| 6 | **Prameswari Eleonora ** | 257006111218 | Dokumentasi & Pengujian |

---

## 📌 Deskripsi Proyek
**DiskLab** adalah aplikasi web simulasi interaktif yang dirancang untuk memvisualisasikan cara kerja subsistem penyimpanan komputer pada sistem operasi:
1. **Penjadwalan Disk (*Disk Scheduling*):** Mengimplementasikan algoritma **FCFS, SSTF, SCAN, dan C-SCAN** lengkap dengan visualisasi grafik trajektori pergerakan jarum head langkah demi langkah (*step-by-step*), perhitungan jarak silinder, dan perbandingan efisiensi *seek time*.
2. **Alokasi Berkas (*File System Allocation*):** Memvisualisasikan metode alokasi **Contiguous, Linked, dan Indexed Allocation** pada peta 64 blok disk penyimpanan fisik, disertai pembuktian nyata fenomena *External Fragmentation* dan tombol operasi Kompaksi / Defragmentasi.
3. **Perbandingan Efisiensi:** Menampilkan grafik batang Chart.js membandingkan performa Total Seek Time antar 4 algoritma secara real-time.

---

## 🚀 Cara Menjalankan Aplikasi
1. **Buka Langsung di Browser:**
   - Cukup buka berkas `index.html` dengan Google Chrome atau browser modern lainnya.
2. **Menjalankan Dev Server Lokal:**
   ```bash
   node server.js
   ```
   Server lokal akan aktif di `http://localhost:5173/` dan otomatis membuka browser.
3. **Hosting & Custom Domain:**
   - Siap di-deploy langsung ke Vercel, Netlify, atau GitHub Pages tanpa build step (Zero-dependency).
