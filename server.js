import express from 'express';
import pkg from 'pg';
const { Pool, types } = pkg;
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Kolom DATE dikembalikan sebagai teks 'YYYY-MM-DD' (hindari geser zona waktu)
types.setTypeParser(1082, value => value);

const app = express();
const port = process.env.PORT || 3000;

// Konfigurasi Koneksi PostgreSQL menggunakan DATABASE_URL dari file .env
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Test koneksi database saat server mulai
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL database:', err.stack);
    } else {
        console.log('Berhasil terhubung ke database PostgreSQL');
        release();
    }
});

// Migrasi otomatis: tambah kolom tenggat waktu jika belum ada (aman dijalankan berulang)
pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE')
    .catch(err => console.error('Migrasi due_date gagal:', err.message));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Konfigurasi Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'taskflow-secret-key-rahasia',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Halaman login sudah digabung ke index.html; arahkan alamat lama ke sana
app.get('/login.html', (req, res) => res.redirect('/'));

// Middleware untuk menyajikan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware untuk memproteksi rute yang memerlukan login
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized. Silakan login terlebih dahulu.' });
};

// ==================== AUTH ROUTES ====================

app.post('/api/register', async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        const password = req.body.password || '';

        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password wajib diisi!' });
        }
        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({ error: 'Username harus 3-50 karakter.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password minimal 6 karakter.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username';
        const result = await pool.query(query, [username, hashedPassword]);

        res.status(201).json({ message: 'Registrasi berhasil!', user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username sudah digunakan.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const query = 'SELECT * FROM users WHERE username = $1';
        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Username atau password salah!' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(400).json({ error: 'Username atau password salah!' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({ message: 'Login berhasil!', username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Gagal logout.' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout berhasil.' });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ isLoggedIn: true, username: req.session.username });
    } else {
        res.json({ isLoggedIn: false });
    }
});

// ==================== TASK ROUTES ====================

const PRIORITIES = ['high', 'normal', 'low'];

// Mengembalikan 'YYYY-MM-DD', null (kosong), atau false (tidak valid)
function parseDueDate(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
    return value;
}

app.get('/api/tasks', isAuthenticated, async (req, res) => {
    try {
        const query = 'SELECT * FROM tasks WHERE user_id = $1 ORDER BY id DESC';
        const result = await pool.query(query, [req.session.userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal mengambil data tugas.' });
    }
});

app.post('/api/tasks', isAuthenticated, async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const priority = req.body.priority || 'normal';
        const dueDate = parseDueDate(req.body.due_date);

        if (!name) {
            return res.status(400).json({ error: 'Nama tugas tidak boleh kosong!' });
        }
        if (name.length > 120) {
            return res.status(400).json({ error: 'Nama tugas maksimal 120 karakter.' });
        }
        if (!PRIORITIES.includes(priority)) {
            return res.status(400).json({ error: 'Prioritas tidak valid.' });
        }
        if (dueDate === false) {
            return res.status(400).json({ error: 'Format tenggat waktu tidak valid.' });
        }

        const query = 'INSERT INTO tasks (user_id, name, priority, due_date) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(query, [req.session.userId, name, priority, dueDate]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal menambahkan tugas.' });
    }
});

// Hapus semua tugas yang selesai (HARUS sebelum '/api/tasks/:id')
app.delete('/api/tasks/completed/all', isAuthenticated, async (req, res) => {
    try {
        await pool.query('DELETE FROM tasks WHERE user_id = $1 AND completed = TRUE', [req.session.userId]);
        res.json({ message: 'Tugas selesai berhasil dihapus.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal menghapus tugas selesai.' });
    }
});

// Ubah tugas: kirim salah satu atau beberapa dari completed, name, priority, due_date
app.patch('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID tugas tidak valid.' });
        }

        const fields = [];
        const values = [];
        const add = (column, value) => {
            values.push(value);
            fields.push(`${column} = $${values.length}`);
        };

        const { completed, name, priority, due_date } = req.body;

        if (completed !== undefined) add('completed', Boolean(completed));

        if (name !== undefined) {
            const cleanName = String(name).trim();
            if (!cleanName || cleanName.length > 120) {
                return res.status(400).json({ error: 'Nama tugas harus 1-120 karakter.' });
            }
            add('name', cleanName);
        }

        if (priority !== undefined) {
            if (!PRIORITIES.includes(priority)) {
                return res.status(400).json({ error: 'Prioritas tidak valid.' });
            }
            add('priority', priority);
        }

        if (due_date !== undefined) {
            const dueDate = parseDueDate(due_date);
            if (dueDate === false) {
                return res.status(400).json({ error: 'Format tenggat waktu tidak valid.' });
            }
            add('due_date', dueDate);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diubah.' });
        }

        values.push(id, req.session.userId);
        const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`;
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tugas tidak ditemukan atau bukan milik Anda.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal memperbarui tugas.' });
    }
});

app.delete('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *';
        const result = await pool.query(query, [id, req.session.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tugas tidak ditemukan atau bukan milik Anda.' });
        }

        res.json({ message: 'Tugas berhasil dihapus.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal menghapus tugas.' });
    }
});

app.listen(port, () => {
    console.log(`TaskFlow berjalan di http://localhost:${port}`);
});