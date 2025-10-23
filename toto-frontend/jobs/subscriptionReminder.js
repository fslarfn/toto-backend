import pool from "../db.js";
import axios from "axios";

const FONNTE_API_KEY = "YOUR_FONNTE_TOKEN"; // ganti dengan token Fonnte kamu

export const sendReminders = async () => {
  try {
    const { rows } = await pool.query(`
      SELECT username, phone_number, due_date
      FROM users
      WHERE role = 'user'
        AND subscription_status = 'active'
        AND due_date <= CURRENT_DATE + INTERVAL '3 days'
    `);

    for (const user of rows) {
      const message = `
Halo ${user.username} 👋

Langganan ERP TOTO Aluminium Manufacture Anda akan segera berakhir pada *${user.due_date.toLocaleDateString('id-ID')}*.

Silakan perpanjang melalui tautan berikut:
👉 https://lynk.id/rerelil/nk3qx34931x4/checkout

Terima kasih 🙏
CV Toto Aluminium Manufacture
      `;

      await axios.post(
        "https://api.fonnte.com/send",
        {
          target: user.phone_number,
          message: message.trim(),
        },
        {
          headers: { Authorization: FONNTE_API_KEY },
        }
      );

      console.log(`📨 Reminder terkirim ke ${user.username}`);
    }
  } catch (err) {
    console.error("❌ Error kirim reminder:", err);
  }
};
