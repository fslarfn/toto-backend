// ==========================================================
// 🚀 SERVER.JS (FINAL VERSION — REALTIME, PRODUKSI, STABIL)
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
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci-rahasia-super-aman-untuk-toto-app';
const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL || 'postgresql://postgres:password@postgres.railway.internal:5432/railway';
const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB;

// ==========================================================
// ⚡ HTTP SERVER + SOCKET.IO SERVER
// ==========================================================
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://erptoto.up.railway.app", // domain produksi
      "http://localhost:8080"           // lokal development
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  transports: ["websocket", "polling"],
  allowEIO3: true
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
// 📸 MULTER (UPLOADS)
// ==========================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uid = (req.user && req.user.id) ? req.user.id : 'anon';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uid}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// ==========================================================
// 🔐 AUTENTIKASI
// ==========================================================
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.headers['x-access-token']) token = req.headers['x-access-token'];

    if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error('❌ JWT VERIFY GAGAL:', err.name, err.message);
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
// 👤 LOGIN & USER
// ==========================================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username dan password wajib diisi.' });

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0)
      return res.status(401).json({ message: 'Username atau password salah!' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Username atau password salah!' });

    if (user.role !== 'admin' && user.subscription_status === 'inactive')
      return res.status(403).json({ message: 'Langganan Anda tidak aktif.' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subscription_status: user.subscription_status
      }
    });
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
    const today = new Date();
    const tanggalFinal = tanggal || today.toISOString().slice(0, 10);
    const namaFinal = nama_customer || 'Tanpa Nama';
    const date = new Date(tanggalFinal);
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();

    const query = `
      INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const result = await pool.query(query, [
      tanggalFinal, namaFinal, deskripsi, ukuran || null, qty || null, bulan, tahun
    ]);
    const newRow = result.rows[0];

    io.emit('wo_created', newRow);
    console.log(`📡 [wo_created] dikirim ke ${io.engine.clientsCount} client`);
    res.status(201).json(newRow);
  } catch (err) {
    console.error('workorders POST error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// READ
app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year)
      return res.status(400).json({ message: 'Bulan & tahun wajib diisi.' });

    const sql = `
      SELECT * FROM work_orders
      WHERE bulan = $1 AND tahun = $2
      ORDER BY tanggal ASC, id ASC;
    `;
    const r = await pool.query(sql, [month, year]);
    res.json(r.rows);
  } catch (err) {
    console.error('❌ workorders GET error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: err.message });
  }
});

// UPDATE
app.patch('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const validCols = ['tanggal', 'nama_customer', 'deskripsi', 'ukuran', 'qty', 'harga'];

    const filtered = {};
    for (const [k, v] of Object.entries(updates))
      if (validCols.includes(k)) filtered[k] = v;

    if (!Object.keys(filtered).length)
      return res.status(400).json({ message: 'Tidak ada kolom valid.' });

    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(filtered)) {
      sets.push(`"${k}"=$${i++}`);
      vals.push(v);
    }
    vals.push(id);

    const sql = `
      UPDATE work_orders
      SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${i}
      RETURNING *;
    `;
    const result = await pool.query(sql, vals);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });

    const updated = result.rows[0];
    io.emit('wo_updated', updated);
    console.log(`📡 [wo_updated] dikirim ke ${io.engine.clientsCount} client`);
    res.json({ message: 'Berhasil diperbarui.', data: updated });
  } catch (err) {
    console.error('PATCH error', err);
    res.status(500).json({ message: 'Gagal memperbarui data.', error: err.message });
  }
});

// DELETE
app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('DELETE FROM work_orders WHERE id=$1 RETURNING *', [id]);
    if (r.rowCount === 0)
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });

    io.emit('wo_deleted', { id, row: r.rows[0] });
    console.log(`📡 [wo_deleted] dikirim untuk ID: ${id}`);
    res.status(204).send();
  } catch (err) {
    console.error('workorders DELETE error', err);
    res.status(500).json({ message: 'Gagal menghapus data.' });
  }
});

// ==========================================================
// ⚡ SOCKET.IO CONNECTION LOG
// ==========================================================
io.on('connection', (socket) => {
  console.log(`🟢 Socket client connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`🔴 Socket client disconnected: ${socket.id} (${reason})`);
  });
  socket.onAny((event, data) => {
    console.log(`📨 Event dari client: [${event}]`, data?.id || "");
  });
});

// ==========================================================
// 🌐 FALLBACK UNTUK FRONTEND
// ==========================================================
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, 'toto-frontend', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Frontend not found.');
});

// ==========================================================
// 🚀 START SERVER
// ==========================================================
httpServer.listen(PORT, () => {
  console.log(`🚀 Server & Socket.IO berjalan di port ${PORT}`);
  console.log(`📦 Database: ${DATABASE_URL ? '[connected]' : '[none]'}`);
});
