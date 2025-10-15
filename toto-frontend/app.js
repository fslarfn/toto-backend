// Objek utama aplikasi
const App = {
    state: {},
    elements: {},
    pages: {
        'work-orders': {},
        'status-barang': {},
        'print-po': {},
        'stok-bahan': {},
        'surat-jalan': {}
    },
};

// ===================================
// API (Berkomunikasi dengan Backend)
// ===================================
App.api = {
    baseUrl: 'http://localhost:5000/api',
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        const token = localStorage.getItem('authToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const config = { ...options, headers };
        const response = await fetch(url, config);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Terjadi kesalahan pada API');
        }
        if (response.status === 204) return;
        return response.json();
    },
    checkLogin(username, password) { return this.request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }); },
    getWorkOrders(month, year) { return this.request(`/workorders?month=${month}&year=${year}`); },
    addWorkOrder(data) { return this.request('/workorders', { method: 'POST', body: JSON.stringify(data) }); },
    updateWorkOrder(id, data) { return this.request(`/workorders/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
    deleteWorkOrder(id) { return this.request(`/workorders/${id}`, { method: 'DELETE' }); },
    updateWorkOrderStatus(id, columnName, value) { return this.request(`/workorders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ columnName, value }) }); },
    markWorkOrdersPrinted(ids) { return this.request('/workorders/mark-printed', { method: 'POST', body: JSON.stringify({ ids }) }); },
    getStok() { return this.request('/stok'); },
    addBahan(data) { return this.request('/stok', { method: 'POST', body: JSON.stringify(data) }); },
    updateStok(data) { return this.request('/stok/update', { method: 'POST', body: JSON.stringify(data) }); },
    getInvoiceData(inv) { return this.request(`/invoice/${inv}`); },
    createSuratJalan(data) { return this.request('/surat-jalan', { method: 'POST', body: JSON.stringify(data) }); }
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
    }
};

// ===================================
// Logika Halaman Work Order
// ===================================
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
        this.elements.tableBody.addEventListener('input', (e) => this.handleCalculation(e));
        this.elements.selectAllCheckbox.addEventListener('change', (e) => this.handleSelectAll(e));
        App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    },
    async load() {
        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;
        this.elements.tableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center">Memuat...</td></tr>';
        try {
            const data = await App.api.getWorkOrders(month, year);
            this.state.workOrders = data;
            this.state.selectedForPO.clear();
            this.render();
            this.updatePOButton();
        } catch (error) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
        }
    },
    render() {
        if (this.state.workOrders.length === 0) {
            this.elements.tableBody.innerHTML = '<tr><td colspan="10" class="p-4 text-center">Tidak ada data.</td></tr>';
            return;
        }
        this.elements.tableBody.innerHTML = this.state.workOrders.map(wo => this.createRowHtml(wo)).join('');
    },
    createRowHtml(wo) {
        const total = (wo.ukuran || 0) * (wo.qty || 0) * (wo.harga || 0);
        const isPrinted = wo.po_status === 'PRINTED';
        return `
            <tr data-id="${wo.id}" class="${isPrinted ? 'bg-gray-100 text-gray-500' : ''}">
                <td class="px-4 py-4"><input type="checkbox" class="wo-checkbox" value="${wo.id}" ${isPrinted ? 'disabled' : ''}></td>
                <td class="px-2 py-2 whitespace-nowrap"><div class="flex gap-1">
                    <button class="edit-btn p-1 text-blue-600 rounded ${isPrinted ? 'opacity-50 cursor-not-allowed' : ''}" ${isPrinted ? 'disabled' : ''}>Edit</button>
                    <button class="delete-btn p-1 text-red-600 rounded ${isPrinted ? 'opacity-50 cursor-not-allowed' : ''}" ${isPrinted ? 'disabled' : ''}>Hapus</button>
                </div></td>
                <td>${new Date(wo.tanggal).toLocaleDateString('id-ID')}</td><td>${wo.nama_customer}</td>
                <td>${wo.deskripsi}</td><td>${wo.ukuran}</td><td>${parseFloat(wo.qty) || ''}</td>
                <td>${App.ui.formatCurrency(wo.harga)}</td><td class="font-medium">${App.ui.formatCurrency(total)}</td><td>${wo.no_inv}</td>
            </tr>`;
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
            <td class="px-2 py-2"><div class="flex gap-1"><button class="save-new-btn p-1 text-green-600">Simpan</button><button class="cancel-new-btn p-1 text-gray-600">Batal</button></div></td>
            <td class="p-1"><input type="date" name="tanggal" value="${today}" class="w-36"></td>
            <td class="p-1"><input type="text" name="nama_customer" class="w-48"></td>
            <td class="p-1"><input type="text" name="deskripsi" class="w-full"></td>
            <td class="p-1"><input type="number" name="ukuran" step="any" placeholder="0" class="w-20"></td>
            <td class="p-1"><input type="number" name="qty" placeholder="0" class="w-20"></td>
            <td class="p-1"><input type="number" name="harga" placeholder="0" class="w-28"></td>
            <td class="p-1 total-cell text-sm font-medium">${App.ui.formatCurrency(0)}</td>
            <td class="p-1"><input type="text" name="no_inv" class="w-24"></td>
        `;
    },
    async handleSaveNew(row) {
        const data = {};
        row.querySelectorAll('input[name]').forEach(input => data[input.name] = input.value);
        try {
            await App.api.addWorkOrder(data);
            this.state.isEditing = false;
            await this.load();
        } catch (error) { alert(`Gagal menyimpan: ${error.message}`); }
    },
    handleEdit(row) {
        if (this.state.isEditing) return alert('Selesaikan baris yang sedang diedit.');
        this.state.isEditing = true;
        row.classList.add('editing-row');
        const id = row.dataset.id;
        const wo = this.state.workOrders.find(w => w.id == id);
        const formattedDate = new Date(wo.tanggal).toISOString().split('T')[0];
        const total = (wo.ukuran || 0) * (wo.qty || 0) * (wo.harga || 0);
        row.innerHTML = `
            <td class="px-4 py-4"><input type="checkbox" class="wo-checkbox" value="${wo.id}" disabled></td>
            <td class="px-2 py-2"><div class="flex gap-1"><button class="save-update-btn p-1 text-green-600">Simpan</button><button class="cancel-update-btn p-1 text-gray-600">Batal</button></div></td>
            <td class="p-1"><input type="date" name="tanggal" value="${formattedDate}" class="w-36"></td>
            <td class="p-1"><input type="text" name="nama_customer" value="${wo.nama_customer || ''}" class="w-48"></td>
            <td class="p-1"><input type="text" name="deskripsi" value="${wo.deskripsi || ''}" class="w-full"></td>
            <td class="p-1"><input type="number" name="ukuran" step="any" value="${wo.ukuran || ''}" class="w-20"></td>
            <td class="p-1"><input type="number" name="qty" value="${wo.qty || ''}" class="w-20"></td>
            <td class="p-1"><input type="number" name="harga" value="${wo.harga || ''}" class="w-28"></td>
            <td class="p-1 total-cell text-sm font-medium">${App.ui.formatCurrency(total)}</td>
            <td class="p-1"><input type="text" name="no_inv" value="${wo.no_inv || ''}" class="w-24"></td>
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
        } catch (error) { alert(`Gagal update: ${error.message}`); }
    },
    async handleDelete(row) {
        const id = row.dataset.id;
        const customer = row.cells[3].textContent;
        if (confirm(`Yakin ingin menghapus order untuk ${customer}?`)) {
            try {
                await App.api.deleteWorkOrder(id);
                await this.load();
            } catch (error) { alert(`Gagal menghapus: ${error.message}`); }
        }
    },
    handleCalculation(e) {
        if (e.target.tagName !== 'INPUT' || !['ukuran', 'qty', 'harga'].includes(e.target.name)) return;
        const row = e.target.closest('tr');
        if (!row) return;
        const ukuran = parseFloat(row.querySelector('[name="ukuran"]').value) || 0;
        const qty = parseFloat(row.querySelector('[name="qty"]').value) || 0;
        const harga = parseFloat(row.querySelector('[name="harga"]').value) || 0;
        const totalCell = row.querySelector('.total-cell');
        if (totalCell) {
            totalCell.textContent = App.ui.formatCurrency(ukuran * qty * harga);
        }
    }
};

// ===================================
// Logika Halaman Status Barang
// ===================================
App.pages['status-barang'] = {
    state: { workOrders: [], debounceTimer: null },
    elements: {},
    init() {
        this.elements = {
            monthFilter: document.getElementById('status-month-filter'),
            yearFilter: document.getElementById('status-year-filter'),
            filterBtn: document.getElementById('filter-status-btn'),
            tableBody: document.getElementById('status-table-body'),
            indicator: document.getElementById('status-update-indicator')
        };
        this.elements.filterBtn.addEventListener('click', () => this.load());
        this.elements.tableBody.addEventListener('change', (e) => this.handleStatusUpdate(e));
        this.elements.tableBody.addEventListener('input', (e) => this.handleEkspedisiUpdate(e));
        App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    },
    async load() {
        const month = this.elements.monthFilter.value;
        const year = this.elements.yearFilter.value;
        this.elements.tableBody.innerHTML = `<tr><td colspan="10" class="p-4 text-center">Memuat...</td></tr>`;
        try {
            const data = await App.api.getWorkOrders(month, year);
            this.state.workOrders = data;
            this.render();
        } catch (error) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
        }
    },
    render() {
        if (this.state.workOrders.length === 0) {
            this.elements.tableBody.innerHTML = `<tr><td colspan="10" class="p-4 text-center">Tidak ada data untuk periode ini.</td></tr>`;
            return;
        }
        const statusColumns = ['di_produksi', 'di_warna', 'siap_kirim', 'di_kirim', 'pembayaran'];
        this.elements.tableBody.innerHTML = this.state.workOrders.map(wo => `
            <tr data-id="${wo.id}">
                <td class="px-6 py-4 text-sm font-medium">${wo.nama_customer || ''}</td>
                <td class="px-6 py-4 text-sm">${wo.deskripsi || ''}</td>
                <td class="px-6 py-4 text-sm text-center">${wo.ukuran || '-'}</td>
                <td class="px-6 py-4 text-sm text-center">${parseFloat(wo.qty) || 0}</td>
                ${statusColumns.map(col => `
                    <td class="px-6 py-4 text-center">
                        <input type="checkbox" data-column="${col}" class="h-4 w-4 rounded" ${wo[col] ? 'checked' : ''}>
                    </td>
                `).join('')}
                <td class="p-1">
                    <input type="text" data-column="ekspedisi" value="${wo.ekspedisi || ''}" 
                           class="w-full text-sm p-1 border-gray-300 rounded-md" 
                           placeholder="Ketik ekspedisi...">
                </td>
            </tr>
        `).join('');
    },
    handleStatusUpdate(e) {
        if (e.target.type !== 'checkbox') return;
        const element = e.target;
        const row = element.closest('tr');
        const id = row.dataset.id;
        const columnName = element.dataset.column;
        const value = element.checked;
        this.updateApi(id, columnName, value, () => { element.checked = !value; });
    },
    handleEkspedisiUpdate(e) {
        if (e.target.tagName !== 'INPUT' || e.target.type !== 'text') return;
        const element = e.target;
        clearTimeout(this.state.debounceTimer);
        this.state.debounceTimer = setTimeout(() => {
            const row = element.closest('tr');
            const id = row.dataset.id;
            const columnName = element.dataset.column;
            const value = element.value;
            this.updateApi(id, columnName, value, () => {});
        }, 500);
    },
    updateApi(id, columnName, value, onError) {
        this.elements.indicator.classList.remove('opacity-0');
        App.api.updateWorkOrderStatus(id, columnName, value)
            .then(() => {
                setTimeout(() => {
                    this.elements.indicator.classList.add('opacity-0');
                }, 1500);
            })
            .catch(error => {
                alert(`Gagal menyimpan perubahan: ${error.message}`);
                onError();
                this.elements.indicator.classList.add('opacity-0');
            });
    }
};

// ===================================
// Logika Halaman Print PO
// ===================================
App.pages['print-po'] = {
    state: { poData: [] },
    elements: {},
    init() {
        this.elements = {
            printBtn: document.getElementById('print-btn'),
            finishBtn: document.getElementById('finish-btn'),
            poContent: document.getElementById('po-content'),
        };
        this.elements.printBtn.addEventListener('click', () => window.print());
        this.elements.finishBtn.addEventListener('click', () => this.handleFinish());
    },
    load() {
        const dataString = sessionStorage.getItem('poData');
        if (!dataString || dataString === '[]') {
            this.elements.poContent.innerHTML = '<p class="text-red-500">Tidak ada data untuk dicetak. Kembali ke Work Order dan pilih item.</p>';
            this.elements.finishBtn.disabled = true;
            return;
        }
        this.state.poData = JSON.parse(dataString);
        this.render();
    },
    render() {
        const poDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        const itemRows = this.state.poData.map(item => `
            <tr class="border-b">
                <td class="p-2 border">${item.nama_customer}</td>
                <td class="p-2 border">${item.deskripsi}</td>
                <td class="p-2 border text-center">${parseFloat(item.ukuran) || ''}</td>
                <td class="p-2 border text-center">${parseFloat(item.qty) || ''}</td>
                <td class="p-2 border h-12"></td>
            </tr>
        `).join('');
        this.elements.poContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-1">Purchase Order</h2>
            <p class="mb-4 text-sm">Tanggal: ${poDate}</p>
            <table class="w-full border-collapse border text-sm">
                <thead class="bg-gray-200 font-bold">
                    <tr>
                        <th class="p-2 border w-1/4">NAMA</th>
                        <th class="p-2 border w-2/4">KETERANGAN</th>
                        <th class="p-2 border">UK</th>
                        <th class="p-2 border">QTY</th>
                        <th class="p-2 border w-1/6">CEKLIS</th>
                    </tr>
                </thead>
                <tbody>${itemRows}</tbody>
            </table>`;
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

// ===================================
// Logika Halaman Stok Bahan
// ===================================
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

// ===================================
// Logika Halaman Surat Jalan
// ===================================
App.pages['surat-jalan'] = {
    state: { invoiceData: null, itemsForColoring: [] },
    elements: {},
    init() {
        this.elements = {
            tabCustomer: document.getElementById('tab-sj-customer'),
            tabWarna: document.getElementById('tab-sj-warna'),
            contentCustomer: document.getElementById('content-sj-customer'),
            contentWarna: document.getElementById('content-sj-warna'),
            invoiceInput: document.getElementById('sj-invoice-search'),
            searchBtn: document.getElementById('sj-search-btn'),
            printArea: document.getElementById('sj-print-area'),
            printBtn: document.getElementById('sj-print-btn'),
            catatanInput: document.getElementById('sj-catatan'),
            warnaTableBody: document.getElementById('sj-warna-table-body'),
            warnaPrintBtn: document.getElementById('sj-warna-print-btn'),
            vendorSelect: document.getElementById('sj-warna-vendor'),
            selectAllWarna: document.getElementById('sj-warna-select-all'),
        };
        this.elements.tabCustomer.addEventListener('click', () => this.switchTab('customer'));
        this.elements.tabWarna.addEventListener('click', () => this.switchTab('warna'));
        this.elements.searchBtn.addEventListener('click', () => this.handleSearchInvoice());
        this.elements.printBtn.addEventListener('click', () => this.handlePrintCustomerSJ());
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
        this.elements.contentCustomer.classList.toggle('hidden', !isCustomer);
        this.elements.contentWarna.classList.toggle('hidden', isCustomer);
        this.elements.tabCustomer.classList.toggle('active', isCustomer);
        this.elements.tabWarna.classList.toggle('active', !isCustomer);
        if (!isCustomer) this.loadItemsForColoring();
    },
    async handleSearchInvoice() {
        const inv = this.elements.invoiceInput.value;
        if (!inv) return alert('Masukkan nomor invoice.');
        try {
            const data = await App.api.getInvoiceData(inv);
            if (data.length === 0) {
                alert('Invoice tidak ditemukan.');
                this.elements.printArea.innerHTML = '';
                this.elements.printBtn.disabled = true;
                return;
            }
            this.state.invoiceData = data;
            this.renderCustomerSJ();
            this.elements.printBtn.disabled = false;
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    },
    renderCustomerSJ(no_sj = '...') {
        const data = this.state.invoiceData;
        const customer = data[0].nama_customer;
        const inv = data[0].no_inv;
        const tanggal = new Date().toLocaleDateString('id-ID');
        const itemRows = data.map(item => `<tr><td class="border p-1 text-center">${parseFloat(item.qty)}</td><td class="border p-1">${item.deskripsi}</td><td class="border p-1">${item.ukuran}</td></tr>`).join('');
        this.elements.printArea.innerHTML = `
            <h2 class="text-center font-bold">SURAT JALAN</h2>
            <div class="grid grid-cols-2 text-sm my-4">
                <div>Kepada Yth. <br><b>${customer}</b></div>
                <div class="text-right">
                    <p>No. SJ: <b>${no_sj}</b></p><p>No. Invoice: ${inv}</p><p>Tanggal: ${tanggal}</p>
                </div>
            </div>
            <table class="w-full text-sm border-collapse">
                <thead><tr class="border-y border-black"><th class="p-1">Qty</th><th class="p-1">Nama Barang</th><th class="p-1">Ukuran</th></tr></thead>
                <tbody>${itemRows}</tbody>
            </table>
            <div class="grid grid-cols-2 text-center text-sm mt-16">
                <div>Penerima,<br><br><br>(..................)</div>
                <div>Hormat Kami,<br><br><br>(..................)</div>
            </div>`;
    },
    async handlePrintCustomerSJ() {
        if (!this.state.invoiceData) return;
        const data = {
            tipe: 'CUSTOMER',
            no_invoice: this.state.invoiceData[0].no_inv,
            nama_tujuan: this.state.invoiceData[0].nama_customer,
            items: this.state.invoiceData.map(i => ({ deskripsi: i.deskripsi, qty: i.qty, ukuran: i.ukuran })),
            catatan: this.elements.catatanInput.value
        };
        try {
            const result = await App.api.createSuratJalan(data);
            this.renderCustomerSJ(result.no_sj);
            setTimeout(() => window.print(), 300);
        } catch (error) {
            alert(`Gagal membuat SJ: ${error.message}`);
        }
    },
    async loadItemsForColoring() {
        this.elements.warnaTableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Memuat...</td></tr>';
        try {
            const allItems = await App.api.getWorkOrders(new Date().getMonth() + 1, new Date().getFullYear());
            const itemsToColor = allItems.filter(item => item.po_status === 'PRINTED' && !item.di_warna);
            this.state.itemsForColoring = itemsToColor;
            if (itemsToColor.length === 0) {
                this.elements.warnaTableBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center">Tidak ada barang siap warna.</td></tr>';
                return;
            }
            this.elements.warnaTableBody.innerHTML = itemsToColor.map(item => `
                <tr data-id="${item.id}">
                    <td class="p-2 text-center"><input type="checkbox" value="${item.id}"></td>
                    <td class="p-2 text-sm">${item.nama_customer}</td>
                    <td class="p-2 text-sm">${item.deskripsi}</td>
                    <td class="p-2 text-sm text-center">${parseFloat(item.qty)}</td>
                </tr>
            `).join('');
        } catch (error) {
            this.elements.warnaTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">${error.message}</td></tr>`;
        }
    },
    async handlePrintWarnaSJ() {
        const selectedIds = [...this.elements.warnaTableBody.querySelectorAll('input:checked')].map(cb => parseInt(cb.value));
        if (selectedIds.length === 0) return alert('Pilih item yang akan dikirim.');
        const itemsToSend = this.state.itemsForColoring.filter(item => selectedIds.includes(item.id));
        const data = {
            tipe: 'VENDOR',
            nama_tujuan: this.elements.vendorSelect.value,
            items: itemsToSend,
            catatan: ''
        };
        try {
            await App.api.createSuratJalan(data);
            alert('Surat Jalan Pewarnaan berhasil dibuat dan status item telah diperbarui.');
            this.loadItemsForColoring();
        } catch (error) {
            alert(`Gagal membuat SJ Pewarnaan: ${error.message}`);
        }
    }
};


// ===================================
// Fungsi Utama Aplikasi
// ===================================
App.getUserFromToken = function() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    try { return JSON.parse(atob(token.split('.')[1])); } catch (e) { return null; }
};
App.loadLayout = async function() {
    const appContainer = document.getElementById('app-container');
    if (!appContainer) return;

    try {
        const [sidebarRes, headerRes] = await Promise.all([
            fetch('components/_sidebar.html'),
            fetch('components/_header.html')
        ]);

        if (!sidebarRes.ok || !headerRes.ok) {
            throw new Error('Gagal memuat komponen layout. Pastikan file _sidebar.html dan _header.html ada di folder /components.');
        }

        const sidebarHtml = await sidebarRes.text();
        const headerHtml = await headerRes.text();
        
        const sidebarContainer = appContainer.querySelector('#sidebar-container');
        const headerContainer = appContainer.querySelector('#header-container');

        if(sidebarContainer) sidebarContainer.innerHTML = sidebarHtml;
        if(headerContainer) headerContainer.innerHTML = headerHtml;

        this.elements.sidebar = document.getElementById('sidebar');
        this.elements.sidebarNav = document.getElementById('sidebar-nav');
        this.elements.logoutButton = document.getElementById('logout-button');
        this.elements.userDisplay = document.getElementById('user-display');
        this.elements.pageTitle = document.getElementById('page-title');
        this.elements.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

        this.elements.logoutButton.addEventListener('click', this.handlers.handleLogout);
        this.elements.sidebarNav.addEventListener('click', this.handlers.handleNavigation);
        if (this.elements.sidebarToggleBtn) {
            this.elements.sidebarToggleBtn.addEventListener('click', this.handlers.handleSidebarToggle);
        }

        const user = this.getUserFromToken();
        if (user && this.elements.userDisplay) {
            this.elements.userDisplay.textContent = `Welcome, ${user.username}`;
        }
        
        const path = window.location.pathname.split('/').pop();
        const activeLink = document.querySelector(`a[href="${path}"]`);
        if (activeLink) {
            this.elements.pageTitle.textContent = activeLink.textContent;
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
        document.body.innerHTML = `<div class="p-8 text-center text-red-500">${error.message}</div>`;
    }
};
App.handlers = {
    async handleLogin(e) {
        e.preventDefault();
        try {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const response = await App.api.checkLogin(username, password);
            if (response && response.user) {
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
        if (!link) return;
        if (link.getAttribute('href') === '#') {
            e.preventDefault();
            const parentCollapsible = link.closest('.collapsible');
            if (parentCollapsible && link.classList.contains('sidebar-item')) {
                parentCollapsible.querySelector('.submenu').classList.toggle('hidden');
                parentCollapsible.querySelector('.submenu-toggle').classList.toggle('rotate-180');
            }
        }
    },
    handleSidebarToggle() {
        if (App.elements.sidebar) {
            App.elements.sidebar.classList.toggle('collapsed');
        }
    }
};
App.init = async function() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    if (path === 'index.html') {
        this.elements.loginForm = document.getElementById('login-form');
        this.elements.loginError = document.getElementById('login-error');
        this.elements.loginForm.addEventListener('submit', this.handlers.handleLogin);
    } else {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }
        await this.loadLayout();
        const pageName = path.replace('.html', '');
        if (this.pages[pageName] && this.pages[pageName].init) {
            this.pages[pageName].init();
        }
        if (this.pages[pageName] && this.pages[pageName].load) {
            this.pages[pageName].load();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

