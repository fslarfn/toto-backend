import pool from "../db.js";

export const expireSubscriptions = async () => {
  try {
    const result = await pool.query(`
      UPDATE users
      SET subscription_status = 'expired'
      WHERE role = 'user'
        AND subscription_status = 'active'
        AND due_date < CURRENT_DATE
      RETURNING username
    `);

    if (result.rowCount > 0) {
      console.log(`⚠️ ${result.rowCount} user langganan berakhir hari ini.`);
    }
  } catch (err) {
    console.error("❌ Error expire subscription:", err);
  }
};
