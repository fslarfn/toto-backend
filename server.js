// ==========================================================
// 🚀 SERVER.JS (FINAL VERSION — STABIL, REALTIME, PRODUKSI)
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

// ===================== Config / Env =====================
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci-rahasia-super-aman-untuk-toto-app';
const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL || 'postgresql://postgres:KiSLCzRPLsZzMivAVAVjzpEOBVTkCEHe@postgres.railway.internal:5432/railway';
const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB;

// ===================== Buat HTTP & Socket.IO Server =====================
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

// ===================== Middleware =====================
app.use(express.json());
app.options('*', cors());
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-access-token'],
}));

// ===================== Static Files =====================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'toto-frontend')));

// ===================== PostgreSQL Pool =====================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.on('error', (err) => console.error('Unexpected error on idle client', err));

// ===================== Multer Setup =====================
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

// ===================== Auth Middleware =====================
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

// ===================== ROUTES =====================

// ---------------- LOGIN ----------------
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

// ---------------- REFRESH TOKEN ----------------
app.post('/api/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Token wajib dikirim.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err && err.name === 'TokenExpiredError') {
        const payload = jwt.decode(token);
        const newToken = jwt.sign(
          { id: payload.id, username: payload.username, role: payload.role },
          JWT_SECRET,
          { expiresIn: '8h' }
        );
        console.log(`♻️ Token user ${payload.username} diperbarui.`);
        return res.json({ token: newToken });
      }
      if (err) return res.status(403).json({ message: 'Token tidak valid.' });
      res.json({ token });
    });
  } catch (err) {
    console.error('refresh token error', err);
    res.status(500).json({ message: 'Gagal memperbarui token.' });
  }
});

// ---------------- GET CURRENT USER ----------------
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, username, profile_picture_url, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (r.rows.length === 0)
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('/api/me error', err);
    res.status(500).json({ message: 'Error fetching user.' });
  }
});

// =============================================================
// 🚀 WORK ORDERS (CRUD + REALTIME BROADCAST)
// =============================================================

// CREATE WORK ORDER
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
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
    `;
    const result = await pool.query(query, [
      tanggalFinal, namaFinal, deskripsi, ukuran || null, qty || null, bulan, tahun
    ]);
    const newRow = result.rows[0];

    io.emit('wo_created', newRow);
    console.log("📡 Siaran [wo_created] terkirim.");

    res.status(201).json(newRow);
  } catch (err) {
    console.error('workorders POST error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// READ WORK ORDERS (By Month/Year)
app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    let { month, year, customer, status } = req.query;
    if (!month || !year)
      return res.status(400).json({ message: 'Bulan & tahun wajib diisi.' });

    let params = [month, year];
    let whereClauses = [];

    if (customer) {
      params.push(`%${customer}%`);
      whereClauses.push(`nama_customer ILIKE $${params.length}`);
    }
    if (status) {
      switch (status) {
        case 'belum_produksi':
          whereClauses.push(`(di_produksi = 'false' OR di_produksi IS NULL)`);
          break;
        case 'sudah_produksi':
          whereClauses.push(`di_produksi = 'true'`);
          break;
      }
    }

    let sql = `
      SELECT * FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `;
    if (whereClauses.length) sql += ' AND ' + whereClauses.join(' AND ');
    sql += ` ORDER BY tanggal ASC, id ASC`;

    const r = await pool.query(sql, params);
    const safeRows = (r.rows || []).filter(item => item && item.nama_customer !== null);
    res.json(safeRows);
  } catch (err) {
    console.error('❌ workorders GET error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: err.message });
  }
});

// UPDATE WORK ORDER (Autosave)
app.patch('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const validColumns = [
      'tanggal', 'nama_customer', 'deskripsi', 'ukuran', 'qty', 'harga',
      'no_inv', 'di_produksi', 'di_warna', 'siap_kirim', 'di_kirim',
      'pembayaran', 'ekspedisi'
    ];

    const filteredUpdates = {};
    for (const [key, val] of Object.entries(updates)) {
      if (validColumns.includes(key)) filteredUpdates[key] = val;
    }

    if (!Object.keys(filteredUpdates).length)
      return res.status(400).json({ message: 'Tidak ada kolom valid untuk diupdate.' });

    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [key, val] of Object.entries(filteredUpdates)) {
      setClauses.push(`"${key}" = $${i}`);
      values.push(val);
      i++;
    }
    values.push(id);

    const query = `
      UPDATE work_orders
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $${i}
      RETURNING *;
    `;
    const result = await pool.query(query, values);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });

    const updatedRow = result.rows[0];
    io.emit('wo_updated', updatedRow);
    console.log("📡 Siaran [wo_updated] terkirim.");

    res.json({ message: 'Data berhasil diperbarui.', data: updatedRow });
  } catch (err) {
    console.error('❌ PATCH /api/workorders/:id error:', err);
    res.status(500).json({ message: 'Gagal memperbarui data.', error: err.message });
  }
});

// DELETE WORK ORDER
app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('DELETE FROM work_orders WHERE id = $1 RETURNING *', [id]);
    if (r.rowCount === 0)
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });

    io.emit('wo_deleted', { id, row: r.rows[0] });
    console.log(`📡 Siaran [wo_deleted] terkirim untuk ID: ${id}`);
    res.status(204).send();
  } catch (err) {
    console.error('workorders DELETE error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// =============================================================
// SOCKET.IO LOGIC (Realtime Updates)
// =============================================================
io.on('connection', (socket) => {
  console.log(`🔌 User terhubung: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 User terputus: ${socket.id}`);
  });

  // 📡 Event listener utama
  socket.on('wo_created', (data) => {
    console.log("📡 Realtime: Work Order dibuat:", data.id || "(baru)");
    socket.broadcast.emit('wo_created', data);
  });

  socket.on('wo_updated', (data) => {
    console.log("📡 Realtime: Work Order diperbarui:", data.id);
    socket.broadcast.emit('wo_updated', data);
  });

  socket.on('wo_deleted', (data) => {
    console.log("📡 Realtime: Work Order dihapus:", data.id);
    socket.broadcast.emit('wo_deleted', data);
  });
});


// =============================================================
// Fallback untuk frontend (index.html)
// =============================================================
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, 'toto-frontend', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Frontend not found.');
});

// =============================================================
// Start Server
// =============================================================
httpServer.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`DATABASE_URL used: ${DATABASE_URL ? '[provided]' : '[none]'}`);
});
