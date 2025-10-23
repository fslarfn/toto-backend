// routes/adminUsers.js
import express from "express";
import pool from "../db.js";
import { sendWhatsApp } from "../utils/whatsapp.js"; // fungsi kirim pesan WA yang akan kita buat
const router = express.Router();

// middleware simple untuk cek role admin
async function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
}

// 1. Daftar semua user (limit/pageable simple)
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, phone_number, role, subscription_status, due_date, last_payment_date
       FROM users ORDER BY id DESC LIMIT 500`
    );
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Perpanjang semua user (mis. setelah pembayaran global diterima)
router.post("/users/extend-all", requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.body;
    await pool.query(
      `UPDATE users
       SET subscription_status = 'active',
           last_payment_date = CURRENT_DATE,
           due_date = CURRENT_DATE + ($1 || ' days')::interval
       WHERE role = 'user'`, [days]
    );
    res.json({ ok: true, message: `Semua user diperpanjang ${days} hari` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Per-user: perpanjang manual
router.post("/users/:id/extend", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { days = 30 } = req.body;
    const { rowCount } = await pool.query(
      `UPDATE users
       SET subscription_status = 'active',
           last_payment_date = CURRENT_DATE,
           due_date = CURRENT_DATE + ($1 || ' days')::interval
       WHERE id = $2`, [days, userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: "User tidak ditemukan" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 4. Tandai pembayaran sudah diterima untuk user (manual)
router.post("/users/:id/mark-paid", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { days = 30, amount } = req.body;
    const { rowCount } = await pool.query(
      `UPDATE users
       SET subscription_status = 'active',
           last_payment_date = CURRENT_DATE,
           due_date = CURRENT_DATE + ($1 || ' days')::interval
       WHERE id = $2`, [days, userId]
    );
    if (rowCount === 0) return res.status(404).json({ error: "User tidak ditemukan" });
    // Optional: simpan log pembayaran di tabel payments
    if (amount) {
      await pool.query(
        `INSERT INTO payments (user_id, amount, currency, created_at)
         VALUES ($1, $2, 'IDR', now())`, [userId, amount]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 5. Kirim ulang link pembayaran via WhatsApp (per user)
router.post("/users/:id/resend-link", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { rows } = await pool.query(
      `SELECT username, phone_number, payment_link FROM users WHERE id = $1`, [userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User tidak ditemukan" });
    const u = rows[0];
    const message = `Halo ${u.username} 👋\nSilakan perpanjang langganan ERP TOTO: ${u.payment_link}`;
    await sendWhatsApp(u.phone_number, message);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
