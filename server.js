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
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
  const client = await pool.connect();
  try {
    const summaryQuery = `
      SELECT
        COALESCE(SUM(ukuran::numeric * qty::numeric * harga::numeric), 0) AS total_rupiah,
        COUNT(DISTINCT nama_customer) AS total_customer
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;
    const summaryResult = await client.query(summaryQuery, [month, year]);

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

    res.json({ summary: summaryResult.rows[0], statusCounts: statusResult.rows[0], siapKirimList: [] });
  } catch (err) {
    console.error('dashboard error', err);
    res.status(500).json({ message: 'Gagal mengambil data dashboard.' });
  } finally {
    client.release();
  }
});

app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    let { month, year, customer, status, offset, limit } = req.query;

    // 🔧 PERBAIKAN PENTING
    // Jika parameter dikirim via frontend sebagai object (misal {offset, limit}),
    // pastikan kita abaikan object yang tidak valid.
    if (typeof customer === 'object' || Array.isArray(customer)) customer = '';
    if (typeof status === 'object' || Array.isArray(status)) status = '';
    if (typeof month === 'object') month = month?.value || '';
    if (typeof year === 'object') year = year?.value || '';

    const bulan = Number(month);
    const tahun = Number(year);

    if (!bulan || !tahun) {
      return res.status(400).json({ message: 'Parameter bulan dan tahun wajib diisi.' });
    }

    const parsedOffset = Math.max(0, parseInt(offset || "0", 10));
    const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit || "1000", 10)));

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
        default:
          break;
      }
    }

    let sql = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `;
    if (whereClauses.length) sql += ' AND ' + whereClauses.join(' AND ');
    sql += ` ORDER BY tanggal DESC, id DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parsedLimit, parsedOffset);

    console.log(`DEBUG QUERY /api/workorders => bulan:${bulan} tahun:${tahun}`, params);

    const r = await pool.query(sql, params);
    console.log(`✅ /api/workorders -> ${r.rowCount} baris ditemukan untuk ${bulan}/${tahun}`);
    res.json(r.rows);
  } catch (err) {
    console.error('❌ workorders GET error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});




// Optional alias endpoint that some frontends prefer
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  // simply call the same handler by delegating to /api/workorders handler logic:
  // easiest is to forward to the above by reusing the query params.
  // For simplicity, we call the same controller logic by constructing request-like object:
  return app._router.handle(req, res, () => {});
});


// =============================================================
// PATCH /api/workorders/:id  --> Update sebagian kolom (harga, no_inv, ekspedisi, dll)
// =============================================================
app.patch('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      'tanggal', 'nama_customer', 'deskripsi', 'ukuran', 'qty',
      'harga', 'no_inv', 'di_produksi', 'di_warna',
      'siap_kirim', 'di_kirim', 'pembayaran', 'ekspedisi', 'po_status'
    ];

    const incoming = req.body || {};
    const keys = Object.keys(incoming).filter(k => allowed.includes(k));

    if (keys.length === 0)
      return res.status(400).json({ message: 'Tidak ada field valid untuk diupdate.' });

    const setParts = [];
    const values = [];
    let idx = 1;

    // ✅✅✅ PERBAIKAN BUG ADA DI SINI ✅✅✅
    for (const k of keys) {
      if (k === 'tanggal') {
        const d = new Date(incoming.tanggal);
        if (isNaN(d)) return res.status(400).json({ message: 'Format tanggal tidak valid.' });
        setParts.push(`tanggal = $${idx++}`);
        values.push(incoming.tanggal);

        // auto-update bulan & tahun
        setParts.push(`bulan = $${idx++}`);
        values.push(d.getMonth() + 1);
        setParts.push(`tahun = $${idx++}`);
        values.push(d.getFullYear());
      } else {
        
        // Logika dipindahkan ke DALAM loop 'else'
        let value = incoming[k];
        
        // Ubah string kosong "" menjadi NULL untuk kolom angka
        if ((k === 'harga' || k === 'ukuran' || k === 'qty') && value === '') {
            value = null;
        }

        setParts.push(`"${k}" = $${idx++}`);
        values.push(value); // Gunakan 'value' yang sudah difilter
      }
    }
    // --- (Kode yang salah tempat sudah dihapus) ---

    const sql = `UPDATE work_orders SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`;
    values.push(id);

    const result = await pool.query(sql, values);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });

    res.json({ message: 'Berhasil update work order.', data: result.rows[0] });
  } catch (err) {
    console.error('PATCH /api/workorders/:id error', err);
    res.status(500).json({ message: 'Gagal mengupdate work order.', error: err.message });
  }
});
// ✅✅✅ AKHIR DARI PERBAIKAN ✅✅✅


app.put('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv } = req.body;
    const date = new Date(tanggal);
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();
    const r = await pool.query(
      `UPDATE work_orders SET tanggal=$1, nama_customer=$2, deskripsi=$3, ukuran=$4, qty=$5, harga=$6, no_inv=$7, bulan=$8, tahun=$9 WHERE id=$10 RETURNING *`,
      [tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ message: 'Work order tidak ditemukan.'});
    res.json(r.rows[0]);
  } catch (err) {
    console.error('workorders PUT error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.'});
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

// -- Mark printed (bulk)
app.post('/api/workorders/mark-printed', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Array of IDs wajib diisi.' });
    }

    // ⚙️ Perubahan di sini:
    // Tidak ubah di_produksi lagi, hanya tandai po_status saja.
    const updateResult = await client.query(
      `UPDATE work_orders 
       SET po_status = 'PRINTED', 
           di_produksi = 'true'  -- Tambahkan ini
       WHERE id = ANY($1::int[])`, // Gunakan ANY untuk array
      [ids]
    );

    await client.query('COMMIT');
    res.json({ message: `${updateResult.rowCount} item ditandai sebagai PRINTED dan masih dapat diedit.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('mark-printed error', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  } finally {
    client.release();
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

    console.log("PATCH status req:", { id, columnName, value }); // 🧩 Tambahkan ini

    const validColumns = ['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran', 'ekspedisi'];
    if (!validColumns.includes(columnName)) {
      console.log("❌ Kolom tidak valid:", columnName);
      return res.status(400).json({ message: 'Nama kolom tidak valid.' });
    }

    // Konversi ke string 'true' / 'false'
    if (['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran'].includes(columnName)) {
      value = (value === true || value === 'true') ? 'true' : 'false';
    }

    console.log(`🔧 Update kolom "${columnName}" ke "${value}" untuk ID ${id}`);

    const updatedWorkOrder = await pool.query(
      `UPDATE work_orders SET "${columnName}" = $1 WHERE id = $2 RETURNING *`,
      [value, id]
    );

    if (updatedWorkOrder.rows.length === 0) {
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });
    }

    res.json(updatedWorkOrder.rows[0]);
  } catch (error) {
    console.error('❌ Error saat update status:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.', error: error.message });
  }
});

// =============================================================
// POST /api/workorders  --> Tambah Work Order BARU
// =============================================================
app.post('/api/workorders', authenticateToken, async (req, res) => {
  try {
    // 1. Ambil data dari frontend
    const { tanggal, nama_customer, deskripsi, ukuran, qty } = req.body;

    // 2. Validasi data
    if (!tanggal || !nama_customer || !deskripsi) {
      return res.status(400).json({ message: 'Tanggal, Customer, dan Deskripsi wajib diisi.' });
    }

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
      tanggal,        // $1
      nama_customer,  // $2
      deskripsi,      // $3
      ukuran || null, // $4 (kirim null jika kosong)
      qty || null,    // $5 (kirim null jika kosong)
      bulan,          // $6
      tahun           // $7
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