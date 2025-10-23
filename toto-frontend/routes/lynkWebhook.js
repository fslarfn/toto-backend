import express from "express";
import pool from "../db.js"; // koneksi PostgreSQL kamu
const router = express.Router();

// Webhook dari Lynk.id (pastikan URL-nya sama di dashboard Lynk.id)
router.post("/webhook/lynk", async (req, res) => {
  try {
    const { status, amount } = req.body;

    // Jika pembayaran sukses dan jumlah >= 11.750.000
    if (status === "PAID" && amount >= 11750000) {
      await pool.query(`
        UPDATE users
        SET subscription_status = 'active',
            last_payment_date = CURRENT_DATE,
            due_date = CURRENT_DATE + INTERVAL '30 days'
        WHERE role = 'user'
      `);

      console.log("✅ Semua user diaktifkan kembali selama 30 hari ke depan.");
    }

    res.status(200).json({ message: "Webhook diterima" });
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
