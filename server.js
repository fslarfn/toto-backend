// ==========================================================
// 🚀 SERVER.JS - ERP TOTO (FINAL ULTRA COMPLETE VERSION)
// ==========================================================

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");
const cron = require("node-cron");

// ==========================================================
// ⚙️ KONFIGURASI DASAR
// ==========================================================
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "kunci-rahasia-super-aman-untuk-toto-app";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@postgres.railway.internal:5432/railway";

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PATCH", "DELETE"] },
});

// ==========================================================
// 🧩 MIDDLEWARE
// ==========================================================
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "toto-frontend")));

// ==========================================================
// 🗄️ KONEKSI DATABASE
// ==========================================================
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
pool.on("error", (err) => console.error("Unexpected DB error", err));

// ==========================================================
// 🔐 AUTENTIKASI TOKEN
// ==========================================================
function authenticateToken(req, res, next) {
  const header = req.headers["authorization"];
  const token = header && header.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token tidak ditemukan." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token tidak valid atau kadaluarsa." });
    req.user = user;
    next();
  });
}

// ==========================================================
// 💾 UTILITAS: PASTIKAN 10.000 DATA PER BULAN
// ==========================================================
async function ensureMonthlyRows(bulan, tahun) {
  const client = await pool.connect();
  try {
    await client.query("SET statement_timeout TO 60000");
    const countRes = await client.query(
      "SELECT COUNT(*) FROM work_orders WHERE bulan = $1 AND tahun = $2",
      [bulan, tahun]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    const target = 10000;

    if (count >= target) {
      console.log(`✅ Bulan ${bulan}/${tahun} sudah memiliki ${count} baris.`);
      return;
    }

    const missing = target - count;
    console.log(`🧱 Menambahkan ${missing} baris kosong (${bulan}/${tahun})...`);

    const batchSize = 1000;
    const totalBatch = Math.ceil(missing / batchSize);

    for (let batch = 0; batch < totalBatch; batch++) {
      const rows = [];
      for (let i = 0; i < batchSize && i + batch * batchSize < missing; i++) {
        rows.push(`(NULL, '', '', '', '', $1, $2)`);
      }
      await client.query(
        `INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, bulan, tahun)
         VALUES ${rows.join(",")}`,
        [bulan, tahun]
      );
      console.log(`✅ Batch ${batch + 1}/${totalBatch} selesai`);
    }
  } catch (err) {
    console.error("❌ ensureMonthlyRows error:", err.message);
  } finally {
    client.release();
  }
}

// ==========================================================
// 🔑 LOGIN
// ==========================================================
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.status(401).json({ message: "User tidak ditemukan" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: "Password salah" });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Kesalahan server login" });
  }
});

// ==========================================================
// 📊 DASHBOARD
// ==========================================================
app.get("/api/dashboard", authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: "month dan year wajib" });
  try {
    const client = await pool.connect();
    const summary = await client.query(
      `SELECT 
         COALESCE(SUM(NULLIF(qty, '')::numeric * NULLIF(ukuran, '')::numeric * NULLIF(harga, '')::numeric), 0) AS total_rupiah,
         COUNT(DISTINCT nama_customer) AS total_customer
       FROM work_orders
       WHERE bulan = $1 AND tahun = $2`,
      [month, year]
    );

    const status = await client.query(
      `SELECT
        COUNT(*) FILTER (WHERE di_produksi IS NULL OR di_produksi = 'false') AS belum_produksi,
        COUNT(*) FILTER (WHERE di_produksi = 'true') AS sudah_produksi,
        COUNT(*) FILTER (WHERE di_warna = 'true') AS di_warna,
        COUNT(*) FILTER (WHERE siap_kirim = 'true') AS siap_kirim,
        COUNT(*) FILTER (WHERE di_kirim = 'true') AS di_kirim
      FROM work_orders WHERE bulan = $1 AND tahun = $2`,
      [month, year]
    );
    res.json({ summary: summary.rows[0], statusCounts: status.rows[0] });
    client.release();
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Gagal ambil data dashboard" });
  }
});

// ==========================================================
// 📋 WORK ORDERS (DATA + AUTO GENERATE)
// ==========================================================
app.get("/api/workorders/chunk", authenticateToken, async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return res.status(400).json({ message: "month dan year wajib" });

  await ensureMonthlyRows(parseInt(month), parseInt(year));

  try {
    const dataRes = await pool.query(
      `SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, di_produksi, di_warna, siap_kirim, di_kirim 
       FROM work_orders WHERE bulan = $1 AND tahun = $2 ORDER BY id ASC LIMIT 10000`,
      [month, year]
    );
    res.json({ data: dataRes.rows, total: dataRes.rowCount });
  } catch (err) {
    console.error("❌ workorders chunk error:", err);
    res.status(500).json({ message: "Gagal memuat data WO", error: err.message });
  }
});

// ==========================================================
// ✏️ AUTO-SAVE WORK ORDER
// ==========================================================
app.patch("/api/workorders/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const validCols = [
    "tanggal",
    "nama_customer",
    "deskripsi",
    "ukuran",
    "qty",
    "harga",
    "di_produksi",
    "di_warna",
    "siap_kirim",
    "di_kirim",
  ];

  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, val] of Object.entries(updates)) {
    if (validCols.includes(key)) {
      setClauses.push(`"${key}" = $${i}`);
      values.push(val);
      i++;
    }
  }

  if (!setClauses.length)
    return res.status(400).json({ message: "Tidak ada kolom yang valid untuk update" });

  values.push(id);
  const q = `UPDATE work_orders SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = $${i} RETURNING *`;

  try {
    const result = await pool.query(q, values);
    const updatedRow = result.rows[0];
    io.emit("wo_updated", updatedRow);
    res.json({ message: "Data berhasil disimpan", data: updatedRow });
  } catch (err) {
    console.error("Auto-save error:", err);
    res.status(500).json({ message: "Gagal update data", error: err.message });
  }
});

// ==========================================================
// 📦 SURAT JALAN
// ==========================================================
app.get("/api/suratjalan", authenticateToken, async (req, res) => {
  try {
    const data = await pool.query("SELECT * FROM surat_jalan ORDER BY id DESC");
    res.json(data.rows);
  } catch (err) {
    res.status(500).json({ message: "Gagal memuat surat jalan" });
  }
});

// ==========================================================
// 💰 KEUANGAN
// ==========================================================
app.get("/api/keuangan", authenticateToken, async (req, res) => {
  try {
    const data = await pool.query("SELECT * FROM keuangan ORDER BY tanggal DESC");
    res.json(data.rows);
  } catch (err) {
    res.status(500).json({ message: "Gagal memuat data keuangan" });
  }
});

// ==========================================================
// 👷 KARYAWAN
// ==========================================================
app.get("/api/karyawan", authenticateToken, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM karyawan ORDER BY id ASC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ message: "Gagal ambil data karyawan" });
  }
});

// ==========================================================
// 🧾 INVOICE
// ==========================================================
app.get("/api/invoice", authenticateToken, async (req, res) => {
  try {
    const data = await pool.query("SELECT * FROM invoice ORDER BY id DESC");
    res.json(data.rows);
  } catch (err) {
    res.status(500).json({ message: "Gagal memuat data invoice" });
  }
});

// ==========================================================
// 🕒 CRON OTOMATIS BUAT DATA BULANAN
// ==========================================================
cron.schedule("0 0 1 * *", async () => {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  console.log(`🕒 Cron aktif: memastikan data ${bulan}/${tahun}`);
  await ensureMonthlyRows(bulan, tahun);
});

// ==========================================================
// 📦 SOCKET.IO
// ==========================================================
io.on("connection", (socket) => {
  console.log(`🟢 Socket connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`🔴 Socket disconnected: ${socket.id}`));
});

// ==========================================================
// 🧱 FRONTEND FALLBACK
// ==========================================================
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(__dirname, "toto-frontend", "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send("Frontend not found");
});

// ==========================================================
// 🚀 START SERVER
// ==========================================================
httpServer.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`DATABASE_URL: ${DATABASE_URL ? "[connected]" : "[missing]"}`);
});
