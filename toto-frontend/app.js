// ==========================================================
// 🚀 ERP TOTO APP.JS (FINAL FIXED VERSION - NOVEMBER 2025)
// ==========================================================

const App = {
  state: {},
  elements: {},
  pages: {},
};

// ==========================================================
// 🌐 API WRAPPER
// ==========================================================
App.api = {
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : "https://erptoto.up.railway.app",

  // ==========================
  // 🔧 Helper utama untuk semua request ke server
  // ==========================
  async request(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint
      : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const url = `${this.baseUrl}${cleanEndpoint}`;
    const token = localStorage.getItem("authToken");

    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // 🧠 Jika body berupa object JS, ubah ke JSON string (selain FormData)
    let body = options.body;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
      body = JSON.stringify(body);
    }

    const config = { ...options, headers, body };

    let response;
    try {
      response = await fetch(url, config);
    } catch (err) {
      console.error("🌐 Fetch error:", err);
      throw new Error("Tidak dapat terhubung ke server.");
    }

    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = text;
    }

    if (!response.ok) {
      const message = result?.message || `HTTP ${response.status}`;
      console.error("❌ API Error:", message, "→", url);
      throw new Error(message);
    }

    return result;
  },

  // ======================================================
  // 🔐 LOGIN / USER
  // ======================================================
  async checkLogin(username, password) {
    const result = await this.request("/login", {
      method: "POST",
      body: { username, password },
    });

    if (result.token) {
      localStorage.setItem("authToken", result.token);
    }

    return result;
  },

  async getCurrentUser() {
    return this.request("/me", { method: "GET" });
  },

  async updateUserProfile(formData) {
    return this.request("/user/profile", {
      method: "PUT",
      body: formData,
    });
  },

  async changePassword(data) {
    return this.request("/user/change-password", {
      method: "PUT",
      body: data,
    });
  },

  // ======================================================
  // 📊 DASHBOARD
  // ======================================================
  async getDashboard(month, year) {
    return this.request(`/dashboard?month=${month}&year=${year}`);
  },

  // ======================================================
  // 🧾 WORK ORDERS
  // ======================================================
  async getWorkOrders(month, year) {
    return this.request(`/workorders?month=${month}&year=${year}`);
  },

  async addWorkOrder(data) {
    return this.request("/workorders", { method: "POST", body: data });
  },

  async updateWorkOrder(id, updates) {
    return this.request(`/workorders/${id}`, { method: "PATCH", body: updates });
  },

  async deleteWorkOrder(id) {
    return this.request(`/workorders/${id}`, { method: "DELETE" });
  },

  async markWorkOrdersPrinted(ids) {
    return this.request("/workorders/mark-printed", {
      method: "POST",
      body: { ids },
    });
  },

  async getWorkOrdersByStatus(customer, month, year) {
    let url = `/status-barang?month=${month}&year=${year}`;
    if (customer) url += `&customer=${encodeURIComponent(customer)}`;
    return this.request(url);
  },

  async updateWorkOrderStatus(id, columnName, value) {
    return this.request(`/workorders/${id}/status`, {
      method: "PATCH",
      body: { columnName, value },
    });
  },

  // ======================================================
  // 🧰 KARYAWAN & PAYROLL
  // ======================================================
  async getKaryawan() {
    return this.request("/karyawan");
  },

  async addKaryawan(data) {
    return this.request("/karyawan", { method: "POST", body: data });
  },

  async updateKaryawan(id, data) {
    return this.request(`/karyawan/${id}`, { method: "PUT", body: data });
  },

  async deleteKaryawan(id) {
    return this.request(`/karyawan/${id}`, { method: "DELETE" });
  },

  async processPayroll(data) {
    return this.request("/payroll", { method: "POST", body: data });
  },

  // ======================================================
  // 🧱 STOK BAHAN
  // ======================================================
  async getStokBahan() {
    return this.request("/stok");
  },

  async addStokBahan(data) {
    return this.request("/stok", { method: "POST", body: data });
  },

  async updateStokBahan(data) {
    return this.request("/stok/update", { method: "POST", body: data });
  },

  // ======================================================
  // 🧾 INVOICE & SURAT JALAN
  // ======================================================
  async getInvoiceSummary(month, year) {
    return this.request(`/invoices/summary?month=${month}&year=${year}`);
  },

  async getInvoiceData(inv) {
    return this.request(`/invoice/${inv}`);
  },

  async createSuratJalan(data) {
    return this.request("/surat-jalan", { method: "POST", body: data });
  },

  // ======================================================
  // 💰 KEUANGAN
  // ======================================================
  async getSaldoKeuangan() {
    return this.request("/keuangan/saldo");
  },

  async addTransaksiKeuangan(data) {
    return this.request("/keuangan/transaksi", {
      method: "POST",
      body: data,
    });
  },

  async getRiwayatKeuangan(month, year) {
    return this.request(`/keuangan/riwayat?month=${month}&year=${year}`);
  },

  // ======================================================
  // 👑 ADMIN (KHUSUS FAISAL)
  // ======================================================
  async getAllUsers() {
    return this.request("/users");
  },

  async toggleSubscription(id, status) {
    return this.request(`/admin/users/${id}/activate`, {
      method: "POST",
      body: { status },
    });
  },
};

// ==========================================================
// 🎨 UI HELPER
// ==========================================================
App.ui = {
  formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return `Rp ${num.toLocaleString("id-ID")}`;
  },

  populateDateFilters(monthSelect, yearSelect) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    if (monthSelect) {
      monthSelect.innerHTML = "";
      for (let m = 1; m <= 12; m++) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        if (m === currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
      }
    }

    if (yearSelect) {
      yearSelect.innerHTML = "";
      for (let y = currentYear - 2; y <= currentYear + 1; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
      }
    }
  },

  printElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const w = window.open("", "", "width=900,height=650");
    w.document.write(el.innerHTML);
    w.document.close();
    w.print();
  },
};

// ==========================================================
// 📊 DASHBOARD PAGE
// ==========================================================
App.pages["dashboard"] = {
  state: { currentStatusView: "siap_kirim" },
  elements: {},
  init() {
    this.elements = {
      monthFilter: document.getElementById("dashboard-month-filter"),
      yearFilter: document.getElementById("dashboard-year-filter"),
      filterBtn: document.getElementById("dashboard-filter-btn"),
      totalRupiah: document.getElementById("total-rupiah"),
      totalCustomer: document.getElementById("total-customer"),
    };

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn.addEventListener("click", () => this.load());
  },

  async load() {
    const month = this.elements.monthFilter.value;
    const year = this.elements.yearFilter.value;
    try {
      const data = await App.api.getDashboard(month, year);
      this.elements.totalRupiah.textContent = App.ui.formatCurrency(data.summary.total_rupiah);
      this.elements.totalCustomer.textContent = data.summary.total_customer;
    } catch (err) {
      alert("Gagal memuat dashboard: " + err.message);
    }
  },
};

// ==========================================================
// 🧍‍♂️ DATA KARYAWAN PAGE
// ==========================================================
App.pages["data-karyawan"] = {
  elements: {},
  init() {
    this.elements = {
      form: document.getElementById("karyawan-form"),
      nama: document.getElementById("nama-karyawan"),
      gaji: document.getElementById("gaji-harian"),
      tableBody: document.getElementById("karyawan-table-body"),
    };

    this.elements.form.addEventListener("submit", (e) => this.handleSubmit(e));
    this.load();
  },

  async load() {
    try {
      const data = await App.api.getKaryawan();
      this.renderTable(data);
    } catch (err) {
      console.error(err);
      alert("Gagal memuat data karyawan");
    }
  },

  renderTable(data) {
    this.elements.tableBody.innerHTML = data
      .map(
        (k) => `
        <tr>
          <td>${k.nama_karyawan}</td>
          <td>${App.ui.formatCurrency(k.gaji_harian)}</td>
          <td>
            <button class="text-blue-600" onclick="App.pages['data-karyawan'].edit(${k.id})">Edit</button>
            <button class="text-red-600" onclick="App.pages['data-karyawan'].hapus(${k.id})">Hapus</button>
          </td>
        </tr>`
      )
      .join("");
  },

  async handleSubmit(e) {
    e.preventDefault();
    const nama = this.elements.nama.value.trim();
    const gaji = parseFloat(this.elements.gaji.value);
    if (!nama || isNaN(gaji)) return alert("Nama dan gaji wajib diisi.");

    await App.api.addKaryawan({ nama_karyawan: nama, gaji_harian: gaji });
    this.elements.form.reset();
    this.load();
  },

  async edit(id) {
    const namaBaru = prompt("Masukkan nama baru:");
    const gajiBaru = prompt("Masukkan gaji harian baru:");
    if (!namaBaru || !gajiBaru) return;

    await App.api.updateKaryawan(id, {
      nama_karyawan: namaBaru,
      gaji_harian: parseFloat(gajiBaru),
    });
    this.load();
  },

  async hapus(id) {
    if (!confirm("Yakin ingin menghapus karyawan ini?")) return;
    await App.api.deleteKaryawan(id);
    this.load();
  },
};

// ==========================================================
// 💰 PAYROLL PAGE
// ==========================================================
App.pages["payroll"] = {
  elements: {},
  init() {
    this.elements = {
      periodeInput: document.getElementById("periode-gaji"),
      tableBody: document.getElementById("payroll-table-body"),
      simpanBtn: document.getElementById("simpan-payroll-btn"),
    };

    this.elements.simpanBtn.addEventListener("click", () => this.simpanPayroll());
    this.load();
  },

  async load() {
    try {
      const data = await App.api.getKaryawan();
      this.renderTable(data);
    } catch (err) {
      alert("Gagal memuat data payroll: " + err.message);
    }
  },

  renderTable(karyawanList) {
    this.elements.tableBody.innerHTML = karyawanList
      .map(
        (k, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${k.nama_karyawan}</td>
          <td><input type="number" class="hari-kerja" placeholder="Hari kerja" /></td>
          <td><input type="number" class="lembur" placeholder="Lembur" /></td>
          <td><input type="number" class="potongan" placeholder="Kasbon" /></td>
        </tr>`
      )
      .join("");
  },

  async simpanPayroll() {
    const rows = this.elements.tableBody.querySelectorAll("tr");
    for (const row of rows) {
      const nama = row.children[1].textContent.trim();
      const potongan = parseFloat(row.querySelector(".potongan").value) || 0;
      const karyawanData = await App.api.getKaryawan();
      const target = karyawanData.find((k) => k.nama_karyawan === nama);
      if (!target) continue;

      await App.api.processPayroll({
        karyawan_id: target.id,
        potongan_kasbon: potongan,
      });
    }
    alert("Payroll berhasil disimpan!");
    this.load();
  },
};

// ==========================================================
// 🧾 WORK ORDERS PAGE (Realtime Autosave Fix)
// ==========================================================
App.pages["work-orders"] = {
  state: { table: null },
  elements: {},

  init() {
    this.elements = {
      monthFilter: document.getElementById("wo-month-filter"),
      yearFilter: document.getElementById("wo-year-filter"),
      filterBtn: document.getElementById("filter-wo-btn"),
      tableContainer: document.getElementById("workorders-grid"),
    };

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn?.addEventListener("click", () => this.load());

    // 🔌 Socket.IO (Stable mode for Railway)
    const socketUrl = (window.location.origin || "")
      .replace(/^https/, "wss")
      .replace(/^http/, "ws");

    if (!App.state.socket && typeof io !== "undefined") {
      App.state.socket = io(socketUrl, { transports: ["websocket"] });
      console.log("🔗 Socket.IO connected:", socketUrl);
    }

    this.setupSocketListeners();
    this.load();
  },

  setupSocketListeners() {
    const sock = App.state.socket;
    if (!sock) return;

    sock.on("connect", () => console.log("🟢 Socket connected:", sock.id));
    sock.on("disconnect", () => console.warn("🔴 Socket disconnected."));
    sock.on("wo_created", (row) => this.addOrUpdateRow(row));
    sock.on("wo_updated", (row) => this.addOrUpdateRow(row));
    sock.on("wo_deleted", (info) => {
      if (this.state.table) this.state.table.deleteRow(info.id);
    });
  },

  addOrUpdateRow(updatedRow) {
    if (!this.state.table) return;
    const row = this.state.table.getRow(updatedRow.id);
    if (row) row.update(updatedRow);
    else this.state.table.addRow(updatedRow, true);
  },

  async load() {
    const month = this.elements.monthFilter?.value || new Date().getMonth() + 1;
    const year = this.elements.yearFilter?.value || new Date().getFullYear();

    try {
      const data = await App.api.getWorkOrders(month, year);
      this.renderTable(data);
    } catch (err) {
      console.error("❌ Gagal load workorders:", err);
      alert("Gagal memuat data Work Orders.");
    }
  },

  renderTable(data) {
    if (this.state.table) this.state.table.destroy();

    while (data.length < 10000) {
      data.push({
        id: `temp-${data.length + 1}`,
        tanggal: "",
        nama_customer: "",
        deskripsi: "",
        ukuran: "",
        qty: "",
      });
    }

    this.state.table = new Tabulator(this.elements.tableContainer, {
      data,
      layout: "fitColumns",
      height: "600px",
      reactiveData: true,
      index: "id",
      clipboard: true,

      columns: [
        { title: "Tanggal", field: "tanggal", editor: "input", width: 130 },
        { title: "Nama Customer", field: "nama_customer", editor: "input", width: 200 },
        { title: "Deskripsi", field: "deskripsi", editor: "input", widthGrow: 2 },
        { title: "Ukuran", field: "ukuran", editor: "input", width: 120 },
        { title: "Qty", field: "qty", editor: "input", width: 100 },
      ],

      // 💾 AUTOSAVE realtime
      cellEdited: async (cell) => {
        const rowData = cell.getRow().getData();
        const field = cell.getField();
        const value = cell.getValue();

        try {
          // Baris baru
          if (!rowData.id || String(rowData.id).startsWith("temp-")) {
            const newRow = await App.api.addWorkOrder({
              tanggal: rowData.tanggal || new Date().toISOString().slice(0, 10),
              nama_customer: rowData.nama_customer || "Tanpa Nama",
              deskripsi: rowData.deskripsi || "",
              ukuran: rowData.ukuran || null,
              qty: rowData.qty || null,
            });
            cell.getRow().update(newRow);
            return;
          }

          // Update baris lama
          const id = rowData.id;
          const updated = await App.api.updateWorkOrder(id, { [field]: value });
          cell.getRow().update(updated.data || updated);
        } catch (err) {
          console.error("❌ Gagal menyimpan data:", err);
          alert("Gagal menyimpan data. Periksa koneksi atau login ulang.");
        }
      },
    });
  },
};

// ==========================================================
// 🚚 STATUS BARANG PAGE
// ==========================================================
App.pages["status-barang"] = {
  state: { data: [] },
  elements: {},
  init() {
    this.elements = {
      monthFilter: document.getElementById("status-month-filter"),
      yearFilter: document.getElementById("status-year-filter"),
      filterBtn: document.getElementById("filter-status-btn"),
      tableBody: document.getElementById("status-table-body"),
    };

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn.addEventListener("click", () => this.load());
    this.load();
  },

  async load() {
    const month = this.elements.monthFilter.value;
    const year = this.elements.yearFilter.value;

    try {
      const data = await App.api.getWorkOrders(month, year);
      this.state.data = data;
      this.render(data);
    } catch (err) {
      console.error(err);
      alert("Gagal memuat status barang");
    }
  },

  render(data) {
    this.elements.tableBody.innerHTML = data
      .map(
        (item) => `
      <tr>
        <td>${item.nama_customer}</td>
        <td>${item.deskripsi}</td>
        <td>${item.qty}</td>
        <td>${item.di_produksi ? "✅" : "❌"}</td>
        <td>${item.di_warna ? "✅" : "❌"}</td>
        <td>${item.siap_kirim ? "✅" : "❌"}</td>
        <td>${item.di_kirim ? "✅" : "❌"}</td>
      </tr>`
      )
      .join("");
  },
};

// ==========================================================
// 🧾 PRINT PO PAGE
// ==========================================================
App.pages["print-po"] = {
  state: { selectedRows: [] },
  elements: {},
  init() {
    this.elements = {
      monthFilter: document.getElementById("po-month-filter"),
      yearFilter: document.getElementById("po-year-filter"),
      printBtn: document.getElementById("print-po-btn"),
      tableBody: document.getElementById("po-table-body"),
    };

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.printBtn.addEventListener("click", () => this.printSelected());
    this.load();
  },

  async load() {
    const month = this.elements.monthFilter.value;
    const year = this.elements.yearFilter.value;
    try {
      const data = await App.api.getWorkOrders(month, year);
      this.renderTable(data);
    } catch (err) {
      alert("Gagal memuat data PO: " + err.message);
    }
  },

  renderTable(data) {
    this.elements.tableBody.innerHTML = data
      .map(
        (d) => `
        <tr>
          <td><input type="checkbox" value="${d.id}" /></td>
          <td>${d.nama_customer}</td>
          <td>${d.deskripsi}</td>
          <td>${d.qty}</td>
        </tr>`
      )
      .join("");
  },

  async printSelected() {
    const checked = this.elements.tableBody.querySelectorAll("input[type='checkbox']:checked");
    if (!checked.length) return alert("Pilih minimal satu data untuk dicetak.");

    const ids = Array.from(checked).map((c) => parseInt(c.value));
    await App.api.markWorkOrdersPrinted(ids);
    alert("PO berhasil ditandai sebagai dicetak.");
    this.load();
  },
};

// ==========================================================
// 📦 STOK BAHAN PAGE
// ==========================================================
App.pages["stok-bahan"] = {
  elements: {},
  init() {
    this.elements = {
      tableBody: document.getElementById("stok-table-body"),
      tambahBtn: document.getElementById("tambah-bahan-btn"),
    };

    this.elements.tambahBtn.addEventListener("click", () => this.handleTambah());
    this.load();
  },

  async load() {
    try {
      const data = await App.api.getStokBahan();
      this.render(data);
    } catch (err) {
      alert("Gagal memuat stok bahan: " + err.message);
    }
  },

  render(data) {
    this.elements.tableBody.innerHTML = data
      .map(
        (b) => `
      <tr>
        <td>${b.kode_bahan}</td>
        <td>${b.nama_bahan}</td>
        <td>${b.satuan}</td>
        <td>${b.kategori}</td>
        <td>${b.stok}</td>
      </tr>`
      )
      .join("");
  },

  async handleTambah() {
    const nama = prompt("Masukkan nama bahan:");
    const stok = prompt("Masukkan stok awal:");
    if (!nama || stok === null) return;

    try {
      await App.api.addStokBahan({
        kode: nama.slice(0, 3).toUpperCase(),
        nama,
        satuan: "pcs",
        kategori: "umum",
        stok: parseInt(stok),
        lokasi: "-",
      });
      alert("Bahan baru berhasil ditambah!");
      this.load();
    } catch (err) {
      alert("Gagal menambah bahan: " + err.message);
    }
  },
};

// ==========================================================
// 🧾 QUOTATION PAGE
// ==========================================================
App.pages["quotation"] = {
  state: { itemCounter: 0 },
  elements: {},
  init() {
    this.elements = {
      customerInput: document.getElementById("quote-customer"),
      perihalInput: document.getElementById("quote-perihal"),
      catatanInput: document.getElementById("quote-catatan"),
      tableBody: document.getElementById("quote-items-table-body"),
      addItemBtn: document.getElementById("add-quote-item-btn"),
      generateBtn: document.getElementById("generate-quote-btn"),
      printArea: document.getElementById("quotation-print-area"),
    };

    this.elements.addItemBtn.addEventListener("click", () => this.addNewItemRow());
    this.elements.generateBtn.addEventListener("click", () => this.generateAndPrintQuote());
    this.elements.tableBody.addEventListener("input", (e) => this.handleTableEvents(e));
    this.elements.tableBody.addEventListener("click", (e) => this.handleTableEvents(e));

    this.addNewItemRow();
  },

  addNewItemRow() {
    this.state.itemCounter++;
    const row = document.createElement("tr");
    row.className = "item-row";
    row.innerHTML = `
      <td><input name="deskripsi" class="w-full" placeholder="Nama item..." /></td>
      <td><input name="ukuran" type="number" class="w-full" value="0" /></td>
      <td><input name="qty" type="number" class="w-full" value="0" /></td>
      <td><input name="harga" type="number" class="w-full" value="0" /></td>
      <td class="text-right total-per-item">${App.ui.formatCurrency(0)}</td>
      <td class="text-center"><button class="delete-item-btn">✖</button></td>
    `;
    this.elements.tableBody.appendChild(row);
  },

  handleTableEvents(e) {
    const target = e.target;
    if (target.classList.contains("delete-item-btn")) {
      target.closest("tr").remove();
      return;
    }

    if (target.tagName === "INPUT") {
      const row = target.closest("tr");
      const ukuran = parseFloat(row.querySelector('[name="ukuran"]').value) || 0;
      const qty = parseFloat(row.querySelector('[name="qty"]').value) || 0;
      const harga = parseFloat(row.querySelector('[name="harga"]').value) || 0;
      row.querySelector(".total-per-item").textContent = App.ui.formatCurrency(ukuran * qty * harga);
    }
  },

  generateAndPrintQuote() {
    this.renderQuotationPreview();
    setTimeout(() => App.ui.printElement("quotation-print-area"), 150);
  },

  renderQuotationPreview() {
    const customer = this.elements.customerInput.value || "[Nama Pelanggan]";
    const perihal = this.elements.perihalInput.value || "[Perihal]";
    const catatan = this.elements.catatanInput.value || "Harga berlaku 14 hari.";
    const tanggal = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    let subtotal = 0;
    const rows = [];
    this.elements.tableBody.querySelectorAll("tr.item-row").forEach((row, idx) => {
      const deskripsi = row.querySelector('[name="deskripsi"]').value || "-";
      const ukuran = parseFloat(row.querySelector('[name="ukuran"]').value) || 0;
      const qty = parseFloat(row.querySelector('[name="qty"]').value) || 0;
      const harga = parseFloat(row.querySelector('[name="harga"]').value) || 0;
      const total = ukuran * qty * harga;
      subtotal += total;
      rows.push(`
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td>${deskripsi}</td>
          <td class="text-center">${qty}</td>
          <td class="text-center">${ukuran}</td>
          <td class="text-right">${App.ui.formatCurrency(harga)}</td>
          <td class="text-right">${App.ui.formatCurrency(total)}</td>
        </tr>
      `);
    });

    this.elements.printArea.innerHTML = `
      <div id="quotation-document" style="padding:12px;">
        <div style="display:flex;justify-content:space-between">
          <div><h2>CV TOTO ALUMINIUM MANUFACTURE</h2><p>Jl. Raya Mulya, Bekasi</p></div>
          <div style="text-align:right"><h3>QUOTATION</h3><p>${tanggal}</p></div>
        </div>
        <div style="margin-top:12px;">
          <strong>Kepada Yth:</strong> ${customer}<br>
          <strong>Perihal:</strong> ${perihal}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr>
              <th style="border:1px solid #000;padding:6px">#</th>
              <th style="border:1px solid #000;padding:6px">Deskripsi</th>
              <th style="border:1px solid #000;padding:6px">Qty</th>
              <th style="border:1px solid #000;padding:6px">Ukuran</th>
              <th style="border:1px solid #000;padding:6px">Harga</th>
              <th style="border:1px solid #000;padding:6px">Jumlah</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align:right;border:1px solid #000;padding:6px"><strong>Subtotal</strong></td>
              <td style="text-align:right;border:1px solid #000;padding:6px">${App.ui.formatCurrency(subtotal)}</td>
            </tr>
          </tfoot>
        </table>
        <div style="margin-top:12px;"><strong>Syarat & Ketentuan:</strong><br>${catatan.replace(/\n/g, "<br>")}</div>
      </div>
    `;
  },
};

// ==========================================================
// 💰 KEUANGAN PAGE
// ==========================================================
App.pages["keuangan"] = {
  elements: {},
  init() {
    this.elements = {
      saldo: {
        1: document.getElementById("saldo-bca-toto"),
        2: document.getElementById("saldo-bca-yanto"),
        3: document.getElementById("saldo-cash"),
        total: document.getElementById("saldo-total"),
      },
      form: document.getElementById("keuangan-form"),
      tanggal: document.getElementById("transaksi-tanggal"),
      jumlah: document.getElementById("transaksi-jumlah"),
      tipe: document.getElementById("transaksi-tipe"),
      kas: document.getElementById("transaksi-kas"),
      keterangan: document.getElementById("transaksi-keterangan"),
      filterMonth: document.getElementById("keuangan-month-filter"),
      filterYear: document.getElementById("keuangan-year-filter"),
      filterBtn: document.getElementById("filter-keuangan-btn"),
      tableBody: document.getElementById("riwayat-keuangan-table-body"),
    };

    if (this.elements.tanggal) this.elements.tanggal.value = new Date().toISOString().slice(0, 10);
    App.ui.populateDateFilters(this.elements.filterMonth, this.elements.filterYear);
    this.elements.form.addEventListener("submit", (e) => this.handleSaveTransaksi(e));
    this.elements.filterBtn.addEventListener("click", () => this.load());
    this.load();
  },

  async load() {
    const month = this.elements.filterMonth.value;
    const year = this.elements.filterYear.value;
    try {
      const [saldoData, riwayat] = await Promise.all([
        App.api.getSaldoKeuangan(),
        App.api.getRiwayatKeuangan(month, year),
      ]);
      this.renderSaldo(saldoData);
      this.renderRiwayat(riwayat);
    } catch (err) {
      alert("Gagal memuat data keuangan: " + err.message);
    }
  },

  renderSaldo(data) {
    let total = 0;
    (data || []).forEach((k) => {
      const s = parseFloat(k.saldo) || 0;
      total += s;
      if (this.elements.saldo[k.id]) this.elements.saldo[k.id].textContent = App.ui.formatCurrency(s);
    });
    if (this.elements.saldo.total) this.elements.saldo.total.textContent = App.ui.formatCurrency(total);
  },

  renderRiwayat(items) {
    if (!items.length) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Tidak ada riwayat.</td></tr>`;
      return;
    }
    this.elements.tableBody.innerHTML = items
      .map((it) => {
        const isIn = it.tipe === "PEMASUKAN";
        const cls = isIn ? "text-green-600" : "text-red-600";
        const formattedDate = new Date(it.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
        return `
          <tr>
            <td>${formattedDate}</td>
            <td>${it.keterangan}</td>
            <td>${it.nama_kas}</td>
            <td class="${cls}">${it.tipe}</td>
            <td class="text-right ${cls}">${isIn ? "" : "-"} ${App.ui.formatCurrency(it.jumlah)}</td>
          </tr>`;
      })
      .join("");
  },

  async handleSaveTransaksi(e) {
    e.preventDefault();
    const payload = {
      tanggal: this.elements.tanggal.value,
      jumlah: Number(this.elements.jumlah.value),
      tipe: this.elements.tipe.value,
      kas_id: this.elements.kas.value,
      keterangan: this.elements.keterangan.value,
    };
    try {
      await App.api.addTransaksiKeuangan(payload);
      alert("Transaksi disimpan.");
      this.elements.form.reset();
      this.elements.tanggal.value = new Date().toISOString().slice(0, 10);
      this.load();
    } catch (err) {
      alert("Gagal menyimpan transaksi: " + err.message);
    }
  },
};

// ==========================================================
// 👤 PROFIL PAGE
// ==========================================================
App.pages["profil"] = {
  elements: {},
  init() {
    this.elements = {
      profileForm: document.getElementById("update-profile-form"),
      usernameInput: document.getElementById("username"),
      pictureInput: document.getElementById("profile-picture-input"),
      previewImage: document.getElementById("profile-preview"),
      passwordForm: document.getElementById("change-password-form"),
      oldPasswordInput: document.getElementById("old-password"),
      newPasswordInput: document.getElementById("new-password"),
      confirmPasswordInput: document.getElementById("confirm-password"),
    };

    this.elements.pictureInput.addEventListener("change", (e) => this.handlePreview(e));
    this.elements.profileForm.addEventListener("submit", (e) => this.handleProfileSave(e));
    this.elements.passwordForm.addEventListener("submit", (e) => this.handlePasswordChange(e));
    this.load();
  },

  async load() {
    try {
      const user = await App.api.getCurrentUser();
      if (!user) return;
      this.elements.usernameInput.value = user.username;
      if (user.profile_picture_url) this.elements.previewImage.src = user.profile_picture_url;
    } catch (err) {
      console.error(err);
    }
  },

  handlePreview(e) {
    const file = e.target.files?.[0];
    if (file) this.elements.previewImage.src = URL.createObjectURL(file);
  },

  async handleProfileSave(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("username", this.elements.usernameInput.value);
    const file = this.elements.pictureInput.files[0];
    if (file) fd.append("profilePicture", file);
    await App.api.updateUserProfile(fd);
    alert("Profil berhasil diperbarui.");
    await App.loadLayout();
  },

  async handlePasswordChange(e) {
    e.preventDefault();
    const oldP = this.elements.oldPasswordInput.value;
    const newP = this.elements.newPasswordInput.value;
    const confirmP = this.elements.confirmPasswordInput.value;
    if (newP !== confirmP) return alert("Password baru tidak cocok.");
    await App.api.changePassword({ oldPassword: oldP, newPassword: newP });
    alert("Password berhasil diubah.");
    this.elements.passwordForm.reset();
  },
};

// ==========================================================
// 👑 ADMIN SUBSCRIPTION PAGE
// ==========================================================
App.pages["admin-subscription"] = {
  async load() {
    try {
      const users = await App.api.getAllUsers();
      const tbody = document.getElementById("subscription-table-body");
      tbody.innerHTML = users
        .filter((u) => u.role === "user")
        .map(
          (u) => `
          <tr>
            <td>${u.username}</td>
            <td>${u.phone_number || "-"}</td>
            <td>${u.subscription_status === "active" ? "✅ Aktif" : "❌ Nonaktif"}</td>
            <td><button onclick="App.pages['admin-subscription'].toggle(${u.id}, '${u.subscription_status}')">Toggle</button></td>
          </tr>`
        )
        .join("");
    } catch (err) {
      alert("Gagal memuat user: " + err.message);
    }
  },

  async toggle(id, currentStatus) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    if (!confirm(`Ubah status langganan ke ${newStatus}?`)) return;
    await App.api.toggleSubscription(id, newStatus);
    alert("Status diperbarui.");
    this.load();
  },
};

// ==========================================================
// 🧱 LAYOUT & HANDLERS (LANJUTAN)
// ==========================================================
App.loadLayout = async function () {
  try {
    const [sidebarRes, headerRes] = await Promise.all([
      fetch("components/_sidebar.html"),
      fetch("components/_header.html"),
    ]);

    if (!sidebarRes.ok || !headerRes.ok) throw new Error("Gagal memuat layout.");

    document.getElementById("sidebar").innerHTML = await sidebarRes.text();
    document.getElementById("header-container").innerHTML = await headerRes.text();

    // Basic elements
    this.elements.sidebarNav = document.getElementById("sidebar-nav");
    this.elements.logoutButton = document.getElementById("logout-button");
    this.elements.sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    this.elements.userDisplay = document.getElementById("user-display");
    this.elements.userAvatar = document.getElementById("user-avatar");

    // Logout
    if (this.elements.logoutButton) {
      this.elements.logoutButton.addEventListener("click", () => {
        App.clearToken();
        localStorage.clear();
        window.location.href = "index.html";
      });
    }

    // Sidebar toggle
    if (this.elements.sidebarToggleBtn) {
      this.elements.sidebarToggleBtn.addEventListener("click", () => {
        document.getElementById("app-container")?.classList.toggle("sidebar-collapsed");
      });
    }

    // Sidebar submenu
    if (this.elements.sidebarNav) {
      this.elements.sidebarNav.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (!link) return;
        const href = link.getAttribute("href");
        if (href === "#") {
          e.preventDefault();
          const parent = link.closest(".collapsible");
          if (parent) {
            parent.querySelector(".submenu")?.classList.toggle("hidden");
            parent.querySelector(".submenu-toggle")?.classList.toggle("rotate-180");
          }
        }
      });
    }

    // User info
    try {
      const user = await App.api.getCurrentUser();
      if (user) {
        if (this.elements.userDisplay)
          this.elements.userDisplay.textContent = `Welcome, ${user.username}`;
        if (user.profile_picture_url && this.elements.userAvatar) {
          this.elements.userAvatar.src = user.profile_picture_url;
          this.elements.userAvatar.classList.remove("hidden");
        }
      }
    } catch (err) {
      console.warn("Tidak bisa ambil data user:", err.message);
    }
  } catch (err) {
    console.error("Gagal memuat layout:", err);
  }
};

// ==========================================================
// 🔐 LOGIN HANDLER
// ==========================================================
App.handlers = {
  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById("username")?.value.trim();
    const password = document.getElementById("password")?.value.trim();
    if (!username || !password) return alert("Username & password wajib diisi.");

    try {
      const res = await App.api.checkLogin(username, password);
      if (!res || !res.token) throw new Error("Login gagal.");
      App.setToken(res.token);
      localStorage.setItem("username", res.user?.username || username);
      localStorage.setItem("role", res.user?.role || "user");
      window.location.href = "dashboard.html";
    } catch (err) {
      const el = document.getElementById("login-error");
      if (el) {
        el.textContent = err.message || "Login gagal";
        el.classList.remove("hidden");
      } else {
        alert(err.message || "Login gagal");
      }
    }
  },
};

// ==========================================================
// 🔑 TOKEN STORAGE
// ==========================================================
App.getToken = () => localStorage.getItem("authToken");
App.setToken = (token) => localStorage.setItem("authToken", token);
App.clearToken = () => localStorage.removeItem("authToken");

// ==========================================================
// 🚀 APP INIT (ENTRY POINT)
// ==========================================================
App.init = async function () {
  const path = window.location.pathname.split("/").pop() || "index.html";

  // Jika halaman login
  if (path === "index.html" || path === "") {
    const existingToken = App.getToken();
    if (existingToken) {
      window.location.href = "dashboard.html";
      return;
    }
    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.addEventListener("submit", App.handlers.handleLogin);
    return;
  }

  // Halaman lain butuh login
  const token = App.getToken();
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // Load layout (sidebar, header)
  await App.loadLayout();

  // Inisialisasi socket
  if (typeof io !== "undefined") App.socketInit?.();

  // Tentukan halaman aktif
  const pageName = path.replace(".html", "");
  if (App.pages[pageName]?.init) {
    try {
      App.pages[pageName].init();
    } catch (err) {
      console.error(`Init error (${pageName}):`, err);
    }
  }

  if (App.pages[pageName]?.load && pageName !== "work-orders") {
    try {
      App.pages[pageName].load();
    } catch (err) {
      console.error(`Load error (${pageName}):`, err);
    }
  }
};

// ==========================================================
// ⚙️ MULAI APP
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
