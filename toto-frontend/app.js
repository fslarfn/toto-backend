// ==========================================================
// app.js — FINAL CLEAN + FIXED (PART 1/3)
// Pondasi: App global, API wrapper, Socket.IO init, Dashboard
// ==========================================================

const App = {
  state: {},
  elements: {},
  pages: {},
  socket: null,
};

// ==========================================================
// -------------------------- CONFIG ------------------------
// ==========================================================
App.config = {
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : `${window.location.protocol}//${window.location.host}`,
  apiPrefix: "/api",
  tabulator: { chunkSize: 10000 },
};

// ==========================================================
// ---------------------- TOKEN HELPERS ---------------------
// ==========================================================
App.getToken = function () {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 3) return token;

    const payload = JSON.parse(atob(parts[1]));
    const now = Date.now() / 1000;
    if (payload.exp && payload.exp < now) {
      localStorage.removeItem("authToken");
      return null;
    }
    return token;
  } catch (err) {
    console.warn("Failed read token:", err);
    localStorage.removeItem("authToken");
    return null;
  }
};

App.setToken = (token) => token && localStorage.setItem("authToken", token);
App.clearToken = () => localStorage.removeItem("authToken");

// ==========================================================
// ----------------------- API WRAPPER ----------------------
// ==========================================================
App.api = {
  _fullUrl(endpoint) {
    if (!endpoint) return `${App.config.baseUrl}${App.config.apiPrefix}`;
    if (endpoint.startsWith("/")) endpoint = endpoint.slice(1);
    return `${App.config.baseUrl}${App.config.apiPrefix}/${endpoint.replace(/^\/+/, "")}`;
  },

  async request(endpoint, options = {}) {
    const url = this._fullUrl(endpoint);
    const token = App.getToken();
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const cfg = { credentials: "same-origin", ...options, headers };

    if (
      cfg.body &&
      !(cfg.body instanceof FormData) &&
      headers["Content-Type"]?.includes("application/json") &&
      typeof cfg.body !== "string"
    ) {
      try {
        cfg.body = JSON.stringify(cfg.body);
      } catch (err) {
        console.warn("Failed to stringify body", err);
      }
    }

    let res;
    try {
      res = await fetch(url, cfg);
    } catch {
      throw new Error("Tidak dapat terhubung ke server.");
    }

    const text = await res.text().catch(() => "");
    let payload = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        })()
      : null;

    if (!res.ok) {
      const message = payload?.message || res.statusText || `HTTP ${res.status}`;
      if (message === "EXPIRED" || payload?.message === "EXPIRED") {
        App.clearToken();
        const err = new Error("TOKEN_EXPIRED");
        err.code = "TOKEN_EXPIRED";
        throw err;
      }
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    return payload;
  },

  get(endpoint) { return this.request(endpoint, { method: "GET" }); },
  post(endpoint, body) { return this.request(endpoint, { method: "POST", body }); },
  put(endpoint, body) { return this.request(endpoint, { method: "PUT", body }); },
  patch(endpoint, body) { return this.request(endpoint, { method: "PATCH", body }); },
  del(endpoint) { return this.request(endpoint, { method: "DELETE" }); },

  // domain-specific
  checkLogin(username, password) { return this.post("/login", { username, password }); },
  getCurrentUser() { return this.get("/me"); },
  getDashboard(month, year) { return this.get(`/dashboard?month=${month}&year=${year}`); },

  getWorkOrdersChunk(month, year, page = 1, size = App.config.tabulator.chunkSize) {
    return this.get(`/workorders/chunk?month=${month}&year=${year}&page=${page}&size=${size}`);
  },

  getWorkOrders(month, year, customer, status) {
    let q = `/workorders?month=${month}&year=${year}`;
    if (customer) q += `&customer=${encodeURIComponent(customer)}`;
    if (status) q += `&status=${encodeURIComponent(status)}`;
    return this.get(q);
  },

  addWorkOrder(data) { return this.post("/workorders", data); },
  updateWorkOrder(id, updates) { return this.patch(`/workorders/${id}`, updates); },
  updateWorkOrderStatus(id, columnName, value) {
    return this.patch(`/workorders/${id}/status`, { columnName, value });
  },
  markWorkOrdersPrinted(ids) { return this.post("/workorders/mark-printed", { ids }); },
  deleteWorkOrder(id) { return this.del(`/workorders/${id}`); },

  getKaryawan() { return this.get("/karyawan"); },
  addKaryawan(data) { return this.post("/karyawan", data); },
  updateKaryawan(id, data) { return this.put(`/karyawan/${id}`, data); },
  deleteKaryawan(id) { return this.del(`/karyawan/${id}`); },

  postPayroll(data) { return this.post("/payroll", data); },

  getSaldoKeuangan() { return this.get("/keuangan/saldo"); },
  addTransaksiKeuangan(data) { return this.post("/keuangan/transaksi", data); },
  getRiwayatKeuangan(month, year) {
    return this.get(`/keuangan/riwayat?month=${month}&year=${year}`);
  },

  getInvoiceSummary(month, year) {
    return this.get(`/invoices/summary?month=${month}&year=${year}`);
  },
  createSuratJalan(data) { return this.post("/surat-jalan", data); },

  getStokBahan() { return this.get("/stok"); },
  addStokBahan(data) { return this.post("/stok", data); },
  updateStokBahan(data) { return this.post("/stok/update", data); },

  getAllUsers() { return this.get("/users"); },
  toggleSubscription(id, status) {
    return this.post(`/admin/users/${id}/activate`, { status });
  },
};

// ==========================================================
// -------------------- SOCKET.IO INIT ----------------------
// ==========================================================
App.socketInit = function () {
  if (typeof io === "undefined") {
    console.warn("Socket.IO tidak ditemukan — pastikan script CDN sudah dimuat.");
    return;
  }
  if (App.socket && App.socket.connected) return;

  const socketUrl = App.config.baseUrl;

  App.socket = io(socketUrl, {
    transports: ["websocket"],
    withCredentials: false,
  });

  App.state.socket = App.socket; // ✅ sinkronisasi global

  App.socket.on("connect", () => console.log("✅ Socket connected:", App.socket.id));
  App.socket.on("disconnect", () => console.warn("⚠️ Socket disconnected"));
  App.socket.on("connect_error", (err) => console.error("❌ Socket error:", err.message));

  App.socket.on("wo_created", (row) => {
    if (App.pages["work-orders"]?.onRemoteCreate)
      App.pages["work-orders"].onRemoteCreate(row);
  });
  App.socket.on("wo_updated", (row) => {
    if (App.pages["work-orders"]?.onRemoteUpdate)
      App.pages["work-orders"].onRemoteUpdate(row);
  });
  App.socket.on("wo_deleted", (info) => {
    if (App.pages["work-orders"]?.onRemoteDelete)
      App.pages["work-orders"].onRemoteDelete(info);
  });
};

// ==========================================================
// ------------------------- UI HELPERS ---------------------
// ==========================================================
App.ui = {
  formatCurrency(value) {
    const num = Number(value) || 0;
    return `Rp ${num.toLocaleString("id-ID")}`;
  },
  formatDateISO(d) {
    if (!d) return "";
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },
  populateDateFilters(monthSelect, yearSelect, opts = {}) {
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
      const start = opts.startYear || currentYear - 2;
      const end = opts.endYear || currentYear + 1;
      for (let y = start; y <= end; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
      }
    }
  },
  showAlert(msg) {
    try {
      if (typeof Toastify !== "undefined")
        Toastify({ text: msg, duration: 4000 }).showToast();
      else alert(msg);
    } catch {
      alert(msg);
    }
  },
};


// ==========================================================
// app.js — FINAL CLEAN (PART 2/3)
// Work Orders (Tabulator autosave + realtime), Status Barang,
// Data Karyawan & Payroll
// ==========================================================

// ========== Compatibility shims (tidak menghapus fungsi asli) ==========
// Jika ada pemanggilan ke updateWorkOrderPartial (dipakai di autosave),
// pastikan ada alias menuju API patch yang benar.
if (!App.api.updateWorkOrderPartial) {
  App.api.updateWorkOrderPartial = function (id, updates) {
    // gunakan patch generic yang sudah ada
    return App.api.patch(`/workorders/${id}`, updates);
  };
}

// =========================
// APP.PAGES['work-orders']
// =========================
App.pages["work-orders"] = {
  state: {
    table: null,
    totalRows: 10000,
    pageSize: 10000,
    poButton: null,
    poCount: null,
  },
  elements: {},

  init() {
    this.elements.monthFilter = document.getElementById("wo-month-filter");
    this.elements.yearFilter = document.getElementById("wo-year-filter");
    this.elements.filterBtn = document.getElementById("filter-wo-btn");
    this.elements.gridContainer = document.getElementById("workorders-grid");
    this.elements.status = document.getElementById("wo-status") || document.createElement("div");
    this.state.poButton = document.getElementById("create-po-btn");
    this.state.poCount = document.getElementById("po-selection-count");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    // pastikan socket telah diset di App.state (sinkron dengan Part 1)
    this.initSocketIO();
    this.initTabulator();

    this.elements.filterBtn?.addEventListener("click", () => {
      if (this.state.table) {
        console.log("🔘 Tombol Filter diklik. Meminta data...");
        // Tabulator: refresh data (ambil ulang dari server)
        this.state.table.setData();
      }
    });

    this.initPOFeature();
  },

  initSocketIO() {
    // gunakan App.state.socket (set oleh App.socketInit)
    if (!App.state.socket) {
      console.warn("Socket global belum siap. Menunggu...");
      setTimeout(() => this.initSocketIO(), 150);
      return;
    }

    // pastikan hanya bind sekali
    if (this.socketBound) return;
    this.socketBound = true;

    const socket = App.state.socket;

    socket.on("wo_updated", (updatedRow) => {
      console.log("📡 Menerima siaran [wo_updated]:", updatedRow);
      if (this.state.table) {
        // Tabulator reactive update
        try { this.state.table.updateData([updatedRow]); } catch (e) { console.warn(e); }
        this.updateStatus(`Baris untuk [${updatedRow.nama_customer}] diperbarui oleh user lain.`);
      }
    });

    socket.on("wo_created", (newRow) => {
      console.log("📡 Menerima siaran [wo_created]:", newRow);
      if (this.state.table) {
        const placeholderRow = this.state.table.getRows().find(r => r.getData().id_placeholder === true);
        if (placeholderRow) {
          placeholderRow.update(newRow);
        } else {
          try { this.state.table.addRow(newRow, true); } catch (e) { console.warn(e); }
        }
        this.updateStatus(`Baris baru untuk [${newRow.nama_customer}] ditambahkan oleh user lain.`);
      }
    });

    socket.on("wo_deleted", (deletedInfo) => {
      console.log("📡 Menerima siaran [wo_deleted]:", deletedInfo);
      if (this.state.table && deletedInfo && deletedInfo.id) {
        try { this.state.table.deleteRow(deletedInfo.id); } catch (e) { console.warn(e); }
        this.updateStatus(`Baris [${deletedInfo.row?.nama_customer || deletedInfo.id}] dihapus oleh user lain.`);
      }
    });
  },

  initTabulator() {
    const self = this;

    // Pastikan kontainer ada
    if (!this.elements.gridContainer) {
      console.warn("Workorders grid container tidak ditemukan.");
      return;
    }

    // destroy previous instance jika ada
    if (this.state.table) {
      try { this.state.table.destroy(); } catch (e) {}
      this.state.table = null;
    }

    // Gunakan full API URL untuk menghindari HTML response
    const ajaxUrl = App.api._fullUrl("workorders/chunk");

    this.state.table = new Tabulator(this.elements.gridContainer, {
      height: "70vh",
      layout: "fitData",
      placeholder: "Silakan pilih Bulan dan Tahun, lalu klik Filter.",
      index: "id",
      progressiveLoad: "scroll",
      progressiveLoadScrollMargin: 200,
      ajaxURL: ajaxUrl,
      ajaxParams: () => ({
        month: this.elements.monthFilter.value,
        year: this.elements.yearFilter.value,
      }),
      ajaxConfig: {
        headers: {
          Authorization: "Bearer " + (App.getToken() || ""),
        },
      },
      ajaxResponse: (url, params, response) => {
        // response harus { data, total }
        const { data = [], total = 0 } = response || {};
        const loadedCount = self.state.table ? self.state.table.getDataCount() : 0;
        const remainingRows = total - loadedCount - data.length;
        const lastPage = remainingRows <= 0;
        self.state.totalRows = total;

        const emptyRows = [];
        if (!lastPage) {
          const fillCount = Math.min(self.state.pageSize, Math.max(0, remainingRows + 1));
          for (let i = 0; i < fillCount; i++) {
            emptyRows.push({
              id: `_empty_${loadedCount + data.length + i}`,
              id_placeholder: true,
              nama_customer: "",
              deskripsi: "",
              ukuran: "",
              qty: "",
            });
          }
        }

        return {
          data: [...data, ...emptyRows],
          last_page: lastPage ? 1 : 0,
        };
      },
      ajaxRequesting: (url, params) => { this.updateStatus("Memuat data..."); return true; },
      ajaxRequestError: (err) => { this.updateStatus("Gagal memuat data. Cek koneksi atau login ulang."); },

      dataLoaded: (data) => {
        if (this.state.table) {
          this.updateStatus(`Menampilkan ${this.state.table.getDataCount(true)} dari ${this.state.totalRows} baris.`);
        }
      },

      clipboard: true,
      clipboardPasteAction: "replace",
      keybindings: { navNext: "13" },

      columns: [
        { formatter: "rowSelection", titleFormatter: "rowSelection", hozAlign: "center", headerHozAlign: "center", cellClick: (e, cell) => cell.getRow().toggleSelect(), width: 40, cssClass: "cursor-pointer" },
        { title: "#", formatter: "rownum", width: 40, hozAlign: "center" },
        {
          title: "TANGGAL", field: "tanggal", width: 120, editor: "input",
          formatter: (cell) => {
            const val = cell.getValue();
            if (val && (val.includes("-") || val.includes("T"))) {
              try { return new Date(val).toLocaleDateString("id-ID"); } catch (e) { return val; }
            } else if (val) return val;
            return "";
          }
        },
        { title: "CUSTOMER", field: "nama_customer", width: 250, editor: "input" },
        { title: "DESKRIPSI", field: "deskripsi", width: 350, editor: "input" },
        { title: "UKURAN", field: "ukuran", width: 100, hozAlign: "center", editor: "input" },
        { title: "QTY", field: "qty", width: 80, hozAlign: "center", editor: "input" }
      ],

      // autosave handler
      cellEdited: (cell) => { self.handleCellEdit(cell); },

      rowSelectionChanged: (data, rows) => {
        self.updatePOButtonState(rows.length);
      }
    });
  },

  updateStatus(msg) {
    if (this.elements.status) this.elements.status.textContent = msg;
    console.log("WO:", msg);
  },

  async handleCellEdit(cell) {
    const rowData = cell.getRow().getData();
    this.updateStatus("Menyimpan perubahan...");
    try {
      if (rowData.id && !rowData.id_placeholder) {
        // update row lama (partial)
        await App.api.updateWorkOrderPartial(rowData.id, rowData);
        this.updateStatus("Perubahan tersimpan ✅");
      } else {
        // buat data baru
        delete rowData.id;
        delete rowData.id_placeholder;
        const newRow = await App.api.addWorkOrder(rowData);
        // tetapkan id baru
        cell.getRow().update({ id: newRow.id });
        this.updateStatus("Baris baru tersimpan ✅");
      }
    } catch (err) {
      console.error("Gagal autosave:", err);
      this.updateStatus("Gagal menyimpan perubahan. Cek koneksi.");
      try { cell.restoreOldValue(); } catch (e) {}
    }
  },

  initPOFeature() {
    if (this.state.poButton) {
      this.state.poButton.addEventListener("click", () => this.handlePrintPO());
    } else {
      console.warn("⚠️ Tombol create-po-btn tidak ditemukan.");
    }
  },

  updatePOButtonState(selectedCount) {
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

    const validSelectedData = selectedData.filter(row => !row.id_placeholder && row.id);

    if (validSelectedData.length === 0) {
      alert("Silakan pilih baris yang sudah berisi data untuk dicetak PO.");
      return;
    }
    if (!confirm(`Cetak ${validSelectedData.length} Work Order sebagai PO?`)) return;

    try {
      sessionStorage.setItem("poData", JSON.stringify(validSelectedData));
      const ids = validSelectedData.map(item => item.id);
      btn.disabled = true;
      btn.textContent = "Menandai...";
      await App.api.markWorkOrdersPrinted(ids);
      const updatedRows = ids.map(id => ({ id: id, di_produksi: "true" }));
      this.state.table.updateData(updatedRows);
      this.state.table.deselectRow();
      alert("PO berhasil dibuat. Mengarahkan ke halaman cetak...");
      window.location.href = "print-po.html";
    } catch (err) {
      console.error("❌ Gagal Buat PO:", err);
      alert("Terjadi kesalahan: " + (err.message || "Tidak diketahui"));
    } finally {
      btn.disabled = false;
      btn.textContent = "Buat PO";
      if (countSpan) countSpan.textContent = 0;
    }
  }
};

// =========================
// STATUS BARANG
// =========================
App.pages["status-barang"] = {
  state: { table: null, month: null, year: null },
  elements: {},

  init() {
    this.elements.container = document.getElementById("status-barang-grid");
    this.elements.customerFilter = document.getElementById("status-customer-filter");
    this.elements.monthFilter = document.getElementById("status-month-filter");
    this.elements.yearFilter = document.getElementById("status-year-filter");
    this.elements.filterBtn = document.getElementById("status-filter-btn");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.filterBtn?.addEventListener("click", () => this.reload());

    this.initTabulator();
    this.reload();

    // socket updates
    App.state.socket?.on("status_updated", (payload) => this.onRemoteStatusUpdated(payload));
    App.state.socket?.on("wo_updated", (payload) => this.onRemoteWOUpdated(payload));
    App.state.socket?.on("wo_deleted", (payload) => this.onRemoteWODeleted(payload));
  },

  initTabulator() {
    if (!this.elements.container) {
      console.warn("Status-barang container not found.");
      return;
    }

    if (this.state.table) {
      try { this.state.table.destroy(); } catch (e) {}
      this.state.table = null;
    }

    const self = this;

    const dateEditor = function(cell, onRendered, success) {
      const input = document.createElement("input");
      input.type = "date";
      input.style.width = "100%";
      input.value = cell.getValue() ? App.ui.formatDateISO(new Date(cell.getValue())) : "";
      onRendered(() => input.focus());
      input.addEventListener("change", () => success(input.value));
      input.addEventListener("blur", () => success(input.value));
      return input;
    };

    const checkboxEditor = function(cell, onRendered, success) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = cell.getValue() === true || cell.getValue() === "true";
      input.style.display = "block";
      input.style.margin = "0 auto";
      onRendered(() => input.focus());
      input.addEventListener("change", () => success(input.checked ? "true" : "false"));
      return input;
    };

    this.state.table = new Tabulator(this.elements.container, {
      layout: "fitColumns",
      height: "650px",
      index: "id",
      reactiveData: true,
      clipboard: true,
      selectable: false,
      columns: [
        { title: "Tanggal", field: "tanggal", editor: dateEditor, sorter: "date", width: 130 },
        { title: "No. INV", field: "no_inv", editor: "input", width: 140 },
        { title: "Customer", field: "nama_customer", editor: "input", widthGrow: 2 },
        { title: "Deskripsi", field: "deskripsi", editor: "input", widthGrow: 3 },
        { title: "Ukuran", field: "ukuran", editor: "input", width: 100, hozAlign: "center" },
        { title: "Qty", field: "qty", editor: "input", width: 80, hozAlign: "center" },
        { title: "Harga", field: "harga", editor: "input", width: 120, formatter: (cell) => App.ui.formatCurrency(cell.getValue()) },
        {
          title: "Total", field: "total", hozAlign: "right", width: 140, formatter: function(cell) {
            const row = cell.getRow().getData();
            const q = parseFloat(String(row.qty || "0").replace(/[^0-9.-]/g, "")) || 0;
            const h = parseFloat(String(row.harga || "0").replace(/[^0-9.-]/g, "")) || 0;
            return App.ui.formatCurrency(q * h);
          }, editor: false
        },
        { title: "Produksi", field: "di_produksi", editor: checkboxEditor, width: 100, hozAlign: "center", formatter: (cell) => ((cell.getValue() === "true" || cell.getValue() === true) ? "✓" : "") },
        { title: "Warna", field: "di_warna", editor: checkboxEditor, width: 100, hozAlign: "center", formatter: (cell) => ((cell.getValue() === "true" || cell.getValue() === true) ? "✓" : "") },
        { title: "Siap Kirim", field: "siap_kirim", editor: checkboxEditor, width: 100, hozAlign: "center", formatter: (cell) => ((cell.getValue() === "true" || cell.getValue() === true) ? "✓" : "") },
        { title: "Dikirim", field: "di_kirim", editor: checkboxEditor, width: 100, hozAlign: "center", formatter: (cell) => ((cell.getValue() === "true" || cell.getValue() === true) ? "✓" : "") },
        { title: "Pembayaran", field: "pembayaran", editor: checkboxEditor, width: 120, hozAlign: "center", formatter: (cell) => ((cell.getValue() === "true" || cell.getValue() === true) ? "✓" : "") },
        { title: "Ekspedisi", field: "ekspedisi", editor: "input", widthGrow: 1 }
      ],

      cellEdited: async function(cell) {
        const row = cell.getRow();
        const rowData = row.getData();
        const id = rowData.id;
        if (!id) return; // ignore temporary rows

        const field = cell.getField();
        let value = cell.getValue();

        if (field === "total") return;

        if (["di_produksi","di_warna","siap_kirim","di_kirim","pembayaran"].includes(field)) {
          value = (value === true || value === "true") ? "true" : "false";
        }

        if (field === "tanggal") {
          if (!value) value = null;
          else {
            try {
              const d = new Date(value);
              if (!isNaN(d)) value = d.toISOString().slice(0,10);
            } catch {}
          }
        }

        const payload = { [field]: value };

        try {
          const res = await App.api.request(`/workorders/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
          });

          if (res && res.data) {
            row.update(res.data);
          } else {
            row.update({});
          }

          if (App.state.socket && App.state.socket.connected) {
            App.state.socket.emit("status_updated", { id, field, value });
          }

          App.ui.showAlert("Perubahan tersimpan.");
        } catch (err) {
          console.error("Gagal menyimpan status-barang cell:", err);
          App.ui.showAlert("Gagal menyimpan perubahan: " + (err.message || err));
        }
      },

      rowSelectionChanged: function(data, rows) {},

      renderComplete: function() {}
    });
  },

  async reload() {
    const month = this.elements.monthFilter?.value || (new Date().getMonth() + 1);
    const year = this.elements.yearFilter?.value || new Date().getFullYear();
    const customer = (this.elements.customerFilter?.value || "").trim();

    this.state.month = month;
    this.state.year = year;

    try {
      const url = `status-barang?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}${customer ? `&customer=${encodeURIComponent(customer)}` : ""}`;
      const res = await App.api.request(url);
      const data = (res && (res.data || res)) || [];

      const normalized = (data || []).map(r => ({
        ...r,
        di_produksi: r.di_produksi === true || r.di_produksi === "true",
        di_warna: r.di_warna === true || r.di_warna === "true",
        siap_kirim: r.siap_kirim === true || r.siap_kirim === "true",
        di_kirim: r.di_kirim === true || r.di_kirim === "true",
        pembayaran: r.pembayaran === true || r.pembayaran === "true",
        ekspedisi: r.ekspedisi || "",
        total: (parseFloat(String(r.qty || "0").replace(/[^0-9.-]/g, "")) || 0) * (parseFloat(String(r.harga || "0").replace(/[^0-9.-]/g, "")) || 0)
      }));

      if (this.state.table) this.state.table.replaceData(normalized);
    } catch (err) {
      console.error("Gagal load status-barang:", err);
      App.ui.showAlert("Gagal memuat data status barang: " + (err.message || err));
    }
  },

  onRemoteStatusUpdated(payload) {
    if (!this.state.table || !payload) return;

    if (payload.id && (payload.nama_customer || payload.no_inv || payload.deskripsi || payload.harga !== undefined)) {
      const r = this.state.table.getRow(payload.id);
      if (r) r.update(payload);
      return;
    }

    const id = payload.id;
    if (!id) return;
    const row = this.state.table.getRow(id);
    if (!row) return;
    const updateObj = {};
    updateObj[payload.field] = payload.value;
    if (["di_produksi","di_warna","siap_kirim","di_kirim","pembayaran"].includes(payload.field)) {
      updateObj[payload.field] = (payload.value === "true" || payload.value === true);
    }
    row.update(updateObj);
  },

  onRemoteWOUpdated(payload) {
    if (!this.state.table || !payload || !payload.id) return;
    const r = this.state.table.getRow(payload.id);
    if (r) r.update(payload);
  },

  onRemoteWODeleted(payload) {
    if (!this.state.table || !payload || !payload.id) return;
    try { this.state.table.deleteRow(payload.id); } catch (e) {}
  }
};

// =========================
// DATA KARYAWAN
// =========================
App.pages["data-karyawan"] = {
  elements: {},

  init() {
    this.elements.form = document.getElementById("karyawan-form");
    this.elements.nama = document.getElementById("nama-karyawan");
    this.elements.gaji = document.getElementById("gaji-harian");
    this.elements.tableBody = document.getElementById("karyawan-table-body");

    this.elements.form?.addEventListener("submit", (e) => this.handleSubmit(e));
    this.load();
  },

  async load() {
    try {
      const data = await App.api.getKaryawan();
      this.renderTable(data || []);
    } catch (err) {
      console.error("karyawan load error", err);
      App.ui.showAlert("Gagal memuat data karyawan: " + (err.message || err));
    }
  },

  renderTable(data) {
    if (!this.elements.tableBody) return;
    if (!data || data.length === 0) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">Belum ada karyawan.</td></tr>`;
      return;
    }
    this.elements.tableBody.innerHTML = data.map(k => `
      <tr>
        <td class="px-6 py-3">${k.nama_karyawan}</td>
        <td class="px-6 py-3">${App.ui.formatCurrency(k.gaji_harian)}</td>
        <td class="px-6 py-3 text-right">
          <button class="edit-emp text-blue-600 mr-3" data-id="${k.id}">Edit</button>
          <button class="del-emp text-red-600" data-id="${k.id}">Hapus</button>
        </td>
      </tr>
    `).join("");

    // bind edit/delete
    this.elements.tableBody.querySelectorAll(".edit-emp").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const namaBaru = prompt("Masukkan nama baru:");
        const gajiBaru = prompt("Masukkan gaji harian baru:");
        if (!namaBaru || !gajiBaru) return App.ui.showAlert("Nama & gaji wajib diisi.");
        try {
          await App.api.updateKaryawan(id, { nama_karyawan: namaBaru, gaji_harian: parseFloat(gajiBaru) });
          App.ui.showAlert("Data karyawan diperbarui.");
          this.load();
        } catch (err) {
          console.error("update karyawan error", err);
          App.ui.showAlert("Gagal mengubah karyawan: " + (err.message || err));
        }
      });
    });

    this.elements.tableBody.querySelectorAll(".del-emp").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (!confirm("Yakin hapus karyawan?")) return;
        try {
          await App.api.deleteKaryawan(id);
          App.ui.showAlert("Karyawan dihapus.");
          this.load();
        } catch (err) {
          console.error("delete karyawan error", err);
          App.ui.showAlert("Gagal menghapus karyawan: " + (err.message || err));
        }
      });
    });
  },

  async handleSubmit(e) {
    e.preventDefault();
    const nama = this.elements.nama.value.trim();
    const gaji = parseFloat(this.elements.gaji.value);
    if (!nama || isNaN(gaji)) return App.ui.showAlert("Nama & gaji wajib diisi.");
    try {
      await App.api.addKaryawan({ nama_karyawan: nama, gaji_harian: gaji });
      App.ui.showAlert("Karyawan ditambahkan.");
      this.elements.form.reset();
      this.load();
    } catch (err) {
      console.error("add karyawan error", err);
      App.ui.showAlert("Gagal menambah karyawan: " + (err.message || err));
    }
  }
};

// =========================
// PAYROLL
// =========================
App.pages["payroll"] = {
  elements: {},
  state: {},

  init() {
    this.elements.karyawanSelect = document.getElementById("karyawan-select");
    this.elements.periodeInput = document.getElementById("periode-gaji");
    this.elements.hariKerja = document.getElementById("hari-kerja");
    this.elements.lembur = document.getElementById("hari-lembur");
    this.elements.potongan = document.getElementById("potongan-bon");
    this.elements.calculateBtn = document.getElementById("calculate-btn");
    this.elements.summaryArea = document.getElementById("payroll-summary");
    this.elements.printArea = document.getElementById("slip-gaji-print-area");

    this.elements.calculateBtn?.addEventListener("click", () => this.calculateAndSave());
    this.loadKaryawan();
  },

  async loadKaryawan() {
    try {
      const list = await App.api.getKaryawan();
      if (!this.elements.karyawanSelect) return;
      this.elements.karyawanSelect.innerHTML = `<option value="">Pilih karyawan</option>` + (list || []).map(k => `<option value="${k.id}" data-gaji="${k.gaji_harian}">${k.nama_karyawan}</option>`).join("");
    } catch (err) {
      console.error("loadKaryawan error", err);
    }
  },

  async calculateAndSave() {
    const karyawanId = this.elements.karyawanSelect.value;
    if (!karyawanId) return App.ui.showAlert("Pilih karyawan.");
    const hari = parseInt(this.elements.hariKerja.value) || 0;
    const lembur = parseInt(this.elements.lembur.value) || 0;
    const potongan = parseFloat(this.elements.potongan.value) || 0;
    const selectedOption = this.elements.karyawanSelect.selectedOptions[0];
    const gajiHarian = parseFloat(selectedOption?.dataset?.gaji) || 0;

    const totalGaji = (hari * gajiHarian) + (lembur * (gajiHarian * 1.5)) - potongan;

    if (this.elements.summaryArea) {
      this.elements.summaryArea.classList.remove("hidden");
      this.elements.summaryArea.innerHTML = `
        <div class="p-4 bg-white rounded shadow">
          <p><strong>Karyawan:</strong> ${selectedOption.textContent}</p>
          <p><strong>Periode:</strong> ${this.elements.periodeInput.value || "-"}</p>
          <p><strong>Gaji Kotor:</strong> ${App.ui.formatCurrency(hari * gajiHarian)}</p>
          <p><strong>Uang Lembur:</strong> ${App.ui.formatCurrency(lembur * (gajiHarian * 1.5))}</p>
          <p><strong>Potongan Kasbon:</strong> ${App.ui.formatCurrency(potongan)}</p>
          <h3 class="mt-3 text-lg font-bold">Total Terima: ${App.ui.formatCurrency(totalGaji)}</h3>
          <div class="mt-3">
            <button id="print-slip-btn" class="px-4 py-2 bg-[#8B5E34] text-white rounded">Print Slip</button>
          </div>
        </div>
      `;

      document.getElementById("print-slip-btn").addEventListener("click", () => {
        this.printSlip({
          nama: selectedOption.textContent,
          periode: this.elements.periodeInput.value,
          hari, lembur, potongan, totalGaji, gajiHarian
        });
      });
    }

    try {
      await App.api.postPayroll({ karyawan_id: parseInt(karyawanId), potongan_kasbon: potongan });
      App.ui.showAlert("Payroll diproses dan kasbon diperbarui (jika ada).");
      await this.loadKaryawan();
    } catch (err) {
      console.error("postPayroll error", err);
      App.ui.showAlert("Gagal menyimpan payroll: " + (err.message || err));
    }
  },

  printSlip(data) {
    const html = `
      <div style="font-family: sans-serif; padding:20px;">
        <h2>Slip Gaji</h2>
        <p><strong>Nama:</strong> ${data.nama}</p>
        <p><strong>Periode:</strong> ${data.periode}</p>
        <table style="width:100%; border-collapse:collapse;">
          <tr><td>Gaji per hari</td><td style="text-align:right">${App.ui.formatCurrency(data.gajiHarian)}</td></tr>
          <tr><td>Hari kerja</td><td style="text-align:right">${data.hari}</td></tr>
          <tr><td>Uang lembur</td><td style="text-align:right">${App.ui.formatCurrency(data.lembur * (data.gajiHarian * 1.5))}</td></tr>
          <tr><td>Potongan</td><td style="text-align:right">${App.ui.formatCurrency(data.potongan)}</td></tr>
          <tr><td><strong>Total Terima</strong></td><td style="text-align:right"><strong>${App.ui.formatCurrency(data.totalGaji)}</strong></td></tr>
        </table>
      </div>
    `;
    const w = window.open("", "", "width=700,height=600");
    w.document.write(`<html><head><title>Slip Gaji</title></head><body>${html}<script>window.onload = ()=>window.print();<\/script></body></html>`);
    w.document.close();
  }
};


// ==========================================================
// app.js — FINAL CLEAN + FIXED (PART 3/3)
// Keuangan, Invoice, Surat Jalan, Admin, Global Init
// ==========================================================


// ==========================================================
// app.js — PART 3/3 (FINAL TERPADU)
// Layout System + Keuangan + Invoice + Surat Jalan + Admin
// ==========================================================


/* =========================
   KEUANGAN
   ========================= */
App.pages["keuangan"] = {
  elements: {},
  init() {
    this.elements.saldoBody = document.getElementById("saldo-table-body");
    this.elements.transaksiForm = document.getElementById("transaksi-form");
    this.elements.riwayatBody = document.getElementById("riwayat-keuangan-body");
    this.elements.monthFilter = document.getElementById("keuangan-month");
    this.elements.yearFilter = document.getElementById("keuangan-year");
    this.elements.filterBtn = document.getElementById("filter-keuangan-btn");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn?.addEventListener("click", () => this.loadRiwayat());
    this.elements.transaksiForm?.addEventListener("submit", (e) => this.submitTransaksi(e));

    this.loadSaldo();
    this.loadRiwayat();
  },

  async loadSaldo() {
    try {
      const data = await App.api.getSaldoKeuangan();
      this.renderSaldo(data);
    } catch (err) {
      console.error("loadSaldo error", err);
    }
  },

  renderSaldo(list) {
    if (!this.elements.saldoBody) return;
    if (!list || list.length === 0) {
      this.elements.saldoBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center">Belum ada kas.</td></tr>`;
      return;
    }
    this.elements.saldoBody.innerHTML = list
      .map(
        (k) => `
      <tr>
        <td class="px-4 py-2">${k.nama_kas}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatCurrency(k.saldo)}</td>
        <td class="px-4 py-2 text-gray-500">${k.keterangan || "-"}</td>
      </tr>`
      )
      .join("");
  },

  async submitTransaksi(e) {
    e.preventDefault();
    const fd = new FormData(this.elements.transaksiForm);
    const data = Object.fromEntries(fd.entries());
    try {
      await App.api.addTransaksiKeuangan(data);
      App.ui.showAlert("Transaksi disimpan.");
      this.elements.transaksiForm.reset();
      this.loadSaldo();
      this.loadRiwayat();
    } catch (err) {
      App.ui.showAlert("Gagal menyimpan transaksi: " + (err.message || err));
    }
  },

  async loadRiwayat() {
    const month = this.elements.monthFilter.value;
    const year = this.elements.yearFilter.value;
    try {
      const rows = await App.api.getRiwayatKeuangan(month, year);
      this.renderRiwayat(rows);
    } catch (err) {
      App.ui.showAlert("Gagal memuat riwayat keuangan: " + (err.message || err));
    }
  },

  renderRiwayat(data) {
    if (!this.elements.riwayatBody) return;
    if (!data || data.length === 0) {
      this.elements.riwayatBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Belum ada transaksi.</td></tr>`;
      return;
    }
    this.elements.riwayatBody.innerHTML = data
      .map(
        (t) => `
      <tr>
        <td class="px-4 py-2">${t.tanggal}</td>
        <td class="px-4 py-2">${t.nama_kas}</td>
        <td class="px-4 py-2 text-right ${t.tipe === "PEMASUKAN" ? "text-green-600" : "text-red-600"}">${App.ui.formatCurrency(t.jumlah)}</td>
        <td class="px-4 py-2">${t.keterangan || "-"}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatCurrency(t.saldo_sesudah)}</td>
      </tr>`
      )
      .join("");
  },
};


/* =========================
   INVOICE
   ========================= */
App.pages["invoice"] = {
  elements: {},
  init() {
    this.elements.monthFilter = document.getElementById("invoice-month");
    this.elements.yearFilter = document.getElementById("invoice-year");
    this.elements.filterBtn = document.getElementById("filter-invoice-btn");
    this.elements.summaryEl = document.getElementById("invoice-summary");
    this.elements.tableBody = document.getElementById("invoice-table-body");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn?.addEventListener("click", () => this.load());
    this.load();
  },

  async load() {
    const month = this.elements.monthFilter.value;
    const year = this.elements.yearFilter.value;
    try {
      const summary = await App.api.getInvoiceSummary(month, year);
      this.renderSummary(summary);
      const rows = await App.api.getWorkOrders(month, year);
      this.renderTable(rows);
    } catch (err) {
      App.ui.showAlert("Gagal memuat invoice: " + (err.message || err));
    }
  },

  renderSummary(s) {
    if (!this.elements.summaryEl) return;
    this.elements.summaryEl.innerHTML = `
      <div class="grid grid-cols-3 gap-4 p-4 bg-white rounded shadow">
        <div>Total Nilai: <strong>${App.ui.formatCurrency(s.total)}</strong></div>
        <div>Sudah Dibayar: <strong>${App.ui.formatCurrency(s.paid)}</strong></div>
        <div>Belum Dibayar: <strong>${App.ui.formatCurrency(s.unpaid)}</strong></div>
      </div>`;
  },

  renderTable(rows) {
    if (!this.elements.tableBody) return;
    if (!rows || rows.length === 0) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center">Tidak ada data.</td></tr>`;
      return;
    }
    this.elements.tableBody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td class="px-4 py-2">${r.no_inv || "-"}</td>
        <td class="px-4 py-2">${r.nama_customer}</td>
        <td class="px-4 py-2">${r.deskripsi || "-"}</td>
        <td class="px-4 py-2 text-center">${r.qty}</td>
        <td class="px-4 py-2 text-center">${r.ukuran}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatCurrency(r.harga)}</td>
        <td class="px-4 py-2 text-right"><input type="number" data-id="${r.id}" data-col="dp" class="border p-1 w-20 text-right" value="${r.dp || 0}"></td>
        <td class="px-4 py-2 text-right"><input type="number" data-id="${r.id}" data-col="diskon" class="border p-1 w-20 text-right" value="${r.diskon || 0}"></td>
      </tr>`
      )
      .join("");

    this.elements.tableBody.querySelectorAll("input").forEach((el) => {
      el.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const col = e.target.dataset.col;
        const val = parseFloat(e.target.value) || 0;
        try {
          await App.api.updateWorkOrder(id, { [col]: val });
          App.ui.showAlert(`${col.toUpperCase()} disimpan.`);
        } catch (err) {
          App.ui.showAlert("Gagal simpan " + col + ": " + (err.message || err));
        }
      });
    });
  },
};


/* =========================
   SURAT JALAN
   ========================= */
App.pages["surat-jalan"] = {
  elements: {},
  init() {
    this.elements.form = document.getElementById("suratjalan-form");
    this.elements.form?.addEventListener("submit", (e) => this.handleSubmit(e));
  },

  async handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(this.elements.form);
    const data = Object.fromEntries(fd.entries());
    try {
      const res = await App.api.createSuratJalan({
        tipe: data.tipe,
        no_invoice: data.no_invoice,
        nama_tujuan: data.nama_tujuan,
        catatan: data.catatan,
        items: [],
      });
      App.ui.showAlert("Surat Jalan dibuat: " + res.no_sj);
      this.print(res.no_sj, data);
    } catch (err) {
      console.error("surat jalan error", err);
      App.ui.showAlert("Gagal membuat surat jalan: " + (err.message || err));
    }
  },

  print(noSJ, data) {
    const html = `
      <div style="font-family:sans-serif;padding:20px;">
        <h2>Surat Jalan</h2>
        <p><strong>No SJ:</strong> ${noSJ}</p>
        <p><strong>Tipe:</strong> ${data.tipe}</p>
        <p><strong>Tujuan:</strong> ${data.nama_tujuan}</p>
        <p><strong>No Invoice:</strong> ${data.no_invoice}</p>
        <p><strong>Catatan:</strong> ${data.catatan}</p>
        <hr>
        <p>Tanda tangan penerima:</p><br><br>
        <p>______________________</p>
      </div>`;
    const w = window.open("", "", "width=700,height=600");
    w.document.write(`<html><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    w.document.close();
  },
};


/* =========================
   PRINT PO
   ========================= */
App.pages["print-po"] = {
  elements: {},
  init() {
    this.elements.btn = document.getElementById("print-po-btn");
    this.elements.btn?.addEventListener("click", () => window.print());
  },
};


/* =========================
   ADMIN PAGE
   ========================= */
App.pages["admin-users"] = {
  elements: {},
  init() {
    this.elements.tableBody = document.getElementById("users-table-body");
    this.load();
  },

  async load() {
    try {
      const users = await App.api.getAllUsers();
      this.render(users);
    } catch (err) {
      App.ui.showAlert("Gagal memuat user: " + (err.message || err));
    }
  },

  render(list) {
    if (!this.elements.tableBody) return;
    this.elements.tableBody.innerHTML = list
      .map(
        (u) => `
      <tr>
        <td class="px-4 py-2">${u.username}</td>
        <td class="px-4 py-2">${u.phone_number || "-"}</td>
        <td class="px-4 py-2">${u.role}</td>
        <td class="px-4 py-2">${u.subscription_status}</td>
        <td class="px-4 py-2">
          <button data-id="${u.id}" data-status="${u.subscription_status === "active" ? "inactive" : "active"}" class="toggle-sub text-blue-600 underline">
            ${u.subscription_status === "active" ? "Nonaktifkan" : "Aktifkan"}
          </button>
        </td>
      </tr>`
      )
      .join("");

    this.elements.tableBody.querySelectorAll(".toggle-sub").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        const status = e.target.dataset.status;
        try {
          await App.api.toggleSubscription(id, status);
          App.ui.showAlert("Status langganan diubah.");
          this.load();
        } catch (err) {
          App.ui.showAlert("Gagal mengubah status: " + (err.message || err));
        }
      });
    });
  },
};


// ==========================================================
// 🧭 HANDLERS: LOGIN, LOGOUT, NAVIGASI, SIDEBAR
// ==========================================================
App.handlers = {
  // ------------------------------------------------------
  // 🔑 LOGIN
  // ------------------------------------------------------
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

  // ------------------------------------------------------
  // 🚪 LOGOUT
  // ------------------------------------------------------
  handleLogout() {
    App.clearToken();
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    window.location.href = "index.html";
  },

  // ------------------------------------------------------
  // 🧭 NAVIGASI SIDEBAR
  // ------------------------------------------------------
  handleNavigation(e) {
    const link = e.target.closest("a");
    if (!link || link.getAttribute("href") === "#") return;
    e.preventDefault();

    const parentCollapsible = link.closest(".collapsible");
    if (parentCollapsible && link.classList.contains("sidebar-item")) {
      const submenu = parentCollapsible.querySelector(".submenu");
      const icon = parentCollapsible.querySelector(".submenu-toggle");
      submenu?.classList.toggle("hidden");
      icon?.classList.toggle("rotate-180");
    } else {
      const href = link.getAttribute("href");
      if (href && href.endsWith(".html")) window.location.href = href;
    }
  },

  // ------------------------------------------------------
  // 📱 TOGGLE SIDEBAR
  // ------------------------------------------------------
  handleSidebarToggle() {
    const container = document.getElementById("app-container");
    if (container) container.classList.toggle("sidebar-collapsed");
  },
};


// ======================================================
// 🧱 LOAD LAYOUT (Sidebar + Header dinamis)
// ======================================================
App.loadLayout = async function() {
  try {
    const sidebarEl = document.getElementById("sidebar");
    const headerEl = document.getElementById("header-container");
    if (!sidebarEl && !headerEl) return;

    const [sidebarRes, headerRes] = await Promise.all([
      fetch("components/_sidebar.html"),
      fetch("components/_header.html"),
    ]);

    if (!sidebarRes.ok || !headerRes.ok)
      throw new Error("Gagal memuat komponen layout.");

    sidebarEl.innerHTML = await sidebarRes.text();
    headerEl.innerHTML = await headerRes.text();

    // === 1️⃣ Event: Logout, Navigasi, Toggle Sidebar ===
    const logoutBtn = document.getElementById("logout-button");
    if (logoutBtn && App.handlers?.handleLogout)
      logoutBtn.addEventListener("click", App.handlers.handleLogout);

    const sidebarNav = document.getElementById("sidebar-nav");
    if (sidebarNav && App.handlers?.handleNavigation)
      sidebarNav.addEventListener("click", App.handlers.handleNavigation);

    const sidebarToggle = document.getElementById("sidebar-toggle-btn");
    if (sidebarToggle && App.handlers?.handleSidebarToggle)
      sidebarToggle.addEventListener("click", App.handlers.handleSidebarToggle);

    // === 2️⃣ Aktifkan submenu collapsible ===
    document.querySelectorAll(".collapsible > a").forEach((header) => {
      header.addEventListener("click", (e) => {
        e.preventDefault();
        const submenu = header.parentElement.querySelector(".submenu");
        const icon = header.querySelector(".submenu-toggle");
        submenu?.classList.toggle("hidden");
        icon?.classList.toggle("rotate-180");
      });
    });

    // === 3️⃣ Highlight menu aktif ===
    const currentPath = window.location.pathname.split("/").pop();
    const activeLink = sidebarEl.querySelector(`a[href="${currentPath}"]`);
    if (activeLink) {
      activeLink.classList.add("bg-[#A67B5B]");
      const parent = activeLink.closest(".submenu");
      if (parent) {
        parent.classList.remove("hidden");
        const toggle = parent.previousElementSibling?.querySelector(".submenu-toggle");
        toggle?.classList.add("rotate-180");
      }
    }

    // === 4️⃣ Muat data user ke header ===
    try {
      const user = await App.safeGetUser();
      if (user) {
        const displayEl = document.getElementById("user-display");
        const avatarEl = document.getElementById("user-avatar");
        if (displayEl) displayEl.textContent = `Halo, ${user.username}`;
        if (avatarEl) {
          if (user.profile_picture_url) {
            avatarEl.src = user.profile_picture_url;
            avatarEl.classList.remove("hidden");
          } else avatarEl.classList.add("hidden");
        }
      }
    } catch (err) {
      console.warn("Gagal memuat user:", err);
    }

    // === 5️⃣ Admin menu hanya untuk Faisal ===
    const username = (localStorage.getItem("username") || "").toLowerCase();
    const adminMenu = document.getElementById("admin-menu");
    if (username !== "faisal" && adminMenu) adminMenu.remove();

  } catch (err) {
    console.error("Gagal load layout:", err);
  }
};


// ======================================================
// 🚀 INISIALISASI APLIKASI (FINAL STABLE)
// ======================================================
App.init = async function() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  console.log("📄 Halaman aktif:", path);

  // 🟢 LOGIN PAGE
  if (path === "index.html" || path === "") {
    const token = App.getToken();
    if (token) {
      window.location.href = "dashboard.html";
      return;
    }
    const form = document.getElementById("login-form");
    if (form) form.addEventListener("submit", App.handlers.handleLogin);
    return;
  }

  // 🔒 CEK TOKEN
  const token = App.getToken();
  if (!token) {
    console.warn("🚫 Token hilang atau kadaluarsa");
    window.location.href = "index.html";
    return;
  }

  // 🧱 MUAT LAYOUT
  await App.loadLayout();

  // ⚙️ INISIALISASI HALAMAN
  const pageName = path.replace(".html", "");
  if (App.pages[pageName]?.init) {
    console.log(`⚙️ Inisialisasi halaman: ${pageName}`);
    App.pages[pageName].init();
  } else {
    console.log(`ℹ️ Tidak ada init() untuk halaman: ${pageName}`);
  }
};


// ======================================================
// 🚀 MULAI APP
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
