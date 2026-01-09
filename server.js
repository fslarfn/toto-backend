// ==========================================================
// 🚀 SERVER.JS (VERSI FINAL - SURAT JALAN LOG FIXED)
// ==========================================================

const express = require('express');
require('dotenv').config();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// ===================== TAMBAHAN SOCKET.IO =====================
const http = require('http');
const { Server } = require("socket.io");
// ========================================================

// ===================== Config / Env =====================
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci-rahasia-super-aman-untuk-toto-app';

const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL || 'postgresql://postgres:KiSLCzRPLsZzMivAVAVjzpEOBVTkCEHe@postgres.railway.internal:5432/railway';
const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB;

// ===================== BUAT HTTP SERVER & SOCKET.IO SERVER =====================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
// ==============================================================================

// ===================== Enhanced Postgres Pool =====================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');

    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database time:', result.rows[0].current_time);

    client.release();
    return true;
  } catch (err) {
    console.error('❌ Database connection FAILED:', err.message);
    return false;
  }
}

pool.on('connect', () => {
  console.log('✅ New database connection established');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

// ===================== Middleware =====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-access-token'],
  credentials: true
}));

app.options('*', cors());

// ===================== Static Files =====================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'toto-frontend')));

// ===================== Multer setup =====================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uid = (req.user && req.user.id) ? req.user.id : 'anon';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uid}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ===================== Auth middleware =====================
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    if (!token) {
      return res.status(401).json({ message: 'Token tidak ditemukan.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error('❌ JWT VERIFY GAGAL:', err.name, err.message);
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ message: 'EXPIRED' });
        }
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

// ===================== Global Error Handler Middleware =====================
app.use((error, req, res, next) => {
  console.error('🚨 Global Error Handler:', error);
  res.status(500).json({
    message: 'Terjadi kesalahan internal server',
    error: process.env.NODE_ENV === 'development' ? error.message : {}
  });
});

// ===================== Routes =====================

// -- Health Check
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

// -- Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password wajib diisi.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Username atau password salah!' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Username atau password salah!' });
    }

    // Cek langganan
    if (user.role !== 'admin' && user.subscription_status === 'inactive') {
      return res.status(403).json({ message: 'Langganan Anda tidak aktif.' });
    }

    const token = jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role
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

// -- Refresh token
app.post('/api/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(401).json({ message: 'Token wajib dikirim.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      // Jika token expired, buatkan yang baru
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
      // Jika token tidak valid (bukan expired), tolak
      if (err) {
        return res.status(403).json({ message: 'Token tidak valid.' });
      }

      // Jika token masih valid, kirim balik token yang sama
      res.json({ token });
    });
  } catch (err) {
    console.error('❌ Refresh token error:', err);
    res.status(500).json({ message: 'Gagal memperbarui token.' });
  }
});

// -- Get current user
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, profile_picture_url, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ /api/me error:', err);
    res.status(500).json({ message: 'Error fetching user.' });
  }
});

// -- Update profile
app.put('/api/user/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    console.log('📝 Update profile request:', req.body);
    console.log('📂 Uploaded file:', req.file);

    const { username } = req.body;
    let profilePictureUrl = null;

    if (req.file) {
      profilePictureUrl = `/uploads/${req.file.filename}`;
    }

    let result;
    if (profilePictureUrl) {
      result = await pool.query(
        'UPDATE users SET username = $1, profile_picture_url = $2 WHERE id = $3 RETURNING id, username, profile_picture_url',
        [username, profilePictureUrl, req.user.id]
      );
    } else {
      result = await pool.query(
        'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, profile_picture_url',
        [username, req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Update profile error:', err);
    res.status(500).json({ message: 'Gagal mengupdate profil.' });
  }
});

// -- Change password
app.post('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    const isMatch = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password lama salah.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, req.user.id]);

    res.json({ message: 'Password berhasil diubah.' });
  } catch (err) {
    console.error('❌ Change password error:', err);
    res.status(500).json({ message: 'Gagal mengubah password.' });
  }
});

// =============================================================
// 🚀 ENDPOINTS KONTEN UTAMA (WORK ORDERS, DASHBOARD) + DP & DISKON
// =============================================================

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
  }

  const bulanInt = parseInt(month);
  const tahunInt = parseInt(year);

  if (isNaN(bulanInt) || isNaN(tahunInt) || bulanInt < 1 || bulanInt > 12) {
    return res.status(400).json({ message: 'Bulan dan tahun harus valid.' });
  }

  const client = await pool.connect();

  try {
    // =============================================
    // 1. FINANCE (Dari tabel keuangan)
    // =============================================
    const financeQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipe = 'PEMASUKAN' THEN jumlah ELSE 0 END), 0) as pemasukan,
        COALESCE(SUM(CASE WHEN tipe = 'PENGELUARAN' THEN jumlah ELSE 0 END), 0) as pengeluaran
      FROM keuangan
      WHERE EXTRACT(MONTH FROM tanggal) = $1 AND EXTRACT(YEAR FROM tanggal) = $2
    `;
    const financeRes = await client.query(financeQuery, [bulanInt, tahunInt]);
    const pemasukan = Number(financeRes.rows[0].pemasukan);
    const pengeluaran = Number(financeRes.rows[0].pengeluaran);
    const profit = pemasukan - pengeluaran;

    // =============================================
    // 2. PRODUCTION (Dari work_orders)
    // =============================================
    const statusQuery = `
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
      WHERE bulan = $1 AND tahun = $2;
    `;
    const statusResult = await client.query(statusQuery, [bulanInt, tahunInt]);
    const statusRow = statusResult.rows[0];

    // =============================================
    // 3. INVENTORY (Low Stock < 10)
    // =============================================
    const stockQuery = `SELECT COUNT(*) as low_stock FROM stok_bahan WHERE stok < 10`;
    const stockRes = await client.query(stockQuery);
    const lowStockCount = parseInt(stockRes.rows[0].low_stock);

    // =============================================
    // FINAL RESPONSE STRUCTURE (Matches app.js expectation)
    // =============================================
    res.json({
      finance: {
        pemasukan: pemasukan,
        pengeluaran: pengeluaran,
        profit: profit
      },
      production: {
        belum_produksi: parseInt(statusRow.belum_produksi || 0),
        sedang_produksi: parseInt(statusRow.sudah_produksi || 0), // Frontend maps 'sudah_produksi' to 'sedang_produksi' UI? Let's check keys logic if needed, but app.js just renders counts usually.
        di_warna: parseInt(statusRow.di_warna || 0),
        siap_kirim: parseInt(statusRow.siap_kirim || 0),
        sudah_dikirim: parseInt(statusRow.di_kirim || 0)
      },
      inventory: {
        low_stock: lowStockCount
      }
    });

  } catch (err) {
    console.error("❌ DASHBOARD ERROR:", err.message);
    res.status(500).json({ message: "Gagal mengambil data dashboard." });
  } finally {
    client.release();
  }
});

// =============================================================
// 📋 GET WORK ORDERS CHUNK (Dashboard List Data) - NEW FIXED
// =============================================================
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
  }

  const bulanInt = parseInt(month);
  const tahunInt = parseInt(year);

  if (isNaN(bulanInt) || isNaN(tahunInt) || bulanInt < 1 || bulanInt > 12) {
    return res.status(400).json({ message: 'Bulan dan tahun harus valid.' });
  }

  const client = await pool.connect();
  try {
    const query = `
      SELECT *
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
      ORDER BY id ASC
    `;

    const result = await client.query(query, [bulanInt, tahunInt]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("❌ GET /workorders/chunk Error:", err.message);
    res.status(500).json({ message: "Gagal mengambil data work orders." });
  } finally {
    client.release();
  }
});

// =============================================================
// 💰 INVOICE PAYMENT UPDATE (DP & DISKON PER INVOICE) — VALIDASI PILIHAN B
// =============================================================
app.patch('/api/invoice/payment', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { invoice_no, dp_amount, discount, socketId } = req.body;

    if (!invoice_no) {
      return res.status(400).json({ message: "Nomor invoice wajib dikirim." });
    }

    const dp = parseFloat(dp_amount) || 0;
    const disc = parseFloat(discount) || 0;

    if (dp < 0 || disc < 0) {
      return res.status(400).json({ message: "DP atau Diskon tidak boleh negatif." });
    }

    // 1️⃣ Ambil semua WO berdasarkan nomor invoice
    const result = await client.query(
      `SELECT * FROM work_orders WHERE no_inv = $1 ORDER BY id ASC`,
      [invoice_no]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Invoice tidak ditemukan." });
    }

    // 2️⃣ Hitung total invoice
    let totalInvoice = 0;
    result.rows.forEach(r => {
      const ukuran = parseFloat(r.ukuran) || 0;
      const qty = parseFloat(r.qty) || 0;
      const harga = parseFloat(r.harga) || 0;
      totalInvoice += ukuran * qty * harga;
    });

    // 3️⃣ Validasi sesuai pilihan B
    if (disc > totalInvoice) {
      return res.status(400).json({ message: "Diskon tidak boleh melebihi total invoice." });
    }

    const totalAfterDiscount = totalInvoice - disc;
    if (dp > totalAfterDiscount) {
      return res.status(400).json({ message: "DP tidak boleh melebihi total setelah diskon." });
    }

    await client.query('BEGIN');

    const updatedData = [];
    const updated_by = req.user?.username || "admin";

    // 4️⃣ Update semua WO dalam invoice
    for (const row of result.rows) {
      const updateRes = await client.query(
        `UPDATE work_orders
         SET dp_amount = $1,
             discount = $2,
             updated_at = NOW(),
             updated_by = $3
         WHERE id = $4
         RETURNING *`,
        [dp, disc, updated_by, row.id]
      );

      const updatedRow = updateRes.rows[0];

      // hitung ulang calculated fields
      const ukuran = parseFloat(updatedRow.ukuran) || 0;
      const qty = parseFloat(updatedRow.qty) || 0;
      const harga = parseFloat(updatedRow.harga) || 0;

      updatedRow.subtotal = ukuran * qty * harga;
      updatedRow.total = updatedRow.subtotal - disc;
      updatedRow.remaining_payment = updatedRow.total - dp;

      updatedData.push(updatedRow);

      // emit realtime
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        socket ? socket.broadcast.emit("wo_updated", updatedRow) : io.emit("wo_updated", updatedRow);
      } else {
        io.emit("wo_updated", updatedRow);
      }
    }

    // 5️⃣ AUTO-RECORD TO KEUANGAN (FEATURE 1)
    // If user opted to record this payment to finance logic
    const { addToFinance, totalDpPaid } = req.body;
    if (addToFinance && totalDpPaid > 0) {
      await insertKeuanganTransaction(client, {
        tanggal: new Date(),
        jumlah: totalDpPaid, // Use the total amount sent from frontend
        tipe: 'PEMASUKAN',
        kas_id: 1, // Default to BCA Toto (or make this selectable later)
        keterangan: `Pembayaran DP Invoice ${invoice_no}`
      });
      console.log(`💰 Auto-recorded finance income: ${totalDpPaid} for Inv ${invoice_no}`);
    }

    await client.query('COMMIT');
    res.json({
      message: "DP & Diskon berhasil diterapkan ke semua Work Order dalam invoice.",
      updated: updatedData,
      totalInvoice,
      totalAfterDiscount
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Error invoice payment:", err);
    res.status(500).json({ message: "Gagal memperbarui DP & Diskon pada invoice.", error: err.message });
  } finally {
    client.release();
  }
});

// =============================================================
// 💰 FITUR KASBON KARYAWAN (Histori + Pembayaran Otomatis)
// =============================================================

// =============================================================
// GET - Ambil histori kasbon karyawan
// =============================================================
app.get('/api/karyawan/:id/kasbon', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, tanggal, jenis, nominal, keterangan 
       FROM kasbon_log 
       WHERE karyawan_id = $1 
       ORDER BY tanggal DESC, id DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Gagal ambil histori kasbon:', err);
    res.status(500).json({ message: 'Gagal mengambil histori kasbon' });
  }
});

// =============================================================
// POST - Tambah kasbon baru (✅ versi stabil & realtime)
// =============================================================
app.post('/api/karyawan/:id/kasbon', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nominal, keterangan } = req.body;

    // Validasi input
    if (!nominal || isNaN(nominal) || nominal <= 0) {
      return res.status(400).json({ message: 'Nominal kasbon tidak valid.' });
    }

    await client.query('BEGIN');

    // 1️⃣ Tambahkan histori kasbon
    await client.query(
      `INSERT INTO kasbon_log (karyawan_id, nominal, jenis, keterangan)
       VALUES ($1, $2, 'PINJAM', $3)`,
      [id, nominal, keterangan || '-']
    );

    // 2️⃣ Tambahkan total kasbon di tabel karyawan
    await client.query(
      `UPDATE karyawan 
       SET kasbon = COALESCE(kasbon, 0) + $1, updated_at = NOW()
       WHERE id = $2`,
      [nominal, id]
    );

    // 3️⃣ Ambil data karyawan terbaru setelah update
    const updatedKaryawan = await client.query(
      `SELECT * FROM karyawan WHERE id = $1`,
      [id]
    );

    // 4️⃣ AUTO-RECORD TO KEUANGAN (FEATURE 1)
    // Otomatis catat sebagai Pengeluaran
    await insertKeuanganTransaction(client, {
      tanggal: new Date(),
      jumlah: nominal,
      tipe: 'PENGELUARAN',
      kas_id: 3, // Default Cash
      keterangan: `Kasbon Karyawan: ${updatedKaryawan.rows[0].nama_karyawan} (${keterangan || '-'})`
    });

    await client.query('COMMIT');

    // 4️⃣ Kirim realtime update ke semua client
    if (io && io.emit) {
      io.emit('karyawan:update', updatedKaryawan.rows[0]);
    }

    // 5️⃣ Kirim response ke client (pakai return agar tidak double send)
    return res.json({
      message: 'Kasbon berhasil ditambahkan',
      updatedKaryawan: updatedKaryawan.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal tambah kasbon:', err);
    res.status(500).json({ message: 'Gagal menambah kasbon', error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================================
// 📜 SURAT JALAN LOG ENDPOINTS - VERSI FINAL (TANPA DUPLIKASI)
// ==========================================================

// ==========================================================
// 📜 GET: SURAT JALAN LOG (Riwayat Surat Jalan) - SATU VERSI
// ==========================================================
app.get("/api/suratjalan-log", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { vendor } = req.query;

    console.log(`🔍 Loading surat jalan log, filter vendor: ${vendor || 'ALL'}`);

    let query = `
      SELECT 
        id, 
        tipe, 
        no_sj, 
        tanggal,
        vendor, 
        customer, 
        no_invoice, 
        total_item, 
        total_qty, 
        catatan, 
        dibuat_oleh, 
        dibuat_pada,
        items
      FROM surat_jalan_log
    `;
    const values = [];

    if (vendor && vendor.trim() !== "") {
      query += ` WHERE vendor ILIKE $1`;
      values.push(`%${vendor.trim()}%`);
    }

    query += ` ORDER BY dibuat_pada DESC LIMIT 200`;

    console.log(`📋 Executing query: ${query}`);

    const result = await client.query(query, values);

    // Parse items dari JSON string ke object
    const formattedRows = result.rows.map(row => ({
      ...row,
      items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items
    }));

    console.log(`✅ Loaded ${formattedRows.length} surat jalan log entries`);

    res.status(200).json(formattedRows);
  } catch (err) {
    console.error("❌ Gagal load surat jalan log:", err);
    res.status(500).json({
      message: "Gagal memuat data surat jalan log",
      error: err.message
    });
  } finally {
    client.release();
  }
});

// ==========================================================
// 🧾 POST: SIMPAN LOG SURAT JALAN (Customer / Vendor) - SATU VERSI
// ==========================================================
app.post("/api/suratjalan-log", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      tipe,
      vendor,
      customer,
      no_invoice,
      items,
      total_item,
      total_qty,
      catatan,
      dibuat_oleh
    } = req.body;

    console.log(`💾 Saving surat jalan log:`, {
      tipe,
      vendor: vendor?.substring(0, 50),
      customer: customer?.substring(0, 50),
      itemCount: items?.length
    });

    // Validasi
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Data items surat jalan tidak valid." });
    }

    // Generate nomor surat jalan
    const no_sj_prefix = tipe === "VENDOR" ? "SJW" : "SJC";
    const date = new Date();
    const no_sj = `${no_sj_prefix}-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}-${Date.now()}`;

    const user_dibuat_oleh = dibuat_oleh || req.user?.username || "admin";

    await client.query("BEGIN");

    const query = `
      INSERT INTO surat_jalan_log
      (tipe, no_sj, vendor, customer, no_invoice, total_item, total_qty, catatan, dibuat_oleh, dibuat_pada, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10)
      RETURNING *;
    `;

    const values = [
      tipe || "VENDOR",
      no_sj,
      vendor || "-",
      customer || "-",
      no_invoice || "-",
      total_item || items.length,
      total_qty || items.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0),
      catatan || "-",
      user_dibuat_oleh,
      JSON.stringify(items),
    ];

    const result = await client.query(query, values);
    const savedLog = result.rows[0];

    // ✅ Jika surat jalan VENDOR, ubah status di_warna = true
    if (tipe === "VENDOR") {
      const itemIds = items.map(i => i.id).filter(Boolean);
      if (itemIds.length > 0) {
        console.log(`🔄 Updating ${itemIds.length} work orders to di_warna = true`);

        await client.query(
          `UPDATE work_orders 
           SET di_warna = 'true', updated_at = NOW(), updated_by = $1 
           WHERE id = ANY($2::int[])`,
          [user_dibuat_oleh, itemIds]
        );

        // Get updated work orders untuk real-time broadcast
        const updatedResult = await client.query(
          `SELECT * FROM work_orders WHERE id = ANY($1::int[])`,
          [itemIds]
        );

        // Broadcast real-time updates
        updatedResult.rows.forEach(updatedRow => {
          io.emit('wo_updated', updatedRow);
        });
      }
    }

    await client.query("COMMIT");

    // Parse items untuk response
    savedLog.items = typeof savedLog.items === 'string' ? JSON.parse(savedLog.items) : savedLog.items;

    console.log(`✅ Surat Jalan Log berhasil disimpan: ${no_sj} (ID: ${savedLog.id})`);

    // Kirim realtime update untuk surat jalan log
    io.emit('suratjalan:new', savedLog);

    res.status(201).json(savedLog);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Gagal simpan surat jalan log:", err);
    res.status(500).json({
      message: "Gagal menyimpan surat jalan log",
      error: err.message
    });
  } finally {
    client.release();
  }
});

// ==========================================================
// 🔍 GET: DETAIL SURAT JALAN LOG BY ID
// ==========================================================
app.get("/api/suratjalan-log/:id", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM surat_jalan_log WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "Log tidak ditemukan" });

    // Parse items dari JSON string
    const log = rows[0];
    log.items = typeof log.items === 'string' ? JSON.parse(log.items) : log.items;

    res.json(log);
  } catch (err) {
    console.error("❌ Gagal load detail surat jalan log:", err);
    res.status(500).json({ message: "Gagal memuat detail surat jalan log" });
  }
});

// =============================================================
// PUT - Proses potongan kasbon otomatis saat penggajian
// =============================================================
app.put('/api/karyawan/:id/potong-gaji', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { potongan } = req.body; // potongan kasbon per periode gaji

    await client.query('BEGIN');

    const karyawanRes = await client.query('SELECT kasbon FROM karyawan WHERE id=$1', [id]);
    if (karyawanRes.rows.length === 0) throw new Error('Karyawan tidak ditemukan');

    const kasbonSekarang = parseFloat(karyawanRes.rows[0].kasbon || 0);
    const potonganFinal = Math.min(kasbonSekarang, potongan);

    if (potonganFinal > 0) {
      // Catat ke log
      await client.query(
        `INSERT INTO kasbon_log (karyawan_id, nominal, jenis, keterangan)
         VALUES ($1, $2, 'BAYAR', 'Potongan otomatis dari gaji')`,
        [id, potonganFinal]
      );

      // Kurangi dari total kasbon
      await client.query(
        `UPDATE karyawan SET kasbon = kasbon - $1, updated_at = NOW() WHERE id = $2`,
        [potonganFinal, id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Potongan kasbon berhasil diterapkan', potongan: potonganFinal });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Gagal potong kasbon:', err);
    res.status(500).json({ message: 'Gagal memproses potongan kasbon' });
  } finally {
    client.release();
  }
});



// =============================================================
// ✏️ UPDATE WORK ORDER (PATCH /api/workorders/:id) - DENGAN DP & DISKON
// =============================================================
app.patch('/api/workorders/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'ID Work Order tidak valid.' });
    }

    const allowed = [
      "tanggal", "nama_customer", "deskripsi", "ukuran", "qty", "harga",
      "dp_amount", "discount",
      "di_produksi", "di_warna", "siap_kirim", "di_kirim", "pembayaran",
      "no_inv", "ekspedisi", "bulan", "tahun", "selected"
    ];

    const payload = req.body || {};
    const fields = Object.keys(payload).filter(k => allowed.includes(k));
    if (fields.length === 0) {
      return res.status(400).json({ message: 'Tidak ada kolom valid untuk diperbarui.' });
    }

    // Convert numeric/boolean to safe values
    const values = [];
    const setParts = [];
    fields.forEach((f, idx) => {
      let val = payload[f];

      // Handle boolean fields
      if (["di_produksi", "di_warna", "siap_kirim", "di_kirim", "pembayaran"].includes(f)) {
        if (val === true || val === 'true' || val === '1' || val === 1) {
          val = 'true';
        } else {
          val = 'false';
        }
      }

      // Handle numeric fields
      if (["qty", "harga", "dp_amount", "discount"].includes(f)) {
        if (val === '' || val === null || val === undefined) val = null;
        else val = isNaN(Number(val)) ? null : Number(val);
      }

      // Untuk ukuran (character varying), simpan sebagai string
      if (f === "ukuran") {
        if (val === '' || val === null || val === undefined) val = "0";
        else val = String(val);
      }

      values.push(val);
      setParts.push(`${f} = $${values.length}`);
    });

    // add updated_at and updated_by
    const updated_by = req.user?.username || 'admin';
    values.push(new Date());
    setParts.push(`updated_at = $${values.length}`);
    values.push(updated_by);
    setParts.push(`updated_by = $${values.length}`);

    // where id
    values.push(id);
    const whereIndex = values.length;

    const query = `UPDATE work_orders SET ${setParts.join(', ')} WHERE id = $${whereIndex} RETURNING *`;
    const result = await client.query(query, values);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Work Order tidak ditemukan.' });

    const updatedRow = result.rows[0];

    // Hitung manual di JavaScript karena ukuran adalah character varying
    const ukuran = parseFloat(updatedRow.ukuran) || 0;
    const qty = parseFloat(updatedRow.qty) || 0;
    const harga = parseFloat(updatedRow.harga) || 0;
    const dp = parseFloat(updatedRow.dp_amount) || 0;
    const discount = parseFloat(updatedRow.discount) || 0;

    updatedRow.subtotal = ukuran * qty * harga;
    updatedRow.total = updatedRow.subtotal - discount;
    updatedRow.remaining_payment = updatedRow.total - dp;

    // realtime update
    io.emit('wo_updated', updatedRow);

    console.log(`✅ Work Order ${id} updated:`, {
      di_produksi: updatedRow.di_produksi,
      di_warna: updatedRow.di_warna,
      dp_amount: updatedRow.dp_amount,
      discount: updatedRow.discount
    });

    res.json(updatedRow);
  } catch (err) {
    console.error('❌ PATCH workorders error:', err);
    res.status(500).json({ message: 'Gagal memperbarui Work Order.', error: err.message });
  } finally {
    client.release();
  }
});

// -- Tambah Work Order Baru - DENGAN DP & DISKON
app.post("/api/workorders", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      tanggal,
      nama_customer,
      deskripsi,
      ukuran, // ini akan disimpan sebagai character varying
      qty,
      harga,
      dp_amount,
      discount,
      bulan,
      tahun,
      socketId
    } = req.body;

    const updated_by = req.user?.username || "admin";

    if (!nama_customer || !deskripsi) {
      return res.status(400).json({ message: "Nama customer dan deskripsi wajib diisi." });
    }

    // ✅ Konversi aman untuk numeric
    // Untuk ukuran, kita simpan sebagai text tapi juga validasi sebagai number
    const safeUkuran = ukuran === "" || ukuran === null ? "0" : String(ukuran);
    const safeQty = qty === "" || qty === null ? 0 : Number(qty);
    const safeHarga = harga === "" || harga === null ? 0 : Number(harga);
    const safeDP = dp_amount === "" || dp_amount === null ? 0 : Number(dp_amount);
    const safeDiscount = discount === "" || discount === null ? 0 : Number(discount);

    const query = `
      INSERT INTO work_orders
        (tanggal, nama_customer, deskripsi, ukuran, qty, harga, dp_amount, discount, bulan, tahun, updated_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;

    const values = [
      tanggal || new Date(),
      nama_customer.trim(),
      deskripsi.trim(),
      safeUkuran, // disimpan sebagai text
      safeQty,
      safeHarga,
      safeDP,
      safeDiscount,
      bulan || new Date().getMonth() + 1,
      tahun || new Date().getFullYear(),
      updated_by
    ];

    const result = await client.query(query, values);
    const newRow = result.rows[0];

    // Hitung calculated fields di JavaScript
    const ukuranNum = parseFloat(safeUkuran) || 0;
    const subtotal = ukuranNum * safeQty * safeHarga;
    const total = subtotal - safeDiscount;
    const remaining_payment = total - safeDP;

    newRow.subtotal = subtotal;
    newRow.total = total;
    newRow.remaining_payment = remaining_payment;

    // =====================================================
    // ⚡ EMIT SOCKET.IO — Realtime ke semua client lain
    // =====================================================
    if (io && io.sockets) {
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.broadcast.emit("workorder:new", newRow);
        } else {
          io.emit("workorder:new", newRow);
        }
      } else {
        io.emit("workorder:new", newRow);
      }
    }

    console.log(`✅ Work Order created: ${newRow.id} by ${updated_by}`);
    res.json(newRow);

  } catch (err) {
    console.error("❌ Gagal tambah WO:", err);
    res.status(500).json({ message: "Gagal tambah data Work Order." });
  } finally {
    client.release();
  }
});

// ======================================================
// 🗑️ DELETE WORK ORDER + REALTIME BROADCAST
// ======================================================
app.delete("/api/workorders/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const id = req.params.id;
    const { socketId } = req.body || {};
    const updated_by = req.user?.username || "admin";

    // 🔍 Cek dulu apakah data ada
    const checkQuery = "SELECT * FROM work_orders WHERE id = $1;";
    const checkResult = await client.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Work Order tidak ditemukan." });
    }

    // 🗑️ Hapus data
    const deleteQuery = "DELETE FROM work_orders WHERE id = $1;";
    await client.query(deleteQuery, [id]);

    console.log(`🗑️ Work Order ${id} dihapus oleh ${updated_by}`);

    // =====================================================
    // ⚡ EMIT SOCKET.IO — Realtime ke semua client lain
    // =====================================================
    if (io && io.sockets) {
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.broadcast.emit("workorder:delete", { id });
        } else {
          io.emit("workorder:delete", { id });
        }
      } else {
        io.emit("workorder:delete", { id });
      }
    }

    // ✅ Response ke client
    res.json({ success: true, message: "Work Order berhasil dihapus.", id });

  } catch (err) {
    console.error("❌ Gagal hapus Work Order:", err);
    res.status(500).json({ message: "Gagal menghapus data Work Order." });
  } finally {
    client.release();
  }
});

// -- Simpan color markers untuk status barang - NEW ENDPOINT
app.post('/api/status-barang/color-markers', authenticateToken, async (req, res) => {
  try {
    const { markers } = req.body;

    if (!markers || typeof markers !== 'object') {
      return res.status(400).json({ message: 'Data markers tidak valid.' });
    }

    // Simpan ke database atau localStorage di client side
    // Untuk simplicity, kita handle di client side localStorage saja
    console.log('🎨 Color markers saved for user:', req.user.username);

    res.json({ message: 'Color markers berhasil disimpan.' });
  } catch (err) {
    console.error('❌ Error saving color markers:', err);
    res.status(500).json({ message: 'Gagal menyimpan color markers.' });
  }
});

// -- Ambil color markers - NEW ENDPOINT  
app.get('/api/status-barang/color-markers', authenticateToken, async (req, res) => {
  try {
    // Untuk simplicity, kita handle di client side localStorage saja
    // Ini hanya placeholder untuk future enhancement
    res.json({ markers: {} });
  } catch (err) {
    console.error('❌ Error getting color markers:', err);
    res.status(500).json({ message: 'Gagal mengambil color markers.' });
  }
});

// ===================== DASHBOARD ENDPOINT - FIXED =====================
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  try {
    const { month, year, page = 1, size = 10000 } = req.query;

    console.log(`📊 Dashboard request: month=${month}, year=${year}, page=${page}, size=${size}`);

    if (!month || !year) {
      return res.status(400).json({
        message: "Parameter bulan dan tahun wajib diisi.",
        data: [],
        last_page: 1
      });
    }

    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);
    const sizeInt = parseInt(size);
    const pageInt = parseInt(page);
    const offset = (pageInt - 1) * sizeInt;

    // Validasi input
    if (isNaN(bulanInt) || isNaN(tahunInt) || bulanInt < 1 || bulanInt > 12) {
      return res.status(400).json({
        message: "Bulan dan tahun harus valid.",
        data: [],
        last_page: 1
      });
    }

    console.log(`🔍 Querying dashboard for: ${bulanInt}-${tahunInt}, offset: ${offset}`);

    const query = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        dp_amount, discount,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
      ORDER BY tanggal DESC, id DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await pool.query(query, [bulanInt, tahunInt, sizeInt, offset]);

    console.log(`✅ Database returned ${result.rows.length} rows`);

    // Hitung calculated fields di JavaScript karena ukuran adalah character varying
    const dataWithCalculations = result.rows.map(row => {
      const ukuran = parseFloat(row.ukuran) || 0;
      const qty = parseFloat(row.qty) || 0;
      const harga = parseFloat(row.harga) || 0;
      const dp = parseFloat(row.dp_amount) || 0;
      const discount = parseFloat(row.discount) || 0;

      const subtotal = ukuran * qty * harga;
      const total = subtotal - discount;
      const remaining_payment = total - dp;

      return {
        ...row,
        subtotal,
        total,
        remaining_payment
      };
    });

    // Hitung total pages
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM work_orders WHERE bulan = $1 AND tahun = $2',
      [bulanInt, tahunInt]
    );

    const totalRows = parseInt(countResult.rows[0].count);
    const lastPage = Math.ceil(totalRows / sizeInt);

    console.log(`📄 Pagination: total=${totalRows}, current=${pageInt}, last=${lastPage}`);

    res.json({
      data: dataWithCalculations,
      current_page: pageInt,
      last_page: lastPage,
      total: totalRows
    });

  } catch (err) {
    console.error("❌ Error GET /api/workorders/chunk:", err.message);
    console.error("❌ Stack trace:", err.stack);
    res.status(500).json({
      message: "Gagal memuat data work order: " + err.message,
      data: [],
      last_page: 1,
    });
  }
});

// -- PRINT PO
app.post('/api/workorders/mark-printed', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    let { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Data ID tidak valid.' });
    }

    ids = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

    if (ids.length === 0) {
      return res.status(400).json({ message: 'Tidak ada ID valid untuk diproses.' });
    }

    const query = `
      UPDATE work_orders SET di_produksi = 'true', updated_at = NOW()
      WHERE id = ANY($1) RETURNING *;
    `;

    const result = await client.query(query, [ids]);

    // Kirim realtime updates
    result.rows.forEach(updatedRow => {
      io.emit('wo_updated', updatedRow);
    });

    console.log(`✅ Marked ${result.rowCount} Work Orders as printed`);

    res.json({
      message: `Berhasil menandai ${result.rowCount} Work Order sebagai printed.`,
      updated: result.rows,
    });
  } catch (err) {
    console.error('❌ ERROR DI /mark-printed:', err);
    res.status(500).json({
      message: 'Terjadi kesalahan pada server.',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// ===================== STATUS BARANG ENDPOINT - FIXED =====================
app.get('/api/status-barang', authenticateToken, async (req, res) => {
  try {
    let { customer, month, year } = req.query;

    console.log(`🔍 Status Barang request: month=${month}, year=${year}, customer=${customer}`);

    if (!month || !year) {
      return res.status(400).json({
        message: 'Bulan dan tahun wajib diisi.',
        data: []
      });
    }

    const bulan = parseInt(month);
    const tahun = parseInt(year);

    // Validasi input
    if (isNaN(bulan) || isNaN(tahun) || bulan < 1 || bulan > 12) {
      return res.status(400).json({
        message: 'Bulan dan tahun harus valid.',
        data: []
      });
    }

    const params = [bulan, tahun];
    let whereClause = `WHERE bulan = $1 AND tahun = $2`;
    let paramCount = 2;

    if (customer && customer.trim() !== '') {
      paramCount++;
      params.push(`%${customer.trim()}%`);
      whereClause += ` AND LOWER(nama_customer) LIKE LOWER($${paramCount})`;
      console.log(`🔍 Filter customer aktif: ${customer.trim()}`);
    }

    const query = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        dp_amount, discount,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders ${whereClause}
      ORDER BY tanggal DESC, id DESC;
    `;

    console.log(`📋 Executing query: ${query}`);
    console.log(`📋 With params:`, params);

    const result = await pool.query(query, params);

    console.log(`✅ Database returned ${result.rows.length} rows`);

    // Hitung calculated fields
    const dataWithCalculations = result.rows.map(row => {
      const ukuran = parseFloat(row.ukuran) || 0;
      const qty = parseFloat(row.qty) || 0;
      const harga = parseFloat(row.harga) || 0;
      const dp = parseFloat(row.dp_amount) || 0;
      const discount = parseFloat(row.discount) || 0;

      const subtotal = ukuran * qty * harga;
      const total = subtotal - discount;
      const remaining_payment = total - dp;

      return {
        ...row,
        subtotal,
        total,
        remaining_payment
      };
    });

    console.log(`✅ Status Barang loaded: ${dataWithCalculations.length} rows`);

    res.json(dataWithCalculations);
  } catch (err) {
    console.error('❌ /api/status-barang error:', err.message);
    console.error('❌ Stack trace:', err.stack);
    res.status(500).json({
      message: 'Gagal mengambil data status barang.',
      error: err.message,
      data: []
    });
  }
});

// ===================== WORK ORDERS ENDPOINT - FIXED FILTER =====================
app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    let { month, year, customer, status } = req.query;

    console.log(`🔍 WorkOrders request: month=${month}, year=${year}, customer=${customer}, status=${status}`);

    if (!month || !year) {
      return res.status(400).json({
        message: 'Bulan & tahun wajib diisi.',
        data: []
      });
    }

    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);

    // Validasi input
    if (isNaN(bulanInt) || isNaN(tahunInt) || bulanInt < 1 || bulanInt > 12) {
      return res.status(400).json({
        message: 'Bulan dan tahun harus valid.',
        data: []
      });
    }

    let params = [bulanInt, tahunInt];
    let whereClauses = ['bulan = $1 AND tahun = $2'];
    let paramCount = 2;

    // Filter by customer
    if (customer && customer.trim() !== '') {
      paramCount++;
      params.push(`%${customer.trim()}%`);
      whereClauses.push(`nama_customer ILIKE $${paramCount}`);
    }

    // Filter by status
    if (status) {
      switch (status) {
        case 'belum_produksi':
          whereClauses.push(`(di_produksi = 'false' OR di_produksi IS NULL)`);
          break;
        case 'di_produksi':
          whereClauses.push(`di_produksi = 'true' AND (di_warna = 'false' OR di_warna IS NULL)`);
          break;
        case 'di_warna':
          whereClauses.push(`di_warna = 'true' AND (siap_kirim = 'false' OR siap_kirim IS NULL)`);
          break;
        case 'siap_kirim':
          whereClauses.push(`siap_kirim = 'true' AND (di_kirim = 'false' OR di_kirim IS NULL)`);
          break;
        case 'di_kirim':
          whereClauses.push(`di_kirim = 'true'`);
          break;
      }
    }

    let sql = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        dp_amount, discount,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY tanggal DESC, id DESC
    `;

    console.log(`📋 Executing query: ${sql}`);
    console.log(`📋 With params:`, params);

    const result = await pool.query(sql, params);

    console.log(`✅ Database returned ${result.rows.length} rows`);

    // Hitung calculated fields
    const dataWithCalculations = result.rows.map(row => {
      const ukuran = parseFloat(row.ukuran) || 0;
      const qty = parseFloat(row.qty) || 0;
      const harga = parseFloat(row.harga) || 0;
      const dp = parseFloat(row.dp_amount) || 0;
      const discount = parseFloat(row.discount) || 0;

      const subtotal = ukuran * qty * harga;
      const total = subtotal - discount;
      const remaining_payment = total - dp;

      return {
        ...row,
        subtotal,
        total,
        remaining_payment
      };
    });

    // Filter data yang valid (ada nama customer dan deskripsi)
    const filteredData = dataWithCalculations.filter(item =>
      item.nama_customer && item.deskripsi &&
      item.nama_customer.trim() !== '' &&
      item.deskripsi.trim() !== ''
    );

    console.log(`✅ Final filtered data: ${filteredData.length} rows`);

    res.json(filteredData);
  } catch (err) {
    console.error('❌ workorders GET error:', err);
    console.error('❌ Stack trace:', err.stack);
    res.status(500).json({
      message: 'Terjadi kesalahan pada server.',
      error: err.message,
      data: []
    });
  }
});

// =============================================================
// 🚀 ENDPOINT DP & DISKON - BARU
// =============================================================

// -- Update DP dan Diskon untuk Work Order
app.patch('/api/workorders/:id/payment', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { dp_amount, discount, socketId } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'ID Work Order tidak valid.' });
    }

    // Validasi input - sesuaikan dengan tipe data numeric(15,2)
    const dpAmount = parseFloat(dp_amount) || 0;
    const discountAmount = parseFloat(discount) || 0;

    if (dpAmount < 0 || discountAmount < 0) {
      return res.status(400).json({ message: 'DP dan diskon tidak boleh negatif.' });
    }

    // Dapatkan data work order saat ini untuk validasi
    const currentWO = await client.query(
      'SELECT ukuran, qty, harga FROM work_orders WHERE id = $1',
      [id]
    );

    if (currentWO.rows.length === 0) {
      return res.status(404).json({ message: 'Work Order tidak ditemukan.' });
    }

    const current = currentWO.rows[0];
    // PERHATIAN: ukuran adalah character varying, jadi perlu parseFloat
    const ukuran = parseFloat(current.ukuran) || 0;
    const qty = parseFloat(current.qty) || 0;
    const harga = parseFloat(current.harga) || 0;
    const subtotal = ukuran * qty * harga;

    // Validasi diskon tidak melebihi subtotal
    if (discountAmount > subtotal) {
      return res.status(400).json({ message: 'Diskon tidak boleh melebihi total harga.' });
    }

    // Validasi DP tidak melebihi total setelah diskon
    const totalAfterDiscount = subtotal - discountAmount;
    if (dpAmount > totalAfterDiscount) {
      return res.status(400).json({ message: 'DP tidak boleh melebihi total setelah diskon.' });
    }

    const updated_by = req.user?.username || 'admin';

    const query = `
      UPDATE work_orders 
      SET dp_amount = $1, 
          discount = $2,
          updated_at = NOW(),
          updated_by = $3
      WHERE id = $4 
      RETURNING *
    `;

    const result = await client.query(query, [
      dpAmount,
      discountAmount,
      updated_by,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Work Order tidak ditemukan.' });
    }

    const updatedRow = result.rows[0];

    // HITUNG MANUAL di JavaScript karena ukuran adalah character varying
    const currentUkuran = parseFloat(updatedRow.ukuran) || 0;
    const currentQty = parseFloat(updatedRow.qty) || 0;
    const currentHarga = parseFloat(updatedRow.harga) || 0;
    const currentDP = parseFloat(updatedRow.dp_amount) || 0;
    const currentDiscount = parseFloat(updatedRow.discount) || 0;

    // Tambahkan field calculated
    updatedRow.subtotal = currentUkuran * currentQty * currentHarga;
    updatedRow.total = updatedRow.subtotal - currentDiscount;
    updatedRow.remaining_payment = updatedRow.total - currentDP;

    // Real-time update untuk semua client
    if (socketId && socketId !== 'undefined') {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.broadcast.emit('wo_updated', updatedRow);
      } else {
        io.emit('wo_updated', updatedRow);
      }
    } else {
      io.emit('wo_updated', updatedRow);
    }

    console.log(`✅ Updated payment info for work order ${id}: DP=${dpAmount}, Discount=${discountAmount}`);

    res.json(updatedRow);
  } catch (err) {
    console.error('❌ Error updating payment info:', err);
    res.status(500).json({
      message: 'Gagal memperbarui informasi pembayaran.',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// -- Bulk update DP dan Diskon untuk multiple work orders
app.post('/api/workorders/bulk-payment-update', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { items, socketId } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Data items tidak valid.' });
    }

    const updated_by = req.user?.username || 'admin';
    const updatedRows = [];

    for (const item of items) {
      const { id, dp_amount, discount } = item;

      if (!id || isNaN(parseInt(id))) {
        continue; // Skip invalid IDs
      }

      const dpAmount = parseFloat(dp_amount) || 0;
      const discountAmount = parseFloat(discount) || 0;

      // Validasi dasar
      if (dpAmount < 0 || discountAmount < 0) {
        continue; // Skip invalid values
      }

      const query = `
        UPDATE work_orders 
        SET dp_amount = $1, 
            discount = $2,
            updated_at = NOW(),
            updated_by = $3
        WHERE id = $4 
        RETURNING *
      `;

      const result = await client.query(query, [
        dpAmount,
        discountAmount,
        updated_by,
        id
      ]);

      if (result.rows.length > 0) {
        const updatedRow = result.rows[0];

        // Hitung calculated fields
        const ukuran = parseFloat(updatedRow.ukuran) || 0;
        const qty = parseFloat(updatedRow.qty) || 0;
        const harga = parseFloat(updatedRow.harga) || 0;
        const dp = parseFloat(updatedRow.dp_amount) || 0;
        const discount = parseFloat(updatedRow.discount) || 0;

        updatedRow.subtotal = ukuran * qty * harga;
        updatedRow.total = updatedRow.subtotal - discount;
        updatedRow.remaining_payment = updatedRow.total - dp;

        updatedRows.push(updatedRow);
      }
    }

    // Broadcast real-time updates
    updatedRows.forEach(updatedRow => {
      if (socketId && socketId !== 'undefined') {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.broadcast.emit('wo_updated', updatedRow);
        } else {
          io.emit('wo_updated', updatedRow);
        }
      } else {
        io.emit('wo_updated', updatedRow);
      }
    });

    await client.query('COMMIT');

    console.log(`✅ Bulk updated payment info for ${updatedRows.length} work orders`);

    res.json({
      message: `Berhasil memperbarui informasi pembayaran untuk ${updatedRows.length} Work Order.`,
      updated: updatedRows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error bulk updating payment info:', err);
    res.status(500).json({
      message: 'Gagal memperbarui informasi pembayaran.',
      error: err.message
    });
  } finally {
    client.release();
  }
});

// -- Get work order dengan informasi pembayaran lengkap
app.get('/api/workorders/:id/payment-details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        dp_amount, discount,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders 
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Work Order tidak ditemukan.' });
    }

    const row = result.rows[0];

    // Hitung calculated fields
    const ukuran = parseFloat(row.ukuran) || 0;
    const qty = parseFloat(row.qty) || 0;
    const harga = parseFloat(row.harga) || 0;
    const dp = parseFloat(row.dp_amount) || 0;
    const discount = parseFloat(row.discount) || 0;

    const subtotal = ukuran * qty * harga;
    const total = subtotal - discount;
    const remaining_payment = total - dp;

    const paymentDetails = {
      ...row,
      subtotal,
      total,
      remaining_payment
    };

    res.json(paymentDetails);
  } catch (err) {
    console.error('❌ Error fetching payment details:', err);
    res.status(500).json({
      message: 'Gagal mengambil detail pembayaran.',
      error: err.message
    });
  }
});

// =============================================================
// 🚀 ENDPOINTS KARYAWAN, STOK, INVOICE, KEUANGAN, DLL
// =============================================================

// --- KARYAWAN ---
app.get('/api/karyawan', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM karyawan ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /api/karyawan error:', err);
    res.status(500).json({ message: 'Gagal mengambil data karyawan.' });
  }
});

app.post('/api/karyawan', authenticateToken, async (req, res) => {
  try {
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body;

    if (!nama_karyawan) {
      return res.status(400).json({ message: 'Nama karyawan wajib diisi.' });
    }

    const result = await pool.query(
      `INSERT INTO karyawan (nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nama_karyawan.trim(), gaji_harian || 0, potongan_bpjs_kesehatan || 0, potongan_bpjs_ketenagakerjaan || 0, kasbon || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ POST /api/karyawan error:', err);
    res.status(500).json({ message: 'Gagal menambah karyawan.', error: err.message });
  }
});

// --- PERBAIKAN: Endpoint update karyawan yang sudah ada ---
app.put('/api/karyawan/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body;

    console.log(`💾 Update karyawan ID ${id}:`, { nama_karyawan, kasbon });

    const result = await client.query(
      `UPDATE karyawan
       SET nama_karyawan=$1, gaji_harian=$2, potongan_bpjs_kesehatan=$3, 
           potongan_bpjs_ketenagakerjaan=$4, kasbon=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [nama_karyawan, gaji_harian || 0, potongan_bpjs_kesehatan || 0,
        potongan_bpjs_ketenagakerjaan || 0, kasbon || 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }

    const updatedKaryawan = result.rows[0];

    // ✅ KIRIM SOCKET EVENT UNTUK REALTIME UPDATE
    io.emit('karyawan:update', updatedKaryawan);

    res.json(updatedKaryawan);
  } catch (err) {
    console.error('❌ PUT /api/karyawan/:id error:', err);
    res.status(500).json({ message: 'Gagal mengubah data karyawan.', error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/karyawan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM karyawan WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('❌ DELETE /api/karyawan/:id error:', err);
    res.status(500).json({ message: 'Gagal menghapus karyawan.' });
  }
});

// --- ALTERNATIF: Endpoint update karyawan dengan POST ---
app.post('/api/karyawan/:id/update', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { kasbon } = req.body;

    console.log(`💾 Update karyawan ID ${id} via POST, kasbon: ${kasbon}`);

    const result = await client.query(
      'UPDATE karyawan SET kasbon = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [kasbon, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    }

    const updatedKaryawan = result.rows[0];
    io.emit('karyawan:update', updatedKaryawan);

    res.json({
      message: 'Data karyawan berhasil diperbarui',
      data: updatedKaryawan
    });
  } catch (error) {
    console.error('❌ Error update karyawan:', error);
    res.status(500).json({ error: 'Gagal memperbarui data karyawan' });
  } finally {
    client.release();
  }
});

// --- PERBAIKAN: Endpoint update bon karyawan ---
app.put('/api/karyawan/:id/update-bon', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { kasbon } = req.body;

    console.log(`💾 Update bon karyawan ID ${id} menjadi: ${kasbon}`);

    // ✅ PERBAIKAN: Gunakan pool.query yang benar
    const result = await client.query(
      'UPDATE karyawan SET kasbon = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [kasbon, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan' });
    }

    const updatedKaryawan = result.rows[0];

    // ✅ PERBAIKAN: Gunakan io yang sudah didefinisikan
    io.emit('karyawan:update', updatedKaryawan);
    console.log(`✅ Bon karyawan ${updatedKaryawan.nama_karyawan} diperbarui: ${kasbon}`);

    res.json({
      message: 'Bon berhasil diperbarui',
      data: updatedKaryawan
    });
  } catch (error) {
    console.error('❌ Error update bon:', error);
    res.status(500).json({ error: 'Gagal memperbarui bon: ' + error.message });
  } finally {
    client.release();
  }
});

app.post('/api/payroll', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      karyawan_id,
      potongan_bon, // Match frontend key
      gaji_bersih,
      periode,
      hari_kerja,
      hari_lembur,
      gaji_pokok,
      gaji_lembur,
      total_gaji_kotor,
      total_potongan,
      sisa_bon
    } = req.body;

    // Use potongan_bon if available, fallback to legacy key if needed (though app.js sends potongan_bon)
    const deduction = potongan_bon !== undefined ? potongan_bon : (req.body.potongan_kasbon || 0);

    if (!karyawan_id) {
      throw new Error('Data karyawan ID diperlukan.');
    }

    // 1. Get Employee Name for records
    const empRes = await client.query('SELECT nama_karyawan FROM karyawan WHERE id = $1', [karyawan_id]);
    if (empRes.rows.length === 0) throw new Error('Karyawan tidak ditemukan.');
    const namaKaryawan = empRes.rows[0].nama_karyawan;

    // 2. Update Kasbon (Deduct)
    if (deduction > 0) {
      const updateKasbonQuery = `
        UPDATE karyawan SET kasbon = kasbon - $1, updated_at = NOW() WHERE id = $2
      `;
      await client.query(updateKasbonQuery, [deduction, karyawan_id]);

      // Log Kasbon Deduction
      await client.query(
        `INSERT INTO kasbon_log (karyawan_id, nominal, jenis, keterangan) VALUES ($1, $2, 'BAYAR', $3)`,
        [karyawan_id, deduction, `Potong Gaji Periode ${periode || '-'}`]
      );
    }

    // 3. Record PENGELUARAN GAJI to Finance (Keuangan)
    // Make sure we record the NET PAYOUT (Gaji Bersih) as the actual money leaving the cash drawer
    if (gaji_bersih > 0) {
      await client.query(
        `INSERT INTO keuangan (tanggal, jumlah, tipe, kas_id, keterangan) 
         VALUES (NOW(), $1, 'PENGELUARAN', 3, $2)`, // kas_id 3 assumed 'KAS KECIL/MAIN' based on context, or use default
        [gaji_bersih, `Gaji ${namaKaryawan} (Periode: ${periode || '-'})`]
      );
    }

    await client.query('COMMIT');

    // Get updated data for response
    const finalEmp = await client.query('SELECT * FROM karyawan WHERE id = $1', [karyawan_id]);

    // Realtime update
    if (io && io.emit) {
      io.emit('karyawan:update', finalEmp.rows[0]);
    }

    res.json({
      message: 'Payroll berhasil diproses: Kasbon dipotong & Keuangan dicatat.',
      updatedKaryawan: finalEmp.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ POST /api/payroll error:', err);
    res.status(500).json({ message: 'Gagal memproses payroll.', error: err.message });
  } finally {
    client.release();
  }
});

// --- STOK ---
app.get('/api/stok', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stok_bahan ORDER BY kode_bahan ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ stok GET error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/stok', authenticateToken, async (req, res) => {
  try {
    const { kode, nama, satuan, kategori, stok, lokasi } = req.body;

    if (!kode || !nama) {
      return res.status(400).json({ message: 'Kode dan nama bahan wajib diisi.' });
    }

    const result = await pool.query(
      'INSERT INTO stok_bahan (kode_bahan, nama_bahan, satuan, kategori, stok, lokasi) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [kode.toUpperCase(), nama.trim(), satuan, kategori, stok || 0, lokasi]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ stok POST error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Kode bahan sudah ada.' });
    }
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/stok/update', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { bahan_id, tipe, jumlah, keterangan } = req.body;

    const bahanResult = await client.query('SELECT * FROM stok_bahan WHERE id = $1 FOR UPDATE', [bahan_id]);
    if (bahanResult.rows.length === 0) {
      throw new Error('Bahan tidak ditemukan.');
    }

    const bahan = bahanResult.rows[0];
    const stokSebelum = parseFloat(bahan.stok);
    const jumlahUpdate = parseFloat(jumlah);
    let stokSesudah;

    if (tipe === 'MASUK') {
      stokSesudah = stokSebelum + jumlahUpdate;
    } else if (tipe === 'KELUAR') {
      stokSesudah = stokSebelum - jumlahUpdate;
      if (stokSesudah < 0) {
        throw new Error('Stok tidak mencukupi.');
      }
    } else {
      throw new Error('Tipe transaksi tidak valid.');
    }

    await client.query('UPDATE stok_bahan SET stok = $1, last_update = NOW() WHERE id = $2', [stokSesudah, bahan_id]);

    await client.query(
      'INSERT INTO riwayat_stok (bahan_id, nama_bahan, tipe, jumlah, stok_sebelum, stok_sesudah, keterangan) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [bahan_id, bahan.nama_bahan, tipe, jumlahUpdate, stokSebelum, stokSesudah, keterangan]
    );

    await client.query('COMMIT');

    res.json({ message: 'Stok berhasil diperbarui.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ stok update error:', err);
    res.status(500).json({ message: err.message || 'Terjadi kesalahan pada server.' });
  } finally {
    client.release();
  }
});

// -- Update Stok via Stock Opname (Adjust)
app.post('/api/stok/adjust', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { bahan_id, qty_actual, reason, keterangan } = req.body;

    // 1. Get current stock
    const resBahan = await client.query("SELECT * FROM stok_bahan WHERE id = $1 FOR UPDATE", [bahan_id]);
    if (resBahan.rows.length === 0) throw new Error("Bahan tidak ditemukan");

    const bahan = resBahan.rows[0];
    const currentStok = parseFloat(bahan.stok);
    const actualStok = parseFloat(qty_actual);
    const diff = actualStok - currentStok; // + means found more, - means lost/used

    if (diff === 0) {
      await client.query('COMMIT'); // No change
      return res.json({ message: "Stok sudah sesuai, tidak ada perubahan." });
    }

    const tipe = diff > 0 ? 'MASUK' : 'KELUAR';
    const amount = Math.abs(diff);

    // 2. Update Master Stock
    await client.query("UPDATE stok_bahan SET stok = $1, last_update = NOW() WHERE id = $2", [actualStok, bahan_id]);

    // 3. Log History
    const logDesc = reason ? `${reason} (${keterangan || '-'})` : `Stock Opname / Adjust (${keterangan || '-'})`;
    await client.query(
      "INSERT INTO riwayat_stok (bahan_id, nama_bahan, tipe, jumlah, stok_sebelum, stok_sesudah, keterangan) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [bahan_id, bahan.nama_bahan, tipe, amount, currentStok, actualStok, logDesc]
    );

    // 4. (Optional) If 'Production Use' or similar reason, maybe record cost? (Skipping for now as per minimal requirements)

    await client.query('COMMIT');
    res.json({ message: "Stok berhasil disesuaikan.", new_stok: actualStok });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ stok adjust error:', err);
    res.status(500).json({ message: err.message || 'Gagal menyesuaikan stok.' });
  } finally {
    client.release();
  }
});

// --- INVOICE & SURAT JALAN ---
app.get('/api/invoice/:inv', authenticateToken, async (req, res) => {
  try {
    const { inv } = req.params;
    const result = await pool.query('SELECT * FROM work_orders WHERE no_inv = $1', [inv]);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ invoice GET error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// ============================================
// 🧮 Hitung Ringkasan Invoice Bulanan (AMAN)
// ============================================
async function calculateInvoiceSummary(pool, bulan, tahun) {
  const query = `
    SELECT
      COALESCE(SUM(
        (NULLIF(REGEXP_REPLACE(ukuran, '[^0-9\\.]', '', 'g'), '')::numeric)
        * qty::numeric * harga::numeric
      ), 0) AS total_invoice,

      COALESCE(SUM(
        CASE WHEN pembayaran = true THEN
          (NULLIF(REGEXP_REPLACE(ukuran, '[^0-9\\.]', '', 'g'), '')::numeric)
          * qty::numeric * harga::numeric
        ELSE 0 END
      ), 0) AS total_paid,

      COUNT(*) AS total_records,
      COUNT(no_inv) FILTER (WHERE no_inv IS NOT NULL AND no_inv <> '') AS records_with_invoice
    FROM work_orders
    WHERE bulan = $1 AND tahun = $2;
  `;

  try {
    const { rows } = await pool.query(query, [bulan, tahun]);
    const row = rows[0] || {};

    return {
      total_invoice: Number(row.total_invoice) || 0,
      total_paid: Number(row.total_paid) || 0,
      total_unpaid: (Number(row.total_invoice) || 0) - (Number(row.total_paid) || 0),
      _debug: {
        total_records: Number(row.total_records) || 0,
        records_with_invoice: Number(row.records_with_invoice) || 0,
        query_month: bulan,
        query_year: tahun
      }
    };
  } catch (err) {
    console.error('❌ Error in calculateInvoiceSummary:', err);
    throw new Error('Gagal menghitung ringkasan invoice');
  }
}

// ===================== INVOICE SUMMARY ENDPOINT - FIXED =====================
app.get('/api/invoices/summary', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;

    console.log(`🧾 Invoice Summary request: month=${month}, year=${year}`);

    if (!month || !year) {
      return res.status(400).json({
        message: 'Bulan dan tahun diperlukan.',
        data: {}
      });
    }

    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);

    // Validasi input
    if (isNaN(bulanInt) || isNaN(tahunInt) || bulanInt < 1 || bulanInt > 12) {
      return res.status(400).json({
        message: 'Bulan dan tahun harus valid.',
        data: {}
      });
    }

    const summary = await calculateInvoiceSummary(pool, bulanInt, tahunInt);

    console.log(`✅ Invoice Summary result:`, summary);

    if (io && io.emit) {
      io.emit('invoice:summary-updated', summary);
      console.log('📡 Realtime: invoice:summary-updated dikirim ke semua client');
    }


    res.json(summary);
  } catch (err) {
    console.error('❌ invoices summary error:', err);
    console.error('❌ Stack trace:', err.stack);
    res.status(500).json({
      message: 'Gagal mengambil ringkasan invoice.',
      error: err.message,
      data: {}
    });
  }
});

// ===================== WORK ORDERS WARNA ENDPOINT - FIXED =====================
app.get('/api/workorders-warna', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;

    console.log(`🔍 API workorders-warna called: month=${month}, year=${year}`);

    if (!month || !year) {
      return res.status(400).json({
        message: 'Bulan dan tahun diperlukan.',
        data: []
      });
    }

    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);

    // Validasi input
    if (isNaN(bulanInt) || isNaN(tahunInt) || bulanInt < 1 || bulanInt > 12) {
      return res.status(400).json({
        message: 'Bulan dan tahun harus valid.',
        data: []
      });
    }

    // ✅ FIX: Query yang lebih komprehensif dengan filter yang benar
    const query = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        dp_amount, discount,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders 
      WHERE bulan = $1 AND tahun = $2
        AND (di_produksi = 'true' OR di_produksi = true)
        AND (di_warna = 'false' OR di_warna = false OR di_warna IS NULL)
      ORDER BY tanggal DESC, id DESC
    `;

    console.log(`📋 Executing query: ${query}`);
    console.log(`📋 With params: [${bulanInt}, ${tahunInt}]`);

    const result = await pool.query(query, [bulanInt, tahunInt]);

    console.log(`📦 Database returned ${result.rows.length} rows for ${bulanInt}-${tahunInt}`);

    // Hitung calculated fields
    const dataWithCalculations = result.rows.map(row => {
      const ukuran = parseFloat(row.ukuran) || 0;
      const qty = parseFloat(row.qty) || 0;
      const harga = parseFloat(row.harga) || 0;
      const dp = parseFloat(row.dp_amount) || 0;
      const discount = parseFloat(row.discount) || 0;

      const subtotal = ukuran * qty * harga;
      const total = subtotal - discount;
      const remaining_payment = total - dp;

      return {
        ...row,
        subtotal,
        total,
        remaining_payment
      };
    });

    res.json(dataWithCalculations);
  } catch (err) {
    console.error('❌ Error loading work orders for warna:', err);
    console.error('❌ Stack trace:', err.stack);
    res.status(500).json({
      message: 'Gagal memuat data barang siap diwarna.',
      error: err.message,
      data: []
    });
  }
});

// -- Debug endpoint untuk memeriksa data work orders
app.get('/api/debug/workorders', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    }

    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);

    // Query semua data untuk debugging
    const query = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, 
        di_produksi, di_warna, siap_kirim, di_kirim,
        bulan, tahun
      FROM work_orders 
      WHERE bulan = $1 AND tahun = $2
      ORDER BY id ASC
    `;

    const result = await pool.query(query, [bulanInt, tahunInt]);

    // Analisis data
    const analysis = {
      total_data: result.rows.length,
      di_produksi_true: result.rows.filter(row =>
        row.di_produksi === 'true' || row.di_produksi === true || row.di_produksi === '1'
      ).length,
      di_warna_false: result.rows.filter(row =>
        row.di_warna === 'false' || row.di_warna === false || row.di_warna === null || row.di_warna === '0'
      ).length,
      ready_for_warna: result.rows.filter(row =>
        (row.di_produksi === 'true' || row.di_produksi === true || row.di_produksi === '1') &&
        (row.di_warna === 'false' || row.di_warna === false || row.di_warna === null || row.di_warna === '0')
      ).length,
      sample_data: result.rows.slice(0, 5).map(row => ({
        id: row.id,
        customer: row.nama_customer,
        di_produksi: row.di_produksi,
        di_warna: row.di_warna,
        type_di_produksi: typeof row.di_produksi,
        type_di_warna: typeof row.di_warna
      }))
    };

    console.log('🔍 DEBUG Work Orders Analysis:', analysis);

    res.json({
      analysis,
      all_data: result.rows
    });
  } catch (err) {
    console.error('❌ Debug error:', err);
    res.status(500).json({
      message: 'Gagal melakukan debug.',
      error: err.message
    });
  }
});

// -- Get invoice by number (untuk tab customer)
app.get('/api/invoice-search/:invoiceNo', authenticateToken, async (req, res) => {
  try {
    const { invoiceNo } = req.params;

    const result = await pool.query(
      `SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        dp_amount, discount,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
       FROM work_orders 
       WHERE no_inv = $1 
       ORDER BY id ASC`,
      [invoiceNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice tidak ditemukan' });
    }

    // Hitung calculated fields
    const dataWithCalculations = result.rows.map(row => {
      const ukuran = parseFloat(row.ukuran) || 0;
      const qty = parseFloat(row.qty) || 0;
      const harga = parseFloat(row.harga) || 0;
      const dp = parseFloat(row.dp_amount) || 0;
      const discount = parseFloat(row.discount) || 0;

      const subtotal = ukuran * qty * harga;
      const total = subtotal - discount;
      const remaining_payment = total - dp;

      return {
        ...row,
        subtotal,
        total,
        remaining_payment
      };
    });

    res.json(dataWithCalculations);
  } catch (err) {
    console.error('❌ Error searching invoice:', err);
    res.status(500).json({
      message: 'Gagal mencari invoice.',
      error: err.message
    });
  }
});

// =============================================================
// 🐛 DEBUG ENDPOINT: DETAILED INVOICE ANALYSIS
// =============================================================
app.get('/api/debug/invoice-details', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    }

    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);

    console.log(`🔍 Debug invoice details for: ${bulanInt}-${tahunInt}`);

    // Query semua data work orders untuk bulan tersebut
    const query = `
      SELECT 
        id, tanggal, nama_customer, no_inv, pembayaran,
        ukuran, qty, harga, discount,
        (COALESCE(NULLIF(ukuran, '')::numeric, 0) * COALESCE(qty, 0) * COALESCE(harga, 0)) - COALESCE(discount, 0) as calculated_total
      FROM work_orders 
      WHERE bulan = $1 AND tahun = $2
      ORDER BY id ASC
    `;

    const result = await pool.query(query, [bulanInt, tahunInt]);

    const analysis = {
      month: bulanInt,
      year: tahunInt,
      total_records: result.rows.length,
      records_with_invoice: result.rows.filter(row =>
        row.no_inv && row.no_inv.trim() !== '' && row.no_inv !== 'null'
      ).length,
      paid_records: result.rows.filter(row => row.pembayaran === true).length,
      all_data: result.rows,
      sample_calculations: result.rows.map(row => ({
        id: row.id,
        customer: row.nama_customer,
        no_inv: row.no_inv || 'NULL/EMPTY',
        pembayaran: row.pembayaran,
        calculated_total: row.calculated_total,
        has_invoice: !!(row.no_inv && row.no_inv.trim() !== '' && row.no_inv !== 'null')
      }))
    };

    console.log(`📊 Debug Analysis ${bulanInt}-${tahunInt}:`, {
      total_records: analysis.total_records,
      with_invoice: analysis.records_with_invoice,
      paid: analysis.paid_records
    });

    res.json(analysis);
  } catch (err) {
    console.error('❌ Debug invoice details error:', err);
    res.status(500).json({
      message: 'Gagal melakukan debug detail invoice.',
      error: err.message
    });
  }
});

// =============================================================
// 🧾 FINAL: POTONG BON SAAT SLIP GAJI DI-PRINT (ANTI DOUBLE)
// =============================================================
app.post('/api/payroll/potong-bon', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { karyawan_id, potongan, periode } = req.body;

    if (!karyawan_id || !potongan || !periode) {
      return res.status(400).json({ message: "Data tidak lengkap." });
    }

    await client.query("BEGIN");

    // 1️⃣ CEK APAKAH SUDAH PERNAH DIPOTONG DI PERIODE INI
    const cek = await client.query(
      `SELECT id FROM kasbon_log 
       WHERE karyawan_id = $1 
       AND jenis = 'BAYAR'
       AND keterangan = $2 
       LIMIT 1`,
      [karyawan_id, `Slip Gaji ${periode}`]
    );

    if (cek.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        message: "Potongan bon sudah pernah diterapkan pada periode ini.",
        duplicated: true
      });
    }

    // 2️⃣ AMBIL KASBON TERKINI
    const result = await client.query(
      "SELECT kasbon FROM karyawan WHERE id = $1",
      [karyawan_id]
    );

    if (result.rows.length === 0) throw new Error("Karyawan tidak ditemukan");

    let kasbonSaatIni = Number(result.rows[0].kasbon) || 0;
    let potonganFinal = Math.min(kasbonSaatIni, potongan);

    // 3️⃣ INSERT LOG BAYAR
    await client.query(
      `INSERT INTO kasbon_log (karyawan_id, nominal, jenis, keterangan)
       VALUES ($1, $2, 'BAYAR', $3)`,
      [karyawan_id, potonganFinal, `Slip Gaji ${periode}`]
    );

    // 4️⃣ UPDATE TOTAL KASBON
    const update = await client.query(
      `UPDATE karyawan 
       SET kasbon = kasbon - $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [potonganFinal, karyawan_id]
    );

    await client.query("COMMIT");

    io.emit("karyawan:update", update.rows[0]);

    res.json({
      message: "Potongan bon berhasil diterapkan",
      updatedKaryawan: update.rows[0],
      potongan: potonganFinal,
      duplicated: false
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error potong bon:", err);
    res.status(500).json({ message: "Gagal memproses potongan bon." });
  } finally {
    client.release();
  }
});

// ==========================================================
// 💰 KEUANGAN & INVOICE ENDPOINTS (ADDED)
// ==========================================================

// Ensure tables exist
async function ensureKeuanganTables() {
  const client = await pool.connect();
  try {
    await client.query(`
            CREATE TABLE IF NOT EXISTS keuangan_transaksi (
                id SERIAL PRIMARY KEY,
                tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
                jumlah NUMERIC(15, 2) NOT NULL,
                tipe VARCHAR(20) CHECK (tipe IN ('PEMASUKAN', 'PENGELUARAN')),
                kas_id INTEGER NOT NULL,
                nama_kas VARCHAR(50),
                keterangan TEXT,
                dibuat_pada TIMESTAMP DEFAULT NOW()
            );
        `);
    // Seed initial logic if needed (e.g. mapping kas_id to names)
  } catch (err) {
    console.error("❌ Failed to create keuangan tables:", err);
  } finally {
    client.release();
  }
}
ensureKeuanganTables(); // Run on startup

// ✅ HELPER: Insert Keuangan Transaction (Safe for use inside existing transactions)
async function insertKeuanganTransaction(client, { tanggal, jumlah, tipe, kas_id, keterangan }) {
  // Map kas_id to name (simple hardcoded map for safety)
  const kasNames = { 1: 'Bank BCA Toto', 2: 'Bank BCA Yanto', 3: 'Cash' };
  const nama_kas = kasNames[kas_id] || 'Unknown';

  await client.query(
    `INSERT INTO keuangan_transaksi (tanggal, jumlah, tipe, kas_id, nama_kas, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6)`,
    [tanggal, jumlah, tipe, kas_id, nama_kas, keterangan]
  );
}

// GET Saldo Summary
app.get('/api/keuangan/saldo', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    // Calculate saldo per kas_id
    const result = await client.query(`
            SELECT 
                kas_id as id,
                nama_kas,
                SUM(CASE WHEN tipe = 'PEMASUKAN' THEN jumlah ELSE -jumlah END) as saldo
            FROM keuangan_transaksi
            GROUP BY kas_id, nama_kas
            ORDER BY kas_id
        `);

    // Ensure we return data even if empty
    const defaultKas = [
      { id: 1, nama_kas: 'Bank BCA Toto', saldo: 0 },
      { id: 2, nama_kas: 'Bank BCA Yanto', saldo: 0 },
      { id: 3, nama_kas: 'Cash', saldo: 0 }
    ];

    const finalResult = defaultKas.map(def => {
      const found = result.rows.find(r => r.id === def.id);
      return {
        ...def,
        saldo: found ? parseFloat(found.saldo) : 0
      };
    });

    res.json(finalResult);
  } catch (err) {
    console.error("❌ Error fetching saldo:", err);
    res.status(500).json({ message: "Gagal mengambil data saldo" });
  } finally {
    client.release();
  }
});

// GET Riwayat Transaksi
app.get('/api/keuangan/riwayat', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  try {
    let query = `
            SELECT * FROM keuangan_transaksi 
            WHERE 1=1 `;
    const params = [];

    if (month && year) {
      query += ` AND EXTRACT(MONTH FROM tanggal) = $1 AND EXTRACT(YEAR FROM tanggal) = $2`;
      params.push(month, year);
    }

    query += ` ORDER BY tanggal DESC, id DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching riwayat:", err);
    res.status(500).json({ message: "Gagal mengambil riwayat transaksi" });
  }
});

// POST Transaksi Baru
app.post('/api/keuangan/transaksi', authenticateToken, async (req, res) => {
  const { tanggal, jumlah, tipe, kas_id, keterangan } = req.body;

  // Map kas_id to name (simple hardcoded map for safety)
  const kasNames = { 1: 'Bank BCA Toto', 2: 'Bank BCA Yanto', 3: 'Cash' };
  const nama_kas = kasNames[kas_id] || 'Unknown';

  try {
    await pool.query(
      `INSERT INTO keuangan_transaksi (tanggal, jumlah, tipe, kas_id, nama_kas, keterangan)
             VALUES ($1, $2, $3, $4, $5, $6)`,
      [tanggal, jumlah, tipe, kas_id, nama_kas, keterangan]
    );
    res.json({ message: "Transaksi berhasil disimpan" });
  } catch (err) {
    console.error("❌ Error saving transaction:", err);
    res.status(500).json({ message: "Gagal menyimpan transaksi" });
  }
});

// GET Invoice Summary (Monthly)
app.get('/api/invoice/summary', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: "Month/Year required" });

  try {
    // Calculate based on Work Orders grouped by 'no_inv' (simplified logic)
    // Note: Real logic might be complex if 'invoices' table doesn't exist.
    // We will infer invoice status from work_orders.
    // Assuming: 
    // - Paid = remaining_payment <= 0
    // - Unpaid = remaining_payment > 0

    // First, get all distinct invoices for the month
    const query = `
           SELECT 
             no_inv,
             SUM((NULLIF(REGEXP_REPLACE(ukuran, '[^0-9\\.]', '', 'g'), '')::numeric) * qty::numeric * harga::numeric) as total_value,
             SUM(dp_amount) as total_dp,
             SUM(discount) as total_disc
           FROM work_orders
           WHERE bulan = $1 AND tahun = $2 AND no_inv IS NOT NULL AND no_inv != ''
           GROUP BY no_inv
        `;

    const result = await pool.query(query, [month, year]);

    let totalCount = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    result.rows.forEach(inv => {
      const val = parseFloat(inv.total_value) || 0;
      const dp = parseFloat(inv.total_dp) || 0;
      const disc = parseFloat(inv.total_disc) || 0;
      const paid = dp;
      const total = val - disc;
      const remaining = total - paid;

      totalCount++;
      if (remaining <= 100) paidCount++; // Tolerance 100 rupiah
      else unpaidCount++;
    });

    res.json({
      total: totalCount,
      paid: paidCount,
      unpaid: unpaidCount
    });

  } catch (err) {
    console.error("❌ Error invoice summary:", err);
    res.status(500).json({ message: "Failed to load summary" });
  }
});

// ==========================================================
// 📊 DASHBOARD STATS API
// ==========================================================
app.get('/api/dashboard/stats', async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year) || new Date().getFullYear();

  try {
    const client = await pool.connect();
    try {
      // 1. Finance Stats (Keuangan)
      const financeRes = await client.query(`
        SELECT tipe, SUM(jumlah) as total 
        FROM keuangan 
        WHERE EXTRACT(MONTH FROM tanggal) = $1 AND EXTRACT(YEAR FROM tanggal) = $2 
        GROUP BY tipe
      `, [m, y]);

      const finance = {
        pemasukan: 0,
        pengeluaran: 0,
        profit: 0
      };

      financeRes.rows.forEach(row => {
        if (row.tipe === 'PEMASUKAN') finance.pemasukan = Number(row.total);
        if (row.tipe === 'PENGELUARAN') finance.pengeluaran = Number(row.total);
      });
      finance.profit = finance.pemasukan - finance.pengeluaran;

      // 2. Production Status Counts
      // Priority: Di Kirim > Siap Kirim > Di Warna > Di Produksi > Belum
      const prodRes = await client.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN di_kirim THEN 1 ELSE 0 END) as di_kirim,
          SUM(CASE WHEN siap_kirim AND NOT di_kirim THEN 1 ELSE 0 END) as siap_kirim,
          SUM(CASE WHEN di_warna AND NOT siap_kirim AND NOT di_kirim THEN 1 ELSE 0 END) as di_warna,
          SUM(CASE WHEN di_produksi AND NOT di_warna AND NOT siap_kirim AND NOT di_kirim THEN 1 ELSE 0 END) as di_produksi
        FROM work_orders 
        WHERE bulan = $1 AND tahun = $2
      `, [m, y]);

      const prod = prodRes.rows[0];
      const prodStats = {
        total: parseInt(prod.total),
        di_kirim: parseInt(prod.di_kirim),
        siap_kirim: parseInt(prod.siap_kirim),
        di_warna: parseInt(prod.di_warna),
        di_produksi: parseInt(prod.di_produksi),
        belum_produksi: parseInt(prod.total) - (parseInt(prod.di_kirim) + parseInt(prod.siap_kirim) + parseInt(prod.di_warna) + parseInt(prod.di_produksi))
      };

      // 3. Low Stock Alert
      const stockRes = await client.query(`
        SELECT COUNT(*) as count FROM stok_bahan WHERE stok <= 5
      `);
      const lowStockCount = parseInt(stockRes.rows[0].count);

      res.json({
        finance,
        production: prodStats,
        inventory: { low_stock: lowStockCount }
      });

    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Error fetching dashboard stats:", err);
    res.status(500).json({ message: "Failed to load stats" });
  }
});
io.on("connection", (socket) => {
  console.log("🔗 Socket connected:", socket.id);

  // ========== 🔄 WORK ORDER SYNC ==========
  socket.on("wo_sync", (data) => {
    console.log("🔄 Sync WO dari client:", data.id);
    socket.broadcast.emit("wo_updated", data);
  });

  // ========== 👷‍♂️ KARYAWAN REALTIME ==========
  socket.on("karyawan:new", (data) => {
    console.log("👷‍♂️ Karyawan baru ditambahkan:", data.nama_karyawan);
    socket.broadcast.emit("karyawan:new", data);
  });

  socket.on("karyawan:update", (data) => {
    console.log("✏️ Karyawan diperbarui:", data.id);
    socket.broadcast.emit("karyawan:update", data);
  });

  socket.on("karyawan:delete", (data) => {
    console.log("🗑️ Karyawan dihapus:", data.id);
    socket.broadcast.emit("karyawan:delete", data);
  });

  // ========== 📦 SURAT JALAN REALTIME ==========
  socket.on("suratjalan:new", (data) => {
    console.log("📦 Surat jalan baru ditambahkan:", data.no_sj);
    socket.broadcast.emit("suratjalan:new", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ===================== Fallback (Selalu di Bawah Rute API) =====================
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, 'toto-frontend', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Frontend not found.');
});

// ===================== Error Handling Global =====================
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// ===================== Start server =====================
async function startServer() {
  try {
    // Test database connection first
    console.log('🔌 Testing database connection...');
    const dbConnected = await testDatabaseConnection();

    if (!dbConnected) {
      console.error('❌ Cannot start server without database connection');
      process.exit(1);
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server (dan Socket.IO) berjalan di port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: ${dbConnected ? 'Connected ✅' : 'Disconnected ❌'}`);
      console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Set' : 'Using default'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();