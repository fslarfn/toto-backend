// ==========================================================
// 🚀 SERVER.JS — FULL MODULES (FINAL)
// ==========================================================

/**
 * Full-featured server for ERP TOTO ALUMINIUM
 * - Express + Socket.IO
 * - Postgres (pg Pool)
 * - JWT auth + refresh
 * - Multer upload
 * - Safe DB helper
 * - Endpoints:
 *   /api/login, /api/refresh, /api/me, /api/user/profile
 *   /api/dashboard
 *   /api/workorders (GET, POST, chunk, PATCH, DELETE, status, mark-printed)
 *   /api/status-barang
 *   /api/karyawan CRUD
 *   /api/payroll
 *   /api/stok CRUD + update
 *   /api/invoice, /api/invoices/summary
 *   /api/surat-jalan
 *   /api/keuangan (saldo, transaksi, riwayat)
 *   /api/users (admin) & /api/admin/users/:id/activate
 *
 * Make sure DATABASE_URL is set in environment.
 */

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "kunci-rahasia-super-aman-untuk-toto-app";
const DATABASE_URL = process.env.DATABASE_URL || process.env.FALLBACK_DATABASE_URL || "postgresql://postgres:password@localhost:5432/erp_toto";

// Create HTTP server and Socket.IO server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    transports: ["websocket", "polling"],
  },
});

// ======= Middleware =======
app.use(express.json());
app.options("*", cors());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-access-token", "X-Requested-With"],
  })
);

// Serve uploads & frontend static
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "toto-frontend")));

// ======= Postgres Pool =======
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("railway") || DATABASE_URL.includes("heroku") ? { rejectUnauthorized: false } : false,
});
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

// ======= Safe query helper (retry) =======
async function safeQuery(queryText, params = [], retries = 3, delayMs = 600) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(queryText, params);
    } catch (err) {
      lastErr = err;
      console.warn(`DB query failed (attempt ${i + 1}/${retries}): ${err.message}`);
      // small backoff
      await new Promise((res) => setTimeout(res, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

// ======= Multer setup for profile uploads =======
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uid = (req.user && req.user.id) ? req.user.id : "anon";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uid}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ======= Auth middleware =======
function authenticateToken(req, res, next) {
  try {
    // support both Authorization: Bearer <token> and x-access-token
    const authHeader = req.headers["authorization"];
    let token = authHeader && authHeader.split(" ")[1];
    if (!token && req.headers["x-access-token"]) token = req.headers["x-access-token"];
    if (!token) return res.status(401).json({ message: "Token tidak ditemukan." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.warn("JWT verify error:", err && err.name);
        // if expired, inform frontend
        if (err.name === "TokenExpiredError") return res.status(401).json({ message: "EXPIRED" });
        return res.status(403).json({ message: "Token tidak valid." });
      }
      req.user = user;
      next();
    });
  } catch (err) {
    console.error("authenticateToken error:", err);
    res.status(500).json({ message: "Kesalahan autentikasi server." });
  }
}

// ======= Authentication / user endpoints =======

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: "Username & password wajib." });

    const r = await safeQuery("SELECT * FROM users WHERE username = $1", [username]);
    if (!r || r.rows.length === 0) return res.status(401).json({ message: "Username atau password salah." });

    const user = r.rows[0];
    const match = await bcrypt.compare(password, user.password_hash || "");
    if (!match) return res.status(401).json({ message: "Username atau password salah." });

    // optional subscription check
    if (user.role !== "admin" && (user.subscription_status || "inactive") === "inactive") {
      return res.status(403).json({ message: "Langganan Anda tidak aktif." });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subscription_status: user.subscription_status || "inactive",
      },
    });
  } catch (err) {
    console.error("/api/login error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

// Refresh token (client can send expired token)
app.post("/api/refresh", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ message: "Token wajib dikirim." });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err && err.name === "TokenExpiredError") {
        const decoded = jwt.decode(token);
        const newToken = jwt.sign({ id: decoded.id, username: decoded.username, role: decoded.role }, JWT_SECRET, { expiresIn: "8h" });
        console.log(`Refreshed token for ${decoded.username}`);
        return res.json({ token: newToken });
      }
      if (err) return res.status(403).json({ message: "Token tidak valid." });
      // still valid: return same token or refresh
      const newToken = jwt.sign({ id: payload.id, username: payload.username, role: payload.role }, JWT_SECRET, { expiresIn: "8h" });
      return res.json({ token: newToken });
    });
  } catch (err) {
    console.error("/api/refresh error:", err);
    res.status(500).json({ message: "Gagal memperbarui token." });
  }
});

// Get current user
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const r = await safeQuery("SELECT id, username, profile_picture_url, role FROM users WHERE id = $1", [req.user.id]);
    if (!r || r.rows.length === 0) return res.status(404).json({ message: "User tidak ditemukan." });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("/api/me error:", err);
    res.status(500).json({ message: "Error fetching user." });
  }
});

// Update profile (multipart/form-data)
app.put("/api/user/profile", authenticateToken, upload.single("profilePicture"), async (req, res) => {
  try {
    const { username } = req.body || {};
    let profilePictureUrl = null;
    if (req.file) profilePictureUrl = `/uploads/${req.file.filename}`;

    if (profilePictureUrl) {
      const r = await safeQuery("UPDATE users SET username = $1, profile_picture_url = $2 WHERE id = $3 RETURNING id, username, profile_picture_url", [username, profilePictureUrl, req.user.id]);
      return res.json(r.rows[0]);
    } else {
      const r = await safeQuery("UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, profile_picture_url", [username, req.user.id]);
      return res.json(r.rows[0]);
    }
  } catch (err) {
    console.error("/api/user/profile error:", err);
    res.status(500).json({ message: "Gagal mengupdate profil." });
  }
});

// Change password
app.put("/api/user/change-password", authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) return res.status(400).json({ message: "Password lama & baru diperlukan." });

    const r = await safeQuery("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
    if (!r || r.rows.length === 0) return res.status(404).json({ message: "User tidak ditemukan." });

    const match = await bcrypt.compare(oldPassword, r.rows[0].password_hash || "");
    if (!match) return res.status(400).json({ message: "Password lama salah." });

    const hashed = await bcrypt.hash(newPassword, 10);
    await safeQuery("UPDATE users SET password_hash = $1 WHERE id = $2", [hashed, req.user.id]);
    res.json({ message: "Password berhasil diubah." });
  } catch (err) {
    console.error("/api/user/change-password error:", err);
    res.status(500).json({ message: "Gagal mengubah password." });
  }
});

// ======= DASHBOARD =======
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Bulan dan tahun diperlukan." });

    const summaryQuery = `
      SELECT
        COALESCE(SUM(
          (NULLIF(REGEXP_REPLACE(ukuran::text, '[^0-9.]', '', 'g'), '')::numeric) *
          (NULLIF(REGEXP_REPLACE(qty::text, '[^0-9.]', '', 'g'), '')::numeric) *
          (NULLIF(REGEXP_REPLACE(COALESCE(harga::text, '0'), '[^0-9.]', '', 'g'), '')::numeric)
        ), 0) AS total_rupiah,
        COUNT(DISTINCT nama_customer) AS total_customer
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;
    const statusQuery = `
      SELECT
        COUNT(*) FILTER (WHERE (di_produksi = 'false' OR di_produksi IS NULL)) AS belum_produksi,
        COUNT(*) FILTER (WHERE di_produksi = 'true' AND (di_warna = 'false' OR di_warna IS NULL)) AS sudah_produksi,
        COUNT(*) FILTER (WHERE di_warna = 'true' AND (siap_kirim = 'false' OR di_kirim IS NULL)) AS di_warna,
        COUNT(*) FILTER (WHERE siap_kirim = 'true' AND (di_kirim = 'false' OR di_kirim IS NULL)) AS siap_kirim,
        COUNT(*) FILTER (WHERE di_kirim = 'true') AS di_kirim
      FROM work_orders WHERE bulan = $1 AND tahun = $2;
    `;

    const [summaryRes, statusRes] = await Promise.all([safeQuery(summaryQuery, [month, year]), safeQuery(statusQuery, [month, year])]);

    res.json({
      summary: (summaryRes.rows && summaryRes.rows[0]) || { total_rupiah: 0, total_customer: 0 },
      statusCounts: (statusRes.rows && statusRes.rows[0]) || {},
    });
  } catch (err) {
    console.error("/api/dashboard error:", err);
    res.status(500).json({ message: "Gagal mengambil data dashboard." });
  }
});

// ======= WORK ORDERS (full) =======

// Create new work order
app.post("/api/workorders", authenticateToken, async (req, res) => {
  try {
    const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv } = req.body || {};
    const today = new Date();
    const tanggalFinal = tanggal || today.toISOString().slice(0, 10);
    const date = new Date(tanggalFinal);
    const bulan = date.getMonth() + 1;
    const tahun = date.getFullYear();

    const q = `
      INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *;
    `;
    const vals = [tanggalFinal, nama_customer || "Tanpa Nama", deskripsi || "", ukuran || null, qty || null, harga || null, no_inv || null, bulan, tahun];
    const r = await safeQuery(q, vals);
    const newRow = r.rows[0];

    // broadcast
    io.emit("wo_created", newRow);
    res.status(201).json(newRow);
  } catch (err) {
    console.error("POST /api/workorders error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

// =============================================================
// GET /api/workorders/chunk — Versi Realtime + 10.000 baris kosong
// =============================================================
app.get('/api/workorders/chunk', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Parameter month dan year wajib diisi.' });
    }

    const bulan = parseInt(month);
    const tahun = parseInt(year);

    // ✅ 1. Pastikan kolom bulan & tahun memang ada di tabel work_orders
    // Jika tidak, kamu bisa hitung langsung dari tanggal:
    const query = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty
      FROM work_orders
      WHERE EXTRACT(MONTH FROM tanggal) = $1 
        AND EXTRACT(YEAR FROM tanggal) = $2
      ORDER BY tanggal ASC, id ASC;
    `;

    const { rows } = await pool.query(query, [bulan, tahun]);

    // ✅ 2. Pastikan hasilnya tetap dalam format array data
    const totalRows = 10000;
    const emptyCount = Math.max(0, totalRows - rows.length);

    // Tambahkan 10.000 baris kosong agar tampil seperti spreadsheet
    for (let i = 0; i < emptyCount; i++) {
      rows.push({
        id: `temp-${i}`,
        tanggal: '',
        nama_customer: '',
        deskripsi: '',
        ukuran: '',
        qty: ''
      });
    }

    // ✅ 3. Kirim data lengkap ke frontend
    res.status(200).json({
      success: true,
      data: rows,
      total: totalRows
    });

  } catch (err) {
    console.error('❌ workorders CHUNK error:', err);
    res.status(500).json({
      message: 'Gagal memuat data work orders.',
      error: err.message
    });
  }
});


// Legacy GET for dashboard usage (returns all rows for month/year)
app.get("/api/workorders", authenticateToken, async (req, res) => {
  try {
    let { month, year, customer, status } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Bulan & tahun wajib diisi." });

    const params = [parseInt(month), parseInt(year)];
    let where = `WHERE bulan = $1 AND tahun = $2`;

    if (customer) {
      params.push(`%${customer}%`);
      where += ` AND nama_customer ILIKE $${params.length}`;
    }
    if (status) {
      if (status === "belum_produksi") where += ` AND (di_produksi = 'false' OR di_produksi IS NULL)`;
      if (status === "sudah_produksi") where += ` AND di_produksi = 'true'`;
    }

    const q = `SELECT * FROM work_orders ${where} ORDER BY tanggal ASC, id ASC`;
    const r = await safeQuery(q, params);
    res.json(r.rows || []);
  } catch (err) {
    console.error("GET /api/workorders error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

// Update (autosave)
app.patch("/api/workorders/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const valid = [
      "tanggal", "nama_customer", "deskripsi", "ukuran", "qty", "harga",
      "no_inv", "di_produksi", "di_warna", "siap_kirim", "di_kirim",
      "pembayaran", "ekspedisi"
    ];

    const fields = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(updates)) {
      if (!valid.includes(k)) continue;
      fields.push(`"${k}" = $${idx}`);
      // normalize booleans to 'true'/'false' strings because DB column may be text
      if (typeof v === "boolean") values.push(v ? "true" : "false");
      else values.push(v);
      idx++;
    }
    if (fields.length === 0) return res.status(400).json({ message: "Tidak ada kolom valid untuk diupdate." });

    values.push(id);
    const q = `UPDATE work_orders SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const r = await safeQuery(q, values);
    if (!r.rows || r.rows.length === 0) return res.status(404).json({ message: "Work order tidak ditemukan." });

    const updated = r.rows[0];
    io.emit("wo_updated", updated);
    res.json({ message: "Data berhasil diperbarui.", data: updated });
  } catch (err) {
    console.error("PATCH /api/workorders/:id error:", err);
    res.status(500).json({ message: "Gagal memperbarui data.", error: err.message });
  }
});

// Update status (checkbox) from status-barang page
app.patch("/api/workorders/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { columnName, value } = req.body || {};
    if (!columnName) return res.status(400).json({ message: "columnName tidak ada" });

    const validColumns = ["di_produksi", "di_warna", "siap_kirim", "di_kirim", "pembayaran"];
    if (!validColumns.includes(columnName)) return res.status(400).json({ message: "Nama kolom tidak valid." });

    const boolValue = (value === true || value === "true") ? "true" : "false";
    const q = `UPDATE work_orders SET "${columnName}" = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const r = await safeQuery(q, [boolValue, id]);

    if (!r.rows || r.rows.length === 0) return res.status(404).json({ message: "Work order tidak ditemukan." });

    const updated = r.rows[0];
    io.emit("wo_updated", updated);
    res.json({ message: "Status berhasil diperbarui.", data: updated });
  } catch (err) {
    console.error("/api/workorders/:id/status error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server.", error: err.message });
  }
});

// Mark printed (print PO)
app.post("/api/workorders/mark-printed", authenticateToken, async (req, res) => {
  try {
    let { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "Data ID tidak valid." });

    ids = ids.map((i) => parseInt(i)).filter((n) => !isNaN(n));
    const q = `UPDATE work_orders SET di_produksi = 'true', updated_at = NOW() WHERE id = ANY($1::int[]) RETURNING *`;
    const r = await safeQuery(q, [ids]);

    for (const row of r.rows) io.emit("wo_updated", row);
    res.json({ message: `Berhasil menandai ${r.rowCount} Work Order sebagai printed.`, updated: r.rows });
  } catch (err) {
    console.error("/api/workorders/mark-printed error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server.", error: err.message });
  }
});

// Delete work order
app.delete("/api/workorders/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await safeQuery("DELETE FROM work_orders WHERE id = $1 RETURNING *", [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Work order tidak ditemukan." });
    io.emit("wo_deleted", { id: id, row: r.rows[0] });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/workorders/:id error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

// Status-barang endpoint (for status page)
app.get("/api/status-barang", authenticateToken, async (req, res) => {
  try {
    const { customer, month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Bulan dan tahun wajib diisi." });

    const params = [parseInt(month), parseInt(year)];
    let where = "WHERE bulan = $1 AND tahun = $2 AND id IS NOT NULL";
    if (customer && customer.trim() !== "") {
      params.push(`%${customer.trim()}%`);
      where += ` AND nama_customer ILIKE $${params.length}`;
    }
    const q = `SELECT * FROM work_orders ${where} ORDER BY tanggal ASC, id ASC;`;
    const r = await safeQuery(q, params);
    res.json(r.rows || []);
  } catch (err) {
    console.error("/api/status-barang error:", err);
    res.status(500).json({ message: "Gagal mengambil data status barang." });
  }
});

// ======= KARYAWAN (CRUD) =======
app.get("/api/karyawan", authenticateToken, async (req, res) => {
  try {
    const r = await safeQuery("SELECT * FROM karyawan ORDER BY id ASC");
    res.json(r.rows || []);
  } catch (err) {
    console.error("/api/karyawan GET error:", err);
    res.status(500).json({ message: "Gagal mengambil data karyawan." });
  }
});

app.post("/api/karyawan", authenticateToken, async (req, res) => {
  try {
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body || {};
    const r = await safeQuery(
      `INSERT INTO karyawan (nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nama_karyawan, gaji_harian || 0, potongan_bpjs_kesehatan || 0, potongan_bpjs_ketenagakerjaan || 0, kasbon || 0]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("/api/karyawan POST error:", err);
    res.status(500).json({ message: "Gagal menambah karyawan.", error: err.message });
  }
});

app.put("/api/karyawan/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body || {};
    const r = await safeQuery(
      `UPDATE karyawan SET nama_karyawan=$1, gaji_harian=$2, potongan_bpjs_kesehatan=$3, potongan_bpjs_ketenagakerjaan=$4, kasbon=$5
       WHERE id=$6 RETURNING *`,
      [nama_karyawan, gaji_harian || 0, potongan_bpjs_kesehatan || 0, potongan_bpjs_ketenagakerjaan || 0, kasbon || 0, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ message: "Karyawan tidak ditemukan." });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("/api/karyawan PUT error:", err);
    res.status(500).json({ message: "Gagal mengubah data karyawan." });
  }
});

app.delete("/api/karyawan/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await safeQuery("DELETE FROM karyawan WHERE id = $1 RETURNING *", [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: "Karyawan tidak ditemukan." });
    res.status(204).send();
  } catch (err) {
    console.error("/api/karyawan DELETE error:", err);
    res.status(500).json({ message: "Gagal menghapus karyawan." });
  }
});

// ======= PAYROLL =======
// Simple payroll endpoint that updates kasbon (deduction). Real payroll engine can be extended.
app.post("/api/payroll", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { karyawan_id, potongan_kasbon } = req.body || {};
    if (!karyawan_id || potongan_kasbon === undefined || potongan_kasbon === null) return res.status(400).json({ message: "karyawan_id & potongan_kasbon diperlukan." });

    const updateQ = `UPDATE karyawan SET kasbon = kasbon - $1 WHERE id = $2 RETURNING id, nama_karyawan, kasbon`;
    const r = await client.query(updateQ, [potongan_kasbon, karyawan_id]);
    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Karyawan tidak ditemukan saat update kasbon." });
    }

    await client.query("COMMIT");
    res.json({ message: "Payroll berhasil diproses.", updatedKaryawan: r.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("/api/payroll error:", err);
    res.status(500).json({ message: "Gagal memproses payroll.", error: err.message });
  } finally {
    client.release();
  }
});

// ======= STOK BAHAN =======
app.get("/api/stok", authenticateToken, async (req, res) => {
  try {
    const r = await safeQuery("SELECT * FROM stok_bahan ORDER BY kode_bahan ASC");
    res.json(r.rows || []);
  } catch (err) {
    console.error("/api/stok GET error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

app.post("/api/stok", authenticateToken, async (req, res) => {
  try {
    const { kode, nama, satuan, kategori, stok, lokasi } = req.body || {};
    const r = await safeQuery("INSERT INTO stok_bahan (kode_bahan, nama_bahan, satuan, kategori, stok, lokasi) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [kode ? kode.toUpperCase() : null, nama, satuan, kategori, stok || 0, lokasi]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("/api/stok POST error:", err);
    if (err.code === "23505") return res.status(409).json({ message: "Kode bahan sudah ada." });
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

app.post("/api/stok/update", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { bahan_id, tipe, jumlah, keterangan } = req.body || {};
    if (!bahan_id || !tipe || jumlah === undefined || jumlah === null) throw new Error("bahan_id, tipe, jumlah diperlukan.");

    const bahanRes = await client.query("SELECT * FROM stok_bahan WHERE id = $1 FOR UPDATE", [bahan_id]);
    if (bahanRes.rows.length === 0) throw new Error("Bahan tidak ditemukan.");
    const bahan = bahanRes.rows[0];
    const stokSebelum = parseFloat(bahan.stok || 0);
    const jumlahVal = parseFloat(jumlah);
    let stokSesudah;
    if (tipe === "MASUK") stokSesudah = stokSebelum + jumlahVal;
    else if (tipe === "KELUAR") {
      stokSesudah = stokSebelum - jumlahVal;
      if (stokSesudah < 0) throw new Error("Stok tidak mencukupi.");
    } else throw new Error("Tipe transaksi tidak valid.");

    await client.query("UPDATE stok_bahan SET stok = $1, last_update = NOW() WHERE id = $2", [stokSesudah, bahan_id]);
    await client.query("INSERT INTO riwayat_stok (bahan_id, nama_bahan, tipe, jumlah, stok_sebelum, stok_sesudah, keterangan) VALUES ($1,$2,$3,$4,$5,$6,$7)", [bahan_id, bahan.nama_bahan, tipe, jumlahVal, stokSebelum, stokSesudah, keterangan || ""]);
    await client.query("COMMIT");
    res.json({ message: "Stok berhasil diperbarui." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("/api/stok/update error:", err);
    res.status(500).json({ message: err.message || "Terjadi kesalahan pada server." });
  } finally {
    client.release();
  }
});

// ======= INVOICE & SURAT JALAN =======
app.get("/api/invoice/:inv", authenticateToken, async (req, res) => {
  try {
    const { inv } = req.params;
    const r = await safeQuery("SELECT * FROM work_orders WHERE no_inv = $1 ORDER BY id ASC", [inv]);
    res.json(r.rows || []);
  } catch (err) {
    console.error("/api/invoice/:inv error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

app.get("/api/invoices/summary", authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Bulan dan tahun diperlukan." });

    const q = `
      SELECT
        COALESCE(SUM(ukuran::numeric * qty::numeric * COALESCE(harga::numeric,0)), 0) AS total,
        COALESCE(SUM(CASE WHEN pembayaran = 'true' THEN ukuran::numeric * qty::numeric * COALESCE(harga::numeric,0) ELSE 0 END), 0) AS paid
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2 AND no_inv IS NOT NULL AND no_inv != ''
    `;
    const r = await safeQuery(q, [month, year]);
    const totalValue = parseFloat(r.rows[0].total || 0);
    const paidValue = parseFloat(r.rows[0].paid || 0);
    res.json({ total: totalValue, paid: paidValue, unpaid: totalValue - paidValue });
  } catch (err) {
    console.error("/api/invoices/summary error:", err);
    res.status(500).json({ message: "Gagal mengambil ringkasan invoice." });
  }
});

// Create surat jalan
app.post("/api/surat-jalan", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { tipe, no_invoice, nama_tujuan, items, catatan } = req.body || {};
    if (!tipe || !items) return res.status(400).json({ message: "tipe dan items diperlukan." });

    const date = new Date();
    const no_sj_prefix = tipe === "VENDOR" ? "SJW" : "SJC";
    const no_sj = `${no_sj_prefix}-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}-${Date.now()}`;

    const insertQ = `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING no_sj`;
    const r = await client.query(insertQ, [tipe, no_sj, no_invoice || null, nama_tujuan || null, JSON.stringify(items), catatan || null]);

    // If vendor type, update related work_orders (example)
    if (tipe === "VENDOR") {
      const itemIds = (items || []).map((i) => i.id).filter(Boolean);
      if (itemIds.length) {
        await client.query(`UPDATE work_orders SET di_warna = 'true', no_sj_warna = $1 WHERE id = ANY($2::int[])`, [no_sj, itemIds]);
      }
    }

    await client.query("COMMIT");
    res.status(201).json(r.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("/api/surat-jalan error:", err);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  } finally {
    client.release();
  }
});

// ======= KEUANGAN =======
app.get("/api/keuangan/saldo", authenticateToken, async (req, res) => {
  try {
    const r = await safeQuery("SELECT * FROM kas ORDER BY id ASC");
    res.json(r.rows || []);
  } catch (err) {
    console.error("/api/keuangan/saldo error:", err);
    res.status(500).json({ message: "Gagal mengambil data saldo." });
  }
});

app.post("/api/keuangan/transaksi", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { tanggal, jumlah, tipe, kas_id, keterangan } = req.body || {};
    if (!tanggal || jumlah === undefined || !tipe || !kas_id) return res.status(400).json({ message: "tanggal, jumlah, tipe, kas_id diperlukan." });

    const jumlahNumeric = parseFloat(jumlah);
    const kasRes = await client.query("SELECT * FROM kas WHERE id = $1 FOR UPDATE", [kas_id]);
    if (kasRes.rows.length === 0) throw new Error("Kas tidak ditemukan.");
    const kas = kasRes.rows[0];
    const saldoSebelum = parseFloat(kas.saldo || 0);
    const saldoSesudah = tipe === "PEMASUKAN" ? saldoSebelum + jumlahNumeric : saldoSebelum - jumlahNumeric;

    await client.query("UPDATE kas SET saldo = $1 WHERE id = $2", [saldoSesudah, kas_id]);
    await client.query("INSERT INTO transaksi_keuangan (tanggal, jumlah, tipe, kas_id, keterangan, saldo_sebelum, saldo_sesudah) VALUES ($1,$2,$3,$4,$5,$6,$7)", [tanggal, jumlahNumeric, tipe, kas_id, keterangan || null, saldoSebelum, saldoSesudah]);
    await client.query("COMMIT");
    res.status(201).json({ message: "Transaksi berhasil disimpan." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("/api/keuangan/transaksi error:", err);
    res.status(500).json({ message: err.message || "Terjadi kesalahan pada server." });
  } finally {
    client.release();
  }
});

app.get("/api/keuangan/riwayat", authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "Bulan dan tahun diperlukan." });

    const q = `
      SELECT tk.id, tk.tanggal, tk.jumlah, tk.tipe, tk.keterangan, tk.saldo_sebelum, tk.saldo_sesudah, k.nama_kas
      FROM transaksi_keuangan tk
      JOIN kas k ON tk.kas_id = k.id
      WHERE EXTRACT(MONTH FROM tk.tanggal) = $1 AND EXTRACT(YEAR FROM tk.tanggal) = $2
      ORDER BY tk.tanggal DESC, tk.id DESC
    `;
    const r = await safeQuery(q, [month, year]);
    res.json(r.rows || []);
  } catch (err) {
    console.error("/api/keuangan/riwayat error:", err);
    res.status(500).json({ message: "Gagal mengambil riwayat keuangan." });
  }
});

// ======= ADMIN =======
app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    if (!req.user || (req.user.username || "").toLowerCase() !== "faisal") return res.status(403).json({ message: "Akses ditolak." });
    const r = await safeQuery("SELECT id, username, phone_number, role, COALESCE(subscription_status, 'inactive') AS subscription_status FROM users ORDER BY id ASC");
    res.json(r.rows || []);
  } catch (err) {
    console.error("/api/users error:", err);
    res.status(500).json({ message: "Gagal memuat data user." });
  }
});

// Activate/deactivate subscription
app.post("/api/admin/users/:id/activate", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!req.user || (req.user.username || "").toLowerCase() !== "faisal") return res.status(403).json({ message: "Akses ditolak." });
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Status tidak valid." });
    const r = await safeQuery("UPDATE users SET subscription_status = $1 WHERE id = $2 RETURNING id, username, subscription_status", [status, id]);
    if (!r.rows || r.rows.length === 0) return res.status(404).json({ message: "User tidak ditemukan." });
    res.json({ message: `Langganan user berhasil diubah menjadi ${status}.`, user: r.rows[0] });
  } catch (err) {
    console.error("/api/admin/users/:id/activate error:", err);
    res.status(500).json({ message: "Gagal mengubah status langganan user." });
  }
});

// ======================================================
// server.js — GANTI SELURUH BLOK SOCKET.IO INI
// 🔌 SOCKET.IO - REALTIME SYNC UNTUK WORK ORDERS & LAINNYA
// ======================================================

io.on("connection", (socket) => {
  console.log(`🟢 User terhubung via Socket.IO: ${socket.id}`);

  // ========= WORK ORDERS (Event dari HTTP) =========
  // Ini tetap dipakai untuk "Create" dan "Delete"
  socket.on("wo_created", (data) => {
    socket.broadcast.emit("wo_created", data);
  });
  socket.on("wo_deleted", (data) => {
    socket.broadcast.emit("wo_deleted", data);
  });


  // ✅ INI LISTENER BARU UNTUK REAL-TIME EDIT (dari Langkah 2)
  socket.on("wo_update_cell", async (data) => {
    try {
      const { id, field, value } = data;
      
      // Validasi kolom (copy dari app.patch /api/workorders/:id)
      const valid = [
        "tanggal", "nama_customer", "deskripsi", "ukuran", "qty", "harga",
        "no_inv", "di_produksi", "di_warna", "siap_kirim", "di_kirim",
        "pembayaran", "ekspedisi"
      ];
      
      if (!valid.includes(field)) {
        console.warn(`[Socket] Update dibatalkan: kolom ${field} tidak valid.`);
        return; 
      }

      // Normalisasi boolean
      let finalValue = value;
      if (typeof value === "boolean") finalValue = value ? "true" : "false";

      // Simpan ke database
      const q = `UPDATE work_orders SET "${field}" = $1, updated_at = NOW() WHERE id = $2 RETURNING *`;
      const r = await safeQuery(q, [finalValue, id]);

      if (r.rows && r.rows.length > 0) {
        const updated = r.rows[0];
        console.log(`📡 [Socket] WO Diperbarui (via cell edit): ${id}`);
        
        // Broadcast ke SEMUA klien (termasuk pengirim)
        io.emit("wo_updated", updated);
      }

    } catch (err) {
      console.error("❌ [Socket] Gagal update wo_update_cell:", err.message);
      // Opsional: kirim error kembali ke pengirim
      socket.emit("wo_update_error", { id: data.id, message: err.message });
    }
  });


  // ========= STATUS BARANG (Tetap ada jika dipakai) =========
  socket.on("status_updated", (data) => {
    console.log("📡 [Socket] Status Barang diperbarui:", data?.id);
    socket.broadcast.emit("status_updated", data);
  });

  // ========= KEUANGAN (Tetap ada jika dipakai) =========
  socket.on("finance_updated", (data) => {
    console.log("📡 [Socket] Keuangan diperbarui:", data?.id);
    socket.broadcast.emit("finance_updated", data);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 User terputus: ${socket.id}`);
  });
});

// ======= Fallback for frontend assets (serve SPA) =======
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, "toto-frontend", "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send("Frontend not found.");
});

// ======= Start server =======
httpServer.listen(PORT, () => {
  console.log(`🚀 Server (and Socket.IO) running on port ${PORT}`);
  console.log(`DATABASE_URL used: ${DATABASE_URL ? "[provided]" : "[none]"}`);
});

