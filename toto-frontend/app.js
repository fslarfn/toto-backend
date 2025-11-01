// ==========================================================
// 🚀 SERVER.JS (FINAL — STABIL, REALTIME, PRODUKSI)
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
const FALLBACK_DB = process.env.FALLBACK_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/railway';
const DATABASE_URL = process.env.DATABASE_URL || FALLBACK_DB;

// ===================== Buat HTTP & Socket.IO Server =====================
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
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
// 📊 DASHBOARD API
// =============================================================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE di_produksi IS NULL OR di_produksi = false) AS belum_produksi,
        COUNT(*) FILTER (WHERE di_produksi = true AND (di_warna IS NULL OR di_warna = false)) AS sudah_produksi,
        COUNT(*) FILTER (WHERE di_warna = true AND (siap_kirim IS NULL OR siap_kirim = false)) AS sudah_warna,
        COUNT(*) FILTER (WHERE siap_kirim = true AND (di_kirim IS NULL OR di_kirim = false)) AS siap_kirim,
        COUNT(*) FILTER (WHERE di_kirim = true) AS sudah_kirim,
        COALESCE(SUM(CASE WHEN ukuran ~ '^[0-9\\.,]+' THEN (replace(ukuran, ',', '.')::numeric * COALESCE(NULLIF(qty,''), '1')::numeric) ELSE 0 END), 0) AS total_qty,
        COUNT(DISTINCT nama_customer) AS total_customer
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `, [month, year]);

    const r = result.rows[0];
    res.json({
      total_customer: Number(r.total_customer || 0),
      total_qty: Number(r.total_qty || 0),
      status_summary: {
        belum_produksi: Number(r.belum_produksi || 0),
        sudah_produksi: Number(r.sudah_produksi || 0),
        sudah_warna: Number(r.sudah_warna || 0),
        siap_kirim: Number(r.siap_kirim || 0),
        sudah_kirim: Number(r.sudah_kirim || 0),
      }
    });
  } catch (err) {
    console.error("❌ /api/dashboard error:", err);
    res.status(500).json({ message: "Gagal memuat data dashboard." });
  }
});

// =============================================================
// --- KARYAWAN, STOK, INVOICE, KEUANGAN, SURAT JALAN, ADMIN ---
// (implementasi sesuai kode awal yang kamu kirim — ringkasan / complete)
// =============================================================

// KARYAWAN
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
    console.error('POST /api/karyawan error', err);
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
    if (result.rows.length === 0) return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/karyawan/:id error', err);
    res.status(500).json({ message: 'Gagal mengubah data karyawan.' });
  }
});
app.delete('/api/karyawan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM karyawan WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/karyawan/:id error', err);
    res.status(500).json({ message: 'Gagal menghapus karyawan.' });
  }
});

// PAYROLL (kasbon update)
app.post('/api/payroll', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { karyawan_id, potongan_kasbon } = req.body;
    if (!karyawan_id || potongan_kasbon === undefined || potongan_kasbon === null)
      throw new Error('Data karyawan ID dan potongan kasbon diperlukan.');
    const updateKasbonQuery =
      `UPDATE karyawan SET kasbon = kasbon - $1 WHERE id = $2 RETURNING id, nama_karyawan, kasbon`;
    const kasbonResult = await client.query(updateKasbonQuery, [potongan_kasbon, karyawan_id]);
    if (kasbonResult.rowCount === 0) throw new Error('Karyawan tidak ditemukan saat update kasbon.');
    await client.query('COMMIT');
    res.json({ message: 'Payroll berhasil diproses dan kasbon diperbarui.', updatedKaryawan: kasbonResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/payroll error:', err);
    res.status(500).json({ message: 'Gagal memproses payroll.', error: err.message });
  } finally {
    client.release();
  }
});

// STOK
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

// INVOICE
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

// SURAT JALAN
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

// KEUANGAN
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

// ADMIN
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

// =============================================================
// SOCKET.IO LOGIC (Realtime Updates)
// =============================================================
io.on('connection', (socket) => {
  console.log(`🔌 User terhubung: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 User terputus: ${socket.id}`);
  });

  // Terima event dari client, terus broadcast ke client lain
  socket.on('wo_created', (data) => {
    socket.broadcast.emit('wo_created', data);
  });

  socket.on('wo_updated', (data) => {
    socket.broadcast.emit('wo_updated', data);
  });

  socket.on('wo_deleted', (data) => {
    socket.broadcast.emit('wo_deleted', data);
  });
});

// ===================== Fallback untuk frontend (index.html) =====================
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, 'toto-frontend', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Frontend not found.');
});

// ===================== Start Server =====================
httpServer.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`DATABASE_URL used: ${DATABASE_URL ? '[provided]' : '[none]'}`);
});
