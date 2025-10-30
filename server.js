// ==============================
// server.js — FULL REBUILD (Part 1/4)
// ==============================

// ------------------------------
// Imports & core setup
// ------------------------------
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

// ------------------------------
// Config / Env
// ------------------------------
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "kunci-rahasia-super-aman-untuk-toto-app";
const DATABASE_URL = process.env.DATABASE_URL || process.env.FALLBACK_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";

// Create HTTP server & Socket.IO server (io will be used later)
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] },
});

// ------------------------------
// Middleware
// ------------------------------
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.options("*", cors());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "x-access-token"],
  })
);

// Serve uploads and frontend static (if present)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
if (fs.existsSync(path.join(__dirname, "toto-frontend"))) {
  app.use(express.static(path.join(__dirname, "toto-frontend")));
  app.get(/^(?!\/api).*/, (req, res) => {
    const indexPath = path.join(__dirname, "toto-frontend", "index.html");
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(404).send("Frontend not found.");
  });
}

// ------------------------------
// Postgres pool
// ------------------------------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    DATABASE_URL && DATABASE_URL.startsWith("postgresql://") && process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

// ------------------------------
// Multer (file upload)
// ------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uid = (req.user && req.user.id) ? req.user.id : "anon";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uid}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ------------------------------
// Helper: standardized error responder
// ------------------------------
function respondError(res, status = 500, message = "Server error", extra = {}) {
  return res.status(status).json({ message, ...extra });
}

// ------------------------------
// Auth middleware (authenticateToken)
// ------------------------------
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    let token = null;
    if (authHeader && typeof authHeader === "string") {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") token = parts[1];
    }
    if (!token && req.headers["x-access-token"]) token = req.headers["x-access-token"];

    if (!token) return res.status(401).json({ message: "Token tidak ditemukan." });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) {
        console.error("JWT verify error:", err && err.name, err && err.message);
        if (err.name === "TokenExpiredError") return res.status(401).json({ message: "EXPIRED" });
        return res.status(403).json({ message: "Token tidak valid." });
      }
      req.user = payload;
      next();
    });
  } catch (err) {
    console.error("authenticateToken error:", err);
    return res.status(500).json({ message: "Kesalahan autentikasi server." });
  }
}

// ------------------------------
// AUTH ROUTES: register / login / me / refresh
// ------------------------------
app.post("/api/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return respondError(res, 400, "Username dan password wajib diisi.");

    const hashed = await bcrypt.hash(password, 10);
    const r = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) RETURNING id, username, role",
      [username, hashed, role || "user"]
    );
    res.status(201).json({ message: "Registrasi berhasil", user: r.rows[0] });
  } catch (err) {
    console.error("register error:", err);
    if (err.code === "23505") return respondError(res, 409, "Username sudah digunakan.");
    respondError(res, 500, "Error server saat registrasi.");
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return respondError(res, 400, "Username dan password wajib diisi.");

    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return respondError(res, 401, "Username atau password salah!");

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return respondError(res, 401, "Username atau password salah!");

    // Optional: check subscription status if you use it
    if (user.role !== "admin" && user.subscription_status === "inactive") {
      return respondError(res, 403, "Subscription inactive. Hubungi admin.");
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: "8h",
    });

    res.json({
      message: "Login berhasil!",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subscription_status: user.subscription_status,
      },
    });
  } catch (err) {
    console.error("login error", err);
    respondError(res, 500, "Terjadi kesalahan pada server.");
  }
});

// GET current user
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT id, username, profile_picture_url, role FROM users WHERE id = $1", [
      req.user.id,
    ]);
    if (r.rows.length === 0) return respondError(res, 404, "User tidak ditemukan.");
    res.json(r.rows[0]);
  } catch (err) {
    console.error("/api/me error", err);
    respondError(res, 500, "Error fetching user.");
  }
});

// Refresh token (single endpoint, handles expired and valid tokens)
app.post("/api/refresh", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return respondError(res, 401, "Token wajib dikirim.");

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err && err.name === "TokenExpiredError") {
        // token expired — decode payload and issue new 7d token
        const decoded = jwt.decode(token);
        if (!decoded) return respondError(res, 403, "Token tidak valid.");
        const newToken = jwt.sign({ id: decoded.id, username: decoded.username, role: decoded.role }, JWT_SECRET, {
          expiresIn: "7d",
        });
        console.log(`♻️ Token user ${decoded.username} diperbarui.`);
        return res.json({ token: newToken });
      }
      if (err) return respondError(res, 403, "Token tidak valid atau sudah kadaluarsa.");
      // token valid — return same token (or optionally issue a fresh one)
      const newToken = jwt.sign({ id: payload.id, username: payload.username, role: payload.role }, JWT_SECRET, {
        expiresIn: "7d",
      });
      return res.json({ token: newToken });
    });
  } catch (err) {
    console.error("refresh token error", err);
    respondError(res, 500, "Gagal memperbarui token.");
  }
});

// Export io for next parts (not necessary but keeps reference)
app.set("io", io);

// ------------------------------
// End of Part 1/4
// ------------------------------
// ==============================
// server.js — FULL REBUILD (Part 2/4)
// ==============================

// =============================================================
// 📊 DASHBOARD SUMMARY (simple numeric + status counts)
// =============================================================
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return respondError(res, 400, "Bulan dan tahun diperlukan.");
  try {
    const summaryQuery = `
      SELECT
        COALESCE(SUM(
          NULLIF(REPLACE(CAST(ukuran AS TEXT), ',', '.')::numeric, 0) *
          NULLIF(REPLACE(CAST(qty AS TEXT), ',', '.')::numeric, 0) *
          NULLIF(REPLACE(CAST(harga AS TEXT), ',', '.')::numeric, 0)
        ), 0) AS total_rupiah,
        COUNT(DISTINCT nama_customer) AS total_customer
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;
    const statusQuery = `
      SELECT
        COUNT(*) FILTER (WHERE di_produksi IS NOT TRUE) AS belum_produksi,
        COUNT(*) FILTER (WHERE di_produksi = TRUE AND (di_warna IS NOT TRUE)) AS sudah_produksi,
        COUNT(*) FILTER (WHERE di_warna = TRUE AND (siap_kirim IS NOT TRUE)) AS di_warna,
        COUNT(*) FILTER (WHERE siap_kirim = TRUE AND (di_kirim IS NOT TRUE)) AS siap_kirim,
        COUNT(*) FILTER (WHERE di_kirim = TRUE) AS di_kirim
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2;
    `;
    const [sum, stat] = await Promise.all([
      pool.query(summaryQuery, [month, year]),
      pool.query(statusQuery, [month, year]),
    ]);
    res.json({ summary: sum.rows[0], statusCounts: stat.rows[0] });
  } catch (err) {
    console.error("dashboard error", err);
    respondError(res, 500, "Gagal mengambil data dashboard.");
  }
});

// =============================================================
// 🧾 WORK ORDERS: Chunk (lazy load for Tabulator)
// =============================================================
app.get('/api/workorders/chunk', async (req, res) => {
  try {
    const { month, year, offset = 0, limit = 10000 } = req.query;

    const result = await pool.query(`
      SELECT * FROM work_orders
      WHERE EXTRACT(MONTH FROM tanggal) = $1 AND EXTRACT(YEAR FROM tanggal) = $2
      ORDER BY id ASC
      OFFSET $3 LIMIT $4
    `, [month, year, offset, limit]);

    const totalResult = await pool.query(`
      SELECT COUNT(*) AS total FROM work_orders
      WHERE EXTRACT(MONTH FROM tanggal) = $1 AND EXTRACT(YEAR FROM tanggal) = $2
    `, [month, year]);

    const total = parseInt(totalResult.rows[0].total);
    const last_page = result.rows.length + Number(offset) >= total ? 1 : 0;

    res.json({ data: result.rows, total, last_page });
  } catch (err) {
    console.error('❌ Gagal ambil work orders:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =============================================================
// ➕ CREATE WORK ORDER (Realtime broadcast)
// =============================================================
app.post("/api/workorders", authenticateToken, async (req, res) => {
  try {
    const { tanggal, nama_customer, deskripsi, ukuran, qty } = req.body;
    if (!deskripsi) return respondError(res, 400, "Deskripsi wajib diisi.");

    const today = new Date();
    const tgl = tanggal || today.toISOString().slice(0, 10);
    const bulan = new Date(tgl).getMonth() + 1;
    const tahun = new Date(tgl).getFullYear();

    const q = `
      INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *;
    `;
    const r = await pool.query(q, [tgl, nama_customer || "Tanpa Nama", deskripsi, ukuran, qty, bulan, tahun]);
    const newRow = r.rows[0];
    io.emit("wo_created", newRow);
    res.status(201).json(newRow);
  } catch (err) {
    console.error("workorders POST error", err);
    respondError(res, 500, "Gagal menambah Work Order.");
  }
});

// =============================================================
// ✏️ UPDATE WORK ORDER (Autosave + Broadcast)
// =============================================================
app.patch("/api/workorders/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (!id) return respondError(res, 400, "ID wajib diisi.");
    if (!updates || Object.keys(updates).length === 0) return respondError(res, 400, "Tidak ada data untuk update.");

    const allowedCols = [
      "tanggal", "nama_customer", "deskripsi", "ukuran", "qty",
      "harga", "no_inv", "di_produksi", "di_warna", "siap_kirim",
      "di_kirim", "pembayaran", "ekspedisi"
    ];

    const set = [];
    const vals = [];
    let i = 1;
    for (const [key, val] of Object.entries(updates)) {
      if (allowedCols.includes(key)) {
        set.push(`"${key}"=$${i++}`);
        vals.push(val);
      }
    }
    if (!set.length) return respondError(res, 400, "Tidak ada kolom valid.");

    vals.push(id);
    const q = `UPDATE work_orders SET ${set.join(", ")}, updated_at=NOW() WHERE id=$${i} RETURNING *;`;
    const r = await pool.query(q, vals);
    if (r.rows.length === 0) return respondError(res, 404, "Work Order tidak ditemukan.");

    const updatedRow = r.rows[0];
    io.emit("wo_updated", updatedRow);
    res.json({ message: "Data berhasil diperbarui.", data: updatedRow });
  } catch (err) {
    console.error("PATCH /api/workorders/:id error:", err);
    respondError(res, 500, "Gagal memperbarui Work Order.", { error: err.message });
  }
});

// =============================================================
// 🗑️ DELETE WORK ORDER (Broadcast delete)
// =============================================================
app.delete("/api/workorders/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query("DELETE FROM work_orders WHERE id=$1 RETURNING id;", [id]);
    if (r.rowCount === 0) return respondError(res, 404, "Work Order tidak ditemukan.");
    io.emit("wo_deleted", { id });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /workorders error:", err);
    respondError(res, 500, "Gagal menghapus Work Order.");
  }
});

// =============================================================
// 📦 MARK WORK ORDERS AS PRINTED (update di_produksi = true)
// =============================================================
app.post("/api/workorders/mark-printed", authenticateToken, async (req, res) => {
  try {
    let { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return respondError(res, 400, "Daftar ID tidak valid.");
    ids = ids.map((v) => parseInt(v)).filter((v) => !isNaN(v));

    const result = await pool.query(
      "UPDATE work_orders SET di_produksi = TRUE WHERE id = ANY($1) RETURNING *;",
      [ids]
    );
    const updatedRows = result.rows;
    updatedRows.forEach((r) => io.emit("wo_updated", r));
    res.json({ message: `Berhasil menandai ${updatedRows.length} Work Order.`, updated: updatedRows });
  } catch (err) {
    console.error("mark-printed error", err);
    respondError(res, 500, "Gagal menandai Work Order.", { error: err.message });
  }
});

// =============================================================
// 📋 GET /api/workorders/by-ids  → for printing PO
// =============================================================
app.post("/api/workorders/by-ids", authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return respondError(res, 400, "Daftar ID tidak valid.");
    const result = await pool.query(
      `SELECT id, nama_customer, deskripsi, ukuran, qty, tanggal
       FROM work_orders WHERE id = ANY($1::int[]) ORDER BY tanggal ASC, id ASC;`,
      [ids]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("workorders by-ids error", err);
    respondError(res, 500, "Gagal mengambil data Work Order.", { error: err.message });
  }
});

// =============================================================
// 📅 GET /api/workorders/by-date
// =============================================================
// =============================================================
// 📋 WORK ORDERS — ambil data by month & year
// =============================================================
app.get("/api/workorders", authenticateToken, async (req, res) => {
  try {
    const { month, year, customer, status } = req.query;
    if (!month || !year) return respondError(res, 400, "Bulan dan tahun diperlukan.");

    let query = `
      SELECT id, nama_customer, deskripsi, qty, ukuran,
             di_produksi, di_warna, siap_kirim, di_kirim
      FROM work_orders
      WHERE bulan = $1 AND tahun = $2
    `;
    const params = [month, year];

    if (customer) {
      query += ` AND LOWER(nama_customer) LIKE LOWER($3)`;
      params.push(`%${customer}%`);
    }

    if (status) {
      switch (status) {
        case "belum_produksi":
          query += " AND di_produksi IS NOT TRUE";
          break;
        case "sudah_produksi":
          query += " AND di_produksi = TRUE AND (di_warna IS NOT TRUE)";
          break;
        case "di_warna":
          query += " AND di_warna = TRUE AND (siap_kirim IS NOT TRUE)";
          break;
        case "siap_kirim":
          query += " AND siap_kirim = TRUE AND (di_kirim IS NOT TRUE)";
          break;
        case "di_kirim":
          query += " AND di_kirim = TRUE";
          break;
      }
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Gagal ambil work orders:", err);
    respondError(res, 500, "Gagal mengambil data work orders.");
  }
});


// =============================================================
// 🎨 GET /api/barang-siap-warna
// =============================================================
app.get("/api/barang-siap-warna", authenticateToken, async (req, res) => {
  try {
    const q = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, di_produksi, di_warna
      FROM work_orders
      WHERE di_produksi = TRUE AND (di_warna IS NOT TRUE)
      ORDER BY tanggal ASC, id ASC;
    `;
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (err) {
    console.error("barang-siap-warna error", err);
    respondError(res, 500, "Gagal mengambil data barang siap warna.");
  }
});

// =============================================================
// 🏷️ PATCH /api/workorders/:id/status
// =============================================================
app.patch("/api/workorders/:id/status", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { columnName, value } = req.body;
    const validCols = ["di_produksi", "di_warna", "siap_kirim", "di_kirim", "pembayaran", "ekspedisi"];
    if (!validCols.includes(columnName)) return respondError(res, 400, "Kolom tidak valid.");

    const boolValue = value === true || value === "true" ? "true" : "false";
    let q = `UPDATE work_orders SET "${columnName}"=$1`;
    if (columnName === "di_produksi" && boolValue === "true") q += `, print_po='true'`;
    q += ` WHERE id=$2 RETURNING *;`;
    const result = await pool.query(q, [boolValue, id]);
    if (result.rows.length === 0) return respondError(res, 404, "Work Order tidak ditemukan.");

    const row = result.rows[0];
    io.emit("wo_updated", row);
    res.json({ message: "Status berhasil diperbarui.", data: row });
  } catch (err) {
    console.error("PATCH status error", err);
    respondError(res, 500, "Gagal memperbarui status Work Order.", { error: err.message });
  }
});

// =============================================================
// 📊 GET /api/status-barang
// =============================================================
app.get("/api/status-barang", authenticateToken, async (req, res) => {
  try {
    const { customer, month, year } = req.query;
    if (!month || !year) return respondError(res, 400, "Parameter bulan dan tahun wajib diisi.");
    const params = [month, year];
    let where = `WHERE bulan=$1 AND tahun=$2 AND id IS NOT NULL`;
    if (customer && customer.trim()) {
      params.push(`%${customer.trim()}%`);
      where += ` AND nama_customer ILIKE $${params.length}`;
    }
    const q = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, harga,
             no_inv, di_produksi, di_warna, siap_kirim, di_kirim, pembayaran
      FROM work_orders ${where}
      ORDER BY tanggal ASC, id ASC;
    `;
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) {
    console.error("/api/status-barang error", err);
    respondError(res, 500, "Gagal mengambil data status barang.");
  }
});

// ==============================
// server.js — FULL REBUILD (Part 3/4)
// ==============================

// =============================================================
// 📦 STOK BAHAN (Inventori + Riwayat)
// =============================================================
app.get("/api/stok", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stok ORDER BY id ASC;");
    res.json(result.rows);
  } catch (err) {
    console.error("stok GET error", err);
    respondError(res, 500, "Gagal mengambil data stok.");
  }
});

app.post("/api/stok/update", authenticateToken, async (req, res) => {
  try {
    const { nama_bahan, jumlah, keterangan, tipe } = req.body;
    if (!nama_bahan || !jumlah || !tipe) return respondError(res, 400, "Data stok tidak lengkap.");
    const jumlahNum = parseFloat(jumlah);

    await pool.query("BEGIN");
    const find = await pool.query("SELECT * FROM stok WHERE nama_bahan=$1 FOR UPDATE;", [nama_bahan]);
    if (find.rows.length === 0) {
      await pool.query(
        "INSERT INTO stok (nama_bahan, jumlah) VALUES ($1,$2);",
        [nama_bahan, tipe === "MASUK" ? jumlahNum : -jumlahNum]
      );
    } else {
      const curr = parseFloat(find.rows[0].jumlah || 0);
      const newQty = tipe === "MASUK" ? curr + jumlahNum : curr - jumlahNum;
      await pool.query("UPDATE stok SET jumlah=$1 WHERE nama_bahan=$2;", [newQty, nama_bahan]);
    }

    await pool.query(
      "INSERT INTO riwayat_stok (tanggal, nama_bahan, jumlah, tipe, keterangan) VALUES (NOW(),$1,$2,$3,$4);",
      [nama_bahan, jumlahNum, tipe, keterangan || "-"]
    );

    await pool.query("COMMIT");
    res.json({ message: "Stok berhasil diperbarui." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("stok update error", err);
    respondError(res, 500, "Gagal memperbarui stok.", { error: err.message });
  }
});

// =============================================================
// 👨‍🏭 KARYAWAN & PAYROLL
// =============================================================
app.get("/api/karyawan", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM karyawan ORDER BY id ASC;");
    res.json(result.rows);
  } catch (err) {
    console.error("karyawan GET error", err);
    respondError(res, 500, "Gagal mengambil data karyawan.");
  }
});

app.post("/api/karyawan", authenticateToken, async (req, res) => {
  try {
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body;
    const q = `INSERT INTO karyawan (nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon)
               VALUES ($1,$2,$3,$4,$5) RETURNING *;`;
    const r = await pool.query(q, [nama_karyawan, gaji_harian || 0, potongan_bpjs_kesehatan || 0, potongan_bpjs_ketenagakerjaan || 0, kasbon || 0]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("karyawan POST error", err);
    respondError(res, 500, "Gagal menambahkan karyawan.");
  }
});

app.put("/api/karyawan/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body;
    const q = `UPDATE karyawan
               SET nama_karyawan=$1, gaji_harian=$2, potongan_bpjs_kesehatan=$3, potongan_bpjs_ketenagakerjaan=$4, kasbon=$5
               WHERE id=$6 RETURNING *;`;
    const r = await pool.query(q, [nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon, id]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error("karyawan PUT error", err);
    respondError(res, 500, "Gagal memperbarui data karyawan.");
  }
});

app.delete("/api/karyawan/:id", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM karyawan WHERE id=$1;", [req.params.id]);
    res.status(204).send();
  } catch (err) {
    console.error("karyawan DELETE error", err);
    respondError(res, 500, "Gagal menghapus data karyawan.");
  }
});

// PAYROLL
app.get("/api/payroll", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM payroll ORDER BY tanggal DESC;");
    res.json(r.rows);
  } catch (err) {
    console.error("payroll GET error", err);
    respondError(res, 500, "Gagal mengambil data payroll.");
  }
});

app.post("/api/payroll", authenticateToken, async (req, res) => {
  try {
    const { karyawan_id, tanggal, total_gaji, potongan, keterangan } = req.body;
    const q = `
      INSERT INTO payroll (karyawan_id, tanggal, total_gaji, potongan, keterangan)
      VALUES ($1,$2,$3,$4,$5) RETURNING *;
    `;
    const r = await pool.query(q, [karyawan_id, tanggal, total_gaji, potongan, keterangan]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("payroll POST error", err);
    respondError(res, 500, "Gagal menyimpan data payroll.");
  }
});

// =============================================================
// 🚛 SURAT JALAN
// =============================================================
app.get("/api/surat-jalan", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM surat_jalan ORDER BY tanggal DESC;");
    res.json(result.rows);
  } catch (err) {
    console.error("surat-jalan GET error", err);
    respondError(res, 500, "Gagal mengambil data surat jalan.");
  }
});

app.post("/api/surat-jalan", authenticateToken, async (req, res) => {
  try {
    const { tanggal, nama_customer, alamat, nomor_surat, keterangan } = req.body;
    const q = `
      INSERT INTO surat_jalan (tanggal, nama_customer, alamat, nomor_surat, keterangan)
      VALUES ($1,$2,$3,$4,$5) RETURNING *;
    `;
    const r = await pool.query(q, [tanggal, nama_customer, alamat, nomor_surat, keterangan]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("surat-jalan POST error", err);
    respondError(res, 500, "Gagal menambahkan surat jalan.");
  }
});

// =============================================================
// 💰 KEUANGAN
// =============================================================
app.get("/api/keuangan/saldo", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM kas ORDER BY id ASC;");
    res.json(r.rows);
  } catch (err) {
    console.error("keuangan saldo error", err);
    respondError(res, 500, "Gagal mengambil data kas.");
  }
});

app.post("/api/keuangan/transaksi", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { tanggal, jumlah, tipe, kas_id, keterangan } = req.body;
    if (!tanggal || !jumlah || !tipe || !kas_id) throw new Error("Data transaksi tidak lengkap.");
    const jumlahNum = parseFloat(jumlah);
    await client.query("BEGIN");

    const kas = await client.query("SELECT * FROM kas WHERE id=$1 FOR UPDATE;", [kas_id]);
    if (!kas.rows.length) throw new Error("Kas tidak ditemukan.");
    const saldoSebelum = parseFloat(kas.rows[0].saldo);
    const saldoSesudah = tipe === "PEMASUKAN" ? saldoSebelum + jumlahNum : saldoSebelum - jumlahNum;
    await client.query("UPDATE kas SET saldo=$1 WHERE id=$2;", [saldoSesudah, kas_id]);
    await client.query(
      "INSERT INTO transaksi_keuangan (tanggal,jumlah,tipe,kas_id,keterangan,saldo_sebelum,saldo_sesudah) VALUES ($1,$2,$3,$4,$5,$6,$7);",
      [tanggal, jumlahNum, tipe, kas_id, keterangan, saldoSebelum, saldoSesudah]
    );
    await client.query("COMMIT");
    res.json({ message: "Transaksi berhasil disimpan." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("keuangan transaksi error", err);
    respondError(res, 500, err.message);
  } finally {
    client.release();
  }
});

app.get("/api/keuangan/riwayat", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM transaksi_keuangan ORDER BY tanggal DESC LIMIT 200;");
    res.json(r.rows);
  } catch (err) {
    console.error("keuangan riwayat error", err);
    respondError(res, 500, "Gagal mengambil riwayat transaksi.");
  }
});

// =============================================================
// 🧾 INVOICE
// =============================================================
app.get("/api/invoice/:inv", authenticateToken, async (req, res) => {
  try {
    const { inv } = req.params;
    const result = await pool.query("SELECT * FROM invoices WHERE invoice_no = $1;", [inv]);
    if (result.rows.length === 0) return respondError(res, 404, "Invoice tidak ditemukan.");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("invoice GET error", err);
    respondError(res, 500, "Gagal mengambil data invoice.");
  }
});

app.get("/api/invoices/summary", authenticateToken, async (req, res) => {
  try {
    const q = `
      SELECT invoice_no, tanggal, nama_customer, total, status_pembayaran
      FROM invoices
      ORDER BY tanggal DESC
      LIMIT 200;
    `;
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (err) {
    console.error("invoice summary error", err);
    respondError(res, 500, "Gagal mengambil ringkasan invoice.");
  }
});

// =============================================================
// 👑 ADMIN PANEL (FAISAL)
// =============================================================
app.get("/api/users", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, username, role, subscription_status FROM users ORDER BY id ASC;");
    res.json(result.rows);
  } catch (err) {
    console.error("users GET error", err);
    respondError(res, 500, "Gagal mengambil daftar pengguna.");
  }
});

app.patch("/api/admin/users/:id/activate", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) return respondError(res, 400, "Status tidak valid.");
    const q = `UPDATE users SET subscription_status=$1 WHERE id=$2 RETURNING id, username, subscription_status;`;
    const r = await pool.query(q, [status, id]);
    if (r.rows.length === 0) return respondError(res, 404, "User tidak ditemukan.");
    res.json({ message: "Status pengguna diperbarui.", user: r.rows[0] });
  } catch (err) {
    console.error("admin activate error", err);
    respondError(res, 500, "Gagal memperbarui status pengguna.");
  }
});


// ==============================
// server.js — FULL REBUILD (Part 4/4)
// ==============================

// =============================================================
// 🔌 SOCKET.IO CONNECTION (Realtime updates for all clients)
// =============================================================
io.on("connection", (socket) => {
  console.log(`🔗 User terhubung via Socket.IO: ${socket.id}`);

  // Client meminta data awal (opsional)
  socket.on("request_initial_data", async ({ month, year }) => {
    try {
      if (!month || !year) return;
      const data = await pool.query(
        `SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, di_produksi
         FROM work_orders
         WHERE EXTRACT(MONTH FROM tanggal) = $1 AND EXTRACT(YEAR FROM tanggal) = $2
         ORDER BY tanggal ASC, id ASC;`,
        [month, year]
      );
      socket.emit("initial_data", data.rows);
    } catch (err) {
      console.error("❌ Gagal kirim initial data:", err.message);
    }
  });

  // Broadcast perubahan data (opsional)
  socket.on("wo_created", (data) => socket.broadcast.emit("wo_created", data));
  socket.on("wo_updated", (data) => socket.broadcast.emit("wo_updated", data));
  socket.on("wo_deleted", (data) => socket.broadcast.emit("wo_deleted", data));

  socket.on("disconnect", () => {
    console.log(`❌ Socket terputus: ${socket.id}`);
  });
});

// =============================================================
// 🚀 START SERVER
// =============================================================
httpServer.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`🌐 Akses API: http://localhost:${PORT}/api`);
  console.log(`💾 Database URL: ${DATABASE_URL ? "Tersambung" : "Tidak ada koneksi DB"}`);
});

// =============================================================
// ✅ PENUTUP
// =============================================================
// File server.js ini sudah mencakup:
// - Auth (register/login/refresh/me)
// - Work Orders (full CRUD + realtime)
// - Stok, Payroll, Keuangan, Surat Jalan, Invoice
// - Admin management
// - Socket.IO realtime sync
// Siap digunakan di Railway atau Render tanpa perubahan tambahan.
