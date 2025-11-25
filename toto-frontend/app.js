// ==========================================================
// 🚀 APP.JS FINAL — PART 1
// Layout Loader | Auth | Sidebar Toggle | Socket
// ==========================================================

const App = {
  api: {
    baseUrl: "https://erptoto.up.railway.app"
  },
  state: {
    user: null,
    token: localStorage.getItem("authToken") || null,
    socket: null,
    sidebarCollapsed: false,
  }
};

// ==========================================================
// 🔐 AUTH — AMBIL USER LOGIN & AUTO REFRESH TOKEN
// ==========================================================
App.safeGetUser = async function () {
  try {
    let token = App.state.token;

    if (!token) throw new Error("Token hilang — redirect login.");

    // 1️⃣ Coba akses /me
    let res = await fetch(`${App.api.baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // 2️⃣ Jika token expired → refresh token
    if (res.status === 401) {
      const refreshRes = await fetch(`${App.api.baseUrl}/api/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      const data = await refreshRes.json();
      if (!data.token) throw new Error("Refresh token gagal.");

      token = data.token;
      localStorage.setItem("authToken", token);
      App.state.token = token;

      res = await fetch(`${App.api.baseUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    const user = await res.json();
    App.state.user = user;
    return user;

  } catch (err) {
    console.error("❌ safeGetUser Error:", err.message);
    localStorage.removeItem("authToken");
    window.location.href = "login.html";
  }
};

// ==========================================================
// 🧩 LOAD LAYOUT (SIDEBAR + HEADER)
// ==========================================================
App.loadLayout = async function () {
  try {
    const sidebarHtml = await fetch("sidebar.html").then(r => r.text());
    const headerHtml = await fetch("header.html").then(r => r.text());

    document.getElementById("sidebar").innerHTML = sidebarHtml;
    document.getElementById("header-container").innerHTML = headerHtml;

    App.initSidebar();
    App.initHeader();
  } catch (err) {
    console.error("❌ Gagal load layout:", err);
  }
};

// ==========================================================
// 🍔 SIDEBAR & HAMBURGER TOGGLE
// ==========================================================
App.initSidebar = function () {
  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const navLinks = sidebar.querySelectorAll("a");

  // 1️⃣ Klik menu → highlight page aktif
  navLinks.forEach(link => {
    if (window.location.pathname.includes(link.getAttribute("href"))) {
      link.classList.add("bg-[#A67B5B]");
    }
  });

  // 2️⃣ Click on collapsible menu
  const collapsibles = sidebar.querySelectorAll(".collapsible > a");
  collapsibles.forEach(menu => {
    menu.addEventListener("click", (e) => {
      e.preventDefault();
      const submenu = menu.parentElement.querySelector(".submenu");
      submenu.classList.toggle("hidden");

      const arrow = menu.querySelector(".submenu-toggle");
      arrow.classList.toggle("rotate-180");
    });
  });

  // 3️⃣ Sidebar mobile backdrop
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      sidebarBackdrop.classList.add("hidden");
    });
  }

  // 4️⃣ Logout
  const logoutBtn = document.getElementById("logout-button");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("authToken");
      window.location.href = "login.html";
    });
  }
};

App.initHeader = function () {
  const btn = document.getElementById("sidebar-toggle-btn");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");

  if (!btn) return;

  btn.addEventListener("click", () => {
    sidebar.classList.toggle("open");

    // tampilkan backdrop pada layar kecil
    if (backdrop) {
      if (sidebar.classList.contains("open")) backdrop.classList.remove("hidden");
      else backdrop.classList.add("hidden");
    }
  });

  // tampilkan nama user
  if (App.state.user) {
    const ud = document.getElementById("user-display");
    const ua = document.getElementById("user-avatar");
    if (ud) ud.textContent = App.state.user.username;
    if (ua && App.state.user.profile_picture_url) {
      ua.src = App.api.baseUrl + App.state.user.profile_picture_url;
      ua.classList.remove("hidden");
    }
  }
};

// ==========================================================
// ⚡ SOCKET.IO — REALTIME
// ==========================================================
App.initSocket = function () {
  try {
    App.state.socket = io(App.api.baseUrl);
    console.log("🔌 Socket connected!");
  } catch (err) {
    console.error("❌ Socket gagal:", err);
  }
};

// ==========================================================
// 🚀 INISIALISASI GLOBAL APP
// ==========================================================
App.init = async function () {
  await App.safeGetUser();
  await App.loadLayout();
  App.initSocket();
  console.log("✨ Layout + Auth + Socket siap");
};

document.addEventListener("DOMContentLoaded", App.init);

// ======================================================================
// 📌 APP.JS FINAL — PART 2
// Dashboard : Summary + Status Card + Items Table
// ======================================================================

App.pages = App.pages || {};
App.pages.dashboard = {
  state: {
    month: null,
    year: null,
    status: "siap_kirim",
    items: [],
  },

  init() {
    console.log("📌 Init Dashboard Page");

    this.els = {
      month: document.getElementById("dashboard-month-filter"),
      year: document.getElementById("dashboard-year-filter"),
      filterBtn: document.getElementById("dashboard-filter-btn"),
      summary: document.getElementById("dashboard-summary"),
      statusWrapper: document.getElementById("dashboard-status-list"),
      tableBody: document.getElementById("dashboard-items-table"),
      statusBtns: document.querySelectorAll(".status-filter-btn"),
      tableTitle: document.getElementById("table-title"),
    };

    // Pastikan halaman dashboard
    if (!this.els.month) return;

    App.ui.populateDateFilters(this.els.month, this.els.year);
    this.state.month = this.els.month.value;
    this.state.year = this.els.year.value;

    this.initEvents();
    this.loadSummary();
    this.loadItems();
  },

  // 🔗 Event handler
  initEvents() {
    this.els.filterBtn.addEventListener("click", () => {
      this.state.month = this.els.month.value;
      this.state.year = this.els.year.value;
      this.loadSummary();
      this.loadItems();
    });

    // Klik status card filter
    this.els.statusBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        this.els.statusBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        this.state.status = btn.dataset.status;
        this.els.tableTitle.textContent = `Daftar Barang ${btn.textContent}`;
        this.loadItems();
      });
    });

    if (App.state.socket) {
      App.state.socket.on("wo_updated", () => this.loadSummary());
      App.state.socket.on("wo_created", () => this.loadSummary());
    }
  },

  // 📌 Load Summary Dashboard
  async loadSummary() {
    try {
      this.els.summary.innerHTML = `<div class="text-center text-gray-500 py-6">Memuat ringkasan...</div>`;

      const data = await App.api.request(
        `/dashboard/summary?month=${this.state.month}&year=${this.state.year}`
      );

      this.renderSummary(data);
    } catch (e) {
      console.error(e);
      this.els.summary.innerHTML = `<p class="text-center text-red-500 py-6">Gagal memuat ringkasan</p>`;
    }
  },

  renderSummary(data) {
    this.els.summary.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        ${Object.entries(data).map(([key, val]) => this.summaryCard(key, val)).join("")}
      </div>
    `;
  },

  summaryCard(key, val) {
    const label = {
      belum_produksi: "Belum Produksi",
      di_produksi: "Dalam Produksi",
      di_warna: "Di Warna",
      siap_kirim: "Siap Kirim",
      di_kirim: "Sudah Kirim"
    }[key] || key;

    return `
      <div class="status-card shadow rounded-lg p-4 text-center" data-status="${key}">
        <p class="text-sm font-medium">${label}</p>
        <p class="text-2xl font-bold mt-1">${val}</p>
      </div>
    `;
  },

  // 📌 Load Data Items di tabel
  async loadItems() {
    try {
      this.els.tableBody.innerHTML = `
        <tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Memuat data...</td></tr>
      `;

      const items = await App.api.request(
        `/dashboard/items?month=${this.state.month}&year=${this.state.year}&status=${this.state.status}`
      );

      this.state.items = items;
      this.renderItems();
    } catch (e) {
      console.error(e);
      this.els.tableBody.innerHTML = `
        <tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Gagal memuat data</td></tr>
      `;
    }
  },

  // 🔥 FIX — Customer tampil benar, tidak tertukar deskripsi
  renderItems() {
    if (!this.state.items.length) {
      this.els.tableBody.innerHTML = `
        <tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Tidak ada data</td></tr>
      `;
      return;
    }

    this.els.tableBody.innerHTML = this.state.items.map(item => `
      <tr>
        <td class="px-6 py-2">${App.ui.formatDate(item.tanggal || "-")}</td>
        <td class="px-6 py-2">${item.nama_customer || "-"}</td>
        <td class="px-6 py-2">${item.deskripsi || "-"}</td>
        <td class="px-6 py-2 text-center">${item.qty || "-"}</td>
        <td class="px-6 py-2 text-center">${item.ukuran || "-"}</td>
        <td class="px-6 py-2 text-center">${item.status || "-"}</td>
      </tr>
    `).join("");
  }
};

// ==========================================================
// ⏳ Auto-initialize dashboard jika page adalah dashboard
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("dashboard.html")) {
    App.pages.dashboard.init();
  }
});

// ======================================================================
// 📌 APP.JS FINAL — PART 3
// Status Barang : Tabulator + Realtime + Auto Save
// ======================================================================

App.pages["status-barang"] = {
  state: {
    table: null,
    loading: false,
    month: null,
    year: null,
    customer: "",
    items: [],
    colorMarkers: new Map(),
  },

  init() {
    console.log("📌 Init Status Barang Page");

    this.els = {
      month: document.getElementById("status-month-filter"),
      year: document.getElementById("status-year-filter"),
      customer: document.getElementById("status-customer-filter"),
      filterBtn: document.getElementById("filter-status-btn"),
      grid: document.getElementById("statusbarang-grid"),
      loading: document.getElementById("loading-overlay"),
      updateIndicator: document.getElementById("status-update-indicator"),
    };

    if (!this.els.month) return;

    App.ui.populateDateFilters(this.els.month, this.els.year);
    this.state.month = this.els.month.value;
    this.state.year = this.els.year.value;

    this.loadColorMarkers();
    this.initEvents();
    this.loadData();
    this.initRealtime();
  },

  // 🧩 Events
  initEvents() {
    this.els.filterBtn.addEventListener("click", () => {
      this.state.month = this.els.month.value;
      this.state.year = this.els.year.value;
      this.state.customer = this.els.customer.value.trim();
      this.loadData();
    });

    // filter customer realtime debounce
    let timer = null;
    this.els.customer.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.state.customer = this.els.customer.value.trim();
        this.loadData();
      }, 500);
    });
  },

  // 🔌 Socket realtime
  initRealtime() {
    if (!App.state.socket) return;

    App.state.socket.on("wo_updated", () => this.loadData());
    App.state.socket.on("wo_created", () => this.loadData());
  },

  // 🧲 Load data
  async loadData() {
    this.showLoading(true);

    try {
      const res = await App.api.request(
        `/status-barang?month=${this.state.month}&year=${this.state.year}&customer=${encodeURIComponent(this.state.customer)}`
      );

      this.state.items = res;
      this.renderTable();

      this.showLoading(false);
    } catch (err) {
      console.error(err);
      this.showLoading(false);
      alert("Gagal memuat data");
    }
  },

  // 🧱 TABULATOR TABLE
  renderTable() {
    if (this.state.table) this.state.table.destroy();
    this.els.grid.innerHTML = "";

    const self = this;

    this.state.table = new Tabulator(this.els.grid, {
      data: this.state.items,
      layout: "fitColumns",
      height: "70vh",
      rowHeight: 35,
      index: "id",
      clipboard: true,

      columns: [
        { title: "#", formatter: "rownum", width: 50, frozen: true },
        {
          title: "Tanggal",
          field: "tanggal",
          width: 110,
          editor: "input",
          formatter: (c) => App.ui.formatDate(c.getValue()),
          cellEdited: (c) => self.save(c.getRow(), "tanggal"),
        },
        {
          title: "Customer",
          field: "nama_customer",          // 🔥 fix customer tertukar
          width: 150,
          editor: "input",
          frozen: true,
          cellEdited: (c) => self.save(c.getRow(), "nama_customer"),
        },
        {
          title: "Deskripsi",
          field: "deskripsi",
          width: 230,
          editor: "input",
          cellEdited: (c) => self.save(c.getRow(), "deskripsi"),
        },
        { title: "Ukuran", field: "ukuran", width: 80, editor: "input", hozAlign: "center", cellEdited: (c) => self.save(c.getRow(), "ukuran") },
        { title: "Qty", field: "qty", width: 65, editor: "number", hozAlign: "center", cellEdited: (c) => self.save(c.getRow(), "qty") },

        // 🔥 Checkbox status realtime
        self.check("di_produksi", "Produksi", "blue"),
        self.check("di_warna", "Warna", "green"),
        self.check("siap_kirim", "Siap Kirim", "yellow"),
        self.check("di_kirim", "Dikirim", "indigo"),
        self.check("pembayaran", "Pembayaran", "red"),

        // 🎨 Color marker
        {
          title: "🎨",
          field: "color_marker",
          width: 50,
          hozAlign: "center",
          formatter: (c) => {
            const id = c.getRow().getData().id;
            const color = self.state.colorMarkers.get(id) || "#fff";
            return `<div class="w-5 h-5 rounded border cursor-pointer" style="margin:auto;background:${color}"></div>`;
          },
          cellClick: (e, c) => self.openColorPicker(c.getRow()),
        },
      ],
    });
  },

  // 📌 Checkbox formatter
  check(field, label, color) {
    const self = this;
    return {
      title: label,
      field,
      width: 105,
      formatter: (c) => `
        <input type="checkbox"
          ${c.getValue() ? "checked" : ""}
          class="w-4 h-4 cursor-pointer"
        >
      `,
      cellClick: (e, c) => {
        const checked = !c.getValue();
        c.getRow().update({ [field]: checked });
        self.save(c.getRow(), field);
      },
    };
  },

  // 💾 Save
  async save(row, field) {
    const id = row.getData().id;
    const value = row.getData()[field];

    await App.api.request(`/workorders/${id}`, {
      method: "PATCH",
      body: {
        [field]: value,
        bulan: parseInt(this.state.month),
        tahun: parseInt(this.state.year),
      },
    });

    if (App.state.socket) {
      App.state.socket.emit("wo_updated", { id, [field]: value });
    }

    this.showSaved();
  },

  // 🎨 Color marker save
  openColorPicker(row) {
    const id = row.getData().id;
    window.openColorPicker(id);
  },

  setRowColor(row, color) {
    const id = row.getData().id;
    this.state.colorMarkers.set(id, color);
    localStorage.setItem("statusBarangColor", JSON.stringify(Object.fromEntries(this.state.colorMarkers)));
    row.update({}); // refresh table
  },

  clearRowColor(row) {
    const id = row.getData().id;
    this.state.colorMarkers.delete(id);
    localStorage.setItem("statusBarangColor", JSON.stringify(Object.fromEntries(this.state.colorMarkers)));
    row.update({});
  },

  loadColorMarkers() {
    const saved = localStorage.getItem("statusBarangColor");
    if (saved) this.state.colorMarkers = new Map(Object.entries(JSON.parse(saved)));
  },

  // UI helper
  showLoading(v) {
    if (!this.els.loading) return;
    this.els.loading.classList.toggle("hidden", !v);
  },
  showSaved() {
    if (!this.els.updateIndicator) return;
    this.els.updateIndicator.style.opacity = "1";
    setTimeout(() => (this.els.updateIndicator.style.opacity = "0"), 900);
  },
};

// ⏳ Auto-init
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("status-barang.html")) {
    App.pages["status-barang"].init();
  }
});

// ======================================================================
// 📌 APP.JS FINAL — PART 4
// PRINT PO : Load Data • Cetak • Tandai Produksi
// ======================================================================

App.pages["print-po"] = {
  state: {
    loading: false,
    selectedIds: [],
    items: [],
  },

  init() {
    console.log("📌 Init PRINT PO Page");

    this.els = {
      content: document.getElementById("po-content"),
      printBtn: document.getElementById("print-btn"),
      finishBtn: document.getElementById("finish-btn"),
      loading: document.getElementById("loading-overlay"),
    };

    if (!this.els.content) return;

    // Load selected IDs from localStorage
    const saved = localStorage.getItem("selectedPO");
    if (!saved) {
      this.els.content.innerHTML = `<p class="text-center text-red-500 font-semibold text-lg">❌ Tidak ada PO yang dipilih.</p>`;
      return;
    }

    this.state.selectedIds = JSON.parse(saved);
    this.loadData();
    this.initEvents();
  },

  initEvents() {
    this.els.printBtn.addEventListener("click", () => this.print());
    this.els.finishBtn.addEventListener("click", () => this.finish());
  },

  // 🔍 LOAD DATA PO
  async loadData() {
    this.showLoading(true);

    try {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      const res = await App.api.request(`/workorders?month=${month}&year=${year}`);
      this.state.items = res.filter((o) => this.state.selectedIds.includes(o.id));

      if (this.state.items.length === 0) {
        this.els.content.innerHTML = `<p class="text-center text-red-500 font-semibold text-lg">❌ Data PO tidak ditemukan.</p>`;
        this.showLoading(false);
        return;
      }

      this.render();
      this.showLoading(false);
    } catch (err) {
      this.showLoading(false);
      alert("Gagal memuat data PO");
      console.error(err);
    }
  },

  // 🧾 Render PO ke halaman
  render() {
    const rows = this.state.items
      .map(
        (i, idx) => `
      <tr class="border">
        <td class="p-2 border text-center">${idx + 1}</td>
        <td class="p-2 border">${i.nama_customer}</td>
        <td class="p-2 border">${i.deskripsi}</td>
        <td class="p-2 border text-center">${i.ukuran}</td>
        <td class="p-2 border text-center">${i.qty}</td>
        <td class="p-2 border text-right">${App.ui.formatCurrency(i.harga)}</td>
        <td class="p-2 border text-right font-bold">${App.ui.formatCurrency(i.subtotal)}</td>
      </tr>`
      )
      .join("");

    const total = this.state.items.reduce((t, i) => t + i.subtotal, 0);

    this.els.content.innerHTML = `
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-[#5C4033]">PURCHASE ORDER</h2>
      </div>

      <table class="w-full border-collapse text-sm mb-4">
        <thead class="bg-gray-100">
          <tr>
            <th class="p-2 border">#</th>
            <th class="p-2 border">Customer</th>
            <th class="p-2 border">Deskripsi</th>
            <th class="p-2 border">Ukuran</th>
            <th class="p-2 border">Qty</th>
            <th class="p-2 border">Harga</th>
            <th class="p-2 border">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="text-right font-bold text-lg">
        TOTAL : ${App.ui.formatCurrency(total)}
      </div>
    `;
  },

  // 🖨️ PRINT ACTION
  print() {
    window.print();
  },

  // ✔ Selesai & Tandai
  async finish() {
    if (!confirm("Tandai PO sebagai selesai produksi?")) return;

    this.showLoading(true);

    try {
      const res = await App.api.request(`/workorders/mark-printed`, {
        method: "POST",
        body: { ids: this.state.selectedIds },
      });

      // realtime broadcast
      if (App.state.socket) {
        res.updated.forEach((row) => App.state.socket.emit("wo_updated", row));
      }

      // clear selection
      localStorage.removeItem("selectedPO");

      this.showLoading(false);
      alert("PO ditandai selesai ✔");

      // redirect
      setTimeout(() => window.location.href = "work-orders.html", 400);
    } catch (err) {
      this.showLoading(false);
      alert("Gagal menandai PO");
      console.error(err);
    }
  },

  showLoading(v) {
    if (!this.els.loading) return;
    this.els.loading.classList.toggle("hidden", !v);
  },
};

// ⏳ Auto init
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("print-po.html")) {
    App.pages["print-po"].init();
  }
});

// ======================================================
// 📦 STOK BAHAN — FINAL FIXED VERSION
// ======================================================
App.pages["stok-bahan"] = {
  state: { data: [] },
  elements: {},

  async init() {
    this.elements.tableContainer = document.getElementById("stok-grid");
    this.elements.addForm = document.getElementById("stok-form");
    this.elements.updateForm = document.getElementById("update-stok-form");

    await this.loadData();

    this.elements.addForm?.addEventListener("submit", (e) => this.addStok(e));
    this.elements.updateForm?.addEventListener("submit", (e) => this.updateStok(e));
  },

  // ======================================================
  // 🔄 LOAD DATA
  // ======================================================
  async loadData() {
    try {
      this.setLoadingState(true);
      const res = await App.api.request("/stok");
      this.state.data = res || [];
      this.render(res);
    } catch (err) {
      console.error("❌ Gagal memuat stok:", err);
      App.ui.showToast("Gagal memuat data stok", "error");
    } finally {
      this.setLoadingState(false);
    }
  },

  // ======================================================
  // 🧱 RENDER TABLE
  // ======================================================
  render(data) {
    if (!this.elements.tableContainer) return;

    if (!data || data.length === 0) {
      this.elements.tableContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Tidak ada data stok bahan</p>
        </div>
      `;
      return;
    }

    this.elements.tableContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b text-left text-xs font-medium">Kode</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium">Nama</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium">Kategori</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium">Satuan</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium">Stok</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium">Lokasi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(b => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-mono">${b.kode_bahan}</td>
                <td class="px-4 py-3 text-sm">${b.nama_bahan}</td>
                <td class="px-4 py-3 text-sm">${b.kategori || '-'}</td>
                <td class="px-4 py-3 text-sm">${b.satuan || '-'}</td>
                <td class="px-4 py-3 text-sm text-right font-semibold ${
                  b.stok < 10 ? "text-red-600" : "text-green-600"
                }">${b.stok}</td>
                <td class="px-4 py-3 text-sm">${b.lokasi || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ======================================================
  // ➕ ADD NEW STOCK
  // ======================================================
  async addStok(e) {
    e.preventDefault();

    const formData = new FormData(this.elements.addForm);
    const data = {
      kode: formData.get("kode"),
      nama: formData.get("nama"),
      satuan: formData.get("satuan"),
      kategori: formData.get("kategori"),
      stok: Number(formData.get("stok") || 0),
      lokasi: formData.get("lokasi")
    };

    // Validasi
    if (!data.kode || !data.nama) {
      return App.ui.showToast("Kode dan nama bahan wajib diisi", "warning");
    }

    try {
      this.setLoadingState(true);
      await App.api.request("/stok", { method: "POST", body: data });
      this.elements.addForm.reset();
      await this.loadData();
      App.ui.showToast("Stok bahan berhasil ditambahkan", "success");
    } catch (err) {
      console.error("❌ Tambah stok error:", err);
      App.ui.showToast("Gagal menambah stok", "error");
    } finally {
      this.setLoadingState(false);
    }
  },

  // ======================================================
  // ✏ UPDATE STOCK
  // ======================================================
  async updateStok(e) {
    e.preventDefault();

    const formData = new FormData(this.elements.updateForm);
    const data = {
      bahan_id: formData.get("bahan_id"),
      tipe: formData.get("tipe"),
      jumlah: Number(formData.get("jumlah") || 0),
      keterangan: formData.get("keterangan")
    };

    try {
      this.setLoadingState(true);
      await App.api.request("/stok/update", {
        method: "POST",
        body: data
      });

      this.elements.updateForm.reset();
      await this.loadData();
      App.ui.showToast("Stok berhasil diperbarui", "success");
    } catch (err) {
      console.error("❌ Update stok error:", err);
      App.ui.showToast("Gagal memperbarui stok", "error");
    } finally {
      this.setLoadingState(false);
    }
  },

  // ======================================================
  // ⏳ LOADING STATE
  // ======================================================
  setLoadingState(isLoading) {
    const loader = document.getElementById("stok-loading");
    if (loader) loader.style.display = isLoading ? "block" : "none";
  }
};



// ======================================================
// 📄 SURAT JALAN PAGE - FINAL VERSION (DIPERBAIKI)
// ======================================================
App.pages["surat-jalan"] = {
  state: {
    currentTab: "customer",
    selectedItems: [],
    workOrders: [],
    isLoading: false,
    lastInvoiceData: [],
    lastInvoiceNo: null,
  },
  elements: {},

  async init() {
    console.log("📄 Surat Jalan INIT Started");
    this.initializeElements();
    this.setupEventListeners();
    this.setupTabNavigation();
    this.setDefaultMonthYear();
    await this.loadWorkOrdersForWarna();
    console.log("✅ Surat Jalan initialized successfully");
  },

  initializeElements() {
    this.elements = {
      tabCustomer: document.getElementById("tab-sj-customer"),
      tabWarna: document.getElementById("tab-sj-warna"),
      tabLog: document.getElementById("tab-sj-log"),
      contentCustomer: document.getElementById("content-sj-customer"),
      contentWarna: document.getElementById("content-sj-warna"),
      contentLog: document.getElementById("content-sj-log"),

      // Customer
      invoiceSearch: document.getElementById("sj-invoice-search"),
      searchBtn: document.getElementById("sj-search-btn"),
      catatan: document.getElementById("sj-catatan"),
      printBtn: document.getElementById("sj-print-btn"),
      printArea: document.getElementById("sj-print-area"),

      // Pewarnaan
      vendorSelect: document.getElementById("sj-warna-vendor"),
      monthSelect: document.getElementById("sj-warna-month"),
      yearInput: document.getElementById("sj-warna-year"),
      customerSearch: document.getElementById("sj-warna-customer-search"),
      selectAllCheckbox: document.getElementById("sj-warna-select-all"),
      tableBody: document.getElementById("sj-warna-table-body"),
      printWarnaBtn: document.getElementById("sj-warna-print-btn"),
      printWarnaArea: document.getElementById("sj-warna-print-area"),
      statusInfo: document.getElementById("sj-warna-status"),

      // Log
      logVendorSelect: document.getElementById("sj-log-vendor"),
      logRefreshBtn: document.getElementById("sj-log-refresh"),
      logTableBody: document.getElementById("sj-log-table-body"),
    };
  },

  setDefaultMonthYear() {
    const now = new Date();
    if (this.elements.monthSelect) {
      this.elements.monthSelect.value = now.getMonth() + 1;
    }
    if (this.elements.yearInput) {
      this.elements.yearInput.value = now.getFullYear();
    }
  },

  setupTabNavigation() {
    this.elements.tabCustomer?.addEventListener("click", () =>
      this.switchTab("customer")
    );
    this.elements.tabWarna?.addEventListener("click", () =>
      this.switchTab("warna")
    );
    this.elements.tabLog?.addEventListener("click", () =>
      this.switchTab("log")
    );
  },

  switchTab(tab) {
    this.state.currentTab = tab;

    // Reset semua tab jadi nonaktif dulu
    this.elements.tabCustomer?.classList.remove("active");
    this.elements.tabWarna?.classList.remove("active");
    this.elements.tabLog?.classList.remove("active");

    this.elements.contentCustomer?.classList.add("hidden");
    this.elements.contentWarna?.classList.add("hidden");
    this.elements.contentLog?.classList.add("hidden");

    // Aktifkan tab yang dipilih
    if (tab === "customer") {
      this.elements.tabCustomer?.classList.add("active");
      this.elements.contentCustomer?.classList.remove("hidden");
    } else if (tab === "warna") {
      this.elements.tabWarna?.classList.add("active");
      this.elements.contentWarna?.classList.remove("hidden");
      this.loadWorkOrdersForWarna();
    } else if (tab === "log") {
      this.elements.tabLog?.classList.add("active");
      this.elements.contentLog?.classList.remove("hidden");
      this.loadSuratJalanLog(); // 🔥 otomatis load log saat tab dibuka
    }
  },

  setupEventListeners() {
    // CUSTOMER
    this.elements.searchBtn?.addEventListener("click", () =>
      this.searchByInvoice()
    );
    this.elements.invoiceSearch?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.searchByInvoice();
    });
    this.elements.printBtn?.addEventListener("click", () =>
      this.printSuratJalan()
    );

    // PEWARNAAN
    this.elements.monthSelect?.addEventListener("change", () =>
      this.loadWorkOrdersForWarna()
    );
    this.elements.yearInput?.addEventListener("change", () =>
      this.loadWorkOrdersForWarna()
    );
    this.elements.customerSearch?.addEventListener("input", () =>
      this.filterWorkOrders()
    );
    this.elements.selectAllCheckbox?.addEventListener("change", (e) =>
      this.toggleSelectAll(e.target.checked)
    );
    this.elements.printWarnaBtn?.addEventListener("click", () =>
      this.printSuratJalanWarna()
    );
    this.elements.vendorSelect?.addEventListener("change", () =>
      this.updateWarnaPreview()
    );

    // LOG
    this.elements.logRefreshBtn?.addEventListener("click", () =>
      this.loadSuratJalanLog()
    );
    this.elements.logVendorSelect?.addEventListener("change", () =>
      this.loadSuratJalanLog()
    );
  },

  // ======================================================
  // 🔍 TAB CUSTOMER - SEARCH
  // ======================================================
  async searchByInvoice() {
    const invoiceNo = this.elements.invoiceSearch?.value.trim();
    if (!invoiceNo)
      return App.ui.showToast(
        "Masukkan nomor invoice terlebih dahulu",
        "error"
      );

    try {
      this.setLoadingState(true);
      const result = await App.api.request(
        `/api/invoice-search/${invoiceNo}`
      );

      if (result && result.length > 0) {
        // Simpan ke state untuk keperluan print + update status + log
        this.state.lastInvoiceData = result;
        this.state.lastInvoiceNo = invoiceNo;

        this.generateCustomerPreview(result, invoiceNo);
        this.elements.printBtn.disabled = false;
      } else {
        this.state.lastInvoiceData = [];
        this.state.lastInvoiceNo = null;
        this.elements.printArea.innerHTML = `<div class='text-center text-red-500 py-8'>Invoice <b>${invoiceNo}</b> tidak ditemukan</div>`;
        this.elements.printBtn.disabled = true;
      }
    } catch (err) {
      console.error("❌ Error searching invoice:", err);
      App.ui.showToast("Gagal mencari invoice", "error");
    } finally {
      this.setLoadingState(false);
    }
  },

  generateCustomerPreview(data, invoiceNo) {
    const totalQty = data.reduce(
      (sum, wo) => sum + (parseFloat(wo.qty) || 0),
      0
    );
    const today = new Date().toLocaleDateString("id-ID");

    this.elements.printArea.innerHTML = `
      <div id="sj-customer-print-content" class="bg-white p-6">
        <!-- HEADER PERUSAHAAN -->
        <div class="text-center mb-6">
          <h1 class="text-xl font-bold">CV. TOTO ALUMINIUM MANUFACTURE</h1>
          <p class="text-sm">Jl. Rawa Mulya, Kota Bekasi | Telp: 0813 1191 2002</p>
          <h2 class="text-lg font-bold mt-4 border-b border-black pb-1 inline-block">SURAT JALAN</h2>
        </div>

        <!-- INFORMASI UTAMA -->
        <div class="flex justify-between text-sm mb-4">
          <div class="text-left">
            <p><strong>Tanggal:</strong> ${today}</p>
          </div>
          <div class="text-right">
            <p><strong>No. Invoice:</strong> ${invoiceNo}</p>
            <p><strong>Total Quantity:</strong> ${totalQty}</p>
          </div>
        </div>

        <!-- TABEL DATA BARANG -->
        <table class="w-full border border-gray-800 text-xs mb-4">
          <thead>
            <tr class="bg-gray-100">
              <th class="border p-1 text-center w-8">No</th>
              <th class="border p-1 text-left">Nama Customer</th>
              <th class="border p-1 text-left">Deskripsi Barang</th>
              <th class="border p-1 text-center w-16">Ukuran</th>
              <th class="border p-1 text-center w-16">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (wo, i) => `
              <tr>
                <td class="border p-1 text-center">${i + 1}</td>
                <td class="border p-1">${wo.nama_customer || "-"}</td>
                <td class="border p-1">${wo.deskripsi || "-"}</td>
                <td class="border p-1 text-center">${wo.ukuran || "-"}</td>
                <td class="border p-1 text-center">${wo.qty || "-"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <!-- TANDA TANGAN -->
        <div class="flex justify-center gap-32 mt-10 text-center text-sm">
          <div>
            <div class="border-t border-black pt-1 font-bold">Pengirim</div>
            <p>CV. TOTO ALUMINIUM MANUFACTURE</p>
          </div>
          <div>
            <div class="border-t border-black pt-1 font-bold">Penerima</div>
            <p>(__________________________)</p>
          </div>
        </div>
      </div>
    `;
  },

  // ======================================================
  // 🎨 TAB PEWARNAAN
  // ======================================================
  async loadWorkOrdersForWarna() {
    try {
      this.setLoadingState(true);
      const month = this.elements.monthSelect?.value;
      const year = this.elements.yearInput?.value;

      if (!month || !year) return;

      console.log(`🔍 Loading work orders for warna: ${month}-${year}`);

      const result = await App.api.request(
        `/api/workorders-warna?month=${month}&year=${year}`
      );
      this.state.workOrders = result || [];

      this.renderWorkOrdersTable();
      this.updateWarnaPreview();

      const statusMsg =
        this.state.workOrders.length > 0
          ? `✅ ${this.state.workOrders.length} barang siap diwarna`
          : "❌ Tidak ada barang siap diwarna";

      this.updateStatusInfo(statusMsg);
    } catch (err) {
      console.error("❌ Error loading work orders for warna:", err);
      this.updateStatusInfo("❌ Gagal memuat data barang");
    } finally {
      this.setLoadingState(false);
    }
  },

  renderWorkOrdersTable() {
    const tbody = this.elements.tableBody;
    if (!tbody) return;

    if (this.state.workOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Tidak ada barang siap diwarna</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.workOrders
      .map(
        (wo) => `
      <tr class="border-b hover:bg-gray-50">
        <td class="p-2 text-center">
          <input type="checkbox" class="item-checkbox" value="${
            wo.id
          }" ${this.state.selectedItems.includes(wo.id) ? "checked" : ""}>
        </td>
        <td class="p-2 text-sm">${wo.nama_customer || "-"}</td>
        <td class="p-2 text-sm">${wo.deskripsi || "-"}</td>
        <td class="p-2 text-sm text-center">${wo.ukuran || "-"}</td>
        <td class="p-2 text-sm text-center">${wo.qty || "-"}</td>
      </tr>
    `
      )
      .join("");

    // Add event listeners to checkboxes
    tbody.querySelectorAll(".item-checkbox").forEach((cb) => {
      cb.addEventListener("change", (e) =>
        this.toggleItemSelection(e.target.value, e.target.checked)
      );
    });
  },

  toggleSelectAll(checked) {
    this.state.selectedItems = checked
      ? this.state.workOrders.map((wo) => wo.id)
      : [];
    this.renderWorkOrdersTable();
    this.updateWarnaPreview();
  },

  toggleItemSelection(id, checked) {
    const num = parseInt(id);
    if (checked) {
      if (!this.state.selectedItems.includes(num)) {
        this.state.selectedItems.push(num);
      }
    } else {
      this.state.selectedItems = this.state.selectedItems.filter(
        (i) => i !== num
      );
    }
    this.updateWarnaPreview();
  },

  filterWorkOrders() {
    if (!this.elements.customerSearch || !this.elements.tableBody) return;

    const searchTerm = this.elements.customerSearch.value.toLowerCase();
    const rows = this.elements.tableBody.querySelectorAll("tr");

    rows.forEach((row) => {
      const customerCell = row.querySelector("td:nth-child(2)");
      if (customerCell) {
        const customerName = customerCell.textContent.toLowerCase();
        row.style.display = customerName.includes(searchTerm) ? "" : "none";
      }
    });
  },

  updateStatusInfo(msg) {
    // Create status info element if it doesn't exist
    if (!this.elements.statusInfo && this.elements.tableBody?.parentNode) {
      const statusDiv = document.createElement("div");
      statusDiv.id = "sj-warna-status";
      statusDiv.className = "mt-2 text-sm";
      this.elements.tableBody.parentNode.insertBefore(
        statusDiv,
        this.elements.tableBody
      );
      this.elements.statusInfo = statusDiv;
    }
    if (this.elements.statusInfo) {
      this.elements.statusInfo.textContent = msg;
    }
  },

  updateWarnaPreview() {
    if (!this.elements.printWarnaArea || !this.elements.vendorSelect) return;

    const selected = this.state.workOrders.filter((wo) =>
      this.state.selectedItems.includes(wo.id)
    );

    if (!selected.length) {
      this.elements.printWarnaArea.innerHTML = `<div class="text-center text-gray-500 py-8">Belum ada item dipilih</div>`;
      if (this.elements.printWarnaBtn) {
        this.elements.printWarnaBtn.disabled = true;
      }
      return;
    }

    const vendor = this.elements.vendorSelect.value || "Vendor Pewarnaan";
    const today = new Date().toLocaleDateString("id-ID");
    const noSurat = this.generateNoSuratJalan();

    const adjustedData = selected.map((wo) => ({
      ...wo,
      ukuran: (parseFloat(wo.ukuran || 0) - 0.2).toFixed(2),
    }));

    const totalQty = adjustedData.reduce(
      (sum, wo) => sum + (parseFloat(wo.qty) || 0),
      0
    );

    this.elements.printWarnaArea.innerHTML = `
      <div id="sj-warna-print-content" class="bg-white p-6">
        <!-- HEADER -->
        <div class="text-center mb-6">
          <h1 class="text-xl font-bold">CV. TOTO ALUMINIUM MANUFACTURE</h1>
          <p class="text-sm">Jl. Rawa Mulya, Kota Bekasi | Telp: 0813 1191 2002</p>
          <h2 class="text-lg font-bold mt-4 border-b border-black pb-1 inline-block">SURAT JALAN PEWARNAAN</h2>
        </div>

        <!-- INFO UTAMA -->
        <div class="flex justify-between text-sm mb-4">
          <div class="text-left">
            <p><strong>Vendor:</strong> ${vendor}</p>
            <p><strong>Tanggal:</strong> ${today}</p>
          </div>
          <div class="text-right">
            <p><strong>No. Surat Jalan:</strong> ${noSurat}</p>
            <p><strong>Total Item:</strong> ${adjustedData.length}</p>
            <p><strong>Total Qty:</strong> ${totalQty}</p>
          </div>
        </div>

        <!-- TABEL DATA -->
        <table class="w-full border border-gray-800 text-xs mb-4">
          <thead>
            <tr class="bg-gray-100">
              <th class="border p-1 text-center w-8">No</th>
              <th class="border p-1 text-left">Nama Customer</th>
              <th class="border p-1 text-left">Deskripsi</th>
              <th class="border p-1 text-center w-16">Ukuran</th>
              <th class="border p-1 text-center w-16">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${adjustedData
              .map(
                (wo, i) => `
              <tr>
                <td class="border p-1 text-center">${i + 1}</td>
                <td class="border p-1">${wo.nama_customer || "-"}</td>
                <td class="border p-1">${wo.deskripsi || "-"}</td>
                <td class="border p-1 text-center">${wo.ukuran}</td>
                <td class="border p-1 text-center">${wo.qty || "-"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <!-- TANDA TANGAN -->
        <div class="flex justify-center gap-32 mt-10 text-center text-sm">
          <div>
            <div class="border-t border-black pt-1 font-bold">Pengirim</div>
            <p>CV. TOTO ALUMINIUM MANUFACTURE</p>
          </div>
          <div>
            <div class="border-t border-black pt-1 font-bold">Penerima</div>
            <p>${vendor}</p>
          </div>
        </div>
      </div>
    `;

    if (this.elements.printWarnaBtn) {
      this.elements.printWarnaBtn.disabled = false;
    }
  },

  generateNoSuratJalan() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    // Generate unique number based on timestamp
    const unique = Date.now().toString().slice(-4);

    return `SJW-${year}${month}${day}-${unique}`;
  },

  // ======================================================
  // 📜 TAB LOG SURAT JALAN - VERSI DIPERBAIKI
  // ======================================================
  async loadSuratJalanLog() {
    try {
      if (!this.elements.logTableBody) {
        console.warn("⚠️ Elemen logTableBody belum dimuat di halaman.");
        return;
      }

      const vendorFilter = this.elements.logVendorSelect?.value || "";
      const tbody = this.elements.logTableBody;

      // Show loading state
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">
        <div class="flex justify-center items-center">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8B5E34] mr-2"></div>
          Memuat data...
        </div>
      </td></tr>`;

      const url = vendorFilter
        ? `/api/suratjalan-log?vendor=${encodeURIComponent(vendorFilter)}`
        : "/api/suratjalan-log";
      const result = await App.api.request(url);

      if (!result || result.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">Belum ada data surat jalan...</td></tr>`;
        return;
      }

      // Render table data
      tbody.innerHTML = result
        .map(
          (log) => `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-2 text-sm">${new Date(
            log.tanggal || log.dibuat_pada
          ).toLocaleDateString("id-ID")}</td>
          <td class="p-2 text-sm font-medium text-[#8B5E34]">${
            log.no_sj
          }</td>
          <td class="p-2 text-sm">${log.vendor || "-"}</td>
          <td class="p-2 text-center text-sm">${log.total_item}</td>
          <td class="p-2 text-center text-sm">${log.total_qty}</td>
          <td class="p-2 text-sm">${log.dibuat_oleh || "-"}</td>
        </tr>
      `
        )
        .join("");

      console.log(`✅ Loaded ${result.length} surat jalan log entries`);
    } catch (err) {
      console.error("❌ Gagal memuat log surat jalan:", err);
      const tbody = this.elements.logTableBody;
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">
          Gagal memuat data: ${err.message}
        </td></tr>`;
      }
      App.ui.showToast("Gagal memuat data surat jalan log", "error");
    }
  },

  // ======================================================
  // 🖨️ PRINT FUNCTIONS - VERSI DIPERBAIKI
  // ======================================================
  async printSuratJalan() {
    try {
      const content = document.getElementById("sj-customer-print-content");
      if (!content) {
        App.ui.showToast(
          "Tidak ada surat jalan yang siap dicetak",
          "error"
        );
        return;
      }

      // 🖨️ CETAK DULU
      document.body.style.overflow = "hidden";
      document.body.classList.add("surat-jalan-print");
      window.print();

      setTimeout(() => {
        document.body.classList.remove("surat-jalan-print");
        document.body.style.overflow = "auto";
      }, 1500);

      // ✅ SESUAI JAWABANMU: UPDATE STATUS + SIMPAN LOG
      if (this.state.lastInvoiceData && this.state.lastInvoiceData.length) {
        try {
          await this.saveSuratJalanCustomerLog();
          await this.updateWorkOrdersAsShippedByInvoice();
          App.ui.showToast(
            "Surat jalan customer dicetak & status dikirim berhasil diperbarui.",
            "success"
          );
        } catch (err) {
          console.error("❌ Gagal update status/log SJ customer:", err);
          App.ui.showToast(
            "Print berhasil, tapi update status/log gagal.",
            "warning"
          );
        }
      }
    } catch (err) {
      console.error("❌ Gagal mencetak surat jalan:", err);
      App.ui.showToast(
        "Gagal mencetak surat jalan: " + err.message,
        "error"
      );
    }
  },

  async printSuratJalanWarna() {
    try {
      const content = document.getElementById("sj-warna-print-content");
      if (!content) {
        App.ui.showToast(
          "Tidak ada surat jalan pewarnaan untuk dicetak",
          "error"
        );
        return;
      }

      // Validasi ada item yang dipilih
      if (this.state.selectedItems.length === 0) {
        App.ui.showToast("Pilih minimal 1 item untuk dicetak", "error");
        return;
      }

      const vendor =
        this.elements.vendorSelect?.value || "Vendor Pewarnaan";
      const selected = this.state.workOrders.filter((wo) =>
        this.state.selectedItems.includes(wo.id)
      );
      const noSurat = this.generateNoSuratJalan();

      // 🖨️ CETAK DOKUMEN
      document.body.classList.add("surat-jalan-print");
      window.print();
      setTimeout(
        () => document.body.classList.remove("surat-jalan-print"),
        1500
      );

      // ✅ Simpan ke log database dengan error handling
      try {
        await this.saveSuratJalanLog({
          tipe: "VENDOR",
          noSurat,
          vendor,
          items: selected,
        });

        // ✅ Hapus barang dari list lokal (status di DB sudah diupdate di backend)
        this.removePrintedItems();

        App.ui.showToast(
          `Surat jalan ${noSurat} berhasil dicetak dan tersimpan ke log.`,
          "success"
        );

        // ✅ Refresh log tab secara otomatis
        if (this.state.currentTab === "log") {
          setTimeout(() => this.loadSuratJalanLog(), 1000);
        }
      } catch (saveError) {
        console.error("❌ Gagal menyimpan log:", saveError);
        App.ui.showToast(
          "Surat jalan dicetak tapi gagal disimpan ke log",
          "warning"
        );
      }
    } catch (err) {
      console.error("❌ Gagal mencetak surat jalan pewarnaan:", err);
      App.ui.showToast(
        "Gagal mencetak surat jalan pewarnaan: " + err.message,
        "error"
      );
    }
  },

  // ======================================================
  // 💾 SIMPAN SURAT JALAN LOG KE DATABASE - VENDOR (PEWARNAAN)
  // ======================================================
  async saveSuratJalanLog({ tipe = "VENDOR", noSurat, vendor, items }) {
    try {
      const totalQty = items.reduce(
        (sum, wo) => sum + (parseFloat(wo.qty) || 0),
        0
      );
      const totalItem = items.length;

      // ✅ DATA YANG SESUAI DENGAN BACKEND
      const payload = {
        tipe: tipe || "VENDOR",
        vendor: vendor || "-",
        customer: "-", // sengaja "-" untuk VENDOR
        no_invoice: "-",
        items: items.map((wo) => ({
          id: wo.id, // ✅ WAJIB: untuk update status di_warna di backend
          nama_customer: wo.nama_customer || "-",
          deskripsi: wo.deskripsi || "-",
          ukuran: (parseFloat(wo.ukuran || 0) - 0.2).toFixed(2),
          qty: parseFloat(wo.qty) || 0,
        })),
        total_item: totalItem,
        total_qty: totalQty,
        catatan: this.elements.catatan?.value || "-",
        dibuat_oleh: App.state.user?.username || "admin", // ✅ gunakan username
      };

      console.log("📦 Saving surat jalan log (VENDOR):", payload);

      const result = await App.api.request("/api/suratjalan-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log(`✅ Surat Jalan ${noSurat} tersimpan ke log:`, result);
      return result;
    } catch (err) {
      console.error("❌ Gagal menyimpan log surat jalan:", err);
      throw new Error("Gagal menyimpan log surat jalan: " + err.message);
    }
  },

  // ======================================================
  // 💾 SIMPAN LOG + UPDATE STATUS UNTUK SURAT JALAN CUSTOMER
  // ======================================================
  async saveSuratJalanCustomerLog() {
    try {
      const items = this.state.lastInvoiceData || [];
      if (!items.length) return;

      const invoiceNo = this.state.lastInvoiceNo || "-";
      const primaryCustomer = items[0]?.nama_customer || "-";
      const totalQty = items.reduce(
        (sum, wo) => sum + (parseFloat(wo.qty) || 0),
        0
      );

      const payload = {
        tipe: "CUSTOMER",
        vendor: "-",
        customer: primaryCustomer,
        no_invoice: invoiceNo,
        items: items.map((wo) => ({
          id: wo.id,
          nama_customer: wo.nama_customer || "-",
          deskripsi: wo.deskripsi || "-",
          ukuran: wo.ukuran || "-",
          qty: parseFloat(wo.qty) || 0,
        })),
        total_item: items.length,
        total_qty: totalQty,
        catatan: this.elements.catatan?.value || "-",
        dibuat_oleh: App.state.user?.username || "admin",
      };

      console.log("📦 Saving surat jalan log (CUSTOMER):", payload);

      const result = await App.api.request("/api/suratjalan-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("✅ Surat jalan customer log saved:", result);
      return result;
    } catch (err) {
      console.error("❌ Gagal menyimpan log surat jalan customer:", err);
      throw err;
    }
  },

  async updateWorkOrdersAsShippedByInvoice() {
    try {
      const items = this.state.lastInvoiceData || [];
      if (!items.length) return;

      const updatePromises = items
        .filter((wo) => wo.id)
        .map((wo) =>
          App.api
            .request(`/api/workorders/${wo.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ di_kirim: true }),
            })
            .catch((err) => {
              console.error(
                `❌ Gagal update status di_kirim untuk WO ${wo.id}:`,
                err
              );
              return null;
            })
        );

      await Promise.all(updatePromises);
      console.log(
        `✅ Status di_kirim diperbarui untuk ${
          updatePromises.length
        } work order (invoice ${this.state.lastInvoiceNo || "-"})`
      );
    } catch (err) {
      console.error("❌ Error updateWorkOrdersAsShippedByInvoice:", err);
      throw err;
    }
  },

  removePrintedItems() {
    // Ambil semua ID barang yang sudah dicetak
    const printedIds = [...this.state.selectedItems];

    // Hapus dari state workOrders
    this.state.workOrders = this.state.workOrders.filter(
      (wo) => !printedIds.includes(wo.id)
    );

    // Kosongkan selectedItems
    this.state.selectedItems = [];

    // Render ulang tabel
    this.renderWorkOrdersTable();

    // Reset preview area
    if (this.elements.printWarnaArea) {
      this.elements.printWarnaArea.innerHTML = `<div class="text-center text-gray-500 py-8">Belum ada item dipilih</div>`;
    }
    if (this.elements.printWarnaBtn) {
      this.elements.printWarnaBtn.disabled = true;
    }
  },

  setLoadingState(isLoading) {
    this.state.isLoading = isLoading;
    [this.elements.printBtn, this.elements.printWarnaBtn, this.elements.searchBtn]
      .filter(Boolean)
      .forEach((btn) => {
        btn.disabled = isLoading;
        btn.classList.toggle("opacity-50", isLoading);
      });
  },
};

App.pages["invoice"] = {
    init() {
        console.log("📄 Invoice page loaded");

        const searchInput = document.getElementById("invoice-search-input");
        const searchBtn = document.getElementById("invoice-search-btn");
        const printBtn = document.getElementById("invoice-print-btn");

        searchBtn.addEventListener("click", () => this.searchInvoice());
        printBtn.addEventListener("click", () => window.print());
    },

    // ========== 🔍 Cari Invoice ==========
    async searchInvoice() {
        const invoiceNo = document.getElementById("invoice-search-input").value.trim();
        if (invoiceNo === "") {
            alert("⚠ Masukkan nomor invoice");
            return;
        }

        try {
            App.showLoader();
            const res = await fetch(`${App.api.baseUrl}/api/invoice/${invoiceNo}`, {
                headers: { Authorization: `Bearer ${App.state.token}` }
            });

            if (!res.ok) throw new Error("Gagal mengambil invoice");

            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                alert("❌ Invoice tidak ditemukan");
                return;
            }

            this.currentData = data;
            this.renderPreview();
        } catch (err) {
            console.error("❌ Cari invoice error:", err);
            alert("❌ Gagal memuat invoice");
        } finally {
            App.hideLoader();
        }
    },

    // ========== 🧾 Render Preview ==========
    renderPreview() {
        const container = document.getElementById("invoice-print-area");
        const data = this.currentData;

        // Compile tabel item
        let rows = "";
        let total = 0;
        data.forEach((item, idx) => {
            const subtotal = (parseFloat(item.ukuran) || 0) * (parseFloat(item.qty) || 0) * (parseFloat(item.harga) || 0);
            total += subtotal;

            rows += `
                <tr class="border-b">
                    <td class="p-2">${idx + 1}</td>
                    <td class="p-2">${item.deskripsi}</td>
                    <td class="p-2">${item.ukuran}</td>
                    <td class="p-2">${item.qty}</td>
                    <td class="p-2">${App.formatRupiah(item.harga)}</td>
                    <td class="p-2">${App.formatRupiah(subtotal)}</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div class="text-center mb-4">
                <h1 class="text-2xl font-bold">INVOICE</h1>
                <p>No: ${data[0].no_inv || "-"}</p>
                <p>Customer: ${data[0].nama_customer}</p>
            </div>

            <table class="w-full mb-6 border">
                <thead>
                    <tr class="bg-gray-100">
                        <th class="p-2">#</th>
                        <th class="p-2">Produk</th>
                        <th class="p-2">Ukuran</th>
                        <th class="p-2">Qty</th>
                        <th class="p-2">Harga</th>
                        <th class="p-2">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <div class="text-right space-y-1">
                <p class="font-medium">Total: <span id="preview-subtotal">${App.formatRupiah(total)}</span></p>
                <p class="font-medium">Diskon: <span id="preview-diskon">-</span></p>
                <p class="font-medium">DP: <span id="preview-dp">-</span></p>
                <hr>
                <p class="text-xl font-bold">Sisa Pembayaran: <span id="preview-remaining">-</span></p>
            </div>
        `;

        document.getElementById("invoice-print-btn").disabled = false;
        this.recalculate();
    },

    async applyToServer() {
    if (!this.currentData) {
        alert("❌ Cari invoice dulu sebelum menyimpan!");
        return;
    }

    const dp = parseFloat(document.getElementById("dp-amount").value) || 0;
    const discountNominal = parseFloat(document.getElementById("discount").value) || 0;
    const discountPercent = parseFloat(document.getElementById("discount-percentage").value) || 0;

    // Tentukan diskon yang dipakai (jika kedua diisi, pakai %)
    const subtotal = this.totalCalc.subtotal;
    const discountAmount = discountPercent > 0
        ? subtotal * (discountPercent / 100)
        : discountNominal;

    // 🔥 bentuk payload per item
    const payload = this.currentData.map(item => ({
        id: item.id,
        dp_amount: dp,
        discount: discountAmount
    }));

    try {
        App.showLoader();

        const res = await fetch(`${App.api.baseUrl}/api/workorders/bulk-payment-update`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${App.state.token}`
            },
            body: JSON.stringify({ items: payload, socketId: App.state.socket?.id })
        });

        if (!res.ok) throw new Error("Gagal menyimpan ke server");

        const data = await res.json();
        console.log("💾 Payment updated:", data);

        App.ui.showToast("Pembayaran / Diskon berhasil disimpan", "success");
    } catch (err) {
        console.error("❌ Error apply server:", err);
        App.ui.showToast("Gagal menyimpan ke server", "error");
    } finally {
        App.hideLoader();
    }
},

    // ========== 🔁 Hitung ulang saat DP / Diskon berubah ==========
    recalculate() {
        const dp = parseFloat(document.getElementById("dp-amount").value) || 0;
        const discount = parseFloat(document.getElementById("discount").value) || 0;
        const discountPercent = parseFloat(document.getElementById("discount-percentage").value) || 0;

        let subtotal = 0;
        this.currentData.forEach(item => {
            subtotal += (parseFloat(item.ukuran) || 0) * (parseFloat(item.qty) || 0) * (parseFloat(item.harga) || 0);
        });

        const disc = discountPercent > 0 ? subtotal * (discountPercent / 100) : discount;
        const totalAfterDiscount = subtotal - disc;
        const remaining = totalAfterDiscount - dp;

        document.getElementById("preview-diskon").innerText = App.formatRupiah(disc);
        document.getElementById("preview-dp").innerText = App.formatRupiah(dp);
        document.getElementById("preview-remaining").innerText = App.formatRupiah(remaining);

        this.totalCalc = { subtotal, disc, dp, remaining };
    }

    
};

printBtn.addEventListener("click", async () => {
    await this.applyToServer(); // ⬅ DP & Diskon tersimpan dulu
    setTimeout(() => window.print(), 500); // ⬅ lalu cetak invoice
});

// ======================================================
// 💵 KEUANGAN PAGE - FINAL TERHUBUNG DENGAN BACKEND
// ======================================================
App.pages["keuangan"] = {
  state: { saldo: [], riwayat: [] },
  elements: {},

  async init() {
    this.elements.saldoBcaToto = document.getElementById("saldo-bca-toto");
    this.elements.saldoBcaYanto = document.getElementById("saldo-bca-yanto");
    this.elements.saldoCash = document.getElementById("saldo-cash");
    this.elements.saldoTotal = document.getElementById("saldo-total");
    this.elements.transaksiForm = document.getElementById("keuangan-form");
    this.elements.riwayatTableBody = document.getElementById("riwayat-keuangan-table-body");
    this.elements.monthFilter = document.getElementById("keuangan-month-filter");
    this.elements.yearFilter = document.getElementById("keuangan-year-filter");
    this.elements.filterBtn = document.getElementById("filter-keuangan-btn");

    // ⏱ set tanggal default hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaksi-tanggal').value = today;

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.transaksiForm?.addEventListener("submit", (e) => this.submitTransaksi(e));
    this.elements.filterBtn?.addEventListener("click", () => this.loadRiwayat());

    await this.loadSaldo();
    await this.loadRiwayat();
  },

  async loadSaldo() {
    try {
      const res = await App.api.request("/api/keuangan/saldo");
      const listKas = res.kas || [];
      this.state.saldo = listKas;

      let totalSaldo = Number(res.total_saldo || 0);

      // update UI
      listKas.forEach(k => {
        const val = App.ui.formatRupiah(Number(k.saldo || 0));
        if (k.id == 1) this.elements.saldoBcaToto.textContent = val;
        if (k.id == 2) this.elements.saldoBcaYanto.textContent = val;
        if (k.id == 3) this.elements.saldoCash.textContent = val;
      });

      this.elements.saldoTotal.textContent = App.ui.formatRupiah(totalSaldo);

    } catch (err) {
      console.error("❌ Gagal load saldo:", err);
      App.ui.showToast("Gagal memuat saldo keuangan", "error");
    }
  },

  async submitTransaksi(e) {
    e.preventDefault();

    const data = {
      tanggal: document.getElementById("transaksi-tanggal").value,
      jumlah: parseFloat(document.getElementById("transaksi-jumlah").value || 0),
      tipe: document.getElementById("transaksi-tipe").value,
      kas_id: parseInt(document.getElementById("transaksi-kas").value),
      keterangan: document.getElementById("transaksi-keterangan").value.trim()
    };

    if (!data.tanggal) return App.ui.showToast("Tanggal wajib diisi", "error");
    if (data.jumlah <= 0) return App.ui.showToast("Jumlah harus lebih besar dari 0", "error");
    if (!data.keterangan) return App.ui.showToast("Keterangan wajib diisi", "error");

    try {
      await App.api.request("/api/keuangan/add", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });

      App.ui.showToast("Transaksi berhasil disimpan", "success");

      // reset form utk transaksi berikutnya
      this.elements.transaksiForm.reset();
      document.getElementById("transaksi-tanggal").value = new Date().toISOString().split("T")[0];

      await this.loadSaldo();
      await this.loadRiwayat();
    } catch (err) {
      console.error("❌ Gagal transaksi:", err);
      App.ui.showToast("Gagal menyimpan transaksi", "error");
    }
  },

  async loadRiwayat() {
    try {
      const month = this.elements.monthFilter.value;
      const year = this.elements.yearFilter.value;

      const data = await App.api.request(
        `/api/keuangan/riwayat?month=${month}&year=${year}`
      );

      this.state.riwayat = data;
      this.renderRiwayat(data);
    } catch (err) {
      console.error("❌ Gagal load riwayat:", err);
      App.ui.showToast("Gagal memuat riwayat transaksi", "error");
    }
  },

  renderRiwayat(data) {
    if (!this.elements.riwayatTableBody) return;

    if (!data || data.length === 0) {
      this.elements.riwayatTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center p-6 text-[#8B5E34]">
            Tidak ada transaksi pada periode ini
          </td>
        </tr>`;
      return;
    }

    this.elements.riwayatTableBody.innerHTML = data.map(tr => `
      <tr class="hover:bg-gray-50 transition">
        <td class="px-6 py-4 text-sm">${App.ui.formatDate(tr.tanggal)}</td>
        <td class="px-6 py-4 text-sm">${tr.keterangan || '-'}</td>
        <td class="px-6 py-4 text-sm">${tr.nama_kas}</td>
        <td class="px-6 py-4 text-sm">
          <span class="px-2 py-1 rounded-full text-xs font-semibold ${tr.tipe === 'PEMASUKAN' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}">
            ${tr.tipe}
          </span>
        </td>
        <td class="px-6 py-4 text-right font-semibold ${tr.tipe === 'PEMASUKAN' ? 'text-green-600' : 'text-red-600'}">
          ${tr.tipe === 'PEMASUKAN' ? '+' : '-'}${App.ui.formatRupiah(tr.jumlah)}
        </td>
      </tr>
    `).join('');
  }
};
