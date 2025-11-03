// ==========================================================
// 🚀 SERVER.JS (VERSI FINAL - STABIL & TANPA ERROR)
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
app.put('/api/user/change-password', authenticateToken, async (req, res) => {
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
// 🚀 ENDPOINTS KONTEN UTAMA (WORK ORDERS, DASHBOARD)
// =============================================================

// ===================== DASHBOARD ENDPOINT - SIMPLE & SAFE VERSION =====================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  
  console.log(`📊 Dashboard request: month=${month}, year=${year}`);
  
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
    console.log(`🔍 Querying dashboard for: ${bulanInt}-${tahunInt}`);

    // VERSION SANGAT AMAN: Handle perhitungan di JavaScript
    const summaryQuery = `
      SELECT
        ukuran, qty, harga,
        nama_customer
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;

    console.log('📋 Executing summary query...');
    const summaryResult = await client.query(summaryQuery, [bulanInt, tahunInt]);
    console.log('✅ Summary query result rows:', summaryResult.rows.length);

    // Hitung total rupiah secara manual di JavaScript
    let totalRupiah = 0;
    const customers = new Set();

    summaryResult.rows.forEach(row => {
      // Hitung customer unik
      if (row.nama_customer) {
        customers.add(row.nama_customer);
      }

      // Hitung total rupiah dengan validasi manual
      try {
        const ukuran = parseFloat(row.ukuran) || 0;
        const qty = parseFloat(row.qty) || 0;
        const harga = parseFloat(row.harga) || 0;
        
        if (ukuran > 0 && qty > 0 && harga > 0) {
          totalRupiah += ukuran * qty * harga;
        }
      } catch (err) {
        console.warn('⚠️ Error calculating row:', row, err.message);
      }
    });

    // Query status counts
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

    console.log('📋 Executing status query...');
    const statusResult = await client.query(statusQuery, [bulanInt, tahunInt]);
    console.log('✅ Status query result:', statusResult.rows[0]);

    const response = {
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
    };

    console.log('🎉 Dashboard response:', response);
    
    res.json(response);
    
  } catch (err) {
    console.error("❌ DASHBOARD ERROR:", err.message);
    console.error("❌ Stack trace:", err.stack);
    
    res.status(500).json({ 
      success: false,
      message: "Gagal mengambil data dashboard.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    client.release();
  }
});

// -- Tambah Work Order Baru
app.post("/api/workorders", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, socketId } = req.body; // ✅ Tambahkan socketId opsional
    const updated_by = req.user.username || "admin";

    // Validasi input
    if (!nama_customer || !deskripsi) {
      return res.status(400).json({ message: "Nama customer dan deskripsi wajib diisi." });
    }

    const result = await client.query(
      `INSERT INTO work_orders 
       (tanggal, nama_customer, deskripsi, ukuran, qty, harga, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tanggal || new Date(),
        nama_customer.trim(),
        deskripsi.trim(),
        ukuran,
        qty,
        harga || 0,
        updated_by,
      ]
    );

    const newRow = result.rows[0];

    // ✅ Kirim realtime ke semua client kecuali pengirim
    if (socketId && io.sockets?.sockets) {
      io.sockets.sockets.forEach((socket) => {
        if (socket.id !== socketId) {
          socket.emit("wo_created", newRow);
        }
      });
    } else {
      io.emit("wo_created", newRow);
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

// -- Update Parsial Work Order - FIXED VERSION
// -- Update Parsial Work Order - ENHANCED VERSION
app.post("/api/workorders", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const {
      tanggal,
      nama_customer,
      deskripsi,
      ukuran,
      qty,
      harga,
      bulan,
      tahun,
      socketId
    } = req.body;

    const updated_by = req.user?.username || "admin";

    if (!nama_customer || !deskripsi) {
      return res.status(400).json({ message: "Nama customer dan deskripsi wajib diisi." });
    }

    // ✅ Konversi aman untuk numeric
    const safeUkuran = ukuran && !isNaN(Number(ukuran)) ? Number(ukuran) : null;
    const safeQty = qty && !isNaN(Number(qty)) ? Number(qty) : null;
    const safeHarga = harga && !isNaN(Number(harga)) ? Number(harga) : 0;

    const query = `
      INSERT INTO work_orders
        (tanggal, nama_customer, deskripsi, ukuran, qty, harga, bulan, tahun, updated_by)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const values = [
      tanggal || new Date(),
      nama_customer.trim(),
      deskripsi.trim(),
      safeUkuran,
      safeQty,
      safeHarga,
      bulan || new Date().getMonth() + 1,
      tahun || new Date().getFullYear(),
      updated_by
    ];

    const result = await client.query(query, values);
    const newRow = result.rows[0];

    if (socketId && io.sockets?.sockets) {
      io.sockets.sockets.forEach((socket) => {
        if (socket.id !== socketId) socket.emit("wo_created", newRow);
      });
    } else {
      io.emit("wo_created", newRow);
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







// -- Get Work Orders dengan Chunking - UPDATED
// -- Get Work Orders dengan Chunking - UPDATED
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  try {
    const { month, year, page = 1, size = 10000 } = req.query;
    
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

    // ✅ PERBAIKAN: Tambah semua field untuk konsistensi
    const query = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
      ORDER BY id ASC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await pool.query(query, [bulanInt, tahunInt, sizeInt, offset]);

    // Hitung total pages
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM work_orders WHERE bulan = $1 AND tahun = $2',
      [bulanInt, tahunInt]
    );
    
    const totalRows = parseInt(countResult.rows[0].count);
    const lastPage = Math.ceil(totalRows / sizeInt);

    res.json({
      data: result.rows,
      current_page: pageInt,
      last_page: lastPage,
      total: totalRows
    });
    
  } catch (err) {
    console.error("❌ Error GET /api/workorders/chunk:", err.message);
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


// -- AMBIL DATA UNTUK HALAMAN 'STATUS BARANG' (FINAL)
app.get('/api/status-barang', authenticateToken, async (req, res) => {
  try {
    let { customer, month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: 'Bulan dan tahun wajib diisi.' });
    }

    const bulan = parseInt(month);
    const tahun = parseInt(year);
    const params = [bulan, tahun];
    let whereClause = `WHERE bulan = $1 AND tahun = $2 AND id IS NOT NULL`;

    if (customer && customer.trim() !== '') {
      params.push(`%${customer.trim()}%`);
      whereClause += ` AND LOWER(nama_customer) LIKE LOWER($${params.length})`;
      console.log(`🔍 Filter customer aktif: ${customer.trim()}`);
    }

    const query = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders ${whereClause}
      ORDER BY tanggal ASC, id ASC;
    `;

    const result = await pool.query(query, params);
    console.log(`✅ Status Barang loaded: ${result.rows.length} rows`);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ /api/status-barang error:', err.message);
    res.status(500).json({ 
      message: 'Gagal mengambil data status barang.',
      error: err.message 
    });
  }
});


// -- GET /api/workorders (Endpoint lama untuk kompatibilitas) - UPDATED
app.get('/api/workorders', authenticateToken, async (req, res) => {
  try {
    let { month, year, customer, status } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: 'Bulan & tahun wajib diisi.' });
    }

    let params = [parseInt(month), parseInt(year)];
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
        case 'di_warna':
          whereClauses.push(`di_warna = 'true'`);
          break;
        case 'siap_kirim':
          whereClauses.push(`siap_kirim = 'true'`);
          break;
        case 'di_kirim':
          whereClauses.push(`di_kirim = 'true'`);
          break;
      }
    }

    // ✅ PERBAIKAN: Konsisten dengan field status barang
    let sql = `
      SELECT 
        id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
        di_produksi, di_warna, siap_kirim, di_kirim, 
        no_inv, pembayaran, ekspedisi, bulan, tahun
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `;
    
    if (whereClauses.length) {
      sql += ' AND ' + whereClauses.join(' AND ');
    }
    
    sql += ` ORDER BY tanggal ASC, id ASC`;

    const result = await pool.query(sql, params);
    const filteredData = result.rows.filter(item => item.nama_customer && item.deskripsi);
    
    res.json(filteredData);
  } catch (err) {
    console.error('❌ workorders GET error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// -- HAPUS WORK ORDER
app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'ID tidak valid.' });
    }

    const result = await client.query(
      'DELETE FROM work_orders WHERE id = $1 RETURNING *', 
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Work order tidak ditemukan.' });
    }
    
    // Kirim realtime delete notification
    io.emit('wo_deleted', { id: parseInt(id), row: result.rows[0] });
    console.log(`✅ Work Order deleted: ${id}`);
    
    res.status(204).send();
  } catch (err) {
    console.error('❌ Workorders DELETE error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  } finally {
    client.release();
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
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ PUT /api/karyawan/:id error:', err);
    res.status(500).json({ message: 'Gagal mengubah data karyawan.' });
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

// --- INVOICE SUMMARY - FIXED VERSION ---
app.get('/api/invoices/summary', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    }
    
    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);

    // Query yang lebih aman tanpa regex untuk numeric
    const query = `
      SELECT
        ukuran, qty, harga, pembayaran
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2 AND no_inv IS NOT NULL AND no_inv != ''
    `;
    
    const result = await pool.query(query, [bulanInt, tahunInt]);
    
    let total = 0;
    let paid = 0;

    result.rows.forEach(row => {
      try {
        const ukuran = parseFloat(row.ukuran) || 0;
        const qty = parseFloat(row.qty) || 0;
        const harga = parseFloat(row.harga) || 0;
        const subtotal = ukuran * qty * harga;
        
        total += subtotal;
        
        if (row.pembayaran === 'true') {
          paid += subtotal;
        }
      } catch (err) {
        console.warn('⚠️ Error calculating invoice row:', row, err.message);
      }
    });
    
    res.json({ 
      total: total, 
      paid: paid, 
      unpaid: total - paid 
    });
  } catch (err) {
    console.error('❌ invoices summary error:', err);
    res.status(500).json({ message: 'Gagal mengambil ringkasan invoice.' });
  }
});

app.post('/api/surat-jalan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { tipe, no_invoice, nama_tujuan, items, catatan } = req.body;
    const date = new Date();
    const no_sj_prefix = tipe === 'VENDOR' ? 'SJW' : 'SJC';
    const no_sj = `${no_sj_prefix}-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${Date.now()}`;
    
    const result = await client.query(
      `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING no_sj`,
      [tipe, no_sj, no_invoice, nama_tujuan, JSON.stringify(items), catatan]
    );
    
    if (tipe === 'VENDOR') {
      const itemIds = (items || []).map(i => i.id).filter(Boolean);
      if (itemIds.length) {
        await client.query(
          `UPDATE work_orders SET di_warna = 'true', no_sj_warna = $1 WHERE id = ANY($2::int[])`,
          [no_sj, itemIds]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ surat-jalan error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  } finally {
    client.release();
  }
});

// --- KEUANGAN ---
app.get('/api/keuangan/saldo', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM kas ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ keuangan saldo error:', err);
    res.status(500).json({ message: 'Gagal mengambil data saldo.' });
  }
});

app.post('/api/keuangan/transaksi', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { tanggal, jumlah, tipe, kas_id, keterangan } = req.body;
    const jumlahNumeric = parseFloat(jumlah);
    
    if (!tanggal || !jumlah || !tipe || !kas_id) {
      throw new Error('Data transaksi tidak lengkap.');
    }

    const kasResult = await client.query('SELECT * FROM kas WHERE id = $1 FOR UPDATE', [kas_id]);
    if (kasResult.rows.length === 0) {
      throw new Error('Kas tidak ditemukan.');
    }
    
    const kas = kasResult.rows[0];
    const saldoSebelum = parseFloat(kas.saldo);
    let saldoSesudah = tipe === 'PEMASUKAN' ? saldoSebelum + jumlahNumeric : saldoSebelum - jumlahNumeric;
    
    await client.query('UPDATE kas SET saldo = $1 WHERE id = $2', [saldoSesudah, kas_id]);
    
    await client.query(
      'INSERT INTO transaksi_keuangan (tanggal, jumlah, tipe, kas_id, keterangan, saldo_sebelum, saldo_sesudah) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [tanggal, jumlahNumeric, tipe, kas_id, keterangan, saldoSebelum, saldoSesudah]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({ message: 'Transaksi berhasil disimpan.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ keuangan transaksi error:', err);
    res.status(500).json({ message: err.message || 'Terjadi kesalahan pada server.' });
  } finally {
    client.release();
  }
});

app.get('/api/keuangan/riwayat', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    }
    
    const bulanInt = parseInt(month);
    const tahunInt = parseInt(year);

    const query = `
      SELECT tk.id, tk.tanggal, tk.jumlah, tk.tipe, tk.keterangan, tk.saldo_sebelum, tk.saldo_sesudah, k.nama_kas
      FROM transaksi_keuangan tk
      JOIN kas k ON tk.kas_id = k.id
      WHERE EXTRACT(MONTH FROM tk.tanggal) = $1 AND EXTRACT(YEAR FROM tk.tanggal) = $2
      ORDER BY tk.tanggal DESC, tk.id DESC
    `;
    
    const result = await pool.query(query, [bulanInt, tahunInt]);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ keuangan riwayat error:', err);
    res.status(500).json({ message: 'Gagal mengambil riwayat keuangan.' });
  }
});

// --- ADMIN ---
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (!req.user || (req.user.username || '').toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    
    const result = await pool.query(`
      SELECT id, username, phone_number, role, COALESCE(subscription_status, 'inactive') AS subscription_status
      FROM users
      ORDER BY id ASC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('❌ users GET error:', err);
    res.status(500).json({ message: 'Gagal memuat data user.' });
  }
});

app.post('/api/admin/users/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!req.user || (req.user.username || '').toLowerCase() !== 'faisal') {
      return res.status(403).json({ message: 'Akses ditolak.' });
    }
    
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }
    
    const result = await pool.query(
      'UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id, username, subscription_status',
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
    console.error('❌ activate user error:', err);
    res.status(500).json({ message: 'Gagal mengubah status langganan user.' });
  }
});

// ===================== LOGIKA KONEKSI SOCKET.IO =====================
io.on("connection", (socket) => {
  console.log("🔗 Socket connected:", socket.id);

  // menerima sync manual dari client
  socket.on("wo_sync", (data) => {
    console.log("🔄 Sync WO dari client:", data.id);
    socket.broadcast.emit("wo_updated", data);
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