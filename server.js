// ===============================================
//           1. IMPORT SEMUA LIBRARY
// ===============================================
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// ===============================================
//           2. INISIALISASI APLIKASI
// ===============================================
const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "kunci-rahasia-super-aman-untuk-toto-app";

// ===============================================
//           3. KONFIGURASI MIDDLEWARE
// ===============================================
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://toto-frontend.vercel.app',
  'https://erptoto.up.railway.app', // 🌍 domain Railway kamu
  'https://erptoto-production.up.railway.app', // antisipasi domain build baru Railway
];


app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`🚫 CORS Blocked Origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================================
//           4. KONFIGURASI DATABASE (Render)
// ===============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});


pool
  .connect()
  .then(() => console.log("🟢 Koneksi PostgreSQL Render berhasil"))
  .catch((err) => console.error("🔴 Gagal konek DB:", err.message));

// ===============================================
//           5. KONFIGURASI UPLOAD FILE
// ===============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const userId = req.user ? req.user.id : "guest";
    cb(null, `${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ===============================================
//           6. AUTENTIKASI JWT
// ===============================================
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    let token = authHeader && authHeader.split(" ")[1];
    if (!token && req.headers["x-access-token"]) token = req.headers["x-access-token"];
    if (!token) return res.status(401).json({ message: "Token tidak ditemukan." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: "Token tidak valid atau sesi berakhir." });
      req.user = user;
      next();
    });
  } catch (err) {
    console.error("JWT Verify Error:", err);
    res.status(500).json({ message: "Kesalahan autentikasi server." });
  }
}

// ===============================================
//           7. HELPER FUNGSI
// ===============================================
function jsonDeleteResponse(result, entityName = "Data") {
  if (result.rowCount === 0) {
    return { status: 404, json: { message: `${entityName} tidak ditemukan.` } };
  }
  return { status: 200, json: { message: `${entityName} berhasil dihapus.` } };
}


// ===============================================
//           8. ENDPOINTS / ROUTES
// ===============================================

// ======================
// 🔹 REGISTER
// ======================
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username dan password wajib diisi.' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashedPassword, 'admin']
    );
    res.status(201).json({ message: 'Registrasi berhasil!', user: newUser.rows[0] });
  } catch (error) {
    if (error.code === '23505')
      return res.status(409).json({ message: 'Username sudah digunakan.' });
    console.error('Error saat registrasi:', error);
    res.status(500).json({ message: 'Kesalahan server.' });
  }
});

// ======================
// 🔹 LOGIN
// ======================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username dan password wajib diisi.' });

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0)
      return res.status(401).json({ message: 'Username atau password salah!' });

    const user = userResult.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch)
      return res.status(401).json({ message: 'Username atau password salah!' });

    if (user.role !== 'admin' && user.subscription_status === 'inactive') {
      return res.status(403).json({
        message: 'Langganan Anda nonaktif. Hubungi admin untuk memperpanjang langganan.',
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(200).json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subscription_status: user.subscription_status,
      },
    });
  } catch (error) {
    console.error('Error saat login:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// ===============================
// 👤 PROFIL & USER AUTH
// ===============================

// Ambil data user yang sedang login
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, subscription_status FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'User tidak ditemukan.' });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error /api/me:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// Update profil user
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'Username wajib diisi.' });

    await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, req.user.id]);
    res.json({ message: 'Profil berhasil diperbarui.' });
  } catch (error) {
    console.error('Error /api/user/profile:', error);
    res.status(500).json({ message: 'Gagal memperbarui profil.' });
  }
});

// Ganti password user
app.put('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res.status(400).json({ message: 'Password lama dan baru wajib diisi.' });

    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0)
      return res.status(404).json({ message: 'User tidak ditemukan.' });

    const isMatch = await bcrypt.compare(oldPassword, userResult.rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Password lama salah.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, req.user.id]);

    res.json({ message: 'Password berhasil diubah.' });
  } catch (error) {
    console.error('Error /api/user/change-password:', error);
    res.status(500).json({ message: 'Gagal mengubah password.' });
  }
});


// ======================
// 🔹 DASHBOARD
// ======================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
  }

  const client = await pool.connect();
  try {
    const summaryQuery = `
    SELECT
      COALESCE(SUM(CAST(NULLIF(TRIM(ukuran), '') AS numeric) *
                   CAST(NULLIF(TRIM(qty), '') AS numeric) *
                   CAST(NULLIF(TRIM(harga), '') AS numeric)), 0) AS total_rupiah,
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

    const readyToShipQuery = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, harga, total, no_inv
      FROM work_orders
      WHERE siap_kirim = 'true' AND di_kirim = 'false' AND bulan = $1 AND tahun = $2
      ORDER BY tanggal DESC, id DESC
      LIMIT 10;
    `;
    const readyToShipResult = await client.query(readyToShipQuery, [month, year]);

    res.json({
      summary: summaryResult.rows[0],
      statusCounts: statusResult.rows[0],
      siapKirimList: readyToShipResult.rows
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ message: 'Gagal mengambil data dashboard.' });
  } finally {
    client.release();
  }
});


// ======================
// 🔹 WORK ORDERS
// ======================
app.get('/api/workorders', authenticateToken, async (req, res) => {
  const { month, year, customer, status } = req.query;
  if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
    return res.status(400).json({ message: 'Parameter bulan dan tahun wajib diisi.' });
  }

  try {
    let queryText = 'SELECT * FROM work_orders WHERE bulan = $1 AND tahun = $2';
    const queryParams = [month, year];
    let paramIndex = 3;

    if (customer) {
      queryParams.push(`%${customer}%`);
      queryText += ` AND nama_customer ILIKE $${paramIndex++}`;
    }

    if (status) {
      switch (status) {
        case 'belum_produksi':
          queryText += ` AND (di_produksi = 'false' OR di_produksi IS NULL)`;
          break;
        case 'sudah_produksi':
          queryText += ` AND di_produksi = 'true' AND (di_warna = 'false' OR di_warna IS NULL)
                        AND (siap_kirim = 'false' OR siap_kirim IS NULL)
                        AND (di_kirim = 'false' OR di_kirim IS NULL)`;
          break;
        case 'di_warna':
          queryText += ` AND di_warna = 'true' AND (siap_kirim = 'false' OR siap_kirim IS NULL)
                        AND (di_kirim = 'false' OR di_kirim IS NULL)`;
          break;
        case 'siap_kirim':
          queryText += ` AND siap_kirim = 'true' AND (di_kirim = 'false' OR di_kirim IS NULL)`;
          break;
        case 'di_kirim':
          queryText += ` AND di_kirim = 'true'`;
          break;
      }
    }

    queryText += ' ORDER BY tanggal DESC, id DESC';
    const workOrders = await pool.query(queryText, queryParams);
    res.json(workOrders.rows);
  } catch (error) {
    console.error('Error saat mengambil work orders:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/workorders', authenticateToken, async (req, res) => {
  try {
    const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv } = req.body;
    if (!tanggal || !nama_customer) {
      return res.status(400).json({ message: 'Tanggal dan Nama Customer wajib diisi.' });
    }
    const date = new Date(tanggal);
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();
    const newWorkOrder = await pool.query(
      `INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun]
    );
    res.status(201).json(newWorkOrder.rows[0]);
  } catch (error) {
    console.error('Error saat menambahkan work order:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.put('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv } = req.body;
    const date = new Date(tanggal);
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();
    const updatedWorkOrder = await pool.query(
      `UPDATE work_orders SET tanggal = $1, nama_customer = $2, deskripsi = $3, ukuran = $4, qty = $5, harga = $6, no_inv = $7, bulan = $8, tahun = $9
       WHERE id = $10 RETURNING *`,
      [tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun, id]
    );
    if (updatedWorkOrder.rows.length === 0) {
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });
    }
    res.json(updatedWorkOrder.rows[0]);
  } catch (error) {
    console.error('Error saat mengupdate work order:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM work_orders WHERE id = $1', [id]);
    const response = jsonDeleteResponse(result, 'Work order');
    res.status(response.status).json(response.json);
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus work order.' });
  }
});

app.patch('/api/workorders/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { columnName, value } = req.body;
    const validColumns = ['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran', 'ekspedisi'];
    if (!validColumns.includes(columnName)) {
      return res.status(400).json({ message: 'Nama kolom tidak valid.' });
    }
    value = (value === true || value === 'true') ? 'true' : 'false';
    const updatedWorkOrder = await pool.query(
      `UPDATE work_orders SET "${columnName}" = $1 WHERE id = $2 RETURNING *`,
      [value, id]
    );
    if (updatedWorkOrder.rows.length === 0) {
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });
    }
    res.json(updatedWorkOrder.rows[0]);
  } catch (error) {
    console.error('Error saat mengupdate status:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/workorders/mark-printed', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Array of IDs wajib diisi.' });
    }

    const updateResult = await client.query(
      `UPDATE work_orders SET po_status = 'PRINTED', di_produksi = 'true' WHERE id = ANY($1::int[])`,
      [ids]
    );

    await client.query('COMMIT');
    res.json({ message: `${updateResult.rowCount} item berhasil ditandai sebagai 'Printed' dan 'Di Produksi'.` });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saat menandai PO Printed & Di Produksi:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server saat menandai status.' });
  } finally {
    client.release();
  }
});

// ======================
// 🔹 STOK BAHAN
// ======================
app.get('/api/stok', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stok_bahan ORDER BY kode_bahan ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// ======================
// 🔹 SURAT JALAN & INVOICE
// ======================
app.post('/api/surat-jalan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { tipe, no_invoice, nama_tujuan, items, catatan } = req.body;
    const date = new Date();
    const no_sj_prefix = tipe === 'VENDOR' ? 'SJW' : 'SJC';
    const no_sj = `${no_sj_prefix}-${date.getFullYear()}${(date.getMonth() + 1)
      .toString().padStart(2, '0')}-${Date.now()}`;

    const result = await client.query(
      `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING no_sj`,
      [tipe, no_sj, no_invoice, nama_tujuan, JSON.stringify(items), catatan]
    );

    if (tipe === 'VENDOR') {
      const itemIds = items.map(item => item.id);
      if (itemIds.length > 0) {
        await client.query(
          `UPDATE work_orders SET di_warna = 'true', no_sj_warna = $1 WHERE id = ANY($2::int[])`,
          [no_sj, itemIds]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saat membuat surat jalan:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  } finally {
    client.release();
  }
});

// ======================
// 🔹 KEUANGAN
// ======================
app.get('/api/keuangan/saldo', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM kas ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data saldo.' });
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
    const saldoSesudah = tipe === 'PEMASUKAN' ? saldoSebelum + jumlahNumeric : saldoSebelum - jumlahNumeric;

    await client.query('UPDATE kas SET saldo = $1 WHERE id = $2', [saldoSesudah, kas_id]);
    await client.query(
      `INSERT INTO transaksi_keuangan (tanggal, jumlah, tipe, kas_id, keterangan, saldo_sebelum, saldo_sesudah)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tanggal, jumlahNumeric, tipe, kas_id, keterangan, saldoSebelum, saldoSesudah]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Transaksi berhasil disimpan.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: error.message || 'Gagal menyimpan transaksi.' });
  } finally {
    client.release();
  }
});

// ======================
// 🔹 ADMIN: USERS
// ======================
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.username.toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    const result = await pool.query(`
      SELECT id, username AS name, phone_number, role,
             COALESCE(subscription_status, 'inactive') AS subscription_status
      FROM users ORDER BY id ASC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal memuat data user.' });
  }
});

app.post('/api/admin/users/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (req.user.username.toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    const result = await pool.query(
      `UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id, username, subscription_status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User tidak ditemukan.' });
    res.json({ message: `Langganan user diubah ke ${status}.`, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Gagal mengubah status langganan user.' });
  }
});

// ===============================================
//         9. FRONTEND STATIC FILE
// ===============================================
app.use(express.static(path.join(__dirname, "toto-frontend")));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "toto-frontend", "index.html"));
});

// ===============================================
//           10. SERVER LISTENER
// ===============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`🌍 Base URL: ${process.env.RAILWAY_STATIC_URL}`);
});


// ===============================================
//           11. GLOBAL ERROR HANDLER
// ===============================================
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR HANDLER:", err.stack);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Akses dari domain ini tidak diizinkan (CORS)." });
  }
  res.status(500).json({ message: "Terjadi kesalahan pada server." });
});

// ===============================================
//           12. HEALTH CHECK
// ===============================================
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", time: new Date() });
});

process.on("unhandledRejection", (reason) => {
  console.error("🚨 Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});




// ============================================================
// ✅ API: Ambil semua user untuk halaman admin-subscription
// ============================================================
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        // Pastikan hanya admin (Faisal) yang boleh ambil semua data user
        if (req.user.username.toLowerCase() !== 'faisal') {
            return res.status(403).json({ message: 'Akses ditolak. Hanya admin (Faisal) yang dapat melihat data user.' });
        }

        const result = await pool.query(`
            SELECT 
                id, 
                username AS name,
                phone_number,
                role,
                COALESCE(subscription_status, 'inactive') AS subscription_status
            FROM users
            ORDER BY id ASC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error mengambil data users:', err);
        res.status(500).json({ error: 'Gagal memuat data user.' });
    }
});

// ============================================================
// ✅ API: Aktifkan / Nonaktifkan langganan user (khusus Faisal)
// ============================================================
app.post('/api/admin/users/:id/activate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // 🔒 Hanya Faisal yang boleh melakukan ini
        if (!req.user || req.user.username.toLowerCase() !== 'faisal') {
            return res.status(403).json({ message: 'Akses ditolak. Hanya Faisal yang dapat mengubah status langganan.' });
        }

        // Validasi status
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Status tidak valid. Gunakan "active" atau "inactive".' });
        }

        // Update status di database
        const result = await pool.query(
            `UPDATE users 
             SET subscription_status = $1 
             WHERE id = $2 
             RETURNING id, username, subscription_status`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        res.json({
            message: `Langganan user berhasil diubah menjadi ${status}.`,
            user: result.rows[0]
        });

    } catch (err) {
        console.error('Error mengubah status langganan:', err);
        res.status(500).json({ message: 'Gagal mengubah status langganan user.' });
    }
});
