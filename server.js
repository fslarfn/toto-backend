// =====================================================
// app.js (frontend) — lengkap
// =====================================================

const App = {
  state: {
    socket: null,
    user: null,
  },
  ui: {
    // Helper kecil utk mengisi select bulan/tahun
    populateDateFilters(monthEl, yearEl) {
      if (!monthEl || !yearEl) return;
      monthEl.innerHTML = '';
      for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthEl.appendChild(opt);
      }
      const now = new Date();
      const thisYear = now.getFullYear();
      yearEl.innerHTML = '';
      for (let y = thisYear - 2; y <= thisYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === thisYear) opt.selected = true;
        yearEl.appendChild(opt);
      }
    },

    // set Auth token header helper pada fetch wrapper (tidak butuh)
  },

  // ----------------- API -----------------
  api: {
    baseUrl:
      window.location.hostname === "localhost"
        ? "http://localhost:8080"
        : window.location.origin.replace(/\/$/, ''), // gunakan origin (deploy)

    async request(endpoint, options = {}) {
      // normalisasi endpoint
      const cleanEndpoint = endpoint.startsWith("/api/") ? endpoint : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
      const url = `${this.baseUrl}${cleanEndpoint}`;
      const token = localStorage.getItem("authToken");

      const headers = options.headers || {};
      if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const config = { ...options, headers, credentials: 'same-origin' };

      const response = await fetch(url, config);
      const text = await response.text();
      let result;
      try {
        result = text ? JSON.parse(text) : {};
      } catch (err) {
        result = text;
      }

      if (!response.ok) {
        const message = (result && result.message) ? result.message : `Terjadi kesalahan server (${response.status})`;
        const err = new Error(message);
        err.status = response.status;
        err.payload = result;
        throw err;
      }

      return result;
    }
  },

  // ----------------- SOCKET -----------------
  socketInit() {
    if (this.state.socket || typeof io === 'undefined') return;
    // gunakan origin sebagai alamat socket
    const url = this.api.baseUrl;
    try {
      this.state.socket = io(url, { transports: ["websocket", "polling"] });

      this.state.socket.on('connect', () => {
        console.log('Terhubung ke server:', this.state.socket.id);
      });
      this.state.socket.on('disconnect', (reason) => {
        console.log('Socket client disconnected:', this.state.socket.id, reason);
      });
    } catch (err) {
      console.warn('Gagal inisialisasi socket:', err);
    }
  },

  // ----------------- PAGES -----------------
  pages: {},

  // simple router init: find data-page on body
  init() {
    this.socketInit();
    const page = document.body.getAttribute('data-page');
    if (page && this.pages[page] && typeof this.pages[page].init === 'function') {
      this.pages[page].init();
    }
  }
};

// ===================== PAGE: WORK ORDERS =====================
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

    App.socketInit();
    this.setupSocketListeners();
    this.load();
  },

  setupSocketListeners() {
    const sock = App.state.socket;
    if (!sock) return;
    sock.on("wo_created", (row) => this.addOrUpdateRow(row));
    sock.on("wo_updated", (row) => this.addOrUpdateRow(row));
    sock.on("wo_deleted", (info) => {
      if (!this.state.table) return;
      this.state.table.deleteRow(info.id);
    });
  },

  addOrUpdateRow(updatedRow) {
    if (!this.state.table) return;
    // Tabulator helper: updateOrAddData
    try {
      this.state.table.updateOrAddData([updatedRow]);
    } catch (e) {
      // fallback manual
      const r = this.state.table.getRow(updatedRow.id);
      if (r) r.update(updatedRow);
      else this.state.table.addRow(updatedRow, true);
    }
  },

  async load() {
    const month = this.elements.monthFilter?.value || (new Date().getMonth() + 1);
    const year = this.elements.yearFilter?.value || (new Date().getFullYear());

    try {
      const data = await App.api.request(`/workorders?month=${month}&year=${year}`);
      // server returns array
      this.renderTable(Array.isArray(data) ? data : (data.data || []));
    } catch (err) {
      console.error("❌ Gagal load workorders:", err);
      alert("Gagal memuat data Work Orders.");
      this.renderTable([]); // tetap render kosong agar user bisa input
    }
  },

  renderTable(data) {
    // Destroy previous table
    if (this.state.table) {
      try { this.state.table.destroy(); } catch(e) {}
      this.state.table = null;
      this.elements.tableContainer.innerHTML = '';
    }

    // Pastikan data adalah array
    if (!Array.isArray(data)) data = [];

    // Tambah baris kosong sampai 1000 (cukup) untuk UX mirip Google Sheets
    const MIN = 1000;
    while (data.length < MIN) {
      data.push({
        id: `temp-${data.length + 1}`,
        tanggal: "",
        nama_customer: "",
        deskripsi: "",
        ukuran: "",
        qty: "",
      });
    }

    // Inisialisasi Tabulator
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

      cellEdited: async (cell) => {
        const rowData = cell.getRow().getData();
        const field = cell.getField();
        const value = cell.getValue();

        try {
          // NEW ROW -> create on server
          if (!rowData.id || String(rowData.id).startsWith("temp-")) {
            const payload = {
              tanggal: rowData.tanggal || new Date().toISOString().slice(0,10),
              nama_customer: rowData.nama_customer || "Tanpa Nama",
              deskripsi: rowData.deskripsi || "",
              ukuran: rowData.ukuran || null,
              qty: rowData.qty || null,
            };
            const newRow = await App.api.request("/workorders", {
              method: "POST",
              body: JSON.stringify(payload)
            });

            // update row in table with server id
            cell.getRow().update(newRow);

            // emit to socket so other clients get it soon
            App.state.socket?.emit('wo_created', newRow);
            return;
          }

          // EXISTING ROW -> patch
          const id = rowData.id;
          const updated = await App.api.request(`/workorders/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ [field]: value })
          });

          if (updated && updated.data) {
            cell.getRow().update(updated.data);
            App.state.socket?.emit('wo_updated', updated.data);
          }
        } catch (err) {
          console.error("❌ Gagal menyimpan data:", err);
          alert("Gagal menyimpan data. Periksa koneksi atau login ulang.");
        }
      }
    });
  }
};

// ===================== PAGE: DASHBOARD =====================
App.pages["dashboard"] = {
  elements: {},
  init() {
    this.elements = {
      month: document.getElementById('dashboard-month-filter'),
      year: document.getElementById('dashboard-year-filter'),
      filterBtn: document.getElementById('dashboard-filter-btn'),
      totalCustomer: document.getElementById('total-customer'),
      totalQty: document.getElementById('total-qty'),
      belumProduksi: document.getElementById('belum-produksi'),
      sudahProduksi: document.getElementById('sudah-produksi'),
      sudahWarna: document.getElementById('sudah-warna'),
      siapKirim: document.getElementById('siap-kirim'),
      sudahKirim: document.getElementById('sudah-kirim'),
    };
    App.ui.populateDateFilters(this.elements.month, this.elements.year);
    this.elements.filterBtn?.addEventListener('click', () => this.load());
    App.socketInit();
    this.setupSocketListeners();
    this.load();
  },

  setupSocketListeners() {
    const sock = App.state.socket;
    if (!sock) return;
    // When a workorder is created/updated/deleted, refresh summary quickly
    const refresh = () => this.load();
    sock.on('wo_created', refresh);
    sock.on('wo_updated', refresh);
    sock.on('wo_deleted', refresh);
  },

  async load() {
    const month = this.elements.month?.value || (new Date().getMonth() + 1);
    const year = this.elements.year?.value || (new Date().getFullYear());

    try {
      const data = await App.api.request(`/dashboard?month=${month}&year=${year}`);
      // fill UI
      if (this.elements.totalCustomer) this.elements.totalCustomer.textContent = data.total_customer ?? 0;
      if (this.elements.totalQty) this.elements.totalQty.textContent = data.total_qty ?? 0;
      if (this.elements.belumProduksi) this.elements.belumProduksi.textContent = data.status_summary?.belum_produksi ?? 0;
      if (this.elements.sudahProduksi) this.elements.sudahProduksi.textContent = data.status_summary?.sudah_produksi ?? 0;
      if (this.elements.sudahWarna) this.elements.sudahWarna.textContent = data.status_summary?.sudah_warna ?? 0;
      if (this.elements.siapKirim) this.elements.siapKirim.textContent = data.status_summary?.siap_kirim ?? 0;
      if (this.elements.sudahKirim) this.elements.sudahKirim.textContent = data.status_summary?.sudah_kirim ?? 0;
    } catch (err) {
      console.error("Gagal memuat dashboard:", err);
    }
  }
};

// ===================== INIT on DOMContentLoaded =====================
document.addEventListener('DOMContentLoaded', () => {
  try {
    App.init();
  } catch (err) {
    console.error('App init error', err);
  }
});
