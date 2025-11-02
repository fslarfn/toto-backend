// ==========================================================
// 🚀 APP.FIXED.JS — PART 1A
// Struktur utama, API, Token handler, UI Helper, dan Socket.IO
// Server: https://erptoto.up.railway.app
// ==========================================================

const App = {
  // ======================================================
  // 🌍 STATE GLOBAL
  // ======================================================
  state: {
    user: null,
    token: null,
    socket: null,
    currentPage: null,
  },

  // ======================================================
  // 🔐 AUTH TOKEN HANDLER
  // ======================================================
  setToken(token) {
    localStorage.setItem("authToken", token);
    this.state.token = token;
  },

  getToken() {
    return localStorage.getItem("authToken");
  },

  clearToken() {
    localStorage.removeItem("authToken");
    this.state.token = null;
  },

 // ======================================================
// 🧾 FETCH WRAPPER (API Request dengan Auto Refresh Token)
// ======================================================
api: {
  baseUrl:
    window.location.hostname === "localhost"
      ? "http://localhost:8080"
      : "",

  async request(endpoint, options = {}) {
    const finalEndpoint = endpoint.startsWith("/api/")
      ? endpoint
      : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const fullUrl = `${this.baseUrl}${finalEndpoint}`;
    const headers = options.headers || {};

    // Tambahkan token
    const token = App.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    headers["Content-Type"] = headers["Content-Type"] || "application/json";

    try {
      const response = await fetch(fullUrl, { ...options, headers });

      // Jika token expired, coba refresh otomatis
      if (response.status === 401) {
        const data = await response.json().catch(() => ({}));
        if (data.message === "EXPIRED") {
          console.warn("🔁 Token expired, mencoba refresh...");
          const refreshed = await App.api.refreshToken();
          if (refreshed) {
            return this.request(endpoint, options); // retry sekali lagi
          }
        }
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Gagal memuat data dari server");
      }

      return await response.json();
    } catch (err) {
      console.error("❌ API Error:", err.message);
      throw err;
    }
  },

  async refreshToken() {
    const oldToken = App.getToken();
    if (!oldToken) return false;

    try {
      const res = await fetch(`/api/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: oldToken }),
      });
      if (!res.ok) throw new Error("Gagal refresh token");

      const data = await res.json();
      if (data.token) {
        App.setToken(data.token);
        console.log("✅ Token diperbarui otomatis");
        return true;
      }
      return false;
    } catch (err) {
      console.error("❌ Gagal refresh token:", err.message);
      App.clearToken();
      return false;
    }
  },
},


  // ======================================================
  // 🧠 UI UTILITIES
  // ======================================================
  ui: {
    // Format angka ke IDR
    formatRupiah(value) {
      if (isNaN(value)) return "Rp0";
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(value);
    },

    // Format tanggal lokal
    formatDate(dateStr) {
      if (!dateStr) return "-";
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    },

    // Buat dropdown Bulan & Tahun otomatis (angka + nama)
    populateDateFilters(monthSelect, yearSelect) {
      if (!monthSelect || !yearSelect) return;

      monthSelect.innerHTML = "";
      yearSelect.innerHTML = "";

      const bulanNama = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];

      for (let i = 1; i <= 12; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `${bulanNama[i - 1]} (${i})`;
        monthSelect.appendChild(opt);
      }

      const currentYear = new Date().getFullYear();
      for (let y = 2023; y <= currentYear + 3; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }

      monthSelect.value = (new Date().getMonth() + 1).toString();
      yearSelect.value = currentYear.toString();
    },

    // Cetak elemen HTML tertentu
    printElement(elementId) {
      const el = document.getElementById(elementId);
      if (!el) return alert("Elemen tidak ditemukan");
      const newWin = window.open("");
      newWin.document.write("<html><head><title>Cetak</title></head><body>");
      newWin.document.write(el.outerHTML);
      newWin.document.write("</body></html>");
      newWin.document.close();
      newWin.focus();
      newWin.print();
      newWin.close();
    },

    // Tampilkan notifikasi sederhana
    showToast(msg, type = "info") {
      const colors = {
        info: "#3182ce",
        success: "#2f855a",
        error: "#c53030",
        warning: "#dd6b20",
      };
      const toast = document.createElement("div");
      toast.textContent = msg;
      toast.style.position = "fixed";
      toast.style.bottom = "20px";
      toast.style.right = "20px";
      toast.style.background = colors[type] || "#333";
      toast.style.color = "white";
      toast.style.padding = "10px 15px";
      toast.style.borderRadius = "6px";
      toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      toast.style.zIndex = 9999;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    },
  },

  // ======================================================
  // ⚡ SOCKET.IO CLIENT (Realtime Connection)
  // ======================================================
  socketHandlers: {
    handleNewWO(row) {
      const page = App.pages["work-orders"];
      if (page && page.state.table) page.addRowRealtime(row);
    },
    handleUpdateWO(row) {
      const page = App.pages["work-orders"];
      if (page && page.state.table) page.updateRowRealtime(row);
    },
    handleDeleteWO(payload) {
      const page = App.pages["work-orders"];
      if (page && page.state.table) page.removeRowRealtime(payload.id);
    },
  },

  socketInit() {
    if (this.state.socket) {
      console.warn("⚠️ Socket.IO sudah terhubung.");
      return;
    }

    console.log("🔌 Menghubungkan Socket.IO...");
    this.state.socket = io("https://erptoto.up.railway.app", {
      transports: ["websocket"],
    });

    const socket = this.state.socket;
    socket.on("connect", () => console.log("⚡ Socket.IO connected:", socket.id));
    socket.on("disconnect", () => console.warn("❌ Socket.IO disconnected."));

    socket.on("wo_created", (data) => this.socketHandlers.handleNewWO(data));
    socket.on("wo_updated", (data) => this.socketHandlers.handleUpdateWO(data));
    socket.on("wo_deleted", (data) => this.socketHandlers.handleDeleteWO(data));
  },

  // ==========================================================
// 🚀 APP.FIXED.JS — PART 1B
// Work Orders, layout loader, handlers, dan inisialisasi app
// ==========================================================

 // ======================================================
  // 📄 PAGES CONTAINER (akan diisi di part berikutnya)
  // ======================================================
  pages: {},
}; 

/* ==========================================
   NOTE: Mengandalkan App dari part1A:
   - App.api (dengan method request & refresh)
   - App.ui helpers
   - App.socketInit()
   - App.state, App.pages, App.socketHandlers (placeholders)
   ========================================== */

/* ============================
   HELPERS KHUSUS WORK-ORDERS
   ============================ */
(function () {

  // Utility: safe get element
  const $ = (id) => document.getElementById(id);

  // =========================
  // Halaman Work Orders
  // =========================
  App.pages['work-orders'] = {
    state: {
      table: null,
      totalRows: 0,
      pageSize: 500,
      poButton: null,
      poCount: null,
      socketBound: false,
    },
    elements: {},

    init() {
      // Ambil elemen DOM
      this.elements.monthFilter = $('wo-month-filter');
      this.elements.yearFilter = $('wo-year-filter');
      this.elements.filterBtn = $('filter-wo-btn');
      this.elements.gridContainer = $('workorders-grid');
      this.elements.status = $('wo-status') || (function(){ const d=document.createElement('div'); d.id='wo-status'; return d; })();
      this.state.poButton = $('create-po-btn');
      this.state.poCount = $('po-selection-count');

      // Isi dropdown (pakai util dari part1A)
      App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

      // Pastikan Socket terhubung
      if (!App.state.socket) {
        // init socket (dari part1A) dan tunggu sebentar
        try { App.socketInit(); } catch(e) { console.warn('Socket init gagal', e); }
      }

      // Inisialisasi Tabulator
      this.initTabulator();

      // Event Filter
      this.elements.filterBtn?.addEventListener('click', () => {
        if (this.state.table) {
          this.state.table.setData();
        }
      });

      // PO feature
      this.initPOFeature();

      // Bind socket listeners (lokal)
      this.bindSocketListeners();
    },

    bindSocketListeners() {
      // pastikan socket ada
      const socket = App.state.socket;
      if (!socket) {
        // coba lagi nanti
        setTimeout(() => this.bindSocketListeners(), 150);
        return;
      }
      if (this.state.socketBound) return;
      this.state.socketBound = true;

      socket.on('wo_created', (row) => {
        console.log('socket wo_created', row);
        if (this.state.table) {
          // tambahkan di atas (new row)
          try {
            // jika ada placeholder kosong, ganti
            const placeholder = this.state.table.getRows().find(r => r.getData().id_placeholder === true);
            if (placeholder) placeholder.update(row);
            else this.state.table.addRow(row, true);
          } catch(e) {
            // fallback: reload data
            this.state.table.setData();
          }
          this.updateStatus(`Baris baru dari ${row.nama_customer} ditambahkan (realtime).`);
        }
      });

      socket.on('wo_updated', (row) => {
        console.log('socket wo_updated', row);
        if (this.state.table) {
          try {
            this.state.table.updateData([row]);
          } catch(e) {
            this.state.table.setData();
          }
          this.updateStatus(`Baris ${row.id} diperbarui (realtime).`);
        }
      });

      socket.on('wo_deleted', (payload) => {
        console.log('socket wo_deleted', payload);
        if (this.state.table) {
          try {
            this.state.table.deleteRow(payload.id);
          } catch(e) {
            this.state.table.setData();
          }
          this.updateStatus(`Baris ${payload.id} dihapus (realtime).`);
        }
      });
    },

    initTabulator() {
      const self = this;
      // Pastikan container ada
      if (!this.elements.gridContainer) {
        console.error('workorders-grid container tidak ditemukan.');
        return;
      }

      // Hapus instance lama jika ada
      if (this.state.table && this.state.table.destroy) {
        try { this.state.table.destroy(); } catch(e){/* ignore */ }
      }

      // Buat Tabulator
      this.state.table = new Tabulator(this.elements.gridContainer, {
        height: "70vh",
        layout: "fitDataStretch",
        placeholder: "Silakan pilih Bulan dan Tahun, lalu klik Filter.",
        index: "id",
        selectable: true,
        progressiveLoad: "scroll",
        progressiveLoadScrollMargin: 200,
        ajaxURL: App.api.baseUrl + '/api/workorders/chunk',
        ajaxParams: () => ({
          month: self.elements.monthFilter.value,
          year: self.elements.yearFilter.value,
        }),
        ajaxConfig: {
          headers: {
            Authorization: 'Bearer ' + (App.getToken() || '')
          }
        },
        ajaxResponse: (url, params, response) => {
          // expected { data, last_page? } atau { data, total } dari server
          // user server memberikan { data, last_page } - kami gunakan data
          const data = response.data || response;
          // set totalRows if provided (some handlers might return total)
          if (typeof response.total !== 'undefined') self.state.totalRows = response.total;
          // Jika server tidak menambahkan placeholder, tambahkan sedikit (agar terasa seperti Google Sheets)
          return { data: data };
        },
        ajaxRequesting: () => { this.updateStatus('Memuat data...'); return true; },
        ajaxRequestError: (err) => { this.updateStatus('Gagal memuat data.'); console.error(err); },

        columns: [
          { formatter:"rowSelection", titleFormatter:"rowSelection", hozAlign:"center", headerHozAlign:"center", width:40, cellClick:(e,cell)=>cell.getRow().toggleSelect(), cssClass:"cursor-pointer" },
          { title:"#", formatter:"rownum", width:40, hozAlign:"center" },
          { title:"TANGGAL", field:"tanggal", width:120, editor:"input", formatter: (cell) => {
              const v = cell.getValue();
              if (!v) return "";
              try {
                // tampilkan dd/mm/yyyy
                const d = new Date(v);
                if (isNaN(d)) return v;
                return d.toLocaleDateString('id-ID');
              } catch(e) { return v; }
            }
          },
          { title:"CUSTOMER", field:"nama_customer", width:250, editor:"input" },
          { title:"DESKRIPSI", field:"deskripsi", width:350, editor:"input" },
          { title:"UKURAN", field:"ukuran", width:100, hozAlign:"center", editor:"input" },
          { title:"QTY", field:"qty", width:80, hozAlign:"center", editor:"input" }
        ],

        cellEdited: (cell) => {
          // autosave
          self.handleCellEdit(cell);
        },

        rowSelectionChanged: (data, rows) => {
          self.updatePOButtonState();
        }
      });
    },

    updateStatus(msg) {
      if (this.elements.status) this.elements.status.textContent = msg;
      console.log('WO:', msg);
    },

    async handleCellEdit(cell) {
      const row = cell.getRow();
      const rowData = row.getData();
      this.updateStatus('Menyimpan perubahan...');
      try {
        // Jika row memiliki id nyata => update
        if (rowData.id && !rowData.id_placeholder) {
          // Hanya kirim perubahan parsial: backend menerima patch
          await App.api.request(`/api/workorders/${rowData.id}`, { method: 'PATCH', body: rowData });
          this.updateStatus('Perubahan tersimpan ✅');
        } else {
          // Buat new record
          // bersihkan id placeholder sebelum kirim
          const payload = { ...rowData };
          delete payload.id;
          delete payload.id_placeholder;
          const newRow = await App.api.request('/api/workorders', { method: 'POST', body: payload });
          // update row id
          row.update({ id: newRow.id });
          this.updateStatus('Baris baru tersimpan ✅');
        }
      } catch (err) {
        console.error('autosave error', err);
        this.updateStatus('Gagal menyimpan. Cek koneksi.');
        // restore old value (Tabulator menyediakan cell.restoreOldValue())
        try { cell.restoreOldValue(); } catch(e){/* ignore */ }
      }
    },

    // Add/Update/Remove yang dipanggil dari socket handlers
    addRowRealtime(row) {
      if (!this.state.table) return;
      try {
        const placeholder = this.state.table.getRows().find(r => r.getData().id_placeholder === true);
        if (placeholder) placeholder.update(row);
        else this.state.table.addRow(row, true);
      } catch(e) { this.state.table.setData(); }
    },
    updateRowRealtime(row) {
      if (!this.state.table) return;
      try { this.state.table.updateData([row]); } catch(e) { this.state.table.setData(); }
    },
    removeRowRealtime(id) {
      if (!this.state.table) return;
      try { this.state.table.deleteRow(id); } catch(e) { this.state.table.setData(); }
    },

    // PO features
    initPOFeature() {
      // Jika elemen PO ada pada DOM (opsional), sambungkan
      this.state.poButton = this.state.poButton || $('create-po-btn');
      this.state.poCount = this.state.poCount || $('po-selection-count');
      if (this.state.poButton) {
        this.state.poButton.addEventListener('click', () => this.handlePrintPO());
      }
      this.updatePOButtonState();
    },

    updatePOButtonState() {
      if (!this.state.table) return;
      const selected = this.state.table.getSelectedData() || [];
      const validCount = selected.filter(r => r && !r.id_placeholder && r.id).length;
      if (this.state.poCount) this.state.poCount.textContent = validCount;
      if (this.state.poButton) this.state.poButton.disabled = validCount === 0;
    },

    async handlePrintPO() {
      if (!this.state.table) return;
      const selectedData = this.state.table.getSelectedData() || [];
      const validSelectedData = selectedData.filter(r => !r.id_placeholder && r.id);
      if (validSelectedData.length === 0) {
        return alert('Silakan pilih baris yang berisi data untuk dicetak PO.');
      }
      if (!confirm(`Cetak ${validSelectedData.length} Work Order sebagai PO?`)) return;

      try {
        sessionStorage.setItem('poData', JSON.stringify(validSelectedData));
        const ids = validSelectedData.map(i => i.id);
        // disable btn sementara
        if (this.state.poButton) { this.state.poButton.disabled = true; this.state.poButton.textContent = 'Menandai...'; }
        await App.api.request('/api/workorders/mark-printed', { method: 'POST', body: { ids } });
        // broadcast local update via socket (server akan broadcast)
        // update table locally
        const updatedRows = ids.map(id => ({ id, di_produksi: true }));
        try { this.state.table.updateData(updatedRows); } catch(e){/* ignore */ }
        this.state.table.deselectRow();
        alert('PO berhasil dibuat. Mengarahkan ke halaman cetak...');
        window.location.href = 'print-po.html';
      } catch (err) {
        console.error('Gagal buat PO', err);
        alert('Gagal membuat PO: ' + (err.message || err));
      } finally {
        if (this.state.poButton) { this.state.poButton.disabled = false; this.state.poButton.textContent = 'Buat PO'; }
        if (this.state.poCount) this.state.poCount.textContent = 0;
      }
    }
  };


// ======================================================
// 🧩 SAFE GET USER — Ambil user login & handle token otomatis
// ======================================================
App.safeGetUser = async function () {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) throw new Error("Token tidak ditemukan.");

    const res = await fetch(`${App.api.baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Gagal memuat data user.");

    const data = await res.json();
    App.state.user = data;
    console.log("👤 Logged in as:", data.username);
    return data;
  } catch (err) {
    console.warn("⚠️ safeGetUser error:", err.message);
    localStorage.removeItem("authToken");
    sessionStorage.clear();
    window.location.href = "index.html"; // arahkan ke halaman login
  }
};

// ======================================================
// 🧱 LOAD LAYOUT (Sidebar + Header) — FINAL STABLE VERSION
// ======================================================
App.loadLayout = async function () {
  const appContainer = document.getElementById("app-container");
  if (!appContainer) return;

  try {
    // Muat komponen sidebar & header secara paralel
    const [sidebarRes, headerRes] = await Promise.all([
      fetch("components/_sidebar.html"),
      fetch("components/_header.html"),
    ]);

    if (!sidebarRes.ok || !headerRes.ok)
      throw new Error("Gagal memuat komponen layout.");

    // Masukkan HTML ke DOM
    document.getElementById("sidebar").innerHTML = await sidebarRes.text();
    document.getElementById("header-container").innerHTML = await headerRes.text();

    // ======================================================
    // 🔧 ELEMEN UTAMA
    // ======================================================
    const sidebar = document.getElementById("sidebar");
    const sidebarNav = document.getElementById("sidebar-nav");
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    const logoutBtn = document.getElementById("logout-button");
    const userDisplay = document.getElementById("user-display");
    const userAvatar = document.getElementById("user-avatar");
    const pageTitle = document.getElementById("page-title");

    // ======================================================
    // 🧍‍♂️ TAMPILKAN DATA USER
    // ======================================================
    const user = await App.safeGetUser();
    if (!user) throw new Error("User tidak valid.");

    App.state.user = user;

    if (userDisplay) userDisplay.textContent = user.username || "Pengguna";
    if (userAvatar) {
      if (user.profile_picture_url) {
        userAvatar.src = user.profile_picture_url;
        userAvatar.classList.remove("hidden");
      } else {
        userAvatar.classList.add("hidden");
      }
    }

    // ======================================================
    // 📱 TOGGLE SIDEBAR (untuk layar kecil)
    // ======================================================
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("-translate-x-full");
      });
    }

    // ======================================================
    // 📄 ATUR JUDUL HALAMAN
    // ======================================================
    const currentPage = window.location.pathname.split("/").pop().replace(".html", "") || "dashboard";
    if (pageTitle) {
      const formatTitle = currentPage
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      pageTitle.textContent = formatTitle;
    }

    // ======================================================
    // 📑 LOGIKA SIDEBAR: Submenu, Highlight, Admin, Logout
    // ======================================================

    // === 1. Toggle submenu
    sidebar.querySelectorAll(".collapsible > a").forEach((menu) => {
      menu.addEventListener("click", (e) => {
        e.preventDefault();
        const parent = menu.parentElement;
        const submenu = parent.querySelector(".submenu");
        const toggleIcon = parent.querySelector(".submenu-toggle");

        if (submenu) {
          const isHidden = submenu.classList.contains("hidden");
          sidebar.querySelectorAll(".submenu").forEach((s) => s.classList.add("hidden"));
          sidebar.querySelectorAll(".submenu-toggle").forEach((i) => (i.style.transform = "rotate(0deg)"));
          if (isHidden) {
            submenu.classList.remove("hidden");
            toggleIcon.style.transform = "rotate(180deg)";
          } else {
            submenu.classList.add("hidden");
            toggleIcon.style.transform = "rotate(0deg)";
          }
        }
      });
    });

    // === 2. Highlight menu aktif
    const currentPath = window.location.pathname.split("/").pop();
    sidebar.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && currentPath === href) {
        link.classList.add("bg-[#A67B5B]");
        link.classList.add("font-semibold");
      }
    });

    // === 3. Sembunyikan menu Admin jika bukan Faisal
    const adminMenu = document.getElementById("admin-menu");
    if (App.state.user?.username?.toLowerCase() !== "faisal" && adminMenu) {
      adminMenu.style.display = "none";
    }

    // === 4. Tombol Logout
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("authToken");
        sessionStorage.clear();
        window.location.href = "index.html";
      });
    }

    // === 5. Navigasi Sidebar
    if (sidebarNav) {
      sidebarNav.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (!link || link.getAttribute("href") === "#") return;
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href && href.endsWith(".html")) {
          window.location.href = href;
        }
      });
    }

    console.log("✅ Layout loaded successfully for:", user.username);
  } catch (error) {
    console.error("❌ Gagal memuat layout:", error);
  }
};



  /* =========================
     Global Handlers (Login/Logout/Navigation)
     ========================= */
  App.handlers = App.handlers || {};

  App.handlers.handleLogout = function () {
    App.clearToken();
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
  };

  App.handlers.handleNavigation = function (e) {
    const link = e.target.closest('a');
    if (!link) return;
    // ignore external anchors or #
    const href = link.getAttribute('href');
    if (!href) return;
    if (href === '#') {
      // toggling submenu
      const parent = link.closest('.collapsible');
      if (parent) {
        parent.querySelector('.submenu')?.classList.toggle('hidden');
        parent.querySelector('.submenu-toggle')?.classList.toggle('rotate-180');
      }
      return;
    }
    // internal navigation to html pages
    if (href.endsWith('.html')) {
      e.preventDefault();
      window.location.href = href;
    }
  };

  App.handlers.handleSidebarToggle = function () {
    const container = document.getElementById('app-container');
    if (container) container.classList.toggle('sidebar-collapsed');
  };

  /* =========================
     App.init (entry point)
     ========================= */
  App.init = async function () {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    console.log('App.init -> page:', path);

    // If index (login) page
    if (path === 'index.html' || path === '') {
      // if token still valid, redirect to dashboard
      const token = App.getToken();
      if (token) {
        // quick test token decode
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const now = Date.now() / 1000;
          if (!payload.exp || payload.exp > now) {
            window.location.href = 'dashboard.html';
            return;
          }
        } catch (e) { /* ignore */ }
      }
      // bind login if form present
      const loginForm = $('login-form');
      if (loginForm) loginForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const username = $('username')?.value?.trim();
        const password = $('password')?.value?.trim();
        if (!username || !password) {
          return App.ui.showToast('Username & password wajib diisi', 'error');
        }
        try {
          const res = await App.api.request('/api/login', { method: 'POST', body: { username, password } });
          if (res.token) {
            App.setToken(res.token);
            localStorage.setItem('username', res.user.username);
            localStorage.setItem('role', res.user.role);
            window.location.href = 'dashboard.html';
          } else {
            throw new Error('Token tidak diterima');
          }
        } catch (err) {
          console.error('login failed', err);
          const el = $('login-error');
          if (el) { el.textContent = err.message || String(err); el.classList.remove('hidden'); }
        }
      });
      return;
    }

    // For other pages: must have token
    const token = App.getToken();
    if (!token) {
      console.warn('Token tidak ditemukan, redirect ke login');
      window.location.href = 'index.html';
      return;
    }

    // Start socket early
    try { App.socketInit(); } catch(e) { console.warn('socket init failed:', e); }

    // Load layout (sidebar + header)
    await App.loadLayout();

    // Initialize page if exists
    const pageName = path.replace('.html', '');
    console.log('Load page:', pageName);

    if (App.pages[pageName] && typeof App.pages[pageName].init === 'function') {
      try {
        App.pages[pageName].init();
      } catch (err) {
        console.error(`Error saat init halaman ${pageName}:`, err);
      }
    }

    // If page has .load() and it's not the tabulator heavy page (work-orders loads on filter)
    if (App.pages[pageName] && typeof App.pages[pageName].load === 'function' && pageName !== 'work-orders') {
      try { await App.pages[pageName].load(); } catch (e) { console.warn('page load failed', e); }
    }

  }; // end App.init

  // Attach DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });

})(); // IIFE end


// ==========================================================
// 🧩 APP.FIXED.JS — PART 2A
// Halaman: Dashboard, Status Barang, Karyawan, Payroll
// ==========================================================

// ======================================================
// 📊 DASHBOARD PAGE
// ======================================================
App.pages["dashboard"] = {
  state: { data: null },
  elements: {},

  init() {
    this.elements.monthFilter = document.getElementById("dashboard-month-filter");
    this.elements.yearFilter = document.getElementById("dashboard-year-filter");
    this.elements.filterBtn = document.getElementById("dashboard-filter-btn");
    this.elements.summary = document.getElementById("dashboard-summary");
    this.elements.statusList = document.getElementById("dashboard-status-list");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
    this.loadData(); // initial
  },

  async loadData() {
    try {
      const month = this.elements.monthFilter.value;
      const year = this.elements.yearFilter.value;
      const res = await App.api.request(`/dashboard?month=${month}&year=${year}`);
      this.render(res);
    } catch (err) {
      console.error("Dashboard load error:", err);
      this.elements.summary.textContent = "Gagal memuat data.";
    }
  },

  render(data) {
    const { summary, statusCounts } = data || {};
    this.elements.summary.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div class="p-4 bg-[#EDE0D4] rounded-lg shadow">
          <p class="text-sm text-[#5C4033]">Total Customer</p>
          <p class="text-xl font-bold text-[#8B5E34]">${statusCounts?.total_customer || 0}</p>
        </div>
        <div class="p-4 bg-[#EDE0D4] rounded-lg shadow">
          <p class="text-sm text-[#5C4033]">Total Nilai Produksi</p>
          <p class="text-xl font-bold text-[#8B5E34]">Rp ${parseInt(summary?.total_rupiah || 0).toLocaleString('id-ID')}</p>
        </div>
      </div>
    `;

    this.elements.statusList.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        ${Object.entries(statusCounts || {}).map(([key, val]) => `
          <div class="p-3 bg-white border rounded-md shadow text-center">
            <p class="text-sm text-[#5C4033]">${key.replace('_', ' ')}</p>
            <p class="text-lg font-semibold text-[#8B5E34]">${val}</p>
          </div>`).join('')}
      </div>`;
  }
};

// ======================================================
// 📦 STATUS BARANG PAGE
// ======================================================
App.pages["status-barang"] = {
  state: { table: null },
  elements: {},

  init() {
    this.elements.monthFilter = document.getElementById("sb-month-filter");
    this.elements.yearFilter = document.getElementById("sb-year-filter");
    this.elements.customerInput = document.getElementById("sb-customer-filter");
    this.elements.filterBtn = document.getElementById("sb-filter-btn");
    this.elements.tableContainer = document.getElementById("statusbarang-grid");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
  },

  async loadData() {
    try {
      const month = this.elements.monthFilter.value;
      const year = this.elements.yearFilter.value;
      const customer = this.elements.customerInput.value.trim();
      const res = await App.api.request(`/status-barang?month=${month}&year=${year}&customer=${customer}`);
      this.render(res);
    } catch (err) {
      console.error("Status Barang load error:", err);
      this.elements.tableContainer.innerHTML = "<p class='text-red-600'>Gagal memuat data.</p>";
    }
  },

  render(data) {
    if (!data || !data.length) {
      this.elements.tableContainer.innerHTML = "<p class='text-gray-600'>Tidak ada data ditemukan.</p>";
      return;
    }

    this.elements.tableContainer.innerHTML = `
      <table class="min-w-full border text-sm">
        <thead class="bg-[#EDE0D4] text-[#5C4033]">
          <tr>
            <th class="p-2 border">Tanggal</th>
            <th class="p-2 border">Customer</th>
            <th class="p-2 border">Deskripsi</th>
            <th class="p-2 border">Produksi</th>
            <th class="p-2 border">Warna</th>
            <th class="p-2 border">Kirim</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr class="${row.di_kirim === 'true' ? 'bg-green-100' :
              row.siap_kirim === 'true' ? 'bg-yellow-100' :
              row.di_warna === 'true' ? 'bg-orange-100' :
              row.di_produksi === 'true' ? 'bg-blue-100' : ''}">
              <td class="p-2 border">${row.tanggal || ''}</td>
              <td class="p-2 border">${row.nama_customer || ''}</td>
              <td class="p-2 border">${row.deskripsi || ''}</td>
              <td class="p-2 border text-center">${row.di_produksi || ''}</td>
              <td class="p-2 border text-center">${row.di_warna || ''}</td>
              <td class="p-2 border text-center">${row.di_kirim || ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  }
};

// ======================================================
// 👷‍♂️ KARYAWAN PAGE
// ======================================================
App.pages["data-karyawan"] = {
  state: { table: null },
  elements: {},

  async init() {
    this.elements.tableContainer = document.getElementById("karyawan-grid");
    await this.loadData();
  },

  async loadData() {
    try {
      const res = await App.api.request("/karyawan");
      this.render(res);
    } catch (err) {
      console.error("Load karyawan error:", err);
      this.elements.tableContainer.innerHTML = "<p class='text-red-600'>Gagal memuat data karyawan.</p>";
    }
  },

  render(data) {
    if (!data?.length) {
      this.elements.tableContainer.innerHTML = "<p>Tidak ada data karyawan.</p>";
      return;
    }

    this.elements.tableContainer.innerHTML = `
      <table class="min-w-full border text-sm">
        <thead class="bg-[#EDE0D4] text-[#5C4033]">
          <tr>
            <th class="p-2 border">Nama</th>
            <th class="p-2 border">Gaji Harian</th>
            <th class="p-2 border">Kasbon</th>
            <th class="p-2 border">BPJS Kesehatan</th>
            <th class="p-2 border">BPJS Ketenagakerjaan</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(k => `
            <tr>
              <td class="p-2 border">${k.nama_karyawan}</td>
              <td class="p-2 border text-right">Rp ${parseInt(k.gaji_harian).toLocaleString('id-ID')}</td>
              <td class="p-2 border text-right">Rp ${parseInt(k.kasbon).toLocaleString('id-ID')}</td>
              <td class="p-2 border text-right">${k.potongan_bpjs_kesehatan}</td>
              <td class="p-2 border text-right">${k.potongan_bpjs_ketenagakerjaan}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }
};

// ======================================================
// 💰 PAYROLL PAGE
// ======================================================
App.pages["payroll"] = {
  state: {},
  elements: {},

  async init() {
    this.elements.form = document.getElementById("payroll-form");
    this.elements.karyawanSelect = document.getElementById("karyawan-id");
    this.elements.kasbonInput = document.getElementById("potongan-kasbon");

    await this.populateKaryawan();
    this.elements.form?.addEventListener("submit", e => this.handleSubmit(e));
  },

  async populateKaryawan() {
    try {
      const data = await App.api.request("/karyawan");
      this.elements.karyawanSelect.innerHTML = data.map(d => `
        <option value="${d.id}">${d.nama_karyawan}</option>
      `).join('');
    } catch (err) {
      console.error("Gagal load karyawan:", err);
    }
  },

  async handleSubmit(e) {
    e.preventDefault();
    const karyawan_id = this.elements.karyawanSelect.value;
    const potongan_kasbon = parseFloat(this.elements.kasbonInput.value || 0);
    try {
      const res = await App.api.request("/payroll", {
        method: "POST",
        body: { karyawan_id, potongan_kasbon }
      });
      alert(res.message || "Payroll berhasil diproses.");
      this.elements.form.reset();
    } catch (err) {
      console.error("Payroll submit error:", err);
      alert("Gagal memproses payroll.");
    }
  }
};


// ==========================================================
// 🧩 APP.FIXED.JS — PART 2B
// Halaman: Stok Bahan, Invoice, Keuangan + Routing Layout
// ==========================================================

// ======================================================
// 🧱 STOK BAHAN PAGE
// ======================================================
App.pages["stok-bahan"] = {
  elements: {},
  state: {},

  async init() {
    this.elements.table = document.getElementById("stok-grid");
    this.elements.addForm = document.getElementById("stok-form");

    await this.loadData();

    this.elements.addForm?.addEventListener("submit", e => this.addStok(e));
  },

  async loadData() {
    try {
      const res = await App.api.request("/stok");
      this.render(res);
    } catch (err) {
      console.error("Gagal memuat stok:", err);
      this.elements.table.innerHTML = "<p class='text-red-600'>Gagal memuat stok.</p>";
    }
  },

  render(data) {
    if (!data?.length) {
      this.elements.table.innerHTML = "<p>Tidak ada data stok.</p>";
      return;
    }

    this.elements.table.innerHTML = `
      <table class="min-w-full border text-sm">
        <thead class="bg-[#EDE0D4] text-[#5C4033]">
          <tr>
            <th class="p-2 border">Kode</th>
            <th class="p-2 border">Nama</th>
            <th class="p-2 border">Kategori</th>
            <th class="p-2 border">Satuan</th>
            <th class="p-2 border text-right">Stok</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(b => `
            <tr>
              <td class="p-2 border">${b.kode_bahan}</td>
              <td class="p-2 border">${b.nama_bahan}</td>
              <td class="p-2 border">${b.kategori}</td>
              <td class="p-2 border">${b.satuan}</td>
              <td class="p-2 border text-right">${b.stok}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    `;
  },

  async addStok(e) {
    e.preventDefault();
    const formData = new FormData(this.elements.addForm);
    const data = Object.fromEntries(formData.entries());
    try {
      await App.api.request("/stok", { method: "POST", body: data });
      alert("Data stok berhasil ditambahkan.");
      this.elements.addForm.reset();
      await this.loadData();
    } catch (err) {
      console.error("Tambah stok error:", err);
      alert("Gagal menambah stok.");
    }
  }
};

// ======================================================
// 🧾 INVOICE PAGE
// ======================================================
App.pages["print-po"] = {
  state: {},
  elements: {},

  async init() {
    this.elements.container = document.getElementById("invoice-container");
    this.loadData();
  },

  async loadData() {
    try {
      const poData = JSON.parse(sessionStorage.getItem("poData")) || [];
      if (!poData.length) {
        this.elements.container.innerHTML = "<p>Tidak ada data PO.</p>";
        return;
      }

      this.render(poData);
    } catch (err) {
      console.error("Gagal load PO:", err);
      this.elements.container.innerHTML = "<p class='text-red-600'>Gagal memuat PO.</p>";
    }
  },

  render(data) {
    this.elements.container.innerHTML = `
      <h2 class="text-xl font-bold mb-4">Purchase Order</h2>
      <table class="min-w-full border text-sm">
        <thead class="bg-[#EDE0D4] text-[#5C4033]">
          <tr>
            <th class="p-2 border">Tanggal</th>
            <th class="p-2 border">Customer</th>
            <th class="p-2 border">Deskripsi</th>
            <th class="p-2 border">Ukuran</th>
            <th class="p-2 border">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>
              <td class="p-2 border">${item.tanggal || ''}</td>
              <td class="p-2 border">${item.nama_customer || ''}</td>
              <td class="p-2 border">${item.deskripsi || ''}</td>
              <td class="p-2 border">${item.ukuran || ''}</td>
              <td class="p-2 border text-center">${item.qty || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
};

// ======================================================
// 💵 KEUANGAN PAGE
// ======================================================
App.pages["keuangan"] = {
  state: {},
  elements: {},

  init() {
    this.elements.saldoContainer = document.getElementById("saldo-container");
    this.elements.transaksiForm = document.getElementById("transaksi-form");
    this.elements.riwayatContainer = document.getElementById("riwayat-container");

    this.elements.transaksiForm?.addEventListener("submit", e => this.submitTransaksi(e));
    this.loadSaldo();
    this.loadRiwayat();
  },

  async loadSaldo() {
    try {
      const data = await App.api.request("/keuangan/saldo");
      this.renderSaldo(data);
    } catch (err) {
      console.error("Gagal load saldo:", err);
      this.elements.saldoContainer.innerHTML = "<p>Gagal memuat saldo.</p>";
    }
  },

  renderSaldo(data) {
    if (!data?.length) {
      this.elements.saldoContainer.innerHTML = "<p>Tidak ada kas.</p>";
      return;
    }
    this.elements.saldoContainer.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        ${data.map(k => `
          <div class="p-4 bg-[#EDE0D4] rounded-lg shadow text-center">
            <p class="text-sm text-[#5C4033]">${k.nama_kas}</p>
            <p class="text-lg font-bold text-[#8B5E34]">Rp ${parseInt(k.saldo).toLocaleString('id-ID')}</p>
          </div>
        `).join('')}
      </div>`;
  },

  async submitTransaksi(e) {
    e.preventDefault();
    const formData = new FormData(this.elements.transaksiForm);
    const data = Object.fromEntries(formData.entries());
    try {
      await App.api.request("/keuangan/transaksi", { method: "POST", body: data });
      alert("Transaksi berhasil disimpan!");
      this.elements.transaksiForm.reset();
      this.loadSaldo();
      this.loadRiwayat();
    } catch (err) {
      console.error("Transaksi error:", err);
      alert("Gagal menyimpan transaksi.");
    }
  },

  async loadRiwayat() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    try {
      const data = await App.api.request(`/keuangan/riwayat?month=${month}&year=${year}`);
      this.renderRiwayat(data);
    } catch (err) {
      console.error("Riwayat error:", err);
      this.elements.riwayatContainer.innerHTML = "<p>Gagal memuat riwayat transaksi.</p>";
    }
  },

  renderRiwayat(data) {
    if (!data?.length) {
      this.elements.riwayatContainer.innerHTML = "<p>Tidak ada riwayat transaksi bulan ini.</p>";
      return;
    }
    this.elements.riwayatContainer.innerHTML = `
      <table class="min-w-full border text-sm mt-4">
        <thead class="bg-[#EDE0D4] text-[#5C4033]">
          <tr>
            <th class="p-2 border">Tanggal</th>
            <th class="p-2 border">Kas</th>
            <th class="p-2 border">Tipe</th>
            <th class="p-2 border">Jumlah</th>
            <th class="p-2 border">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td class="p-2 border">${r.tanggal ? new Date(r.tanggal).toLocaleDateString("id-ID") : ""}</td>
              <td class="p-2 border">${r.nama_kas}</td>
              <td class="p-2 border">${r.tipe}</td>
              <td class="p-2 border text-right">Rp ${parseInt(r.jumlah).toLocaleString('id-ID')}</td>
              <td class="p-2 border">${r.keterangan}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }
};

// ======================================================
// 🌐 AUTO INIT + ROUTING
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {
  // Deteksi halaman aktif berdasarkan path
  const path = window.location.pathname.split("/").pop().replace(".html", "");
  const pageKey = path || "dashboard";

  // Muat layout utama (sidebar, header)
  await App.loadLayout();

  // Jalankan init halaman jika ada
  if (App.pages[pageKey] && typeof App.pages[pageKey].init === "function") {
    console.log(`🚀 Memuat halaman: ${pageKey}`);
    App.pages[pageKey].init();
  } else {
    console.warn(`⚠️ Tidak ditemukan page handler untuk: ${pageKey}`);
  }
});

