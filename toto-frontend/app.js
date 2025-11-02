// ==========================================================
// 🚀 APP.JS (VERSI FINAL LENGKAP - TABULATOR + REALTIME SYNC)
// ==========================================================

const App = {
  state: {
    socket: null, // Koneksi Socket.IO global
  },
  elements: {},
  pages: {
    'dashboard': {},
    'data-karyawan': {},
    'payroll': {},
    'work-orders': {},
    'status-barang': {},
    'print-po': {},
    'stok-bahan': {},
    'surat-jalan': {},
    'invoice': {},
    'quotation': {},
    'keuangan': {},
    'profil': {},
    'admin-subscription': {}
  },
};

// ==========================================================
// 🔑 TOKEN HANDLER (Global)
// ==========================================================
App.getToken = function() {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Date.now() / 1000;
    if (payload.exp && payload.exp < now) {
      console.warn("⏰ Token expired — user perlu login ulang.");
      App.clearToken();
      return null;
    }
    return token;
  } catch (e) {
    console.error("⚠️ Gagal membaca token JWT:", e);
    App.clearToken();
    return null;
  }
};
App.setToken = (token) => localStorage.setItem("authToken", token);
App.clearToken = () => localStorage.removeItem("authToken");

// ==========================================================
// 📡 SOCKET.IO (Global Connection)
// ==========================================================
App.socketInit = () => {
  try {
    const socketUrl =
      window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : "https://erptoto.up.railway.app";
    
    if (typeof io === 'undefined') {
      console.error('❌ Socket.IO client library (socket.io.min.js) tidak ditemukan. Pastikan sudah dimuat di HTML.');
      return;
    }

    const socket = io(socketUrl, { transports: ["websocket", "polling"] });

    socket.on("connect", () => console.log("✅ Socket.IO connected:", socket.id));
    socket.on("disconnect", () => console.warn("⚠️ Socket.IO disconnected"));
    socket.on("connect_error", (err) => console.error("❌ Socket.IO error:", err.message));

    App.state.socket = socket;
  } catch (err) {
    console.error("❌ Socket init gagal:", err);
  }
};

// ==========================================================
// 🚀 APP.API — (FINAL - Menggunakan authToken & endpoint yg benar)
// ==========================================================
App.api = {
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://erptoto.up.railway.app",

  // ------------------------------
  // FUNGSI DASAR REQUEST (DENGAN AUTO REFRESH TOKEN)
  // ------------------------------
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}${
          endpoint.startsWith("/api")
            ? endpoint
            : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
        }`;

    let token = App.getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const opts = {
      method: options.method || "GET",
      headers: { ...headers, ...(options.headers || {}) },
    };

    // body handling
    if (options.body instanceof FormData) {
      delete opts.headers["Content-Type"];
      opts.body = options.body;
    } else if (options.body) {
      opts.body =
        typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }

    try {
      let res = await fetch(url, opts);

      // 🔁 Auto-refresh token jika expired
      if (res.status === 401 || res.status === 403) {
        console.warn("⚠️ Token expired atau invalid, mencoba refresh...");
        const refresh = await fetch(`${this.baseUrl}/api/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: App.getToken() }), // Kirim token saat ini
        });

        if (!refresh.ok) {
           alert("Sesi login kamu sudah habis. Silakan login ulang.");
           App.clearToken();
           window.location.href = "index.html";
           return Promise.reject(new Error("Sesi habis"));
        }
        const data = await refresh.json();
        if (!data.token) throw new Error("Token refresh tidak valid");

        App.setToken(data.token); // Simpan token baru
        opts.headers["Authorization"] = `Bearer ${data.token}`;
        res = await fetch(url, opts); // Ulangi request
      }

      if (res.status === 204) return { message: "Operasi berhasil" };
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || res.statusText);
      }

      return await res.json();
    } catch (err) {
      console.error("❌ Fetch gagal:", err.message, "→", url);
      throw err;
    }
  },

  // ======================================================
  // 🔐 AUTH
  // ======================================================
  checkLogin(username, password) {
    return this.request("/login", { method: "POST", body: { username, password } });
  },
  getCurrentUser() {
    return this.request("/me");
  },
  updateUserProfile(formData) {
    return this.request("/user/profile", { method: "PUT", body: formData });
  },
  changePassword(data) {
    return this.request("/user/change-password", { method: "PUT", body: data });
  },

  // ======================================================
  // 🧾 WORK ORDERS
  // ======================================================
  getWorkOrders(month, year, customer = "", status = "") {
    let endpoint = `/workorders?month=${month}&year=${year}`;
    if (customer) endpoint += `&customer=${encodeURIComponent(customer)}`;
    if (status) endpoint += `&status=${encodeURIComponent(status)}`;
    return this.request(endpoint);
  },

  getWorkOrdersChunk(month, year, page = 1, size = 500) {
    return this.request(
      `/workorders/chunk?month=${month}&year=${year}&page=${page}&size=${size}`
    );
  },

  addWorkOrder(data) {
    const normalized = {
      tanggal: (() => {
        const raw = data.tanggal || new Date();
        if (typeof raw === "string" && raw.includes("/")) {
          const [d, m, y] = raw.split("/");
          return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
        if (typeof raw === "string" && raw.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return raw;
        }
        return new Date(raw).toISOString().slice(0, 10);
      })(),
      nama_customer: data.nama_customer || "Tanpa Nama",
      deskripsi: data.deskripsi || "",
      ukuran: data.ukuran || null,
      qty: data.qty || null,
    };
    return this.request("/workorders", { method: "POST", body: normalized });
  },

  updateWorkOrderStatus(id, data) {
    return this.request(`/workorders/${id}/status`, { method: "PATCH", body: data });
  },
  updateWorkOrderPartial(id, data) {
    return this.request(`/workorders/${id}`, { method: "PATCH", body: data });
  },
  deleteWorkOrder(id) {
    return this.request(`/workorders/${id}`, { method: "DELETE" });
  },
  markWorkOrdersPrinted(ids) {
    return this.request("/workorders/mark-printed", { method: "POST", body: { ids } });
  },
  getWorkOrdersByTanggal(month, year, tanggal) {
    return this.request(
      `/workorders/by-date?month=${month}&year=${year}&tanggal=${tanggal}`
    );
  },

  // ======================================================
  // 📊 DASHBOARD & STATUS BARANG
  // ======================================================
  getDashboardData(month, year) {
    return this.request(`/dashboard?month=${month}&year=${year}`);
  },
  getStatusBarang(month, year, customer = "") {
    return this.request(
      `/status-barang?month=${month}&year=${year}&customer=${encodeURIComponent(
        customer
      )}`
    );
  },

  // ======================================================
  // 👷‍♂️ KARYAWAN & PAYROLL
  // ======================================================
  getKaryawan() { return this.request("/karyawan"); },
  addKaryawan(data) { return this.request("/karyawan", { method: "POST", body: data }); },
  updateKaryawan(id, data) { return this.request(`/karyawan/${id}`, { method: "PUT", body: data }); },
  deleteKaryawan(id) { return this.request(`/karyawan/${id}`, { method: "DELETE" }); },
  processPayroll(data) { return this.request("/payroll", { method: "POST", body: data }); },

  // ======================================================
  // 🏗️ STOK
  // ======================================================
  getStok() { return this.request("/stok"); },
  addBahan(data) { return this.request("/stok", { method: "POST", body: data }); },
  updateStok(data) { return this.request("/stok/update", { method: "POST", body: data }); },

  // ======================================================
  // 💰 INVOICE & SURAT JALAN
  // ======================================================
  getInvoiceData(inv) { return this.request(`/invoice/${inv}`); },
  getInvoiceSummary(month, year) { return this.request(`/invoices/summary?month=${month}&year=${year}`); },
  createSuratJalan(data) { return this.request("/surat-jalan", { method: "POST", body: data }); },

  // ======================================================
  // 💵 KEUANGAN
  // ======================================================
  getSaldoKeuangan() { return this.request("/keuangan/saldo"); },
  addTransaksiKeuangan(data) { return this.request("/keuangan/transaksi", { method: "POST", body: data }); },
  getRiwayatKeuangan(month, year) { return this.request(`/keuangan/riwayat?month=${month}&year=${year}`); },
};

// ==========================================================
// 🎨 APP.UI (Helpers)
// ==========================================================
App.ui = {
    formatCurrency(num) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0); },
    populateDateFilters(monthEl, yearEl) {
        if (!monthEl || !yearEl) return;
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        monthEl.innerHTML = '';
        yearEl.innerHTML = '';
        months.forEach((m, i) => {
            const opt = new Option(m, i + 1);
            if ((i + 1) === currentMonth) opt.selected = true;
            monthEl.add(opt);
        });
        for (let y = currentYear + 1; y >= 2020; y--) {
            const opt = new Option(y, y);
            if (y === currentYear) opt.selected = true;
            yearEl.add(opt);
        }
    },
    toggleModal(modalElement, show) {
        if (!modalElement) return;
        const modalContent = modalElement.querySelector('.modal-content');
        if (show) {
            modalElement.classList.remove('hidden');
            setTimeout(() => {
                modalElement.classList.remove('opacity-0');
                if (modalContent) modalContent.classList.remove('-translate-y-10');
            }, 20);
        } else {
            modalElement.classList.add('opacity-0');
            if (modalContent) modalContent.classList.add('-translate-y-10');
            setTimeout(() => modalElement.classList.add('hidden'), 300);
        }
    },
    printElement(elementId) {
        const elementToPrint = document.getElementById(elementId);
        if (!elementToPrint || !elementToPrint.innerHTML.trim()) {
            alert("Tidak ada konten untuk dicetak.");
            return;
        }
        window.print();
    }
};

// ===================================
// Logika Halaman (SEMUA HALAMAN)
// ===================================

App.pages['dashboard'] = {
    state: { currentStatusView: 'siap_kirim', isLoadingTable: false },
    elements: {},
    init() {
        this.elements = {
            monthFilter: document.getElementById('dashboard-month-filter'),
            yearFilter: document.getElementById('dashboard-year-filter'),
            filterBtn: document.getElementById('filter-dashboard-btn'),
            totalPesananRp: document.getElementById('total-pesanan-rp'),
            totalCustomer: document.getElementById('total-customer'),
            cardBelumProduksi: document.querySelector('[data-status="belum_produksi"]'),
            cardSudahProduksi: document.querySelector('[data-status="sudah_produksi"]'),
            cardDiWarna: document.querySelector('[data-status="di_warna"]'),
            cardSiapKirim: document.querySelector('[data-status="siap_kirim"]'),
            cardDiKirim: document.querySelector('[data-status="di_kirim"]'),
            statusBelumProduksi: document.getElementById('status-belum-produksi'),
            statusSudahProduksi: document.getElementById('status-sudah-produksi'),
            statusSudahWarna: document.getElementById('status-sudah-warna'),
            statusSiapKirim: document.getElementById('status-siap-kirim'),
            statusSudahKirim: document.getElementById('status-sudah-kirim'),
            tableHeading: document.getElementById('dashboard-table-heading'),
            tableBody: document.getElementById('dashboard-table-body'),
        };
        App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
        this.elements.filterBtn.addEventListener('click', () => this.load());
        const statusCards = [
            this.elements.cardBelumProduksi, this.elements.cardSudahProduksi,
            this.elements.cardDiWarna, this.elements.cardSiapKirim, this.elements.cardDiKirim
        ];
        statusCards.forEach(card => {
            if (card) {
                card.addEventListener('click', () => {
                    const status = card.getAttribute('data-status');
                    this.setActiveStatusView(status);
                });
            }
        });
    },
    async load() {
        this.elements.totalPesananRp.textContent = 'Memuat...';
        this.elements.totalCustomer.textContent = 'Memuat...';
        this.elements.tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat...</td></tr>';
        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;
        try {
            const summaryData = await App.api.getDashboardData(month, year);
            if (!summaryData.summary || !summaryData.statusCounts) {
                throw new Error('Data dashboard tidak lengkap.');
            }
            this.renderSummaryCards(summaryData.summary, summaryData.statusCounts);
            this.setActiveStatusView(this.state.currentStatusView || 'siap_kirim');
        } catch (error) {
            console.error('[Dashboard] Error saat memuat data:', error);
            this.elements.totalPesananRp.textContent = 'Error';
            this.elements.totalCustomer.textContent = 'Error';
            this.elements.tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal: ${error.message}</td></tr>`;
        }
    },
    setActiveStatusView(status) {
        if (!status || this.state.isLoadingTable) return;
        this.state.currentStatusView = status;
        document.querySelectorAll('.status-card').forEach(card => card.classList.remove('active-card'));
        const activeCard = document.querySelector(`[data-status="${status}"]`);
        if (activeCard) activeCard.classList.add('active-card');
        if (this.elements.tableHeading)
            this.elements.tableHeading.textContent = `Daftar Barang ${this.getStatusLabel(status)}`;
        this.loadTableData(status);
    },
    async loadTableData(status) {
        if (this.state.isLoadingTable) return;
        this.state.isLoadingTable = true;
        this.elements.tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat...</td></tr>';
        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;
        try {
            const items = await App.api.getWorkOrders(month, year, '', status);
            if (status === this.state.currentStatusView) this.renderTable(items);
        } catch (error) {
            console.error(`[loadTableData] Error untuk status ${status}:`, error);
            if (status === this.state.currentStatusView)
                this.elements.tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal: ${error.message}</td></tr>`;
} finally {
            this.state.isLoadingTable = false;
        }
    },
    renderSummaryCards(summary, counts) {
        if (summary) {
            this.elements.totalPesananRp.textContent = App.ui.formatCurrency(summary.total_rupiah || 0);
            this.elements.totalCustomer.textContent = summary.total_customer || 0;
        }
        if (counts) {
            this.elements.statusBelumProduksi.textContent = counts.belum_produksi || 0;
            this.elements.statusSudahProduksi.textContent = counts.sudah_produksi || 0;
            this.elements.statusSudahWarna.textContent = counts.di_warna || 0;
            this.elements.statusSiapKirim.textContent = counts.siap_kirim || 0;
            this.elements.statusSudahKirim.textContent = counts.di_kirim || 0;
        }
    },
    renderTable(items) {
        if (!items || items.length === 0) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-gray-500">Kosong</td></tr>`;
            return;
        }
        this.elements.tableBody.innerHTML = items.map(item => `
            <tr class="text-sm">
                <td class="px-6 py-4 font-medium text-gray-900">${item.nama_customer || '-'}</td>
                <td class="px-6 py-4 text-gray-600">${item.deskripsi || '-'}</td>
                <td class="px-6 py-4 text-center text-gray-600">${item.qty || 0}</td>
                <td class="px-6 py-4 text-center text-gray-600">${item.ukuran || '-'}</td>
            </tr>
        `).join('');
    },
    getStatusLabel(status) {
        const labels = {
            'belum_produksi': 'Belum Produksi',
            'sudah_produksi': 'Sudah Produksi',
            'di_warna': 'Sudah Pewarnaan',
            'siap_kirim': 'Siap Kirim',
            'di_kirim': 'Sudah Kirim'
        };
        return labels[status] || 'Tidak Diketahui';
    },
    capitalizeStatus(status) {
        if (!status) return '';
        return status.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join('');
    }
};

App.pages['data-karyawan'] = {
    state: { karyawanList: [], editingId: null, },
    elements: {},
    init() {
        this.elements = {
            tableBody: document.getElementById('karyawan-table-body'),
            addBtn: document.getElementById('add-karyawan-btn'),
            modal: document.getElementById('karyawan-modal'),
            modalTitle: document.getElementById('karyawan-modal-title'),
            form: document.getElementById('karyawan-form'),
            cancelBtn: document.getElementById('cancel-karyawan-btn'),
            karyawanIdInput: document.getElementById('karyawan-id'),
        };
        this.elements.addBtn.addEventListener('click', () => this.openModal());
        this.elements.cancelBtn.addEventListener('click', () => this.closeModal());
        this.elements.form.addEventListener('submit', (e) => this.handleSave(e));
        this.elements.tableBody.addEventListener('click', (e) => this.handleTableClick(e));
    },
    async load() {
        this.elements.tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500">Memuat data...</td></tr>';
        try {
            const data = await App.api.getKaryawan();
            this.state.karyawanList = data;
            this.render();
        } catch (error) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500">${error.message}</td></tr>`;
        }
    },
    render() {
        if (this.state.karyawanList.length === 0) {
            this.elements.tableBody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-500">Belum ada data karyawan.</td></tr>';
            return;
        }
        this.elements.tableBody.innerHTML = this.state.karyawanList.map(k => `
            <tr data-id="${k.id}">
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${k.nama_karyawan}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">${App.ui.formatCurrency(k.gaji_harian)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">${App.ui.formatCurrency(k.potongan_bpjs_kesehatan)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">${App.ui.formatCurrency(k.potongan_bpjs_ketenagakerjaan)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right">${App.ui.formatCurrency(k.kasbon)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button class="edit-btn text-indigo-600 hover:text-indigo-900">Edit</button>
                    <button class="delete-btn text-red-600 hover:text-red-900 ml-4">Hapus</button>
                </td>
            </tr>
        `).join('');
    },
    openModal(karyawan = null) {
        this.elements.form.reset();
        if (karyawan) {
            this.state.editingId = karyawan.id;
            this.elements.modalTitle.textContent = 'Edit Data Karyawan';
            this.elements.karyawanIdInput.value = karyawan.id;
            document.getElementById('nama_karyawan').value = karyawan.nama_karyawan;
            document.getElementById('gaji_harian').value = karyawan.gaji_harian;
            document.getElementById('potongan_bpjs_kesehatan').value = karyawan.potongan_bpjs_kesehatan;
            document.getElementById('potongan_bpjs_ketenagakerjaan').value = karyawan.potongan_bpjs_ketenagakerjaan;
            document.getElementById('kasbon').value = karyawan.kasbon;
        } else {
            this.state.editingId = null;
            this.elements.modalTitle.textContent = 'Tambah Karyawan Baru';
        }
        App.ui.toggleModal(this.elements.modal, true);
    },
    closeModal() {
        App.ui.toggleModal(this.elements.modal, false);
    },
    async handleSave(e) {
        e.preventDefault();
        const data = {
            nama_karyawan: document.getElementById('nama_karyawan').value,
            gaji_harian: document.getElementById('gaji_harian').value || 0,
            potongan_bpjs_kesehatan: document.getElementById('potongan_bpjs_kesehatan').value || 0,
            potongan_bpjs_ketenagakerjaan: document.getElementById('potongan_bpjs_ketenagakerjaan').value || 0,
            kasbon: document.getElementById('kasbon').value || 0,
        };
        try {
            if (this.state.editingId) {
                await App.api.updateKaryawan(this.state.editingId, data);
            } else {
                await App.api.addKaryawan(data);
            }
            this.closeModal();
            await this.load();
        } catch (error) {
            alert(`Gagal menyimpan data: ${error.message}`);
        }
    },
    handleTableClick(e) {
        const target = e.target;
        const row = target.closest('tr');
        if (!row) return;
        const id = row.dataset.id;
        const karyawan = this.state.karyawanList.find(k => k.id == id);
        if (target.classList.contains('edit-btn')) {
            this.openModal(karyawan);
        }
        if (target.classList.contains('delete-btn')) {
            this.handleDelete(id, karyawan.nama_karyawan);
        }
    },
    async handleDelete(id, nama) {
        if (confirm(`Yakin ingin menghapus data karyawan "${nama}"?`)) {
            try {
                await App.api.deleteKaryawan(id);
                await this.load();
            } catch (error) {
                alert(`Gagal menghapus: ${error.message}`);
            }
        }
    },
};

App.pages['payroll'] = {
    state: { karyawanList: [], selectedKaryawan: null, payrollData: null },
    elements: {},
    init() {
        this.elements = {
            karyawanSelect: document.getElementById('karyawan-select'),
            periodeInput: document.getElementById('periode-gaji'),
            hariKerjaInput: document.getElementById('hari-kerja'),
            hariLemburInput: document.getElementById('hari-lembur'),
            potonganBonInput: document.getElementById('potongan-bon'),
            calculateBtn: document.getElementById('calculate-btn'),
            summaryDiv: document.getElementById('payroll-summary'),
            printArea: document.getElementById('slip-gaji-print-area'),
        };
        this.elements.karyawanSelect.addEventListener('change', () => this.handleKaryawanSelect());
        this.elements.calculateBtn.addEventListener('click', () => this.handleCalculate());
        this.elements.periodeInput.valueAsDate = new Date();
    },
    async load() {
        try {
            const karyawan = await App.api.getKaryawan();
            this.state.karyawanList = karyawan;
            const select = this.elements.karyawanSelect;
            select.innerHTML = '<option value="">-- Pilih Karyawan --</option>';
            karyawan.forEach((k) => select.add(new Option(k.nama_karyawan, k.id)));
            if (karyawan.length > 0) {
                select.value = karyawan[0].id;
                this.handleKaryawanSelect();
            }
        } catch (err) {
            console.error("[Payroll] Gagal load:", err);
            this.elements.karyawanSelect.innerHTML = `<option>${err.message}</option>`;
        }
    },
    handleKaryawanSelect() {
        const id = this.elements.karyawanSelect.value;
        this.state.selectedKaryawan = id ? this.state.karyawanList.find((k) => k.id == id) : null;
    },
    handleCalculate() {
        const k = this.state.selectedKaryawan;
        if (!k) return alert("Pilih karyawan terlebih dahulu.");
        const hariKerja = parseInt(this.elements.hariKerjaInput.value) || 0;
        const hariLembur = parseInt(this.elements.hariLemburInput.value) || 0;
        const potonganBon = parseFloat(this.elements.potonganBonInput.value) || 0;
        const gajiHarian = parseFloat(k.gaji_harian || 0);
        const bpjsKes = parseFloat(k.potongan_bpjs_kesehatan || 0);
        const bpjsKet = parseFloat(k.potongan_bpjs_ketenagakerjaan || 0);
        const gajiPokok = hariKerja * gajiHarian;
        const totalLembur = hariLembur * gajiHarian;
        const totalKotor = gajiPokok + totalLembur;
        const totalPotongan = bpjsKes + bpjsKet + potonganBon;
        const gajiBersih = totalKotor - totalPotongan;
        this.state.payrollData = {
            karyawan_id: k.id, nama_karyawan: k.nama_karyawan, periode_gaji: this.elements.periodeInput.value,
            hari_kerja: hariKerja, hari_lembur: hariLembur, gaji_harian: gajiHarian,
            gaji_pokok: gajiPokok, total_lembur: totalLembur, total_gaji_kotor: totalKotor,
            potongan_bpjs_kesehatan: bpjsKes, potongan_bpjs_ketenagakerjaan: bpjsKet,
            potongan_kasbon: potonganBon, total_potongan: totalPotongan, gaji_bersih: gajiBersih,
        };
        this.renderSummary();
    },
    renderSummary() {
        const p = this.state.payrollData;
        if (!p) return;
        this.elements.summaryDiv.classList.remove("hidden");
        this.elements.summaryDiv.innerHTML = `
          <div class="grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <h3 class="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Pendapatan</h3>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between"><dt>Gaji Pokok (${p.hari_kerja} hari)</dt><dd>${App.ui.formatCurrency(p.gaji_pokok)}</dd></div>
                <div class="flex justify-between"><dt>Lembur (${p.hari_lembur} hari)</dt><dd>${App.ui.formatCurrency(p.total_lembur)}</dd></div>
                <div class="flex justify-between font-bold border-t pt-2"><dt>Total Kotor</dt><dd>${App.ui.formatCurrency(p.total_gaji_kotor)}</dd></div>
              </dl>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Potongan</h3>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between"><dt>BPJS Kesehatan</dt><dd>${App.ui.formatCurrency(p.potongan_bpjs_kesehatan)}</dd></div>
                <div class="flex justify-between"><dt>BPJS Ketenagakerjaan</dt><dd>${App.ui.formatCurrency(p.potongan_bpjs_ketenagakerjaan)}</dd></div>
                <div class="flex justify-between"><dt>Potongan Bon</dt><dd>${App.ui.formatCurrency(p.potongan_kasbon)}</dd></div>
                <div class="flex justify-between font-bold border-t pt-2"><dt>Total Potongan</dt><dd>${App.ui.formatCurrency(p.total_potongan)}</dd></div>
              </dl>
            </div>
          </div>
          <div class="mt-6 border-t-2 border-gray-300 flex justify-between items-center pt-4">
            <h3 class="text-xl font-bold text-gray-900">GAJI BERSIH</h3>
            <p class="text-2xl font-bold text-green-600">${App.ui.formatCurrency(p.gaji_bersih)}</p>
          </div>
          <div class="mt-6 text-right">
            <button id="save-print-btn" class="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">Simpan & Cetak Slip</button>
          </div>
        `;
        document
          .getElementById("save-print-btn")
          .addEventListener("click", () => this.handleSaveAndPrint());
    },
    async handleSaveAndPrint() {
        const p = this.state.payrollData;
        if (!p) return;
        const btn = document.getElementById("save-print-btn");
        btn.disabled = true;
        btn.textContent = "Menyimpan...";
        try {
            await App.api.processPayroll(p);
            this.renderSlipGaji();
            await new Promise((r) => setTimeout(r, 400));
            App.ui.printElement("slip-gaji-print-area");
            alert("✅ Slip gaji berhasil disimpan dan dicetak!");
            this.load();
        } catch (err) {
            console.error("[Payroll] Gagal:", err);
            alert("Gagal menyimpan payroll: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Simpan & Cetak Slip";
        }
    },
    renderSlipGaji() {
        const p = this.state.payrollData;
        if (!p) return;
        const periodeFormatted = new Date(p.periode_gaji).toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
        });
        this.elements.printArea.innerHTML = `
        <div class="invoice-box">
          <div class="invoice-header flex justify-between items-center">
            <div>
              <h1 class="font-bold text-lg">CV TOTO ALUMINIUM MANUFACTURE</h1>
              <p class="text-sm text-gray-600">Rawa Mulya, Bekasi | Telp: 0813-1191-2002</p>
            </div>
            <div class="text-right">
              <h2 class="text-xl font-bold">SLIP GAJI</h2>
              <p class="text-sm">${periodeFormatted}</p>
            </div>
          </div>
          <hr class="my-3">
          <p><strong>Nama Karyawan:</strong> ${p.nama_karyawan}</p>
          <table class="w-full text-sm mt-3 border-t pt-2">
            <tr><td>Gaji Pokok</td><td class="text-right">${App.ui.formatCurrency(p.gaji_pokok)}</td></tr>
            <tr><td>Lembur</td><td class="text-right">${App.ui.formatCurrency(p.total_lembur)}</td></tr>
            <tr class="font-bold border-t"><td>Total Pendapatan</td><td class="text-right">${App.ui.formatCurrency(p.total_gaji_kotor)}</td></tr>
            <tr><td>BPJS Kesehatan</td><td class="text-right">${App.ui.formatCurrency(p.potongan_bpjs_kesehatan)}</td></tr>
            <tr><td>BPJS Ketenagakerjaan</td><td class="text-right">${App.ui.formatCurrency(p.potongan_bpjs_ketenagakerjaan)}</td></tr>
            <tr><td>Kasbon</td><td class="text-right">${App.ui.formatCurrency(p.potongan_kasbon)}</td></tr>
            <tr class="border-t font-bold"><td>Gaji Bersih</td><td class="text-right">${App.ui.formatCurrency(p.gaji_bersih)}</td></tr>
          </table>
          <div class="flex justify-around text-center text-sm mt-10">
            <div><p class="mb-12">Disetujui oleh,</p><p>(.....................)</p></div>
            <div><p class="mb-12">Diterima oleh,</p><p>(${p.nama_karyawan})</p></div>
          </div>
        </div>
        `;
    },
};

// ==========================================================
// 🚀 APP.PAGES['work-orders'] (VERSI TABULATOR "Google Sheet" + REALTIME)
// ==========================================================
App.pages["work-orders"] = {
  state: {
    table: null, // Instance Tabulator akan disimpan di sini
    totalRows: 10000, // Default, akan di-update oleh server
    pageSize: 500,
    poButton: null,
    poCount: null,
  },
  elements: {},

  // ======================================================
  // 🔹 INIT PAGE (FUNGSI UTAMA)
  // ======================================================
  init() {
    this.elements.monthFilter = document.getElementById("wo-month-filter");
    this.elements.yearFilter = document.getElementById("wo-year-filter");
    this.elements.filterBtn = document.getElementById("filter-wo-btn");
    this.elements.gridContainer = document.getElementById("workorders-grid");
    this.elements.status = document.getElementById("wo-status") || document.createElement('div');
    this.state.poButton = document.getElementById('create-po-btn');
    this.state.poCount = document.getElementById('po-selection-count');

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.initSocketIO(); // Panggil socket
    this.initTabulator(); // Panggil tabulator

    this.elements.filterBtn?.addEventListener("click", () => {
      if (this.state.table) {
        console.log("🔘 Tombol Filter diklik. Meminta data...");
        this.state.table.setData(); 
      }
    });
    this.initPOFeature(); 
  },

  // ======================================================
  // 📡 INIT SOCKET.IO (Menghubungkan ke Server Real-time)
  // ======================================================
  initSocketIO() {
    if (!App.state.socket) {
      console.warn("Socket.IO global belum siap. Menunggu App.init...");
      // Coba lagi setelah App.init selesai
      setTimeout(() => this.initSocketIO(), 100); 
      return;
    }
    const socket = App.state.socket;

    // Pastikan listener hanya didaftarkan sekali
    if (this.socketBound) return;
    this.socketBound = true;

    socket.on('wo_updated', (updatedRow) => {
      console.log('📡 Menerima siaran [wo_updated]:', updatedRow);
      if (this.state.table) {
        this.state.table.updateData([updatedRow]);
        this.updateStatus(`Baris untuk [${updatedRow.nama_customer}] diperbarui oleh user lain.`);
      }
    });
    socket.on('wo_created', (newRow) => {
      console.log('📡 Menerima siaran [wo_created]:', newRow);
      if (this.state.table) {
        // Cari baris kosong placeholder pertama dan ganti
        const placeholderRow = this.state.table.getRows().find(row => row.getData().id_placeholder === true);
        if (placeholderRow) {
          placeholderRow.update(newRow);
        } else {
          // Jika tidak ada baris kosong, tambahkan di atas
          this.state.table.addRow(newRow, true); 
        }
        this.updateStatus(`Baris baru untuk [${newRow.nama_customer}] ditambahkan oleh user lain.`);
      }
    });
   socket.on('wo_deleted', (deletedInfo) => {
      console.log('📡 Menerima siaran [wo_deleted]:', deletedInfo);
     if (this.state.table) {
       this.state.table.deleteRow(deletedInfo.id);
       this.updateStatus(`Baris [${deletedInfo.row.nama_customer}] dihapus oleh user lain.`);
     }
   });
  },

  // ======================================================
  // 📊 INIT TABULATOR (Membuat Spreadsheet Canggih)
  // ======================================================
  initTabulator() {
    const self = this; 
    this.state.table = new Tabulator(this.elements.gridContainer, {
      height: "70vh", 
      layout: "fitData", 
      placeholder: "Silakan pilih Bulan dan Tahun, lalu klik Filter.",
      index: "id", 
      progressiveLoad: "scroll", 
      progressiveLoadScrollMargin: 200, 
      ajaxURL: App.api.baseUrl + '/api/workorders/chunk',
      ajaxParams: () => ({
        month: this.elements.monthFilter.value,
        year: this.elements.yearFilter.value,
      }),
      ajaxConfig: { 
        headers: {
          'Authorization': 'Bearer ' + App.getToken() // ✅ Panggil App.getToken() yang sudah benar
        }
      },
      ajaxResponse: (url, params, response) => {
        // ✅ Ini adalah logika yang benar untuk { data, total }
        const { data, total } = response; 
        const loadedCount = self.state.table ? self.state.table.getDataCount() : 0;
        const remainingRows = total - loadedCount - data.length;
        const lastPage = remainingRows <= 0;
        self.state.totalRows = total; 
        const emptyRows = [];
        if (!lastPage) {
          // Selalu tambah 500 baris kosong (atau sisa)
          const fillCount = Math.min(self.state.pageSize, remainingRows + 1); 
          for(let i=0; i < fillCount; i++) {
            emptyRows.push({ id: `_empty_${loadedCount + data.length + i}`, id_placeholder: true, nama_customer: "", deskripsi: "", ukuran: "", qty: "" });
          }
        }
        return {
          data: [...data, ...emptyRows],
          last_page: lastPage ? 1 : 0,
        };
      },
      ajaxRequesting: (url, params) => { this.updateStatus('Memuat data...'); return true; },
      ajaxRequestError: (error) => { this.updateStatus('Gagal memuat data. Cek koneksi atau login ulang.'); },
      dataLoaded: (data) => {
        if (this.state.table) {
          this.updateStatus(`Menampilkan ${this.state.table.getDataCount(true)} dari ${this.state.totalRows} baris.`);
        }
      },
      // === FITUR GOOGLE SHEET ===
      clipboard: true, 
      clipboardPasteAction: "replace", 
      keybindings: { "navNext": "13" },
      // === DEFINISI KOLOM ===
      columns: [
        { formatter: "rowSelection", titleFormatter: "rowSelection", hozAlign: "center", headerHozAlign: "center", cellClick: (e, cell) => cell.getRow().toggleSelect(), width: 40, cssClass: "cursor-pointer" },
        { title: "#", formatter: "rownum", width: 40, hozAlign: "center" },
        { 
          title: "TANGGAL", field: "tanggal", width: 120, editor: "input",
          formatter: (cell) => {
            const val = cell.getValue();
            if (val && (val.includes('-') || val.includes('T'))) { // Cek format YYYY-MM-DD atau ISO
              try { return new Date(val).toLocaleDateString("id-ID"); } catch(e) { return val; }
            } else if (val) {
              return val; // Asumsi sudah DD/MM/YYYY
            }
            return "";
          }
        },
        { title: "CUSTOMER", field: "nama_customer", width: 250, editor: "input" },
        { title: "DESKRIPSI", field: "deskripsi", width: 350, editor: "input" },
        { title: "UKURAN", field: "ukuran", width: 100, hozAlign: "center", editor: "input" },
        { title: "QTY", field: "qty", width: 80, hozAlign: "center", editor: "input" }
      ],
      // === EVENT PENTING: AUTOSAVE & PO ===
      cellEdited: (cell) => {
        self.handleCellEdit(cell);
      },
      rowSelectionChanged: (data, rows) => {
        self.updatePOButtonState(rows.length);
      }
    });
  },

  // ======================================================
  // 🧾 UPDATE STATUS (Helper)
  // ======================================================
  updateStatus(msg) {
    if (this.elements.status) this.elements.status.textContent = msg;
    console.log("WO:", msg);
  },

  // ======================================================
  // 💾 AUTOSAVE (Dipanggil oleh Tabulator 'cellEdited')
  // ======================================================
  async handleCellEdit(cell) {
    const rowData = cell.getRow().getData();
    this.updateStatus('Menyimpan perubahan...');
    try {
      if (rowData.id && !rowData.id_placeholder) {
        // --- UPDATE DATA LAMA ---
        await App.api.updateWorkOrderPartial(rowData.id, rowData);
        this.updateStatus('Perubahan tersimpan ✅');
      } else {
        // --- BUAT DATA BARU ---
        delete rowData.id;
        delete rowData.id_placeholder;
        const newRow = await App.api.addWorkOrder(rowData);
        cell.getRow().update({ id: newRow.id }); 
        this.updateStatus('Baris baru tersimpan ✅');
      }
    } catch (err) {
      console.error("Gagal autosave:", err);
      this.updateStatus('Gagal menyimpan perubahan. Cek koneksi.');
      cell.restoreOldValue(); 
    }
  },

  // ======================================================
  // 🧾 FUNGSI PO (Sekarang bagian dari halaman)
  // ======================================================
  initPOFeature() {
    if (this.state.poButton) {
      this.state.poButton.addEventListener('click', () => this.handlePrintPO());
    } else {
      console.warn('⚠️ Tombol create-po-btn tidak ditemukan.');
    }
  },

  updatePOButtonState(selectedCount) {
    // Saring baris placeholder yang tidak valid
    const validCount = this.state.table ? this.state.table.getSelectedData().filter(row => !row.id_placeholder && row.id).length : 0;
    if (!this.state.poButton || !this.state.poCount) return;
    this.state.poCount.textContent = validCount;
    this.state.poButton.disabled = validCount === 0;
  },

  async handlePrintPO() {
    if (!this.state.table) return;
    const selectedData = this.state.table.getSelectedData();
    const btn = this.state.poButton;
    const countSpan = this.state.poCount;
    // Saring baris kosong (placeholder) yang mungkin tercentang
    const validSelectedData = selectedData.filter(row => !row.id_placeholder && row.id);
    
    if (validSelectedData.length === 0) {
      alert('Silakan pilih baris yang sudah berisi data untuk dicetak PO.');
      return;
    }
    if (!confirm(`Cetak ${validSelectedData.length} Work Order sebagai PO?`)) return;

    try {
      sessionStorage.setItem('poData', JSON.stringify(validSelectedData));
      const ids = validSelectedData.map(item => item.id);
      btn.disabled = true;
      btn.textContent = 'Menandai...';
      await App.api.markWorkOrdersPrinted(ids);
      const updatedRows = ids.map(id => ({ id: id, di_produksi: 'true' }));
      this.state.table.updateData(updatedRows);
      this.state.table.deselectRow(); 
      alert('PO berhasil dibuat. Mengarahkan ke halaman cetak...');
      window.location.href = 'print-po.html';
    } catch (err) {
      console.error('❌ Gagal Buat PO:', err);
      alert('Terjadi kesalahan: ' + (err.message || 'Tidak diketahui'));
    } finally {
      btn.disabled = false;
      btn.textContent = `Buat PO`; 
      if (countSpan) countSpan.textContent = 0;
    }
  }
};



App.pages['print-po'] = {
    state: { poData: [] },
    elements: {},
    init() {
        this.elements = {
            printBtn: document.getElementById('print-btn'),
            finishBtn: document.getElementById('finish-btn'),
            poContent: document.getElementById('po-content'),
        };
        this.elements.printBtn.addEventListener('click', () => App.ui.printElement('po-content'));
        this.elements.finishBtn.addEventListener('click', () => this.handleFinish());
    },
    load() {
        const dataString = sessionStorage.getItem('poData');
        if (!dataString || dataString === '[]') {
            this.elements.poContent.innerHTML = `<p class="text-red-500 text-center">Tidak ada data.</p>`;
            this.elements.finishBtn.disabled = true;
            return;
        }
        try {
            this.state.poData = JSON.parse(dataString);
            this.render();
        } catch (err) {
            console.error("❌ Gagal parsing data PO:", err);
            this.elements.poContent.innerHTML = `<p class="text-red-500 text-center">Error data PO.</p>`;
        }
    },
    render() {
        const poDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const orderedData = this.state.poData;
        let itemRowsHtml = '';
        orderedData.forEach((item, index) => {
            itemRowsHtml += `
                <tr class="border-b">
                    <td class="p-2 border text-center">${index + 1}</td>
                    <td class="p-2 border">${item.nama_customer || '-'}</td>
                    <td class="p-2 border">${item.deskripsi || '-'}</td>
                    <td class="p-2 border text-center">${parseFloat(item.ukuran) || ''}</td>
                    <td class="p-2 border text-center">${parseFloat(item.qty) || ''}</td>
                    <td class="p-2 border h-12"></td>
                </tr>
            `;
        });
        this.elements.poContent.innerHTML = `
        <div class="po-document p-4">
            <div class="text-center mb-6">
                <h2 class="text-xl font-bold">CV TOTO ALUMINIUM MANUFACTURE</h2>
                <p class="text-sm">Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
                <h1 class="text-2xl font-extrabold mt-4 border-b-2 border-black pb-1">PURCHASE ORDER</h1>
            </div>
            <p class="mb-4 text-sm">Tanggal: ${poDate}</p>
            <table class="w-full border-collapse border text-sm">
                <thead class="bg-gray-200 font-bold">
                    <tr>
                        <th class="p-2 border w-1/12">NO</th>
                        <th class="p-2 border w-2/12">NAMA CUSTOMER</th>
                        <th class="p-2 border w-4/12">KETERANGAN/DESKRIPSI</th>
                        <th class="p-2 border w-1/12">UKURAN</th>
                        <th class="p-2 border w-1/12">QTY</th>
                        <th class="p-2 border w-2/12">CEKLIS</th>
                    </tr>
                </thead>
                <tbody>${itemRowsHtml}</tbody>
            </table>
            <div class="grid grid-cols-3 gap-8 text-center text-sm mt-16">
                <div>Dibuat Oleh,<br><br><br>(..................)</div>
                <div>Disetujui,<br><br><br>(..................)</div>
                <div>QC / Gudang,<br><br><br>(..................)</div>
            </div>
        </div>
        `;
    },
    async handleFinish() {
        if (this.state.poData.length === 0) return;
        this.elements.finishBtn.textContent = 'Menandai...';
        this.elements.finishBtn.disabled = true;
        const idsToMark = this.state.poData.map(item => item.id);
        try {
            await App.api.markWorkOrdersPrinted(idsToMark);
            sessionStorage.removeItem('poData');
            alert('Status PO berhasil diperbarui!');
            window.location.href = 'work-orders.html';
        } catch (error) {
            alert(`Gagal menandai status: ${error.message}`);
            this.elements.finishBtn.textContent = 'Selesai & Tandai';
            this.elements.finishBtn.disabled = false;
        }
    }
};

App.pages['surat-jalan'] = {
  state: { invoiceData: null, itemsForColoring: [], currentTab: 'customer' },
  elements: {},
  debounce(fn, wait) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  },
  init() {
    this.elements = {
      tabCustomer: document.getElementById('tab-sj-customer'),
      tabWarna: document.getElementById('tab-sj-warna'),
      contentCustomer: document.getElementById('content-sj-customer'),
      contentWarna: document.getElementById('content-sj-warna'),
      invoiceInput: document.getElementById('sj-invoice-search'),
      searchBtn: document.getElementById('sj-search-btn'),
      catatanInput: document.getElementById('sj-catatan'),
      printBtn: document.getElementById('sj-print-btn'),
      warnaTableBody: document.getElementById('sj-warna-table-body'),
      warnaPrintBtn: document.getElementById('sj-warna-print-btn'),
      vendorSelect: document.getElementById('sj-warna-vendor'),
      selectAllWarna: document.getElementById('sj-warna-select-all'),
      printArea: document.getElementById('sj-print-area'),
      warnaPrintArea: document.getElementById('sj-warna-print-area'),
      monthInput: document.getElementById('sj-warna-month'),
      yearInput: document.getElementById('sj-warna-year'),
      customerSearchInput: document.getElementById('sj-warna-customer-search')
    };
    this.elements.tabCustomer.addEventListener('click', () => this.switchTab('customer'));
    this.elements.tabWarna.addEventListener('click', () => this.switchTab('warna'));
    this.elements.searchBtn.addEventListener('click', () => this.handleSearchInvoice());
    this.elements.printBtn.addEventListener('click', () => this.printCustomerSJ());
    this.elements.warnaPrintBtn.addEventListener('click', () => this.handlePrintWarnaSJ());
    if (this.elements.selectAllWarna) {
      this.elements.selectAllWarna.addEventListener('change', (e) => {
        this.elements.warnaTableBody.querySelectorAll('input.warna-check').forEach(cb => cb.checked = e.target.checked);
        this.updateWarnaPreview();
      });
    }
    this.elements.vendorSelect.addEventListener('change', () => this.updateWarnaPreview());
    if (this.elements.monthInput) this.elements.monthInput.addEventListener('change', () => this.loadItemsForColoring());
    if (this.elements.yearInput) this.elements.yearInput.addEventListener('change', () => this.loadItemsForColoring());
    
    // Buat searchbox jika tidak ada
    if (!this.elements.customerSearchInput && this.elements.warnaTableBody) {
      const searchBox = document.createElement('input');
      searchBox.id = 'sj-warna-customer-search';
      searchBox.placeholder = '🔍 Cari customer...';
      searchBox.className = 'w-full p-2 mb-2 border rounded border-[#D1BFA3]';
      const wrapper = this.elements.warnaTableBody.closest('div.overflow-auto');
      if (wrapper) wrapper.parentElement.prepend(searchBox);
      this.elements.customerSearchInput = searchBox; // Update referensi
    }
    
    if(this.elements.customerSearchInput) {
      this.elements.customerSearchInput.addEventListener('input', this.debounce((e) => {
        const q = (e.target.value || '').trim().toLowerCase();
        const filtered = this.state.itemsForColoring.filter(it => (it.nama_customer || '').toLowerCase().includes(q));
        this.renderWarnaTable(filtered);
      }, 300));
    }
  },
  load() { this.switchTab('customer'); },
  async handleSearchInvoice() {
    const inv = this.elements.invoiceInput.value.trim();
    if (!inv) return alert('Masukkan nomor invoice.');
    this.elements.printArea.innerHTML = '<p class="text-center p-4">Mencari data...</p>';
    this.elements.printBtn.disabled = true;
    try {
      const data = await App.api.getInvoiceData(inv); 
      if (!data || data.length === 0) throw new Error('Invoice tidak ditemukan.');
      this.state.invoiceData = data;
      this.renderCustomerSJ('SJ-' + Date.now());
      this.elements.printBtn.disabled = false;
    } catch (error) {
      this.state.invoiceData = null;
      this.elements.printArea.innerHTML = `<p class="text-center p-4 text-red-500">Error: ${error.message}</p>`;
    }
  },
  renderCustomerSJ(no_sj) {
    if (!this.state.invoiceData || this.state.invoiceData.length === 0) return;
    const data = this.state.invoiceData;
    const customer = data[0].nama_customer;
    const inv = data[0].no_inv;
    const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const itemRows = data.map((item, index) => `
      <tr>
        <td class="border text-center p-1">${index + 1}</td>
        <td class="border text-center p-1">${parseFloat(item.qty) || ''}</td>
        <td class="border p-1">${item.deskripsi || ''}</td>
        <td class="border text-center p-1">${item.ukuran || ''}</td>
      </tr>
    `).join('');
    this.elements.printArea.innerHTML = `
    <div class="print-content" style="font-family: 'Courier New', monospace; font-size: 10pt; color: #000; line-height: 1.2; padding: 10px 15px;">
      <div style="text-align: center; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px;">
        <h2 style="margin: 0; font-size: 13pt; font-weight: bold;">CV TOTO ALUMINIUM MANUFACTURE</h2>
        <p style="margin: 0; font-size: 9pt;">Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
        <h1 style="margin: 6px 0 0 0; font-size: 14pt; font-weight: bold;">SURAT JALAN</h1>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <div style="flex: 1;">
          <p style="margin: 0;">Kepada Yth:</p>
          <p style="margin: 0;">Nama: <b>${customer}</b></p>
        </div>
        <div style="text-align: right; flex: 1;">
          <p style="margin: 0;">No. SJ: <b>${no_sj}</b></p>
          <p style="margin: 0;">No. Invoice: ${inv}</p>
          <p style="margin: 0;">Tanggal: ${tanggal}</p>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 8px;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="border: 1px solid #000; padding: 3px;">No</th>
            <th style="border: 1px solid #000; padding: 3px;">Qty</th>
            <th style="border: 1px solid #000; padding: 3px; text-align: left;">Nama Barang / Deskripsi</th>
            <th style="border: 1px solid #000; padding: 3px;">Ukuran</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="width: 100%; text-align: center; margin-top: 50px; display: flex; justify-content: space-around; page-break-inside: avoid;">
        <div style="flex: 1;">Dibuat Oleh,<br><br><br><br>(..................)</div>
        <div style="flex: 1;">Pengirim,<br><br><br><br>(..................)</div>
        <div style="flex: 1;">Penerima,<br><br><br><br>(..................)</div>
      </div>
    </div>
    `;
  },
  switchTab(tab) {
    const tabCustomer = document.getElementById("tab-sj-customer");
    const tabWarna = document.getElementById("tab-sj-warna");
    const contentCustomer = document.getElementById("content-sj-customer");
    const contentWarna = document.getElementById("content-sj-warna");
    if (tab === "customer") {
      tabCustomer.classList.add("active");
      tabWarna.classList.remove("active");
      contentCustomer.classList.remove("hidden");
      contentWarna.classList.add("hidden");
    } else if (tab === "warna") {
      tabWarna.classList.add("active");
      tabCustomer.classList.remove("active");
      contentWarna.classList.remove("hidden");
      contentCustomer.classList.add("hidden");
      if (this.state.itemsForColoring.length === 0) {
        console.log('Tab Pewarnaan dibuka, memuat data awal...');
        this.loadItemsForColoring();
        }
    }
  },
  printCustomerSJ() {
    const area = this.elements.printArea;
    if (!area || !area.innerHTML.trim()) return alert("Tidak ada Surat Jalan Customer untuk dicetak.");
    const tableContent = area.querySelector("table")?.outerHTML || "Data tidak ditemukan";
    const data = this.state.invoiceData;
    const customer = data && data[0] ? data[0].nama_customer : "Customer";
    const inv = data && data[0] ? data[0].no_inv : "-";
    const noSJ = "SJ-" + Date.now();
    const tanggal = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    const w = window.open("", "_blank", "width=1200,height=700");
    w.document.write(`
        <html><head><title>Surat Jalan Customer</title><style>
          @page { size: 279mm 140mm landscape; margin: 5mm 10mm; }
          body { font-family: "Courier New", monospace; font-size: 10pt; color: #000; margin: 0; padding: 0; line-height: 1.2; }
          h1, h2, h3, p { margin: 0; padding: 0; }
          .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 6px; }
          .header h2 { font-size: 12pt; font-weight: bold; }
          .header p { font-size: 9pt; }
          .judul { font-size: 13pt; font-weight: bold; margin-top: 2px; }
          .info { display: flex; justify-content: space-between; font-size: 9pt; margin-top: 5px; margin-bottom: 5px; }
          .info-left { flex: 1; }
          .info-right { flex: 1; text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-top: 3px; table-layout: fixed; }
          th, td { border: 1px solid #000; padding: 3px 5px; font-size: 9pt; vertical-align: middle; overflow-wrap: break-word; word-break: break-word; }
          th { background: #f0f0f0; text-align: center; font-weight: bold; }
          td:nth-child(1) { width: 5%; text-align: center; }
          td:nth-child(2) { width: 10%; text-align: center; }
          td:nth-child(3) { width: 65%; }
          td:nth-child(4) { width: 10%; text-align: center; }
          tbody tr { height: 12px; }
          .signature { display: flex; justify-content: space-around; text-align: center; font-size: 9pt; margin-top: 12mm; }
          .signature div { width: 33%; }
          @media print { html, body { width: 279mm; height: 140mm; } button, input, select { display: none; } }
        </style></head>
        <body>
        <div class="header">
          <h2>CV TOTO ALUMINIUM MANUFACTURE</h2>
          <p>Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
          <h1 class="judul">SURAT JALAN</h1>
        </div>
        <div class="info">
          <div class="info-left"><p>Kepada Yth: <b>${customer}</b></p></div>
          <div class="info-right">
            <p>No. SJ: <b>${noSJ}</b></p>
            <p>No. Invoice: ${inv}</p>
            <p>Tanggal: ${tanggal}</p>
          </div>
        </div>
        ${tableContent} 
        <div class="signature">
          <div>Dibuat Oleh,<br><br><br>(..................)</div>
          <div>Pengirim,<br><br><br>(..................)</div>
          <div>Penerima,<br><br><br>(..................)</div>
        </div>
      </body></html>
    `);
    w.document.close();
    w.onload = () => { w.focus(); setTimeout(() => { w.print(); w.close(); }, 600); };
  },

  async loadItemsForColoring() {
    this.elements.warnaTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Memuat...</td></tr>';
    const now = new Date();
    const bulan = (this.elements.monthInput && this.elements.monthInput.value) ? parseInt(this.elements.monthInput.value) : (now.getMonth() + 1);
    const tahun = (this.elements.yearInput && this.elements.yearInput.value) ? parseInt(this.elements.yearInput.value) : now.getFullYear();
    try {
      // ✅ PERBAIKAN: Panggil App.api (sudah pakai authToken)
      const allItems = await App.api.getStatusBarang(bulan, tahun, '');
      
      const readyItems = (Array.isArray(allItems) ? allItems : []).filter(i => 
        i.di_produksi === 'true' && i.di_warna !== 'true'
      );
      this.state.itemsForColoring = readyItems;
      
      const q = (this.elements.customerSearchInput && this.elements.customerSearchInput.value) ? this.elements.customerSearchInput.value.trim().toLowerCase() : '';
      const filtered = q ? readyItems.filter(it => (it.nama_customer || '').toLowerCase().includes(q)) : readyItems;
      
      this.renderWarnaTable(filtered);
    } catch (error) {
      console.error('❌ loadItemsForColoring error:', error);
      if (error.message.includes("Sesi habis")) {
        this.elements.warnaTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Sesi tidak aktif.</td></tr>`;
      } else {
        this.elements.warnaTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
      }
    }
  },
  renderWarnaTable(items) {
    if (!items || items.length === 0) {
      this.elements.warnaTableBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center">Tidak ada barang siap warna.</td></tr>';
      this.elements.warnaPrintBtn.disabled = true; 
      return;
    }
    this.elements.warnaTableBody.innerHTML = items.map(item => `
      <tr data-id="${item.id}">
        <td class="p-2 text-center"><input type="checkbox" class="warna-check" value="${item.id}"></td>
        <td class="p-2 text-sm">${item.nama_customer || '-'}</td>
        <td class="p-2 text-sm">${item.deskripsi || '-'}</td>
        <td class="p-2 text-sm text-center">${(item.ukuran !== undefined) ? parseFloat(item.ukuran) : ''}</td>
        <td class="p-2 text-sm text-center">${(item.qty !== undefined) ? parseFloat(item.qty) : ''}</td>
      </tr>
    `).join('');
    this.elements.warnaTableBody.querySelectorAll('.warna-check').forEach(cb => {
      cb.addEventListener('change', () => this.updateWarnaPreview());
    });
    this.updateWarnaPreview();
  },
  updateWarnaPreview() {
    const checked = [...this.elements.warnaTableBody.querySelectorAll('input.warna-check:checked')];
    if (!checked || checked.length === 0) {
      this.elements.warnaPrintArea.innerHTML = `<p class="text-center text-gray-500">Preview akan muncul di sini...</p>`;
      this.elements.warnaPrintBtn.disabled = true; 
      return;
    }
    const selectedIds = checked.map(cb => parseInt(cb.value));
    const selectedItems = this.state.itemsForColoring.filter(i => selectedIds.includes(i.id));
    this.elements.warnaPrintBtn.disabled = false; 
    const vendorName = this.elements.vendorSelect.value || 'Belum dipilih';
    this.renderWarnaSJ('PREVIEW', vendorName, selectedItems);
  },
  renderWarnaSJ(no_sj, vendorName, items) {
    if (!items || items.length === 0) {
      this.elements.warnaPrintArea.innerHTML = "<p class='text-center text-red-500'>Tidak ada data barang.</p>";
      return;
    }
    const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    let totalQty = 0;
    const itemRows = items.map((item, index) => {
      const ukuranNet = (parseFloat(item.ukuran) > 0.2) ? (parseFloat(item.ukuran) - 0.2).toFixed(2) : '';
      const qty = parseFloat(item.qty) || 0;
      totalQty += qty;
      return `
      <tr>
        <td class="border text-center p-1">${index + 1}</td>
        <td class="border text-left p-1">${item.nama_customer || ''}</td>
        <td class="border text-left p-1">${item.deskripsi || ''}</td>
        <td class="border text-center p-1">${ukuranNet}</td>
        <td class="border text-center p-1">${qty || ''}</td>
      </tr>
    `;
    }).join('');
    this.elements.warnaPrintArea.innerHTML = `
    <div id="sj-warna-preview" style="font-family:'Courier New', monospace; font-size:10pt; color:#000;">
      <div style="text-align:center; border-bottom:1px solid #000; padding-bottom:4px; margin-bottom:6px;">
        <h2 style="margin:0; font-size:13pt; font-weight:bold;">CV TOTO ALUMINIUM MANUFACTURE</h2>
        <p style="margin:0; font-size:9pt;">Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
        <h1 style="margin:6px 0 0 0; font-size:14pt; font-weight:bold;">SURAT JALAN PEWARNAAN</h1>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:9pt; margin-bottom:4px;">
        <div style="flex:1;">
          <p style="margin:0;">Kepada Yth (Vendor Pewarnaan):</p>
          <p style="margin:0;">Nama: <b>${vendorName}</b></p>
        </div>
        <div style="text-align:right; flex:1;">
          <p style="margin:0;">No. SJ: <b>${no_sj}</b></p>
          <p style="margin:0;">Tanggal: ${tanggal}</p>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #000;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="border:1px solid #000; padding:3px;">No</th>
            <th style="border:1px solid #000; padding:3px;">Customer</th>
            <th style="border:1px solid #000; padding:3px;">Nama Barang / Deskripsi</th>
            <th style="border:1px solid #000; padding:3px;">Ukuran (Net)</th>
            <th style="border:1px solid #000; padding:3px;">Qty</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="border:1px solid #000; text-align:right; padding:3px; font-weight:bold;">TOTAL QTY:</td>
            <td style="border:1px solid #000; text-align:center; font-weight:bold;">${totalQty}</td>
          </tr>
        </tfoot>
      </table>
      <div style="display:flex; justify-content:space-around; text-align:center; font-size:9pt; margin-top:25mm;">
        <div style="flex:1;">Dibuat Oleh,<br><br><br><br>(..................)</div>
        <div style="flex:1;">Pengirim,<br><br><br><br>(..................)</div>
        <div style="flex:1;">Penerima,<br><br><br><br>(..................)</div>
      </div>
      <p style="text-align:right; font-size:8pt; margin-top:5mm; font-style:italic;">*Ukuran Net = Ukuran Asli - 0.2</p>
    </div>
    `;
  },
  printWarnaSJ() {
    const area = this.elements.warnaPrintArea;
    if (!area || !area.innerHTML.trim() || this.elements.warnaPrintBtn.disabled) {
      return alert("Tidak ada Surat Jalan Pewarnaan untuk dicetak atau item belum dipilih.");
    }
    const vendorName = this.elements.warnaPrintArea.querySelector("b")?.innerText || "Vendor Pewarnaan";
    const tableContent = this.elements.warnaPrintArea.querySelector("table")?.outerHTML || "<table><tr><td>Data tidak ditemukan</td></tr></table>";
    const noSJ = "SJW-" + Date.now();
    const tanggal = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    const w = window.open("", "_blank", "width=1200,height=700");
    w.document.write(`
        <html><head><title>Surat Jalan Pewarnaan</title><style>
          @page { size: 279mm 140mm landscape; margin: 5mm 10mm; }
          body { font-family: "Courier New", monospace; font-size: 10pt; ... }
          /* ... (sisa style Anda) ... */
        </style></head>
        <body>
          <div class="header">
            <h2>CV TOTO ALUMINIUM MANUFACTURE</h2>
            <p>Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
            <h1 class="judul">SURAT JALAN PEWARNAAN</h1>
          </div>
          <div class="info">
            <div class="info-left"><p>Kepada Yth: <b>${vendorName}</b></p></div>
            <div class="info-right">
              <p>No. SJ: <b>${noSJ}</b></p>
              <p>Tanggal: ${tanggal}</p>
            </div>
          </div>
          ${tableContent}
          <div class="signature">
            <div>Dibuat Oleh,<br><br><br>(..................)</div>
            <div>Pengirim,<br><br><br>(..................)</div>
            <div>Penerima,<br><br><br>(..................)</div>
          </div>
        </body></html>
    `);
    w.document.close();
    w.onload = () => { w.focus(); setTimeout(() => { w.print(); w.close(); }, 600); };
  },
};




App.pages['invoice'] = {
    state: { invoiceData: null },
    elements: {},
    init() {
        this.elements = {
            monthFilter: document.getElementById('invoice-month-filter'),
            yearFilter: document.getElementById('invoice-year-filter'),
            filterBtn: document.getElementById('filter-invoice-summary-btn'),
            totalCard: document.getElementById('total-invoice-card').querySelector('p'),
            paidCard: document.getElementById('paid-invoice-card').querySelector('p'),
            unpaidCard: document.getElementById('unpaid-invoice-card').querySelector('p'),
            searchInput: document.getElementById('invoice-search-input'),
            searchBtn: document.getElementById('invoice-search-btn'),
            catatanInput: document.getElementById('invoice-catatan'),
            printBtn: document.getElementById('invoice-print-btn'),
            printArea: document.getElementById('invoice-print-area'),
        };
        App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
        this.elements.filterBtn.addEventListener('click', () => this.loadSummary());
        this.elements.searchBtn.addEventListener('click', () => this.handleSearchInvoice());
        this.elements.printBtn.addEventListener('click', () => this.printInvoice());

    },
    load() {
        this.loadSummary();
    },
    async loadSummary() {
        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;
        this.elements.totalCard.textContent = 'Memuat...';
        this.elements.paidCard.textContent = 'Memuat...';
        this.elements.unpaidCard.textContent = 'Memuat...';
        try {
            const summary = await App.api.getInvoiceSummary(month, year);
            this.elements.totalCard.textContent = App.ui.formatCurrency(summary.total);
            this.elements.paidCard.textContent = App.ui.formatCurrency(summary.paid);
            this.elements.unpaidCard.textContent = App.ui.formatCurrency(summary.unpaid);
        } catch (error) {
            alert(`Gagal memuat ringkasan: ${error.message}`);
            this.elements.totalCard.textContent = 'Error';
            this.elements.paidCard.textContent = 'Error';
            this.elements.unpaidCard.textContent = 'Error';
        }
    },
    async handleSearchInvoice() {
        const inv = this.elements.searchInput.value.trim();
        if (!inv) return alert('Masukkan nomor invoice.');
        this.elements.printArea.innerHTML = '<p class="text-center p-4">Mencari data...</p>';
        this.elements.printBtn.disabled = true;
        try {
            const data = await App.api.getInvoiceData(inv);
            if (!data || data.length === 0) {
                throw new Error('Invoice tidak ditemukan.');
            }
            this.state.invoiceData = data;
            this.renderCustomerInvoice();
            this.elements.printBtn.disabled = false;
        } catch (error) {
            this.elements.printArea.innerHTML = `<p class="text-center p-4 text-red-500">${error.message}</p>`;
        }
    },
    renderCustomerInvoice() {
        if (!this.state.invoiceData || this.state.invoiceData.length === 0) {
            this.elements.printArea.innerHTML = '<p class="text-center text-red-500 p-8">Data invoice tidak ditemukan.</p>';
            return;
        }
        const data = this.state.invoiceData;
        const customer = data[0].nama_customer;
        const inv = data[0].no_inv;
        const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        let subtotal = 0;
        const itemRows = data.map((item, index) => {
            const qty = parseFloat(item.qty) || 0;
            const harga = parseFloat(item.harga) || 0;
            const ukuran = parseFloat(item.ukuran) || 0;
            const totalPerItem = qty * harga * ukuran;
            subtotal += totalPerItem;
            return `
                <tr class="item-row">
                    <td class="text-center">${index + 1}</td>
                    <td>${item.deskripsi}</td>
                    <td class="text-center">${qty}</td>
                    <td class="text-center">${ukuran}</td>
                    <td class="text-right">${App.ui.formatCurrency(harga)}</td>
                    <td class="text-right">${App.ui.formatCurrency(totalPerItem)}</td>
                </tr>
            `;
        }).join('');
        this.elements.printArea.innerHTML = `
            <div class="invoice-box">
                <header>
                    <div class="invoice-header">
                        <div>
                            <h1 class="company-name">CV TOTO ALUMINIUM MANUFACTURE</h1>
                            <p class="company-details">
                                Jl. Raya Mulya No.3 RT 001/002, Mustikajaya<br>
                                Bekasi, Indonesia 17158<br>
                                Telepon: 0813 1191 2002 | Email: totoalumuniummnf@gmail.com
                            </p>
                        </div>
                        <div class="invoice-title">INVOICE</div>
                    </div>
                    <div class="invoice-meta">
                        <div>
                            <span class="meta-label">Bill To:</span>
                            <span class="meta-value customer-name">${customer}</span>
                        </div>
                        <div>
                            <span class="meta-label">Invoice #:</span>
                            <span class="meta-value">${inv}</span>
                        </div>
                        <div>
                            <span class="meta-label">Date:</span>
                            <span class="meta-value">${tanggal}</span>
                        </div>
                    </div>
                </header>
                <main>
                    <table class="invoice-table">
                        <thead>
                            <tr>
                                <th class="text-center w-12">#</th>
                                <th>Deskripsi</th>
                                <th class="text-center w-20">Qty</th>
                                <th class="text-center w-20">Ukuran</th>
                                <th class="text-right w-32">Harga Satuan</th>
                                <th class="text-right w-32">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody>${itemRows}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="5" class="text-right total-label">Subtotal</td>
                                <td class="text-right total-value">${App.ui.formatCurrency(subtotal)}</td>
                            </tr>
                            <tr class="total-row">
                                <td colspan="5" class="text-right total-label">Total</td>
                                <td class="text-right total-value">${App.ui.formatCurrency(subtotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </main>
                <footer>
                    <div class="invoice-notes">
                        <strong>Catatan:</strong> ${this.elements.catatanInput.value || 'Terima kasih atas kepercayaan Anda.'}
                    </div>
                    <div class="invoice-footer">
                        <p>Mohon lakukan pembayaran ke rekening berikut:</p>
                        <p><strong>BCA 841-606-0148 a/n Yanto</strong></p>
                    </div>
                </footer>
            </div>
        `;
    },

    printInvoice() {
    const printArea = this.elements.printArea;
    if (!printArea || !printArea.innerHTML.trim()) {
        alert("Tidak ada invoice untuk dicetak. Silakan cari invoice terlebih dahulu.");
        return;
    }

    const invoiceHTML = printArea.innerHTML;
    const printWindow = window.open('', '', 'width=900,height=650');

    printWindow.document.write(`
        <html>
            <head>
                <title>Invoice - Toto Aluminium Manufacture</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    body {
                        font-family: 'Arial', sans-serif;
                        font-size: 10pt;
                        color: #000;
                        margin: 0;
                        padding: 0;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        margin: 0;
                        padding: 0;
                    }
                    .invoice-box {
                        width: 100%;
                        padding: 15px;
                        box-sizing: border-box;
                    }
                    .invoice-header {
                        display: flex;
                        justify-content: space-between;
                        border-bottom: 2px solid #000;
                        padding-bottom: 8px;
                        margin-bottom: 15px;
                    }
                    .company-name {
                        font-size: 16pt;
                        font-weight: bold;
                    }
                    .invoice-title {
                        font-size: 22pt;
                        font-weight: bold;
                        text-align: right;
                    }
                    .invoice-meta {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 10px;
                        font-size: 10pt;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-top: 10px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 6px;
                        text-align: left;
                    }
                    th {
                        background: #f3f3f3;
                    }
                    .total-row td {
                        border-top: 2px solid #000;
                        font-weight: bold;
                    }
                    .invoice-notes {
                        margin-top: 20px;
                        font-size: 9pt;
                    }
                    .invoice-footer {
                        margin-top: 30px;
                        text-align: center;
                        font-size: 9pt;
                        page-break-inside: avoid;
                    }
                </style>
            </head>
            <body>
                ${invoiceHTML}
                <script>window.onload = () => window.print();<\/script>
            </body>
        </html>
    `);

    printWindow.document.close();
},



};



App.pages['quotation'] = {
    state: {
        itemCounter: 0
    },
    elements: {},
    init() {
        this.elements = {
            customerInput: document.getElementById('quote-customer'),
            perihalInput: document.getElementById('quote-perihal'),
            catatanInput: document.getElementById('quote-catatan'),
            tableBody: document.getElementById('quote-items-table-body'),
            addItemBtn: document.getElementById('add-quote-item-btn'),
            generateBtn: document.getElementById('generate-quote-btn'),
            printArea: document.getElementById('quotation-print-area')
        };
        this.elements.addItemBtn.addEventListener('click', () => this.addNewItemRow());
        this.elements.generateBtn.addEventListener('click', () => this.generateAndPrintQuote());
        this.elements.tableBody.addEventListener('input', (e) => this.handleTableEvents(e));
        this.elements.tableBody.addEventListener('click', (e) => this.handleTableEvents(e));
        this.addNewItemRow(); // Tambah satu baris kosong saat halaman dimuat
    },
    load() {
        // Tidak ada data yang perlu dimuat dari server untuk halaman ini
    },
    addNewItemRow() {
        this.state.itemCounter++;
        const rowId = `item-row-${this.state.itemCounter}`;
        const newRow = document.createElement('tr');
        newRow.id = rowId;
        newRow.classList.add('item-row');
        newRow.innerHTML = `
            <td class="px-4 py-2"><input type="text" name="deskripsi" class="w-full border-gray-300 rounded-md shadow-sm" placeholder="Nama item..."></td>
            <td class="px-4 py-2"><input type="number" name="ukuran" class="w-full border-gray-300 rounded-md shadow-sm" placeholder="0"></td>
            <td class="px-4 py-2"><input type="number" name="qty" class="w-full border-gray-300 rounded-md shadow-sm" placeholder="0"></td>
            <td class="px-4 py-2"><input type="number" name="harga" class="w-full border-gray-300 rounded-md shadow-sm" placeholder="0"></td>
            <td class="px-4 py-2 text-right text-sm font-medium text-gray-700 total-per-item">${App.ui.formatCurrency(0)}</td>
            <td class="px-4 py-2 text-center"><button class="delete-item-btn text-red-500 hover:text-red-700">✖</button></td>
        `;
        this.elements.tableBody.appendChild(newRow);
    },
    handleTableEvents(e) {
        if (e.target.classList.contains('delete-item-btn')) {
            e.target.closest('tr').remove();
            this.calculateTotals();
        }
        if (e.target.tagName === 'INPUT') {
            const row = e.target.closest('tr');
            const ukuran = parseFloat(row.querySelector('[name="ukuran"]').value) || 0;
            const qty = parseFloat(row.querySelector('[name="qty"]').value) || 0;
            const harga = parseFloat(row.querySelector('[name="harga"]').value) || 0;
            const totalCell = row.querySelector('.total-per-item');
            totalCell.textContent = App.ui.formatCurrency(ukuran * qty * harga);
        }
    },
    generateAndPrintQuote() {
        this.renderQuotationPreview();
        setTimeout(() => App.ui.printElement('quotation-print-area'), 100);
    },
renderQuotationPreview() {
    const customer = this.elements.customerInput.value || '[Nama Pelanggan]';
    const perihal = this.elements.perihalInput.value || '[Perihal Penawaran]';
    const catatan = this.elements.catatanInput.value || 'Harga berlaku 14 hari sejak penawaran ini dibuat.';
    const tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    let subtotal = 0;

    // Loop untuk membuat baris item
    let itemRows = '';
    this.elements.tableBody.querySelectorAll('tr.item-row').forEach((row, index) => {
        const deskripsi = row.querySelector('[name="deskripsi"]').value || '-';
        const ukuran = parseFloat(row.querySelector('[name="ukuran"]').value) || 0;
        const qty = parseFloat(row.querySelector('[name="qty"]').value) || 0;
        const harga = parseFloat(row.querySelector('[name="harga"]').value) || 0;
        const totalPerItem = ukuran * qty * harga;
        subtotal += totalPerItem;

        itemRows += `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td>${deskripsi}</td>
                <td class="text-center">${qty}</td>
                <td class="text-center">${ukuran}</td>
                <td class="text-right">${App.ui.formatCurrency(harga)}</td>
                <td class="text-right">${App.ui.formatCurrency(totalPerItem)}</td>
            </tr>
        `;
    });

    // Generate HTML lengkap quotation dengan struktur baru
    this.elements.printArea.innerHTML = `
        <div id="quotation-document">
            
            <!-- HEADER -->
            <div class="quotation-header">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h1 class="company-name">CV TOTO ALUMINIUM MANUFACTURE</h1>
                        <p class="company-details">
                            Jl. Raya Mulya No.3 RT 001/002, Mustikajaya<br>
                            Bekasi, Indonesia 17158<br>
                            Telepon: 0813 1191 2002 | Email: totoaluminiummnf@gmail.com
                        </p>
                    </div>
                    <div class="invoice-title" style="font-size: 28pt; font-weight: bold;">QUOTATION</div>
                </div>
                <hr style="border: 1px solid #000; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between;">
                    <div>
                        <strong>Kepada Yth:</strong> ${customer}<br>
                        <strong>Tanggal:</strong> ${tanggal}
                    </div>
                    <div style="text-align: right;">
                        <strong>Nomor:</strong> QTO/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}<br>
                        <strong>Perihal:</strong> ${perihal}
                    </div>
                </div>
            </div>

            <!-- ISI / CONTENT -->
            <div class="quotation-content">
                <table class="invoice-table" style="width:100%; border-collapse: collapse; margin-top: 15px;">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 5%;">#</th>
                            <th>Deskripsi</th>
                            <th class="text-center" style="width: 10%;">Qty</th>
                            <th class="text-center" style="width: 10%;">Ukuran</th>
                            <th class="text-right" style="width: 15%;">Harga Satuan</th>
                            <th class="text-right" style="width: 15%;">Jumlah</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="text-right total-label">Subtotal</td>
                            <td class="text-right total-value">${App.ui.formatCurrency(subtotal)}</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="5" class="text-right total-label">Total</td>
                            <td class="text-right total-value">${App.ui.formatCurrency(subtotal)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div style="margin-top: 20px;">
                    <strong>Syarat & Ketentuan:</strong><br>
                    ${catatan.replace(/\n/g, '<br>')}
                </div>
            </div>

            <!-- FOOTER -->
            <div class="quotation-footer">
                <p>Hormat kami,</p>
                <div style="height: 60px;"></div>
                <p><strong>(___________________)</strong><br>CV Toto Aluminium Manufacture</p>
            </div>
        </div>
    `;
}
};


App.pages['keuangan'] = {
    state: {},
    elements: {},
    
    init() {
        // 🧭 Kumpulkan semua elemen DOM
        this.elements = {
            // Saldo
            saldo: {
                1: document.getElementById('saldo-bca-toto'),
                2: document.getElementById('saldo-bca-yanto'),
                3: document.getElementById('saldo-cash'),
                total: document.getElementById('saldo-total')
            },

            // Form
            form: document.getElementById('keuangan-form'),
            tanggal: document.getElementById('transaksi-tanggal'),
            jumlah: document.getElementById('transaksi-jumlah'),
            tipe: document.getElementById('transaksi-tipe'),
            kas: document.getElementById('transaksi-kas'),
            keterangan: document.getElementById('transaksi-keterangan'),

            // Filter
            filterMonth: document.getElementById('keuangan-month-filter'),
            filterYear: document.getElementById('keuangan-year-filter'),
            filterBtn: document.getElementById('filter-keuangan-btn'),

            // Tabel
            tableBody: document.getElementById('riwayat-keuangan-table-body'),
        };

        // 🧭 Inisialisasi nilai default
        this.elements.tanggal.value = new Date().toISOString().split('T')[0];
        App.ui.populateDateFilters(this.elements.filterMonth, this.elements.filterYear);

        // 🧭 Pasang event listener
        this.elements.form?.addEventListener('submit', (e) => this.handleSaveTransaksi(e));
        this.elements.filterBtn?.addEventListener('click', () => this.load());
        this.elements.filterTanggalBtn?.addEventListener("click", () => this.filterByTanggal());
    },

    async load() {
        const month = this.elements.filterMonth.value;
        const year = this.elements.filterYear.value;

        // Tampilkan loading state
        Object.values(this.elements.saldo).forEach(el => el.textContent = 'Memuat...');
        this.elements.tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-8 text-center text-gray-500">
                    Memuat riwayat...
                </td>
            </tr>`;

        try {
            // 🚀 Ambil saldo & riwayat paralel
            const [saldoData, riwayatData] = await Promise.all([
                App.api.getSaldoKeuangan(),
                App.api.getRiwayatKeuangan(month, year)
            ]);

            this.renderSaldo(saldoData);
            this.renderRiwayat(riwayatData);

        } catch (error) {
            console.error('[Load Error]', error);
            this.elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-red-500">
                        Gagal memuat data: ${error.message}
                    </td>
                </tr>`;
        }
    },

    renderSaldo(data) {
        let total = 0;

        data.forEach(kas => {
            const saldo = parseFloat(kas.saldo) || 0;
            total += saldo;

            if (this.elements.saldo[kas.id]) {
                this.elements.saldo[kas.id].textContent = App.ui.formatCurrency(saldo);
            }
        });

        this.elements.saldo.total.textContent = App.ui.formatCurrency(total);
    },

    renderRiwayat(items) {
        if (!items || items.length === 0) {
            this.elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-gray-500">
                        Tidak ada riwayat transaksi untuk periode ini.
                    </td>
                </tr>`;
            return;
        }

        this.elements.tableBody.innerHTML = items.map(item => {
            const isPemasukan = item.tipe === 'PEMASUKAN';
            const tipeClass = isPemasukan ? 'text-green-600 font-medium' : 'text-red-600 font-medium';
            const formattedDate = new Date(item.tanggal)
                .toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

            return `
                <tr class="text-sm">
                    <td class="px-6 py-4 whitespace-nowrap text-gray-700">${formattedDate}</td>
                    <td class="px-6 py-4 text-gray-900">${item.keterangan}</td>
                    <td class="px-6 py-4 text-gray-600">${item.nama_kas}</td>
                    <td class="px-6 py-4 ${tipeClass}">${item.tipe}</td>
                    <td class="px-6 py-4 text-right ${tipeClass}">
                        ${isPemasukan ? '+' : '-'} ${App.ui.formatCurrency(item.jumlah)}
                    </td>
                </tr>
            `;
        }).join('');
    },

    async handleSaveTransaksi(e) {
        e.preventDefault();

        const data = {
            tanggal: this.elements.tanggal.value,
            jumlah: this.elements.jumlah.value,
            tipe: this.elements.tipe.value,
            kas_id: this.elements.kas.value,
            keterangan: this.elements.keterangan.value,
        };

        if (!data.tanggal || !data.jumlah || !data.keterangan) {
            return this.showToast('Harap isi semua kolom wajib.', 'error');
        }

        if (isNaN(data.jumlah) || Number(data.jumlah) <= 0) {
            return this.showToast('Nominal tidak valid.', 'error');
        }

        try {
            await App.api.addTransaksiKeuangan(data);
            this.showToast('Transaksi berhasil disimpan!', 'success');
            this.elements.form.reset();
            this.elements.tanggal.value = new Date().toISOString().split('T')[0];
            this.load();

        } catch (error) {
            console.error('[Save Error]', error);
            this.showToast(`Gagal menyimpan: ${error.message}`, 'error');
        }
    },

    // 🔔 Fungsi notifikasi kecil (ganti alert)
    showToast(message, type = 'info') {
        const bg = type === 'success' ? 'bg-green-600' :
                   type === 'error' ? 'bg-red-600' : 'bg-gray-800';

        const toast = document.createElement('div');
        toast.className = `${bg} text-white px-4 py-2 rounded-md fixed top-5 right-5 shadow-lg z-50 animate-fadeIn`;
        toast.textContent = message;

        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('animate-fadeOut');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
};

App.pages['profil'] = {
    state: {},
    elements: {},
    init() {
        this.elements = {
            notification: document.getElementById('notification'),
            notificationMessage: document.getElementById('notification-message'),
            
            profileForm: document.getElementById('update-profile-form'),
            usernameInput: document.getElementById('username'),
            pictureInput: document.getElementById('profile-picture-input'),
            previewImage: document.getElementById('profile-preview'),
            
            passwordForm: document.getElementById('change-password-form'),
            oldPasswordInput: document.getElementById('old-password'),
            newPasswordInput: document.getElementById('new-password'),
            confirmPasswordInput: document.getElementById('confirm-password'),
        };

        this.elements.pictureInput.addEventListener('change', (e) => this.handlePreview(e));
        this.elements.profileForm.addEventListener('submit', (e) => this.handleProfileSave(e));
        this.elements.passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    },
    async load() {
        try {
            const user = await App.api.getCurrentUser();
            this.state.currentUser = user;
            this.elements.usernameInput.value = user.username;
            if (user.profile_picture_url) {
                this.elements.previewImage.src = user.profile_picture_url;
            }
        } catch (error) {
            this.showNotification(`Gagal memuat data profil: ${error.message}`, 'error');
        }
    },
    handlePreview(e) {
        const file = e.target.files[0];
        if (file) {
            this.elements.previewImage.src = URL.createObjectURL(file);
        }
    },
    async handleProfileSave(e) {
        e.preventDefault();
        const formData = new FormData();
        formData.append('username', this.elements.usernameInput.value);
        
        const file = this.elements.pictureInput.files[0];
        if (file) {
            formData.append('profilePicture', file);
        }
        
        try {
            await App.api.updateUserProfile(formData);
            this.showNotification('Profil berhasil diperbarui!', 'success');
            // Reload layout untuk update header
            await App.loadLayout();
        } catch (error) {
            this.showNotification(`Gagal menyimpan profil: ${error.message}`, 'error');
        }
    },
    async handlePasswordChange(e) {
        e.preventDefault();
        const oldPassword = this.elements.oldPasswordInput.value;
        const newPassword = this.elements.newPasswordInput.value;
        const confirmPassword = this.elements.confirmPasswordInput.value;

        if (newPassword !== confirmPassword) {
            this.showNotification('Password baru dan konfirmasi tidak cocok.', 'error');
            return;
        }

        try {
            const response = await App.api.changePassword({ oldPassword, newPassword });
            this.showNotification(response.message, 'success');
            this.elements.passwordForm.reset();
        } catch (error) {
            this.showNotification(`Gagal mengubah password: ${error.message}`, 'error');
        }
    },
    showNotification(message, type = 'success') {
        this.elements.notificationMessage.textContent = message;
        this.elements.notification.className = `p-4 mb-4 text-sm rounded-lg ${type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
        this.elements.notification.classList.remove('hidden');
        setTimeout(() => {
            this.elements.notification.classList.add('hidden');
        }, 5000);
    },
};

// =====================================================================
//  ADMIN - MANAJEMEN LANGGANAN USER (khusus Faisal)
// =====================================================================
App.pages['admin-subscription'] = {
    async load() {
        try {
            // 🔒 Ambil token login
            const token = localStorage.getItem('authToken');
            if (!token) {
                alert('Sesi kamu telah berakhir. Silakan login ulang.');
                window.location.href = 'index.html';
                return;
            }

            // 🔍 Cek apakah token masih valid
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const now = Date.now() / 1000;
                if (payload.exp < now) {
                    alert('Sesi kamu telah berakhir. Silakan login ulang.');
                    localStorage.removeItem('authToken');
                    window.location.href = 'index.html';
                    return;
                }
            } catch {
                alert('Token tidak valid. Silakan login ulang.');
                window.location.href = 'index.html';
                return;
            }

            // 🔒 Cek siapa user yang sedang login
            let currentUser = null;
            try {
                const resUser = await App.api.request('/api/me');
                currentUser = resUser?.username?.toLowerCase() || '';
            } catch {
                const localUser =
                    JSON.parse(localStorage.getItem('userData')) ||
                    JSON.parse(localStorage.getItem('user')) || {};
                currentUser = (localUser.username || localUser.name || '').toLowerCase();
            }

            // 🚫 Jika bukan Faisal, tolak akses
            if (currentUser !== 'faisal') {
                document.body.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-screen text-center">
                        <h1 class="text-3xl font-semibold text-red-600 mb-4">Akses Ditolak</h1>
                        <p class="text-gray-700 text-lg mb-6">
                            Halaman ini hanya bisa diakses oleh Admin (Faisal).
                        </p>
                        <a href="dashboard.html" class="px-5 py-3 bg-[#8B5E34] text-white rounded-md hover:bg-[#A67B5B] transition">
                            Kembali ke Dashboard
                        </a>
                    </div>
                `;
                return;
            }

            // 🔁 Ambil data user (PASTIKAN KIRIM TOKEN)
            const res = await fetch('https://erptoto.up.railway.app/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Gagal memuat data user.');
            const users = await res.json();

            const tbody = document.getElementById('subscription-table-body');
            tbody.innerHTML = '';

            // Hanya tampilkan user dengan role "user"
            const userList = users.filter(u => u.role === 'user');

            if (userList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">Belum ada user terdaftar.</td></tr>`;
                return;
            }

            // 🧾 Buat tabel user
            userList.forEach(u => {
                const tr = document.createElement('tr');
                const isActive = u.subscription_status === 'active';

                tr.innerHTML = `
                    <td class="px-6 py-4 text-gray-800">${u.name}</td>
                    <td class="px-6 py-4 text-gray-700">${u.phone_number || '-'}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="px-3 py-1 rounded-full text-sm font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <button data-id="${u.id}" data-status="${u.subscription_status}" 
                            class="toggle-sub-btn px-4 py-2 rounded-md text-white font-semibold ${
                                isActive 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-green-600 hover:bg-green-700'
                            }">
                            ${isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // ⚙️ Event listener tombol toggle
            document.querySelectorAll('.toggle-sub-btn').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const id = e.target.dataset.id;
                    const status = e.target.dataset.status;
                    const newStatus = status === 'active' ? 'inactive' : 'active';

                    const confirmMsg = newStatus === 'active' 
                        ? 'Aktifkan langganan user ini?' 
                        : 'Nonaktifkan langganan user ini?';
                    if (!confirm(confirmMsg)) return;

                    try {
                        const res = await fetch(`https://erptoto.up.railway.app/api/admin/users/${id}/activate`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}` 
                            },
                            body: JSON.stringify({ status: newStatus })
                        });

                        if (res.ok) {
                            alert('Status langganan berhasil diperbarui.');
                            this.load(); // refresh tabel
                        } else {
                            alert('Gagal memperbarui status.');
                        }
                    } catch (err) {
                        console.error('Error:', err);
                        alert('Terjadi kesalahan server.');
                    }
                });
            });

        } catch (err) {
            console.error(err);
            document.getElementById('subscription-table-body').innerHTML = `
                <tr><td colspan="4" class="text-center py-6 text-red-500">Gagal memuat data langganan.</td></tr>
            `;
        }
    }
};



// ===================================
// Fungsi Utama Aplikasi
// ===================================
// ======================================================
// 🔐 SISTEM LOGIN & TOKEN (versi sinkron penuh)
// ======================================================

App.getUserFromToken = function() {
    // ✅ Ambil token dari sessionStorage (bukan localStorage lagi)
const token = localStorage.getItem('authToken');    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (e) {
        console.error('Gagal membaca payload token:', e);
        return null;
    }
};

// 🔰 Helper tambahan untuk ambil user secara aman
App.safeGetUser = async function() {
    try {
        const user = await App.api.getCurrentUser();
        return user;
    } catch {
        alert('Sesi kamu sudah habis. Silakan login ulang.');
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
        return null;
    }
};

// ======================================================
// 🧱 LOAD LAYOUT (sidebar + header)
// ======================================================
App.loadLayout = async function() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;

    try {
        const [sidebarRes, headerRes] = await Promise.all([
            fetch('components/_sidebar.html'),
            fetch('components/_header.html')
        ]);
        if (!sidebarRes.ok || !headerRes.ok) throw new Error('Gagal memuat komponen layout.');

        document.getElementById('sidebar').innerHTML = await sidebarRes.text();
        document.getElementById('header-container').innerHTML = await headerRes.text();

        this.elements = {
            ...this.elements,
            sidebar: document.getElementById('sidebar'),
            sidebarNav: document.getElementById('sidebar-nav'),
            logoutButton: document.getElementById('logout-button'),
            userDisplay: document.getElementById('user-display'),
            userAvatar: document.getElementById('user-avatar'),
            pageTitle: document.getElementById('page-title'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        };

        // 🔘 Tambahkan event listener
        if (this.elements.logoutButton)
            this.elements.logoutButton.addEventListener('click', this.handlers.handleLogout);
        if (this.elements.sidebarNav)
            this.elements.sidebarNav.addEventListener('click', this.handlers.handleNavigation);
        if (this.elements.sidebarToggleBtn)
            this.elements.sidebarToggleBtn.addEventListener('click', this.handlers.handleSidebarToggle);

        // 🧍‍♂️ Ambil data user dari token
        const user = await App.safeGetUser();
        if (user) {
            this.elements.userDisplay.textContent = `Welcome, ${user.username}`;
            if (user.profile_picture_url) {
                this.elements.userAvatar.src = user.profile_picture_url;
                this.elements.userAvatar.classList.remove('hidden');
            } else {
                this.elements.userAvatar.classList.add('hidden');
            }
        }

        // 🔖 Highlight link aktif di sidebar
        const path = window.location.pathname.split('/').pop();
        const activeLink = document.querySelector(`#sidebar-nav a[href="${path}"]`);
        if (activeLink) {
            this.elements.pageTitle.textContent = activeLink.textContent.trim();
            activeLink.classList.add('active');
            const parentMenu = activeLink.closest('.collapsible');
            if (parentMenu) {
                parentMenu.querySelector('.sidebar-item').classList.add('active');
                parentMenu.querySelector('.submenu').classList.remove('hidden');
                parentMenu.querySelector('.submenu-toggle').classList.add('rotate-180');
            }
        }
    } catch (error) {
        console.error('Gagal memuat layout:', error);
    }
};

// ==========================================================
// 🧭 HANDLERS: LOGIN, LOGOUT, NAVIGATION
// ==========================================================
App.handlers = {
  // ... (fungsi handleLogin Anda di sini) ...
  async handleLogin(e) {
    e.preventDefault();
    try {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      if (!username || !password) throw new Error("Username dan password wajib diisi.");

      const response = await App.api.checkLogin(username, password);
      if (response && response.token) {
        App.setToken(response.token);
        localStorage.setItem("username", response.user.username);
        localStorage.setItem("role", response.user.role);
        window.location.href = "dashboard.html";
      } else {
        throw new Error("Login gagal. Token tidak diterima.");
      }
    } catch (err) {
      const el = document.getElementById("login-error");
      el.textContent = err.message;
      el.classList.remove("hidden");
    }
  },

  // ... (fungsi handleLogout Anda di sini) ...
  handleLogout() {
    App.clearToken();
    // Peningkatan: Gunakan removeItem agar tidak menghapus data lain
    localStorage.removeItem('authToken'); 
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    // localStorage.clear(); // <-- Ini terlalu berisiko
    window.location.href = "index.html";
  },

  // ------------------------------------------------------
  // 🧭 NAVIGASI SIDEBAR (PINDAHKAN KE DALAM SINI)
  // ------------------------------------------------------
  handleNavigation(e) {
    const link = e.target.closest("a");
    if (!link || link.getAttribute("href") === "#") return;
    e.preventDefault();

    const parentCollapsible = link.closest(".collapsible");
    if (parentCollapsible && link.classList.contains("sidebar-item")) {
      const submenu = parentCollapsible.querySelector(".submenu");
      const submenuToggle = parentCollapsible.querySelector(".submenu-toggle");
      if (submenu) submenu.classList.toggle("hidden");
      if (submenuToggle) submenuToggle.classList.toggle("rotate-180");
    } else {
      const href = link.getAttribute("href");
      if (href && href.endsWith(".html")) window.location.href = href;
    }
  },

  // ------------------------------------------------------
  // 📱 TOGGLE SIDEBAR (Mobile) (PINDAHKAN KE DALAM SINI)
  // ------------------------------------------------------
  handleSidebarToggle() {
    const container = document.getElementById("app-container");
    if (container) container.classList.toggle("sidebar-collapsed");
  },
  
}; // <-- HANYA SATU KURUNG PENUTUP DI SINI

// ======================================================
// 🚀 INISIALISASI APP (FUNGSI UTAMA - FINAL STABLE)
// ======================================================
App.init = async function () {
  const path = window.location.pathname.split("/").pop() || "index.html";
  console.log("📄 Halaman aktif:", path);

  // --------------------------------------------------
  // 🟢 HALAMAN LOGIN
  // --------------------------------------------------
  if (path === "index.html" || path === "") {
    const validToken = App.getToken();
    if (validToken) {
      console.log("✅ Token masih valid, langsung ke dashboard.");
      window.location.href = "dashboard.html";
      return;
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      console.log("📋 Menunggu user login...");
      loginForm.addEventListener("submit", App.handlers.handleLogin);
    }
    return;
  }

  // --------------------------------------------------
  // 🔒 CEK TOKEN UNTUK HALAMAN LAIN
  // --------------------------------------------------
  const token = App.getToken();
  if (!token) {
    console.warn("🚫 Token hilang atau kadaluarsa, arahkan ke login...");
    window.location.href = "index.html";
    return;
  }

  // --------------------------------------------------
  // 🧱 MUAT LAYOUT (Sidebar + Header)
  // --------------------------------------------------
  await App.loadLayout();
  await App.adminMenuCheck?.();

  // --------------------------------------------------
  // ⚙️ INISIALISASI HALAMAN SPESIFIK
  // --------------------------------------------------
  const pageName = path.replace(".html", "");
  console.log("📄 Memuat halaman:", pageName);

  if (App.pages[pageName]?.init) {
    console.log(`⚙️ Jalankan init() untuk ${pageName}`);
    App.pages[pageName].init();
  }

  const usesTabulator = pageName === "work-orders";
  if (App.pages[pageName]?.load && !usesTabulator) {
    console.log(`📥 Jalankan load() untuk ${pageName}`);
    App.pages[pageName].load();
  } else if (usesTabulator) {
    console.log(
      "⏳ Halaman Tabulator terdeteksi, load() akan dipicu oleh tombol Filter."
    );
  }
};

// ============================================================
// 🔐 HELPER (Token Reader, User Loader, Admin Menu Check)
// ============================================================
App.getUserFromToken = function () {
  const token = App.getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload;
  } catch (e) {
    console.error("Gagal membaca payload token:", e);
    return null;
  }
};

App.safeGetUser = async function () {
  try {
    const user = await App.api.getCurrentUser();
    return user;
  } catch {
    alert("Sesi kamu sudah habis. Silakan login ulang.");
    App.clearToken();
    window.location.href = "index.html";
    return null;
  }
};

App.adminMenuCheck = async function () {
  try {
    let username = "";
    try {
      const user = await App.api.getCurrentUser();
      username = (user?.username || "").toLowerCase();
    } catch {
      username = (localStorage.getItem("username") || "").toLowerCase();
    }

    const adminMenu = document.getElementById("admin-menu");
    if (!adminMenu) {
      console.warn("Elemen #admin-menu tidak ditemukan.");
      return;
    }

    if (username !== "faisal") {
      adminMenu.style.display = "none";
      console.log("🔒 Menu Admin disembunyikan untuk user:", username);
    } else {
      console.log("✅ Menu Admin aktif untuk Faisal");
    }
  } catch (err) {
    console.error("Gagal memeriksa user login:", err);
  }
};

// ======================================================
// 🚀 MULAI APLIKASI
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
