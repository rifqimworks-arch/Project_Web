# TaskFlow Full-Stack

Versi database dari TaskFlow menggunakan:
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: PostgreSQL
- API: REST (`GET`, `POST`, `PATCH`, `DELETE`)

## Prasyarat
1. Instal Node.js versi LTS dari https://nodejs.org/
2. Instal PostgreSQL dari https://www.postgresql.org/download/ atau gunakan PostgreSQL yang sudah tersedia.
3. VS Code.

## Langkah 1 — Buat database
Buka pgAdmin atau terminal PostgreSQL, lalu jalankan:

```sql
CREATE DATABASE "taskflow-fullstack";
```

Setelah itu, pilih database `taskflow-fullstack` dan jalankan isi file `schema.sql` untuk membuat tabel `users` dan `tasks`.

Di pgAdmin: buka database `taskflow` → Query Tool → buka/salin isi `schema.sql` → Execute.

## Langkah 2 — Atur koneksi database
Di terminal VS Code, pastikan terminal berada di folder project `taskflow-fullstack`, lalu jalankan:

```bash
npm install
```

Salin `.env.example` menjadi file bernama `.env`. Isi password PostgreSQL lokal kamu di `DATABASE_URL`.

Contoh jika username `postgres`, password `contoh123`, dan PostgreSQL di port `5432`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:contoh123@localhost:5432/taskflow-fullstack
```

Ganti `contoh123` dengan password PostgreSQL milikmu. Jangan bagikan atau upload file `.env` ke GitHub.

## Langkah 3 — Jalankan aplikasi
Di terminal VS Code:

```bash
npm run dev
```

Buka browser ke http://localhost:3000. Satu halaman (`index.html`) menampilkan kartu login/register atau aplikasi tugas, tergantung status login. Klik **Daftar di sini** untuk membuat akun pertama.

**Penting:** jangan jalankan `index.html` dengan Live Server untuk versi ini. Buka `http://localhost:3000` karena Express menyajikan frontend dan API.

## Cek database
Jalankan query berikut di pgAdmin Query Tool:

```sql
SELECT * FROM tasks ORDER BY created_at DESC;
```

Setelah menambah tugas lewat web, jalankan query tersebut untuk melihat record di database.

## Fitur
- Register, login, logout (tugas terpisah per user)
- Tambah, edit (ikon pensil atau klik dua kali nama), centang, dan hapus tugas
- Tenggat waktu dengan label Terlambat, Hari ini, Besok
- Pencarian dan urutan (terbaru, tenggat, prioritas, nama)
- Mode terang/gelap (pilihan tersimpan di browser)

Kolom `due_date` ditambahkan otomatis saat server dijalankan, jadi tabel lama tidak perlu dibuat ulang.

## Troubleshooting
- `DATABASE_URL belum diatur`: pastikan file `.env` ada di folder utama project, sejajar dengan `server.js`.
- `password authentication failed`: periksa username/password PostgreSQL di `.env`.
- `ECONNREFUSED`: pastikan service PostgreSQL sedang berjalan dan port benar.
- `relation "tasks" does not exist`: jalankan `schema.sql` pada database `taskflow`.
- `npm is not recognized` atau `npm: command not found`: instal Node.js LTS lalu tutup dan buka kembali VS Code.

## API yang tersedia
| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/register` | Membuat akun |
| POST | `/api/login` | Login |
| POST | `/api/logout` | Logout |
| GET | `/api/check-auth` | Cek status login |
| GET | `/api/tasks` | Mengambil semua tugas milik user |
| POST | `/api/tasks` | Membuat tugas |
| PATCH | `/api/tasks/:id` | Mengubah `completed`, `name`, `priority`, atau `due_date` (kirim salah satu atau beberapa) |
| DELETE | `/api/tasks/:id` | Menghapus satu tugas |
| DELETE | `/api/tasks/completed/all` | Menghapus tugas selesai |

Ini project belajar lokal. Semua route tugas butuh login. Sebelum dipakai publik, tambahkan rate limiting, konfigurasi HTTPS, dan pengelolaan secret yang aman.
