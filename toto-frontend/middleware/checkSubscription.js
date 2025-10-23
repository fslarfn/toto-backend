// middleware/checkSubscription.js
export default function requireActiveSubscription(req, res, next) {
  // Asumsi: req.user diisi oleh middleware auth sebelumnya (user id, role, username)
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  // Admin selalu boleh lewat
  if (user.role === "admin") return next();

  // Jika user bukan admin: cek subscription_status
  if (user.subscription_status && user.subscription_status !== "active") {
    return res.status(403).json({
      error: "Langganan Anda tidak aktif. Silakan perpanjang untuk mengakses fitur ini."
    });
  }

  // Kalau kolom subscription_status belum terisi treat as expired
  if (!user.subscription_status) {
    return res.status(403).json({
      error: "Status langganan tidak terdeteksi. Hubungi administrator."
    });
  }

  next();
}
