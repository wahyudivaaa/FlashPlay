# 🎬 FlashPlay - Movie Trailer Website

<div align="center">
  <img src="frontend/assets/images/preview.png" alt="FlashPlay Preview" width="100%">
  
  [![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
  [![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
</div>

## 📖 Tentang FlashPlay

FlashPlay adalah platform streaming trailer film modern yang memungkinkan pengguna untuk menjelajahi dan menonton trailer film terbaru dengan tampilan yang menarik dan responsif. Website ini menggunakan TMDB API untuk mendapatkan data film terkini dan Node.js sebagai backend untuk mengelola request API.

## 🌟 Fitur Utama

- **🎯 Hero Section Dinamis**

  - Menampilkan film unggulan secara otomatis
  - Background yang menarik dan responsif
  - Informasi film lengkap

- **🎬 Katalog Film**

  - Grid layout yang modern
  - Hover effects yang smooth
  - Rating dan tahun rilis film
  - Poster film berkualitas tinggi

- **🔍 Pencarian Real-time**

  - Pencarian instan saat mengetik
  - Hasil yang akurat dari TMDB database
  - Filter berdasarkan kategori

- **🎥 Trailer Modal**
  - Pemutaran trailer yang mulus
  - Kontrol video lengkap
  - Autoplay dengan mute default
  - Tampilan fullscreen

## 💻 Teknologi yang Digunakan

- **Frontend:**

  - HTML5 & CSS3
  - Vanilla JavaScript
  - Font Awesome Icons
  - Google Fonts

- **Backend:**

  - Node.js
  - node-fetch untuk API calls
  - dotenv untuk konfigurasi

- **API & Services:**
  - TMDB (The Movie Database) API
  - YouTube Embedded Player

## 📋 Persyaratan Sistem

- Node.js (v14.0.0 atau lebih baru)
- NPM (v6.0.0 atau lebih baru)
- Web Browser Modern (Chrome, Firefox, Edge)
- Koneksi Internet Stabil
- TMDB API Key

## 🚀 Panduan Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/flashplay.git
cd flashplay
```

### 2. Install Dependencies

```bash
# Install dependencies untuk backend
cd backend
npm install

# Install dependencies untuk frontend (jika ada)
cd ../frontend
npm install
```

### 3. Konfigurasi Environment

- Buat file `.env` di folder backend

```env
TMDB_API_KEY=your_api_key_here
PORT=5001
```

### 4. Jalankan Aplikasi

```bash
# Jalankan backend server
cd backend
npm start

# Buka frontend/index.html di browser
# atau gunakan live server VSCode
```

## 🎮 Cara Penggunaan

1. **Browsing Film**

   - Scroll halaman untuk melihat film populer
   - Klik film untuk melihat detail dan trailer
   - Gunakan kategori untuk filter film

2. **Pencarian Film**

   - Ketik judul film di search bar
   - Hasil akan muncul secara otomatis
   - Klik film yang diinginkan

3. **Menonton Trailer**
   - Klik film untuk membuka modal
   - Trailer akan autoplay (muted)
   - Gunakan kontrol video untuk pengaturan

## 📱 Responsive Design

Website ini responsif untuk:

- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (320px - 767px)

## 🔒 Keamanan

- CORS protection
- Environment variables untuk API keys
- Sanitasi input pencarian
- Error handling yang aman

## 📞 Dukungan & Kontak

- **Instagram:** [@whyudivaaa](https://www.instagram.com/whyudivaaa/)
- **GitHub Issues:** [Create New Issue](https://github.com/yourusername/flashplay/issues)

## 📜 Lisensi

Proyek ini dilisensikan di bawah MIT License. Lihat file [LICENSE](LICENSE) untuk detail.

## 🙏 Acknowledgments

- TMDB untuk API film
- Font Awesome untuk icons
- Google Fonts untuk typography
- Komunitas open source

---

<div align="center">
  Made with ❤️ by <a href="https://www.instagram.com/whyudivaaa/">Wahyu Diva</a>
</div>
