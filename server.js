// ==========================================================
// 🚀 SERVER.JS (VERSI FINAL - DENGAN SOCKET.IO REALTIME)
// ==========================================================

const express = require('express');
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
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Izinkan semua origin
    methods: ["GET", "POST"]
  }
});
// ==============================================================================

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

// ===================== Postgres Pool =====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

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
const upload = multer({ storage });

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
          return res.status(401).json({ message: 'EXPIRED' }); // Sinyal agar frontend refresh
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

// ===================== Routes =====================

// -- Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username dan password wajib diisi.' });

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Username atau password salah!' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Username atau password salah!' });

    // Cek langganan
    if (user.role !== 'admin' && user.subscription_status === 'inactive') {
      return res.status(403).json({ message: 'Langganan Anda tidak aktif.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
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

// -- Refresh token
app.post('/api/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Token wajib dikirim.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      // Jika token expired, buatkan yang baru
      if (err && err.name === 'TokenExpiredError') {
        const payload = jwt.decode(token);
        const newToken = jwt.sign(
          { id: payload.id, username: payload.username, role: payload.role },
          JWT_SECRET,
          { expiresIn: '8h' } // Samakan dengan durasi login
        );
        console.log(`♻️ Token user ${payload.username} diperbarui.`);
        return res.json({ token: newToken });
      }
      // Jika token tidak valid (bukan expired), tolak
      if (err) return res.status(403).json({ message: 'Token tidak valid.' });
      
      // Jika token masih valid, kirim balik token yang sama
      res.json({ token });
    });
  } catch (err) {
    console.error('refresh token error', err);
    res.status(500).json({ message: 'Gagal memperbarui token.' });
  }
});

// -- Get current user
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, username, profile_picture_url, role FROM users WHERE id = $1', [req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('/api/me error', err);
    res.status(500).json({ message: 'Error fetching user.' });
  }
});

// -- Update profile
app.put('/api/user/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const { username } = req.body;
    let profilePictureUrl = null;
    if (req.file) profilePictureUrl = `/uploads/${req.file.filename}`;

    if (profilePictureUrl) {
      const r = await pool.query('UPDATE users SET username = $1, profile_picture_url = $2 WHERE id = $3 RETURNING id, username, profile_picture_url', [username, profilePictureUrl, req.user.id]);
      return res.json(r.rows[0]);
    } else {
      const r = await pool.query('UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, profile_picture_url', [username, req.user.id]);
      return res.json(r.rows[0]);
    }
  } catch (err) {
    console.error('update profile error', err);
    res.status(500).json({ message: 'Gagal mengupdate profil.' });
  }
});

// -- Change password
app.put('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const r = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });

    const isMatch = await bcrypt.compare(oldPassword, r.rows[0].password_hash);
    if (!isMatch) return res.status(400).json({ message: 'Password lama salah.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Password berhasil diubah.' });
  } catch (err) {
    console.error('change password error', err);
    res.status(500).json({ message: 'Gagal mengubah password.' });
  }
});

// -- Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
  }

  const client = await pool.connect();
  try {
    const summaryQuery = `
      SELECT
        COALESCE(SUM(
          (NULLIF(REGEXP_REPLACE(ukuran, '[^0-9.]', '', 'g'), '')::numeric) *
          (NULLIF(REGEXP_REPLACE(qty, '[^0-9.]', '', 'g'), '')::numeric) *
          (NULLIF(REGEXP_REPLACE(harga, '[^0-9.]', '', 'g'), '')::numeric)
        ), 0) AS total_rupiah,
        COUNT(DISTINCT nama_customer) AS total_customer
      FROM work_orders WHERE bulan = $1 AND tahun = $2;
    `;
    const summaryResult = await client.query(summaryQuery, [month, year]);

    const statusQuery = `
      SELECT
        COUNT(*) FILTER (WHERE (di_produksi = 'false' OR di_produksi IS NULL)) AS belum_produksi,
        COUNT(*) FILTER (WHERE di_produksi = 'true' AND (di_warna = 'false' OR di_warna IS NULL)) AS sudah_produksi,
        COUNT(*) FILTER (WHERE di_warna = 'true' AND (siap_kirim = 'false' OR di_kirim IS NULL)) AS di_warna,
        COUNT(*) FILTER (WHERE siap_kirim = 'true' AND (di_kirim = 'false' OR di_kirim IS NULL)) AS siap_kirim,
        COUNT(*) FILTER (WHERE di_kirim = 'true') AS di_kirim
      FROM work_orders WHERE bulan = $1 AND tahun = $2;
    `;
    const statusResult = await client.query(statusQuery, [month, year]);

    res.json({
      summary: summaryResult.rows[0],
      statusCounts: statusResult.rows[0],
    });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ message: 'Gagal mengambil data dashboard.' });
  } finally {
    client.release();
  }
});


// =============================================================
// 🚀 WORK ORDERS - ENDPOINTS (DENGAN REALTIME)
// =============================================================

// 1. TAMBAH WORK ORDER BARU
app.post('/api/workorders', authenticateToken, async (req, res) => {
  try {
    const { tanggal, nama_customer, deskripsi, ukuran, qty } = req.body;
    console.log("🟢 Data diterima POST /api/workorders:", req.body);
    const today = new Date();
    const tanggalFinal = tanggal || today.toISOString().slice(0, 10);
    const namaFinal = nama_customer || 'Tanpa Nama';
    const date = new Date(tanggalFinal);
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();
    const query = `
      INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `;
    const values = [tanggalFinal, namaFinal, deskripsi, ukuran || null, qty || null, bulan, tahun];
    const result = await pool.query(query, values);
    const newRow = result.rows[0];

    // 📡 SIARKAN DATA BARU KE SEMUA USER
    io.emit('wo_created', newRow); 
    console.log("📡 Siaran [wo_created] terkirim.");
    
    res.status(201).json(newRow);
  } catch (err) {
    console.error('workorders POST error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
  }
});

// 2. AMBIL DATA UNTUK TABULATOR (GOOGLE SHEET)
// GANTI HANYA FUNGSI INI DI server.js

// =============================================================
// GET /api/workorders/chunk  --> (PERBAIKAN: Format { data, total } yang STABIL)
// =============================================================
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  try {
    // 1. Baca 'page' dan 'size' dari Tabulator (frontend)
    const { month, year, page = 1, size = 500 } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Parameter month dan year wajib diisi.' });
    }

    const bulan = parseInt(month);
    const tahun = parseInt(year);

    // 2. Hitung 'limit' dan 'offset'
    const parsedLimit = Math.min(500, parseInt(size));
    const parsedOffset = Math.max(0, (parseInt(page) - 1) * parsedLimit); 

    const params = [bulan, tahun];
    // HAPUS SEMUA FILTER TANGGAL YANG RUMIT
    const whereClause = "WHERE bulan = $1 AND tahun = $2";

    // --- Jalankan 2 query ---
    // Query 1: Ambil TOTAL DATA (untuk pagination)
    const countQuery = `SELECT COUNT(*) FROM work_orders ${whereClause}`;
    const countPromise = pool.query(countQuery, params);

    // Query 2: Ambil DATA PER HALAMAN (Urutan ASC standar)
    const dataQuery = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, di_produksi
      FROM work_orders
      ${whereClause}
      ORDER BY tanggal ASC, id ASC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataParams = [...params, parsedLimit, parsedOffset];
    const dataPromise = pool.query(dataQuery, dataParams);

    // Jalankan keduanya
    const [countResult, dataResult] = await Promise.all([countPromise, dataPromise]);

    const total = parseInt(countResult.rows[0].count, 10);
    const data = dataResult.rows;

    // Kirim format { data, total } yang diharapkan app.js
    res.json({ data: data, total: total });

  } catch (err) {
    console.error('❌ workorders CHUNK error:', err);
    res.status(500).json({ message: 'Gagal memuat data chunk.', error: err.message });
  }
});

// 3. UPDATE WORK ORDER (AUTOSAVE)
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
      if (validColumns.includes(key)) {
        filteredUpdates[key] = val;
      }
    }

    if (!Object.keys(filteredUpdates).length) {
      return res.status(400).json({ message: 'Tidak ada kolom valid untuk diupdate.' });
    }

    const setClauses = [];
    const values = [];
    let i = 1;
    for (const [key, val] of Object.entries(filteredUpdates)) {
      setClauses.push(`"${key}" = $${i}`);
      if (typeof val === 'boolean') {
        values.push(val ? 'true' : 'false');
      } else {
        values.push(val);
      }
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

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });
    }

    const updatedRow = result.rows[0];

    // 📡 SIARKAN PERUBAHAN DATA KE SEMUA USER
    io.emit('wo_updated', updatedRow);
    console.log("📡 Siaran [wo_updated] terkirim.");

    res.json({ message: 'Data berhasil diperbarui.', data: updatedRow });
  } catch (err) {
    console.error('❌ PATCH /api/workorders/:id error:', err);
    res.status(500).json({ message: 'Gagal memperbarui data.', error: err.message });
  }
});

// 4. PRINT PO
app.post('/api/workorders/mark-printed', authenticateToken, async (req, res) => {
  try {
    let { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Data ID tidak valid.' });
    }
    ids = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    const query = `
      UPDATE work_orders SET di_produksi = TRUE
      WHERE id = ANY($1) RETURNING *;
    `;
    const result = await pool.query(query, [ids]);
    
    // 📡 Siarkan perubahan status 'di_produksi'
    result.rows.forEach(updatedRow => {
      io.emit('wo_updated', updatedRow);
    });
    console.log(`📡 Siaran [wo_updated] terkirim untuk ${result.rowCount} item PO.`);

    res.json({
      message: `Berhasil menandai ${result.rowCount} Work Order sebagai printed.`,
      updated: result.rows,
    });
  } catch (err) {
    console.error('❌ ERROR DI /mark-printed:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: err.message });
  }
});

// 5. AMBIL DATA UNTUK HALAMAN 'STATUS BARANG'
app.get('/api/status-barang', authenticateToken, async (req, res) => {
  try {
    let { customer, month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Bulan dan tahun wajib diisi.' });

    const bulan = parseInt(month);
    const tahun = parseInt(year);
    const params = [bulan, tahun];
    let whereClause = `WHERE bulan = $1 AND tahun = $2 AND id IS NOT NULL`;

    if (customer && customer.trim() !== '') {
      params.push(`%${customer.trim()}%`);
      whereClause += ` AND nama_customer ILIKE $${params.length}`;
    }
    const q = `
      SELECT * FROM work_orders ${whereClause} ORDER BY tanggal ASC, id ASC;
    `;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/status-barang error', err);
    res.status(500).json({ message: 'Gagal mengambil data status barang.' });
  }
});

// 6. UPDATE STATUS DARI HALAMAN 'STATUS BARANG' (CHECKBOX)
app.patch('/api/workorders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { columnName, value } = req.body;
    if (!columnName) throw new Error('columnName tidak ada');

    const validColumns = ['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran'];
    if (!validColumns.includes(columnName)) {
      return res.status(400).json({ message: 'Nama kolom tidak valid.' });
    }

    const boolValue = (value === true || value === 'true') ? 'true' : 'false';
    let query = `UPDATE work_orders SET "${columnName}" = $1 WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [boolValue, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });
    }

    const updatedRow = result.rows[0];
    
    // 📡 Siarkan perubahan status checkbox
    io.emit('wo_updated', updatedRow);
    console.log(`📡 Siaran [wo_updated] (dari status) terkirim.`);

    res.json({ message: 'Status berhasil diperbarui.', data: updatedRow });
  } catch (error) {
    console.error('❌ Error saat update status:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: error.message });
  }
});

// 7. GET /api/workorders (Endpoint lama, biarkan untuk dashboard)
app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    let { month, year, customer, status } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Bulan & tahun wajib diisi.' });

    let params = [month, year];
    let whereClauses = [];

    if (customer) {
      params.push(`%${customer}%`);
      whereClauses.push(`nama_customer ILIKE $${params.length}`);
    }
    if (status) {
      switch (status) {
        case 'belum_produksi': whereClauses.push(`(di_produksi = 'false' OR di_produksi IS NULL)`); break;
        case 'sudah_produksi': whereClauses.push(`di_produksi = 'true'`); break;
      }
    }

    let sql = `
      SELECT * FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `;
    if (whereClauses.length) sql += ' AND ' + whereClauses.join(' AND ');
    sql += ` ORDER BY tanggal ASC, id ASC`;

    const r = await pool.query(sql, params);

    // 🧠 Gunakan filter aman (tidak crash kalau ada kolom kosong)
    const safeRows = (r.rows || []).filter(item => {
      return item && item.nama_customer !== null && item.nama_customer !== undefined;
    });

    res.json(safeRows);
  } catch (err) {
    console.error('❌ workorders GET (dashboard) error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: err.message });
  }
});


// 8. HAPUS WORK ORDER
app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('DELETE FROM work_orders WHERE id = $1 RETURNING *', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Work order tidak ditemukan.'});
    
    // 📡 Siarkan berita penghapusan
    io.emit('wo_deleted', { id: id, row: r.rows[0] });
    console.log(`📡 Siaran [wo_deleted] terkirim untuk ID: ${id}`);
    
    res.status(204).send();
  } catch (err) {
    console.error('workorders DELETE error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
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
    console.error('GET /api/karyawan error:', err);
    res.status(500).json({ message: 'Gagal mengambil data karyawan.' });
  }
});

app.post('/api/karyawan', authenticateToken, async (req, res) => {
  try {
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body;
    const result = await pool.query(
      `INSERT INTO karyawan (nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nama_karyawan, gaji_harian || 0, potongan_bpjs_kesehatan || 0, potongan_bpjs_ketenagakerjaan || 0, kasbon || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/karyawan error:', err);
    res.status(500).json({ message: 'Gagal menambah karyawan.', error: err.message });
  }
});

app.put('/api/karyawan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body;
    const result = await pool.query(
      `UPDATE karyawan
       SET nama_karyawan=$1, gaji_harian=$2, potongan_bpjs_kesehatan=$3, potongan_bpjs_ketenagakerjaan=$4, kasbon=$5
       WHERE id=$6 RETURNING *`,
      [nama_karyawan, gaji_harian || 0, potongan_bpjs_kesehatan || 0, potongan_bpjs_ketenagakerjaan || 0, kasbon || 0, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/karyawan/:id error:', err);
    res.status(500).json({ message: 'Gagal mengubah data karyawan.' });
  }
});

app.delete('/api/karyawan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM karyawan WHERE id = $1', [id]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/karyawan/:id error:', err);
    res.status(500).json({ message: 'Gagal menghapus karyawan.' });
  }
});

app.post('/api/payroll', authenticateToken, async (req, res) => {
  const client = await pool.connect(); 
  try {
    await client.query('BEGIN'); 
    const { karyawan_id, potongan_kasbon } = req.body;

    if (!karyawan_id || potongan_kasbon === undefined || potongan_kasbon === null) {
      throw new Error('Data karyawan ID dan potongan kasbon diperlukan.');
    }
    
    const updateKasbonQuery = `
      UPDATE karyawan SET kasbon = kasbon - $1 WHERE id = $2 RETURNING id, nama_karyawan, kasbon
    `;
    const kasbonResult = await client.query(updateKasbonQuery, [potongan_kasbon, karyawan_id]);

    if (kasbonResult.rowCount === 0) {
        throw new Error('Karyawan tidak ditemukan saat update kasbon.');
    }

    await client.query('COMMIT'); 
    res.json({ 
        message: 'Payroll berhasil diproses dan kasbon diperbarui.', 
        updatedKaryawan: kasbonResult.rows[0] 
    });
  } catch (err) {
    await client.query('ROLLBACK'); 
    console.error('POST /api/payroll error:', err);
    res.status(500).json({ message: 'Gagal memproses payroll.', error: err.message });
  } finally {
    client.release(); 
  }
});

// --- STOK ---
app.get('/api/stok', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM stok_bahan ORDER BY kode_bahan ASC');
    res.json(r.rows);
  } catch (err) {
    console.error('stok GET error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
  }
});

app.post('/api/stok', authenticateToken, async (req, res) => {
  try {
    const { kode, nama, satuan, kategori, stok, lokasi } = req.body;
    const r = await pool.query('INSERT INTO stok_bahan (kode_bahan, nama_bahan, satuan, kategori, stok, lokasi) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [kode.toUpperCase(), nama, satuan, kategori, stok, lokasi]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('stok POST error', err);
    if (err.code === '23505') return res.status(409).json({ message: 'Kode bahan sudah ada.'});
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
  }
});

app.post('/api/stok/update', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { bahan_id, tipe, jumlah, keterangan } = req.body;
    const bahanResult = await client.query('SELECT * FROM stok_bahan WHERE id = $1 FOR UPDATE', [bahan_id]);
    if (bahanResult.rows.length === 0) throw new Error('Bahan tidak ditemukan.');
    const bahan = bahanResult.rows[0];
    const stokSebelum = parseFloat(bahan.stok);
    const jumlahUpdate = parseFloat(jumlah);
    let stokSesudah;
    if (tipe === 'MASUK') stokSesudah = stokSebelum + jumlahUpdate;
    else if (tipe === 'KELUAR') {
      stokSesudah = stokSebelum - jumlahUpdate;
      if (stokSesudah < 0) throw new Error('Stok tidak mencukupi.');
    } else throw new Error('Tipe transaksi tidak valid.');
    await client.query('UPDATE stok_bahan SET stok = $1, last_update = NOW() WHERE id = $2', [stokSesudah, bahan_id]);
    await client.query('INSERT INTO riwayat_stok (bahan_id, nama_bahan, tipe, jumlah, stok_sebelum, stok_sesudah, keterangan) VALUES ($1,$2,$3,$4,$5,$6,$7)', [bahan_id, bahan.nama_bahan, tipe, jumlahUpdate, stokSebelum, stokSesudah, keterangan]);
    await client.query('COMMIT');
    res.json({ message: 'Stok berhasil diperbarui.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('stok update error', err);
    res.status(500).json({ message: err.message || 'Terjadi kesalahan pada server.'});
  } finally {
    client.release();
  }
});

// --- INVOICE & SURAT JALAN ---
app.get('/api/invoice/:inv', authenticateToken, async (req, res) => {
  try {
    const { inv } = req.params;
    const r = await pool.query('SELECT * FROM work_orders WHERE no_inv = $1', [inv]);
    res.json(r.rows);
  } catch (err) {
    console.error('invoice GET error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
  }
});

app.get('/api/invoices/summary', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    const query = `
      SELECT
        COALESCE(SUM(ukuran::numeric * qty::numeric * harga::numeric), 0) AS total,
        COALESCE(SUM(CASE WHEN pembayaran = 'true' THEN ukuran::numeric * qty::numeric * harga::numeric ELSE 0 END), 0) AS paid
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2 AND no_inv IS NOT NULL AND no_inv != ''
    `;
    const r = await pool.query(query, [month, year]);
    const totalValue = parseFloat(r.rows[0].total);
    const paidValue = parseFloat(r.rows[0].paid);
    res.json({ total: totalValue, paid: paidValue, unpaid: totalValue - paidValue });
  } catch (err) {
    console.error('invoices summary error', err);
    res.status(500).json({ message: 'Gagal mengambil ringkasan invoice.'});
  }
});

app.post('/api/surat-jalan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { tipe, no_invoice, nama_tujuan, items, catatan } = req.body;
    const date = new Date();
    const no_sj_prefix = tipe === 'VENDOR' ? 'SJW' : 'SJC';
    const no_sj = `${no_sj_prefix}-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2,'0')}-${Date.now()}`;
    const result = await client.query(
      `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING no_sj`,
      [tipe, no_sj, no_invoice, nama_tujuan, JSON.stringify(items), catatan]
    );
    if (tipe === 'VENDOR') {
      const itemIds = (items || []).map(i => i.id).filter(Boolean);
      if (itemIds.length) {
        await client.query(`UPDATE work_orders SET di_warna = 'true', no_sj_warna = $1 WHERE id = ANY($2::int[])`, [no_sj, itemIds]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('surat-jalan error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
  } finally {
    client.release();
  }
});

// --- KEUANGAN ---
app.get('/api/keuangan/saldo', authenticateToken, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM kas ORDER BY id ASC');
    res.json(r.rows);
  } catch (err) {
    console.error('keuangan saldo error', err);
    res.status(500).json({ message: 'Gagal mengambil data saldo.'});
  }
});

app.post('/api/keuangan/transaksi', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { tanggal, jumlah, tipe, kas_id, keterangan } = req.body;
    const jumlahNumeric = parseFloat(jumlah);
    const kasResult = await client.query('SELECT * FROM kas WHERE id = $1 FOR UPDATE', [kas_id]);
    if (kasResult.rows.length === 0) throw new Error('Kas tidak ditemukan.');
    const kas = kasResult.rows[0];
    const saldoSebelum = parseFloat(kas.saldo);
    let saldoSesudah = tipe === 'PEMASUKAN' ? saldoSebelum + jumlahNumeric : saldoSebelum - jumlahNumeric;
    await client.query('UPDATE kas SET saldo = $1 WHERE id = $2', [saldoSesudah, kas_id]);
    await client.query('INSERT INTO transaksi_keuangan (tanggal, jumlah, tipe, kas_id, keterangan, saldo_sebelum, saldo_sesudah) VALUES ($1,$2,$3,$4,$5,$6,$7)', [tanggal, jumlahNumeric, tipe, kas_id, keterangan, saldoSebelum, saldoSesudah]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Transaksi berhasil disimpan.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('keuangan transaksi error', err);
    res.status(500).json({ message: err.message || 'Terjadi kesalahan pada server.'});
  } finally {
    client.release();
  }
});

app.get('/api/keuangan/riwayat', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    const q = `
      SELECT tk.id, tk.tanggal, tk.jumlah, tk.tipe, tk.keterangan, tk.saldo_sebelum, tk.saldo_sesudah, k.nama_kas
      FROM transaksi_keuangan tk
      JOIN kas k ON tk.kas_id = k.id
      WHERE EXTRACT(MONTH FROM tk.tanggal) = $1 AND EXTRACT(YEAR FROM tk.tanggal) = $2
      ORDER BY tk.tanggal DESC, tk.id DESC
    `;
    const r = await pool.query(q, [month, year]);
    res.json(r.rows);
  } catch (err) {
    console.error('keuangan riwayat error', err);
    res.status(500).json({ message: 'Gagal mengambil riwayat keuangan.'});
  }
});

// --- ADMIN ---
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!req.user || (req.user.username || '').toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    const r = await pool.query(`
      SELECT id, username, phone_number, role, COALESCE(subscription_status, 'inactive') AS subscription_status
      FROM users
      ORDER BY id ASC
    `);
    res.json(r.rows);
  } catch (err) {
    console.error('users GET error', err);
    res.status(500).json({ message: 'Gagal memuat data user.'});
  }
});

app.post('/api/admin/users/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user || (req.user.username || '').toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    if (!['active','inactive'].includes(status)) return res.status(400).json({ message: 'Status tidak valid.' });
   const r = await pool.query('UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id, username, subscription_status', [status, id]);
    if (r.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.'});
    res.json({ message: `Langganan user berhasil diubah menjadi ${status}.`, user: r.rows[0] });
  } catch (err) {
    console.error('activate user error', err);
    res.status(500).json({ message: 'Gagal mengubah status langganan user.'});
  }
});

// ===================== LOGIKA KONEKSI SOCKET.IO =====================
io.on('connection', (socket) => {
  console.log(`🔌 Seorang user terhubung via Socket: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 User terputus: ${socket.id}`);
s   });
});

// ===================== Fallback (Selalu di Bawah Rute API) =====================
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, 'toto-frontend', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Frontend not found.');
});

// ===================== Start server =====================
httpServer.listen(PORT, () => {
  console.log(`🚀 Server (dan Socket.IO) berjalan di port ${PORT}`);
  console.log(`DATABASE_URL used: ${DATABASE_URL ? '[provided]' : '[none]'}`);
});

