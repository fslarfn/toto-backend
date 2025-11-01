// server.js — ERP TOTO (minimal, solid, realtime)
// Requirements: node >= 18, pg, express, cors, bcryptjs, jsonwebtoken, multer, socket.io
// npm i express cors pg bcryptjs jsonwebtoken multer socket.io

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const APP_ROOT = process.cwd();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const DATABASE_URL = process.env.DATABASE_URL || process.env.FALLBACK_DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-secret-in-prod";

if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL not provided. Set DATABASE_URL in environment.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  // if using railway/heroku style with self-signed certs
  ssl: DATABASE_URL.includes("railway") || DATABASE_URL.includes("heroku") ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

// small helper for queries with retries
async function safeQuery(text, params = [], retries = 2) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try {
      return await pool.query(text, params);
    } catch (e) {
      last = e;
      console.warn(`DB query failed (attempt ${i + 1}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw last;
}

// Express setup
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));

// static frontend served from /toto-frontend (if exists)
const FRONTEND_DIR = path.join(APP_ROOT, "toto-frontend");
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
}
app.use("/uploads", express.static(path.join(APP_ROOT, "uploads")));

// http + socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

// multer for uploads
const uploadDir = path.join(APP_ROOT, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: () => uploadDir,
  filename: (req, file, cb) => {
    const suffix = Date.now() + "-" + Math.floor(Math.random() * 1e6);
    cb(null, `${suffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ---------- Auth helpers ----------
function respondUnauthorized(res) {
  return res.status(401).json({ message: "Unauthorized" });
}

function authenticateToken(req, res, next) {
  try {
    const header = req.headers["authorization"];
    let token = header && header.startsWith("Bearer ") ? header.split(" ")[1] : req.headers["x-access-token"];
    if (!token) return respondUnauthorized(res);

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) {
        if (err.name === "TokenExpiredError") return res.status(401).json({ message: "EXPIRED" });
        return respondUnauthorized(res);
      }
      req.user = payload;
      next();
    });
  } catch (err) {
    console.error("authenticateToken error", err);
    return respondUnauthorized(res);
  }
}

// ---------- Simple user endpoints (login) ----------
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: "username & password required" });

    const r = await safeQuery("SELECT id, username, password_hash, role FROM users WHERE username = $1", [username]);
    if (!r || !r.rows || r.rows.length === 0) return res.status(401).json({ message: "invalid credentials" });

    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok) return res.status(401).json({ message: "invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("/api/login err", err);
    res.status(500).json({ message: "server error" });
  }
});

app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const r = await safeQuery("SELECT id, username, role, profile_picture_url FROM users WHERE id = $1", [req.user.id]);
    if (!r || r.rows.length === 0) return res.status(404).json({ message: "user not found" });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("/api/me err", err);
    res.status(500).json({ message: "server error" });
  }
});

// ---------- WORK ORDERS endpoints ----------
/**
 * POST /api/workorders
 * body: { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv }
 */
app.post("/api/workorders", authenticateToken, async (req, res) => {
  try {
    const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv } = req.body || {};
    const t = tanggal ? new Date(tanggal) : new Date();
    const bulan = t.getMonth() + 1;
    const tahun = t.getFullYear();

    const q = `
      INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
      RETURNING *;
    `;
    const vals = [t.toISOString().slice(0, 10), nama_customer || "", deskripsi || "", ukuran || null, qty || null, harga || null, no_inv || null, bulan, tahun];
    const r = await safeQuery(q, vals);
    const created = r.rows[0];
    io.emit("wo_created", created);
    res.status(201).json(created);
  } catch (err) {
    console.error("POST /api/workorders err", err);
    res.status(500).json({ message: "Gagal membuat work order", error: err.message });
  }
});

/**
 * GET /api/workorders/chunk?month=..&year=..
 * returns many rows; we will add empty rows on server to keep "sheet feeling"
 */
app.get("/api/workorders/chunk", authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: "month & year required" });

    const bulan = parseInt(month);
    const tahun = parseInt(year);

    // fetch columns needed in UI (tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, etc)
    const q = `
      SELECT id, tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv,
             COALESCE(NULLIF(qty, '')::numeric, 0) * COALESCE(NULLIF(harga, '')::numeric, 0) AS total,
             di_produksi, di_warna, siap_kirim, di_kirim, pembayaran, ekspedisi
      FROM work_orders
      WHERE EXTRACT(MONTH FROM tanggal)::int = $1 AND EXTRACT(YEAR FROM tanggal)::int = $2
      ORDER BY tanggal ASC NULLS LAST, id ASC
      LIMIT 10000;
    `;
    const r = await safeQuery(q, [bulan, tahun]);
    let rows = r.rows || [];

    // ensure we return array of length 10000 (with temp rows). Frontend can trim if desired.
    const totalRows = 10000;
    if (rows.length < totalRows) {
      const toAdd = totalRows - rows.length;
      for (let i = 0; i < toAdd; i++) {
        rows.push({
          id: `temp-${Date.now()}-${i}`,
          tanggal: "",
          nama_customer: "",
          deskripsi: "",
          ukuran: "",
          qty: "",
          harga: "",
          no_inv: "",
          total: 0,
          di_produksi: "false",
          di_warna: "false",
          siap_kirim: "false",
          di_kirim: "false",
          pembayaran: "false",
          ekspedisi: ""
        });
      }
    }

    res.json({ success: true, data: rows, total: totalRows });
  } catch (err) {
    console.error("GET /api/workorders/chunk err", err);
    res.status(500).json({ message: "Gagal memuat work orders", error: err.message });
  }
});

/**
 * PATCH /api/workorders/:id
 * Body: partial fields to update. If id looks like temp-..., client should POST instead.
 */
app.patch("/api/workorders/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "id required" });
    // don't allow patching temp rows
    if (String(id).startsWith("temp-")) return res.status(400).json({ message: "Cannot patch temporary row" });

    const updates = req.body || {};
    const allowed = ["tanggal","nama_customer","deskripsi","ukuran","qty","harga","no_inv","di_produksi","di_warna","siap_kirim","di_kirim","pembayaran","ekspedisi"];
    const sets = [];
    const vals = [];
    let idx = 1;
    for (const [k,v] of Object.entries(updates)) {
      if (!allowed.includes(k)) continue;
      sets.push(`"${k}" = $${idx}`);
      vals.push(v);
      idx++;
    }
    if (sets.length === 0) return res.status(400).json({ message: "No valid fields to update" });
    vals.push(id);
    const q = `UPDATE work_orders SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
    const r = await safeQuery(q, vals);
    if (!r || !r.rows || r.rows.length === 0) return res.status(404).json({ message: "Work order not found" });
    const updated = r.rows[0];
    io.emit("wo_updated", updated);
    res.json({ message: "Updated", data: updated });
  } catch (err) {
    console.error("PATCH /api/workorders/:id err", err);
    res.status(500).json({ message: "Gagal update", error: err.message });
  }
});

/**
 * DELETE /api/workorders/:id
 */
app.delete("/api/workorders/:id", authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const r = await safeQuery("DELETE FROM work_orders WHERE id = $1 RETURNING *", [id]);
    if (!r || r.rowCount === 0) return res.status(404).json({ message: "Not found" });
    io.emit("wo_deleted", { id });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/workorders/:id err", err);
    res.status(500).json({ message: "Gagal hapus", error: err.message });
  }
});

/**
 * Mark printed / buat PO for some ids
 * POST /api/workorders/mark-printed  body: { ids: [1,2,3] }
 */
app.post("/api/workorders/mark-printed", authenticateToken, async (req, res) => {
  try {
    let { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids required" });
    ids = ids.map(i => parseInt(i)).filter(n => !isNaN(n));
    if (ids.length === 0) return res.status(400).json({ message: "no valid ids" });

    const q = `UPDATE work_orders SET siap_kirim = 'true', updated_at = NOW() WHERE id = ANY($1::int[]) RETURNING *`;
    const r = await safeQuery(q, [ids]);
    for (const row of r.rows) io.emit("wo_updated", row);
    res.json({ message: `Marked ${r.rowCount} rows`, updated: r.rows });
  } catch (err) {
    console.error("/api/workorders/mark-printed err", err);
    res.status(500).json({ message: "Gagal mark printed", error: err.message });
  }
});

// ---------- STATUS BARANG endpoint (uses work_orders) ----------
/**
 * GET /api/status-barang?month=..&year=..&customer=...
 * returns list of work_orders with status-related columns and editable fields (no_inv, ekspedisi, tanggal)
 */
app.get("/api/status-barang", authenticateToken, async (req, res) => {
  try {
    const { month, year, customer } = req.query;
    if (!month || !year) return res.status(400).json({ message: "month & year required" });

    const params = [parseInt(month), parseInt(year)];
    let where = `WHERE EXTRACT(MONTH FROM tanggal)::int = $1 AND EXTRACT(YEAR FROM tanggal)::int = $2`;

    if (customer && customer.trim() !== "") {
      params.push(`%${customer.trim()}%`);
      where += ` AND nama_customer ILIKE $${params.length}`;
    }

    const q = `
      SELECT id, tanggal, no_inv, nama_customer, deskripsi, ukuran, qty, harga,
             COALESCE(NULLIF(qty, '')::numeric,0) * COALESCE(NULLIF(harga, '')::numeric,0) AS total,
             di_produksi, di_warna, siap_kirim, di_kirim, pembayaran, ekspedisi
      FROM work_orders
      ${where}
      ORDER BY tanggal ASC NULLS LAST, id ASC
      LIMIT 5000;
    `;
    const r = await safeQuery(q, params);
    res.json(r.rows || []);
  } catch (err) {
    console.error("GET /api/status-barang err", err);
    res.status(500).json({ message: "Gagal memuat status barang", error: err.message });
  }
});

/**
 * PATCH /api/status-barang/:id
 * same as workorders patch, included for semantics
 */
app.patch("/api/status-barang/:id", authenticateToken, async (req, res) => {
  // delegate to workorders patch logic
  return app._router.handle(req, res, () => {}, "/api/workorders/:id", "PATCH");
});

// ---------- SURAT JALAN ----------
/**
 * POST /api/surat-jalan
 * body: { tipe, no_invoice, nama_tujuan, items: [{id,qty}], catatan }
 * will insert a row to surat_jalan_log and optionally update related work_orders flags
 */
app.post("/api/surat-jalan", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { tipe, no_invoice, nama_tujuan, items, catatan } = req.body || {};
    if (!tipe || !items || !Array.isArray(items)) return res.status(400).json({ message: "tipe & items required" });

    const now = new Date();
    const no_sj = `${tipe === "VENDOR" ? "SJW" : "SJC"}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}-${Date.now()}`;

    const insertQ = `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`;
    const r = await client.query(insertQ, [tipe, no_sj, no_invoice || null, nama_tujuan || null, JSON.stringify(items), catatan || null]);

    // if items reference work_orders, update their di_produksi/di_warna flags (example)
    const itemIds = items.map(i => parseInt(i.id)).filter(n => !isNaN(n));
    if (itemIds.length) {
      // sample: mark di_warna true for these ids
      await client.query(`UPDATE work_orders SET di_warna = 'true', updated_at = NOW() WHERE id = ANY($1::int[])`, [itemIds]);
      const updated = await client.query(`SELECT * FROM work_orders WHERE id = ANY($1::int[])`, [itemIds]);
      // broadcast updates
      for (const row of updated.rows) io.emit("wo_updated", row);
    }

    await client.query("COMMIT");
    res.status(201).json(r.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error("POST /api/surat-jalan err", err);
    res.status(500).json({ message: "Gagal membuat surat jalan", error: err.message });
  } finally {
    client.release();
  }
});

// ---------- Simple health / fallback ----------
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Fallback to serve frontend index.html if present
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(FRONTEND_DIR, "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send("Frontend not found");
});

// ---------- Socket.IO realtime ----------
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // forward client edits to other clients (server also emits when DB changed)
  socket.on("wo_created", (data) => socket.broadcast.emit("wo_created", data));
  socket.on("wo_updated", (data) => socket.broadcast.emit("wo_updated", data));
  socket.on("wo_deleted", (data) => socket.broadcast.emit("wo_deleted", data));
  socket.on("status_updated", (data) => socket.broadcast.emit("status_updated", data));
  socket.on("disconnect", (reason) => console.log("Socket disconnected:", socket.id, reason));
});

// graceful shutdown
process.on("SIGINT", async () => {
  console.log("SIGINT received. Shutting down...");
  try { await pool.end(); } catch(e) {}
  process.exit(0);
});

// start server (single listen)
httpServer.listen(PORT, () => {
  console.log(`🚀 ERP TOTO server listening on ${PORT}`);
});
