

const App = {
    state: {},
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
        'profil': {} // Ditambahkan
    },
};

// ==========================================================
// 🚀 APP.API — Semua komunikasi frontend ke backend
// ==========================================================
App.api = {
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : "https://erptoto.up.railway.app", // <- perbaikan utama

// ------------------------------
// FUNGSI DASAR REQUEST (AUTO REFRESH TOKEN)
// ------------------------------
async request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith("/api/")
    ? endpoint
    : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const url = `${this.baseUrl}${cleanEndpoint}`;
  let token = localStorage.getItem("authToken");

  const defaultHeaders = { "Content-Type": "application/json" };
  if (token) defaultHeaders["Authorization"] = `Bearer ${token}`;

  const opts = {
    method: options.method || "GET",
    headers: { ...defaultHeaders, ...(options.headers || {}) },
  };

  // ✅ hanya stringify bila body masih object
  if (options.body) {
    if (typeof options.body === "string") {
      opts.body = options.body;
    } else {
      opts.body = JSON.stringify(options.body);
    }
  }

  try {
    let res = await fetch(url, opts);

    // 🔁 Auto refresh token
    if (res.status === 401 || res.status === 403) {
      console.warn("⚠️ Token expired, mencoba refresh...");
      const refreshRes = await fetch(`${this.baseUrl}/api/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const newToken = data.token;
        if (!newToken) throw new Error("Token refresh gagal.");

        localStorage.setItem("authToken", newToken);
        token = newToken;

        opts.headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, opts);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        alert("Sesi login kamu sudah habis. Silakan login ulang.");
        localStorage.removeItem("authToken");
        window.location.href = "index.html";
        return;
      }
    }

    if (!res.ok) {
      console.error(`❌ API Error: ${res.status} - ${res.statusText}`);
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("❌ Fetch gagal:", err, "URL:", url);
    throw err;
  }
},

markWorkOrdersPrinted: async function(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0)
        throw new Error('ids harus array dan tidak kosong.');

    const token = localStorage.getItem('authToken') || '';
    const url = (App.api.baseUrl || '') + '/api/workorders/mark-printed';

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ ids })
    });

    if (!res.ok) {
        let body = {};
        try { body = await res.json(); } catch (e) { /* nothing */ }
        const serverMsg = body && body.message ? body.message : `HTTP ${res.status}`;
        const error = new Error('Gagal mark printed: ' + serverMsg);
        error.status = res.status;
        error.body = body;
        throw error;
    }

    return res.json();
}, // ✅ ubah titik koma ini menjadi koma

getWorkOrdersByTanggal(month, year, tanggal) {
    return this.request(`/api/workorders/by-date?month=${month}&year=${year}&tanggal=${tanggal}`);
},



  // ------------------------------
  // WORK ORDERS API
  // ------------------------------
  async getWorkOrders(month, year, extraParams = {}) {
    const params = new URLSearchParams();
    params.append("month", month);
    params.append("year", year);

    if (extraParams.customer)
      params.append("customer", String(extraParams.customer));
    if (extraParams.status)
      params.append("status", String(extraParams.status));

    if (extraParams.offset !== undefined)
      params.append("offset", String(extraParams.offset));
    if (extraParams.limit !== undefined)
      params.append("limit", String(extraParams.limit));

    const query = params.toString();
    return await this.request(`/workorders?${query}`);
  },

  async getWorkOrdersChunk(month, year, offset = 0, limit = 500) {
    const params = new URLSearchParams({
      month: String(month),
      year: String(year),
      offset: String(offset),
      limit: String(limit),
    });
    return await this.request(`/workorders?${params.toString()}`);
  },

async addWorkOrder(payload) {
  // 🔧 Normalisasi agar sesuai dengan field backend
  const normalized = {
    tanggal: (() => {
      const raw = payload.tanggal || new Date();
      if (typeof raw === "string" && raw.includes("/")) {
        const [d, m, y] = raw.split("/");
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      return new Date(raw).toISOString().slice(0, 10);
    })(),
    nama_customer: payload.nama_customer || payload.customer || "Tanpa Nama",
    deskripsi: payload.deskripsi || payload.DESKRIPSI || "",
    ukuran: payload.ukuran || payload.UKURAN || null,
    qty: payload.qty || payload.QTY || null,
  };

  console.log("🚀 Data dikirim ke backend:", normalized);

  return await this.request("/workorders", {
    method: "POST",
    body: normalized,
  });
},



  async updateWorkOrderPartial(id, payload) {
    return await this.request(`/workorders/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },

  async deleteWorkOrder(id) {
    return await this.request(`/workorders/${id}`, {
      method: "DELETE",
    });
  },

  

  // ===================================
  // SEMUA FUNGSI HELPER (Sudah Benar)
  // ===================================

  checkLogin(username, password) { return this.request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }); },
    
  // API Profil & User
  getCurrentUser() { return this.request('/me'); },
  // Fungsi ini sekarang akan bekerja dengan benar berkat Perbaikan 1
  updateUserProfile(formData) { return this.request('/user/profile', { method: 'PUT', body: formData }); }, 
  changePassword(data) { return this.request('/user/change-password', { method: 'PUT', body: JSON.stringify(data) }); },

  // API Work Order Partial (Status Barang)
  updateWorkOrderPartial(id, data) {
    return this.request(`/workorders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  // ✅ Ambil hanya data real untuk halaman Status Barang
getStatusBarang(month, year, customer) {
  const params = new URLSearchParams({
    month,
    year,
    customer: customer || ''
  });
  return this.request(`/api/status-barang?${params.toString()}`);
},



    
  getDashboardData(month, year) { return this.request(`/dashboard?month=${month}&year=${year}`); },
  
  // API Karyawan
  getKaryawan() { return this.request('/karyawan'); },
  addKaryawan(data) { return this.request('/karyawan', { method: 'POST', body: JSON.stringify(data) }); },
  updateKaryawan(id, data) { return this.request(`/karyawan/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteKaryawan(id) { return this.request(`/karyawan/${id}`, { method: 'DELETE' }); },
  getKaryawanById(id) { return this.request(`/karyawan/${id}`); },
  
  // API Payroll
  processPayroll(data) { return this.request('/payroll', { method: 'POST', body: JSON.stringify(data) }); },
    
  // API Work Orders (GET)
  getWorkOrders(month, year, customer = '', status = '') {
      let endpoint = `/workorders?month=${month}&year=${year}`;
      if (customer) {
          endpoint += `&customer=${encodeURIComponent(customer)}`;
      }
      if (status) {
          endpoint += `&status=${encodeURIComponent(status)}`;
      }
      return this.request(endpoint);
  },

  // API Work Orders (POST, PUT, DELETE) - dari app.js Anda
  addWorkOrder(data) { return this.request('/workorders', { method: 'POST', body: JSON.stringify(data) }); },
  updateWorkOrder(id, data) { return this.request(`/workorders/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  deleteWorkOrder(id) { return this.request(`/workorders/${id}`, { method: 'DELETE' }); },
  updateWorkOrderStatus(id, columnName, value) { return this.request(`/workorders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ columnName, value }) }); },
  markWorkOrdersPrinted(ids) { return this.request('/workorders/mark-printed', { method: 'POST', body: JSON.stringify({ ids }) }); },

  // API Stok
  getStok() { return this.request('/stok'); },
  addBahan(data) { return this.request('/stok', { method: 'POST', body: JSON.stringify(data) }); },
  updateStok(data) { return this.request('/stok/update', { method: 'POST', body: JSON.stringify(data) }); },

  // API Invoice & Surat Jalan
  getInvoiceData(inv) { return this.request(`/invoice/${inv}`); },
  getInvoiceSummary(month, year) { return this.request(`/invoices/summary?month=${month}&year=${year}`); },
  createSuratJalan(data) { return this.request('/surat-jalan', { method: 'POST', body: JSON.stringify(data) }); },

  // API Keuangan
  getSaldoKeuangan() { return this.request('/keuangan/saldo'); },
  addTransaksiKeuangan(data) { return this.request('/keuangan/transaksi', { method: 'POST', body: JSON.stringify(data) }); },
  getRiwayatKeuangan(month, year) { return this.request(`/keuangan/riwayat?month=${month}&year=${year}`); },
};


App.api.updateWorkOrderPartial = async function (id, data) {
    const response = await fetch(`${App.api.baseUrl}/api/workorders/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`

        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || `HTTP ${response.status}`);
    }

    return response.json();
};


// ===================================
// UI (Fungsi Bantuan Tampilan)
// ===================================
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
// Logika Halaman (urutkan sesuai menu)
// ===================================

App.pages['dashboard'] = {
    state: {
        currentStatusView: 'siap_kirim',
        isLoadingTable: false
    },
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
        // --- Reset tampilan awal ---
        this.elements.totalPesananRp.textContent = 'Memuat...';
        this.elements.totalCustomer.textContent = 'Memuat...';
        this.elements.statusBelumProduksi.textContent = '...';
        this.elements.statusSudahProduksi.textContent = '...';
        this.elements.statusSudahWarna.textContent = '...';
        this.elements.statusSiapKirim.textContent = '...';
        this.elements.statusSudahKirim.textContent = '...';
        this.elements.tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat data ringkasan...</td></tr>';

        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;

        try {
            // ✅ PANGGIL FUNGSI API HELPER ANDA, BUKAN FETCH MANUAL
            const summaryData = await App.api.getDashboardData(month, year);
            console.log('[Dashboard] Data diterima:', summaryData);

            // ✅ Validasi data agar tidak undefined
            if (!summaryData.summary || !summaryData.statusCounts) {
                throw new Error('Data dashboard tidak lengkap.');
            }

            // Render data dashboard
            this.renderSummaryCards(summaryData);
            this.setActiveStatusView(this.state.currentStatusView || 'siap_kirim');

        } catch (error) {
            console.error('[Dashboard] Error saat memuat data:', error);

            // Tampilkan error di card
            this.elements.totalPesananRp.textContent = 'Error';
            this.elements.totalCustomer.textContent = 'Error';

            // Tampilkan error di tabel
            this.elements.tableBody.innerHTML =
                `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat data: ${error.message}</td></tr>`;
        }
    },

    // === Fungsi lain tetap seperti semula ===

    setActiveStatusView(status) {
        if (!status || this.state.isLoadingTable) {
            console.log(`[setActiveStatusView] Mengabaikan ${status} karena sedang loading.`);
            return;
        }
        console.log(`[setActiveStatusView] Mengatur status aktif ke: ${status}`);
        this.state.currentStatusView = status;

        document.querySelectorAll('.status-card').forEach(card => {
            card.classList.remove('active-card');
        });

        const cardElementName = 'card' + this.capitalizeStatus(status);
        const activeCard = this.elements[cardElementName];
        if (activeCard) activeCard.classList.add('active-card');

        if (this.elements.tableHeading)
            this.elements.tableHeading.textContent = `Daftar Barang ${this.getStatusLabel(status)}`;

        this.loadTableData(status);
    },

    async loadTableData(status) {
        if (this.state.isLoadingTable) return;
        this.state.isLoadingTable = true;
        this.elements.tableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat data tabel...</td></tr>';

        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;

        try {
            const items = await App.api.getWorkOrders(month, year, '', status);
            if (status === this.state.currentStatusView) this.renderTable(items);
        } catch (error) {
            console.error(`[loadTableData] Error untuk status ${status}:`, error);
            if (status === this.state.currentStatusView)
                this.elements.tableBody.innerHTML =
                    `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat tabel ${this.getStatusLabel(status)}: ${error.message}</td></tr>`;
        } finally {
            this.state.isLoadingTable = false;
        }
    },

    renderSummaryCards(data) {
        if (data.summary) {
            this.elements.totalPesananRp.textContent = App.ui.formatCurrency(data.summary.total_rupiah || 0);
            this.elements.totalCustomer.textContent = data.summary.total_customer || 0;
        }
        if (data.statusCounts) {
            this.elements.statusBelumProduksi.textContent = data.statusCounts.belum_produksi || 0;
            this.elements.statusSudahProduksi.textContent = data.statusCounts.sudah_produksi || 0;
            this.elements.statusSudahWarna.textContent = data.statusCounts.di_warna || 0;
            this.elements.statusSiapKirim.textContent = data.statusCounts.siap_kirim || 0;
            this.elements.statusSudahKirim.textContent = data.statusCounts.di_kirim || 0;
        }
    },

    renderTable(items) {
        if (!items || items.length === 0) {
            this.elements.tableBody.innerHTML =
                `<tr><td colspan="4" class="p-8 text-center text-gray-500">Tidak ada barang dengan status ${this.getStatusLabel(this.state.currentStatusView)}.</td></tr>`;
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

    // ======================================================
// 🧾 KELOLA CHECKBOX PRINT PO
// ======================================================
updatePOSelection(rowData, isChecked) {
  const btn = document.getElementById("create-po-btn");
  if (!this.selectedPOs) this.selectedPOs = new Set();

  if (isChecked) {
    this.selectedPOs.add(rowData.id);
  } else {
    this.selectedPOs.delete(rowData.id);
  }

  btn.innerHTML = `Buat PO (${this.selectedPOs.size})`;
  btn.disabled = this.selectedPOs.size === 0;
},

// ======================================================
// 🖨️ KETIKA TOMBOL PRINT PO DIKLIK
// ======================================================
async handlePrintPO() {
  if (!this.selectedPOs || this.selectedPOs.size === 0) return;
  const ids = Array.from(this.selectedPOs);

  if (!confirm(`Buat PO untuk ${ids.length} item?`)) return;

  try {
    const res = await App.api.markPrinted(ids);
    alert(res.message || "PO berhasil dibuat!");

    // Update status di_produksi jadi true di frontend
    this.state.data.forEach((row) => {
      if (ids.includes(row.id)) row.di_produksi = true;
    });

    this.state.table.updateData(this.state.data);
    this.selectedPOs.clear();
    document.getElementById("create-po-btn").innerHTML = `Buat PO (0)`;
    document.getElementById("create-po-btn").disabled = true;
  } catch (err) {
    console.error("Gagal Print PO:", err);
    alert("Gagal membuat PO.");
  }
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
    state: {
        karyawanList: [],
        editingId: null,
    },
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
    state: {
        karyawanList: [],
        selectedKaryawan: null,
        payrollData: null,
    },
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

        // Set tanggal periode default ke hari ini
        this.elements.periodeInput.valueAsDate = new Date();
    },
    async load() {
        try {
            const karyawan = await App.api.getKaryawan();
            this.state.karyawanList = karyawan;
            const select = this.elements.karyawanSelect;
            select.innerHTML = '<option value="">-- Pilih Karyawan --</option>';
            karyawan.forEach(k => {
                select.add(new Option(k.nama_karyawan, k.id));
            });
            if (karyawan.length > 0) {
                select.value = karyawan[0].id;
                this.handleKaryawanSelect();
            }
        } catch (error) {
            this.elements.karyawanSelect.innerHTML = `<option>${error.message}</option>`;
        }
    },
    handleKaryawanSelect() {
        const id = this.elements.karyawanSelect.value;
        if (!id) {
            this.state.selectedKaryawan = null;
            return;
        }
        this.state.selectedKaryawan = this.state.karyawanList.find(k => k.id == id);
    },
    handleCalculate() {
        if (!this.state.selectedKaryawan) {
            return alert('Pilih seorang karyawan terlebih dahulu.');
        }

        const k = this.state.selectedKaryawan;
        const hariKerja = parseInt(this.elements.hariKerjaInput.value) || 0;
        const hariLembur = parseInt(this.elements.hariLemburInput.value) || 0;
        const potonganBon = parseFloat(this.elements.potonganBonInput.value) || 0;

        const gajiHarian = parseFloat(k.gaji_harian);
        const bpjsKesehatan = parseFloat(k.potongan_bpjs_kesehatan);
        const bpjsKetenagakerjaan = parseFloat(k.potongan_bpjs_ketenagakerjaan);
        
        const gajiPokok = hariKerja * gajiHarian;
        const totalLembur = hariLembur * gajiHarian;
        const totalGajiKotor = gajiPokok + totalLembur;
        const totalPotongan = bpjsKesehatan + bpjsKetenagakerjaan + potonganBon;
        const gajiBersih = totalGajiKotor - totalPotongan;

        this.state.payrollData = {
            karyawan_id: k.id,
            nama_karyawan: k.nama_karyawan,
            periode_gaji: this.elements.periodeInput.value,
            hari_kerja: hariKerja,
            hari_lembur: hariLembur,
            gaji_harian: gajiHarian,
            gaji_pokok: gajiPokok,
            total_lembur: totalLembur,
            total_gaji_kotor: totalGajiKotor,
            potongan_bpjs_kesehatan: bpjsKesehatan,
            potongan_bpjs_ketenagakerjaan: bpjsKetenagakerjaan,
            potongan_kasbon: potonganBon,
            total_potongan: totalPotongan,
            gaji_bersih: gajiBersih,
        };
        
        this.renderSummary();
    },
    renderSummary() {
        const p = this.state.payrollData;
        if (!p) return;

        this.elements.summaryDiv.classList.remove('hidden');
        this.elements.summaryDiv.innerHTML = `
            <div class="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Pendapatan</h3>
                    <dl class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <dt class="text-gray-600">Gaji Pokok (${p.hari_kerja} hari)</dt>
                            <dd class="font-medium">${App.ui.formatCurrency(p.gaji_pokok)}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-600">Lembur (${p.hari_lembur} hari)</dt>
                            <dd class="font-medium">${App.ui.formatCurrency(p.total_lembur)}</dd>
                        </div>
                        <div class="flex justify-between font-bold pt-2 border-t">
                            <dt>Total Gaji Kotor</dt>
                            <dd>${App.ui.formatCurrency(p.total_gaji_kotor)}</dd>
                        </div>
                    </dl>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Potongan</h3>
                    <dl class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <dt class="text-gray-600">BPJS Kesehatan</dt>
                            <dd class="font-medium">${App.ui.formatCurrency(p.potongan_bpjs_kesehatan)}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-600">BPJS Ketenagakerjaan</dt>
                            <dd class="font-medium">${App.ui.formatCurrency(p.potongan_bpjs_ketenagakerjaan)}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-gray-600">Potongan Bon</dt>
                            <dd class="font-medium">${App.ui.formatCurrency(p.potongan_kasbon)}</dd>
                        </div>
                        <div class="flex justify-between font-bold pt-2 border-t">
                            <dt>Total Potongan</dt>
                            <dd>${App.ui.formatCurrency(p.total_potongan)}</dd>
                        </div>
                    </dl>
                </div>
            </div>
            <div class="mt-6 pt-4 border-t-2 border-gray-300 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-900">GAJI BERSIH (TAKE HOME PAY)</h3>
                <p class="text-2xl font-bold text-green-600">${App.ui.formatCurrency(p.gaji_bersih)}</p>
            </div>
            <div class="mt-6 text-right">
                <button id="save-print-btn" class="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700">Simpan & Cetak Slip</button>
            </div>
        `;
        document.getElementById('save-print-btn').addEventListener('click', () => this.handleSaveAndPrint());
    },
    async handleSaveAndPrint() {
        if (!this.state.payrollData) return;
        const btn = document.getElementById('save-print-btn');
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';

        try {
            await App.api.processPayroll(this.state.payrollData);
            this.renderSlipGaji();
            setTimeout(() => {
                App.ui.printElement('slip-gaji-print-area');
                alert('Data payroll berhasil disimpan!');
                this.load(); // Reload data karyawan untuk update kasbon
            }, 300);
        } catch (error) {
            alert(`Gagal menyimpan payroll: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Simpan & Cetak Slip';
        }
    },
    renderSlipGaji() {
        const p = this.state.payrollData;
        if (!p) return;
        const periodeFormatted = new Date(p.periode_gaji).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        this.elements.printArea.innerHTML = `
            <div class="invoice-box">
                <div class="invoice-header">
                    <div>
                        <h1 class="company-name">CV TOTO ALUMINIUM MANUFACTURE</h1>
                        <p class="text-sm">Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
                    </div>
                    <div class="invoice-title">SLIP GAJI</div>
                </div>
                <div class="invoice-meta">
                     <div>
                        <span class="meta-label">Nama Karyawan:</span>
                        <span class="meta-value customer-name">${p.nama_karyawan}</span>
                    </div>
                    <div>
                        <span class="meta-label">Periode:</span>
                        <span class="meta-value">${periodeFormatted}</span>
                    </div>
                </div>
                <div class="flex justify-between mt-4">
                    <div class="w-1/2 pr-4">
                        <h3 class="text-md font-bold border-b pb-1 mb-2">Pendapatan</h3>
                        <table class="w-full text-sm">
                            <tr><td class="py-1">Gaji Pokok</td><td class="text-right">${App.ui.formatCurrency(p.gaji_pokok)}</td></tr>
                            <tr><td class="py-1">Lembur</td><td class="text-right">${App.ui.formatCurrency(p.total_lembur)}</td></tr>
                            <tr class="font-bold border-t"><td class="py-1">Total (A)</td><td class="text-right">${App.ui.formatCurrency(p.total_gaji_kotor)}</td></tr>
                        </table>
                    </div>
                    <div class="w-1/2 pl-4">
                        <h3 class="text-md font-bold border-b pb-1 mb-2">Potongan</h3>
                        <table class="w-full text-sm">
                            <tr><td class="py-1">BPJS Kesehatan</td><td class="text-right">${App.ui.formatCurrency(p.potongan_bpjs_kesehatan)}</td></tr>
                            <tr><td class="py-1">BPJS Ketenagakerjaan</td><td class="text-right">${App.ui.formatCurrency(p.potongan_bpjs_ketenagakerjaan)}</td></tr>
                            <tr><td class="py-1">Kasbon</td><td class="text-right">${App.ui.formatCurrency(p.potongan_kasbon)}</td></tr>
                            <tr class="font-bold border-t"><td class="py-1">Total (B)</td><td class="text-right">${App.ui.formatCurrency(p.total_potongan)}</td></tr>
                        </table>
                    </div>
                </div>
                <div class="mt-6 border-t-2 border-black pt-2 flex justify-between font-bold text-lg">
                    <span>Gaji Bersih (A - B)</span>
                    <span>${App.ui.formatCurrency(p.gaji_bersih)}</span>
                </div>
                <div class="mt-16 flex justify-around text-center text-sm">
                    <div>
                        <p class="mb-12">Disetujui oleh,</p>
                        <p>(.....................)</p>
                    </div>
                    <div>
                        <p class="mb-12">Diterima oleh,</p>
                        <p>(${p.nama_karyawan})</p>
                    </div>
                </div>
            </div>
        `;
    },
};

// ======================================================
// 🧾 Fungsi Buat PO (Integrasi dengan Tabulator & Print-PO)
// ======================================================
App.pages['work-orders'].initPOFeature = function() {
    const btnCreatePO = document.getElementById('create-po-btn');
    const poCountSpan = document.getElementById('po-selection-count');
    const table = this.table; // ambil instance Tabulator dari halaman Work Orders

    // ✅ Update jumlah pilihan & tombol aktif / nonaktif
    function updatePOButtonState(selectedCount) {
        if (!btnCreatePO || !poCountSpan) return;
        poCountSpan.textContent = selectedCount || 0;
        btnCreatePO.disabled = selectedCount === 0;
    }

    // ✅ Hubungkan event Tabulator ketika baris dicentang / dihapus
    if (table && typeof table.on === 'function') {
        table.on('rowSelectionChanged', function(data) {
            updatePOButtonState(data.length);
        });
    }

    // ✅ Fungsi utama saat tombol "Buat PO" diklik
    if (btnCreatePO) {
        btnCreatePO.addEventListener('click', async () => {
            try {
                const selectedData = table.getSelectedData ? table.getSelectedData() : [];
                if (!selectedData || selectedData.length === 0) {
                    alert('Silakan pilih minimal satu Work Order untuk dicetak PO.');
                    return;
                }

                if (!confirm(`Cetak ${selectedData.length} Work Order sebagai PO?`)) return;

                sessionStorage.setItem('poData', JSON.stringify(selectedData));

                const ids = selectedData.map(item => item.id).filter(Boolean);

                btnCreatePO.disabled = true;
                btnCreatePO.textContent = 'Menandai...';

                const response = await App.api.request('/api/workorders/mark-printed', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + App.getToken(),
                    },
                    body: JSON.stringify({ ids }),
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || 'Gagal menandai status PO di server.');
                }

                alert('PO berhasil dibuat. Mengarahkan ke halaman cetak...');
                window.location.href = 'print-po.html';
            } catch (err) {
                console.error('❌ Gagal Buat PO:', err);
                alert('Terjadi kesalahan: ' + (err.message || 'Tidak diketahui'));
            } finally {
                btnCreatePO.disabled = false;
                btnCreatePO.textContent = `Buat PO (${poCountSpan.textContent})`;
            }
        });
    } else {
        console.warn('⚠️ Tombol create-po-btn tidak ditemukan di halaman ini.');
    }
};

// ==========================================================
// 🚀 APP.PAGES['work-orders'] (Versi Final Optimal by ChatGPT & Faisal)
// ==========================================================
App.pages["work-orders"] = {
  state: {
    totalRows: 10000,
    pageSize: 500,
    loadedChunks: new Set(),
    isLoadingChunk: {},
    dataByRow: {},
    dirtyRows: new Set(),
    autosaveInterval: 4000,
    saveTimer: null,
    selectedPOs: new Set(),
  },

  elements: {},

  // ======================================================
  // 🔹 INIT PAGE
  // ======================================================
  init() {
    this.elements.monthFilter = document.getElementById("wo-month-filter");
    this.elements.yearFilter = document.getElementById("wo-year-filter");
    this.elements.filterBtn = document.getElementById("filter-wo-btn");
    this.elements.gridContainer = document.getElementById("workorders-grid");
    this.elements.dateFilter = document.getElementById("wo-date-filter");
    this.elements.filterTanggalBtn = document.getElementById("filter-tanggal-btn");

    // Inisialisasi dropdown bulan & tahun
    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    // Event filter
    this.elements.filterBtn?.addEventListener("click", () => this.reload());
    this.elements.filterTanggalBtn?.addEventListener("click", () => this.filterByTanggal());

    // Tombol Buat PO
    document.getElementById("create-po-btn")?.addEventListener("click", () => this.handlePrintPO());

    this.createSheetDom();
    console.log("🧭 Work Orders sheet initialized");
    setTimeout(() => this.reload(), 300);
  },

  // ======================================================
  // 🧱 BUAT STRUKTUR DOM TABEL
  // ======================================================
  createSheetDom() {
    const container = this.elements.gridContainer;
    container.innerHTML = `
      <div id="wo-status" class="p-2 text-sm text-gray-700">Menunggu data...</div>
      <div class="overflow-auto border rounded bg-white" style="max-height:70vh;">
        <table class="w-full border-collapse min-w-[1000px] text-sm">
          <thead class="bg-[#EDE0D4] text-[#5C4033] font-semibold sticky top-0 z-10">
            <tr>
              <th class="border-b w-[40px] text-center bg-[#EDE0D4]">#</th>
              <th class="border-b w-[140px] text-center bg-[#EDE0D4]">TANGGAL</th>
              <th class="border-b w-[260px] text-left bg-[#EDE0D4]">CUSTOMER</th>
              <th class="border-b w-[360px] text-left bg-[#EDE0D4]">DESKRIPSI</th>
              <th class="border-b w-[100px] text-center bg-[#EDE0D4]">UKURAN</th>
              <th class="border-b w-[80px] text-center bg-[#EDE0D4]">QTY</th>
              <th class="border-b w-[100px] text-center bg-[#EDE0D4]">Print PO</th>
            </tr>
          </thead>
          <tbody id="wo-sheet-body"></tbody>
        </table>
      </div>`;

    this.elements.wsStatus = document.getElementById("wo-status");
    this.state.tableEl = document.getElementById("wo-sheet-body");

    // Lazy load scroll
    const wrapper = container.querySelector("div.overflow-auto");
    wrapper.addEventListener("scroll", () => {
      const scrollPos = wrapper.scrollTop + wrapper.clientHeight;
      const scrollHeight = wrapper.scrollHeight;
      if (scrollPos + 200 >= scrollHeight) {
        const nextChunk = this.state.loadedChunks.size;
        const totalChunks = Math.ceil(this.state.totalRows / this.state.pageSize);
        if (nextChunk < totalChunks) this.loadChunk(nextChunk);
      }
    });
  },

  // ======================================================
  // 🧾 UPDATE STATUS
  // ======================================================
  updateStatus(msg) {
    if (this.elements.wsStatus) this.elements.wsStatus.textContent = msg;
    console.log("WO:", msg);
  },

  // ======================================================
  // 🔁 RELOAD DATA (Lazy load)
  // ======================================================
  async reload() {
    const month = this.elements.monthFilter?.value;
    const year = this.elements.yearFilter?.value;
    if (!month || !year) {
      this.updateStatus("Pilih bulan dan tahun terlebih dahulu");
      return;
    }

    // Reset state
    this.state.dataByRow = {};
    this.state.dirtyRows.clear();
    this.state.tableEl.innerHTML = "";
    this.state.selectedPOs.clear();
    this.state.loadedChunks.clear();
    this.state.isLoadingChunk = {};

    this.updateStatus(`Memuat data Work Order untuk ${month}/${year}...`);

    try {
      await this.loadChunk(0);
      this.updateStatus(`Render hingga baris 500... (scroll ke bawah untuk lanjut)`);
    } catch (err) {
      console.error("❌ reload() gagal", err);
      this.updateStatus("Gagal memuat data awal.");
    }
  },

  // ======================================================
  // 📅 FILTER BERDASARKAN TANGGAL
  // ======================================================
  async filterByTanggal() {
    const month = this.elements.monthFilter?.value;
    const year = this.elements.yearFilter?.value;
    const tanggal = this.elements.dateFilter?.value;

    if (!month || !year || !tanggal) {
      this.updateStatus("Pilih bulan, tahun, dan tanggal terlebih dahulu.");
      return;
    }

    this.state.dataByRow = {};
    this.state.tableEl.innerHTML = "";
    this.state.loadedChunks.clear();

    this.updateStatus(`Memuat data Work Order tanggal ${tanggal}...`);

    try {
      const data = await App.api.getWorkOrdersByTanggal(month, year, tanggal);
      if (!Array.isArray(data)) throw new Error("Data tidak valid");

      data.forEach((row, i) => this.renderRow(i, row));
      this.updateStatus(`${data.length} baris ditemukan pada tanggal ${tanggal}.`);
    } catch (err) {
      console.error("❌ filterByTanggal gagal:", err);
      this.updateStatus("Gagal memuat data tanggal tertentu.");
    }
  },

  // ======================================================
  // 📦 LOAD CHUNK
  // ======================================================
  async loadChunk(chunkNum) {
    const month = this.elements.monthFilter?.value;
    const year = this.elements.yearFilter?.value;
    const offset = chunkNum * this.state.pageSize;
    const limit = this.state.pageSize;

    if (this.state.loadedChunks.has(chunkNum)) return;
    if (this.state.isLoadingChunk[chunkNum]) return;
    this.state.isLoadingChunk[chunkNum] = true;

    try {
      const data = await App.api.getWorkOrdersChunk(month, year, offset, limit);
      if (!Array.isArray(data)) throw new Error("Data tidak valid");

      data.forEach((row, i) => {
        const idx = offset + i;
        this.state.dataByRow[idx] = row;
        this.renderRow(idx, row);
      });

      this.state.loadedChunks.add(chunkNum);
      this.updateStatus(`Render hingga baris ${offset + data.length}...`);
    } catch (err) {
      console.error("loadChunk error:", err);
      this.updateStatus(`Gagal memuat chunk ${chunkNum + 1}.`);
    } finally {
      this.state.isLoadingChunk[chunkNum] = false;
    }
  },

  // ======================================================
  // ✏️ RENDER BARIS
  // ======================================================
  renderRow(rowIndex, rowData) {
    const tbody = this.state.tableEl;
    if (!tbody) return;

    let tr = tbody.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (!tr) {
      tr = document.createElement("tr");
      tr.dataset.rowIndex = rowIndex;
      tbody.appendChild(tr);
    }

    const tanggal = rowData?.tanggal
      ? new Date(rowData.tanggal).toLocaleDateString("id-ID")
      : "";
    const customer = rowData?.nama_customer || "";
    const deskripsi = rowData?.deskripsi || "";
    const ukuran = rowData?.ukuran || "";
    const qty = rowData?.qty || "";
    const sudahProduksi =
      rowData?.di_produksi === true || rowData?.di_produksi === "true";

    tr.innerHTML = `
      <td class="border-b text-center">${rowIndex + 1}</td>
      <td class="border-b text-center editable" data-field="tanggal" contenteditable="true">${tanggal}</td>
      <td class="border-b px-2 editable" data-field="nama_customer" contenteditable="true">${customer}</td>
      <td class="border-b px-2 editable" data-field="deskripsi" contenteditable="true">${deskripsi}</td>
      <td class="border-b text-center editable" data-field="ukuran" contenteditable="true">${ukuran}</td>
      <td class="border-b text-center editable" data-field="qty" contenteditable="true">${qty}</td>
      <td class="border-b text-center">
        <input type="checkbox" class="po-checkbox h-4 w-4 cursor-pointer" 
          ${sudahProduksi ? "checked disabled" : ""}>
      </td>
    `;

    tr.querySelectorAll(".editable").forEach((cell) => {
      cell.addEventListener("input", (e) => this.handleCellEdit(e, rowIndex));
    });

    tr.querySelector(".po-checkbox")?.addEventListener("change", (e) => {
      this.updatePOSelection(rowData, e.target.checked);
    });
  },

  // ======================================================
  // 💾 AUTOSAVE
  // ======================================================
  handleCellEdit(e, rowIndex) {
    const field = e.target.dataset.field;
    const value = e.target.innerText.trim();
    if (!this.state.dataByRow[rowIndex]) this.state.dataByRow[rowIndex] = {};
    this.state.dataByRow[rowIndex][field] = value;
    this.state.dirtyRows.add(rowIndex);

    clearTimeout(this.state.saveTimer);
    this.state.saveTimer = setTimeout(
      () => this.saveDirtyRows(),
      this.state.autosaveInterval
    );
  },

  async saveDirtyRows() {
    if (this.state.dirtyRows.size === 0) return;
    this.updateStatus("Menyimpan perubahan...");
    for (let idx of this.state.dirtyRows) {
      const row = this.state.dataByRow[idx];
      if (!row) continue;
      try {
        if (row.id) {
          await App.api.updateWorkOrderPartial(row.id, row);
        } else {
          // 🔧 Normalisasi data agar cocok dengan backend
const normalized = {
  tanggal: row.tanggal || new Date().toISOString().slice(0, 10),
  nama_customer: row.nama_customer || row.customer || row.CUSTOMER || "Tanpa Nama",
  deskripsi: row.deskripsi || row.DESKRIPSI || "",
  ukuran: row.ukuran || row.UKURAN || null,
  qty: row.qty || row.QTY || null,
};

console.log("🚀 Data dikirim ke backend:", normalized);

const res = await App.api.addWorkOrder(normalized);
if (res?.id) row.id = res.id;

          if (res?.id) row.id = res.id;
        }
      } catch (err) {
        console.error("Gagal menyimpan baris", idx, err);
      }
    }
    this.state.dirtyRows.clear();
    this.updateStatus("Semua perubahan tersimpan ✅");
  },

  // ======================================================
  // 🧾 CHECKBOX PRINT PO
  // ======================================================
  updatePOSelection(rowData, isChecked) {
    const btn = document.getElementById("create-po-btn");
    if (!this.state.selectedPOs) this.state.selectedPOs = new Set();

    if (isChecked) this.state.selectedPOs.add(rowData.id);
    else this.state.selectedPOs.delete(rowData.id);

    btn.innerHTML = `Buat PO (${this.state.selectedPOs.size})`;
    btn.disabled = this.state.selectedPOs.size === 0;
  },

  // ======================================================
  // 🖨️ PRINT PO
  // ======================================================
  async handlePrintPO() {
    if (!this.state.selectedPOs || this.state.selectedPOs.size === 0) return;
    const ids = Array.from(this.state.selectedPOs);

    if (!confirm(`Buat PO untuk ${ids.length} item?`)) return;

    try {
      const res = await App.api.markPrinted(ids);
      alert(res.message || "PO berhasil dibuat!");

      Object.values(this.state.dataByRow).forEach((row) => {
        if (ids.includes(row.id)) row.di_produksi = true;
      });

      this.reload();
    } catch (err) {
      console.error("Gagal Print PO:", err);
      alert("Gagal membuat PO.");
    }
  },
};



/// ===============================================
//         STATUS BARANG PAGE (FINAL AUTOSAVE)
// ===============================================
App.pages['status-barang'] = {
    state: { workOrders: [], debounceTimer: null },
    elements: {},

    init() {
        this.elements = {
            monthFilter: document.getElementById('status-month-filter'),
            yearFilter: document.getElementById('status-year-filter'),
            customerFilter: document.getElementById('status-customer-filter'),
            filterBtn: document.getElementById('filter-status-btn'),
            tableBody: document.getElementById('status-table-body'),
            indicator: document.getElementById('status-update-indicator')
        };

        this.elements.filterBtn.addEventListener('click', () => this.load());
        this.elements.tableBody.addEventListener('change', (e) => this.handleStatusUpdate(e));
        this.elements.tableBody.addEventListener('input', (e) => this.handleInputUpdate(e));

        App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    },

    async load() {
        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;
        const customerName = this.elements.customerFilter.value;

        this.elements.tableBody.innerHTML = `<tr><td colspan="14" class="p-4 text-center">Memuat data...</td></tr>`;

        try {
            const data = await App.api.getStatusBarang(month, year, customerName);
            this.state.workOrders = data;
            this.render();
        } catch (error) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
        }
    },

    render() {
        if (this.state.workOrders.length === 0) {
            this.elements.tableBody.innerHTML = `
                <tr><td colspan="14" class="p-4 text-center">Tidak ada data untuk filter ini.</td></tr>
            `;
            return;
        }

        const statusColumns = ['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran'];

        this.elements.tableBody.innerHTML = this.state.workOrders.map(wo => {
            const harga = parseFloat(wo.harga) || 0;
            const qty = parseFloat(wo.qty) || 0;
            const ukuran = parseFloat(wo.ukuran) || 0;
            const total = harga * qty * ukuran;

            const tanggal = wo.tanggal
                ? new Date(wo.tanggal).toLocaleDateString('id-ID', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                  })
                : '-';

            return `
                <tr data-id="${wo.id}">
                    <td contenteditable="true" data-column="tanggal" class="px-6 py-4 text-xs text-center">${tanggal}</td>
                    <td contenteditable="true" data-column="nama_customer" class="px-6 py-4 text-xs">${wo.nama_customer || ''}</td>
                    <td contenteditable="true" data-column="deskripsi" class="px-6 py-4 text-xs">${wo.deskripsi || ''}</td>
                    <td contenteditable="true" data-column="ukuran" class="px-6 py-4 text-xs text-center">${ukuran || ''}</td>
                    <td contenteditable="true" data-column="qty" class="px-6 py-4 text-xs text-center">${qty || ''}</td>
                    <td class="p-1 text-center">
                        <input type="number" data-column="harga" value="${harga || ''}"
                            class="w-24 text-xs text-right border-gray-300 rounded-md p-1"
                            placeholder="0">
                    </td>

                    <td class="px-6 py-4 text-xs text-right font-medium total-cell">
                        ${(total || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
                    </td>

                    <td class="p-1 text-center">
                        <input type="text" data-column="no_inv" value="${wo.no_inv || ''}"
                            class="w-24 text-xs text-center border-gray-300 rounded-md p-1"
                            placeholder="INV...">
                    </td>

                    ${statusColumns.map(col => `
                        <td class="px-6 py-4 text-center">
                            <input type="checkbox" data-column="${col}" class="h-4 w-4 rounded"
                                ${wo[col] === 'true' || wo[col] === true ? 'checked' : ''}>
                        </td>
                    `).join('')}

                    <td class="p-1">
                        <input type="text" data-column="ekspedisi" value="${wo.ekspedisi || ''}"
                            class="w-full text-xs p-1 border-gray-300 rounded-md"
                            placeholder="Ketik ekspedisi...">
                    </td>
                </tr>
            `;
        }).join('');
    },

    handleStatusUpdate(e) {
        if (e.target.type !== 'checkbox') return;
        const el = e.target;
        const row = el.closest('tr');
        const id = row.dataset.id;
        const columnName = el.dataset.column;
        const value = el.checked;
        this.updateApi(id, { [columnName]: value });
    },

    handleInputUpdate(e) {
        const el = e.target;
        const row = el.closest('tr');
        const id = row.dataset.id;
        const columnName = el.dataset.column;

        // kalau pakai contenteditable
        let value = el.value || el.textContent;
        if (!id || !columnName) return;

        clearTimeout(this.state.debounceTimer);
        this.state.debounceTimer = setTimeout(() => {
            this.updateApi(id, { [columnName]: value }, row);
        }, 600);
    },

    updateApi(id, data, row = null) {
        if (!id) return;
        this.elements.indicator.classList.remove('opacity-0');
        App.api.updateWorkOrderPartial(id, data)
            .then(() => {
                // update total otomatis kalau harga/qty/ukuran berubah
                if (row && (data.harga || data.qty || data.ukuran)) {
                    const harga = parseFloat(row.querySelector('[data-column="harga"]')?.value) || 0;
                    const qty = parseFloat(row.querySelector('[data-column="qty"]')?.textContent) || 0;
                    const ukuran = parseFloat(row.querySelector('[data-column="ukuran"]')?.textContent) || 0;
                    const total = harga * qty * ukuran;
                    row.querySelector('.total-cell').textContent = App.ui.formatCurrency(total);
                }
                setTimeout(() => this.elements.indicator.classList.add('opacity-0'), 1000);
            })
            .catch(err => {
                alert('Gagal menyimpan perubahan: ' + err.message);
                this.elements.indicator.classList.add('opacity-0');
            });
    }
};

// --- AKHIR MODIFIKASI ---


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
            this.elements.poContent.innerHTML = '<p class="text-red-500">Tidak ada data untuk dicetak.</p>';
            this.elements.finishBtn.disabled = true;
            return;
        }
        this.state.poData = JSON.parse(dataString);
        this.render(); 
    },
    render() {
        const poDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const groupedData = this.state.poData.reduce((acc, item) => {
            const customerName = item.nama_customer || 'Non-Customer';
            if (!acc[customerName]) {
                acc[customerName] = [];
            }
            acc[customerName].push(item);
            return acc;
        }, {});
        let itemRowsHtml = '';
        let globalIndex = 0;
        for (const customer in groupedData) {
            itemRowsHtml += `
                <tr class="bg-gray-100">
                    <td colspan="6" class="p-2 border font-bold text-left">${customer}</td>
                </tr>
            `;
            groupedData[customer].forEach(item => {
                globalIndex++;
                itemRowsHtml += `
                    <tr class="border-b">
                        <td class="p-2 border text-center">${globalIndex}</td>
                        <td class="p-2 border">${item.nama_customer || '-'}</td>
                        <td class="p-2 border">${item.deskripsi || '-'}</td>
                        <td class="p-2 border text-center">${parseFloat(item.ukuran) || ''}</td>
                        <td class="p-2 border text-center">${parseFloat(item.qty) || ''}</td>
                        <td class="p-2 border h-12"></td>
                    </tr>
                `;
            });
        }
        this.elements.poContent.innerHTML = `
            <div class="po-document p-4"> 
                <div class="text-center mb-6">
                    <h2 class="text-xl font-bold">CV TOTO ALUMINUM MANUFACTURE</h2>
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

App.pages['stok-bahan'] = {
    state: { stok: [], debounceTimer: null, currentStokUpdate: null },
    elements: {},
    init() {
        this.elements = {
            searchInput: document.getElementById('stok-search-input'),
            tableBody: document.getElementById('stok-table-body'),
            addMasukBtn: document.getElementById('add-stok-masuk-btn'),
            addKeluarBtn: document.getElementById('add-stok-keluar-btn'),
            addBahanBtn: document.getElementById('add-new-bahan-btn'),
            bahanModal: document.getElementById('bahan-modal'),
            bahanModalTitle: document.getElementById('bahan-modal-title'),
            bahanForm: document.getElementById('bahan-form'),
            cancelBahanBtn: document.getElementById('cancel-bahan-btn'),
            stokModal: document.getElementById('stok-modal'),
            stokModalTitle: document.getElementById('stok-modal-title'),
            stokForm: document.getElementById('stok-form'),
            stokBahanName: document.getElementById('stok-bahan-name'),
            cancelStokBtn: document.getElementById('cancel-stok-btn'),
        };
        this.elements.searchInput.addEventListener('input', () => this.handleSearch());
        this.elements.addBahanBtn.addEventListener('click', () => this.openBahanModal());
        this.elements.addMasukBtn.addEventListener('click', () => this.openStokModal('MASUK'));
        this.elements.addKeluarBtn.addEventListener('click', () => this.openStokModal('KELUAR'));
        this.elements.bahanForm.addEventListener('submit', (e) => this.handleSaveBahan(e));
        this.elements.stokForm.addEventListener('submit', (e) => this.handleSaveStok(e));
        this.elements.cancelBahanBtn.addEventListener('click', () => App.ui.toggleModal(this.elements.bahanModal, false));
        this.elements.cancelStokBtn.addEventListener('click', () => App.ui.toggleModal(this.elements.stokModal, false));
    },
    async load() {
        this.elements.tableBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center">Memuat data stok...</td></tr>';
        try {
            const data = await App.api.getStok();
            this.state.stok = data;
            this.render();
        } catch (error) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
        }
    },
    render(dataToRender = this.state.stok) {
        if (dataToRender.length === 0) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center">Tidak ada data bahan.</td></tr>`;
            return;
        }
        this.elements.tableBody.innerHTML = dataToRender.map(item => `
            <tr data-id="${item.id}">
                <td class="px-4 py-2 text-center"><input type="radio" name="selected-bahan" value="${item.id}"></td>
                <td class="px-6 py-2 whitespace-nowrap text-sm font-medium">${item.kode_bahan}</td>
                <td class="px-6 py-2 whitespace-nowrap text-sm">${item.nama_bahan}</td>
                <td class="px-6 py-2 text-sm">${item.kategori || ''}</td>
                <td class="px-6 py-2 text-sm font-bold ${item.stok <= 0 ? 'text-red-600' : ''}">${parseFloat(item.stok)}</td>
                <td class="px-6 py-2 text-sm">${item.satuan}</td>
                <td class="px-6 py-2 text-sm">${item.lokasi || ''}</td>
                <td class="px-6 py-2 text-sm">${new Date(item.last_update).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    },

    markWorkOrdersPrinted: async function(ids) {
    const response = await this.request('/api/workorders/mark-printed', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + App.getToken(),
        },
        body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error('Gagal menandai PO di server.');
    return response.json();
},

    handleSearch() {
        clearTimeout(this.state.debounceTimer);
        this.state.debounceTimer = setTimeout(() => {
            const keyword = this.elements.searchInput.value.toLowerCase();
            const filtered = this.state.stok.filter(item => 
                item.kode_bahan.toLowerCase().includes(keyword) || 
                item.nama_bahan.toLowerCase().includes(keyword)
            );
            this.render(filtered);
        }, 300);
    },
    openBahanModal() {
        this.elements.bahanForm.reset();
        this.elements.bahanModalTitle.textContent = 'Tambah Bahan Baru';
        App.ui.toggleModal(this.elements.bahanModal, true);
    },
    async handleSaveBahan(e) {
        e.preventDefault();
        const data = {
            kode: document.getElementById('bahan-kode').value,
            nama: document.getElementById('bahan-nama').value,
            satuan: document.getElementById('bahan-satuan').value,
            kategori: document.getElementById('bahan-kategori').value,
            stok: document.getElementById('bahan-stok').value || 0,
            lokasi: document.getElementById('bahan-lokasi').value,
        };
        try {
            await App.api.addBahan(data);
            App.ui.toggleModal(this.elements.bahanModal, false);
            await this.load();
        } catch (error) {
            alert(`Gagal menyimpan: ${error.message}`);
        }
    },
    openStokModal(tipe) {
        const selectedRadio = this.elements.tableBody.querySelector('input[name="selected-bahan"]:checked');
        if (!selectedRadio) {
            return alert('Pilih satu bahan dari tabel terlebih dahulu.');
        }
        const bahanId = selectedRadio.value;
        const bahan = this.state.stok.find(b => b.id == bahanId);
        this.state.currentStokUpdate = { tipe, bahan_id: bahan.id };
        this.elements.stokModalTitle.textContent = tipe === 'MASUK' ? 'Catat Stok Masuk' : 'Catat Stok Keluar';
        this.elements.stokBahanName.textContent = bahan.nama_bahan;
        this.elements.stokForm.reset();
        App.ui.toggleModal(this.elements.stokModal, true);
    },
    async handleSaveStok(e) {
        e.preventDefault();
        const data = {
            ...this.state.currentStokUpdate,
            jumlah: document.getElementById('stok-jumlah').value,
            keterangan: document.getElementById('stok-keterangan').value,
        };
        try {
            await App.api.updateStok(data);
            App.ui.toggleModal(this.elements.stokModal, false);
            await this.load();
        } catch (error) {
            alert(`Gagal update stok: ${error.message}`);
        }
    }
};

// =====================================
// 🧾 Fungsi: Buat PO (Sinkron dengan #create-po-btn)
// =====================================
const btnCreatePO = document.getElementById('create-po-btn');
if (btnCreatePO) {
    btnCreatePO.addEventListener('click', async () => {
        try {
            const checkboxes = Array.from(document.querySelectorAll('.chk-po:checked'));
            if (checkboxes.length === 0) {
                alert('Silakan pilih minimal satu Work Order untuk dicetak PO.');
                return;
            }

            // Ambil data yang dicentang dari state App
            const selectedItems = checkboxes.map(chk => {
                const id = chk.dataset.id;
                return App.pages['work-orders'].state.items.find(i => i.id == id);
            }).filter(Boolean);

            if (!selectedItems.length) {
                alert('Tidak ada data valid yang dipilih.');
                return;
            }

            // Konfirmasi sebelum lanjut
            if (!confirm(`Cetak ${selectedItems.length} Work Order sebagai PO?`)) return;

            // Simpan ke sessionStorage agar bisa dibaca di print-po.html
            sessionStorage.setItem('poData', JSON.stringify(selectedItems));

            // Kirim ID ke backend untuk menandai sebagai printed
            const ids = selectedItems.map(i => i.id);
            const response = await App.api.request('/api/workorders/mark-printed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + App.getToken(),
                },
                body: JSON.stringify({ ids }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Gagal menandai PO di server.');
            }

            alert('PO berhasil dibuat! Mengarahkan ke halaman cetak...');
            window.location.href = 'print-po.html';
        } catch (err) {
            console.error('❌ Error Buat PO:', err);
            alert('Terjadi kesalahan: ' + err.message);
        }
    });
} else {
    console.warn('⚠️ Tombol create-po-btn tidak ditemukan di halaman ini.');
}



App.pages['surat-jalan'] = {
    state: { 
        invoiceData: null, 
        itemsForColoring: [],
        currentTab: 'customer',
    },
    elements: {},

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
            warnaPrintArea: document.getElementById('sj-warna-print-area')
        };

        // --- Event Listeners ---
        this.elements.tabCustomer.addEventListener('click', () => this.switchTab('customer'));
        this.elements.tabWarna.addEventListener('click', () => this.switchTab('warna'));
        this.elements.searchBtn.addEventListener('click', () => this.handleSearchInvoice());
        this.elements.printBtn.addEventListener('click', () => this.printCustomerSJ());
        this.elements.warnaPrintBtn.addEventListener('click', () => this.handlePrintWarnaSJ());

        if (this.elements.selectAllWarna) {
            this.elements.selectAllWarna.addEventListener('change', (e) => {
                this.elements.warnaTableBody.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = e.target.checked);
            });
        }
    },

    load() {
        this.switchTab('customer');
    },

    switchTab(tabName) {
        const isCustomer = tabName === 'customer';
        this.state.currentTab = tabName;
        this.elements.contentCustomer.classList.toggle('hidden', !isCustomer);
        this.elements.contentWarna.classList.toggle('hidden', isCustomer);
        this.elements.tabCustomer.classList.toggle('active', isCustomer);
        this.elements.tabWarna.classList.toggle('active', !isCustomer);
        this.elements.printArea.innerHTML = '';
        this.elements.warnaPrintArea.innerHTML = '';
        this.elements.printBtn.disabled = true;
        if (!isCustomer) this.loadItemsForColoring();
    },

    // ====================== CUSTOMER SJ =======================
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
        const tanggal = new Date().toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'});

        const itemRows = data.map((item, index) => `
            <tr>
                <td class="border p-1 text-center">${index + 1}</td>
                <td class="border p-1 text-center">${parseFloat(item.qty)}</td>
                <td class="border p-1">${item.deskripsi}</td>
                <td class="border p-1">${item.ukuran}</td>
            </tr>
        `).join('');

        this.elements.printArea.innerHTML = `
            <div class="print-content">
                <div class="text-center mb-6">
                    <h2 class="text-xl font-bold">CV TOTO ALUMINIUM MANUFACTURE</h2>
                    <p class="text-sm">Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
                    <h1 class="text-2xl font-extrabold mt-4 border-b-2 border-black pb-1">SURAT JALAN</h1>
                </div>
                <div class="grid grid-cols-2 text-sm mb-6">
                    <div>
                        <p class="font-bold">Kepada Yth:</p>
                        <p>Nama: <b>${customer}</b></p>
                        <p>Alamat:</p>
                        <p>Catatan: ${this.elements.catatanInput.value || '-'}</p>
                    </div>
                    <div class="text-right">
                        <p>No. SJ: <b>${no_sj}</b></p>
                        <p>No. Invoice: ${inv}</p>
                        <p>Tanggal: ${tanggal}</p>
                    </div>
                </div>
                <table class="w-full text-sm border-collapse border border-black">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="p-1 border w-1/12">No</th>
                            <th class="p-1 border w-2/12">Qty</th>
                            <th class="p-1 border w-6/12">Nama Barang / Deskripsi</th>
                            <th class="p-1 border w-3/12">Ukuran</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                </table>
                <div style="display: flex; justify-content: space-around; text-align: center; font-size: 9pt; margin-top: 60px; page-break-inside: avoid;">
                    <div style="flex: 1;">Dibuat Oleh,<br><br><br><br>(..................)</div>
                    <div style="flex: 1;">Pengirim,<br><br><br><br>(..................)</div>
                    <div style="flex: 1;">Penerima,<br><br><br><br>(..................)</div>
                </div>
            </div>`;
    },

    printCustomerSJ() {
        const area = this.elements.printArea;
        if (!area || !area.innerHTML.trim()) return alert("Tidak ada Surat Jalan Customer untuk dicetak.");
        const content = area.innerHTML;
        const w = window.open('', '_blank', 'width=1000,height=700');
        w.document.write(`
            <html><head>
        <title>Surat Jalan Customer</title>
        <style>
            /* --- CSS UKURAN KERTAS HALF CONTINUOUS --- */
            @page { 
              size: 216mm 279mm; /* Sekitar 9.5 x 5.5 inci */
              margin: 10mm; /* Sesuaikan margin jika perlu (misal: 5mm, 10mm) */
            } 
            body { 
              font-family: 'Courier New', monospace; /* Font umum dot matrix */
              font-size: 10pt; /* Sedikit diperbesar agar mudah dibaca */
              margin: 0; 
              padding: 0;
              color: #000; 
            }
            .print-content { /* Pastikan konten utama dibungkus div ini */
              width: 100%;
              box-sizing: border-box;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              font-size: 9pt; /* Ukuran font tabel bisa lebih kecil */
              table-layout: auto; /* Atau 'fixed' jika perlu lebar kolom spesifik */
            }
            th, td { 
              border: 1px solid #000; 
              padding: 3px 5px; /* Sesuaikan padding tabel */
              overflow-wrap: break-word; /* Bantu wrap teks panjang */
               word-wrap: break-word;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-sm { font-size: 9pt; } /* Ukuran font kecil */
            .text-xl { font-size: 14pt; } /* Sesuaikan ukuran judul */
            .text-2xl { font-size: 16pt; } /* Sesuaikan ukuran judul utama */

            /* Atur ulang jarak (sesuaikan jika perlu) */
            .mb-6 { margin-bottom: 0.5rem; } 
            .mt-4 { margin-top: 0.5rem; }
            .mt-16 { margin-top: 0.5rem; } 

            /* Tanda Tangan Horizontal (Gunakan div pembungkus jika belum) */
            .signature-section { 
              display: flex; 
              justify-content: space-around; 
              text-align: center; 
              font-size: 9pt; 
              margin-top: 30px; /* Jarak dari atas */
              page-break-inside: avoid; /* Hindari page break di area TTD */
              width: 100%;
            }
            .signature-section div {
              flex: 1; /* Bagi rata ruang */
              padding-top: 40px; /* Ruang untuk TTD manual */
            }

            @media print {
              /* Sembunyikan elemen yang tidak perlu dicetak jika ada */
              button, input { display: none; } 
            }
        </style>
    </head><body>${content}</body></html>
        `);
        w.document.close();
        w.onload = () => { w.focus(); setTimeout(() => { w.print(); w.close(); }, 500); };
    },

    // ====================== PEWARNAAN SJ =======================
    // ====================== PEWARNAAN SJ =======================
async loadItemsForColoring() {
  this.elements.warnaTableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat data barang siap warna...</td></tr>';

  try {
    // ✅ Ambil langsung dari backend
    const response = await fetch(`${App.api.baseUrl}/api/barang-siap-warna`, {
      headers: {
        'Authorization': 'Bearer ' + (localStorage.getItem('token') || ''),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Gagal mengambil data dari server.');
    const items = await response.json();

    this.state.itemsForColoring = items || [];
    this.renderWarnaTable(this.state.itemsForColoring);
  } catch (error) {
    console.error('❌ loadItemsForColoring error:', error);
    this.elements.warnaTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error: ${error.message}</td></tr>`;
  }
},


    renderWarnaTable(items) {
        if (items.length === 0) {
            this.elements.warnaTableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Tidak ada barang siap warna.</td></tr>';
            return;
        }
        this.elements.warnaTableBody.innerHTML = items.map(item => `
            <tr data-id="${item.id}">
                <td class="p-2 text-center"><input type="checkbox" value="${item.id}"></td>
                <td class="p-2 text-sm">${item.nama_customer}</td>
                <td class="p-2 text-sm">${item.deskripsi}</td>
                <td class="p-2 text-sm text-center">${parseFloat(item.qty)}</td>
            </tr>
        `).join('');
    },

   async handlePrintWarnaSJ() {
    const selectedIds = [...this.elements.warnaTableBody.querySelectorAll('input:checked')].map(cb => parseInt(cb.value));
    if (selectedIds.length === 0) return alert('Pilih item yang akan dikirim.');

    const vendorName = this.elements.vendorSelect.value;
    if (!vendorName || vendorName === 'Pilih Vendor') return alert('Pilih Vendor Pewarnaan terlebih dahulu.');

    const itemsToSend = this.state.itemsForColoring.filter(item => selectedIds.includes(item.id));
    const data = {
        tipe: 'VENDOR',
        nama_tujuan: vendorName,
        items: itemsToSend,
        catatan: ''
    };

    this.elements.warnaPrintBtn.disabled = true;
    try {
        // ✅ kirim data ke backend untuk buat surat jalan dan update status di Google Sheet
        const result = await App.api.createSuratJalan(data);

        // ✅ render surat jalan pewarnaan dengan nomor dari backend
        this.renderWarnaSJ(result.no_sj || 'SJ-WRN-' + Date.now(), vendorName, itemsToSend);

        // ✅ buka jendela print
        this.printWarnaSJ();

        // ✅ reload data agar centang "di_warna" langsung muncul
        setTimeout(() => this.loadItemsForColoring(), 800);

        this.elements.warnaPrintBtn.disabled = false;
        alert('✅ Surat Jalan Pewarnaan berhasil dibuat dan status barang diperbarui.');
    } catch (error) {
        alert(`❌ Gagal membuat Surat Jalan Pewarnaan: ${error.message}`);
        this.elements.warnaPrintBtn.disabled = false;
    }
},


    renderWarnaSJ(no_sj, vendorName, items) {
        if (!items || items.length === 0) {
            this.elements.warnaPrintArea.innerHTML = "<h1 class='text-center'>ERROR: DATA BARANG KOSONG</h1>";
            return;
        }
        const tanggal = new Date().toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'});
        let totalQty = 0;
        const itemRows = items.map((item, index) => {
            const originalUkuran = parseFloat(item.ukuran) || 0;
            const ukuranDiproses = (originalUkuran > 0.2) ? (originalUkuran - 0.2).toFixed(2) : 0;
            const qty = parseFloat(item.qty) || 0;
            totalQty += qty;
            return `
                <tr style="page-break-inside: avoid;">
                    <td class="border p-1 text-center">${index + 1}</td>
                    <td class="border p-1 text-sm">${item.nama_customer || ''}</td>
                    <td class="border p-1 text-sm">${item.deskripsi || ''}</td>
                    <td class="border p-1 text-sm text-center">${ukuranDiproses}</td>
                    <td class="border p-1 text-sm text-center">${qty}</td>
                </tr>`;
        }).join('');

        this.elements.warnaPrintArea.innerHTML = `
            <div class="print-content">
                <div class="text-center mb-6">
                    <h2 class="text-xl font-bold">CV TOTO ALUMINIUM MANUFACTURE</h2>
                    <p class="text-sm">Rawa Mulya, Bekasi | Telp: 0813 1191 2002</p>
                    <h1 class="text-2xl font-extrabold mt-4 border-b-2 border-black pb-1">SURAT JALAN PEWARNAAN</h1>
                </div>
                <div class="grid grid-cols-2 text-sm mb-6">
                    <div>
                        <p class="font-bold">Kepada Yth (Vendor Pewarnaan):</p>
                        <p>Nama: <b>${vendorName}</b></p>
                        <p>Alamat:</p>
                        <p>Catatan: Barang siap diwarnai</p>
                    </div>
                    <div class="text-right">
                        <p>No. SJ: <b>${no_sj}</b></p>
                        <p>Tanggal: ${tanggal}</p>
                    </div>
                </div>
                <table class="w-full text-sm border-collapse border border-black">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="p-1 border w-1/12">No</th>
                            <th class="p-1 border w-3/12">Customer</th>
                            <th class="p-1 border w-4/12">Deskripsi Barang</th>
                            <th class="p-1 border w-2/12">Ukuran (Net)</th>
                            <th class="p-1 border w-2/12">Qty (Total)</th>
                        </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" class="p-1 border text-right font-bold">TOTAL QTY:</td>
                            <td class="p-1 border text-center font-bold">${totalQty}</td>
                        </tr>
                    </tfoot>
                </table>
               <div style="display: flex; justify-content: space-around; text-align: center; font-size: 9pt; margin-top: 60px; page-break-inside: avoid;">
                    <div style="flex: 1;">Dibuat Oleh,<br><br><br><br>(..................)</div>
                    <div style="flex: 1;">Pengirim,<br><br><br><br>(..................)</div>
                    <div style="flex: 1;">Penerima,<br><br><br><br>(..................)</div>
                </div>
                <div class="mt-4 text-xs text-right">
                    *Ukuran Net = Ukuran asli dikurangi 0.2
                </div>
            </div>`;
    },

    printWarnaSJ() {
        const area = this.elements.warnaPrintArea;
        if (!area || !area.innerHTML.trim()) return alert("Tidak ada Surat Jalan Pewarnaan untuk dicetak.");
        const content = area.innerHTML;
        const w = window.open('', '_blank', 'width=1000,height=700');
        w.document.write(`
            <html><head>
        <title>Surat Jalan Pewarnaan</title>
        <style>
            /* --- CSS UKURAN KERTAS HALF CONTINUOUS --- */
            @page { 
              size: 216mm 279mm; /* Sekitar 9.5 x 5.5 inci */
              margin: 8mm; /* Sesuaikan margin jika perlu (misal: 5mm, 10mm) */
            } 
            body { 
              font-family: 'Courier New', monospace; /* Font umum dot matrix */
              font-size: 10pt; /* Sedikit diperbesar agar mudah dibaca */
              margin: 0; 
              padding: 0;
              color: #000; 
            }
            .print-content { /* Pastikan konten utama dibungkus div ini */
              width: 100%;
              box-sizing: border-box;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              font-size: 9pt; /* Ukuran font tabel bisa lebih kecil */
              table-layout: auto; /* Atau 'fixed' jika perlu lebar kolom spesifik */
            }
            th, td { 
              border: 1px solid #000; 
              padding: 3px 5px; /* Sesuaikan padding tabel */
              overflow-wrap: break-word; /* Bantu wrap teks panjang */
               word-wrap: break-word;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-sm { font-size: 9pt; } /* Ukuran font kecil */
            .text-xl { font-size: 14pt; } /* Sesuaikan ukuran judul */
            .text-2xl { font-size: 16pt; } /* Sesuaikan ukuran judul utama */

            /* Atur ulang jarak (sesuaikan jika perlu) */
            .mb-6 { margin-bottom: 0.5rem; } 
            .mt-4 { margin-top: 0.5rem; }
            .mt-16 { margin-top: 0.5rem; } 

            /* Tanda Tangan Horizontal (Gunakan div pembungkus jika belum) */
            .signature-section { 
              display: flex; 
              justify-content: space-around; 
              text-align: center; 
              font-size: 9pt; 
              margin-top: 30px; /* Jarak dari atas */
              page-break-inside: avoid; /* Hindari page break di area TTD */
              width: 100%;
            }
            .signature-section div {
              flex: 1; /* Bagi rata ruang */
              padding-top: 40px; /* Ruang untuk TTD manual */
            }

            @media print {
              /* Sembunyikan elemen yang tidak perlu dicetak jika ada */
              button, input { display: none; } 
            }
        </style>
    </head><body>${content}</body></html>
        `);
        w.document.close();
        w.onload = () => { w.focus(); setTimeout(() => { w.print(); w.close(); }, 500); };
    }
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

// ======================================================
// ⚙️ HANDLERS: LOGIN, LOGOUT, NAVIGATION
// ======================================================
App.handlers = {
    async handleLogin(e) {
        e.preventDefault();
        try {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            if (!username || !password)
                throw new Error('Username dan password wajib diisi.');

            const response = await App.api.checkLogin(username, password);
            if (response && response.token) {
                // ✅ Simpan token di localStorage
                localStorage.setItem('authToken', response.token);
                localStorage.setItem('username', response.user.username);
                localStorage.setItem('role', response.user.role);

                // ✅ Redirect ke dashboard
                window.location.href = 'dashboard.html';
            } else {
                throw new Error('Login gagal. Token tidak diterima.');
            }
        } catch (error) {
            const loginError = document.getElementById('login-error');
            loginError.textContent = error.message || 'Terjadi kesalahan saat login.';
            loginError.classList.remove('hidden');
        }
    },

    handleLogout() {
        // 🔓 Bersihkan semua data login
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        localStorage.removeItem('role');

        // 🔁 Kembali ke halaman login
        window.location.href = 'index.html';
    },

    handleNavigation(e) {
        const link = e.target.closest('a');
        if (!link || link.getAttribute('href') !== '#') return;

        e.preventDefault();
        const parentCollapsible = link.closest('.collapsible');
        if (parentCollapsible && link.classList.contains('sidebar-item')) {
            const submenu = parentCollapsible.querySelector('.submenu');
            const submenuToggle = parentCollapsible.querySelector('.submenu-toggle');
            if (submenu) submenu.classList.toggle('hidden');
            if (submenuToggle) submenuToggle.classList.toggle('rotate-180');
        }
    },

    handleSidebarToggle() {
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            const isCollapsing = !appContainer.classList.contains('sidebar-collapsed');
            appContainer.classList.toggle('sidebar-collapsed');
            if (isCollapsing) {
                document.querySelectorAll('#sidebar .submenu').forEach(submenu => submenu.classList.add('hidden'));
                document.querySelectorAll('#sidebar .submenu-toggle').forEach(toggle => toggle.classList.remove('rotate-180'));
            }
        }
    }
}; // ⬅️ pastikan ini diakhiri dengan titik koma dan tidak ada "{" setelahnya


// ======================================================
// 🚀 INISIALISASI APP (Versi Stabil untuk Tabulator Page)
// ======================================================
App.init = async function() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    console.log("🔍 Halaman aktif:", path);

    if (path === 'index.html' || path === '') {
        // Jika user sudah login, arahkan ke dashboard
        if (localStorage.getItem('authToken')) {
            console.log("✅ User sudah login, arahkan ke dashboard...");
            window.location.href = 'dashboard.html';
            return;
        }

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            console.log("📋 Menunggu user login...");
            loginForm.addEventListener('submit', (e) => this.handlers.handleLogin(e));
        } else {
            console.warn("⚠️ Form login tidak ditemukan di halaman ini.");
        }

    } else {
        // Pastikan token valid
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn("🚫 Token hilang, arahkan ulang ke login...");
            window.location.href = 'index.html';
            return;
        }

        // Muat layout
        await this.loadLayout();

        // Tunggu sebentar supaya DOM dari layout benar-benar siap
        await new Promise(resolve => setTimeout(resolve, 200));

        // Ambil nama halaman
        const pageName = path.replace('.html', '');
        console.log("📄 Memuat halaman:", pageName);

        // Jalankan init()
        if (this.pages[pageName]?.init) {
            console.log(`⚙️ Jalankan init() untuk ${pageName} (dengan delay agar layout siap)`);
            this.pages[pageName].init();
        }

        // Deteksi apakah halaman pakai Tabulator
        const usesTabulator = document.querySelector('[id*="grid"]') !== null;

        // Jika tidak pakai Tabulator → load langsung
        if (this.pages[pageName]?.load && !usesTabulator) {
            console.log(`📥 Jalankan load() untuk ${pageName}`);
            this.pages[pageName].load();
        } else if (usesTabulator) {
            console.log("⏳ Halaman Tabulator terdeteksi, load() akan dipicu dari tableBuilt...");
        }
    }
};



// ============================================================
// ✅ BATAS TAMBAHAN MENU ADMIN HANYA UNTUK FAISAL
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Fungsi bantu tunggu sidebar muncul
  const waitForSidebar = (callback) => {
    const check = setInterval(() => {
      const sidebar = document.getElementById("sidebar");
      const adminMenu = document.getElementById("admin-menu");
      if (sidebar && adminMenu) {
        clearInterval(check);
        callback();
      }
    }, 300);
  };

  waitForSidebar(async () => {
    try {
      // 1️⃣ Ambil data user dari server (jika token masih aktif)
      let username = "";
      try {
        const user = await App.api.getCurrentUser();
        username = (user?.username || "").toLowerCase();
      } catch {
        // Jika API gagal, fallback ke localStorage
        const localUser =
          JSON.parse(localStorage.getItem("userData")) ||
          JSON.parse(localStorage.getItem("user")) ||
          {};
        username = (localUser.username || localUser.name || "").toLowerCase();
      }

      // 2️⃣ Dapatkan elemen menu admin
      const adminMenu = document.getElementById("admin-menu");

      // 3️⃣ Jika bukan Faisal, sembunyikan menu
      if (username !== "faisal") {
        if (adminMenu) adminMenu.style.display = "none";
        console.log("Menu Admin disembunyikan untuk user:", username);
      } else {
        console.log("Menu Admin aktif untuk Faisal ✅");
      }
    } catch (err) {
      console.error("Gagal memeriksa user login:", err);
    }
  });
});


document.addEventListener('DOMContentLoaded', () => {
    App.init();
});