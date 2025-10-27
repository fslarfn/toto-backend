

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

// ===================================
// API (Berkomunikasi dengan Backend)
// ===================================
App.api = {
    baseUrl: window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://erptoto.up.railway.app',
  async request(endpoint, options = {}) {
    const finalEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
    const url = `${this.baseUrl}${finalEndpoint}`;
    const token = localStorage.getItem('authToken');
    const headers = { 
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
    const config = { ...options, headers };
    const response = await fetch(url, config);
    if (!response.ok) throw new Error('API Error');
    return response.json();
  },

    checkLogin(username, password) { return this.request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }); },
    
    // API Profil & User
    getCurrentUser() { return this.request('/me'); },
    updateUserProfile(formData) { return this.request('/user/profile', { method: 'PUT', body: formData }); },
    changePassword(data) { return this.request('/user/change-password', { method: 'PUT', body: JSON.stringify(data) }); },

updateWorkOrderPartial(id, data) {
  return this.request(`/workorders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
},

    
    getDashboardData(month, year) { return this.request(`/dashboard?month=${month}&year=${year}`); },
    getKaryawan() { return this.request('/karyawan'); },
    addKaryawan(data) { return this.request('/karyawan', { method: 'POST', body: JSON.stringify(data) }); },
    updateKaryawan(id, data) { return this.request(`/karyawan/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    deleteKaryawan(id) { return this.request(`/karyawan/${id}`, { method: 'DELETE' }); },
    getKaryawanById(id) { return this.request(`/karyawan/${id}`); },
    processPayroll(data) { return this.request('/payroll', { method: 'POST', body: JSON.stringify(data) }); },
    
    // --- [PERBAIKAN] getWorkOrders sekarang menerima 'status' ---
    getWorkOrders(month, year, customer = '', status = '') { // 1. Tambahkan parameter 'status'
        let endpoint = `/workorders?month=${month}&year=${year}`;
        if (customer) {
            endpoint += `&customer=${encodeURIComponent(customer)}`;
        }
        if (status) { // 2. Tambahkan 'status' ke query jika ada
            endpoint += `&status=${encodeURIComponent(status)}`;
        }
        return this.request(endpoint);
    },
    // --- [AKHIR PERBAIKAN] ---
  
    
    addWorkOrder(data) { return this.request('/workorders', { method: 'POST', body: JSON.stringify(data) }); },
    updateWorkOrder(id, data) { return this.request(`/workorders/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    deleteWorkOrder(id) { return this.request(`/workorders/${id}`, { method: 'DELETE' }); },
    updateWorkOrderStatus(id, columnName, value) { return this.request(`/workorders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ columnName, value }) }); },
    markWorkOrdersPrinted(ids) { return this.request('/workorders/mark-printed', { method: 'POST', body: JSON.stringify({ ids }) }); },
    getStok() { return this.request('/stok'); },
    addBahan(data) { return this.request('/stok', { method: 'POST', body: JSON.stringify(data) }); },
    updateStok(data) { return this.request('/stok/update', { method: 'POST', body: JSON.stringify(data) }); },
    getInvoiceData(inv) { return this.request(`/invoice/${inv}`); },
    getInvoiceSummary(month, year) { return this.request(`/invoices/summary?month=${month}&year=${year}`); },
    createSuratJalan(data) { return this.request('/surat-jalan', { method: 'POST', body: JSON.stringify(data) }); },
    getSaldoKeuangan() { return this.request('/keuangan/saldo'); },
    addTransaksiKeuangan(data) { return this.request('/keuangan/transaksi', { method: 'POST', body: JSON.stringify(data) }); },
    getRiwayatKeuangan(month, year) { return this.request(`/keuangan/riwayat?month=${month}&year=${year}`); },
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
            // ✅ Tambahkan validasi token agar tidak error “Token tidak ditemukan”
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Token tidak ditemukan. Silakan login ulang.');

            // ✅ Perbaikan fetch dashboard agar aman dari response kosong / error 500
            const res = await fetch(`${API_URL}/api/dashboard?month=${month}&year=${year}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `API Error (${res.status})`);
            }

            const summaryData = await res.json();
            console.log('[Dashboard] Data diterima:', summaryData);

            // ✅ Validasi data agar tidak undefined
            if (!summaryData.summary || !summaryData.statusCounts) {
                throw new Error('Data dashboard tidak lengkap.');
            }

            // Render data dashboard
            this.renderSummaryCards(summaryData);
            this.setActiveStatusView(this.state.currentStatusView);

        } catch (error) {
            console.error('[Dashboard] Error saat memuat data:', error);
            alert(`Gagal memuat data dashboard: ${error.message}`);
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

// ===============================================
//               WORK ORDERS PAGE
// ===============================================
App.pages['work-orders'] = {
    state: { isEditing: false, workOrders: [], selectedForPO: new Set() },
    elements: {},

    init() {
        this.elements = {
            monthFilter: document.getElementById('wo-month-filter'),
            yearFilter: document.getElementById('wo-year-filter'),
            filterBtn: document.getElementById('filter-wo-btn'),
            addBtn: document.getElementById('add-wo-btn'),
            tableBody: document.getElementById('workorders-table-body'),
            createPoBtn: document.getElementById('create-po-btn'),
            poCountSpan: document.getElementById('po-selection-count'),
            selectAllCheckbox: document.getElementById('select-all-wo'),
        };

        this.elements.filterBtn.addEventListener('click', () => this.load());
        this.elements.addBtn.addEventListener('click', () => this.handleAddNew());
        this.elements.createPoBtn.addEventListener('click', () => this.handleCreatePO());
        this.elements.tableBody.addEventListener('click', (e) => this.handleTableClick(e));
        this.elements.selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e));

        App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    },

    async load() {
        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;

        this.elements.tableBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center">Memuat...</td></tr>';

        try {
            const data = await App.api.getWorkOrders(month, year);
            this.state.workOrders = data;
            this.state.selectedForPO.clear();
            this.render();
            this.updatePOButton();
        } catch (error) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
        }
    },

    render() {
        if (this.state.workOrders.length === 0) {
            this.elements.tableBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center">Tidak ada data.</td></tr>';
            return;
        }
        this.elements.tableBody.innerHTML = this.state.workOrders.map(wo => this.createRowHtml(wo)).join('');
    },

    createRowHtml(wo) {
        const isPrinted = wo.po_status === 'PRINTED';
        return `
            <tr data-id="${wo.id}" class="${isPrinted ? 'bg-gray-100 text-gray-500' : ''}">
                <td class="px-4 py-4"><input type="checkbox" class="wo-checkbox" value="${wo.id}" ${isPrinted ? 'disabled' : ''}></td>
                <td class="px-2 py-2 whitespace-nowrap">
                    <div class="flex gap-1">
                        <button class="edit-btn p-1 text-blue-600 rounded ${isPrinted ? 'opacity-50 cursor-not-allowed' : ''}" ${isPrinted ? 'disabled' : ''}>Edit</button>
                        <button class="delete-btn p-1 text-red-600 rounded ${isPrinted ? 'opacity-50 cursor-not-allowed' : ''}" ${isPrinted ? 'disabled' : ''}>Hapus</button>
                    </div>
                </td>
                <td>${new Date(wo.tanggal).toLocaleDateString('id-ID')}</td>
                <td>${wo.nama_customer || ''}</td>
                <td>${wo.deskripsi || ''}</td>
                <td class="text-center">${wo.ukuran || '-'}</td>
                <td class="text-center">${wo.qty || '-'}</td>
            </tr>
        `;
    },

    updatePOButton() {
        const count = this.state.selectedForPO.size;
        this.elements.poCountSpan.textContent = count;
        this.elements.createPoBtn.disabled = count === 0;
    },

    handleSelectAll(e) {
        const isChecked = e.target.checked;
        this.elements.tableBody.querySelectorAll('.wo-checkbox:not(:disabled)').forEach(cb => {
            cb.checked = isChecked;
            const id = parseInt(cb.value);
            if (isChecked) this.state.selectedForPO.add(id);
            else this.state.selectedForPO.delete(id);
        });
        this.updatePOButton();
    },

    handleTableClick(e) {
        const target = e.target;
        if (target.classList.contains('wo-checkbox')) {
            const id = parseInt(target.value);
            if (target.checked) this.state.selectedForPO.add(id);
            else this.state.selectedForPO.delete(id);
            this.updatePOButton();
            return;
        }
        const row = target.closest('tr');
        if (!row) return;

        if (target.classList.contains('edit-btn')) this.handleEdit(row);
        if (target.classList.contains('delete-btn')) this.handleDelete(row);
        if (target.classList.contains('save-new-btn')) this.handleSaveNew(row);
        if (target.classList.contains('cancel-new-btn')) { row.remove(); this.state.isEditing = false; }
        if (target.classList.contains('save-update-btn')) this.handleSaveUpdate(row);
        if (target.classList.contains('cancel-update-btn')) { this.state.isEditing = false; this.render(); }
    },

    handleCreatePO() {
        const selectedData = this.state.workOrders.filter(wo => this.state.selectedForPO.has(wo.id));
        sessionStorage.setItem('poData', JSON.stringify(selectedData));
        window.location.href = 'print-po.html';
    },

    handleAddNew() {
        if (this.state.isEditing) return alert('Selesaikan baris yang sedang diedit.');
        this.state.isEditing = true;
        const newRow = this.elements.tableBody.insertRow(0);
        newRow.id = 'new-row';
        newRow.classList.add('editing-row');
        const today = new Date().toISOString().split('T')[0];
        newRow.innerHTML = `
            <td class="px-4 py-4"><input type="checkbox" disabled></td>
            <td class="px-2 py-2">
                <div class="flex gap-1">
                    <button class="save-new-btn p-1 text-green-600">Simpan</button>
                    <button class="cancel-new-btn p-1 text-gray-600">Batal</button>
                </div>
            </td>
            <td class="p-1"><input type="date" name="tanggal" value="${today}" class="w-36"></td>
            <td class="p-1"><input type="text" name="nama_customer" class="w-48"></td>
            <td class="p-1"><input type="text" name="deskripsi" class="w-full"></td>
            <td class="p-1"><input type="number" name="ukuran" step="any" placeholder="0" class="w-20"></td>
            <td class="p-1"><input type="number" name="qty" placeholder="0" class="w-20"></td>
        `;
    },

    async handleSaveNew(row) {
        const data = {};
        row.querySelectorAll('input[name]').forEach(input => data[input.name] = input.value);
        try {
            await App.api.addWorkOrder(data);
            this.state.isEditing = false;
            await this.load();
        } catch (error) {
            alert(`Gagal menyimpan: ${error.message}`);
        }
    },

    handleEdit(row) {
        if (this.state.isEditing) return alert('Selesaikan baris yang sedang diedit.');
        this.state.isEditing = true;
        row.classList.add('editing-row');
        const id = row.dataset.id;
        const wo = this.state.workOrders.find(w => w.id == id);
        const formattedDate = new Date(wo.tanggal).toISOString().split('T')[0];

        row.innerHTML = `
            <td><input type="checkbox" disabled></td>
            <td><div class="flex gap-1"><button class="save-update-btn p-1 text-green-600">Simpan</button><button class="cancel-update-btn p-1 text-gray-600">Batal</button></div></td>
            <td><input type="date" name="tanggal" value="${formattedDate}" class="w-36"></td>
            <td><input type="text" name="nama_customer" value="${wo.nama_customer || ''}" class="w-48"></td>
            <td><input type="text" name="deskripsi" value="${wo.deskripsi || ''}" class="w-full"></td>
            <td><input type="number" name="ukuran" step="any" value="${wo.ukuran || ''}" class="w-20"></td>
            <td><input type="number" name="qty" value="${wo.qty || ''}" class="w-20"></td>
        `;
    },

    async handleSaveUpdate(row) {
        const id = row.dataset.id;
        const data = {};
        row.querySelectorAll('input[name]').forEach(input => data[input.name] = input.value);
        try {
            await App.api.updateWorkOrder(id, data);
            this.state.isEditing = false;
            await this.load();
        } catch (error) {
            alert(`Gagal update: ${error.message}`);
        }
    },

    async handleDelete(row) {
        const id = row.dataset.id;
        const customer = row.cells[3].textContent;
        if (confirm(`Yakin ingin menghapus order untuk ${customer}?`)) {
            try {
                await App.api.deleteWorkOrder(id);
                await this.load();
            } catch (error) {
                alert(`Gagal menghapus: ${error.message}`);
            }
        }
    }
};

// ===============================================
//               STATUS BARANG PAGE
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

        this.elements.tableBody.innerHTML = `<tr><td colspan="13" class="p-4 text-center">Memuat data...</td></tr>`;

        try {
            const data = await App.api.getWorkOrders(month, year, customerName);
            this.state.workOrders = data;
            this.render();
        } catch (error) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="13" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
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

        // Format tanggal biar rapi
        const tanggal = wo.tanggal
            ? new Date(wo.tanggal).toLocaleDateString('id-ID', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })
            : '-';

        return `
            <tr data-id="${wo.id}">
                <td class="px-6 py-4 text-sm text-center">${tanggal}</td>
                <td class="px-6 py-4 text-sm font-medium">${wo.nama_customer || ''}</td>
                <td class="px-6 py-4 text-sm">${wo.deskripsi || ''}</td>
                <td class="px-6 py-4 text-sm text-center">${ukuran}</td>
                <td class="px-6 py-4 text-sm text-center">${qty}</td>
                <td class="p-1 text-center">
                    <input type="number" data-column="harga" value="${harga || ''}"
                        class="w-28 text-sm text-right border-gray-300 rounded-md p-1"
                        placeholder="0">
                </td>
                <td class="px-6 py-4 text-sm text-right font-medium">
                    ${(total || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
                </td>
                <td class="p-1 text-center">
                    <input type="text" data-column="no_inv" value="${wo.no_inv || ''}"
                        class="w-24 text-sm text-center border-gray-300 rounded-md p-1"
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
                        class="w-full text-sm p-1 border-gray-300 rounded-md"
                        placeholder="Ketik ekspedisi...">
                </td>
            </tr>
        `;
    }).join('');
},


    handleStatusUpdate(e) {
        if (e.target.type !== 'checkbox') return;
        const element = e.target;
        const row = element.closest('tr');
        const id = row.dataset.id;
        const columnName = element.dataset.column;
        const value = element.checked;
        this.updateApi(id, { [columnName]: value });
    },

    handleInputUpdate(e) {
        const el = e.target;
        if (!el.dataset.column) return;
        const row = el.closest('tr');
        const id = row.dataset.id;
        const columnName = el.dataset.column;
        const value = el.value;
        clearTimeout(this.state.debounceTimer);
        this.state.debounceTimer = setTimeout(() => {
            this.updateApi(id, { [columnName]: value }, row);
        }, 600);
    },

    updateApi(id, data, row = null) {
        this.elements.indicator.classList.remove('opacity-0');
        App.api.updateWorkOrderPartial(id, data)
            .then(() => {
                if (row && data.harga !== undefined) {
                    const harga = parseFloat(row.querySelector('[data-column="harga"]').value) || 0;
                    const qty = parseFloat(row.children[3].textContent) || 0;
                    const ukuran = parseFloat(row.children[2].textContent) || 0;
                    const total = harga * qty * ukuran;
                    row.querySelector('.total-cell').textContent = App.ui.formatCurrency(total);
                }
                setTimeout(() => this.elements.indicator.classList.add('opacity-0'), 1200);
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
    async loadItemsForColoring() {
        this.elements.warnaTableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat...</td></tr>';
        try {
            const allItems = await App.api.getWorkOrders(new Date().getMonth() + 1, new Date().getFullYear());
            const itemsToColor = allItems.filter(item => item.po_status === 'PRINTED' && !item.di_warna);
            this.state.itemsForColoring = itemsToColor;
            this.renderWarnaTable(itemsToColor);
        } catch (error) {
            this.elements.warnaTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
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
App.getUserFromToken = function() {
    // ✅ Ambil token dari salah satu kunci
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    } catch (e) {
        console.error('Gagal membaca payload token:', e);
        return null;
    }
};


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

        this.elements = { ...this.elements,
            sidebar: document.getElementById('sidebar'),
            sidebarNav: document.getElementById('sidebar-nav'),
            logoutButton: document.getElementById('logout-button'),
            userDisplay: document.getElementById('user-display'),
            userAvatar: document.getElementById('user-avatar'), // Baru
            pageTitle: document.getElementById('page-title'),
            sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        };

        if (this.elements.logoutButton) this.elements.logoutButton.addEventListener('click', this.handlers.handleLogout);
        if (this.elements.sidebarNav) this.elements.sidebarNav.addEventListener('click', this.handlers.handleNavigation);
        if (this.elements.sidebarToggleBtn) this.elements.sidebarToggleBtn.addEventListener('click', this.handlers.handleSidebarToggle);

        // Ambil data user dari API dan tampilkan di header
        const user = await App.api.getCurrentUser();
        if (user) {
            this.elements.userDisplay.textContent = `Welcome, ${user.username}`;
            if (user.profile_picture_url) {
                this.elements.userAvatar.src = user.profile_picture_url;
                this.elements.userAvatar.classList.remove('hidden');
            } else {
                this.elements.userAvatar.classList.add('hidden');
            }
        }
        
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
        console.error("Gagal memuat layout:", error);
    }
};

App.handlers = {
    async handleLogin(e) {
        e.preventDefault();
        try {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const response = await App.api.checkLogin(username, password);
            if (response && response.token) {
                localStorage.setItem('authToken', response.token);
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            const loginError = document.getElementById('login-error');
            loginError.textContent = error.message;
            loginError.classList.remove('hidden');
        }
    },
    handleLogout() {
        localStorage.removeItem('authToken');
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
};

App.init = async function() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    if (path === 'index.html' || path === '') {
        this.elements.loginForm = document.getElementById('login-form');
        if (this.elements.loginForm) {
            this.elements.loginForm.addEventListener('submit', (e) => this.handlers.handleLogin(e));
        }
    } else {
        if (!localStorage.getItem('authToken')) {
            window.location.href = 'index.html';
            return;
        }
        await this.loadLayout();
        const pageName = path.replace('.html', '');
        if (this.pages[pageName] && typeof this.pages[pageName].init === 'function') {
            this.pages[pageName].init();
        }
        if (this.pages[pageName] && typeof this.pages[pageName].load === 'function') {
            this.pages[pageName].load();
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