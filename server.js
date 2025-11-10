// ==========================================================
// 🚀 SERVER.JS (VERSI FINAL - DENGAN FITUR DP & DISKON)
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
// 🚀 ENDPOINTS KONTEN UTAMA (WORK ORDERS, DASHBOARD) + DP & DISKON
// =============================================================

// ===================== DASHBOARD ENDPOINT - DENGAN DP & DISKON =====================
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

    const summaryQuery = `
      SELECT
        ukuran, qty, harga, dp_amount, discount,
        nama_customer
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;

    console.log('📋 Executing summary query...');
    const summaryResult = await client.query(summaryQuery, [bulanInt, tahunInt]);
    console.log('✅ Summary query result rows:', summaryResult.rows.length);

    // Hitung total rupiah secara manual di JavaScript dengan DP dan discount
    let totalRupiah = 0;
    let totalDP = 0;
    let totalDiscount = 0;
    const customers = new Set();

    summaryResult.rows.forEach(row => {
      // Hitung customer unik
      if (row.nama_customer) {
        customers.add(row.nama_customer);
      }

      // Hitung total rupiah dengan validasi manual
      // PERHATIAN: ukuran adalah character varying, jadi perlu parseFloat
      try {
        const ukuran = parseFloat(row.ukuran) || 0;
        const qty = parseFloat(row.qty) || 0;
        const harga = parseFloat(row.harga) || 0;
        const dp = parseFloat(row.dp_amount) || 0;
        const discount = parseFloat(row.discount) || 0;
        
        const subtotal = ukuran * qty * harga;
        const total = subtotal - discount;
        
        totalRupiah += total;
        totalDP += dp;
        totalDiscount += discount;
        
      } catch (err) {
        console.warn('⚠️ Error calculating row:', row, err.message);
      }
    });

    const totalAfterDiscount = totalRupiah;
    const remainingPayment = totalAfterDiscount - totalDP;

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
        total_customer: customers.size,
        total_dp: totalDP,
        total_discount: totalDiscount,
        total_after_discount: totalAfterDiscount,
        remaining_payment: remainingPayment
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
      "tanggal","nama_customer","deskripsi","ukuran","qty","harga",
      "dp_amount","discount",
      "di_produksi","di_warna","siap_kirim","di_kirim","pembayaran",
      "no_inv","ekspedisi","bulan","tahun","selected"
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
      if (["di_produksi","di_warna","siap_kirim","di_kirim","pembayaran"].includes(f)) {
        if (val === true || val === 'true' || val === '1' || val === 1) {
          val = 'true';
        } else {
          val = 'false';
        }
      }
      
      // Handle numeric fields
      if (["qty","harga","dp_amount","discount"].includes(f)) {
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

// =============================================================
// 🧮 FUNCTION: CALCULATE INVOICE SUMMARY - FIXED DEBUG
// =============================================================
// ============================================
// 🧮 Hitung Ringkasan Invoice Bulanan
// ============================================
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



// =============================================================
// 📊 INVOICE SUMMARY ENDPOINT - UPDATED
// =============================================================
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

// =============================================================
// 📄 SURAT JALAN ENDPOINTS - FIXED VERSION
// =============================================================

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

// -- Create surat jalan (untuk kedua tab)
app.post('/api/surat-jalan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { tipe, no_invoice, nama_tujuan, items, catatan, socketId } = req.body;
    
    if (!tipe || !nama_tujuan || !items || !Array.isArray(items)) {
      return res.status(400).json({ 
        message: 'Data tidak lengkap: tipe, nama_tujuan, dan items wajib diisi.' 
      });
    }

    // Generate nomor surat jalan
    const date = new Date();
    const no_sj_prefix = tipe === 'VENDOR' ? 'SJW' : 'SJC';
    const no_sj = `${no_sj_prefix}-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${Date.now()}`;
    
    // Simpan surat jalan
    const result = await client.query(
      `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tipe, no_sj, no_invoice, nama_tujuan, JSON.stringify(items), catatan]
    );
    
    // ✅ AUTO UPDATE STATUS: Jika tipe VENDOR (warna), update status di_warna
    if (tipe === 'VENDOR') {
      const itemIds = items.map(item => item.id).filter(Boolean);
      
      if (itemIds.length > 0) {
        console.log(`🔄 Updating ${itemIds.length} items to di_warna = true`);
        
        const updateQuery = `
          UPDATE work_orders 
          SET di_warna = 'true', 
              updated_at = NOW(),
              updated_by = $1
          WHERE id = ANY($2::int[])
        `;
        
        const updated_by = req.user?.username || 'admin';
        await client.query(updateQuery, [updated_by, itemIds]);
        
        // Get updated work orders untuk real-time broadcast
        const updatedResult = await client.query(
          `SELECT * FROM work_orders WHERE id = ANY($1::int[])`,
          [itemIds]
        );
        
        // Broadcast real-time updates
        updatedResult.rows.forEach(updatedRow => {
          if (socketId && socketId !== 'undefined') {
            // Kirim ke semua client kecuali pengirim
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
      }
    }
    
    await client.query('COMMIT');
    
    const suratJalan = result.rows[0];
    // Parse items kembali ke JSON
    suratJalan.items = JSON.parse(suratJalan.items);
    
    console.log(`✅ Surat Jalan created: ${suratJalan.no_sj} for ${nama_tujuan}`);
    
    res.status(201).json(suratJalan);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating surat jalan:', err);
    res.status(500).json({ 
      message: 'Gagal membuat surat jalan.',
      error: err.message 
    });
  } finally {
    client.release();
  }
});

// -- Get all surat jalan history
app.get('/api/surat-jalan', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM surat_jalan_log 
      ORDER BY created_at DESC
    `);
    
    // Parse items dari JSON string
    const formattedRows = result.rows.map(row => ({
      ...row,
      items: JSON.parse(row.items)
    }));
    
    res.json(formattedRows);
  } catch (err) {
    console.error('❌ Error fetching surat jalan:', err);
    res.status(500).json({ 
      message: 'Gagal mengambil data surat jalan.',
      error: err.message 
    });
  }
});

// -- Get surat jalan by ID
app.get('/api/surat-jalan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM surat_jalan_log WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Surat jalan tidak ditemukan' });
    }
    
    const suratJalan = result.rows[0];
    // Parse items dari JSON string
    suratJalan.items = JSON.parse(suratJalan.items);
    
    res.json(suratJalan);
  } catch (err) {
    console.error('❌ Error fetching surat jalan:', err);
    res.status(500).json({ 
      message: 'Gagal mengambil data surat jalan.',
      error: err.message 
    });
  }
});

// -- Update work order status untuk warna (endpoint khusus)
app.patch('/api/workorders/:id/warna-status', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { di_warna, socketId } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'ID Work Order tidak valid.' });
    }
    
    const updated_by = req.user?.username || 'admin';
    
    const query = `
      UPDATE work_orders 
      SET di_warna = $1, 
          updated_at = NOW(),
          updated_by = $2
      WHERE id = $3 
      RETURNING *
    `;
    
    const result = await client.query(query, [
      di_warna ? 'true' : 'false',
      updated_by,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Work Order tidak ditemukan.' });
    }
    
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
    
    console.log(`✅ Updated work order ${id} di_warna to ${di_warna}`);
    
    res.json(updatedRow);
  } catch (err) {
    console.error('❌ Error updating warna status:', err);
    res.status(500).json({ 
      message: 'Gagal memperbarui status warna.',
      error: err.message 
    });
  } finally {
    client.release();
  }
});

// -- Bulk update work orders untuk warna (multiple items)
app.post('/api/workorders/bulk-warna-update', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { itemIds, socketId } = req.body;
    
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: 'Data itemIds tidak valid.' });
    }
    
    const validIds = itemIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({ message: 'Tidak ada ID valid untuk diproses.' });
    }
    
    const updated_by = req.user?.username || 'admin';
    
    const query = `
      UPDATE work_orders 
      SET di_warna = 'true', 
          updated_at = NOW(),
          updated_by = $1
      WHERE id = ANY($2::int[])
      RETURNING *
    `;
    
    const result = await client.query(query, [updated_by, validIds]);
    
    // Get updated work orders untuk real-time broadcast
    const updatedRows = result.rows;
    
    // Hitung calculated fields untuk setiap row
    updatedRows.forEach(updatedRow => {
      const ukuran = parseFloat(updatedRow.ukuran) || 0;
      const qty = parseFloat(updatedRow.qty) || 0;
      const harga = parseFloat(updatedRow.harga) || 0;
      const dp = parseFloat(updatedRow.dp_amount) || 0;
      const discount = parseFloat(updatedRow.discount) || 0;
      
      updatedRow.subtotal = ukuran * qty * harga;
      updatedRow.total = updatedRow.subtotal - discount;
      updatedRow.remaining_payment = updatedRow.total - dp;
    });
    
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
    
    console.log(`✅ Bulk updated ${result.rowCount} items to di_warna = true`);
    
    res.json({
      message: `Berhasil memperbarui ${result.rowCount} Work Order sebagai sudah diwarna.`,
      updated: updatedRows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error bulk updating warna status:', err);
    res.status(500).json({ 
      message: 'Gagal memperbarui status warna.',
      error: err.message 
    });
  } finally {
    client.release();
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


// ===================== Socket.IO Events =====================
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