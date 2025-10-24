// ===============================================
//           1. IMPORT SEMUA LIBRARY
// ===============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// ===============================================
//           2. INISIALISASI APLIKASI
// ===============================================
const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'kunci-rahasia-super-aman-untuk-toto-app';

// ===============================================
//           3. KONFIGURASI MIDDLEWARE
// ===============================================
const allowedOrigins = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://erptoto.up.railway.app',
  'https://toto-frontend.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`🚫 CORS Blocked Origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================================
//           4. KONFIGURASI DATABASE
// ===============================================
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:KiSLCzRPLsZzMivAVAVjzpEOBVTkCEHe@shinkansen.proxy.rlwy.net:25803/railway',
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.connect()
  .then(() => console.log('🟢 Koneksi PostgreSQL Railway berhasil'))
  .catch((err) => console.error('🔴 Gagal konek DB:', err.message));

// ===============================================
//           5. KONFIGURASI UPLOAD FILE
// ===============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const userId = req.user ? req.user.id : 'guest';
    cb(null, `${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ===============================================
//           6. AUTENTIKASI JWT
// ===============================================
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && req.headers['x-access-token']) token = req.headers['x-access-token'];

    if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: 'Token tidak valid atau sesi berakhir.' });
      req.user = user;
      next();
    });
  } catch (err) {
    console.error('JWT Verify Error:', err);
    res.status(500).json({ message: 'Kesalahan autentikasi server.' });
  }
}

// ===============================================
//           7. HELPER FUNGSI
// ===============================================
function jsonDeleteResponse(result, entityName = 'Data') {
  if (result.rowCount === 0) {
    return { status: 404, json: { message: `${entityName} tidak ditemukan.` } };
  }
  return { status: 200, json: { message: `${entityName} berhasil dihapus.` } };
}

// ===============================================
//           8. ENDPOINTS / ROUTES
// ===============================================

// ======================
// 🔹 REGISTER
// ======================
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username dan password wajib diisi.' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashedPassword, 'admin']
    );
    res.status(201).json({ message: 'Registrasi berhasil!', user: newUser.rows[0] });
  } catch (error) {
    if (error.code === '23505')
      return res.status(409).json({ message: 'Username sudah digunakan.' });
    console.error('Error saat registrasi:', error);
    res.status(500).json({ message: 'Kesalahan server.' });
  }
});

// ======================
// 🔹 LOGIN
// ======================
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username dan password wajib diisi.' });

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0)
      return res.status(401).json({ message: 'Username atau password salah!' });

    const user = userResult.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch)
      return res.status(401).json({ message: 'Username atau password salah!' });

    if (user.role !== 'admin' && user.subscription_status === 'inactive') {
      return res.status(403).json({
        message:
          'Langganan Anda nonaktif. Hubungi admin untuk memperpanjang langganan.',
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(200).json({
      message: 'Login berhasil!',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subscription_status: user.subscription_status,
      },
    });
  } catch (error) {
    console.error('Error saat login:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// ======================
// 🔹 USER PROFILE
// ======================
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, profile_picture_url FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Kesalahan server.' });
  }
});

// ======================
// 🔹 UPDATE PROFIL
// ======================
app.put('/api/user/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    const { username } = req.body;
    let profilePictureUrl = null;
    if (req.file) profilePictureUrl = `/uploads/${req.file.filename}`;

    let query, params;
    if (profilePictureUrl) {
      query = 'UPDATE users SET username=$1, profile_picture_url=$2 WHERE id=$3 RETURNING id, username, profile_picture_url';
      params = [username, profilePictureUrl, req.user.id];
    } else {
      query = 'UPDATE users SET username=$1 WHERE id=$2 RETURNING id, username, profile_picture_url';
      params = [username, req.user.id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Gagal mengupdate profil.' });
  }
});

// ======================
// 🔹 GANTI PASSWORD
// ======================
app.put('/api/user/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0)
      return res.status(404).json({ message: 'User tidak ditemukan.' });

    const isMatch = await bcrypt.compare(oldPassword, userResult.rows[0].password_hash);
    if (!isMatch)
      return res.status(400).json({ message: 'Password lama salah.' });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, req.user.id]);
    res.json({ message: 'Password berhasil diubah.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Gagal mengubah password.' });
  }
});

// ======================
// 🔹 KARYAWAN CRUD
// ======================
app.get('/api/karyawan', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM karyawan ORDER BY nama_karyawan ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data karyawan.' });
  }
});

app.post('/api/karyawan', authenticateToken, async (req, res) => {
  try {
    const { nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon } = req.body;
    const result = await pool.query(
      `INSERT INTO karyawan (nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nama_karyawan, gaji_harian, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, kasbon]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambahkan karyawan.' });
  }
});

app.delete('/api/karyawan/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM karyawan WHERE id=$1', [id]);
    const response = jsonDeleteResponse(result, 'Karyawan');
    res.status(response.status).json(response.json);
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus karyawan.' });
  }
});


app.post('/api/payroll', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            karyawan_id, periode_gaji, hari_kerja, hari_lembur, gaji_pokok,
            total_lembur, total_gaji_kotor, potongan_bpjs_kesehatan,
            potongan_bpjs_ketenagakerjaan, potongan_kasbon, total_potongan, gaji_bersih
        } = req.body;

        // 1. Simpan data payroll ke tabel payroll
        await client.query(
            `INSERT INTO payroll (karyawan_id, periode_gaji, hari_kerja, hari_lembur, gaji_pokok, total_lembur, total_gaji_kotor, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, potongan_kasbon, total_potongan, gaji_bersih)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [karyawan_id, periode_gaji, hari_kerja, hari_lembur, gaji_pokok, total_lembur, total_gaji_kotor, potongan_bpjs_kesehatan, potongan_bpjs_ketenagakerjaan, potongan_kasbon, total_potongan, gaji_bersih]
        );

        // 2. Jika ada potongan kasbon, kurangi dari saldo kasbon di tabel karyawan
        if (potongan_kasbon > 0) {
            // [FIX] Mengganti 'workers' menjadi 'karyawan'
            await client.query(
                'UPDATE karyawan SET kasbon = kasbon - $1 WHERE id = $2', 
                [potongan_kasbon, karyawan_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Payroll berhasil diproses dan disimpan.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing payroll:', error);
        res.status(500).json({ message: error.message || 'Gagal memproses payroll.' });
    } finally {
        client.release();
    }
});

// --- API untuk Work Orders (Dilindungi Token) ---

// --- [MODIFIKASI] Rute /api/workorders yang LAMA (sebelumnya di baris ~245) DIHAPUS ---
/*
app.get('/api/workorders', authenticateToken, async (req, res) => {
    // ... KODE LAMA YANG SALAH DIHAPUS ...
});
*/
// --- [AKHIR PENGHAPUSAN] ---


// --- [MODIFIKASI] Ini adalah satu-satunya rute GET /api/workorders yang benar ---
app.get('/api/workorders', authenticateToken, async (req, res) => {
    // Ambil 'status' dari query parameters
    const { month, year, customer, status } = req.query;
    if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res.status(400).json({ message: 'Parameter bulan dan tahun wajib diisi.' });
    }
    try {
        // Pilih semua kolom agar bisa dipakai di halaman 'status-barang' juga
        let queryText = 'SELECT * FROM work_orders WHERE bulan = $1 AND tahun = $2';
        const queryParams = [month, year];
        let paramIndex = 3; // Indeks parameter berikutnya

        if (customer) {
            queryParams.push(`%${customer}%`);
            queryText += ` AND nama_customer ILIKE $${paramIndex++}`;
        }

        // --- [PERBAIKAN LOGIKA] Filter Status berdasarkan Tipe Data VARCHAR ('true'/'false'/NULL) ---
        if (status) {
            console.log(`Filtering by status: ${status}`); // Logging
            switch (status) {
                case 'belum_produksi':
                    // [FIX] Logika yang benar: (di_produksi = 'false' ATAU di_produksi IS NULL)
                    // Ini akan mencakup item baru (NULL) dan yang ditandai 'false'
                    queryText += ` AND (di_produksi = 'false' OR di_produksi IS NULL)`;
                    break;
                case 'sudah_produksi':
                    // [FIX] Logika yang benar: di_produksi HARUS 'true', tapi yang lain 'false' atau NULL
                    queryText += ` AND di_produksi = 'true' AND (di_warna = 'false' OR di_warna IS NULL) AND (siap_kirim = 'false' OR siap_kirim IS NULL) AND (di_kirim = 'false' OR di_kirim IS NULL)`;
                    break;
                case 'di_warna':
                    // [FIX] Logika yang benar: di_warna HARUS 'true', tapi yang lain 'false' atau NULL
                    queryText += ` AND di_warna = 'true' AND (siap_kirim = 'false' OR siap_kirim IS NULL) AND (di_kirim = 'false' OR di_kirim IS NULL)`;
                    break;
                case 'siap_kirim':
                    // [FIX] Logika yang benar: siap_kirim HARUS 'true', tapi di_kirim 'false' atau NULL
                    queryText += ` AND siap_kirim = 'true' AND (di_kirim = 'false' OR di_kirim IS NULL)`;
                    break;
                case 'di_kirim':
                    // [FIX] Logika yang benar: di_kirim HARUS 'true'
                    queryText += ` AND di_kirim = 'true'`;
                    break;
            }
        }
        // --- [AKHIR PERBAIKAN LOGIKA] ---

        queryText += ' ORDER BY tanggal DESC, id DESC';

        const workOrders = await pool.query(queryText, queryParams);
        res.json(workOrders.rows);
    } catch (error) {
        console.error(`Error saat mengambil work orders (status: ${status}):`, error); // Tambah logging
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});
// --- [AKHIR MODIFIKASI] API Work Orders ---


app.post('/api/workorders', authenticateToken, async (req, res) => {
    try {
        const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv } = req.body;
        if (!tanggal || !nama_customer) {
            return res.status(400).json({ message: 'Tanggal dan Nama Customer wajib diisi.' });
        }
        const date = new Date(tanggal);
        const bulan = date.getMonth() + 1;
        const tahun = date.getFullYear();
        const newWorkOrder = await pool.query(
            `INSERT INTO work_orders (tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun]
        );
        res.status(201).json(newWorkOrder.rows[0]);
    } catch (error) {
        console.error('Error saat menambahkan work order:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.put('/api/workorders/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv } = req.body;
        const date = new Date(tanggal);
        const bulan = date.getMonth() + 1;
        const tahun = date.getFullYear();
        const updatedWorkOrder = await pool.query(
            `UPDATE work_orders SET tanggal = $1, nama_customer = $2, deskripsi = $3, ukuran = $4, qty = $5, harga = $6, no_inv = $7, bulan = $8, tahun = $9
             WHERE id = $10 RETURNING *`,
            [tanggal, nama_customer, deskripsi, ukuran, qty, harga, no_inv, bulan, tahun, id]
        );
        if (updatedWorkOrder.rows.length === 0) {
            return res.status(404).json({ message: 'Work order tidak ditemukan.' });
        }
        res.json(updatedWorkOrder.rows[0]);
    } catch (error) {
        console.error('Error saat mengupdate work order:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.delete('/api/workorders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM work_orders WHERE id = $1', [id]);
    const response = jsonDeleteResponse(result, 'Work order');
    res.status(response.status).json(response.json);
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus work order.' });
  }
});


// --- [PERBAIKAN] Menggunakan Tipe Data String 'true'/'false' ---
app.patch('/api/workorders/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        let { columnName, value } = req.body; // Biarkan 'let'

        const validColumns = ['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran', 'ekspedisi'];
        if (!validColumns.includes(columnName)) {
            return res.status(400).json({ message: 'Nama kolom tidak valid.' });
        }
        
        // [FIX] Konversi nilai ke tipe yang benar (string 'true'/'false') untuk database Anda
        if (['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran'].includes(columnName)) {
            value = (value === true || value === 'true') ? 'true' : 'false'; 
        }

        const updatedWorkOrder = await pool.query(
            `UPDATE work_orders SET "${columnName}" = $1 WHERE id = $2 RETURNING *`,
            [value, id]
        );
        
        if (updatedWorkOrder.rows.length === 0) {
            return res.status(404).json({ message: 'Work order tidak ditemukan.' });
        }
        
        console.log(`Status '${columnName}' untuk ID ${id} diperbarui menjadi:`, value);
        res.json(updatedWorkOrder.rows[0]);

    } catch (error) {
        console.error('Error saat mengupdate status:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});
// --- [AKHIR PERBAIKAN] ---

// --- [PERBAIKAN] Menggunakan Tipe Data String 'true' ---
app.post('/api/workorders/mark-printed', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Mulai transaksi

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Array of IDs wajib diisi.' });
        }

        console.log(`Marking PO Printed & Di Produksi for IDs: ${ids.join(', ')}`); // Logging

        // [FIX] Update di_produksi menjadi STRING 'true'
        const updateResult = await client.query( // Gunakan client
            `UPDATE work_orders
             SET po_status = 'PRINTED',
                 di_produksi = 'true'
             WHERE id = ANY($1::int[])`,
            [ids]
        );

        console.log(`Updated ${updateResult.rowCount} rows.`); // Logging hasil

        await client.query('COMMIT'); // Selesaikan transaksi
        res.json({ message: `${updateResult.rowCount} item berhasil ditandai sebagai 'Printed' dan 'Di Produksi'.` });

    } catch (error) {
        await client.query('ROLLBACK'); // Batalkan jika error
        console.error('Error saat menandai PO Printed & Di Produksi:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server saat menandai status.' });
    } finally {
         client.release(); // Selalu lepaskan client
    }
});
// --- [AKHIR PERBAIKAN] ---


// --- API untuk Stok Bahan (Dilindungi Token) ---
app.get('/api/stok', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stok_bahan ORDER BY kode_bahan ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error saat mengambil stok:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/stok', authenticateToken, async (req, res) => {
    try {
        const { kode, nama, satuan, kategori, stok, lokasi } = req.body;
        const result = await pool.query(
            'INSERT INTO stok_bahan (kode_bahan, nama_bahan, satuan, kategori, stok, lokasi) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [kode.toUpperCase(), nama, satuan, kategori, stok, lokasi]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Kode bahan sudah ada.' });
        }
        console.error('Error saat menambah bahan:', error);
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
            'INSERT INTO riwayat_stok (bahan_id, nama_bahan, tipe, jumlah, stok_sebelum, stok_sesudah, keterangan) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [bahan_id, bahan.nama_bahan, tipe, jumlahUpdate, stokSebelum, stokSesudah, keterangan]
        );

        await client.query('COMMIT');
        res.json({ message: 'Stok berhasil diperbarui.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saat update stok:', error);
        res.status(500).json({ message: error.message || 'Terjadi kesalahan pada server.' });
    } finally {
        client.release();
    }
});


// --- API untuk Surat Jalan & Invoice (Dilindungi Token) ---
app.get('/api/invoice/:inv', authenticateToken, async (req, res) => {
    try {
        const { inv } = req.params;
        const result = await pool.query('SELECT * FROM work_orders WHERE no_inv = $1', [inv]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error saat mencari invoice:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// DIPERBARUI: Menggunakan kolom 'bulan' dan 'tahun' agar konsisten
app.get('/api/invoices/summary', authenticateToken, async (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) {
        return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    }
    try {
        // [FIX] Membandingkan dengan STRING 'true'
        const query = `
            SELECT
                COALESCE(SUM(ukuran::numeric * qty::numeric * harga::numeric), 0) AS total,
                COALESCE(SUM(CASE WHEN pembayaran = 'true' THEN ukuran::numeric * qty::numeric * harga::numeric ELSE 0 END), 0) AS paid
            FROM work_orders
            WHERE bulan = $1 AND tahun = $2 AND no_inv IS NOT NULL AND no_inv != ''
        `;
        const result = await pool.query(query, [month, year]);
        const summary = result.rows[0];
        const totalValue = parseFloat(summary.total);
        const paidValue = parseFloat(summary.paid);
        res.json({ total: totalValue, paid: paidValue, unpaid: totalValue - paidValue });
    } catch (error) {
        console.error('Error fetching invoice summary:', error);
        res.status(500).json({ message: 'Gagal mengambil ringkasan invoice.' });
    }
});

// --- [MODIFIKASI] API Surat Jalan (Dibungkus Transaksi) ---
app.post('/api/surat-jalan', authenticateToken, async (req, res) => {
    // --- TAMBAHAN: Gunakan Transaksi ---
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Mulai transaksi

        const { tipe, no_invoice, nama_tujuan, items, catatan } = req.body;
        const date = new Date();
        // [MODIFIKASI] No SJ lebih spesifik
        const no_sj_prefix = tipe === 'VENDOR' ? 'SJW' : 'SJC';
        const no_sj = `${no_sj_prefix}-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${Date.now()}`;

        const result = await client.query( // Gunakan client
            `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING no_sj`,
            [tipe, no_sj, no_invoice, nama_tujuan, JSON.stringify(items), catatan]
        );
        
        if (tipe === 'VENDOR') {
            const itemIds = items.map(item => item.id);
            if (itemIds.length > 0) {
              console.log(`Updating di_warna status for SJ ${no_sj}, item IDs: ${itemIds.join(', ')}`); // Logging
                // [FIX] Update di_warna menjadi STRING 'true'
                const updateResult = await client.query( // Gunakan client
                    `UPDATE work_orders SET di_warna = 'true', no_sj_warna = $1 WHERE id = ANY($2::int[])`,
                    [no_sj, itemIds]
                );
              console.log(`Updated ${updateResult.rowCount} rows for di_warna.`); // Logging
            }
        }

        await client.query('COMMIT'); // Selesaikan transaksi
        res.status(201).json(result.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK'); // Batalkan jika error
        console.error('Error saat membuat surat jalan:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    } finally {
        client.release(); // Selalu lepaskan client
    }
});
// --- [AKHIR MODIFIKASI] API Surat Jalan ---

// --- API UNTUK KEUANGAN (DITAMBAHKAN) ---
app.get('/api/keuangan/saldo', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM kas ORDER BY id ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error saat mengambil saldo kas:', error);
        res.status(500).json({ message: 'Gagal mengambil data saldo.' });
    }
});

app.post('/api/keuangan/transaksi', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { tanggal, jumlah, tipe, kas_id, keterangan } = req.body;
        const jumlahNumeric = parseFloat(jumlah);

        const kasResult = await client.query('SELECT * FROM kas WHERE id = $1 FOR UPDATE', [kas_id]);
        if (kasResult.rows.length === 0) {
            throw new Error('Kas tidak ditemukan.');
        }

        const kas = kasResult.rows[0];
        const saldoSebelum = parseFloat(kas.saldo);
        let saldoSesudah;

        if (tipe === 'PEMASUKAN') {
            saldoSesudah = saldoSebelum + jumlahNumeric;
        } else if (tipe === 'PENGELUARAN') {
            saldoSesudah = saldoSebelum - jumlahNumeric;
        } else {
            throw new Error('Tipe transaksi tidak valid.');
        }

        await client.query('UPDATE kas SET saldo = $1 WHERE id = $2', [saldoSesudah, kas_id]);
        
        await client.query(
            `INSERT INTO transaksi_keuangan (tanggal, jumlah, tipe, kas_id, keterangan, saldo_sebelum, saldo_sesudah)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [tanggal, jumlahNumeric, tipe, kas_id, keterangan, saldoSebelum, saldoSesudah]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: 'Transaksi berhasil disimpan.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saat menyimpan transaksi:', error);
        res.status(500).json({ message: error.message || 'Terjadi kesalahan pada server.' });
    } finally {
        client.release();
    }
});

app.get('/api/keuangan/riwayat', authenticateToken, async (req, res) => {
    const { month, year } = req.query;
    if (!month || !year) {
        return res.status(400).json({ message: 'Bulan dan tahun diperlukan.' });
    }
    try {
        const query = `
            SELECT
                tk.id,
                tk.tanggal,
                tk.jumlah,
                tk.tipe,
                tk.keterangan,
                tk.saldo_sebelum,
                tk.saldo_sesudah,
                k.nama_kas
            FROM transaksi_keuangan tk
            JOIN kas k ON tk.kas_id = k.id
            WHERE EXTRACT(MONTH FROM tk.tanggal) = $1 AND EXTRACT(YEAR FROM tk.tanggal) = $2
            ORDER BY tk.tanggal DESC, tk.id DESC
        `;
        const result = await pool.query(query, [month, year]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching financial history:', error);
        res.status(500).json({ message: 'Gagal mengambil riwayat keuangan.' });
    }
});




// ===============================================
//           9. FRONTEND STATIC FILE
// ===============================================
app.use(express.static(path.join(__dirname, 'toto-frontend')));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'toto-frontend', 'index.html'));
});

// ===============================================
//           10. SERVER LISTENER
// ===============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
  console.log(`🌍 Base URL: ${process.env.RAILWAY_STATIC_URL || 'http://localhost:' + PORT}`);
});

// ===============================================
//           11. GLOBAL ERROR HANDLER
// ===============================================

app.use((err, req, res, next) => {
  console.error('🔥 GLOBAL ERROR HANDLER:', err.stack);

  // Kalau error dari CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Akses dari domain ini tidak diizinkan (CORS).' });
  }

  // Error umum
  res.status(500).json({
    message: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Tangkap promise rejection global (agar Railway tidak restart)
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Promise Rejection:', reason);
});

// Tangkap error tak terduga di runtime
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});




// ============================================================
// ✅ API: Ambil semua user untuk halaman admin-subscription
// ============================================================
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        // Pastikan hanya admin (Faisal) yang boleh ambil semua data user
        if (req.user.username.toLowerCase() !== 'faisal') {
            return res.status(403).json({ message: 'Akses ditolak. Hanya admin (Faisal) yang dapat melihat data user.' });
        }

        const result = await pool.query(`
            SELECT 
                id, 
                username AS name,
                phone_number,
                role,
                COALESCE(subscription_status, 'inactive') AS subscription_status
            FROM users
            ORDER BY id ASC
        `);

        res.json(result.rows);
    } catch (err) {
        console.error('Error mengambil data users:', err);
        res.status(500).json({ error: 'Gagal memuat data user.' });
    }
});

// ============================================================
// ✅ API: Aktifkan / Nonaktifkan langganan user (khusus Faisal)
// ============================================================
app.post('/api/admin/users/:id/activate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // 🔒 Hanya Faisal yang boleh melakukan ini
        if (!req.user || req.user.username.toLowerCase() !== 'faisal') {
            return res.status(403).json({ message: 'Akses ditolak. Hanya Faisal yang dapat mengubah status langganan.' });
        }

        // Validasi status
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ message: 'Status tidak valid. Gunakan "active" atau "inactive".' });
        }

        // Update status di database
        const result = await pool.query(
            `UPDATE users 
             SET subscription_status = $1 
             WHERE id = $2 
             RETURNING id, username, subscription_status`,
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
        console.error('Error mengubah status langganan:', err);
        res.status(500).json({ message: 'Gagal mengubah status langganan user.' });
    }
});
