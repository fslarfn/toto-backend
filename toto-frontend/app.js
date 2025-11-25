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

// ======================================================================
// 📦 APP.JS FINAL — PART 5
// Modul STOK BAHAN (load • tambah bahan • update stok)
// ======================================================================

App.pages["stok-bahan"] = {
  state: {
    data: [],
  },

  init() {
    console.log("📦 Init STOK BAHAN Page");

    this.els = {
      tableBody: document.getElementById("stok-table-body"),
      addBtn: document.getElementById("add-stok-btn"),
      modalAdd: document.getElementById("modal-add-stok"),
      modalUpdate: document.getElementById("modal-update-stok"),
      formAdd: document.getElementById("form-add-stok"),
      formUpdate: document.getElementById("form-update-stok"),
      searchInput: document.getElementById("search-stok"),
    };

    this.loadData();
    this.initEvents();

    // Realtime update (optional)
    if (App.state.socket) {
      App.state.socket.on("stok:update", () => this.loadData());
    }
  },

  initEvents() {
    if (this.els.addBtn) {
      this.els.addBtn.addEventListener("click", () => this.showAdd());
    }

    if (this.els.searchInput) {
      this.els.searchInput.addEventListener("keyup", (e) => this.render(e.target.value));
    }

    if (this.els.formAdd) {
      this.els.formAdd.addEventListener("submit", (e) => this.submitAdd(e));
    }
    if (this.els.formUpdate) {
      this.els.formUpdate.addEventListener("submit", (e) => this.submitUpdate(e));
    }
  },

  // 🔍 Load data stok
  async loadData() {
    try {
      const res = await App.api.request(`/stok`);
      this.state.data = res;
      this.render();
    } catch (err) {
      console.error(err);
      alert("Gagal memuat stok bahan");
    }
  },

  // 🧾 Render tabel stok
  render(keyword = "") {
    if (!this.els.tableBody) return;

    const rows = this.state.data
      .filter((b) =>
        `${b.kode_bahan} ${b.nama_bahan}`.toLowerCase().includes(keyword.toLowerCase())
      )
      .map(
        (b) => `
        <tr class="border hover:bg-gray-50 transition">
          <td class="p-2 border text-center">${b.kode_bahan}</td>
          <td class="p-2 border">${b.nama_bahan}</td>
          <td class="p-2 border text-center">${b.kategori || "-"}</td>
          <td class="p-2 border text-center">${b.satuan || "-"}</td>
          <td class="p-2 border text-center font-semibold">${b.stok}</td>
          <td class="p-2 border text-center">
            <button class="px-3 py-1 bg-blue-600 text-white rounded text-sm" onclick="App.pages['stok-bahan'].showUpdate(${b.id})">
              Update
            </button>
          </td>
        </tr>`
      )
      .join("");

    this.els.tableBody.innerHTML = rows || `<tr><td class="text-center p-4" colspan="6">Tidak ada data</td></tr>`;
  },

  // ➕ TAMPILKAN MODAL TAMBAH
  showAdd() {
    this.els.modalAdd.classList.remove("hidden");
  },

  // 🚪 TAMPILKAN MODAL UPDATE
  showUpdate(id) {
    const item = this.state.data.find((i) => i.id === id);
    if (!item) return;

    this.els.modalUpdate.querySelector("[name=bahan_id]").value = item.id;
    this.els.modalUpdate.querySelector("#update-title").innerText = item.nama_bahan;
    this.els.modalUpdate.classList.remove("hidden");
  },

  // 🟢 SUBMIT TAMBAH BAHAN
  async submitAdd(e) {
    e.preventDefault();

    const form = new FormData(this.els.formAdd);

    try {
      await App.api.request("/stok", { method: "POST", body: form });
      this.closeModals();
      alert("Bahan berhasil ditambahkan");
      this.loadData();
    } catch (err) {
      console.error(err);
      alert("Gagal menambah bahan");
    }
  },

  // 🔄 SUBMIT UPDATE STOK (MASUK / KELUAR)
  async submitUpdate(e) {
    e.preventDefault();
    const form = new FormData(this.els.formUpdate);

    try {
      await App.api.request("/stok/update", { method: "POST", body: form });
      this.closeModals();
      alert("Stok berhasil diperbarui");
      this.loadData();
    } catch (err) {
      console.error(err);
      alert("Gagal memperbarui stok");
    }
  },

  closeModals() {
    this.els.modalAdd?.classList.add("hidden");
    this.els.modalUpdate?.classList.add("hidden");
    this.els.formAdd?.reset();
    this.els.formUpdate?.reset();
  },
};

// Auto init
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.pathname.includes("stok-bahan.html")) {
    App.pages["stok-bahan"].init();
  }
});

