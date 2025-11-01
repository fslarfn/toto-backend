// ==========================================================
// 🚀 app.js — ERP TOTO (FINAL REALTIME + STABIL DI RAILWAY)
// ==========================================================

const App = {
  state: {
    user: null,
    token: localStorage.getItem("authToken") || null,
    socket: null,
  },
  pages: {},
  elements: {},
};

// ==========================================================
// 🌐 API HANDLER (Fetch Wrapper)
// ==========================================================
App.api = {
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : "https://erptoto.up.railway.app",

  async request(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith("/api/")
      ? endpoint
      : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const url = `${this.baseUrl}${cleanEndpoint}`;
    const token = localStorage.getItem("authToken");

    const headers = options.headers || {};
    if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = text;
    }

    if (!response.ok) {
      console.error("❌ API ERROR:", result);
      throw new Error(result.message || "Terjadi kesalahan server.");
    }

    return result;
  },
};

// ==========================================================
// 🧭 UTILITAS UI
// ==========================================================
App.ui = {
  populateDateFilters(monthEl, yearEl) {
    if (!monthEl || !yearEl) return;
    const now = new Date();
    monthEl.innerHTML = "";
    yearEl.innerHTML = "";
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === now.getMonth() + 1) opt.selected = true;
      monthEl.appendChild(opt);
    }
    const currentYear = now.getFullYear();
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      yearEl.appendChild(opt);
    }
  },
};

// ==========================================================
// 🧩 HALAMAN LOGIN
// ==========================================================
App.pages["login"] = {
  async init() {
    document
      .getElementById("login-form")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;
        try {
          const res = await App.api.request("/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
          });
          localStorage.setItem("authToken", res.token);
          App.state.user = res.user;
          window.location.href = "/dashboard.html";
        } catch (err) {
          alert("Login gagal: " + err.message);
        }
      });
  },
};

// ==========================================================
// 🏠 HALAMAN DASHBOARD
// ==========================================================
App.pages["dashboard"] = {
  init() {
    console.log("📊 Dashboard siap");
  },
};

// ==========================================================
// 🧱 HALAMAN WORK ORDERS (Realtime seperti Google Sheet)
// ==========================================================
App.pages["work-orders"] = {
  state: { table: null },
  elements: {},

  async init() {
    this.elements = {
      monthFilter: document.getElementById("wo-month-filter"),
      yearFilter: document.getElementById("wo-year-filter"),
      filterBtn: document.getElementById("filter-wo-btn"),
      tableContainer: document.getElementById("workorders-grid"),
    };

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
    this.elements.filterBtn?.addEventListener("click", () => this.load());

    const socketUrl = App.api.baseUrl.replace(/^http/, "ws");
    if (!App.state.socket && typeof io !== "undefined") {
      App.state.socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        path: "/socket.io",
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        secure: true,
      });
      console.log("🔗 Socket.IO connected to:", socketUrl);
    }

    this.setupSocketListeners();
    await this.load();
  },

  setupSocketListeners() {
    const sock = App.state.socket;
    if (!sock) return;
    sock.on("wo_created", (r) => this.addOrUpdateRow(r));
    sock.on("wo_updated", (r) => this.addOrUpdateRow(r));
    sock.on("wo_deleted", (r) => this.state.table?.deleteRow(r.id));
  },

  addOrUpdateRow(row) {
    const tbl = this.state.table;
    if (!tbl) return;
    const existing = tbl.getRow(row.id);
    if (existing) existing.update(row);
    else tbl.addRow(row, true);
  },

  async load() {
    const m = this.elements.monthFilter.value || new Date().getMonth() + 1;
    const y = this.elements.yearFilter.value || new Date().getFullYear();
    const data = await App.api.request(`/workorders?month=${m}&year=${y}`);
    this.renderTable(data);
  },

  renderTable(data) {
    if (this.state.table) this.state.table.destroy();
    while (data.length < 10000)
      data.push({ id: `temp-${data.length}`, tanggal: "", nama_customer: "", deskripsi: "", ukuran: "", qty: "" });

    this.state.table = new Tabulator(this.elements.tableContainer, {
      data,
      layout: "fitColumns",
      height: "600px",
      reactiveData: true,
      index: "id",
      clipboard: true,
      clipboardPasteAction: "update",
      columns: [
        { title: "Tanggal", field: "tanggal", editor: "input", width: 130 },
        { title: "Nama Customer", field: "nama_customer", editor: "input", width: 200 },
        { title: "Deskripsi", field: "deskripsi", editor: "input", widthGrow: 2 },
        { title: "Ukuran", field: "ukuran", editor: "input", width: 120 },
        { title: "Qty", field: "qty", editor: "input", width: 100 },
      ],
      cellEdited: async (cell) => {
        const row = cell.getRow().getData();
        const field = cell.getField();
        const value = cell.getValue();
        try {
          if (!row.id || String(row.id).startsWith("temp-")) {
            const newRow = await App.api.request("/workorders", {
              method: "POST",
              body: JSON.stringify(row),
            });
            cell.getRow().update(newRow);
            return;
          }
          const updated = await App.api.request(`/workorders/${row.id}`, {
            method: "PATCH",
            body: JSON.stringify({ [field]: value }),
          });
          if (updated?.data) cell.getRow().update(updated.data);
        } catch (e) {
          console.error("❌ Gagal menyimpan:", e);
        }
      },
    });
  },
};

// ==========================================================
// ⚙️ ROUTER PAGE HANDLER
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  const pageName = document.body.dataset.page;
  if (pageName && App.pages[pageName]) {
    App.pages[pageName].init();
  }
  console.log(`✅ Page Loaded: ${pageName}`);
});
