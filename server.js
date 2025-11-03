// ==========================================================
// 🚀 SERVER.JS (VERSI FINAL - REALTIME SYNC FIXED)
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
const { Server } = require('socket.io');

// ==========================================================
// 🔧 KONFIGURASI DASAR
// ==========================================================
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci-rahasia-super-aman-untuk-toto-app';
const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL ||
  'postgresql://postgres:KiSLCzRPLsZzMivAVAVjzpEOBVTkCEHe@postgres.railway.internal:5432/railway';
const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB;

// ==========================================================
// ⚡ SOCKET.IO SERVER SETUP
// ==========================================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }
});

// Simpan io di app agar bisa diakses di semua route
app.set("io", io);

// ==========================================================
// 🧠 DATABASE CONNECTION POOL
// ==========================================================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
});

async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('🕒 Database time:', result.rows[0].current_time);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection FAILED:', err.message);
    return false;
  }
}

pool.on('connect', () => console.log('✅ New database connection established'));
pool.on('error', (err) => console.error('❌ Database pool error:', err.message));

// ==========================================================
// 🧱 MIDDLEWARE
// ==========================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-access-token'],
  credentials: true
}));

app.options('*', cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'toto-frontend')));

// ==========================================================
// 📦 MULTER (UPLOAD)
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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ==========================================================
// 🔐 AUTHENTICATE TOKEN
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
// 🌐 ENDPOINT AWAL (LOGIN, HEALTH, USER)
// ==========================================================

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testDatabaseConnection();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'Connected' : 'Disconnected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username dan password wajib diisi.' });

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (result.rows.length === 0)
      return res.status(401).json({ message: 'Username atau password salah!' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Username atau password salah!' });

    if (user.role !== 'admin' && user.subscription_status === 'inactive')
      return res.status(403).json({ message: 'Langganan Anda tidak aktif.' });

    const token = jwt.sign({
      id: user.id, username: user.username, role: user.role
    }, JWT_SECRET, { expiresIn: '8h' });

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
    console.error('❌ Login error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// Refresh token
app.post('/api/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Token wajib dikirim.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err && err.name === 'TokenExpiredError') {
        const payload = jwt.decode(token);
        const newToken = jwt.sign(
          { id: payload.id, username: payload.username, role: payload.role },
          JWT_SECRET, { expiresIn: '8h' });
        console.log(`♻️ Token user ${payload.username} diperbarui.`);
        return res.json({ token: newToken });
      }
      if (err) return res.status(403).json({ message: 'Token tidak valid.' });
      res.json({ token });
    });
  } catch (err) {
    console.error('❌ Refresh token error:', err);
    res.status(500).json({ message: 'Gagal memperbarui token.' });
  }
});

// Get current user
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, profile_picture_url, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ /api/me error:', err);
    res.status(500).json({ message: 'Error fetching user.' });
  }
});

// Update profile
app.put('/api/user/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const { username } = req.body;
    let profilePictureUrl = req.file ? `/uploads/${req.file.filename}` : null;
    let query, values;

    if (profilePictureUrl) {
      query = 'UPDATE users SET username=$1, profile_picture_url=$2 WHERE id=$3 RETURNING id, username, profile_picture_url';
      values = [username, profilePictureUrl, req.user.id];
    } else {
      query = 'UPDATE users SET username=$1 WHERE id=$2 RETURNING id, username, profile_picture_url';
      values = [username, req.user.id];
    }

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Update profile error:', err);
    res.status(500).json({ message: 'Gagal mengupdate profil.' });
  }
});

// Change password
app.put('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });

    const isMatch = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Password lama salah.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Password berhasil diubah.' });
  } catch (err) {
    console.error('❌ Change password error:', err);
    res.status(500).json({ message: 'Gagal mengubah password.' });
  }
});


// =============================================================
// 🚀 DASHBOARD ENDPOINT - RINGKAS & AMAN
// =============================================================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });

  const bulanInt = parseInt(month);
  const tahunInt = parseInt(year);
  if (isNaN(bulanInt) || isNaN(tahunInt)) return res.status(400).json({ message: 'Format bulan/tahun salah.' });

  const client = await pool.connect();
  try {
    const summaryResult = await client.query(`
      SELECT ukuran, qty, harga, nama_customer
      FROM work_orders WHERE bulan = $1 AND tahun = $2
    `, [bulanInt, tahunInt]);

    let totalRupiah = 0;
    const customers = new Set();

    summaryResult.rows.forEach(row => {
      const ukuran = parseFloat(row.ukuran) || 0;
      const qty = parseFloat(row.qty) || 0;
      const harga = parseFloat(row.harga) || 0;
      if (row.nama_customer) customers.add(row.nama_customer);
      totalRupiah += ukuran * qty * harga;
    });

    const statusResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE (di_produksi = 'false' OR di_produksi IS NULL)) AS belum_produksi,
        COUNT(*) FILTER (WHERE di_produksi = 'true' AND (di_warna = 'false' OR di_warna IS NULL)
                        AND (siap_kirim = 'false' OR siap_kirim IS NULL)
                        AND (di_kirim = 'false' OR di_kirim IS NULL)) AS sudah_produksi,
        COUNT(*) FILTER (WHERE di_warna = 'true' AND (siap_kirim = 'false' OR siap_kirim IS NULL)
                        AND (di_kirim = 'false' OR di_kirim IS NULL)) AS di_warna,
        COUNT(*) FILTER (WHERE siap_kirim = 'true' AND (di_kirim = 'false' OR di_kirim IS NULL)) AS siap_kirim,
        COUNT(*) FILTER (WHERE di_kirim = 'true') AS di_kirim
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `, [bulanInt, tahunInt]);

    res.json({
      success: true,
      summary: {
        total_rupiah: totalRupiah,
        total_customer: customers.size
      },
      statusCounts: {
        belum_produksi: parseInt(statusResult.rows[0]?.belum_produksi || 0),
        sudah_produksi: parseInt(statusResult.rows[0]?.sudah_produksi || 0),
        di_warna: parseInt(statusResult.rows[0]?.di_warna || 0),
        siap_kirim: parseInt(statusResult.rows[0]?.siap_kirim || 0),
        di_kirim: parseInt(statusResult.rows[0]?.di_kirim || 0)
      }
    });
  } catch (err) {
    console.error("❌ DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Gagal mengambil data dashboard." });
  } finally {
    client.release();
  }
});

// =============================================================
// 🧾 WORK ORDERS - REALTIME CRUD
// =============================================================

// CREATE Work Order
app.post("/api/workorders", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const io = req.app.get("io");

  try {
    const {
      tanggal, nama_customer, deskripsi,
      ukuran, qty, harga, bulan, tahun, socketId
    } = req.body;

    const updated_by = req.user?.username || "admin";
    if (!nama_customer || !deskripsi)
      return res.status(400).json({ message: "Nama customer dan deskripsi wajib diisi." });

    const query = `
      INSERT INTO work_orders
        (tanggal, nama_customer, deskripsi, ukuran, qty, harga, bulan, tahun, updated_by)
      VALUES
        ($1,$2,$3,
        COALESCE(NULLIF($4::text, '')::numeric, 0),
        COALESCE(NULLIF($5::text, '')::numeric, 0),
        COALESCE(NULLIF($6::text, '')::numeric, 0),
        $7,$8,$9)
      RETURNING *;
    `;
    const values = [
      tanggal || new Date(),
      nama_customer.trim(),
      deskripsi.trim(),
      ukuran || 0, qty || 0, harga || 0,
      bulan || new Date().getMonth() + 1,
      tahun || new Date().getFullYear(),
      updated_by
    ];

    const result = await client.query(query, values);
    const newRow = result.rows[0];

    // ⚡ Realtime broadcast ke semua client lain
    if (socketId && io.sockets.sockets.has(socketId)) {
      const socket = io.sockets.sockets.get(socketId);
      socket.broadcast.emit("wo:new", newRow);
    } else {
      io.emit("wo:new", newRow);
    }

    console.log(`✅ Work Order baru dibuat oleh ${updated_by}`);
    res.json(newRow);
  } catch (err) {
    console.error("❌ Gagal tambah WO:", err);
    res.status(500).json({ message: "Gagal menambah Work Order." });
  } finally {
    client.release();
  }
});

// UPDATE Work Order
app.patch("/api/workorders/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const io = req.app.get("io");

  try {
    const id = req.params.id;
    const { socketId, ...data } = req.body;
    const updated_by = req.user?.username || "admin";

    if (!id || isNaN(parseInt(id)))
      return res.status(400).json({ message: "ID Work Order tidak valid." });

    const fields = Object.keys(data);
    if (fields.length === 0)
      return res.status(400).json({ message: "Tidak ada data untuk diperbarui." });

    const setQuery = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const query = `
      UPDATE work_orders SET ${setQuery}, updated_by = $${fields.length + 1}
      WHERE id = $${fields.length + 2}
      RETURNING *;
    `;
    const values = [...Object.values(data), updated_by, id];
    const result = await client.query(query, values);
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Work Order tidak ditemukan." });

    const updatedRow = result.rows[0];

    // ⚡ Emit realtime update
    if (socketId && io.sockets.sockets.has(socketId)) {
      const socket = io.sockets.sockets.get(socketId);
      socket.broadcast.emit("wo:update", updatedRow);
    } else {
      io.emit("wo:update", updatedRow);
    }

    res.json(updatedRow);
  } catch (err) {
    console.error("❌ Gagal update WO:", err);
    res.status(500).json({ message: "Gagal update Work Order." });
  } finally {
    client.release();
  }
});

// DELETE Work Order
app.delete("/api/workorders/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  const io = req.app.get("io");

  try {
    const id = req.params.id;
    const { socketId } = req.body || {};
    const updated_by = req.user?.username || "admin";

    const check = await client.query("SELECT * FROM work_orders WHERE id = $1", [id]);
    if (check.rows.length === 0)
      return res.status(404).json({ message: "Work Order tidak ditemukan." });

    await client.query("DELETE FROM work_orders WHERE id = $1", [id]);
    console.log(`🗑️ Work Order ${id} dihapus oleh ${updated_by}`);

    // ⚡ Broadcast realtime delete
    if (socketId && io.sockets.sockets.has(socketId)) {
      const socket = io.sockets.sockets.get(socketId);
      socket.broadcast.emit("wo:delete", { id });
    } else {
      io.emit("wo:delete", { id });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error("❌ Gagal hapus WO:", err);
    res.status(500).json({ message: "Gagal menghapus Work Order." });
  } finally {
    client.release();
  }
});

// =============================================================
// 📦 STATUS BARANG + CHUNK DATA (10000 row support)
// =============================================================
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  try {
    const { month, year, page = 1, size = 10000 } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Bulan & tahun wajib diisi.' });

    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);
    const offset = (parseInt(page) - 1) * parseInt(size);

    const query = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
             di_produksi, di_warna, siap_kirim, di_kirim,
             no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
      ORDER BY id ASC LIMIT $3 OFFSET $4;
    `;
    const result = await pool.query(query, [bulanInt, tahunInt, size, offset]);
    const count = await pool.query(`SELECT COUNT(*) FROM work_orders WHERE bulan=$1 AND tahun=$2`, [bulanInt, tahunInt]);
    const total = parseInt(count.rows[0].count);
    res.json({
      data: result.rows,
      current_page: parseInt(page),
      last_page: Math.ceil(total / size),
      total
    });
  } catch (err) {
    console.error("❌ /api/workorders/chunk error:", err);
    res.status(500).json({ message: "Gagal memuat data Work Order." });
  }
});

// Status Barang Page
app.get('/api/status-barang', authenticateToken, async (req, res) => {
  try {
    let { customer, month, year } = req.query;
    if (!month || !year)
      return res.status(400).json({ message: 'Bulan dan tahun wajib diisi.' });

    const params = [parseInt(month), parseInt(year)];
    let where = `WHERE bulan=$1 AND tahun=$2`;
    if (customer && customer.trim() !== '') {
      params.push(`%${customer.trim()}%`);
      where += ` AND LOWER(nama_customer) LIKE LOWER($${params.length})`;
    }

    const result = await pool.query(`
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
             di_produksi, di_warna, siap_kirim, di_kirim,
             no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders ${where}
      ORDER BY tanggal ASC, id ASC;
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ /api/status-barang error:", err);
    res.status(500).json({ message: 'Gagal mengambil data status barang.' });
  }
});

// =============================================================
// ⚡ SOCKET.IO REACTIONS
// =============================================================
io.on("connection", (socket) => {
  console.log("🔗 Socket connected:", socket.id);

  socket.on("wo:new", (data) => console.log("📩 New WO received", data?.id));
  socket.on("wo:update", (data) => console.log("♻️ WO updated", data?.id));
  socket.on("wo:delete", (data) => console.log("🗑️ WO deleted", data?.id));

  socket.on("disconnect", () => console.log("❌ Socket disconnected:", socket.id));
});

// =============================================================
// 🔗 Pasang Socket.IO ke app supaya endpoint bisa akses `io`
// =============================================================
app.set("io", io);

// =============================================================
// ⚡ SOCKET.IO — HANDLER LEBIH LENGKAP (Realtime untuk semua clients)
// =============================================================
io.on("connection", (socket) => {
  console.log("🔗 Socket connected:", socket.id);

  // Client memberi tahu server ID socket agar server bisa exclude pengirim saat broadcast
  socket.on("identify", (payload) => {
    // payload can contain userId or token etc. we just log for debug
    console.log(`🆔 Socket identify from ${socket.id}:`, payload);
  });

  // Client manual sync (fallback)
  socket.on("wo_sync", (data) => {
    console.log("🔄 Manual WO sync from", socket.id, data?.id);
    // broadcast to everyone except sender
    socket.broadcast.emit("workorder:sync", data);
  });

  // Optional: client may emit when they created a new WO locally (if you want server-to-server flow)
  socket.on("workorder:new", (payload) => {
    console.log("📥 workorder:new from socket:", socket.id, payload?.id);
    // broadcast to others
    socket.broadcast.emit("workorder:new", payload);
  });

  socket.on("workorder:update", (payload) => {
    console.log("♻️ workorder:update from socket:", socket.id, payload?.id);
    socket.broadcast.emit("workorder:update", payload);
  });

  socket.on("workorder:delete", (payload) => {
    console.log("🗑️ workorder:delete from socket:", socket.id, payload?.id);
    socket.broadcast.emit("workorder:delete", payload);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", socket.id, reason);
  });
});

// =============================================================
// 🚨 GLOBAL ERROR HANDLING (Tambahan safety & logging)
// =============================================================

// Capture unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Capture uncaught exceptions (log then exit to avoid corrupted state)
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // If you prefer graceful restart, consider external process manager (pm2, docker restartPolicy, systemd)
  process.exit(1);
});

// =============================================================
// ✅ START SERVER (Pastikan DB OK sebelum listen)
// =============================================================
async function startServer() {
  try {
    console.log('🔌 Testing database connection before starting server...');
    const dbOK = await testDatabaseConnection();

    if (!dbOK) {
      console.error('❌ Database tidak tersedia. Server tidak dijalankan.');
      process.exit(1);
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server + Socket.IO listening on port ${PORT}`);
      console.log(`📦 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 JWT secret: ${JWT_SECRET ? 'present' : 'missing'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

// =============================================================
// 📌 OPTIONAL: graceful shutdown handlers (helpful for deployments)
// =============================================================
async function gracefulShutdown() {
  try {
    console.log('🛑 Graceful shutdown initiated...');
    // close socket server
    io.close(() => console.log('🔗 Socket.IO closed'));
    // close http server
    server.close(() => console.log('🛑 HTTP server closed'));
    // close DB pool
    await pool.end();
    console.log('💤 DB pool closed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

