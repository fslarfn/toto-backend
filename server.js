// ===============================================
//           1. IMPORT SEMUA LIBRARY DI SINI
// ===============================================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// ===============================================
//           2. INISIALISASI APLIKASI
// ===============================================
const app = express();
const PORT = 5000;

// ===============================================
//           3. KONFIGURASI MIDDLEWARE
// ===============================================
app.use(cors());
app.use(express.json());

// ===============================================
//           4. KONFIGURASI KONEKSI DATABASE
// ===============================================
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'toto_aluminium_db',
    password: 'faridafasya12', // Pastikan ini password Anda yang benar
    port: 5432,
});

// ===============================================
//           5. ENDPOINTS / RUTE API
// ===============================================

// --- API untuk Otentikasi Pengguna ---
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan password wajib diisi.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, 'admin']
        );
        res.status(201).json({ message: 'Registrasi berhasil!', user: newUser.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Username sudah digunakan.' });
        }
        console.error('Error saat registrasi:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan password wajib diisi.' });
    }
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Username atau password salah!' });
        }
        const user = userResult.rows[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Username atau password salah!' });
        }
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            'kunci-rahasia-super-aman-untuk-toto-app', // Anda bisa ganti ini nanti
            { expiresIn: '8h' }
        );
        res.json({
            message: 'Login berhasil!',
            user: { id: user.id, username: user.username, role: user.role },
            token: token
        });
    } catch (error) {
        console.error('Error saat login:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});


// --- API untuk Work Orders ---
app.get('/api/workorders', async (req, res) => {
    const { month, year } = req.query;
    if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res.status(400).json({ message: 'Parameter bulan dan tahun wajib diisi.' });
    }
    try {
        const workOrders = await pool.query(
            'SELECT * FROM work_orders WHERE bulan = $1 AND tahun = $2 ORDER BY tanggal DESC, id DESC',
            [month, year]
        );
        res.json(workOrders.rows);
    } catch (error) {
        console.error('Error saat mengambil work orders:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/workorders', async (req, res) => {
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

app.put('/api/workorders/:id', async (req, res) => {
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

app.delete('/api/workorders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleteOp = await pool.query('DELETE FROM work_orders WHERE id = $1', [id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ message: 'Work order tidak ditemukan.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error saat menghapus work order:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.patch('/api/workorders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { columnName, value } = req.body;
        const validColumns = ['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran', 'ekspedisi'];
        if (!validColumns.includes(columnName)) {
            return res.status(400).json({ message: 'Nama kolom tidak valid.' });
        }
        const updatedWorkOrder = await pool.query(
            `UPDATE work_orders SET ${columnName} = $1 WHERE id = $2 RETURNING *`,
            [value, id]
        );
        if (updatedWorkOrder.rows.length === 0) {
            return res.status(404).json({ message: 'Work order tidak ditemukan.' });
        }
        res.json(updatedWorkOrder.rows[0]);
    } catch (error) {
        console.error('Error saat mengupdate status:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/workorders/mark-printed', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Array of IDs wajib diisi.' });
        }
        await pool.query(
            `UPDATE work_orders SET po_status = 'PRINTED' WHERE id = ANY($1::int[])`,
            [ids]
        );
        res.json({ message: `${ids.length} item berhasil ditandai.` });
    } catch (error) {
        console.error('Error saat menandai PO:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});


// --- API untuk Stok Bahan ---
app.get('/api/stok', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stok_bahan ORDER BY kode_bahan ASC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error saat mengambil stok:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/stok', async (req, res) => {
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

app.post('/api/stok/update', async (req, res) => {
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


// --- API untuk Surat Jalan ---
app.get('/api/invoice/:inv', async (req, res) => {
    try {
        const { inv } = req.params;
        const result = await pool.query('SELECT * FROM work_orders WHERE no_inv = $1', [inv]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error saat mencari invoice:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

app.post('/api/surat-jalan', async (req, res) => {
    try {
        const { tipe, no_invoice, nama_tujuan, items, catatan } = req.body;
        const date = new Date();
        const no_sj = `SJ-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${Date.now()}`;

        const result = await pool.query(
            `INSERT INTO surat_jalan_log (tipe, no_sj, no_invoice, nama_tujuan, items, catatan)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING no_sj`,
            [tipe, no_sj, no_invoice, nama_tujuan, JSON.stringify(items), catatan]
        );
        
        if (tipe === 'VENDOR') {
            const itemIds = items.map(item => item.id);
            if (itemIds.length > 0) {
                await pool.query(
                    `UPDATE work_orders SET di_warna = true, no_sj_warna = $1 WHERE id = ANY($2::int[])`,
                    [no_sj, itemIds]
                );
            }
        }

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Error saat membuat surat jalan:', error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});


// ===============================================
//           6. MENJALANKAN SERVER
// ===============================================
app.listen(PORT, () => {
    console.log(`Server backend berjalan di http://localhost:${PORT}`);
});