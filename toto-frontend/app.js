// ==========================================================
// 🚀 ERP TOTO APP.JS (FINAL FIXED VERSION) 
// ==========================================================

const App = {
  state: {},
  elements: {},
  pages: {},
};

// ==========================================================
// 🌐 API WRAPPER
// ==========================================================

App.checkAuth = async function () {
  const token = localStorage.getItem("authToken");
  if (!token) {
    console.warn("⚠️ Belum login. Arahkan ke halaman login.");
    window.location.href = "login.html";
    return;
  }

  try {
    await App.api.getCurrentUser();
  } catch (err) {
    console.warn("⚠️ Token invalid, hapus dan logout:", err.message);
    localStorage.removeItem("authToken");
    window.location.href = "login.html";
  }
};

// ===================================================
// 🔌 API MODULE — Semua komunikasi frontend ↔ backend
// ===================================================
App.api = {
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : "https://erptoto.up.railway.app",

  // 🔧 Helper utama untuk semua request ke server
  async request(endpoint, options = {}) {
    // pastikan prefix /api/ ditambahkan satu kali saja
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint
      : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const url = `${this.baseUrl}${cleanEndpoint}`;
    const token = localStorage.getItem("authToken");

    // pastikan header baru tidak menimpa Authorization
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const config = { ...options, headers };

    let response;
    try {
      response = await fetch(url, config);
    } catch (err) {
      console.error("🌐 Fetch error:", err);
      throw new Error("Tidak dapat terhubung ke server.");
    }

    // baca hasil respon
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
    body: JSON.stringify({ username, password }),
  });

  // Simpan token login ke localStorage agar request lain bisa pakai
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
      body: JSON.stringify(data),
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
    return this.request("/workorders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateWorkOrder(id, updates) {
    return this.request(`/workorders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async deleteWorkOrder(id) {
    return this.request(`/workorders/${id}`, {
      method: "DELETE",
    });
  },

  async markWorkOrdersPrinted(ids) {
    return this.request("/workorders/mark-printed", {
      method: "POST",
      body: JSON.stringify({ ids }),
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
      body: JSON.stringify({ columnName, value }),
    });
  },

  // ======================================================
  // 🧰 KARYAWAN & PAYROLL
  // ======================================================
  async getKaryawan() {
    return this.request("/karyawan");
  },

  async addKaryawan(data) {
    return this.request("/karyawan", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateKaryawan(id, data) {
    return this.request(`/karyawan/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteKaryawan(id) {
    return this.request(`/karyawan/${id}`, {
      method: "DELETE",
    });
  },

  async processPayroll(data) {
    return this.request("/payroll", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ======================================================
  // 🧱 STOK BAHAN
  // ======================================================
  async getStokBahan() {
    return this.request("/stok");
  },

  async addStokBahan(data) {
    return this.request("/stok", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateStokBahan(data) {
    return this.request("/stok/update", {
      method: "POST",
      body: JSON.stringify(data),
    });
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
    return this.request("/surat-jalan", {
      method: "POST",
      body: JSON.stringify(data),
    });
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
      body: JSON.stringify(data),
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
      body: JSON.stringify({ status }),
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
// 🧍‍♂️ KARYAWAN PAGE
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
  state: { payrollData: [] },
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
      const hariKerja = parseInt(row.querySelector(".hari-kerja").value) || 0;
      const lembur = parseInt(row.querySelector(".lembur").value) || 0;
      const potongan = parseFloat(row.querySelector(".potongan").value) || 0;
      const karyawanData = await App.api.getKaryawan();
      const target = karyawanData.find((k) => k.nama_karyawan === nama);
      if (!target) continue;

      await App.api.postPayroll({
        karyawan_id: target.id,
        potongan_kasbon: potongan,
      });
    }
    alert("Payroll berhasil disimpan!");
    this.load();
  },
};

// ==========================================================
// 🧾 WORK ORDERS PAGE
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

    // 🔌 Inisialisasi socket.io global
    if (!App.state.socket && typeof io !== "undefined") {
      App.state.socket = io(App.api.baseUrl, { transports: ["websocket"] });
      console.log("🔗 Socket.IO terhubung:", App.state.socket.id);
    }

    this.setupSocketListeners();
    this.load();
  },

  // 🔄 SOCKET.IO EVENTS
  setupSocketListeners() {
    const sock = App.state.socket;
    if (!sock) return;

    sock.on("connect", () => console.log("🟢 Socket connected:", sock.id));
    sock.on("disconnect", () => console.log("🔴 Socket disconnected."));

    // Ketika ada WO baru / update / hapus → update realtime
    sock.on("wo_created", (row) => this.addOrUpdateRow(row));
    sock.on("wo_updated", (row) => this.addOrUpdateRow(row));
    sock.on("wo_deleted", (info) => {
      if (!this.state.table) return;
      this.state.table.deleteRow(info.id);
    });
  },

  // Tambah atau update baris di Tabulator
  addOrUpdateRow(updatedRow) {
    if (!this.state.table) return;
    this.state.table.updateOrAddData([updatedRow]);
  },

  // 🧭 LOAD DATA
  async load() {
    const month = this.elements.monthFilter?.value || new Date().getMonth() + 1;
    const year = this.elements.yearFilter?.value || new Date().getFullYear();

    try {
      const data = await App.api.request(`/workorders?month=${month}&year=${year}`);
      this.renderTable(data);
    } catch (err) {
      console.error("❌ Gagal load workorders:", err);
      alert("Gagal memuat data Work Orders.");
    }
  },

  // 🧱 RENDER TABLE
  renderTable(data) {
    if (this.state.table) this.state.table.destroy();

    // Tambahkan baris kosong hingga 10.000 seperti Google Sheet
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
      clipboardPasteAction: "update",
      clipboardCopyRowRange: "range",
      columns: [
        { title: "Tanggal", field: "tanggal", editor: "input", width: 130 },
        { title: "Nama Customer", field: "nama_customer", editor: "input", width: 200 },
        { title: "Deskripsi", field: "deskripsi", editor: "input", widthGrow: 2 },
        { title: "Ukuran", field: "ukuran", editor: "input", width: 120 },
        { title: "Qty", field: "qty", editor: "input", width: 100 },
      ],

    cellEdited: async (cell) => {
  const rowData = cell.getRow().getData();
  const field = cell.getField();
  const value = cell.getValue();

  try {
    // ROW BARU (belum punya ID)
    if (!rowData.id || String(rowData.id).startsWith("temp-")) {
      const newRow = await App.api.request("/workorders", {
        method: "POST",
        body: JSON.stringify({
          tanggal: rowData.tanggal || new Date().toISOString().slice(0, 10),
          nama_customer: rowData.nama_customer || "Tanpa Nama",
          deskripsi: rowData.deskripsi || "",
          ukuran: rowData.ukuran || null,
          qty: rowData.qty || null,
        }),
      });

      cell.getRow().update(newRow);

      // 📡 Kirim ke server via Socket.IO (biar user lain tahu)
      App.state.socket?.emit("wo_created", newRow);
      return;
    }

    // ROW EXISTING (sudah ada ID di DB)
    const id = rowData.id;
    const updated = await App.api.request(`/workorders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value }),
    });

    // Update ke tampilan user sendiri
    if (updated?.data) {
      cell.getRow().update(updated.data);

      // 📡 Siarkan ke server agar user lain update otomatis
      App.state.socket?.emit("wo_updated", updated.data);
    }
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
  elements: {},
  init() {
    this.elements = {
      monthFilter: document.getElementById("po-month-filter"),
      yearFilter: document.getElementById("po-year-filter"),
      filterBtn: document.getElementById("filter-po-btn"),
      printArea: document.getElementById("po-print-area"),
      printBtn: document.getElementById("po-print-btn"),
    };

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn.addEventListener("click", () => this.load());
    this.elements.printBtn.addEventListener("click", () => this.print());
    this.load();
  },

  async load() {
    const month = this.elements.monthFilter.value;
    const year = this.elements.yearFilter.value;
    try {
      const data = await App.api.getWorkOrders(month, year);
      this.render(data);
    } catch (err) {
      alert("Gagal memuat data PO: " + err.message);
    }
  },

  render(data) {
    if (!data || data.length === 0) {
      this.elements.printArea.innerHTML = "<p class='p-4 text-center text-gray-500'>Tidak ada data PO.</p>";
      return;
    }

    const html = data
      .map(
        (d, i) => `
      <div class="po-item border-b border-gray-300 pb-2 mb-2">
        <p><strong>${i + 1}. ${d.nama_customer}</strong> - ${d.deskripsi}</p>
        <p>Qty: ${d.qty}, Ukuran: ${d.ukuran}, Harga: ${App.ui.formatCurrency(d.harga)}</p>
      </div>`
      )
      .join("");

    this.elements.printArea.innerHTML = html;
  },

  print() {
    const html = this.elements.printArea.innerHTML;
    const w = window.open("", "", "width=800,height=600");
    w.document.write(`
      <html><head><title>Print PO</title></head>
      <body>${html}</body>
      <script>window.onload = () => window.print();<\/script></html>
    `);
    w.document.close();
  },
};

// ==========================================================
// 🧱 STOK BAHAN PAGE
// ==========================================================
App.pages["stok-bahan"] = {
  elements: {},
  init() {
    this.elements = {
      tableBody: document.getElementById("stok-table-body"),
      tambahBtn: document.getElementById("tambah-bahan-btn"),
      namaInput: document.getElementById("nama-bahan"),
      stokInput: document.getElementById("jumlah-bahan"),
    };

    this.elements.tambahBtn.addEventListener("click", () => this.handleTambah());
    this.load();
  },

  async load() {
    try {
      const data = await App.api.request("/api/stok");
      this.render(data);
    } catch (err) {
      console.error(err);
      alert("Gagal memuat stok bahan");
    }
  },

  render(data) {
    this.elements.tableBody.innerHTML = data
      .map(
        (b) => `
      <tr>
        <td>${b.nama_bahan}</td>
        <td>${b.jumlah}</td>
        <td>
          <button onclick="App.pages['stok-bahan'].hapus(${b.id})" class="text-red-600">Hapus</button>
        </td>
      </tr>`
      )
      .join("");
  },

  async handleTambah() {
    const nama = this.elements.namaInput.value.trim();
    const jumlah = parseInt(this.elements.stokInput.value) || 0;
    if (!nama || jumlah <= 0) return alert("Isi nama dan jumlah bahan dengan benar.");

    await App.api.request("/api/stok", {
      method: "POST",
      body: { nama_bahan: nama, jumlah },
    });

    this.elements.namaInput.value = "";
    this.elements.stokInput.value = "";
    this.load();
  },

  async hapus(id) {
    if (!confirm("Yakin hapus bahan ini?")) return;
    await App.api.request(`/api/stok/${id}`, { method: "DELETE" });
    this.load();
  },
};

// ==========================================================
// 🔌 SOCKET.IO INITIALIZATION
// ==========================================================
App.socketInit = function () {
  const socketUrl =
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : "https://erptoto.up.railway.app";

  const socket = io(socketUrl, { transports: ["websocket", "polling"] });
  App.state.socket = socket;

  socket.on("connect", () => console.log("🔌 Terhubung ke server:", socket.id));
  socket.on("disconnect", () => console.log("❌ Terputus dari server"));
};


// ==========================================================
// =================== BAGIAN 3/3 (FINAL) ====================
// ==========================================================

// ===================== TOKEN HELPERS =======================
App.getToken = function() {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Date.now() / 1000;
    if (payload.exp && payload.exp < now) {
      // token expired
      localStorage.removeItem("authToken");
      return null;
    }
    return token;
  } catch (err) {
    console.error("Gagal membaca token:", err);
    localStorage.removeItem("authToken");
    return null;
  }
};
App.setToken = function(token) {
  localStorage.setItem("authToken", token);
};
App.clearToken = function() {
  localStorage.removeItem("authToken");
};

// ==========================================================
// ================== INVOICE / QUOTATION ===================
// ==========================================================
App.pages["invoice"] = {
  state: { invoiceData: null },
  elements: {},
  init() {
    this.elements = {
      monthFilter: document.getElementById("invoice-month-filter"),
      yearFilter: document.getElementById("invoice-year-filter"),
      filterBtn: document.getElementById("filter-invoice-summary-btn"),
      totalCard: document.getElementById("total-invoice-card")?.querySelector("p"),
      paidCard: document.getElementById("paid-invoice-card")?.querySelector("p"),
      unpaidCard: document.getElementById("unpaid-invoice-card")?.querySelector("p"),
      searchInput: document.getElementById("invoice-search-input"),
      searchBtn: document.getElementById("invoice-search-btn"),
      catatanInput: document.getElementById("invoice-catatan"),
      printBtn: document.getElementById("invoice-print-btn"),
      printArea: document.getElementById("invoice-print-area"),
    };

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn?.addEventListener("click", () => this.loadSummary());
    this.elements.searchBtn?.addEventListener("click", () => this.handleSearchInvoice());
    this.elements.printBtn?.addEventListener("click", () => this.printInvoice());
    this.loadSummary();
  },

  async loadSummary() {
    const month = this.elements.monthFilter?.value;
    const year = this.elements.yearFilter?.value;
    if (!month || !year) return;
    try {
      const summary = await App.api.getInvoiceSummary(month, year);
      this.elements.totalCard.textContent = App.ui.formatCurrency(summary.total);
      this.elements.paidCard.textContent = App.ui.formatCurrency(summary.paid);
      this.elements.unpaidCard.textContent = App.ui.formatCurrency(summary.unpaid);
    } catch (err) {
      console.error("Gagal load invoice summary:", err);
      this.elements.totalCard.textContent = "Error";
      this.elements.paidCard.textContent = "Error";
      this.elements.unpaidCard.textContent = "Error";
    }
  },

  async handleSearchInvoice() {
    const inv = this.elements.searchInput?.value.trim();
    if (!inv) return alert("Masukkan nomor invoice.");
    this.elements.printArea.innerHTML = "<p class='p-4 text-center'>Mencari data...</p>";
    this.elements.printBtn.disabled = true;
    try {
      const data = await App.api.getInvoiceData(inv);
      if (!data || data.length === 0) throw new Error("Invoice tidak ditemukan.");
      this.state.invoiceData = data;
      this.renderCustomerInvoice();
      this.elements.printBtn.disabled = false;
    } catch (err) {
      console.error("handleSearchInvoice error:", err);
      this.elements.printArea.innerHTML = `<p class="p-4 text-center text-red-500">${err.message}</p>`;
    }
  },

  renderCustomerInvoice() {
    const data = this.state.invoiceData;
    if (!data || data.length === 0) {
      this.elements.printArea.innerHTML = '<p class="p-4 text-center text-red-500">Data invoice tidak ditemukan.</p>';
      return;
    }

    const customer = data[0].nama_customer || "-";
    const inv = data[0].no_inv || "-";
    const tanggal = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    let subtotal = 0;
    const itemRows = data.map((item, idx) => {
      const qty = parseFloat(item.qty) || 0;
      const harga = parseFloat(item.harga) || 0;
      const ukuran = parseFloat(item.ukuran) || 0;
      const totalPerItem = qty * harga * ukuran;
      subtotal += totalPerItem;
      return `
        <tr class="item-row">
          <td class="text-center">${idx + 1}</td>
          <td>${item.deskripsi || "-"}</td>
          <td class="text-center">${qty}</td>
          <td class="text-center">${ukuran}</td>
          <td class="text-right">${App.ui.formatCurrency(harga)}</td>
          <td class="text-right">${App.ui.formatCurrency(totalPerItem)}</td>
        </tr>
      `;
    }).join("");

    this.elements.printArea.innerHTML = `
      <div class="invoice-box p-4">
        <div class="invoice-header" style="display:flex;justify-content:space-between;">
          <div>
            <h2 style="margin:0">CV TOTO ALUMINIUM MANUFACTURE</h2>
            <p style="margin:0">Jl. Raya Mulya No.3 RT 001/002, Mustikajaya, Bekasi</p>
          </div>
          <div style="text-align:right;">
            <h3 style="margin:0">INVOICE</h3>
            <p style="margin:0">#${inv}</p>
            <p style="margin:0">${tanggal}</p>
          </div>
        </div>

        <div style="margin-top:12px;">
          <strong>Bill To:</strong> ${customer}
        </div>

        <table style="width:100%; border-collapse:collapse; margin-top:12px;">
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
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align:right;border:1px solid #000;padding:6px"><strong>Subtotal</strong></td>
              <td style="text-align:right;border:1px solid #000;padding:6px">${App.ui.formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td colspan="5" style="text-align:right;border:1px solid #000;padding:6px"><strong>Total</strong></td>
              <td style="text-align:right;border:1px solid #000;padding:6px">${App.ui.formatCurrency(subtotal)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top:12px;">
          <strong>Catatan:</strong> ${this.elements.catatanInput?.value || "Terima kasih atas kepercayaan Anda."}
        </div>
      </div>
    `;
  },

  printInvoice() {
    const area = this.elements.printArea;
    if (!area || !area.innerHTML.trim()) return alert("Tidak ada invoice untuk dicetak.");
    const w = window.open("", "", "width=900,height=650");
    w.document.write(`
      <html><head><title>Invoice</title></head>
      <body>${area.innerHTML}
      <script>window.onload = () => window.print();<\/script>
      </body></html>`);
    w.document.close();
  },
};

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

    this.elements.addItemBtn?.addEventListener("click", () => this.addNewItemRow());
    this.elements.generateBtn?.addEventListener("click", () => this.generateAndPrintQuote());
    this.elements.tableBody?.addEventListener("input", (e) => this.handleTableEvents(e));
    this.elements.tableBody?.addEventListener("click", (e) => this.handleTableEvents(e));

    // tambahkan satu baris default
    this.addNewItemRow();
  },

  addNewItemRow() {
    this.state.itemCounter++;
    const row = document.createElement("tr");
    row.className = "item-row";
    row.innerHTML = `
      <td><input name="deskripsi" class="w-full" placeholder="Nama item..."/></td>
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
    const customer = this.elements.customerInput?.value || "[Nama Pelanggan]";
    const perihal = this.elements.perihalInput?.value || "[Perihal]";
    const catatan = this.elements.catatanInput?.value || "Harga berlaku 14 hari.";
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
          <div><h2 style="margin:0">CV TOTO ALUMINIUM MANUFACTURE</h2><p style="margin:0">Jl. Raya Mulya, Bekasi</p></div>
          <div style="text-align:right"><h3 style="margin:0">QUOTATION</h3><p style="margin:0">${tanggal}</p></div>
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

        <div style="margin-top:12px;">
          <strong>Syarat & Ketentuan:</strong><br>${catatan.replace(/\n/g, "<br>")}
        </div>
      </div>
    `;
  },
};

// ==========================================================
// ===================== KEUANGAN PAGE ======================
// ==========================================================
App.pages["keuangan"] = {
  state: {},
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

    this.elements.form?.addEventListener("submit", (e) => this.handleSaveTransaksi(e));
    this.elements.filterBtn?.addEventListener("click", () => this.load());
    this.load();
  },

  async load() {
    const month = this.elements.filterMonth?.value;
    const year = this.elements.filterYear?.value;
    try {
      const [saldoData, riwayat] = await Promise.all([
        App.api.getSaldoKeuangan(),
        App.api.getRiwayatKeuangan(month, year),
      ]);
      this.renderSaldo(saldoData);
      this.renderRiwayat(riwayat);
    } catch (err) {
      console.error("Gagal muat keuangan:", err);
      this.elements.tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">${err.message}</td></tr>`;
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
    if (!items || items.length === 0) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500">Tidak ada riwayat.</td></tr>`;
      return;
    }
    this.elements.tableBody.innerHTML = items.map((it) => {
      const isIn = it.tipe === "PEMASUKAN";
      const cls = isIn ? "text-green-600" : "text-red-600";
      const formattedDate = new Date(it.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      return `
        <tr class="text-sm">
          <td class="px-6 py-4">${formattedDate}</td>
          <td class="px-6 py-4">${it.keterangan}</td>
          <td class="px-6 py-4">${it.nama_kas}</td>
          <td class="px-6 py-4 ${cls}">${it.tipe}</td>
          <td class="px-6 py-4 text-right ${cls}">${isIn ? "" : "-"} ${App.ui.formatCurrency(it.jumlah)}</td>
        </tr>
      `;
    }).join("");
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

    if (!payload.tanggal || !payload.jumlah || !payload.keterangan) {
      return alert("Harap isi semua kolom wajib.");
    }
    if (isNaN(payload.jumlah) || payload.jumlah <= 0) return alert("Nominal tidak valid.");

    try {
      await App.api.addTransaksiKeuangan(payload);
      alert("Transaksi berhasil disimpan.");
      this.elements.form.reset();
      this.elements.tanggal.value = new Date().toISOString().slice(0, 10);
      this.load();
    } catch (err) {
      console.error("Gagal simpan transaksi:", err);
      alert("Gagal menyimpan transaksi: " + (err.message || "error"));
    }
  },
};

// ==========================================================
// ===================== PROFIL PAGE ========================
// ==========================================================
App.pages["profil"] = {
  elements: {},
  state: {},

  init() {
    this.elements = {
      notification: document.getElementById("notification"),
      notificationMessage: document.getElementById("notification-message"),
      profileForm: document.getElementById("update-profile-form"),
      usernameInput: document.getElementById("username"),
      pictureInput: document.getElementById("profile-picture-input"),
      previewImage: document.getElementById("profile-preview"),
      passwordForm: document.getElementById("change-password-form"),
      oldPasswordInput: document.getElementById("old-password"),
      newPasswordInput: document.getElementById("new-password"),
      confirmPasswordInput: document.getElementById("confirm-password"),
    };

    this.elements.pictureInput?.addEventListener("change", (e) => this.handlePreview(e));
    this.elements.profileForm?.addEventListener("submit", (e) => this.handleProfileSave(e));
    this.elements.passwordForm?.addEventListener("submit", (e) => this.handlePasswordChange(e));
    this.load();
  },

  async load() {
    try {
      const user = await App.api.getCurrentUser();
      if (!user) return;
      this.elements.usernameInput.value = user.username || "";
      if (user.profile_picture_url) this.elements.previewImage.src = user.profile_picture_url;
    } catch (err) {
      console.error("Gagal load profil:", err);
    }
  },

  handlePreview(e) {
    const file = e.target.files && e.target.files[0];
    if (file) this.elements.previewImage.src = URL.createObjectURL(file);
  },

  async handleProfileSave(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("username", this.elements.usernameInput.value);
    const file = this.elements.pictureInput.files[0];
    if (file) fd.append("profilePicture", file);
    try {
      await App.api.updateUserProfile(fd);
      alert("Profil berhasil diperbarui.");
      await App.loadLayout(); // refresh header/sidebar
    } catch (err) {
      console.error("Gagal update profil:", err);
      alert("Gagal memperbarui profil: " + (err.message || "error"));
    }
  },

  async handlePasswordChange(e) {
    e.preventDefault();
    const oldP = this.elements.oldPasswordInput.value;
    const newP = this.elements.newPasswordInput.value;
    const confirmP = this.elements.confirmPasswordInput.value;
    if (newP !== confirmP) return alert("Password baru dan konfirmasi tidak cocok.");
    try {
      const res = await App.api.changePassword({ oldPassword: oldP, newPassword: newP });
      alert(res.message || "Password berhasil diubah.");
      this.elements.passwordForm.reset();
    } catch (err) {
      console.error("Gagal ganti password:", err);
      alert("Gagal mengubah password: " + (err.message || "error"));
    }
  },
};

// ==========================================================
// ================ ADMIN SUBSCRIPTION PAGE =================
// ==========================================================
App.pages["admin-subscription"] = {
  async load() {
    const token = App.getToken();
    if (!token) {
      alert("Sesi berakhir. Silakan login ulang.");
      window.location.href = "index.html";
      return;
    }

    let currentUser = "";
    try {
      const u = await App.api.getCurrentUser();
      currentUser = (u?.username || "").toLowerCase();
    } catch {
      currentUser = (localStorage.getItem("username") || "").toLowerCase();
    }

    if (currentUser !== "faisal") {
      document.body.innerHTML = `
        <div class="flex flex-col items-center justify-center h-screen text-center">
          <h1 class="text-3xl font-semibold text-red-600 mb-4">Akses Ditolak</h1>
          <p class="text-gray-700 text-lg mb-6">Halaman ini hanya bisa diakses oleh Admin (Faisal).</p>
          <a href="dashboard.html" class="px-5 py-3 bg-[#8B5E34] text-white rounded-md">Kembali ke Dashboard</a>
        </div>`;
      return;
    }

    try {
      const res = await fetch(`${App.api.baseUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat data user.");
      const users = await res.json();
      const tbody = document.getElementById("subscription-table-body");
      tbody.innerHTML = "";
      const userList = (users || []).filter((u) => u.role === "user");
      if (userList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">Belum ada user terdaftar.</td></tr>`;
        return;
      }
      userList.forEach((u) => {
        const tr = document.createElement("tr");
        const isActive = (u.subscription_status || "inactive") === "active";
        tr.innerHTML = `
          <td class="px-6 py-4 text-gray-800">${u.username || "-"}</td>
          <td class="px-6 py-4 text-gray-700">${u.phone_number || "-"}</td>
          <td class="px-6 py-4 text-center">
            <span class="px-3 py-1 rounded-full text-sm font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${isActive ? 'Aktif' : 'Nonaktif'}</span>
          </td>
          <td class="px-6 py-4 text-center">
            <button data-id="${u.id}" data-status="${u.subscription_status || 'inactive'}" class="toggle-sub-btn px-4 py-2 rounded-md text-white font-semibold ${isActive ? 'bg-red-600' : 'bg-green-600'}">
              ${isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      document.querySelectorAll(".toggle-sub-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.target.dataset.id;
          const status = e.target.dataset.status;
          const newStatus = status === "active" ? "inactive" : "active";
          if (!confirm(`Ubah status langganan menjadi ${newStatus}?`)) return;
          try {
            const r = await fetch(`${App.api.baseUrl}/api/admin/users/${id}/activate`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: newStatus }),
            });
            if (!r.ok) throw new Error("Gagal memperbarui status.");
            alert("Status langganan berhasil diperbarui.");
            this.load();
          } catch (err) {
            console.error("Gagal toggle subscription:", err);
            alert("Gagal memperbarui status: " + (err.message || "error"));
          }
        });
      });
    } catch (err) {
      console.error("admin-subscription load err:", err);
      document.getElementById("subscription-table-body").innerHTML = `<tr><td colspan="4" class="text-center py-6 text-red-500">Gagal memuat data langganan.</td></tr>`;
    }
  },
};

// ==========================================================
// ==================== LAYOUT & HANDLERS ===================
// ==========================================================
App.loadLayout = async function () {
  try {
    const [sidebarRes, headerRes] = await Promise.all([
      fetch("components/_sidebar.html"),
      fetch("components/_header.html"),
    ]);
    if (!sidebarRes.ok || !headerRes.ok) throw new Error("Gagal memuat komponen layout.");
    document.getElementById("sidebar").innerHTML = await sidebarRes.text();
    document.getElementById("header-container").innerHTML = await headerRes.text();

    // basic elements
    this.elements.sidebarNav = document.getElementById("sidebar-nav");
    this.elements.logoutButton = document.getElementById("logout-button");
    this.elements.sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
    this.elements.userDisplay = document.getElementById("user-display");
    this.elements.userAvatar = document.getElementById("user-avatar");
    this.elements.pageTitle = document.getElementById("page-title");

    // handlers
    if (this.elements.logoutButton) this.elements.logoutButton.addEventListener("click", () => {
      App.clearToken();
      localStorage.clear();
      window.location.href = "index.html";
    });

    if (this.elements.sidebarNav) this.elements.sidebarNav.addEventListener("click", (e) => {
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

    if (this.elements.sidebarToggleBtn) this.elements.sidebarToggleBtn.addEventListener("click", () => {
      document.getElementById("app-container")?.classList.toggle("sidebar-collapsed");
    });

    // populate user data
    try {
      const user = await App.api.getCurrentUser();
      if (user) {
        this.elements.userDisplay && (this.elements.userDisplay.textContent = `Welcome, ${user.username}`);
        if (user.profile_picture_url && this.elements.userAvatar) {
          this.elements.userAvatar.src = user.profile_picture_url;
          this.elements.userAvatar.classList.remove("hidden");
        }
      }
    } catch (err) {
      // ignore
    }
  } catch (err) {
    console.error("Gagal memuat layout:", err);
  }
};

// ==========================================================
// ===================== APP HANDLERS =======================
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
      console.error("Login error:", err);
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
// ====================== APP INIT ==========================
// ==========================================================
App.init = async function () {
  const path = window.location.pathname.split("/").pop() || "index.html";

  // if on login page
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

  // other pages require token
  const token = App.getToken();
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // load layout first
  await App.loadLayout();

  // initialize socket (safe to call even if already connected)
  if (typeof io !== "undefined") {
    App.socketInit();
  }

  // init page module
  const pageName = path.replace(".html", "");
  if (App.pages[pageName]?.init) {
    try { App.pages[pageName].init(); } catch (err) { console.error(`Init ${pageName} error:`, err); }
  }
  if (App.pages[pageName]?.load && pageName !== "work-orders") {
    try { App.pages[pageName].load(); } catch (err) { console.error(`Load ${pageName} error:`, err); }
  }
};

// ==========================================================
// ================ START APP ON DOM READY ==================
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
