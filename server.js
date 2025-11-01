// ==========================================================
// 🚀 SERVER.JS (FINAL STABIL — SOCKET.IO REALTIME + RAILWAY)
// ==========================================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");

// ==========================================================
// 🔧 KONFIGURASI DASAR
// ==========================================================
const app = express();
app.set("trust proxy", 1); // ✅ FIX proxy issue di Railway

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci-rahasia-super-aman-untuk-toto-app';
const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL || 'postgresql://postgres:password@postgres.railway.internal:5432/railway';
const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB;

// ==========================================================
// ⚡ HTTP SERVER + SOCKET.IO
// ==========================================================
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://erptoto.up.railway.app",
      "http://localhost:8080"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ==========================================================
// 🧩 MIDDLEWARE
// ==========================================================
app.use(express.json());
app.options('*', cors());
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-access-token'],
}));

// Static Files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'toto-frontend')));

// ==========================================================
// 🗃️ DATABASE SETUP
// ==========================================================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.on('error', (err) => console.error('Unexpected error on idle client', err));

// ==========================================================
// 🔐 AUTENTIKASI JWT
// ==========================================================
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.headers['x-access-token']) token = req.headers['x-access-token'];

    if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError')
          return res.status(401).json({ message: 'EXPIRED' });
        return res.status(403).json({ message: 'Token tidak valid.' });
      }
      req.user = user;
      next();
    });
  } catch (err) {
    console.error('authenticateToken error:', err);
    res.status(500).json({ message: 'Kesalahan autentikasi server.' });
  }
}

// ==========================================================
// 👤 LOGIN USER
// ==========================================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0)
      return res.status(401).json({ message: 'Username atau password salah!' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Username atau password salah!' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ message: 'Login berhasil!', token, user });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// ==========================================================
// 🧱 WORK ORDERS (CRUD + REALTIME)
// ==========================================================

// CREATE
app.post('/api/workorders', authenticateToken, async (req, res) => {
  try {
    const { tanggal, nama_customer, deskripsi, ukuran, qty } = req.body;
    const date = tanggal ? new Date(tanggal) : new Date();
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();

    const r = await pool.query(
      `INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tanggal || new Date().toISOString().slice(0, 10), nama_customer || 'Tanpa Nama', deskripsi || '', ukuran, qty, bulan, tahun]
    );

    const newRow = r.rows[0];
    io.emit('wo_created', newRow);
    console.log(`📡 [wo_created] broadcast ke semua client`);
    res.status(201).json(newRow);
  } catch (err) {
    console.error('❌ POST /api/workorders error:', err);
    res.status(500).json({ message: 'Gagal menambah data.' });
  }
});

// READ
app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    const r = await pool.query(
      `SELECT * FROM work_orders WHERE bulan = $1 AND tahun = $2 ORDER BY tanggal ASC, id ASC`,
      [month, year]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('❌ GET /api/workorders error:', err);
    res.status(500).json({ message: 'Gagal memuat data.' });
  }
});

// UPDATE
app.patch('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const valid = ['tanggal', 'nama_customer', 'deskripsi', 'ukuran', 'qty'];
    const filtered = Object.entries(updates).filter(([k]) => valid.includes(k));
    if (!filtered.length) return res.status(400).json({ message: 'Kolom tidak valid.' });

    const set = filtered.map(([k], i) => `"${k}"=$${i + 1}`).join(', ');
    const vals = filtered.map(([_, v]) => v);
    vals.push(id);

    const q = await pool.query(`UPDATE work_orders SET ${set}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    const updated = q.rows[0];

    io.emit('wo_updated', updated);
    console.log(`📡 [wo_updated] dikirim ke ${io.engine.clientsCount} client`);
    res.json({ message: 'Berhasil diperbarui.', data: updated });
  } catch (err) {
    console.error('❌ PATCH /api/workorders error:', err);
    res.status(500).json({ message: 'Gagal memperbarui data.' });
  }
});

// DELETE
app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(`DELETE FROM work_orders WHERE id=$1 RETURNING *`, [id]);
    io.emit('wo_deleted', { id });
    console.log(`📡 [wo_deleted] dikirim ke semua client`);
    res.status(204).send();
  } catch (err) {
    console.error('❌ DELETE /api/workorders error:', err);
    res.status(500).json({ message: 'Gagal menghapus data.' });
  }
});

// ==========================================================
// ⚡ SOCKET.IO HANDLER
// ==========================================================
io.on('connection', (socket) => {
  console.log(`🟢 Socket client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.warn(`🔴 Socket client disconnected (${reason})`);
  });
});

// ==========================================================
// 🌐 FRONTEND FALLBACK
// ==========================================================
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'toto-frontend', 'index.html'));
});

// ==========================================================
// 🚀 START SERVER
// ==========================================================
httpServer.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
