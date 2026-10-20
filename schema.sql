-- Jalankan sekali pada database taskflow-fullstack.
-- Aman dijalankan berulang kali: tidak menghapus data yang sudah ada.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    priority VARCHAR(10) DEFAULT 'normal',
    completed BOOLEAN DEFAULT FALSE,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Untuk tabel tasks yang sudah ada sebelumnya (server juga menjalankan ini otomatis):
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;

-- Jika tabel tasks lama (tanpa kolom user_id) masih ada, hapus manual SEKALI saja:
-- DROP TABLE tasks;   -- lalu jalankan ulang file ini
