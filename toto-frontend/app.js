// ==========================================================
// app.js — PART 1/3
// Pondasi: App global, API wrapper, Socket.IO init, Dashboard
// ==========================================================

const App = {
  state: {},
  elements: {},
  pages: {},
  socket: null,
};

// -------------------------------
// ---------- CONFIG -------------
// -------------------------------
App.config = {
  // Gunakan origin saat deploy; localhost fallback untuk development
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : `${window.location.protocol}//${window.location.host}`,
  // Path prefix for API requests
  apiPrefix: "/api",
  // Tabulator defaults (we'll use Tabulator in part 2)
  tabulator: {
    chunkSize: 500,
  },
};

// -------------------------------
// ---------- TOKEN HELPERS -------
// -------------------------------
App.getToken = function () {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return token; // not JWT? return anyway
    const payload = JSON.parse(atob(parts[1]));
    const now = Date.now() / 1000;
    if (payload.exp && payload.exp < now) {
      // expired
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

App.setToken = function (token) {
  if (!token) return;
  localStorage.setItem("authToken", token);
};

App.clearToken = function () {
  localStorage.removeItem("authToken");
};

// -------------------------------
// ---------- API WRAPPER ---------
// -------------------------------
App.api = {
  _fullUrl(endpoint) {
    if (!endpoint) return `${App.config.baseUrl}${App.config.apiPrefix}`;
    if (endpoint.startsWith("/")) endpoint = endpoint.slice(1);
    // ensure api prefix once
    return `${App.config.baseUrl}${App.config.apiPrefix}/${endpoint.replace(/^\/+/, "")}`;
  },

  async request(endpoint, options = {}) {
    const url = this._fullUrl(endpoint);
    const token = App.getToken();
    const headers = {
      ...(options.headers || {}),
    };

    // If not FormData, set content-type JSON by default
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (token) headers["Authorization"] = `Bearer ${token}`;

    const cfg = {
      credentials: "same-origin",
      ...options,
      headers,
    };

    // If body is plain object and content-type is json, stringify it
    if (cfg.body && !(cfg.body instanceof FormData) && headers["Content-Type"]?.includes("application/json") && typeof cfg.body !== "string") {
      try {
        cfg.body = JSON.stringify(cfg.body);
      } catch (err) {
        console.warn("Failed to stringify body", err);
      }
    }

    let res;
    try {
      res = await fetch(url, cfg);
    } catch (err) {
      console.error("Network/Fetch error:", err);
      throw new Error("Tidak dapat terhubung ke server.");
    }

    // attempt read text first (to handle empty body)
    const text = await res.text().catch(() => "");
    let payload = text ? (() => {
      try { return JSON.parse(text); } catch (e) { return text; }
    })() : null;

    // Handle different status codes
    if (!res.ok) {
      const message = (payload && payload.message) || res.statusText || `HTTP ${res.status}`;
      // special: if backend returns EXPIRED for token then redirect to login flow
      if (message === "EXPIRED" || (payload && payload.message === "EXPIRED")) {
        // remove token and signal caller
        App.clearToken();
        // throw special error so UI can react
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

  // convenience methods
  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },
  post(endpoint, body) {
    return this.request(endpoint, { method: "POST", body });
  },
  put(endpoint, body) {
    return this.request(endpoint, { method: "PUT", body });
  },
  patch(endpoint, body) {
    return this.request(endpoint, { method: "PATCH", body });
  },
  del(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  // domain-specific
  checkLogin(username, password) {
    return this.post("/login", { username, password });
  },
  refresh(token) {
    return this.post("/refresh", { token });
  },
  getCurrentUser() {
    return this.get("/me");
  },

  // dashboard
  getDashboard(month, year) {
    return this.get(`/dashboard?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`);
  },

  // workorders chunk (Tabulator)
  getWorkOrdersChunk(month, year, page = 1, size = App.config.tabulator.chunkSize) {
    return this.get(`/workorders/chunk?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}&page=${page}&size=${size}`);
  },

  // legacy workorders (list)
  getWorkOrders(month, year, customer, status) {
    let q = `/workorders?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`;
    if (customer) q += `&customer=${encodeURIComponent(customer)}`;
    if (status) q += `&status=${encodeURIComponent(status)}`;
    return this.get(q);
  },

  addWorkOrder(data) {
    return this.post("/workorders", data);
  },
  updateWorkOrder(id, updates) {
    return this.patch(`/workorders/${id}`, updates);
  },
  updateWorkOrderStatus(id, columnName, value) {
    return this.patch(`/workorders/${id}/status`, { columnName, value });
  },
  markWorkOrdersPrinted(ids) {
    return this.post("/workorders/mark-printed", { ids });
  },
  deleteWorkOrder(id) {
    return this.del(`/workorders/${id}`);
  },

  // karyawan
  getKaryawan() {
    return this.get("/karyawan");
  },
  addKaryawan(data) {
    return this.post("/karyawan", data);
  },
  updateKaryawan(id, data) {
    return this.put(`/karyawan/${id}`, data);
  },
  deleteKaryawan(id) {
    return this.del(`/karyawan/${id}`);
  },

  // payroll
  postPayroll(data) {
    return this.post("/payroll", data);
  },

  // keuangan
  getSaldoKeuangan() {
    return this.get("/keuangan/saldo");
  },
  addTransaksiKeuangan(data) {
    return this.post("/keuangan/transaksi", data);
  },
  getRiwayatKeuangan(month, year) {
    return this.get(`/keuangan/riwayat?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`);
  },

  // invoice
  getInvoiceSummary(month, year) {
    return this.get(`/invoices/summary?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`);
  },
  getInvoiceData(inv) {
    return this.get(`/invoice/${encodeURIComponent(inv)}`);
  },

  // surat jalan
  createSuratJalan(data) {
    return this.post("/surat-jalan", data);
  },

  // stok
  getStokBahan() {
    return this.get("/stok");
  },
  addStokBahan(data) {
    return this.post("/stok", data);
  },
  updateStokBahan(data) {
    return this.post("/stok/update", data);
  },

  // admin
  getAllUsers() {
    return this.get("/users");
  },
  toggleSubscription(id, status) {
    return this.post(`/admin/users/${id}/activate`, { status });
  },
};

// -------------------------------
// ---------- SOCKET.IO ----------
// -------------------------------
App.socketInit = function () {
  // ensure io is available (cdn script included in HTML)
  if (typeof io === "undefined") {
    console.warn("Socket.IO tidak ditemukan — pastikan <script src=\"/socket.io/socket.io.js\"></script> atau CDN sudah dimuat.");
    return;
  }

  // prefer secure ws when page is https
  const socketUrl = (() => {
    try {
      // connect to same origin
      return window.location.origin.replace(/^http/, "ws");
    } catch (e) {
      return App.config.baseUrl;
    }
  })();

  // if already connected, don't duplicate
  if (App.socket && App.socket.connected) return;

  // use same host origin; Socket.IO client will use correct path (/socket.io)
  const ioUrl = App.config.baseUrl; // server and socket share same origin
  App.socket = io(ioUrl, { transports: ["websocket", "polling"] });

  App.socket.on("connect", () => {
    console.log("🔌 Socket connected:", App.socket.id);
  });

  App.socket.on("disconnect", () => {
    console.warn("🔌 Socket disconnected");
  });

  // Work Orders realtime
  App.socket.on("wo_created", (row) => {
    console.debug("socket wo_created", row);
    // notify pages that implement onRemoteCreate
    for (const p in App.pages) {
      if (App.pages[p]?.onRemoteCreate) {
        try { App.pages[p].onRemoteCreate(row); } catch (e) { console.warn(e); }
      }
    }
  });

  App.socket.on("wo_updated", (row) => {
    console.debug("socket wo_updated", row);
    for (const p in App.pages) {
      if (App.pages[p]?.onRemoteUpdate) {
        try { App.pages[p].onRemoteUpdate(row); } catch (e) { console.warn(e); }
      }
    }
  });

  App.socket.on("wo_deleted", (info) => {
    console.debug("socket wo_deleted", info);
    for (const p in App.pages) {
      if (App.pages[p]?.onRemoteDelete) {
        try { App.pages[p].onRemoteDelete(info); } catch (e) { console.warn(e); }
      }
    }
  });

  // future: karyawan events etc.
};

// -------------------------------
// ---------- UI HELPERS ---------
// -------------------------------
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
      const start = (opts.startYear || currentYear - 2);
      const end = (opts.endYear || currentYear + 1);
      for (let y = start; y <= end; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
      }
    }
  },

  showAlert(msg, type = "info") {
    // simple alert fallback
    try {
      if (typeof Toastify !== "undefined") {
        Toastify({ text: msg, duration: 4000 }).showToast();
      } else {
        alert(msg);
      }
    } catch (e) {
      alert(msg);
    }
  },
};

// -------------------------------
// ---------- LAYOUT -------------
// -------------------------------
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

    // logout
    this.elements.logoutButton?.addEventListener("click", () => {
      App.clearToken();
      localStorage.clear();
      window.location.href = "index.html";
    });

    // collapsible sidebar menu
    this.elements.sidebarNav?.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (href === "#") {
        e.preventDefault();
        const parent = link.closest(".collapsible");
        parent?.querySelector(".submenu")?.classList.toggle("hidden");
        parent?.querySelector(".submenu-toggle")?.classList.toggle("rotate-180");
      }
    });

    // sidebar collapse button
    this.elements.sidebarToggleBtn?.addEventListener("click", () => {
      document.getElementById("app-container")?.classList.toggle("sidebar-collapsed");
    });

    // ==== 🔧 Tambahkan ini (dropdown perbaikan) ====
    // user dropdown / profile menu toggle
    const dropdownToggles = document.querySelectorAll("[data-dropdown-toggle]");
    dropdownToggles.forEach((btn) => {
      const targetId = btn.getAttribute("data-dropdown-toggle");
      const menu = document.getElementById(targetId);
      if (menu) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          menu.classList.toggle("hidden");
        });
        // klik di luar menutup dropdown
        document.addEventListener("click", (ev) => {
          if (!btn.contains(ev.target) && !menu.contains(ev.target)) {
            menu.classList.add("hidden");
          }
        });
      }
    });

    // ==== Akhir tambahan ====

    // populate user
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


// -------------------------------
// ---------- DASHBOARD ----------
// -------------------------------
App.pages.dashboard = {
  elements: {},
  init() {
    this.elements.monthFilter = document.getElementById("dashboard-month-filter");
    this.elements.yearFilter = document.getElementById("dashboard-year-filter");
    this.elements.filterBtn = document.getElementById("filter-dashboard-btn");
    this.elements.totalRupiah = document.getElementById("total-pesanan-rp");
    this.elements.totalCustomer = document.getElementById("total-customer");
    this.elements.tableBody = document.getElementById("dashboard-table-body");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn?.addEventListener("click", () => this.load());
    // initial load
    this.load();
  },

  async load() {
    const month = this.elements.monthFilter?.value || (new Date().getMonth() + 1);
    const year = this.elements.yearFilter?.value || (new Date().getFullYear());
    try {
      const data = await App.api.getDashboard(month, year);
      const summary = data.summary || { total_rupiah: 0, total_customer: 0 };
      this.elements.totalRupiah.textContent = App.ui.formatCurrency(summary.total_rupiah || 0);
      this.elements.totalCustomer.textContent = summary.total_customer || 0;

      // show status counts if backend provides
      const sc = data.statusCounts || {};
      const map = {
        belum_produksi: "status-belum-produksi",
        sudah_produksi: "status-sudah-produksi",
        di_warna: "status-sudah-warna",
        siap_kirim: "status-siap-kirim",
        di_kirim: "status-sudah-kirim",
      };
      Object.keys(map).forEach((k) => {
        const el = document.getElementById(map[k]);
        if (el) el.textContent = (sc[k] !== undefined ? sc[k] : "0");
      });

      // fetch list of ready-to-ship workorders for the table (legacy endpoint)
      const rows = await App.api.getWorkOrders(month, year, null, "siap_kirim");
      this.renderTable(rows || []);
    } catch (err) {
      if (err.code === "TOKEN_EXPIRED") {
        App.ui.showAlert("Sesi habis. Silakan login ulang.", "error");
        window.location.href = "index.html";
        return;
      }
      console.error("Dashboard load error:", err);
      App.ui.showAlert("Gagal memuat dashboard: " + (err.message || err), "error");
    }
  },

  renderTable(rows) {
    const tb = this.elements.tableBody;
    if (!tb) return;
    if (!rows || rows.length === 0) {
      tb.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Tidak ada data.</td></tr>`;
      return;
    }
    tb.innerHTML = rows
      .map((r) => {
        const qty = r.qty ?? "";
        const ukuran = r.ukuran ?? "";
        return `<tr>
          <td class="px-6 py-4">${r.nama_customer || "-"}</td>
          <td class="px-6 py-4">${r.deskripsi || "-"}</td>
          <td class="px-6 py-4 text-center">${qty}</td>
          <td class="px-6 py-4 text-center">${ukuran}</td>
        </tr>`;
      })
      .join("");
  },

  // If remote changes happen (socket), refresh summary/table
  onRemoteCreate() { this.load(); },
  onRemoteUpdate() { this.load(); },
  onRemoteDelete() { this.load(); },
};

// -------------------------------
// ---------- APP INIT -----------
// -------------------------------
App.init = async function () {
  const path = window.location.pathname.split("/").pop() || "index.html";

  // ========= LOGIN PAGE =========
  if (path === "index.html" || path === "" || path === "login.html") {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username")?.value?.trim();
        const password = document.getElementById("password")?.value?.trim();
        if (!username || !password)
          return App.ui.showAlert("Username & password wajib diisi.");

        try {
          const res = await App.api.checkLogin(username, password);
          if (!res || !res.token) throw new Error(res?.message || "Login gagal");
          App.setToken(res.token);
          localStorage.setItem("username", res.user?.username || username);
          localStorage.setItem("role", res.user?.role || "user");
          window.location.href = "dashboard.html";
        } catch (err) {
          console.error("login error:", err);
          const el = document.getElementById("login-error");
          if (el) {
            el.textContent = err.message || "Login gagal";
            el.classList.remove("hidden");
          } else {
            App.ui.showAlert(err.message || "Login gagal", "error");
          }
        }
      });
    }
    return;
  }

  // ========= PROTECTED PAGES =========
  const token = App.getToken();
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // Load layout (sidebar + header)
  await App.loadLayout();

  // ✅ SOCKET.IO: pastikan sudah siap sebelum dipanggil
  if (typeof io !== "undefined" && !App.socket) {
    App.socketInit();
  } else if (!App.socket) {
    console.warn("⚠️ Socket.IO belum siap, mencoba lagi...");
    setTimeout(() => {
      if (typeof io !== "undefined" && !App.socket) App.socketInit();
    }, 1000);
  }

  // ========= PAGE INIT =========
  const pageName = path.replace(".html", "");
  if (App.pages[pageName]?.init) {
    try {
      App.pages[pageName].init();
    } catch (err) {
      console.error(`Init ${pageName} error:`, err);
    }
  }

  if (App.pages[pageName]?.load && pageName !== "work-orders") {
    try {
      App.pages[pageName].load();
    } catch (err) {
      console.error(`Load ${pageName} error:`, err);
    }
  }
};


// start when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  App.init().catch((e) => console.error("App.init error:", e));
});

// ==========================================================
// app.js — PART 2/3
// Work Orders (Tabulator autosave + realtime), Status Barang,
// Data Karyawan (CRUD) & Payroll
// ==========================================================

/* =========================
   WORK ORDERS (Tabulator)
   - chunked fetch for performance
   - editors with cellEdited autosave
   - create new row when pasting or typing at empty row
   - realtime updates via Socket.IO
   ========================= */

App.pages["work-orders"] = {
  state: {
    table: null,
    month: null,
    year: null,
  },
  elements: {},

  init() {
    this.elements.container = document.getElementById("workorders-grid");
    this.elements.monthFilter = document.getElementById("wo-month-filter");
    this.elements.yearFilter = document.getElementById("wo-year-filter");
    this.elements.filterBtn = document.getElementById("filter-wo-btn");

    // isi dropdown bulan/tahun
    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    // event filter
    this.elements.filterBtn?.addEventListener("click", () => this.reload());

    // inisialisasi tabel
    this.initTabulator();

    // load data awal
    this.reload();

    // socket.io listener realtime
    App.socket?.on("wo_created", (newRow) => this.onRemoteCreate(newRow));
    App.socket?.on("wo_updated", (updatedRow) => this.onRemoteUpdate(updatedRow));
    App.socket?.on("wo_deleted", (deletedRow) => this.onRemoteDelete(deletedRow));
  },

  initTabulator() {
    if (!this.elements.container) {
      console.warn("❗ Kontainer workorders-grid tidak ditemukan");
      return;
    }

    // destroy instansi lama jika ada
    if (this.state.table) {
      try { this.state.table.destroy(); } catch (e) {}
    }

    const self = this;
    this.state.table = new Tabulator(this.elements.container, {
      height: "600px",
      layout: "fitColumns",
      index: "id",
      reactiveData: true,
      clipboard: true,
      clipboardPasteAction: "update",
      clipboardCopyRowRange: "range",
      selectable: 1,
      columns: [
        { title: "Tanggal", field: "tanggal", editor: "input", width: 150 },
        { title: "Nama Customer", field: "nama_customer", editor: "input", widthGrow: 2 },
        { title: "Deskripsi", field: "deskripsi", editor: "input", widthGrow: 3 },
        { title: "Ukuran", field: "ukuran", editor: "input", width: 150 },
        { title: "Qty", field: "qty", editor: "input", width: 100 },
      ],

      cellEdited: async function (cell) {
        const row = cell.getRow();
        const rowData = row.getData();
        const field = cell.getField();
        const value = cell.getValue();

        try {
          // Jika baris masih temporer (belum ada ID asli)
          if (!rowData.id || String(rowData.id).startsWith("temp-")) {
            const payload = {
              tanggal: rowData.tanggal || App.ui.formatDateISO(new Date()),
              nama_customer: rowData.nama_customer || "",
              deskripsi: rowData.deskripsi || "",
              ukuran: rowData.ukuran || "",
              qty: rowData.qty || "",
              bulan: self.state.month,
              tahun: self.state.year,
            };

            const created = await App.api.addWorkOrder(payload);
            row.update(created);
            App.ui.showAlert("✅ Baris baru tersimpan.");
          } else {
            // update baris yang sudah ada
            await App.api.updateWorkOrder(rowData.id, { [field]: value });
            App.ui.showAlert("Perubahan disimpan.", "success");

            // kirim event ke socket untuk user lain
            App.socket?.emit("wo_updated", { id: rowData.id, [field]: value });
          }
        } catch (err) {
          console.error("❌ Gagal menyimpan perubahan:", err);
          App.ui.showAlert("Gagal menyimpan: " + (err.message || err));
        }
      },
    });
  },

  async reload() {
    const month = this.elements.monthFilter?.value || (new Date().getMonth() + 1);
    const year = this.elements.yearFilter?.value || new Date().getFullYear();
    this.state.month = month;
    this.state.year = year;

    try {
      const res = await App.api.request(`/workorders/chunk?month=${month}&year=${year}`);
      const data = res.data || [];

      // jika kurang dari 10.000 baris, tambahkan baris kosong
      const totalRows = 10000;
      const missing = totalRows - data.length;
      for (let i = 0; i < missing; i++) {
        data.push({
          id: `temp-${i}`,
          tanggal: "",
          nama_customer: "",
          deskripsi: "",
          ukuran: "",
          qty: "",
        });
      }

      if (this.state.table) {
        this.state.table.replaceData(data);
      }
    } catch (err) {
      console.error("❌ Gagal memuat data WO:", err);
      App.ui.showAlert("Gagal memuat data work orders: " + (err.message || err));
    }
  },

  // fungsi tambahan untuk baris baru manual (opsional)
  addEmptyRow() {
    if (!this.state.table) return;
    this.state.table.addRow({
      id: `temp-${Date.now()}`,
      tanggal: "",
      nama_customer: "",
      deskripsi: "",
      ukuran: "",
      qty: "",
    }, true);
  },

  // sinkronisasi realtime antar user
  onRemoteCreate(newRow) {
    if (!this.state.table) return;
    if (this.state.table.getRow(newRow.id)) return;
    this.state.table.addRow(newRow, true);
  },
  onRemoteUpdate(updatedRow) {
    if (!this.state.table) return;
    const row = this.state.table.getRow(updatedRow.id);
    if (row) row.update(updatedRow);
  },
  onRemoteDelete(deletedRow) {
    if (!this.state.table) return;
    try {
      this.state.table.deleteRow(deletedRow.id);
    } catch (e) {}
  },
};


/* =========================
   STATUS BARANG
   - shows all orders for month/year
   - checkboxes update realtime via /api/workorders/:id/status
   ========================= */

App.pages["status-barang"] = {
  state: { data: [] },
  elements: {},

  init() {
    this.elements.monthFilter = document.getElementById("status-month-filter");
    this.elements.yearFilter = document.getElementById("status-year-filter");
    this.elements.filterBtn = document.getElementById("filter-status-btn");
    this.elements.tableBody = document.getElementById("status-table-body");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn?.addEventListener("click", () => this.load());
    this.load();
  },

  async load() {
    const month = this.elements.monthFilter?.value || (new Date().getMonth() + 1);
    const year = this.elements.yearFilter?.value || (new Date().getFullYear());
    try {
      const rows = await App.api.getWorkOrders(month, year);
      this.state.data = rows || [];
      this.render(rows || []);
    } catch (err) {
      console.error("status load error", err);
      App.ui.showAlert("Gagal memuat status barang: " + (err.message || err));
    }
  },

  render(data) {
    if (!this.elements.tableBody) return;
    if (!data || data.length === 0) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">Tidak ada data.</td></tr>`;
      return;
    }
    this.elements.tableBody.innerHTML = data
      .map((d) => {
        return `<tr>
          <td class="px-4 py-3">${d.nama_customer || "-"}</td>
          <td class="px-4 py-3">${d.deskripsi || "-"}</td>
          <td class="px-4 py-3 text-center">${d.qty || "-"}</td>
          <td class="px-4 py-3 text-center">${d.ukuran || "-"}</td>
          <td class="px-4 py-3 text-center"><input type="checkbox" data-id="${d.id}" data-col="di_produksi" ${d.di_produksi === "true" || d.di_produksi === true ? "checked" : ""}></td>
          <td class="px-4 py-3 text-center"><input type="checkbox" data-id="${d.id}" data-col="di_warna" ${d.di_warna === "true" || d.di_warna === true ? "checked" : ""}></td>
          <td class="px-4 py-3 text-center"><input type="checkbox" data-id="${d.id}" data-col="siap_kirim" ${d.siap_kirim === "true" || d.siap_kirim === true ? "checked" : ""}></td>
        </tr>`;
      })
      .join("");

    // bind checkbox events
    this.elements.tableBody.querySelectorAll("input[type='checkbox']").forEach((cb) => {
      cb.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        const col = e.target.dataset.col;
        const val = e.target.checked ? true : false;
        try {
          await App.api.updateWorkOrderStatus(id, col, val);
          App.ui.showAlert("Status tersimpan.");
        } catch (err) {
          console.error("update status error", err);
          App.ui.showAlert("Gagal memperbarui status: " + (err.message || err));
          // rollback UI
          e.target.checked = !val;
        }
      });
    });
  },

  // socket reactions
  onRemoteUpdate(updatedRow) {
    // if row present in this list, update table
    const tb = this.elements.tableBody;
    if (!tb) return;
    const checkbox = tb.querySelector(`input[data-id='${updatedRow.id}']`);
    if (checkbox) {
      // update checked states for each col
      ["di_produksi", "di_warna", "siap_kirim"].forEach((col) => {
        const cb = tb.querySelector(`input[data-id='${updatedRow.id}'][data-col='${col}']`);
        if (cb) cb.checked = (updatedRow[col] === "true" || updatedRow[col] === true);
      });
    }
  },
};

/* =========================
   DATA KARYAWAN (CRUD)
   - list, add, edit modal (prompt), delete
   ========================= */

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
    this.elements.tableBody.innerHTML = data
      .map((k) => `<tr>
        <td class="px-6 py-3">${k.nama_karyawan}</td>
        <td class="px-6 py-3">${App.ui.formatCurrency(k.gaji_harian)}</td>
        <td class="px-6 py-3 text-right">
          <button class="edit-emp text-blue-600 mr-3" data-id="${k.id}">Edit</button>
          <button class="del-emp text-red-600" data-id="${k.id}">Hapus</button>
        </td>
      </tr>`)
      .join("");

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
  },
};

/* =========================
   PAYROLL
   - simple payroll calculator per karyawan
   - post to /api/payroll for kasbon handling
   - print slip (simple new window)
   ========================= */

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

    // Render summary
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

      // bind print
      document.getElementById("print-slip-btn").addEventListener("click", () => {
        this.printSlip({
          nama: selectedOption.textContent,
          periode: this.elements.periodeInput.value,
          hari, lembur, potongan, totalGaji, gajiHarian
        });
      });
    }

    // Save payroll - for now we call /api/payroll to adjust kasbon if any potongan
    try {
      await App.api.postPayroll({ karyawan_id: parseInt(karyawanId), potongan_kasbon: potongan });
      App.ui.showAlert("Payroll diproses dan kasbon diperbarui (jika ada).");
      // reload karyawan list to update kasbon info if used
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
  },
};

// ==========================================================
// app.js — PART 3/3 (FINAL)
// Keuangan, Invoice (DP & Diskon), Surat Jalan, Print PO, Admin
// ==========================================================

/* =========================
   KEUANGAN
   - menampilkan saldo kas, tambah transaksi, riwayat
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
    this.elements.saldoBody.innerHTML = list.map(k => `
      <tr>
        <td class="px-4 py-2">${k.nama_kas}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatCurrency(k.saldo)}</td>
        <td class="px-4 py-2 text-gray-500">${k.keterangan || "-"}</td>
      </tr>
    `).join("");
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
    this.elements.riwayatBody.innerHTML = data.map(t => `
      <tr>
        <td class="px-4 py-2">${t.tanggal}</td>
        <td class="px-4 py-2">${t.nama_kas}</td>
        <td class="px-4 py-2 text-right ${t.tipe === 'PEMASUKAN' ? 'text-green-600' : 'text-red-600'}">${App.ui.formatCurrency(t.jumlah)}</td>
        <td class="px-4 py-2">${t.keterangan || '-'}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatCurrency(t.saldo_sesudah)}</td>
      </tr>
    `).join("");
  },
};

/* =========================
   INVOICE
   - menampilkan invoice per bulan
   - tambahan kolom DP dan Diskon
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
      </div>
    `;
  },

  renderTable(rows) {
    if (!this.elements.tableBody) return;
    if (!rows || rows.length === 0) {
      this.elements.tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center">Tidak ada data.</td></tr>`;
      return;
    }
    this.elements.tableBody.innerHTML = rows.map(r => `
      <tr>
        <td class="px-4 py-2">${r.no_inv || '-'}</td>
        <td class="px-4 py-2">${r.nama_customer}</td>
        <td class="px-4 py-2">${r.deskripsi || '-'}</td>
        <td class="px-4 py-2 text-center">${r.qty}</td>
        <td class="px-4 py-2 text-center">${r.ukuran}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatCurrency(r.harga)}</td>
        <td class="px-4 py-2 text-right"><input type="number" data-id="${r.id}" data-col="dp" class="border p-1 w-20 text-right" value="${r.dp || 0}"></td>
        <td class="px-4 py-2 text-right"><input type="number" data-id="${r.id}" data-col="diskon" class="border p-1 w-20 text-right" value="${r.diskon || 0}"></td>
      </tr>
    `).join("");

    // auto-save DP dan diskon
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
   - buat surat jalan vendor/customer
   - simpan dan cetak
   ========================= */

App.pages["surat-jalan"] = {
  elements: {},

  init() {
    this.elements.form = document.getElementById("suratjalan-form");
    this.elements.tipe = document.getElementById("sj-tipe");
    this.elements.invoice = document.getElementById("sj-invoice");
    this.elements.namaTujuan = document.getElementById("sj-nama-tujuan");
    this.elements.catatan = document.getElementById("sj-catatan");

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
        items: [], // untuk sekarang manual
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
        <p>Tanda tangan penerima:</p>
        <br><br>
        <p>______________________</p>
      </div>
    `;
    const w = window.open("", "", "width=700,height=600");
    w.document.write(`<html><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    w.document.close();
  },
};

/* =========================
   PRINT PO (Sederhana)
   ========================= */

App.pages["print-po"] = {
  elements: {},
  init() {
    this.elements.btn = document.getElementById("print-po-btn");
    this.elements.btn?.addEventListener("click", () => {
      window.print();
    });
  },
};

/* =========================
   ADMIN PAGE
   - daftar user dan ubah status aktif/inaktif
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
    this.elements.tableBody.innerHTML = list.map(u => `
      <tr>
        <td class="px-4 py-2">${u.username}</td>
        <td class="px-4 py-2">${u.phone_number || '-'}</td>
        <td class="px-4 py-2">${u.role}</td>
        <td class="px-4 py-2">${u.subscription_status}</td>
        <td class="px-4 py-2">
          <button data-id="${u.id}" data-status="${u.subscription_status === 'active' ? 'inactive' : 'active'}" class="toggle-sub text-blue-600 underline">
            ${u.subscription_status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </td>
      </tr>
    `).join("");

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

/* =========================
   GLOBAL UTILITY HANDLER
   ========================= */

window.addEventListener("error", (e) => {
  console.error("Global error:", e.message);
});

App.showLoader = function (show = true) {
  let el = document.getElementById("global-loader");
  if (show) {
    if (!el) {
      el = document.createElement("div");
      el.id = "global-loader";
      el.className = "fixed inset-0 flex items-center justify-center bg-black bg-opacity-20 text-white text-lg z-50";
      el.innerHTML = "<div class='bg-gray-800 px-6 py-4 rounded'>Memuat...</div>";
      document.body.appendChild(el);
    }
  } else {
    el?.remove();
  }
};

console.log("✅ app.js (FULL) berhasil dimuat.");

