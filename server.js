// server.js
// Versi lengkap server untuk deployment (Railway/Render/Heroku)
// Author: Generated for Faisal
// Paste ke project root, jalankan: node server.js (atau gunakan process manager)

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// ===================== Config / Env =====================
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci-rahasia-super-aman-untuk-toto-app';

// Jika ingin fallback DEVELOPMENT DB (jangan commit kredensial nyata)
const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL || 'postgresql://postgres:KiSLCzRPLsZzMivAVAVjzpEOBVTkCEHe@postgres.railway.internal:5432/railway';
const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB;

// ===================== Middleware =====================
app.use(express.json());
app.options('*', cors()); // ✅ biar preflight CORS aman

// Allow frontend domains (tambahkan domain lain jika perlu)
const FRONTEND_ALLOWED = [
  'https://erptoto.up.railway.app', // ✅ tambahkan ini
  'http://localhost:5500',
  'http://localhost:5000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5000'
];


app.use(cors({
  origin: '*', // 🔥 buka untuk semua domain
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-access-token'],
}));


// Serve frontend static jika Anda ingin backend juga melayani UI
// ===================== Fallback: serve frontend index for non-API routes =====================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'toto-frontend')));

app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, 'toto-frontend', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Frontend not found.');
});


// ===================== Postgres Pool =====================
// Railway / Heroku style: if DATABASE_URL present, enable ssl rejectUnauthorized false
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


// Helper untuk logging koneksi DB (opsional)
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
    // jika req.user belum tersedia, pakai timestamp
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
      if (err) return res.status(403).json({ message: 'Token tidak valid atau sesi telah berakhir.' });
      req.user = user;
      next();
    });
  } catch (err) {
    console.error('authenticateToken error', err);
    res.status(500).json({ message: 'Error otentikasi.' });
  }
}

// ===================== Routes =====================

// -- Register (minimal, used for initial seeding if needed)
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username dan password wajib diisi.' });

    const hashed = await bcrypt.hash(password, 10);
    const r = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role',
      [username, hashed, role || 'user']
    );
    res.status(201).json({ message: 'Registrasi berhasil', user: r.rows[0] });
  } catch (err) {
    console.error('register error', err);
    if (err.code === '23505') return res.status(409).json({ message: 'Username sudah digunakan.'});
    res.status(500).json({ message: 'Error server saat registrasi.'});
  }
});

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

    // Jika bukan admin dan subscription inactive → tolak login
    if (user.role !== 'admin' && user.subscription_status === 'inactive') {
      return res.status(403).json({
        message:
          'Langganan terhenti sejenak karena pembayaran langganan tertunda.\n\n' +
          'Silakan kunjungi link berikut untuk melakukan pembayaran:\n' +
          'https://lynk.id/rerelie/dol3n5710m79/checkout\n\n' +
          'Salam hangat,\nRere Lie & Andreqve 💛'
      });
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

// -- Update profile (username + profile picture)
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

// -- Dashboard summary (example)
// ======================================================
// 📊 DASHBOARD SUMMARY (Aman dari format angka lokal)
// ======================================================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
  }

  const client = await pool.connect();
  try {
    // 🧩 Gunakan REPLACE untuk ubah koma ke titik sebelum cast ke numeric
    const summaryQuery = `
      SELECT
        COALESCE(SUM(
          NULLIF(REPLACE(ukuran, ',', '.')::numeric, 0) *
          NULLIF(REPLACE(qty, ',', '.')::numeric, 0) *
          NULLIF(REPLACE(harga, ',', '.')::numeric, 0)
        ), 0) AS total_rupiah,
        COUNT(DISTINCT nama_customer) AS total_customer
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;

    const summaryResult = await client.query(summaryQuery, [month, year]);

    // 📦 Status Query tetap sama
    const statusQuery = `
      SELECT
        COUNT(*) FILTER (WHERE (di_produksi = 'false' OR di_produksi IS NULL)) AS belum_produksi,
        COUNT(*) FILTER (WHERE di_produksi = 'true' AND (di_warna = 'false' OR di_warna IS NULL) AND (siap_kirim = 'false' OR siap_kirim IS NULL) AND (di_kirim = 'false' OR di_kirim IS NULL)) AS sudah_produksi,
        COUNT(*) FILTER (WHERE di_warna = 'true' AND (siap_kirim = 'false' OR siap_kirim IS NULL) AND (di_kirim = 'false' OR di_kirim IS NULL)) AS di_warna,
        COUNT(*) FILTER (WHERE siap_kirim = 'true' AND (di_kirim = 'false' OR di_kirim IS NULL)) AS siap_kirim,
        COUNT(*) FILTER (WHERE di_kirim = 'true') AS di_kirim
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;
    const statusResult = await client.query(statusQuery, [month, year]);

    res.json({
      summary: summaryResult.rows[0],
      statusCounts: statusResult.rows[0],
      siapKirimList: []
    });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ message: 'Gagal mengambil data dashboard.' });
  } finally {
    client.release();
  }
});

// =============================================================
// ✅ GET /api/workorders — ambil data Work Order
//     - tetap bisa untuk tabel besar (fitur 10.000 baris)
//     - dashboard hanya menampilkan data berisi (filter otomatis)
// =============================================================
app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    let { month, year, customer, status, offset, limit } = req.query;

    // 🔧 Normalisasi parameter
    if (typeof customer === 'object' || Array.isArray(customer)) customer = '';
    if (typeof status === 'object' || Array.isArray(status)) status = '';
    if (typeof month === 'object') month = month?.value || '';
    if (typeof year === 'object') year = year?.value || '';

    const bulan = Number(month);
    const tahun = Number(year);

    if (!bulan || !tahun) {
      return res.status(400).json({ message: 'Parameter bulan dan tahun wajib diisi.' });
    }

    // 🔢 Pagination
    const parsedOffset = Math.max(0, parseInt(offset || "0", 10));
    const parsedLimit = Math.min(10000, Math.max(1, parseInt(limit || "10000", 10)));

    // ====== Query Builder ======
    let params = [bulan, tahun];
    let idx = 3;
    let whereClauses = [];

    if (customer && typeof customer === 'string' && customer.trim() !== '') {
      params.push(`%${customer.trim()}%`);
      whereClauses.push(`nama_customer ILIKE $${idx++}`);
    }

    if (status && typeof status === 'string' && status.trim() !== '') {
      switch (status) {
        case 'belum_produksi':
          whereClauses.push(`(di_produksi = false OR di_produksi IS NULL)`);
          break;
        case 'sudah_produksi':
          whereClauses.push(`di_produksi = true`);
          break;
      }
    }

    let sql = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `;
    if (whereClauses.length) sql += ' AND ' + whereClauses.join(' AND ');
    sql += ` ORDER BY tanggal NULLS LAST, id ASC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parsedLimit, parsedOffset);

    console.log(`🟢 DEBUG QUERY /api/workorders => bulan:${bulan} tahun:${tahun}`, params);

    const r = await pool.query(sql, params);

    // ===============================
    // 🔧 Tambahkan baris kosong otomatis (khusus tabel Work Orders)
    // ===============================
    const totalTarget = 10000;
    const startRow = parsedOffset;
    const endRow = parsedOffset + parsedLimit;
    const existingCount = r.rows.length;

    const result = [...r.rows];
    const expectedCount = endRow > totalTarget ? totalTarget - startRow : parsedLimit;

    if (existingCount < expectedCount) {
      const missing = expectedCount - existingCount;
      for (let i = 0; i < missing; i++) {
        const globalIndex = startRow + existingCount + i;
        if (globalIndex >= totalTarget) break;
        result.push({
          id: null,
          tanggal: null,
          nama_customer: "",
          deskripsi: "",
          ukuran: null,
          qty: null,
          bulan,
          tahun,
        });
      }
    }

    // ===============================
    // 🧹 Filter agar dashboard tidak menerima data kosong
    // ===============================
    const filteredResult = result.filter(item =>
      item.nama_customer && item.deskripsi && item.qty !== null && item.qty > 0
    );

    // Jika dashboard memanggil tanpa pagination → kirim hanya data berisi
    if (!offset && !limit) {
      console.log('📊 Mode dashboard aktif: hanya data berisi dikirim');
      return res.json(filteredResult);
    }

    // Jika halaman work-orders → kirim semua (termasuk baris kosong)
    res.json(result);

  } catch (err) {
    console.error('❌ workorders GET error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});





app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('DELETE FROM work_orders WHERE id = $1', [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Work order tidak ditemukan.'});
    res.status(204).send();
  } catch (err) {
    console.error('workorders DELETE error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
  }
});

// =============================================================
// 🔍 POST /api/workorders/by-ids — ambil data spesifik untuk print PO
// =============================================================
app.post('/api/workorders/by-ids', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length)
      return res.status(400).json({ message: 'Daftar ID tidak valid.' });

    const result = await pool.query(
      `SELECT id, nama_customer, deskripsi, ukuran, qty, tanggal
       FROM work_orders
       WHERE id = ANY($1::int[])
       ORDER BY tanggal ASC, id ASC`,
      [ids]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/workorders/by-ids error:', err);
    res.status(500).json({ message: 'Gagal mengambil data PO.' });
  }
});


// =============================================================
// GET /api/barang-siap-warna  --> Ambil semua WO yang sudah di_produksi tapi belum di_warna
// =============================================================
app.get('/api/barang-siap-warna', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        tanggal, 
        nama_customer, 
        deskripsi, 
        ukuran, 
        qty,
        di_produksi,
        di_warna
      FROM work_orders
      WHERE 
        di_produksi = 'true' 
        AND (di_warna = 'false' OR di_warna IS NULL)
      ORDER BY tanggal ASC, id ASC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/barang-siap-warna error:', err);
    res.status(500).json({ message: 'Gagal mengambil data barang siap warna.' });
  }
});


// =============================================================
// PATCH /api/workorders/:id/status  --> Update kolom status tertentu (checkbox, ekspedisi, dll)
// =============================================================
// (HANYA SATU KALI, DUPLIKAT DIHAPUS)
app.patch('/api/workorders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { columnName, value } = req.body;

    console.log("PATCH status req:", { id, columnName, value });

    const validColumns = [
      'di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran', 'ekspedisi'
    ];
    if (!validColumns.includes(columnName)) {
      return res.status(400).json({ message: 'Nama kolom tidak valid.' });
    }

    // Konversi boolean ke string
    const boolValue = (value === true || value === 'true') ? 'true' : 'false';

    // Jalankan transaksi
    const client = await pool.connect();
    await client.query('BEGIN');

    // Update utama
    let query = `UPDATE work_orders SET "${columnName}" = $1`;

    // ✅ Jika kolom di_produksi diubah menjadi true → otomatis centang print_po
    if (columnName === 'di_produksi' && boolValue === 'true') {
      query += `, print_po = 'true'`;
    }

    query += ` WHERE id = $2 RETURNING *`;

    const result = await client.query(query, [boolValue, id]);
    await client.query('COMMIT');
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });
    }

    res.json({
      message: 'Status berhasil diperbarui.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error saat update status:', error);
    res.status(500).json({
      message: 'Terjadi kesalahan pada server.',
      error: error.message,
    });
  }
});

// ======================================================
// ✅ MARK WORK ORDERS AS PRINTED (FINAL)
// ======================================================
// ======================================================
// ✅ MARK WORK ORDERS AS PRINTED (FINAL DEBUG MODE)
// ======================================================
app.post('/api/workorders/mark-printed', authenticateToken, async (req, res) => {
  try {
    let { ids } = req.body;
    console.log('📦 Data diterima dari frontend:', req.body);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Data ID tidak valid.' });
    }

    // Convert semua ke integer
    ids = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
    console.log('🧩 IDs setelah dikonversi:', ids);

    // Cek tabel workorders
    const checkTable = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'workorders';
    `);
    console.log('📋 Kolom di tabel workorders:', checkTable.rows.map(r => r.column_name));

    // Jalankan update
    const query = `
      UPDATE work_orders
      SET di_produksi = TRUE
      WHERE id = ANY($1)
      RETURNING id;
    `;

    const result = await pool.query(query, [ids]);
    console.log('✅ Query berhasil:', result.rowCount, 'baris diperbarui.');

    res.json({
      message: `Berhasil menandai ${result.rowCount} Work Order sebagai printed.`,
      updated: result.rows,
    });

  } catch (err) {
    console.error('❌ ERROR DI /mark-printed:', err);
    res.status(500).json({
      message: 'Terjadi kesalahan pada server.',
      error: err.message,
      stack: err.stack, // tambahkan agar bisa dilihat di Railway log
    });
  }
});





  

// =============================================================
// POST /api/workorders  --> Tambah Work Order BARU
// =============================================================
app.post('/api/workorders', authenticateToken, async (req, res) => {
  try {
    // 1. Ambil data dari frontend
    const { tanggal, nama_customer, deskripsi, ukuran, qty } = req.body;
    console.log("🟢 Data diterima POST /api/workorders:", req.body);


    // 2. Validasi data
    // Jika tanggal kosong, isi otomatis dengan hari ini
const today = new Date();
const tanggalFinal = tanggal || today.toISOString().slice(0, 10);

if (!deskripsi) {
  return res.status(400).json({ message: 'Deskripsi wajib diisi.' });
}

// Jika nama_customer kosong, isi default jadi 'Tanpa Nama'
const namaFinal = nama_customer || 'Tanpa Nama';


    // 3. Siapkan data untuk database (termasuk bulan dan tahun)
    const date = new Date(tanggal);
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();

    // 4. Query SQL (PASTIKAN nama tabel 'work_orders' dan kolomnya sudah benar)
    const query = `
      INSERT INTO work_orders 
        (tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun) 
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `;
    
    // 5. Values (URUTAN HARUS SAMA DENGAN QUERY DI ATAS)
    const values = [
  tanggalFinal,     // $1
  namaFinal,        // $2
  deskripsi,        // $3
  ukuran || null,   // $4
  qty || null,      // $5
  bulan,            // $6
  tahun             // $7
];


    // 6. Eksekusi
    const result = await pool.query(query, values);

    // 7. Kirim balasan sukses
    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('workorders POST error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
  }
});

// =============================================================
// GET /api/workorders/chunk  --> untuk lazy load (500 baris per batch)
// =============================================================
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  try {
    const { month, year, offset = 0, limit = 500 } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Parameter month dan year wajib diisi.' });
    }

    const bulan = parseInt(month);
    const tahun = parseInt(year);
    const parsedOffset = Math.max(0, parseInt(offset));
    const parsedLimit = Math.min(500, parseInt(limit));

    const q = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, di_produksi
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
      ORDER BY tanggal, id
      LIMIT $3 OFFSET $4
    `;

    const r = await pool.query(q, [bulan, tahun, parsedLimit, parsedOffset]);
    res.json(r.rows);
  } catch (err) {
    console.error('❌ workorders CHUNK error:', err);
    res.status(500).json({ message: 'Gagal memuat data chunk.', error: err.message });
  }
});

// =============================================================
// GET /api/workorders/by-date  --> Filter berdasarkan tanggal
// =============================================================
app.get('/api/workorders/by-date', authenticateToken, async (req, res) => {
  try {
    const { month, year, tanggal } = req.query;
    if (!month || !year || !tanggal)
      return res.status(400).json({ message: 'Parameter bulan, tahun, dan tanggal wajib diisi.' });

    const bulan = parseInt(month);
    const tahun = parseInt(year);

    const q = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
             no_inv, di_produksi, di_warna, siap_kirim, di_kirim, pembayaran, ekspedisi
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2 
        AND tanggal::date = $3::date
      ORDER BY tanggal, id
    `;

    const result = await pool.query(q, [bulan, tahun, tanggal]);

    // 🔧 Tambahkan fallback baris kosong jika tidak ada data
    if (result.rows.length === 0) {
      return res.json([
        {
          id: null,
          tanggal,
          nama_customer: '',
          deskripsi: '',
          ukuran: null,
          qty: null,
          harga: null,
          no_inv: '',
          di_produksi: false,
          di_warna: false,
          siap_kirim: false,
          di_kirim: false,
          pembayaran: false,
          ekspedisi: ''
        }
      ]);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/workorders/by-date error:', err);
    res.status(500).json({ message: 'Gagal memuat data berdasarkan tanggal.', error: err.message });
  }
});


// =============================================================
// GET /api/status-barang  --> Ambil hanya data real dari work_orders
// =============================================================
app.get('/api/status-barang', authenticateToken, async (req, res) => {
  try {
    let { customer, month, year } = req.query;

    if (!month || !year)
      return res.status(400).json({ message: 'Parameter bulan dan tahun wajib diisi.' });

    const bulan = parseInt(month);
    const tahun = parseInt(year);
    const params = [bulan, tahun];
    let whereClause = `WHERE bulan = $1 AND tahun = $2 AND id IS NOT NULL`;

    if (customer && customer.trim() !== '') {
      params.push(`%${customer.trim()}%`);
      whereClause += ` AND nama_customer ILIKE $${params.length}`;
    }

    const q = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, harga, 
             no_inv, di_produksi, di_warna, siap_kirim, di_kirim, pembayaran
      FROM work_orders
      ${whereClause}
      ORDER BY tanggal ASC, id ASC;
    `;

    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/status-barang error', err);
    res.status(500).json({ message: 'Gagal mengambil data status barang.' });
  }
});

// =============================================================
// PATCH /api/workorders/:id  --> Update banyak kolom sekaligus
// =============================================================
app.patch('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'Tidak ada data yang dikirim.' });
    }

    // Validasi kolom agar tidak bisa ubah field aneh
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

    // Susun query dinamis
    const setClauses = [];
    const values = [];
    let i = 1;

    for (const [key, val] of Object.entries(filteredUpdates)) {
      setClauses.push(`"${key}" = $${i}`);
      // Konversi boolean ke string agar sesuai dengan database
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

    res.json({ message: 'Data berhasil diperbarui.', data: result.rows[0] });
  } catch (err) {
    console.error('❌ PATCH /api/workorders/:id error:', err);
    res.status(500).json({ message: 'Gagal memperbarui data.', error: err.message });
  }
});

// ===================== KARYAWAN CRUD =====================

// Ambil semua data karyawan
app.get('/api/karyawan', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM karyawan ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/karyawan error:', err);
    res.status(500).json({ message: 'Gagal mengambil data karyawan.' });
  }
});

// Tambah karyawan baru
app.post('/api/karyawan', authenticateToken, async (req, res) => {
  try {
    // 👇 PERBAIKAN DI SINI: Sesuaikan nama variabel dengan frontend
    const { 
        nama_karyawan, 
        gaji_harian, 
        potongan_bpjs_kesehatan, 
        potongan_bpjs_ketenagakerjaan, 
        kasbon 
    } = req.body;

    const result = await pool.query(
      `INSERT INTO karyawan (nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon)
  VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      // 👇 PERBAIKAN DI SINI: Gunakan variabel yang benar
      [nama_karyawan, gaji_harian || 0, potongan_bpjs_kesehatan || 0, potongan_bpjs_ketenagakerjaan || 0, kasbon || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/karyawan error:', err);
    // Kirim pesan error asli dari database
    res.status(500).json({ message: 'Gagal menambah karyawan.', error: err.message });
  }
});

// Edit data karyawan
app.put('/api/karyawan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // 👇 PERBAIKAN DI SINI: Sesuaikan nama variabel dengan frontend
    const { 
        nama_karyawan, 
        gaji_harian, 
        potongan_bpjs_kesehatan, 
        potongan_bpjs_ketenagakerjaan, 
        kasbon 
    } = req.body;

    const result = await pool.query(
      `UPDATE karyawan
       SET nama_karyawan=$1, gaji_harian=$2, potongan_bpjs_kesehatan=$3, potongan_bpjs_ketenagakerjaan=$4, kasbon=$5
       WHERE id=$6 RETURNING *`,
      // 👇 PERBAIKAN DI SINI: Gunakan variabel yang benar
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

// Hapus data karyawan
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

// ===================== PAYROLL PROCESSING =====================
app.post('/api/payroll', authenticateToken, async (req, res) => {
  const client = await pool.connect(); // Gunakan transaksi untuk keamanan
  try {
    await client.query('BEGIN'); // Mulai transaksi

    // 1. Ambil data payroll dari frontend
    const { 
        karyawan_id, 
        potongan_kasbon, // Hanya ambil yang relevan untuk update DB
        // ... (Anda bisa ambil field lain jika ingin disimpan ke tabel riwayat)
        periode_gaji, 
        gaji_bersih 
    } = req.body;

    // 2. Validasi sederhana
    if (!karyawan_id || potongan_kasbon === undefined || potongan_kasbon === null) {
      throw new Error('Data karyawan ID dan potongan kasbon diperlukan.');
    }
    
    // 3. Update kasbon di tabel karyawan
    // Asumsi: 'kasbon' di tabel karyawan menyimpan SISA kasbon.
    // Kita kurangi sisa kasbon dengan jumlah yang dipotong di slip gaji.
    const updateKasbonQuery = `
      UPDATE karyawan 
      SET kasbon = kasbon - $1 
      WHERE id = $2 
      RETURNING id, nama_karyawan, kasbon -- Kembalikan data kasbon terbaru
    `;
    const kasbonResult = await client.query(updateKasbonQuery, [potongan_kasbon, karyawan_id]);

    if (kasbonResult.rowCount === 0) {
        throw new Error('Karyawan tidak ditemukan saat update kasbon.');
    }

    // (Opsional) 4. Simpan riwayat payroll ke tabel lain (jika ada)
    // Jika Anda punya tabel 'payroll_history', tambahkan INSERT di sini
    // await client.query('INSERT INTO payroll_history (...) VALUES (...)', [...]);

    await client.query('COMMIT'); // Selesaikan transaksi jika semua berhasil

    res.json({ 
        message: 'Payroll berhasil diproses dan kasbon diperbarui.', 
        updatedKaryawan: kasbonResult.rows[0] 
    });

  } catch (err) {
    await client.query('ROLLBACK'); // Batalkan semua perubahan jika ada error
    console.error('POST /api/payroll error:', err);
    res.status(500).json({ message: 'Gagal memproses payroll.', error: err.message });
  } finally {
    client.release(); // Selalu lepaskan koneksi client
  }
});


// -- Stok bahan
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

// -- Invoice lookup
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

// -- Invoices summary
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

// -- Surat jalan (transactional)
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

// -- Keuangan: saldo & transaksi & riwayat
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

// -- Refresh token
app.post('/api/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: 'Token wajib dikirim.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: 'Token tidak valid atau sudah kadaluarsa.' });

      // Buat token baru dengan data user yang sama
      const newToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({ token: newToken });
    });
  } catch (err) {
    console.error('refresh token error', err);
    res.status(500).json({ message: 'Gagal memperbarui token.' });
  }
});


// -- API users for admin page (only Faisal)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!req.user || (req.user.username || '').toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak. Hanya admin (Faisal) yang dapat melihat data user.' });
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

// -- Activate / Deactivate subscription (only Faisal)
app.post('/api/admin/users/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user || (req.user.username || '').toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak. Hanya Faisal yang dapat mengubah status langganan.' });
    }
    if (!['active','inactive'].includes(status)) return res.status(400).json({ message: 'Status tidak valid. Gunakan "active" atau "inactive".' });
    const r = await pool.query('UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id, username, subscription_status', [status, id]);
    if (r.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.'});
    res.json({ message: `Langganan user berhasil diubah menjadi ${status}.`, user: r.rows[0] });
  } catch (err) {
    console.error('activate user error', err);
    res.status(500).json({ message: 'Gagal mengubah status langganan user.'});
  }
});

// ===================== Start server =====================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`DATABASE_URL used: ${DATABASE_URL ? '[provided]' : '[none]'}`);
});