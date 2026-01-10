
// ==========================================================
// 🚀 APP.JS (VERSI LENGKAP - SEMUA PAGE TERMASUK PRINT PO & SURAT JALAN)
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
    sidebarCollapsed: false
  },



  // ======================================================
  // 🔐 AUTH TOKEN HANDLER
  // ======================================================
  setToken(token) {
    localStorage.setItem("authToken", token);
    this.state.token = token;
  },

  getToken() {
    if (!this.state.token) {
      this.state.token = localStorage.getItem("authToken");
    }
    return this.state.token;
  },

  clearToken() {
    localStorage.removeItem("authToken");
    this.state.token = null;
  },

  // ======================================================
  // 🧾 FETCH WRAPPER (API Request dengan Auto Refresh Token)
  // ======================================================
  // ──────────────────────────────────────────
  // App.api.request — baca body hanya sekali, parse aman
  // ──────────────────────────────────────────
  api: {
    baseUrl:
      window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : window.location.origin,

    async request(endpoint, options = {}) {
      // --- URL handling ---
      const url = endpoint.startsWith("/api")
        ? `${this.baseUrl}${endpoint}`
        : `${this.baseUrl}/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

      // --- Header setup ---
      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };

      // --- Token auth ---
      const token = localStorage.getItem("authToken");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // --- Body serialization (jika object) ---
      let body = options.body;
      if (body && typeof body === "object" && !(body instanceof FormData)) {
        body = JSON.stringify(body);
      }

      const fetchOpts = {
        method: options.method || "GET",
        headers,
        body: ["GET", "HEAD"].includes((options.method || "GET").toUpperCase())
          ? undefined
          : body,
        credentials: options.credentials || "same-origin",
      };

      try {
        const resp = await fetch(url, fetchOpts);

        // --- Read once ---
        const text = await resp.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = text;
        }

        // --- Handle 401 or token expired ---
        if (resp.status === 401) {
          if (data?.message?.toLowerCase().includes("expired")) {
            console.warn("⚠️ Token expired, please refresh session.");
            localStorage.removeItem("authToken");
            throw new Error("Session expired. Silakan login ulang.");
          }
          throw new Error(data?.message || "Unauthorized");
        }

        // --- Error general ---
        if (!resp.ok) {
          const msg =
            data && data.message
              ? data.message
              : typeof data === "string"
                ? data
                : `Request failed: ${resp.status}`;
          const err = new Error(msg);
          err.status = resp.status;
          err.responseData = data;
          throw err;
        }

        return data;
      } catch (err) {
        console.error("🔥 App.api.request Error:", err.message);
        throw err;
      }
    },
  },






  // ======================================================
  // 🧠 UI UTILITIES
  // ======================================================
  ui: {
    // Format angka ke IDR
    formatRupiah(value) {
      if (isNaN(value) || value === null || value === undefined) return "Rp0";
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(value);
    },

    // Format tanggal lokal
    formatDate(dateStr) {
      if (!dateStr) return "-";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "-";
        return d.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch (e) {
        return "-";
      }
    },

    // ======================================================
    // 🌙 SIDEBAR TOGGLE - FIXED VERSION
    // ======================================================
    toggleSidebar() {
      const container = document.getElementById("app-container");
      const sidebar = document.getElementById("sidebar");
      const backdrop = document.getElementById("sidebar-backdrop");

      if (!container || !sidebar) return;

      const isMobile = window.innerWidth <= 1024;

      if (isMobile) {
        // MOBILE MODE - Overlay behavior
        const isOpening = !container.classList.contains("sidebar-open");

        if (isOpening) {
          // Open sidebar
          container.classList.add("sidebar-open");
          this.ensureSidebarBackdrop(true);
          document.body.style.overflow = "hidden";
        } else {
          // Close sidebar
          container.classList.remove("sidebar-open");
          this.ensureSidebarBackdrop(false);
          document.body.style.overflow = "";
        }
      } else {
        // DESKTOP MODE - Collapse/Expand behavior
        container.classList.toggle("sidebar-collapsed");

        // Save state to localStorage
        const isCollapsed = container.classList.contains("sidebar-collapsed");
        localStorage.setItem("sidebarCollapsed", isCollapsed ? "1" : "0");

        console.log("🔄 Sidebar collapsed:", isCollapsed);
      }
    },

    // ======================================================
    // 🚀 INIT SIDEBAR ON PAGE LOAD - FIXED
    // ======================================================




    // ======================================================
    // ⚫ BACKDROP HANDLER - FIXED
    // ======================================================
    setupBackdropHandler() {
      document.addEventListener('click', (e) => {
        const backdrop = document.getElementById('sidebar-backdrop');
        const container = document.getElementById('app-container');

        if (backdrop && e.target === backdrop && container) {
          container.classList.remove('sidebar-open');
          this.ensureSidebarBackdrop(false);
          document.body.style.overflow = '';
        }
      });
    },

    // ======================================================
    // ⎋ ESCAPE KEY HANDLER - FIXED
    // ======================================================
    setupEscapeHandler() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const container = document.getElementById('app-container');
          if (container && container.classList.contains('sidebar-open')) {
            container.classList.remove('sidebar-open');
            this.ensureSidebarBackdrop(false);
            document.body.style.overflow = '';
          }
        }
      });
    },

    // ======================================================
    // 📱 RESIZE HANDLER - FIXED
    // ======================================================
    setupResizeHandler() {
      let resizeTimeout;

      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const container = document.getElementById('app-container');
          if (!container) return;

          const isMobile = window.innerWidth <= 1024;

          if (isMobile) {
            // Mobile mode - remove collapsed state, ensure backdrop is hidden
            container.classList.remove('sidebar-collapsed');
            container.classList.remove('sidebar-open');
            this.ensureSidebarBackdrop(false);
            document.body.style.overflow = '';
          } else {
            // Desktop mode - restore collapsed state from localStorage
            container.classList.remove('sidebar-open');
            this.ensureSidebarBackdrop(false);

            const savedState = localStorage.getItem('sidebarCollapsed');
            if (savedState === '1') {
              container.classList.add('sidebar-collapsed');
            } else {
              container.classList.remove('sidebar-collapsed');
            }
          }
        }, 250);
      });
    },

    // ======================================================
    // ◼️ BACKDROP HELPER - FIXED
    // ======================================================
    ensureSidebarBackdrop(show) {
      let backdrop = document.getElementById('sidebar-backdrop');

      if (!backdrop && show) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1001;
      display: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
        document.body.appendChild(backdrop);
      }

      if (backdrop) {
        if (show) {
          backdrop.style.display = 'block';
          setTimeout(() => {
            backdrop.style.opacity = '1';
          }, 10);
        } else {
          backdrop.style.opacity = '0';
          setTimeout(() => {
            backdrop.style.display = 'none';
          }, 300);
        }
      }
    },


    // Buat dropdown Bulan & Tahun otomatis (angka + nama)
    populateDateFilters(monthSelect, yearSelect) {
      if (!monthSelect || !yearSelect) {
        console.warn("Month or year select element not found");
        return;
      }

      monthSelect.innerHTML = "";
      yearSelect.innerHTML = "";

      const bulanNama = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];

      // Add months
      for (let i = 1; i <= 12; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `${bulanNama[i - 1]} (${i})`;
        monthSelect.appendChild(opt);
      }

      // Add years (2020 to current year + 3)
      const currentYear = new Date().getFullYear();
      for (let y = 2020; y <= currentYear + 3; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }

      // Set current month and year
      monthSelect.value = (new Date().getMonth() + 1).toString();
      yearSelect.value = currentYear.toString();
    },

    // Cetak elemen HTML tertentu
    printElement(elementId) {
      const el = document.getElementById(elementId);
      if (!el) return alert("Elemen tidak ditemukan");

      const newWin = window.open("", "_blank");
      newWin.document.write(`
        <html>
          <head>
            <title>Cetak</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${el.outerHTML}
          </body>
        </html>
      `);
      newWin.document.close();
      newWin.focus();
      setTimeout(() => {
        newWin.print();
        // newWin.close();
      }, 250);
    },

    // Tampilkan notifikasi sederhana
    showToast(msg, type = "info") {
      const colors = {
        info: "#3182ce",
        success: "#2f855a",
        error: "#c53030",
        warning: "#dd6b20",
      };

      // Remove existing toasts
      document.querySelectorAll('.app-toast').forEach(toast => toast.remove());

      const toast = document.createElement("div");
      toast.className = "app-toast";
      toast.textContent = msg;
      toast.style.position = "fixed";
      toast.style.bottom = "20px";
      toast.style.right = "20px";
      toast.style.background = colors[type] || "#333";
      toast.style.color = "white";
      toast.style.padding = "12px 16px";
      toast.style.borderRadius = "6px";
      toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
      toast.style.zIndex = "10000";
      toast.style.fontSize = "14px";
      toast.style.fontWeight = "500";
      toast.style.maxWidth = "300px";
      toast.style.wordWrap = "break-word";

      document.body.appendChild(toast);

      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.transition = "opacity 0.3s ease";
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 300);
        }
      }, 4000);
    },
  },




  // ======================================================
  // 🏁 INITIALIZATION
  // ======================================================
  init() {
    console.log("🏁 App Init...");

    // ✅ DETEKSI HALAMAN LOGIN (Mencegah Infinite Loop)
    const path = window.location.pathname;
    const isLoginPage = path === "/" || path.endsWith("index.html") || path.endsWith("/");

    if (isLoginPage) {
      console.log("ℹ️ Berada di halaman login - Skip Auth Check");
      // Jika sudah login, lempar ke dashboard
      if (this.getToken()) {
        console.log("✅ Token ditemukan, redirect ke dashboard...");
        window.location.href = "dashboard.html";
      }
      return; // Stop init di halaman login
    }

    // Check auth untuk halaman selain login
    if (!this.getToken()) {
      console.warn("⚠️ No token found, redirecting to login...");
      window.location.href = "index.html";
      return;
    }

    // Load Socket.IO
    this.loadSocketIODynamically();

    // Initialize Global UI Handlers
    if (this.ui.setupResizeHandler) this.ui.setupResizeHandler();
    if (this.ui.applyInitialSidebarState) this.ui.applyInitialSidebarState();
    if (this.ui.setupEscapeHandler) this.ui.setupEscapeHandler();
    if (this.ui.setupBackdropHandler) this.ui.setupBackdropHandler();

    // Setup Notification Listeners (New)
    this.setupNotificationListeners();

    // Setup Sidebar Dropdowns
    this.setupSidebarDropdowns();

    // Load Layout and Current Page
    this.loadLayout().then(() => {
      // ♻️ INJECT ADMIN MENU IF FAISAL/ADMIN
      const userData = JSON.parse(localStorage.getItem("userData") || "{}");
      if (userData.username === "faisal" || userData.role === "admin") {
        const sidebarNav = document.querySelector("#sidebar nav");
        if (sidebarNav) {
          // Check if already exists
          if (!document.getElementById("menu-manajemen-user")) {
            const adminMenu = document.createElement("a");
            adminMenu.id = "menu-manajemen-user";
            adminMenu.href = "admin.html"; // Assuming admin.html exists or data-karyawan
            adminMenu.className = "flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-[#8B5E34] hover:text-white transition-colors rounded-lg mb-1";
            adminMenu.innerHTML = `
               <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
               <span class="font-medium">Manajemen User</span>
             `;
            // Insert before Logout or at the end
            sidebarNav.appendChild(adminMenu);
          }
        }
      }

      // Determine page based on URL
      const path = window.location.pathname;
      // Determine page based on URL
      // const path = window.location.pathname; // REMOVED DUPLICATE
      let pageFound = false;

      // Define routes mapping (URL part -> App.pages key)
      const routes = [
        { key: "work-orders", page: "work-orders" },
        { key: "status-barang", page: "status-barang" },
        { key: "data-karyawan", page: "data-karyawan" },
        { key: "payroll", page: "payroll" },
        { key: "stok-bahan", page: "stok-bahan" },
        { key: "surat-jalan", page: "surat-jalan" },
        { key: "print-po", page: "print-po" },
        { key: "keuangan", page: "keuangan" },
        { key: "invoice", page: "invoice" },
        { key: "admin", page: "admin" }
      ];

      // Check strict profile match first
      if (path.includes("profil.html")) {
        pageFound = true;
        if (this.pages["profil"] && this.pages["profil"].init) {
          console.log("🚀 Route matched: profil.html -> Init profil");
          this.pages["profil"].init();
        }
      } else {
        // Iterate routes
        for (const route of routes) {
          if (path.includes(route.key)) {
            // Special check for admin-subscription to avoid matching "admin"
            if (route.key === "admin" && path.includes("subscription")) continue;

            this.state.currentPage = route.page;
            if (this.pages[route.page] && this.pages[route.page].init) {
              console.log(`🚀 Route matched: ${route.key} -> Init ${route.page}`);
              this.pages[route.page].init();
              pageFound = true;
            }
            break;
          }
        }
      }

      if (!pageFound) {
        if (path.endsWith("/") || path.includes("index.html") || path.includes("dashboard")) {
          this.state.currentPage = "dashboard";
          if (this.pages["dashboard"] && this.pages["dashboard"].init) {
            this.pages["dashboard"].init();
          }
        } else {
          console.warn(`⚠️ No page logic found for path: ${path}`);
        }
      }
    }).then(() => {
      // Check notifications after layout load
      this.checkNotifications();
    });
  },

  // ======================================================
  // 🔔 NOTIFICATION LOGIC
  // ======================================================
  setupNotificationListeners() {
    document.addEventListener('click', (e) => {
      const bell = e.target.closest('#notification-bell');
      const dropdown = document.getElementById('notif-dropdown');

      if (bell) {
        // Toggle dropdown
        if (dropdown) dropdown.classList.toggle('hidden');
      } else {
        // Close if clicking outside
        if (dropdown && !dropdown.classList.contains('hidden') && !e.target.closest('#notif-dropdown')) {
          dropdown.classList.add('hidden');
        }
      }
    });
  },

  async checkNotifications() {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    if (!badge || !list) return;

    try {
      const data = await App.api.request('/notifications/summary');

      // Calculate total late count from groups
      const lateGroups = data.late_groups || [];
      const totalLate = lateGroups.reduce((acc, g) => acc + parseInt(g.count), 0);
      const printedCount = data.printed_recent_count || 0;

      // Update Badge
      if (totalLate > 0) {
        badge.textContent = totalLate > 99 ? '99+' : totalLate;
        badge.classList.remove('hidden');
        badge.classList.add('animate-pulse');
      } else {
        badge.classList.add('hidden');
        badge.classList.remove('animate-pulse');
      }

      // Update Dropdown Content
      let html = '';

      // 1. Printed Summary Section
      if (printedCount > 0) {
        html += `
          <div class="px-4 py-3 bg-green-50 border-b border-green-100">
             <div class="flex items-center text-green-800">
                <span class="text-lg mr-2">🖨️</span>
                <div>
                   <p class="text-xs font-bold">Produksi Lancar!</p>
                   <p class="text-[10px] text-green-600">${printedCount} WO diprint 7 hari terakhir.</p>
                </div>
             </div>
          </div>
        `;
      }

      // 2. Late Groups List
      if (lateGroups.length > 0) {
        html += lateGroups.map(group => `
            <div class="p-3 border-b border-gray-100 hover:bg-orange-50 cursor-pointer transition relative group"
                 onclick="App.showNotificationDetail('${group.date_group}')">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-gray-800 text-xs text-red-600">
                       📅 ${App.ui.formatDate(group.date_group)}
                    </span>
                    <span class="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                       ${group.count} Telat
                    </span>
                </div>
                <p class="text-[10px] text-gray-500">
                   WO ID #${group.min_id} s/d #${group.max_id} belum diprint.
                </p>
                <div class="absolute right-2 top-8 opacity-0 group-hover:opacity-100 text-[10px] text-blue-500 font-bold">
                   Lihat >
                </div>
            </div>
        `).join('');

        // Footer "View All"
        if (totalLate > 5) {
          html += `<div class="p-2 text-center text-xs text-blue-600 font-medium hover:underline cursor-pointer bg-gray-50"
                  onclick="window.location.hash='#work-orders'; App.state.currentPage='work-orders'; App.loadLayout();">
                  Lihat Semua (${totalLate})
             </div>`;
        }
      } else if (printedCount === 0) {
        // Empty State
        html = `<div class="p-6 text-center">
            <span class="text-2xl text-gray-300 block mb-2">🎉</span>
            <p class="text-xs text-gray-500">Semua aman! Tidak ada tanggungan.</p>
        </div>`;
      }

      list.innerHTML = html;

    } catch (err) {
      console.error("Failed to check notifications", err);
    }
  },

  // 🔔 SHOW NOTIFICATION DETAIL MODAL
  async showNotificationDetail(date) {
    const modal = document.getElementById('notif-detail-modal');
    const content = document.getElementById('notif-modal-content');
    const title = document.getElementById('notif-modal-title');

    if (!modal || !content) return;

    modal.classList.remove('hidden');
    title.textContent = `Keterlambatan: ${App.ui.formatDate(date)}`;
    content.innerHTML = `<div class="p-8 text-center text-gray-500"><div class="loading-spinner mx-auto mb-2"></div>Memuat data...</div>`;

    try {
      const items = await App.api.request(`/api/notifications/details?date=${date}`);

      if (items.length === 0) {
        content.innerHTML = `<div class="p-4 text-center text-gray-500">Data tidak ditemukan</div>`;
        return;
      }

      content.innerHTML = items.map(item => `
        <div class="p-3 border-b flex justify-between items-start hover:bg-gray-50">
           <div>
              <div class="font-bold text-gray-800 text-sm">#WO-${item.id}</div>
              <div class="text-xs text-gray-600">${item.nama_customer}</div>
              <div class="text-xs text-gray-500 italic mt-1">${item.deskripsi}</div>
              <div class="text-[10px] text-gray-400 mt-1">Ukuran: ${item.ukuran} | Qty: ${item.qty}</div>
           </div>
           <div>
              <button onclick="window.location.hash='#work-orders'; App.state.currentPage='work-orders'; App.loadLayout(); document.getElementById('notif-detail-modal').classList.add('hidden');" 
                 class="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200">
                 Buka WO
              </button>
           </div>
        </div>
      `).join('');

    } catch (err) {
      console.error("Failed to load details", err);
      content.innerHTML = `<div class="p-4 text-center text-red-500">Gagal memuat detail</div>`;
    }
  },





  // ======================================================
  // ⚡ SOCKET.IO CLIENT (Realtime Connection) - FIXED
  // ======================================================
  socketHandlers: {
    handleNewWO(row) {
      console.log("📨 Socket: New WO", row);
      const page = App.pages["work-orders"];
      if (page && page.state.table) {
        page.addRowRealtime(row);
      }
    },

    handleUpdateWO(row) {
      console.log("📨 Socket: Update WO", row);
      const page = App.pages["work-orders"];
      if (page && page.state.table) {
        page.updateRowRealtime(row);
      }
    },

    handleDeleteWO(payload) {
      console.log("📨 Socket: Delete WO", payload);
      const page = App.pages["work-orders"];
      if (page && page.state.table) {
        page.deleteRowRealtime(payload.id);
      }
    },
  },

  socketInit() {
    // ✅ SAFETY CHECK: Cek apakah Socket.IO client sudah loaded
    if (typeof io === 'undefined') {
      console.warn("⚠️ Socket.IO client belum dimuat, skip initialization");

      // Coba load Socket.IO dynamically jika belum ada
      this.loadSocketIODynamically();
      return;
    }

    if (this.state.socket) {
      console.warn("⚠️ Socket.IO sudah terhubung.");
      return;
    }

    try {
      console.log("🔌 Menghubungkan Socket.IO...");

      // Determine socket URL based on environment
      const socketUrl = window.location.hostname === "localhost"
        ? "http://localhost:8080"
        : "";

      this.state.socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        timeout: 10000
      });

      const socket = this.state.socket;

      socket.on("connect", () => {
        console.log("⚡ Socket.IO connected:", socket.id);
        App.ui.showToast("Terhubung ke server", "success");
      });

      socket.on("disconnect", (reason) => {
        console.warn("❌ Socket.IO disconnected:", reason);
        if (reason === "io server disconnect") {
          // Server forcefully disconnected, try to reconnect
          socket.connect();
        }
      });

      socket.on("connect_error", (error) => {
        console.error("❌ Socket.IO connection error:", error);
      });

      // Bind event handlers
      socket.on("wo_created", (data) => this.socketHandlers.handleNewWO(data));
      socket.on("wo_updated", (data) => this.socketHandlers.handleUpdateWO(data));
      socket.on("wo_deleted", (data) => this.socketHandlers.handleDeleteWO(data));

    } catch (err) {
      console.error("❌ Socket.IO initialization failed:", err);
    }
  },

  // ✅ NEW: Function untuk load Socket.IO dynamically jika belum ada
  loadSocketIODynamically() {
    // Cek apakah sudah ada script Socket.IO
    if (document.querySelector('script[src*="socket.io"]')) {
      console.log("🔄 Socket.IO script sudah dimuat, tunggu sebentar...");
      // Coba lagi setelah 2 detik
      setTimeout(() => this.socketInit(), 2000);
      return;
    }

    console.log("📥 Loading Socket.IO client dynamically...");

    const script = document.createElement('script');
    //script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    //script.integrity = 'sha384-cYFwHbdikNMIoUY/7/XqQmR8MDJQRhlMqpe5SK4+UjRURwU0FQaV4uC8nQYqUQkQ';
    //script.crossOrigin = 'anonymous';

    script.onload = () => {
      console.log("✅ Socket.IO client berhasil dimuat");
      // Coba initialize socket setelah script loaded
      setTimeout(() => this.socketInit(), 1000);
    };

    script.onerror = () => {
      console.error("❌ Gagal memuat Socket.IO client");
      App.ui.showToast("Gagal memuat fitur realtime", "warning");
    };

    document.head.appendChild(script);
  },



  // ======================================================
  // 📄 PAGES CONTAINER
  // ======================================================
  pages: {},

  // ======================================================
  // 🧩 SAFE GET USER — Ambil user login & handle token otomatis
  // ======================================================
  async safeGetUser() {
    try {
      const token = this.getToken();
      if (!token) throw new Error("Token tidak ditemukan.");

      const data = await this.api.request("/me");
      this.state.user = data;
      console.log("👤 Logged in as:", data.username);
      return data;
    } catch (err) {
      console.warn("⚠️ safeGetUser error:", err.message);
      this.clearToken();
      sessionStorage.clear();
      window.location.href = "index.html";
      return null;
    }
  },

  // ======================================================
  // 🧱 LOAD LAYOUT (Sidebar + Header) — FIXED VERSION
  // ======================================================
  async loadLayout() {
    const appContainer = document.getElementById("app-container");
    if (!appContainer) {
      console.error("❌ app-container not found");
      return;
    }

    try {
      // Test connection first
      const healthCheck = await fetch(`${this.api.baseUrl}/api/health`).catch(() => null);
      if (!healthCheck || !healthCheck.ok) {
        throw new Error("Tidak dapat terhubung ke server");
      }

      // Muat komponen sidebar & header secara paralel
      const [sidebarRes, headerRes] = await Promise.all([
        fetch("components/_sidebar.html").catch(() => {
          throw new Error("Gagal memuat sidebar");
        }),
        fetch("components/_header.html").catch(() => {
          throw new Error("Gagal memuat header");
        })
      ]);

      if (!sidebarRes.ok || !headerRes.ok) {
        throw new Error("Gagal memuat komponen layout.");
      }

      const sidebarHTML = await sidebarRes.text();
      const headerHTML = await headerRes.text();

      // Masukkan HTML ke DOM
      const sidebarEl = document.getElementById("sidebar");
      const headerEl = document.getElementById("header-container");

      if (sidebarEl) sidebarEl.outerHTML = sidebarHTML;
      if (headerEl) headerEl.innerHTML = headerHTML;

      // Load Bottom Nav for Mobile
      if (window.innerWidth <= 1024) {
        try {
          const navRes = await fetch("components/_bottom_nav.html");
          if (navRes.ok) {
            const navHTML = await navRes.text();
            const navDiv = document.createElement("div");
            navDiv.innerHTML = navHTML;
            document.body.appendChild(navDiv);

            // Setup active state
            const path = window.location.pathname;
            navDiv.querySelectorAll('.nav-item').forEach(link => {
              const pageName = link.getAttribute("data-page");
              // Check if path contains page name or if it's dashboard (root or index)
              if ((pageName === 'dashboard' && (path.endsWith('/') || path.includes('index.html') || path.includes('dashboard.html'))) ||
                (pageName && path.includes(pageName))) {
                link.classList.remove("text-gray-500");
                link.classList.add("text-[#A67B5B]", "font-bold");
              } else {
                // Reset others
                link.classList.add("text-gray-500");
                link.classList.remove("text-[#A67B5B]", "font-bold");
              }
            });

            // Setup Menu Toggle
            const menuBtn = document.getElementById("mobile-menu-toggle");
            if (menuBtn) {
              menuBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (App.ui && App.ui.toggleSidebar) {
                  App.ui.toggleSidebar();
                }
              });
            }
          }
        } catch (e) {
          console.warn("Failed to load bottom nav:", e);
        }
      }

      // Setup user data
      const user = await this.safeGetUser();
      if (!user) return;

      // 🔒 ADMIN MENU RESTRICTION
      // Only show admin menu for user 'faisal'
      if (user.username !== 'faisal') {
        const adminMenu = document.getElementById('admin-menu');
        if (adminMenu) {
          adminMenu.remove();
          console.log("🔒 Admin menu hidden for non-admin user");
        }
      }

      // Update user display (using helper)
      if (App.ui.updateUserDisplay) {
        App.ui.updateUserDisplay(user);
      } else {
        // Fallback if helper not ready (though it should be)
        const userDisplay = document.getElementById("user-display");
        if (userDisplay) userDisplay.textContent = user.username || "Pengguna";
      }

      // Setup sidebar toggle
      this.setupSidebarToggle();

      // Setup page title
      this.setupPageTitle();

      // Setup sidebar navigation
      this.setupSidebarNavigation();

      // Setup sidebar dropdowns
      this.setupSidebarDropdownsAfterLoad();

      // Setup logout button
      this.setupLogoutButton();

      console.log("✅ Layout loaded successfully for:", user.username);
    } catch (error) {
      console.error("❌ Gagal memuat layout:", error);
      this.ui.showToast("Gagal memuat aplikasi: " + error.message, "error");

      // Fallback error page
      appContainer.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-100">
          <div class="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
            <h2 class="text-2xl font-bold text-red-600 mb-4">Gagal Memuat Aplikasi</h2>
            <p class="text-gray-600 mb-4">${error.message}</p>
            <div class="space-y-2">
              <button onclick="location.reload()" class="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Coba Lagi
              </button>
              <button onclick="App.clearToken(); location.href='index.html'" class="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
                Kembali ke Login
              </button>
            </div>
          </div>
        </div>`;
      appContainer.innerHTML = html;
    }
  },

  // 🔹 Toggle Sidebar Logic
  // Removed redundant toggleSidebar, using App.ui.toggleSidebar defined below

  setupSidebarToggle() {
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    const sidebar = document.getElementById("sidebar");

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🍔 Toggle sidebar clicked via setupSidebarToggle");
        if (App.ui && App.ui.toggleSidebar) {
          App.ui.toggleSidebar();
        } else {
          console.error("App.ui.toggleSidebar not found");
        }
      });
    }
  },

  setupSidebarDropdowns() {
    // Delegate event to sidebar to handle dynamically loaded content or existing content
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return; // Might be called before load, but usually layout loaded later. 

    // Better: use delegation on document or re-call this after layout load.
    // Since sidebar is loaded via loadLayout -> fetch, we must call this AFTER layout load or inside loadLayout
  },

  setupSidebarDropdownsAfterLoad() {
    // 🗑️ Remove old individual listeners approach
    // We use Event Delegation now for robustness
    document.removeEventListener('click', this._sidebarClickHandler);

    this._sidebarClickHandler = (e) => {
      // Find closest collapsible toggle
      const toggle = e.target.closest('.collapsible > a');
      if (!toggle) return;

      // Prevent default for toggle links (href="#")
      e.preventDefault();

      const collapsible = toggle.parentElement;
      const submenu = collapsible.querySelector('.submenu');
      const chevron = collapsible.querySelector('.submenu-toggle');

      if (submenu) {
        submenu.classList.toggle('hidden');

        // Rotate chevron
        if (chevron) {
          chevron.style.transform = submenu.classList.contains('hidden')
            ? 'rotate(0deg)'
            : 'rotate(180deg)';
        }
      }
    };

    document.addEventListener('click', this._sidebarClickHandler);
    console.log("✅ Sidebar dropdown delegation setup complete");
  },

  setupPageTitle() {
    // Simple title setup
    const path = window.location.pathname;
    let title = "Dashboard";
    if (path.includes("work-orders")) title = "Work Orders";
    document.title = "Toto App - " + title;
  },

  setupSidebarNavigation() {
    const path = window.location.pathname;
    const links = document.querySelectorAll("#sidebar a");
    links.forEach(link => {
      if (link.getAttribute("href") && path.includes(link.getAttribute("href"))) {
        link.classList.add("bg-white", "bg-opacity-20");
      }
    });
  },

  setupLogoutButton() {
    // 🗑️ Remove old listeners if any
    if (this._logoutHandler) {
      document.removeEventListener("click", this._logoutHandler);
    }

    this._logoutHandler = (e) => {
      // Check if target or parent is logout button
      const btn = e.target.closest("#logout-btn") || e.target.closest("#mobile-logout-btn");

      if (btn) {
        e.preventDefault();
        console.log("🔘 Logout clicked via global delegation");
        if (confirm("Apakah anda yakin ingin keluar?")) {
          this.clearToken();
          localStorage.removeItem("userData");
          window.location.href = "index.html";
        }
      }
    };

    // ✅ Attach global listener to document (handles dynamic sidebar)
    document.addEventListener("click", this._logoutHandler);
    console.log("✅ Global Logout Handler Attached");
  },

  // ♻️ RESTORE ADMIN MENU
  setupSidebarDropdowns() {
    // Check if user is admin
    const userData = JSON.parse(localStorage.getItem("userData") || "{}");
    const isAdmin = userData.role === "admin" || userData.username === "faisal";

    // Inject Admin Menu if missing
    if (isAdmin) {
      setTimeout(() => {
        const sidebarNav = document.querySelector("#sidebar nav");
        if (sidebarNav && !document.getElementById("menu-manajemen-user")) {
          const adminMenu = document.createElement("a");
          adminMenu.id = "menu-manajemen-user";
          adminMenu.href = "admin-subscription.html"; // ✅ FIXED LINK
          adminMenu.className = "flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-[#8B5E34] hover:text-white transition-colors rounded-lg mb-1";
          adminMenu.innerHTML = `
             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
             <span class="font-medium">Manajemen User</span>
           `;
          sidebarNav.appendChild(adminMenu);
        }
      }, 1000);
    }
  }
};

// ======================================================
// 📊 DASHBOARD PAGE
// ======================================================
App.pages.dashboard = {
  elements: {},

  init() {
    this.elements = {
      summary: document.getElementById("dashboard-summary"),
      statusList: document.getElementById("dashboard-status-list"),
      monthFilter: document.getElementById("dashboard-month-filter"),
      yearFilter: document.getElementById("dashboard-year-filter"),
      tbody: document.getElementById("dashboard-items-table"),
      tableTitle: document.getElementById("table-title")
    };

    this.setupDateFilters();

    // Event listener for filter button
    const filterBtn = document.getElementById("dashboard-filter-btn");
    if (filterBtn) {
      filterBtn.addEventListener("click", () => {
        console.log("Filter button clicked");
        this.loadData();
      });
    }

    // Load data
    this.loadData();
  },

  setupDateFilters() {
    const { monthFilter, yearFilter } = this.elements;
    if (!monthFilter || !yearFilter) return;

    monthFilter.innerHTML = '';
    yearFilter.innerHTML = '';

    const bulanNama = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = bulanNama[i - 1];
      monthFilter.appendChild(opt);
    }

    const currentYear = new Date().getFullYear();
    for (let y = 2020; y <= currentYear + 1; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearFilter.appendChild(opt);
    }

    const currentMonth = new Date().getMonth() + 1;
    monthFilter.value = currentMonth;
    yearFilter.value = currentYear;
  },

  async loadData() {
    try {
      const m = this.elements.monthFilter.value;
      const y = this.elements.yearFilter.value;

      this.updateStatus("⏳ Memuat data statistik...");

      // 1. Fetch Stats API (Aggregated Finance, Prod, Inventory)
      const stats = await App.api.request(`/dashboard/stats?month=${m}&year=${y}`);

      // 2. Fetch Recent Items (for the table) - Defaulting to "Siap Kirim" or just recent
      const itemsRes = await App.api.request(`/workorders?month=${m}&year=${y}`);
      const items = Array.isArray(itemsRes) ? itemsRes : (itemsRes.data || []);

      this.allRows = items; // Save for table filtering

      this.renderStats(stats);
      this.setTableFilter('siap_kirim'); // Default view

      this.updateStatus("");
    } catch (err) {
      console.error("Dashboard load error:", err);
      this.updateStatus("❌ Gagal memuat data dashboard.");
      // Render zeroes
      this.renderStats({
        finance: { pemasukan: 0, pengeluaran: 0, profit: 0 },
        production: {},
        inventory: { low_stock: 0 },
        summary: { total_orders: 0, total_rupiah: 0 },
        statusCounts: {
          belum_produksi: 0,
          sudah_produksi: 0,
          di_warna: 0,
          siap_kirim: 0,
          di_kirim: 0
        }
      });
    }
  },

  renderStats(data) {
    const { summary, statusCounts } = data; // use new structure
    const { summary: summaryEl, statusList } = this.elements;

    // --- 1. SIMPLE SALES WIDGETS (Reverted to Original) ---
    summaryEl.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Total Orders -->
        <div class="p-4 bg-white rounded shadow border-l-4 border-blue-500">
          <p class="text-sm text-gray-600">Total Pesanan</p>
          <p class="text-2xl font-bold text-gray-900">${summary.total_orders || 0} Order</p>
        </div>
        
        <!-- Total Value -->
        <div class="p-4 bg-white rounded shadow border-l-4 border-green-500">
          <p class="text-sm text-gray-600">Total Nilai Produksi</p>
          <p class="text-2xl font-bold text-gray-900">${App.ui.formatRupiah(summary.total_rupiah || 0)}</p>
        </div>
        </div>
    `;

    // --- 2. STATUS COUNTS ---
    const s = statusCounts || {};
    // Update count badges
    const setBagde = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    };

    // We can't update badges directly here because statusList is a separate container in HTML
    // Instead we re-render the status cards here if needed, OR just let the HTML be static and update numbers.
    // Based on previous code, renderStats likely updated a separate container or the status list is static HTML.
    // Let's assume we just update the 'Overview' above and the 'Ringkasan Status Produksi' below.

    statusList.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
    ${[
        { k: "belum_produksi", l: "Belum Produksi", c: "bg-red-100 text-red-700", icon: "⏳" },
        { k: "di_produksi", l: "Sedang Produksi", c: "bg-blue-100 text-blue-700", icon: "🔨" },
        { k: "di_warna", l: "Sedang Warna", c: "bg-orange-100 text-orange-700", icon: "🎨" },
        { k: "siap_kirim", l: "Siap Kirim", c: "bg-yellow-100 text-yellow-700", icon: "📦" },
        { k: "di_kirim", l: "Sudah Dikirim", c: "bg-green-100 text-green-700", icon: "🚚" },
      ].map(
        (x) => `
        <div
          class="status-card p-4 rounded shadow cursor-pointer transition-all duration-200 hover:shadow-lg ${x.c}"
          data-status="${x.k}"
          onclick="App.pages.dashboard.setTableFilter('${x.k}')"
        >
          <div class="flex justify-between items-start">
             <p class="text-sm font-semibold opacity-80">${x.l}</p>
             <span class="text-lg">${x.icon}</span>
          </div>
          <p class="text-3xl font-bold mt-2">${s[x.k === 'di_produksi' ? 'sudah_produksi' : x.k] || 0}</p>
        </div>`
      ).join("")
      }
      </div>`;

    // Add visual selection logic for cards
    const cards = document.querySelectorAll('.status-card');
    cards.forEach(card => {
      card.addEventListener('click', function () {
        cards.forEach(c => c.classList.remove('active-card', 'ring-2', 'ring-offset-2', 'ring-gray-400'));
        this.classList.add('active-card', 'ring-2', 'ring-offset-2', 'ring-gray-400');
      });
    });
  },

  // ========================================================
  // TABLE & FILTER METHODS
  // ========================================================
  setTableFilter(status) {
    if (!this.allRows) return;
    console.log("Filtering dashboard by:", status);

    // Update buttons UI
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
      if (btn.dataset.status === status) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // Update Title
    const titles = {
      'belum_produksi': 'Daftar Barang Belum Diproduksi',
      'di_produksi': 'Daftar Barang Sedang Diproduksi',
      'di_warna': 'Daftar Barang Sedang Diwarnai',
      'siap_kirim': 'Daftar Barang Siap Kirim',
      'di_kirim': 'Riwayat Pengiriman Bulan Ini'
    };
    if (this.elements.tableTitle) this.elements.tableTitle.textContent = titles[status] || 'Daftar Barang';

    let filtered = [];

    // Filter Logic matches 'status_barang' logic
    if (status === 'belum_produksi') {
      filtered = this.allRows.filter(r => (!r.di_produksi || r.di_produksi === 'false') && (!r.di_kirim || r.di_kirim === 'false'));
    } else if (status === 'di_produksi') {
      filtered = this.allRows.filter(r => r.di_produksi === 'true' && (!r.di_warna || r.di_warna === 'false') && (!r.siap_kirim || r.siap_kirim === 'false') && (!r.di_kirim || r.di_kirim === 'false'));
    } else if (status === 'di_warna') {
      filtered = this.allRows.filter(r => r.di_warna === 'true' && (!r.siap_kirim || r.siap_kirim === 'false') && (!r.di_kirim || r.di_kirim === 'false'));
    } else if (status === 'siap_kirim') {
      filtered = this.allRows.filter(r => r.siap_kirim === 'true' && (!r.di_kirim || r.di_kirim === 'false'));
    } else if (status === 'di_kirim') {
      filtered = this.allRows.filter(r => r.di_kirim === 'true');
    }

    this.renderTable(filtered);
  },

  renderTable(rows) {
    if (!this.elements.tbody) return;

    if (rows.length === 0) {
      this.elements.tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500 italic">Tidak ada data untuk status ini</td></tr>`;
      return;
    }

    this.elements.tbody.innerHTML = rows.map(item => {
      const badge = this.getStatusBadge(item);
      return `
          <tr class="border-b hover:bg-gray-50 text-gray-900 transition-colors">
            <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-600">${App.ui.formatDate(item.tanggal)}</td>
            <td class="px-6 py-3 font-semibold text-gray-800">${item.nama_customer || "-"}</td>
            <td class="px-6 py-3 text-sm text-gray-600">${item.deskripsi || "-"}</td>
            <td class="px-6 py-3 text-center font-mono">${item.qty || "-"}</td>
            <td class="px-6 py-3 text-center text-sm">${item.ukuran || "-"}</td>
            <td class="px-6 py-3 text-center">${badge}</td>
          </tr>`;
    }).join("");
  },

  getStatusBadge(s) {
    if (String(s.di_kirim) === 'true') return `<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 border border-green-200">Sudah Kirim</span>`;
    if (String(s.siap_kirim) === 'true') return `<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">Siap Kirim</span>`;
    if (String(s.di_warna) === 'true') return `<span class="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800 border border-orange-200">Di Warna</span>`;
    if (String(s.di_produksi) === 'true') return `<span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 border border-blue-200">Di Produksi</span>`;
    return `<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 border border-red-200">Belum Mulai</span>`;
  },

  updateStatus(msg) {
    const el = document.getElementById("dashboard-status-message");
    if (el) el.textContent = msg;
  }
};



// ======================================================
// 📦 WORK ORDERS PAGE (CLEAN VIEW, BACKEND FIELDS KEPT, SHEETS-STYLE COPY/PASTE)
// ======================================================
App.pages["work-orders"] = {
  state: {
    table: null,
    currentData: [],
    isSaving: false,
    currentMonth: null,
    currentYear: null,
    pendingSaves: new Map(),
    isLoading: false
  },
  elements: {},

  // 🔹 Inisialisasi halaman
  init() {
    console.log("🚀 Work Orders INIT Started");

    // Ambil elemen penting
    this.elements = {
      monthFilter: document.getElementById("wo-month-filter"),
      yearFilter: document.getElementById("wo-year-filter"),
      filterBtn: document.getElementById("filter-wo-btn"),
      gridContainer: document.getElementById("workorders-grid"),
      status: document.getElementById("wo-status")
    };

    // Insert Export Button if not found
    if (!document.getElementById('export-wo-btn')) {
      const filterContainer = this.elements.filterBtn ? this.elements.filterBtn.parentElement : null;
      if (filterContainer) {
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-wo-btn';
        exportBtn.className = 'bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition flex items-center ml-2';
        exportBtn.innerHTML = '📊 Export Excel';
        filterContainer.appendChild(exportBtn);

        exportBtn.addEventListener('click', () => {
          this.exportData();
        });
      }
    }

    console.log("🔍 Elements found:", this.elements);

    if (!this.elements.gridContainer) {
      console.error("❌ workorders-grid container not found!");
      this.showError("Container tabel tidak ditemukan!");
      return;
    }

    // 📱 Mobile Check
    if (window.innerWidth < 768) {
      this.elements.gridContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 mt-8">
          <div class="text-6xl mb-4">🖥️</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Mode Desktop Diperlukan</h3>
          <p class="text-gray-600 max-w-sm">Halaman Work Orders memiliki tabel data yang kompleks dan hanya dioptimalkan untuk tampilan desktop.</p>
        </div>
      `;
      // Hide controls if needed or just return
      if (this.elements.filterBtn) this.elements.filterBtn.parentElement.style.display = 'none'; // Hide filter bar
      return;
    }

    // Jalankan setup filter dan event
    this.setupDateFilters();
    this.setupEventListeners();
    this.setupSocketListeners();

    // Muat data awal otomatis
    this.loadDataByFilter();
  },

  setupSocketListeners() {
    if (App.state.socket) {
      App.state.socket.on("wo_updated", (data) => this.handleRealTimeUpdate(data));
      App.state.socket.on("wo_created", (data) => this.handleRealTimeNewData(data));
      console.log("🔌 Work Orders socket listeners attached");
    }
  },

  handleRealTimeUpdate(data) {
    if (!this.state.table) return;
    const row = this.state.table.getRow(data.id);
    if (row) {
      // Transform boolean strings if necessary
      const updateData = {
        ...data,
        di_produksi: String(data.di_produksi) === "true",
        di_warna: String(data.di_warna) === "true",
        siap_kirim: String(data.siap_kirim) === "true",
        di_kirim: String(data.di_kirim) === "true"
      };
      row.update(updateData);
      // Visual flash
      row.getElement().classList.add("bg-green-100");
      setTimeout(() => row.getElement().classList.remove("bg-green-100"), 1000);
    }
  },

  handleRealTimeNewData(data) {
    // Optional: Add new row if it matches current filter
    if (this.state.table) {
      this.state.table.addRow(data, true); // Add to top
    }
  },

  // 🔹 Setup dropdown bulan dan tahun
  setupDateFilters() {
    try {
      console.log("📅 Setting up date filters...");

      if (!this.elements.monthFilter || !this.elements.yearFilter) {
        console.error("❌ Filter elements not found");
        return;
      }

      // Reset isi dropdown
      this.elements.monthFilter.innerHTML = '';
      this.elements.yearFilter.innerHTML = '';

      // Daftar bulan
      const bulanNama = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];

      for (let i = 1; i <= 12; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = bulanNama[i - 1];
        this.elements.monthFilter.appendChild(opt);
      }

      // Tahun dari 2020 - tahun depan
      const currentYear = new Date().getFullYear();
      for (let y = 2020; y <= currentYear + 1; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        this.elements.yearFilter.appendChild(opt);
      }

      // Set default ke bulan & tahun sekarang
      const currentMonth = new Date().getMonth() + 1;
      this.elements.monthFilter.value = currentMonth;
      this.elements.yearFilter.value = currentYear;

      this.state.currentMonth = currentMonth;
      this.state.currentYear = currentYear;

      console.log("✅ Date filters setup complete:", { month: currentMonth, year: currentYear });

    } catch (err) {
      console.error("❌ Error setting up date filters:", err);
    }
  },

  // 🔹 Event listener untuk filter
  setupEventListeners() {
    this.elements.filterBtn.addEventListener("click", () => {
      console.log("🔘 Filter button clicked");
      this.loadDataByFilter();
    });

    if (this.elements.yearFilter) {
      this.elements.yearFilter.addEventListener("change", (e) => {
        const newYear = e.target.value;
        console.log("🔄 Work Orders - Year changed to:", newYear);
        this.state.currentYear = newYear;
        this.loadDataByFilter();
      });
    }

    if (this.elements.monthFilter) {
      this.elements.monthFilter.addEventListener("change", (e) => {
        const newMonth = e.target.value;
        console.log("🔄 Work Orders - Month changed to:", newMonth);
        this.state.currentMonth = newMonth;
        this.loadDataByFilter();
      });
    }

    console.log("✅ Event listeners setup complete");
  },

  // ======================================================
  // 📦 DATA LOADER + TABULATOR SETUP - CLEAN VIEW
  // ======================================================

  loadDataByFilter: async function () {
    if (this.state.isLoading) return;

    const month = this.state.currentMonth;
    const year = this.state.currentYear;

    if (!month || !year) {
      this.updateStatus("❌ Pilih bulan dan tahun terlebih dahulu");
      return;
    }

    try {
      this.state.isLoading = true;
      this.updateStatus(`⏳ Memuat data untuk ${month} -${year}...`);
      console.log(`📥 Loading chunk data for: ${month} -${year} `);

      const size = 10000;
      const page = 1;
      const res = await App.api.request(
        `/api/workorders/chunk?month=${month}&year=${year}&page=${page}&size=${size}`
      );

      const rows = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];

      console.log("📦 Data dari server:", rows.length, "baris");

      if (Array.isArray(rows) && rows.length > 0) {
        const loaded = rows.map((item, index) => ({

          // keep all backend fields in data model (so PATCH/POST still send price-related fields)
          id: item.id,
          row_num: index + 1,
          selected: false,
          tanggal: item.tanggal || new Date().toISOString().split("T")[0],
          nama_customer: item.nama_customer || "",
          deskripsi: item.deskripsi || "",
          ukuran: item.ukuran || "",
          qty: item.qty || "",
          // Harga & payment fields kept in data but not shown in UI
          harga: item.harga ?? null,
          dp_amount: item.dp_amount ?? 0,
          discount: item.discount ?? 0,
          di_produksi: item.di_produksi ?? "false",
          di_warna: item.di_warna ?? "false",
          siap_kirim: item.siap_kirim ?? "false",
          di_kirim: item.di_kirim ?? "false",
          pembayaran: item.pembayaran ?? "false",
          no_inv: item.no_inv || "",
          ekspedisi: item.ekspedisi || "",
          bulan: parseInt(month),
          tahun: parseInt(year),
        }));

        const needed = 10000 - loaded.length;
        if (needed > 0) {
          console.log(`🆕 Menambah ${needed} baris kosong`);
          for (let i = 0; i < needed; i++) {
            loaded.push({
              id: `temp - ${month} -${year} -${loaded.length + 1} `,
              row_num: loaded.length + 1,
              selected: false,
              tanggal: new Date().toISOString().split("T")[0],
              nama_customer: "",
              deskripsi: "",
              ukuran: "",
              qty: "",
              harga: null,
              dp_amount: 0,
              discount: 0,
              di_produksi: "false",
              di_warna: "false",
              siap_kirim: "false",
              di_kirim: "false",
              pembayaran: "false",
              no_inv: "",
              ekspedisi: "",
              bulan: parseInt(month),
              tahun: parseInt(year),
            });
          }
        }

        // 🔥 SORT TANGGAL ASC (1 → 31)
        loaded.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        // update row_num after sorting so numbering follows the view
        loaded.forEach((r, i) => { r.row_num = i + 1; });

        this.state.currentData = loaded;
        this.initializeTabulator();

        this.updateStatus(
          `✅ Tabel dimuat total ${loaded.length} baris(${rows.length} dari DB, ${needed} kosong baru)`
        );
      } else {
        console.log("🆕 Tidak ada data, membuat tabel kosong...");
        this.generateEmptyRowsForMonth(month, year);
        this.updateStatus(
          `📄 Bulan ${month} -${year} belum memiliki data — tabel kosong(10.000 baris) disiapkan.`
        );
      }
    } catch (err) {
      console.error("❌ Load data error:", err);
      this.generateEmptyRowsForMonth(month, year);
      this.updateStatus(
        `⚠️ Gagal memuat data dari server — tabel kosong disiapkan untuk ${month} -${year} `
      );
    } finally {
      this.state.isLoading = false;
    }
  },

  generateEmptyRowsForMonth: function (month, year) {
    console.log(`🔄 Membuat 10.000 baris kosong untuk ${month} -${year} `);
    const currentDate = new Date().toISOString().split("T")[0];
    this.state.currentData = [];

    for (let i = 0; i < 10000; i++) {
      this.state.currentData.push({
        id: `temp - ${month} -${year} -${i + 1} `,
        row_num: i + 1,
        selected: false,
        tanggal: currentDate,
        nama_customer: "",
        deskripsi: "",
        ukuran: "",
        qty: "",
        harga: null,
        dp_amount: 0,
        discount: 0,
        di_produksi: "false",
        di_warna: "false",
        siap_kirim: "false",
        di_kirim: "false",
        pembayaran: "false",
        no_inv: "",
        ekspedisi: "",
        bulan: parseInt(month),
        tahun: parseInt(year),
      });
    }

    // After setting currentData to empty rows (or initial load), initialize Tabulator
    this.initializeTabulator();

  },

  exportData() {
    if (!this.state.table) return;

    const fileName = `WorkOrders_${this.state.currentMonth}-${this.state.currentYear}.xlsx`;

    // Filter out empty temp rows
    this.state.table.download("xlsx", fileName, {
      sheetName: "Work Orders",
    });

    App.ui.showToast("Mengunduh Excel...", "success");
  },


  // ======================================================
  // 🧱 TABULATOR SETUP (CLEAN VIEW) + GOOGLE SHEETS COPY/PASTE + DRAG-FILL + TOUCH SUPPORT
  // ======================================================
  initializeTabulator() {
    console.log("🎯 Initializing Tabulator with", this.state.currentData.length, "rows");

    if (!this.elements.gridContainer) {
      console.error("❌ Grid container tidak ditemukan");
      return;
    }

    if (this.state.table) {
      try {
        this.state.table.destroy();
      } catch (e) {
        console.warn("⚠️ Error destroying previous table:", e);
      }
    }

    const self = this;
    this.elements.gridContainer.innerHTML = "";

    // 🔹 Variabel global drag state
    let dragFillActive = false;
    let dragStartCell = null;
    let scrollInterval = null;

    // ============================================================== //
    // 🔥 INIT TABULATOR
    // ============================================================== //
    this.state.table = new Tabulator(this.elements.gridContainer, {
      data: this.state.currentData,
      layout: "fitColumns",
      height: "70vh",
      responsiveLayout: "hide",
      addRowPos: "bottom",

      clipboard: true,
      clipboardCopyStyled: false,
      clipboardPasteParser: "table",
      clipboardPasteAction: "range", // Sheets-like paste
      clipboardCopyFormatter: "plain",
      clipboardCopySelector: "active",
      clipboardPasteSelector: "active",
      history: true,

      // ⌨️ SPREADSHEET BEHAVIOR
      selectable: true,
      selectableRangeMode: "click",
      editTriggerEvent: "dblclick", // Double click to edit

      // Navigate like Excel/Sheets
      keyboardNavigation: true, // Enable standard arrows
      keybindings: {
        "navUp": ["38", "shift+13"], // ArrowUp, Shift+Enter
        "navDown": ["40", "13"],     // ArrowDown, Enter
        "navLeft": "37",
        "navRight": "39",
        "navNext": "9", // Tab
        "navPrev": "shift+9", // Shift+Tab
      },

      virtualDom: true,
      index: "id",

      columns: [
        { title: "#", field: "row_num", width: 70, hozAlign: "center", formatter: "rownum", headerSort: false, frozen: true },
        {
          title: "Tanggal", field: "tanggal", width: 120, editor: "input",
          editorParams: { elementAttributes: { type: "date" } },
          formatter: (cell) => {
            const v = cell.getValue();
            if (!v) return "-";
            try { return new Date(v).toLocaleDateString("id-ID"); } catch { return v; }
          },
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "tanggal"),
        },
        { title: "Customer *", field: "nama_customer", width: 180, editor: "input", cellEdited: (c) => self.handleCellEdit(c.getRow(), "nama_customer") },
        { title: "Deskripsi *", field: "deskripsi", width: 250, editor: "input", cellEdited: (c) => self.handleCellEdit(c.getRow(), "deskripsi") },
        { title: "Ukuran", field: "ukuran", width: 90, hozAlign: "center", editor: "input", cellEdited: (c) => self.handleCellEdit(c.getRow(), "ukuran") },
        { title: "Qty", field: "qty", width: 80, hozAlign: "center", editor: "number", cellEdited: (c) => self.handleCellEdit(c.getRow(), "qty") },
        {
          title: "Status", field: "di_produksi", width: 120, hozAlign: "center",
          formatter: (cell) => {
            const d = cell.getRow().getData();
            if (String(d.di_kirim) === "true") return "✅ Terkirim";
            if (String(d.siap_kirim) === "true") return "📦 Siap Kirim";
            if (String(d.di_warna) === "true") return "🎨 Di Warna";
            if (String(d.di_produksi) === "true") return "⚙️ Produksi";
            return "⏳ Menunggu";
          },
        },
        { title: "No. Inv", field: "no_inv", width: 120, editor: "input", cellEdited: (c) => self.handleCellEdit(c.getRow(), "no_inv") },
        { title: "Ekspedisi", field: "ekspedisi", width: 120, editor: "input", cellEdited: (c) => self.handleCellEdit(c.getRow(), "ekspedisi") },
      ],

      // ============================================================== //
      // 🔹 CLIPBOARD / COPY PASTE
      // ============================================================== //
      clipboardPasted: function (clipboard, rows) {
        try {
          console.log("📥 clipboardPasted:", clipboard, rows);
          setTimeout(() => {
            const fieldsToTrigger = ["tanggal", "nama_customer", "deskripsi", "ukuran", "qty", "no_inv", "ekspedisi"];
            rows.forEach((rowComp) => {
              const row = (typeof rowComp.getData === "function") ? rowComp : self.state.table.getRow(rowComp.id);
              if (!row) return;
              fieldsToTrigger.forEach((f) => self.handleCellEdit(row, f));
            });
            self.updateStatus("✅ Paste berhasil — menyimpan otomatis");
          }, 350);
        } catch (err) {
          console.warn("⚠️ clipboardPasted handler error:", err);
        }
      },

      rowFormatter: function (row) {
        const data = row.getData();
        const dp = parseFloat(data.dp_amount) || 0;
        const discount = parseFloat(data.discount) || 0;
        row.getElement().style.backgroundColor = (dp > 0 || discount > 0) ? '#f8fbff' : '';
      },

      clipboardCopied: (data, rows) => console.log(`📋 ${rows.length} baris disalin ke clipboard`),
      clipboardPastedFailure: (err) => self.updateStatus("❌ Paste gagal: " + (err?.message || "format tidak cocok")),
    });

    console.log("✅ Tabulator initialized successfully (dengan drag-fill)");

    // =====================================================
    // 🧮 DRAG-FILL MOUSE + AUTO-SCROLL
    // =====================================================
    const tableEl = self.elements.gridContainer.querySelector(".tabulator-tableholder");

    this.state.table.on("cellMouseDown", function (e, cell) {
      const { offsetX, offsetY } = e;
      const w = cell.getElement().offsetWidth;
      const h = cell.getElement().offsetHeight;
      if (offsetX > w - 10 && offsetY > h - 10) {
        dragStartCell = cell;
        dragFillActive = true;
        document.body.classList.add("dragging");
        cell.getElement().classList.add("drag-active");
      }
    });

    this.state.table.on("cellMouseOver", function (e, cell) {
      if (!dragFillActive || !dragStartCell) return;
      const startRow = dragStartCell.getRow().getPosition();
      const endRow = cell.getRow().getPosition();
      const field = dragStartCell.getColumn().getField();
      const value = dragStartCell.getValue();
      const min = Math.min(startRow, endRow);
      const max = Math.max(startRow, endRow);
      for (let i = min + 1; i <= max; i++) {
        const row = self.state.table.getRowFromPosition(i);
        if (row) row.update({ [field]: value });
      }

      const rect = tableEl.getBoundingClientRect();
      if (e.clientY > rect.bottom - 40) {
        if (!scrollInterval) scrollInterval = setInterval(() => (tableEl.scrollTop += 20), 50);
      } else if (e.clientY < rect.top + 40) {
        if (!scrollInterval) scrollInterval = setInterval(() => (tableEl.scrollTop -= 20), 50);
      } else {
        clearInterval(scrollInterval);
        scrollInterval = null;
      }
    });

    document.addEventListener("mouseup", () => {
      if (dragFillActive) {
        dragFillActive = false;
        document.body.classList.remove("dragging");
        if (scrollInterval) clearInterval(scrollInterval);
        scrollInterval = null;
        if (dragStartCell) dragStartCell.getElement().classList.remove("drag-active");
        dragStartCell = null;
        self.updateStatus("✅ Isi otomatis selesai (drag-fill)");
      }
    });

    // =====================================================
    // 📱 TOUCH SUPPORT UNTUK TABLET
    // =====================================================
    let touchStartCell = null;
    let touchActive = false;
    let touchScrollInterval = null;

    this.state.table.on("cellTouchStart", function (e, cell) {
      const touch = e.touches?.[0];
      if (!touch) return;
      const rect = cell.getElement().getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (x > rect.width - 20 && y > rect.height - 20) {
        touchStartCell = cell;
        touchActive = true;
        document.body.classList.add("dragging");
        cell.getElement().classList.add("drag-active");
        e.preventDefault();
      }
    });

    this.state.table.on("cellTouchMove", function (e, cell) {
      if (!touchActive || !touchStartCell) return;
      const touch = e.touches?.[0];
      if (!touch) return;
      const field = touchStartCell.getColumn().getField();
      const value = touchStartCell.getValue();
      const startPos = touchStartCell.getRow().getPosition();
      const endPos = cell.getRow().getPosition();
      const min = Math.min(startPos, endPos);
      const max = Math.max(startPos, endPos);

      for (let i = min + 1; i <= max; i++) {
        const r = self.state.table.getRowFromPosition(i);
        if (r) r.update({ [field]: value });
      }

      const rect = tableEl.getBoundingClientRect();
      if (touch.clientY > rect.bottom - 40) {
        if (!touchScrollInterval)
          touchScrollInterval = setInterval(() => (tableEl.scrollTop += 20), 50);
      } else if (touch.clientY < rect.top + 40) {
        if (!touchScrollInterval)
          touchScrollInterval = setInterval(() => (tableEl.scrollTop -= 20), 50);
      } else {
        clearInterval(touchScrollInterval);
        touchScrollInterval = null;
      }
      e.preventDefault();
    });

    document.addEventListener("touchend", () => {
      if (touchActive) {
        touchActive = false;
        document.body.classList.remove("dragging");
        if (touchScrollInterval) clearInterval(touchScrollInterval);
        touchScrollInterval = null;
        if (touchStartCell) touchStartCell.getElement().classList.remove("drag-active");
        touchStartCell = null;
        self.updateStatus("✅ Isi otomatis (drag sentuh) selesai");
      }
    });

    // =====================================================
    // 🎯 NAVIGASI PANAH ← ↑ ↓ → (tanpa Tab)
    // =====================================================
    this.state.table.on("cellKeyDown", function (e, cell) {
      const colIndex = cell.getColumn().getPosition();
      const rowIndex = cell.getRow().getPosition();
      let nextCell = null;

      if (e.key === "ArrowRight") nextCell = self.state.table.getRowFromPosition(rowIndex)?.getCellFromPosition(colIndex + 1);
      else if (e.key === "ArrowLeft") nextCell = self.state.table.getRowFromPosition(rowIndex)?.getCellFromPosition(colIndex - 1);
      else if (e.key === "ArrowDown") nextCell = self.state.table.getRowFromPosition(rowIndex + 1)?.getCellFromPosition(colIndex);
      else if (e.key === "ArrowUp") nextCell = self.state.table.getRowFromPosition(rowIndex - 1)?.getCellFromPosition(colIndex);

      if (nextCell) {
        e.preventDefault();
        nextCell.navigate();
        nextCell.getElement().scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  },



  // ======================================================
  // 💾 HANDLE EDIT, AUTO SAVE, CREATE & DELETE ROW - (keamanan payload tetap ada)
  // ======================================================
  async handleCellEdit(row, fieldName) {
    if (this.state.isSaving) {
      console.log("⏳ Menyimpan data lain, tunggu sebentar...");
      return;
    }

    let rowData = row.getData();
    let rowId = rowData.id;
    const value = rowData[fieldName];

    console.log(`💾 Saving ${fieldName}: `, value, "for row:", rowId);

    // 🗓️ Auto isi tanggal jika kosong ketika customer diisi
    if (fieldName === "nama_customer" && (!rowData.tanggal || rowData.tanggal === "")) {
      const today = new Date().toISOString().split("T")[0];
      row.update({ tanggal: today });
      console.log(`🗓️ Auto isi tanggal: ${today} `);
    }

    // ⚙️ Jika ID masih temp (belum tersimpan di DB)
    if (!rowId || String(rowId).startsWith("temp")) {
      console.warn("⚙️ Row baru, membuat data dulu di server...");
      try {
        this.state.isSaving = true;
        const created = await this.createNewRow(row);
        if (!created || !created.id) throw new Error("Gagal mendapatkan ID dari server");

        row.update({ id: created.id });
        rowId = created.id;
        console.log("✅ Row baru dibuat dengan ID:", rowId);

        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error("❌ Gagal membuat row baru:", err);
        this.updateStatus("❌ Gagal membuat data baru sebelum menyimpan perubahan");
        this.state.isSaving = false;
        return;
      } finally {
        this.state.isSaving = false;
      }
    }

    // 🔄 Debounce auto save (delay 1.2 detik)
    const saveKey = `${rowId} -${fieldName} `;
    if (this.state.pendingSaves.has(saveKey)) {
      clearTimeout(this.state.pendingSaves.get(saveKey));
    }

    const saveTimeout = setTimeout(async () => {
      try {
        this.state.isSaving = true;
        this.updateStatus(`💾 Menyimpan ${fieldName}...`);

        const payload = {
          [fieldName]: value,
          bulan: parseInt(this.state.currentMonth),
          tahun: parseInt(this.state.currentYear),
        };

        // Handle boolean fields
        if (
          fieldName.includes("di_") ||
          fieldName.includes("siap_") ||
          fieldName === "pembayaran"
        ) {
          payload[fieldName] = value === true ? "true" : "false";
        }

        // ✅ Keep numeric handling for backend fields (harga, dp_amount, discount etc.)
        if (["dp_amount", "discount", "harga", "qty", "ukuran"].includes(fieldName)) {
          if (value === "" || value === null || value === undefined) {
            payload[fieldName] = null;
          } else {
            payload[fieldName] = isNaN(Number(value)) ? null : Number(value);
          }
        }

        console.log(`📤 PATCH payload for ${fieldName}: `, payload);

        await App.api.request(`/ workorders / ${rowId} `, {
          method: "PATCH",
          body: payload,
        });

        console.log(`✅ ${fieldName} tersimpan ke server`);
        this.updateStatus(`✅ ${fieldName} tersimpan`);

        // Refresh view
        row.reformat();

      } catch (err) {
        console.error(`❌ Error saving ${fieldName}: `, err);
        this.updateStatus(`❌ ${err.message || "Gagal menyimpan perubahan"} `);
      } finally {
        this.state.isSaving = false;
        this.state.pendingSaves.delete(saveKey);
      }
    }, 1200); // ⏱️ Delay 1.2 detik

    this.state.pendingSaves.set(saveKey, saveTimeout);
  },

  // ======================================================
  // 🧩 CREATE NEW ROW - KEEP DP & DISCOUNT fields in payload
  // ======================================================
  async createNewRow(row) {
    const rowData = row.getData();

    if (!rowData.nama_customer?.trim() || !rowData.deskripsi?.trim()) {
      this.updateStatus("❌ Isi nama customer & deskripsi dulu sebelum buat data baru.");
      throw new Error("Nama customer & deskripsi wajib diisi");
    }

    try {
      this.updateStatus("💾 Membuat data baru di server...");
      const socketId = App.state.socket?.id || null;
      const safeNum = (val) =>
        val === "" || val === undefined || isNaN(Number(val)) ? null : Number(val);

      const payload = {
        tanggal: rowData.tanggal || new Date().toISOString().split("T")[0],
        nama_customer: rowData.nama_customer.trim(),
        deskripsi: rowData.deskripsi.trim(),
        ukuran: safeNum(rowData.ukuran),
        qty: safeNum(rowData.qty),
        harga: safeNum(rowData.harga),
        dp_amount: safeNum(rowData.dp_amount),
        discount: safeNum(rowData.discount),
        di_produksi: rowData.di_produksi === true ? "true" : "false",
        di_warna: rowData.di_warna === true ? "true" : "false",
        siap_kirim: rowData.siap_kirim === true ? "true" : "false",
        di_kirim: rowData.di_kirim === true ? "true" : "false",
        pembayaran: rowData.pembayaran === true ? "true" : "false",
        no_inv: rowData.no_inv || "",
        ekspedisi: rowData.ekspedisi || "",
        bulan: parseInt(this.state.currentMonth),
        tahun: parseInt(this.state.currentYear),
        socketId,
      };

      console.log("📤 POST new row (payload kept same):", payload);

      const response = await App.api.request("/workorders", {
        method: "POST",
        body: payload,
      });

      if (!response || !response.id) {
        console.error("❌ Server tidak mengembalikan ID:", response);
        throw new Error("Server tidak memberikan ID");
      }

      row.update({ id: response.id });
      console.log("✅ New row created with ID:", response.id);
      this.updateStatus("✅ Data baru berhasil dibuat");

      return response;
    } catch (err) {
      console.error("❌ Error createNewRow:", err);
      this.updateStatus("❌ Gagal membuat data baru di server");
      throw err;
    }
  },

  // ======================================================
  // 🗑️ DELETE ROW
  // ======================================================
  async deleteRow(rowId) {
    try {
      await App.api.request(`/ workorders / ${rowId} `, { method: "DELETE" });
      console.log("✅ Row deleted:", rowId);
      this.updateStatus("✅ Data dihapus");
    } catch (err) {
      console.error("❌ Error deleting row:", err);
      this.updateStatus("❌ Gagal menghapus data");
    }
  },

  // ======================================================
  // ⚡ SOCKET.IO REALTIME HANDLER (KEEP BEHAVIOR)
  // ======================================================
  addRowRealtime(newRow) {
    if (!this.state.table) return;

    // keep dp & discount in model but add row visually in clean view
    const formattedRow = {
      ...newRow,
      dp_amount: newRow.dp_amount || 0,
      discount: newRow.discount || 0
    };

    this.state.table.addRow(formattedRow, true);
    const rowEl = this.state.table.getRow(newRow.id)?.getElement();
    if (rowEl) {
      rowEl.style.backgroundColor = "#dcfce7";
      setTimeout(() => (rowEl.style.backgroundColor = ""), 1500);
    }
    console.log("✅ Realtime row ditambahkan (clean view):", formattedRow);
  },

  updateRowRealtime(updatedRow) {
    if (!this.state.table) return;
    const existingRow = this.state.table.getRow(updatedRow.id);
    if (existingRow) {
      const formattedData = {
        ...updatedRow,
        dp_amount: updatedRow.dp_amount || 0,
        discount: updatedRow.discount || 0
      };
      existingRow.update(formattedData);
      existingRow.reformat();
      console.log("🔄 Row diperbarui realtime:", updatedRow.id);
    }
  },

  deleteRowRealtime(rowId) {
    if (!this.state.table) return;
    const existingRow = this.state.table.getRow(rowId);
    if (existingRow) {
      existingRow.delete();
      console.log("🗑️ Row dihapus realtime:", rowId);
    }
  },

  // ======================================================
  // 🧭 STATUS BAR HELPER
  // ======================================================
  updateStatus(message) {
    if (this.elements.status) {
      this.elements.status.textContent = message;
      if (message.includes("❌"))
        this.elements.status.className = "text-red-600 font-medium";
      else if (message.includes("✅"))
        this.elements.status.className = "text-green-600 font-medium";
      else if (message.includes("💾") || message.includes("⏳"))
        this.elements.status.className = "text-blue-600 font-medium";
      else this.elements.status.className = "text-gray-600";
    }
  },

  // ✅ METHOD BARU: Validasi DP & Diskon (backend rules tetap)
  validatePayment(rowData) {
    const ukuran = parseFloat(rowData.ukuran) || 0;
    const qty = parseFloat(rowData.qty) || 0;
    const harga = parseFloat(rowData.harga) || 0;
    const discount = parseFloat(rowData.discount) || 0;
    const dp = parseFloat(rowData.dp_amount) || 0;

    const subtotal = ukuran * qty * harga;
    const total = subtotal - discount;

    if (discount > subtotal) {
      return { valid: false, message: "Diskon tidak boleh melebihi subtotal" };
    }

    if (dp > total) {
      return { valid: false, message: "DP tidak boleh melebihi total setelah diskon" };
    }

    return { valid: true };
  }
};



// ======================================================
// 📊 STATUS BARANG PAGE (NEW IMPLEMENTATION)
// ======================================================
App.pages["status-barang"] = {
  state: {
    table: null,
    currentData: [],
    currentMonth: null,
    currentYear: null,
    isLoading: false,
    colorPickerRow: null,
    currentViewMode: localStorage.getItem('statusViewMode') || 'detail' // 'detail' or 'simple'
  },

  elements: {},

  init() {
    console.log("📊 Status Barang INIT Started");

    this.elements = {
      monthFilter: document.getElementById("status-month-filter"),
      yearFilter: document.getElementById("status-year-filter"),
      customerFilter: document.getElementById("status-customer-filter"),
      filterBtn: document.getElementById("filter-status-btn"),
      gridContainer: document.getElementById("statusbarang-grid"),
      loadingOverlay: document.getElementById("loading-overlay"),
      statusIndicator: document.getElementById("status-update-indicator")
    };

    if (!this.elements.gridContainer) {
      console.error("❌ statusbarang-grid container not found!");
      return;
    }

    // 📱 Mobile Check
    if (window.innerWidth < 768) {
      this.elements.gridContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 mt-8">
          <div class="text-6xl mb-4">🖥️</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">Mode Desktop Diperlukan</h3>
          <p class="text-gray-600 max-w-sm">Halaman Status Barang memiliki tabel interaktif yang hanya dioptimalkan untuk tampilan desktop.</p>
        </div>
      `;
      // Hide controls
      if (this.elements.filterBtn) this.elements.filterBtn.parentElement.style.display = 'none';
      return;
    }

    this.setupDateFilters();
    this.setupEventListeners();
    this.updateViewModeUI(); // Update buttons styles
    this.loadData();
  },

  setViewMode(mode) {
    this.state.currentViewMode = mode;
    localStorage.setItem('statusViewMode', mode);
    this.updateViewModeUI();

    // 🔥 FORCE RE-RENDER: Destroy table so columns are rebuilt with new visibility
    if (this.state.table) {
      this.state.table.destroy();
      this.state.table = null;
    }

    if (this.state.currentData.length > 0) {
      this.renderTable(this.state.currentData);
    }
  },

  updateViewModeUI() {
    const btnDetail = document.getElementById('view-mode-detail');
    const btnSimple = document.getElementById('view-mode-simple');
    if (!btnDetail || !btnSimple) return;

    if (this.state.currentViewMode === 'detail') {
      btnDetail.className = "px-3 py-1 rounded transition-colors bg-[#A67B5B] text-white shadow-sm";
      btnSimple.className = "px-3 py-1 rounded transition-colors text-gray-600 hover:bg-gray-200";
    } else {
      btnSimple.className = "px-3 py-1 rounded transition-colors bg-[#A67B5B] text-white shadow-sm";
      btnDetail.className = "px-3 py-1 rounded transition-colors text-gray-600 hover:bg-gray-200";
    }
  },

  setupDateFilters() {
    if (!this.elements.monthFilter || !this.elements.yearFilter) return;

    this.elements.monthFilter.innerHTML = "";
    this.elements.yearFilter.innerHTML = "";

    const bulanNama = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = bulanNama[i - 1];
      this.elements.monthFilter.appendChild(opt);
    }

    const currentYear = new Date().getFullYear();
    for (let y = 2020; y <= currentYear + 1; y++) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      this.elements.yearFilter.appendChild(opt);
    }

    // Set default values
    const now = new Date();
    this.elements.monthFilter.value = now.getMonth() + 1;
    this.elements.yearFilter.value = now.getFullYear();

    this.state.currentMonth = now.getMonth() + 1;
    this.state.currentYear = now.getFullYear();
  },

  setupEventListeners() {
    if (this.elements.filterBtn) {
      this.elements.filterBtn.addEventListener("click", () => {
        this.state.currentMonth = this.elements.monthFilter.value;
        this.state.currentYear = this.elements.yearFilter.value;
        this.loadData();
      });
    }

    // ✅ View Mode Toggles
    const btnDetail = document.getElementById("view-mode-detail");
    const btnSimple = document.getElementById("view-mode-simple");

    console.log("🛠️ Setup Event Listeners: ", { btnDetail, btnSimple });

    if (btnDetail) {
      btnDetail.onclick = () => { // Use onclick direct property to avoid dupes/issues
        console.log("🔘 Clicked Full View");
        this.setViewMode('detail');
      };
    }
    if (btnSimple) {
      btnSimple.onclick = () => {
        console.log("🔘 Clicked Simple View");
        this.setViewMode('simple');
      };
    }



    // Auto load on enter in customer filter
    if (this.elements.customerFilter) {
      this.elements.customerFilter.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.loadData();
      });
    }
  },

  async loadData() {
    const month = this.elements.monthFilter.value;
    const year = this.elements.yearFilter.value;
    const customer = this.elements.customerFilter.value;

    this.setLoading(true);

    try {
      let url = `/api/status-barang?month=${month}&year=${year}`;
      if (customer) url += `&customer=${encodeURIComponent(customer)}`;

      console.log("🔍 Fetching Status Barang:", url);
      const data = await App.api.request(url);

      console.log("✅ Data Loaded:", data.length, "rows");
      this.state.currentData = data;
      this.renderTable(data);

    } catch (err) {
      console.error("❌ Error loading status barang:", err);
      App.ui.showToast("Gagal memuat data", "error");
    } finally {
      this.setLoading(false);
    }
  },

  setLoading(isLoading) {
    if (this.elements.loadingOverlay) {
      if (isLoading) this.elements.loadingOverlay.classList.remove("hidden");
      else this.elements.loadingOverlay.classList.add("hidden");
    }
  },

  renderTable(data) {
    if (this.state.table) {
      this.state.table.replaceData(data);
      return;
    }

    this.state.table = new Tabulator(this.elements.gridContainer, {
      data: data,
      // layout: "fitColumns", // Removed to allow horizontal scrolling
      height: "75vh", // Slightly taller to maximize screen usage
      placeholder: "Tidak ada data",
      index: "id",
      columns: [
        { title: "#", formatter: "rownum", width: 40, hozAlign: "center", frozen: true },
        // Color Marker Column
        {
          title: "🎨", field: "color_marker", width: 40, hozAlign: "center", headerSort: false,
          formatter: (cell) => {
            const color = cell.getValue() || "#ffffff";
            return `<div class="color-marker" style="background-color: ${color};" onclick="window.openColorPicker(${cell.getRow().getData().id})"></div>`;
          }
        },
        {
          title: "Tanggal", field: "tanggal", width: 90, formatter: (cell) => {
            const val = cell.getValue();
            return val ? App.ui.formatDate(val) : "-";
          }
        },
        { title: "Customer", field: "nama_customer", width: 120, headerFilter: "input" }, // Added filter
        { title: "Deskripsi", field: "deskripsi", widthGrow: 2, formatter: "textarea" }, // Flexible width
        { title: "Ukuran", field: "ukuran", width: 70, hozAlign: "center" },
        { title: "Qty", field: "qty", width: 50, hozAlign: "center" },

        // --- COLUMNS CONTROLLED BY VIEW MODE ---
        // Finance Columns (Hidden in Simple Mode)
        { title: "Harga", field: "harga", width: 100, visible: this.state.currentViewMode === 'detail', formatter: "money", formatterParams: { symbol: "Rp ", thousand: ".", precision: 0 } },
        { title: "DP", field: "dp", width: 100, visible: this.state.currentViewMode === 'detail', formatter: "money", formatterParams: { symbol: "Rp ", thousand: ".", precision: 0 } },
        { title: "Diskon", field: "discount", width: 80, visible: this.state.currentViewMode === 'detail', formatter: "money", formatterParams: { symbol: "Rp ", thousand: ".", precision: 0 } },
        { title: "Total", field: "total", width: 100, visible: this.state.currentViewMode === 'detail', formatter: "money", formatterParams: { symbol: "Rp ", thousand: ".", precision: 0 } },
        { title: "No Inv", field: "no_inv", width: 80, visible: this.state.currentViewMode === 'detail', editor: "input", cellEdited: (c) => this.updateField(c) },

        // Production Columns (Hidden in Simple Mode)
        { title: "Produksi", field: "di_produksi", width: 70, visible: this.state.currentViewMode === 'detail', hozAlign: "center", formatter: (c) => this.checkboxFormatter(c, "di_produksi"), cellClick: (e, c) => this.toggleStatus(c, "di_produksi") },
        { title: "Warna", field: "di_warna", width: 70, visible: this.state.currentViewMode === 'detail', hozAlign: "center", formatter: (c) => this.checkboxFormatter(c, "di_warna"), cellClick: (e, c) => this.toggleStatus(c, "di_warna") },

        // Shipping Columns
        { title: "Siap", field: "siap_kirim", width: 60, hozAlign: "center", formatter: (c) => this.checkboxFormatter(c, "siap_kirim"), cellClick: (e, c) => this.toggleStatus(c, "siap_kirim") },
        { title: "Kirim", field: "di_kirim", width: 60, hozAlign: "center", formatter: (c) => this.checkboxFormatter(c, "di_kirim"), cellClick: (e, c) => this.toggleStatus(c, "di_kirim") },

        { title: "Ekspedisi", field: "ekspedisi", width: 100, editor: "input", cellEdited: (c) => this.updateField(c) },
      ],
      rowFormatter: (row) => {
        const data = row.getData();
        if (data.color_marker && data.color_marker !== "#ffffff") {
          row.getElement().style.backgroundColor = data.color_marker;
        }
      }
    });
  },

  checkboxFormatter(cell, field) {
    const value = cell.getValue();
    const isChecked = value === "true" || value === true;
    return `<input type="checkbox" class="status-checkbox accent-[#A67B5B] w-4 h-4" ${isChecked ? "checked" : ""}>`;
  },

  async toggleStatus(cell, field) {
    const row = cell.getRow();
    const data = row.getData();
    // Toggle Logic
    const currentVal = data[field] === "true" || data[field] === true;
    const newVal = !currentVal;

    // Optimistic Update
    row.update({ [field]: newVal ? "true" : "false" });

    try {
      await App.api.request(`/workorders/${data.id}`, {
        method: "PATCH",
        body: { [field]: newVal ? "true" : "false" }
      });

      this.showUpdateIndicator();
      console.log(`✅ Status ${field} updated:`, newVal);

      // Jika perlu trigger update ke page dashboard via socket, ini sudah otomatis jika backend emit event
    } catch (err) {
      console.error("❌ Failed to update status:", err);
      // Revert
      row.update({ [field]: currentVal ? "true" : "false" });
      App.ui.showToast("Gagal update status", "error");
    }
  },

  async updateField(cell) {
    const field = cell.getField();
    const value = cell.getValue();
    const id = cell.getRow().getData().id;

    try {
      await App.api.request(`/workorders/${id}`, {
        method: "PATCH",
        body: { [field]: value }
      });
      this.showUpdateIndicator();
    } catch (err) {
      console.error("Update failed", err);
      App.ui.showToast("Gagal update", "error");
    }
  },

  showUpdateIndicator() {
    if (this.elements.statusIndicator) {
      this.elements.statusIndicator.classList.remove("opacity-0");
      setTimeout(() => {
        this.elements.statusIndicator.classList.add("opacity-0");
      }, 2000);
    }
  },

  // Color Picker Helper Methods (called from global scope defined in HTML)
  setRowColor(row, color) {
    row.update({ color_marker: color });

    // Save handling (assuming we have a color_marker field in DB or just local preference? 
    // User request implies persistent data, but schema inspection didn't show color_marker column.
    // If column doesn't exist, this might just be visual for session or need schema update.
    // For now, assume we try to save if schema allows, or just visual.)
    // Checking endpoint /api/status-barang query... SELECT doesn't show color_marker. 
    // So this might be a custom field or missing from backend. 
    // I will implement saving attempt but suppress error if field missing.

    // Update: User asked to fix "realtime data stored in menu status barang".
    // Assuming existing backend is fine. I'll focus on just restoring funcionality.
    // Persisting color might not be supported by backend yet if column missing.
    // I'll skip API call for color for now to prevent errors unless I see 'color_marker' in schema.
    // Wait, 'color-marker' class is in CSS. Let's assume we just handle visual for now unless user asks.
  },

  clearRowColor(row) {
    row.update({ color_marker: "#ffffff" });
  }

};

// ======================================================
// 🧾 INVOICE PAGE - MANAGEMENT & PRINT INVOICE
// ======================================================
App.pages["invoice"] = {
  state: {
    currentMonth: null,
    currentYear: null,
    currentInvoiceData: null,
    summaryData: null
  },
  elements: {},

  init() {
    console.log("🧾 Invoice Page INIT");

    // Initialize elements
    this.elements = {
      // Filter elements
      monthFilter: document.getElementById("invoice-month-filter"),
      yearFilter: document.getElementById("invoice-year-filter"),
      filterBtn: document.getElementById("filter-invoice-summary-btn"),

      // Search elements
      searchInput: document.getElementById("invoice-search-input"),
      searchBtn: document.getElementById("invoice-search-btn"),
      catatanInput: document.getElementById("invoice-catatan"),
      printBtn: document.getElementById("invoice-print-btn"),

      // Summary cards
      totalCard: document.getElementById("total-invoice-card"),
      paidCard: document.getElementById("paid-invoice-card"),
      unpaidCard: document.getElementById("unpaid-invoice-card"),

      // Print area
      printArea: document.getElementById("invoice-print-area")
    };

    console.log("🔍 Invoice elements found:", Object.keys(this.elements).filter(key => this.elements[key]));

    // Setup date filters
    this.setupDateFilters();

    // Setup event listeners
    this.setupEventListeners();

    this.setupPaymentInputListeners();

    // ✅ TAMBAHKAN: Real-time listener untuk pembayaran dari Status Barang
    this.setupRealtimeListeners();

    // Load initial data
    this.loadInvoiceSummary();
  },

  handleRealtimeUpdate(data) {
    // Update summary data
    this.state.summaryData = data;

    // Update UI summary
    this.renderSummary(data);

    // Jika sedang melihat invoice yang sama, refresh juga
    if (this.state.currentInvoiceData) {
      const currentInvoiceNo = this.elements.searchInput?.value.trim();
      if (currentInvoiceNo) {
        this.refreshCurrentInvoice(currentInvoiceNo);
      }
    }

    App.ui.showToast("Data pembayaran diperbarui", "success");
  },

  // ✅ TAMBAHKAN: Refresh current invoice data
  async refreshCurrentInvoice(invoiceNo) {
    try {
      const result = await App.api.request(`/ invoice - search / ${invoiceNo} `);
      if (result && result.length > 0) {
        // Ambil nilai DP & Diskon terbaru dari input
        const dpAmount = document.getElementById('dp-amount')?.value || 0;
        const discount = document.getElementById('discount')?.value || 0;
        const discountPercentage = document.getElementById('discount-percentage')?.value || 0;

        const updatedWorkOrders = result.map(wo => ({
          ...wo,
          dp_amount: parseFloat(dpAmount) || 0,
          discount: this.calculateDiscount(wo, discount, discountPercentage)
        }));

        this.state.currentInvoiceData = updatedWorkOrders;
        this.generateInvoicePreview(updatedWorkOrders, invoiceNo);

        console.log('🔄 Current invoice refreshed with latest payment data');
      }
    } catch (err) {
      console.error('❌ Error refreshing current invoice:', err);
    }
  },

  // ✅ TAMBAHKAN: Setup real-time listeners
  setupRealtimeListeners() {
    if (typeof io !== 'undefined') {
      io.on('invoice:summary-updated', (data) => {
        console.log('💰 Real-time invoice update received:', data);
        this.handleRealtimeUpdate(data);
      });
    }
  },

  setupDateFilters() {
    if (this.elements.monthFilter && this.elements.yearFilter) {
      // Clear existing options
      this.elements.monthFilter.innerHTML = '';
      this.elements.yearFilter.innerHTML = '';

      // Add months
      const bulanNama = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];

      for (let i = 1; i <= 12; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = bulanNama[i - 1];
        this.elements.monthFilter.appendChild(opt);
      }

      // Add years
      const currentYear = new Date().getFullYear();
      for (let y = 2020; y <= currentYear + 1; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        this.elements.yearFilter.appendChild(opt);
      }

      // Set default to current month/year
      const currentMonth = new Date().getMonth() + 1;
      this.elements.monthFilter.value = currentMonth;
      this.elements.yearFilter.value = currentYear;

      this.state.currentMonth = currentMonth;
      this.state.currentYear = currentYear;
    }
  },

  setupEventListeners() {
    // Filter button
    this.elements.filterBtn?.addEventListener("click", () => this.loadInvoiceSummary());

    // Search button
    this.elements.searchBtn?.addEventListener("click", () => this.searchInvoice());

    // Enter key in search input
    this.elements.searchInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.searchInvoice();
    });

    // Print button
    this.elements.printBtn?.addEventListener("click", () => this.printInvoice());

    // Auto filter when month/year changes
    if (this.elements.monthFilter) {
      this.elements.monthFilter.addEventListener("change", (e) => {
        this.state.currentMonth = e.target.value;
        console.log("🧾 Invoice - Month changed:", this.state.currentMonth);
        this.loadInvoiceSummary();
      });
    }

    if (this.elements.yearFilter) {
      this.elements.yearFilter.addEventListener("change", (e) => {
        this.state.currentYear = e.target.value;
        console.log("🧾 Invoice - Year changed:", this.state.currentYear);
        this.loadInvoiceSummary();
      });
    }
  },

  setupPaymentInputListeners() {
    const dpInput = document.getElementById('dp-amount');
    const discountInput = document.getElementById('discount');
    const discountPercentageInput = document.getElementById('discount-percentage');

    if (dpInput) {
      dpInput.addEventListener('input', (e) => {
        if (e.target.value < 0) e.target.value = 0;
        console.log(`💰 DP updated: ${e.target.value} `);
      });
    }

    if (discountInput) {
      discountInput.addEventListener('input', (e) => {
        if (e.target.value < 0) e.target.value = 0;
        console.log(`💸 Discount updated: ${e.target.value} `);

        // Nonaktifkan persentase jika nominal diisi
        if (e.target.value > 0 && discountPercentageInput) {
          discountPercentageInput.value = '0';
        }
      });
    }

    if (discountPercentageInput) {
      discountPercentageInput.addEventListener('input', (e) => {
        if (e.target.value < 0) e.target.value = 0;
        if (e.target.value > 100) e.target.value = 100;
        console.log(`📊 Discount % updated: ${e.target.value} `);

        // Nonaktifkan nominal jika persentase diisi
        if (e.target.value > 0 && discountInput) {
          discountInput.value = '0';
        }
      });
    }
  },

  async loadInvoiceSummary() {
    try {
      const month = this.state.currentMonth;
      const year = this.state.currentYear;

      if (!month || !year) {
        console.warn("❌ Month or year not set");
        return;
      }

      console.log(`📊 Loading invoice summary for: ${month} -${year} `);

      // ✅ PERBAIKI PATH: tambahkan /api/
      const summary = await App.api.request(`/ api / invoices / summary ? month = ${month}& year=${year} `);
      this.state.summaryData = summary;

      this.renderSummary(summary);

    } catch (err) {
      console.error("❌ Error loading invoice summary:", err);
      this.renderSummaryError();
    }
  },

  renderSummary(summary) {
    if (!summary) return;

    console.log('📈 Rendering invoice summary:', summary);

    // Update summary cards
    if (this.elements.totalCard) {
      this.elements.totalCard.querySelector('p').textContent = App.ui.formatRupiah(summary.total_invoice || 0);
    }

    if (this.elements.paidCard) {
      this.elements.paidCard.querySelector('p').textContent = App.ui.formatRupiah(summary.total_paid || 0);
    }

    if (this.elements.unpaidCard) {
      this.elements.unpaidCard.querySelector('p').textContent = App.ui.formatRupiah(summary.total_unpaid || 0);
    }

    // ✅ TAMPILKAN DEBUG INFO JIKA ADA
    if (summary._debug) {
      console.log('🐛 Debug Info:', summary._debug);

      // Tampilkan info debug di console atau UI
      const debugInfo = `
      Total Records: ${summary._debug.total_records}
      With Invoice: ${summary._debug.records_with_invoice}
Month: ${summary._debug.query_month}
Year: ${summary._debug.query_year}
`;
      console.log('🔍 Debug Analysis:', debugInfo);
    }
  },

  updatePaymentProgress(summary) {
    const total = summary.total_invoice || summary.total || 0;
    const paid = summary.total_paid || summary.paid || 0;

    if (total > 0) {
      const percentage = (paid / total) * 100;

      // Update progress bar jika ada
      const progressBar = document.getElementById('payment-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${percentage}% `;
        progressBar.textContent = `${percentage.toFixed(1)}% `;
      }

      // Update status text
      const statusEl = document.getElementById('payment-status-text');
      if (statusEl) {
        if (percentage >= 100) {
          statusEl.textContent = 'LUNAS 100%';
          statusEl.className = 'text-green-600 font-bold';
        } else if (percentage > 0) {
          statusEl.textContent = `SEBAGIAN(${percentage.toFixed(1)} %)`;
          statusEl.className = 'text-orange-600 font-bold';
        } else {
          statusEl.textContent = 'BELUM BAYAR';
          statusEl.className = 'text-red-600 font-bold';
        }
      }
    }
  },

  renderSummaryError() {
    const errorText = "Error memuat data";

    if (this.elements.totalCard) {
      this.elements.totalCard.querySelector('p').textContent = errorText;
    }
    if (this.elements.paidCard) {
      this.elements.paidCard.querySelector('p').textContent = errorText;
    }
    if (this.elements.unpaidCard) {
      this.elements.unpaidCard.querySelector('p').textContent = errorText;
    }
  },

  async searchInvoice() {
    const invoiceNo = this.elements.searchInput?.value.trim();

    // AMBIL NILAI DP & DISKON DARI INPUT FIELD
    const dpAmount = document.getElementById('dp-amount')?.value || 0;
    const discount = document.getElementById('discount')?.value || 0;
    const discountPercentage = document.getElementById('discount-percentage')?.value || 0;

    if (!invoiceNo) {
      App.ui.showToast("Masukkan nomor invoice terlebih dahulu", "error");
      return;
    }

    try {
      console.log(`🔍 Searching invoice: ${invoiceNo} `);
      console.log(`💰 DP dari input: ${dpAmount} `);
      console.log(`💸 Diskon nominal: ${discount} `);
      console.log(`📊 Diskon persentase: ${discountPercentage} `);

      // ✅ PERBAIKI PATH: tambahkan /api/
      const result = await App.api.request(`/ api / invoice - search / ${invoiceNo} `);

      if (result && result.length > 0) {
        // ✅ TERAPKAN DP & DISKON KE WORK ORDERS
        const updatedWorkOrders = result.map(wo => ({
          ...wo,
          dp_amount: parseFloat(dpAmount) || 0, // GUNAKAN DP DARI INPUT
          discount: this.calculateDiscount(wo, discount, discountPercentage) // HITUNG DISKON
        }));

        console.log(`✅ Work orders setelah update: `, updatedWorkOrders[0]?.dp_amount);

        this.state.currentInvoiceData = updatedWorkOrders;
        this.generateInvoicePreview(updatedWorkOrders, invoiceNo);
        this.elements.printBtn.disabled = false;
        App.ui.showToast(`Invoice ${invoiceNo} ditemukan`, "success");

        // ✅ TAMBAHKAN: Simpan data untuk real-time updates
        this.state.currentInvoiceNo = invoiceNo;

      } else {
        this.elements.printArea.innerHTML = `
  < div class="text-center text-red-500 py-8" >
    <p>Invoice <strong>${invoiceNo}</strong> tidak ditemukan</p>
          </div >
  `;
        this.elements.printBtn.disabled = true;
        App.ui.showToast("Invoice tidak ditemukan", "error");
      }
    } catch (err) {
      console.error("❌ Error searching invoice:", err);
      this.elements.printArea.innerHTML = `
  < div class="text-center text-red-500 py-8" >
    <p>Error: ${err.message}</p>
        </div >
  `;
      this.elements.printBtn.disabled = true;
      App.ui.showToast("Gagal mencari invoice", "error");
    }
  },

  setupPaymentInputListeners() {
    const dpInput = document.getElementById('dp-amount');
    const discountInput = document.getElementById('discount');
    const discountPercentageInput = document.getElementById('discount-percentage');

    if (dpInput) {
      dpInput.addEventListener('input', (e) => {
        if (e.target.value < 0) e.target.value = 0;
        console.log(`💰 DP updated: ${e.target.value} `);
        // ✅ AUTO-APPLY ke invoice preview
        this.applyPaymentUpdates();
      });
    }

    if (discountInput) {
      discountInput.addEventListener('input', (e) => {
        if (e.target.value < 0) e.target.value = 0;
        console.log(`💸 Discount updated: ${e.target.value} `);

        // Nonaktifkan persentase jika nominal diisi
        if (e.target.value > 0 && discountPercentageInput) {
          discountPercentageInput.value = '0';
        }

        // ✅ AUTO-APPLY ke invoice preview
        this.applyPaymentUpdates();
      });
    }

    if (discountPercentageInput) {
      discountPercentageInput.addEventListener('input', (e) => {
        if (e.target.value < 0) e.target.value = 0;
        if (e.target.value > 100) e.target.value = 100;
        console.log(`📊 Discount % updated: ${e.target.value} `);

        // Nonaktifkan nominal jika persentase diisi
        if (e.target.value > 0 && discountInput) {
          discountInput.value = '0';
        }

        // ✅ AUTO-APPLY ke invoice preview
        this.applyPaymentUpdates();
      });
    }
  },

  applyPaymentUpdates() {
    if (!this.state.currentInvoiceData || !this.state.currentInvoiceNo) return;

    const dpAmount = document.getElementById('dp-amount')?.value || 0;
    const discount = document.getElementById('discount')?.value || 0;
    const discountPercentage = document.getElementById('discount-percentage')?.value || 0;

    const updatedWorkOrders = this.state.currentInvoiceData.map(wo => ({
      ...wo,
      dp_amount: parseFloat(dpAmount) || 0,
      discount: this.calculateDiscount(wo, discount, discountPercentage)
    }));

    this.state.currentInvoiceData = updatedWorkOrders;
    this.generateInvoicePreview(updatedWorkOrders, this.state.currentInvoiceNo);

    console.log('🔄 Payment updates applied to current invoice');
  },




  // Helper function untuk kalkulasi diskon - TAMBAHKAN INI
  calculateDiscount(workOrder, discountNominal, discountPercentage) {
    const ukuran = parseFloat(workOrder.ukuran) || 0;
    const qty = parseFloat(workOrder.qty) || 0;
    const harga = parseFloat(workOrder.harga) || 0;
    const subtotal = ukuran * qty * harga;

    let discount = 0;

    // Prioritaskan diskon persentase jika ada
    if (discountPercentage > 0) {
      discount = (subtotal * discountPercentage) / 100;
    }
    // Jika tidak ada persentase, gunakan diskon nominal
    else if (discountNominal > 0) {
      discount = parseFloat(discountNominal);
    }

    return discount;
  },

  generateInvoicePreview(workOrders, invoiceNo) {
    if (!this.elements.printArea) return;

    const today = new Date().toLocaleDateString('id-ID');
    const catatan = this.elements.catatanInput?.value || '';
    const totalItems = workOrders.length;

    // Calculate totals dengan DP & Diskon
    let totalQty = 0;
    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalDP = 0; // DP AKAN DIAMBIL DARI workOrders YANG SUDAH DIUPDATE
    let grandTotal = 0;
    let remainingPayment = 0;

    workOrders.forEach(wo => {
      const ukuran = parseFloat(wo.ukuran) || 0;
      const qty = parseFloat(wo.qty) || 0;
      const harga = parseFloat(wo.harga) || 0;
      const discount = parseFloat(wo.discount) || 0;
      const dp = parseFloat(wo.dp_amount) || 0; // INI SUDAH MENGANDUNG DP DARI INPUT

      const subtotal = ukuran * qty * harga;
      const totalAfterDiscount = subtotal - discount;

      totalQty += qty;
      totalSubtotal += subtotal;
      totalDiscount += discount;
      totalDP += dp; // TOTAL DP DIHITUNG DARI SEMUA WORK ORDERS
      grandTotal += totalAfterDiscount;
    });

    remainingPayment = grandTotal - totalDP;

    // Debug informasi
    console.log(`🧮 Invoice Calculation: `);
    console.log(`- Subtotal: ${totalSubtotal} `);
    console.log(`- Discount: ${totalDiscount} `);
    console.log(`- Grand Total: ${grandTotal} `);
    console.log(`- Total DP: ${totalDP} `);
    console.log(`- Remaining: ${remainingPayment} `);

    this.elements.printArea.innerHTML = `
    <div class="max-w-4xl mx-auto bg-white p-8" id="invoice-print-content">
      <!-- Header Section -->
      <div class="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
         <div class="w-1/2">
            <h1 class="text-4xl font-bold text-gray-800 tracking-tight">INVOICE</h1>
            <p class="text-gray-500 mt-1 font-medium text-sm">#${invoiceNo}</p>
         </div>
         <div class="text-right w-1/2">
            <h2 class="text-xl font-bold text-gray-800">CV. TOTO ALUMINIUM MANUFACTURE</h2>
            <p class="text-gray-600 text-sm mt-1">Jl. Rawa Mulya, Kota Bekasi</p>
            <p class="text-gray-600 text-sm">Telp: 0813 1191 2002</p>
         </div>
      </div>

      <!-- Detail Info -->
      <div class="flex justify-between mb-10">
        <div class="w-1/2 pr-4">
           <h3 class="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Ditagihkan Kepada:</h3>
           <div class="text-gray-800 font-semibold text-lg">${workOrders[0]?.nama_customer || '-'}</div>
           <div class="text-gray-600 text-sm mt-1">Customer ID: ${workOrders[0]?.id ? `CUST-${workOrders[0].id}` : '-'}</div>
        </div>
        <div class="w-1/2 pl-4 text-right">
           <div class="flex justify-end mb-2">
              <div class="text-gray-500 text-sm font-medium mr-4">Tanggal Invoice:</div>
              <div class="text-gray-800 text-sm font-bold">${today}</div>
           </div>
           <div class="flex justify-end mb-2">
              <div class="text-gray-500 text-sm font-medium mr-4">Total Item:</div>
              <div class="text-gray-800 text-sm font-bold">${totalItems}</div>
           </div>
           <div class="flex justify-end">
              <div class="text-gray-500 text-sm font-medium mr-4">Status Pembayaran:</div>
              <div class="text-sm font-bold px-2 py-0.5 rounded ${remainingPayment <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                 ${remainingPayment <= 0 ? 'LUNAS' : 'BELUM BAYAR'}
              </div>
           </div>
        </div>
      </div>

      <!-- Table Section -->
      <div class="mb-8">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-gray-800 text-white text-sm uppercase tracking-wider">
              <th class="p-3 text-left w-12 rounded-tl-md">No</th>
              <th class="p-3 text-left">Deskripsi</th>
              <th class="p-3 text-center w-20">Ukuran</th>
              <th class="p-3 text-center w-16">Qty</th>
              <th class="p-3 text-right w-32">Harga</th>
              <th class="p-3 text-right w-32">Subtotal</th>
              <th class="p-3 text-right w-24">Diskon</th>
              <th class="p-3 text-right w-32 rounded-tr-md">Total</th>
            </tr>
          </thead>
          <tbody class="text-sm text-gray-700">
            ${workOrders.map((wo, index) => {
      const ukuran = parseFloat(wo.ukuran) || 0;
      const qty = parseFloat(wo.qty) || 0;
      const harga = parseFloat(wo.harga) || 0;
      const discount = parseFloat(wo.discount) || 0;
      const subtotal = ukuran * qty * harga;
      const totalAfterDiscount = subtotal - discount;

      const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

      return `
                <tr class="${rowClass} border-b border-gray-200">
                  <td class="p-3 text-center text-gray-500">${index + 1}</td>
                  <td class="p-3 font-medium">${wo.deskripsi || '-'}</td>
                  <td class="p-3 text-center">${wo.ukuran || '-'}</td>
                  <td class="p-3 text-center font-bold">${wo.qty || '-'}</td>
                  <td class="p-3 text-right">${App.ui.formatRupiah(harga)}</td>
                  <td class="p-3 text-right text-gray-500">${App.ui.formatRupiah(subtotal)}</td>
                  <td class="p-3 text-right text-red-500">${discount > 0 ? '-' + App.ui.formatRupiah(discount) : '-'}</td>
                  <td class="p-3 text-right font-bold text-gray-900">${App.ui.formatRupiah(totalAfterDiscount)}</td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Totals & Notes Section -->
      <div class="flex justify-between items-start border-t-2 border-gray-800 pt-6">
         <!-- Notes & Bank Info -->
         <div class="w-1/2 pr-8">
            <h4 class="text-sm font-bold text-gray-800 mb-2">Info Pembayaran:</h4>
            <div class="bg-gray-50 p-3 rounded border border-gray-200 text-sm text-gray-600 space-y-1">
               <div class="flex justify-between">
                 <span>Bank BCA (Toto):</span>
                 <span class="font-bold text-gray-800">123-456-7890</span>
               </div>
               <div class="flex justify-between">
                 <span>Bank BCA (Yanto):</span>
                 <span class="font-bold text-gray-800">098-765-4321</span>
               </div>
            </div>
            <div class="mt-4 text-xs text-gray-500 italic">
               Note: ${catatan ? catatan : 'Terima kasih atas kepercayaan Anda.'}
            </div>
         </div>

         <!-- Summary Totals -->
         <div class="w-1/2 pl-8">
            <div class="space-y-3">
               <div class="flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span class="font-medium">${App.ui.formatRupiah(totalSubtotal)}</span>
               </div>
               <div class="flex justify-between text-sm text-red-600">
                  <span>Total Diskon:</span>
                  <span>-${App.ui.formatRupiah(totalDiscount)}</span>
               </div>
               <div class="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-2 mt-2">
                  <span>Grand Total:</span>
                  <span>${App.ui.formatRupiah(grandTotal)}</span>
               </div>
               <div class="flex justify-between text-sm text-blue-600 mt-2">
                  <span>Total DP:</span>
                  <span>-${App.ui.formatRupiah(totalDP)}</span>
               </div>
               <div class="flex justify-between text-lg font-bold text-gray-800 bg-gray-100 p-2 rounded mt-2">
                  <span>Sisa Tagihan:</span>
                  <span class="${remainingPayment > 0 ? 'text-red-600' : 'text-green-600'}">${App.ui.formatRupiah(remainingPayment)}</span>
               </div>
            </div>
         </div>
      </div>

      <!-- Signature -->
      <div class="mt-16 flex justify-end">
         <div class="text-center w-48">
            <p class="text-sm text-gray-500 mb-16">Bekasi, ${today}</p>
            <p class="text-sm font-bold text-gray-800 border-t border-gray-400 pt-2">CV. TOTO ALUMINIUM</p>
         </div>
      </div>
    </div>`;
  },

  printInvoice() {
    if (!this.state.currentInvoiceData) {
      App.ui.showToast("Tidak ada data invoice untuk dicetak", "error");
      return;
    }

    const printStyles = `
  < style >
  @media print {
      body {
    -webkit - print - color - adjust: exact;
    print - color - adjust: exact;
    margin: 0;
    padding: 0;
    background: #f5ebdd;
  }

  #sj - customer - print - content {
    visibility: visible!important;
    position: absolute;
    left: 1.5cm;
    top: 1cm;
    right: 1.5cm;
    font - family: "Inter", Arial, sans - serif;
    font - size: 12px;
    color: #3a2d22;
    background - color: #ffffff;
    border - radius: 6px;
    box - shadow: 0 0 0.5cm rgba(0, 0, 0, 0.1);
    padding: 24px 32px;
  }

  #sj - customer - print - content h1 {
    font - size: 18px;
    color: #3a2d22;
    font - weight: bold;
    margin - bottom: 2px;
  }

  #sj - customer - print - content p {
    margin: 2px 0;
  }

  #sj - customer - print - content h2 {
    font - size: 14px;
    font - weight: bold;
    color: #4a3a2d;
    margin - top: 10px;
    margin - bottom: 6px;
    border - bottom: 1px solid #4a3a2d;
    display: inline - block;
    padding - bottom: 2px;
  }

      table {
    width: 100 %;
    border - collapse: collapse;
    margin - top: 8px;
    font - size: 11px;
    color: #2f1e10;
  }

      th {
    background - color: #f5ebdd!important;
    color: #3a2d22;
    font - weight: bold;
    border: 1px solid #bfa98a;
    padding: 5px 6px;
  }

      td {
    border: 1px solid #d4bfa3;
    padding: 5px 6px;
  }

      .text - center {
    text - align: center;
  }

      .text - right {
    text - align: right;
  }

      .font - bold {
    font - weight: 600;
  }

      .signature {
    display: flex;
    justify - content: space - between;
    margin - top: 36px;
    font - size: 12px;
  }

      .signature div {
    width: 45 %;
    text - align: center;
  }

      .signature p {
    margin: 4px 0;
  }

      .signature.line {
    border - top: 1px solid #3a2d22;
    margin - top: 36px;
    padding - top: 4px;
  }

  @page {
    size: A4;
    margin: 1cm;
  }

  body *: not(#sj - customer - print - content): not(#sj - customer - print - content *) {
    visibility: hidden!important;
  }
}
  </style >
  `;


    App.ui.printElement("invoice-print-content", printStyles);
  }
};



// ======================================================
// 📦 STATUS BARANG PAGE - REAL-TIME AUTO SAVE & UPDATE
// ======================================================
App.pages["status-barang"] = {
  state: {
    table: null,
    currentData: [],
    isSaving: false,
    currentMonth: null,
    currentYear: null,
    pendingSaves: new Map(),
    colorMarkers: new Map(),
    customerSearchTimeout: null,
    lastUpdateTime: null
  },
  elements: {},

  // =========================================================
  // INIT
  // =========================================================
  init() {
    console.log("🚀 Status Barang INIT Started");

    this.elements = {
      monthFilter: document.getElementById("status-month-filter"),
      yearFilter: document.getElementById("status-year-filter"),
      customerInput: document.getElementById("status-customer-filter"),
      filterBtn: document.getElementById("filter-status-btn"),
      gridContainer: document.getElementById("statusbarang-grid"),
      status: document.getElementById("status-update-indicator")
    };

    if (!this.elements.gridContainer) {
      console.error("❌ statusbarang-grid container not found!");
      return;
    }

    // set filters
    if (this.elements.monthFilter && this.elements.yearFilter) {
      App.ui.populateDateFilters(
        this.elements.monthFilter,
        this.elements.yearFilter
      );
      // Fix visibility issue
      this.elements.monthFilter.classList.add('text-gray-900');
      this.elements.yearFilter.classList.add('text-gray-900');

      this.state.currentMonth = this.elements.monthFilter.value;
      this.state.currentYear = this.elements.yearFilter.value;
    }

    this.loadColorMarkers();
    this.setupEventListeners();
    this.setupSocketListeners();
    this.loadData();
  },

  // =========================================================
  // EVENT LISTENER
  // =========================================================
  setupEventListeners() {
    this.elements.filterBtn?.addEventListener("click", () => this.loadData());

    this.elements.monthFilter?.addEventListener("change", (e) => {
      this.state.currentMonth = e.target.value;
      this.loadData();
    });

    this.elements.yearFilter?.addEventListener("change", (e) => {
      this.state.currentYear = e.target.value;
      this.loadData();
    });

    // Search customer filter
    this.elements.customerInput?.addEventListener("input", () => {
      clearTimeout(this.state.customerSearchTimeout);
      this.state.customerSearchTimeout = setTimeout(() => this.loadData(), 500);
    });
  },

  // =========================================================
  // SOCKET.IO
  // =========================================================
  setupSocketListeners() {
    if (!App.state.socket) return;

    const socket = App.state.socket;

    socket.on("wo_updated", (data) => this.handleRealTimeUpdate(data));
    socket.on("wo_created", (data) => this.handleRealTimeNewData(data));
  },

  // =========================================================
  // LOAD DATA
  // =========================================================
  async loadData() {
    try {
      const month = this.state.currentMonth;
      const year = this.state.currentYear;
      const customer = this.elements.customerInput?.value.trim() || "";

      if (!month || !year) return;

      this.updateStatus("⏳ Memuat data...");

      const res = await App.api.request(
        `/api/status-barang?month=${month}&year=${year}&customer=${encodeURIComponent(customer)}`
      );


      this.state.currentData = res.map((item, index) => ({
        ...item,
        row_num: index + 1,
        di_produksi: item.di_produksi == true || item.di_produksi == "true",
        di_warna: item.di_warna == true || item.di_warna == "true",
        siap_kirim: item.siap_kirim == true || item.siap_kirim == "true",
        di_kirim: item.di_kirim == true || item.di_kirim == "true",
        pembayaran: item.pembayaran == true || item.pembayaran == "true"
      }));

      // Sort tanggal ASC
      this.state.currentData.sort(
        (a, b) => new Date(a.tanggal) - new Date(b.tanggal)
      );

      this.initializeTabulator();
      this.updateStatus(`✅ Data dimuat: ${res.length} items`);
    } catch (err) {
      console.error(err);
      this.updateStatus("❌ Gagal memuat data");
    }
  },

  // =========================================================
  // TABULATOR TABLE
  // =========================================================
  // =========================================================
  // 🧱 TABULATOR TABLE — STATUS BARANG (FREEZE HEADER + SMOOTH SCROLL)
  // =========================================================
  initializeTabulator() {
    if (!this.elements.gridContainer) return;

    if (this.state.table) {
      try {
        this.state.table.destroy();
      } catch (e) { }
    }

    const self = this;
    this.elements.gridContainer.innerHTML = "";

    // Buat kontainer scrollable agar freeze header & kolom berfungsi mulus
    this.elements.gridContainer.style.overflow = "auto";
    this.elements.gridContainer.style.maxHeight = "75vh";
    this.elements.gridContainer.style.border = "1px solid #e5e7eb";
    this.elements.gridContainer.style.borderRadius = "8px";

    this.state.table = new Tabulator(this.elements.gridContainer, {
      data: this.state.currentData,
      layout: "fitDataFill",
      height: "75vh",
      rowHeight: 35,
      clipboard: true,
      responsiveLayout: "hide",
      index: "id",

      // =======================================================
      // ⚙️ Fitur freeze header & kolom pertama
      // =======================================================
      movableColumns: true,      // kolom bisa digeser ke kiri/kanan
      columnHeaderVertAlign: "bottom",
      renderVertical: "virtual",
      renderHorizontal: "virtual",

      columns: [
        // ============================
        // FROZEN NUMBERING
        // ============================
        {
          title: "#",
          field: "row_num",
          width: 60,
          hozAlign: "center",
          formatter: "rownum",
          headerSort: false,
          frozen: true, // <== tetap muncul saat scroll horizontal
        },

        // ============================
        // TANGGAL
        // ============================
        {
          title: "Tanggal",
          field: "tanggal",
          width: 120,
          editor: "input",
          editorParams: { elementAttributes: { type: "date" } },
          formatter: (cell) => {
            const v = cell.getValue();
            return v ? App.ui.formatDate(v) : "-";
          },
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "tanggal"),
        },

        // ============================
        // CUSTOMER
        // ============================
        {
          title: "Customer",
          field: "nama_customer",
          width: 150,
          editor: "input",
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "nama_customer"),
        },

        // ============================
        // DESKRIPSI
        // ============================
        {
          title: "Deskripsi",
          field: "deskripsi",
          width: 200,
          editor: "input",
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "deskripsi"),
        },

        // ============================
        // UKURAN
        // ============================
        {
          title: "Ukuran",
          field: "ukuran",
          width: 90,
          hozAlign: "center",
          editor: "input",
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "ukuran"),
        },

        // ============================
        // QTY
        // ============================
        {
          title: "Qty",
          field: "qty",
          width: 90,
          hozAlign: "center",
          editor: "number",
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "qty"),
        },

        // ============================
        // HARGA 🚀
        // ============================
        {
          title: "Harga",
          field: "harga",
          width: 110,
          editor: "number",
          hozAlign: "right",
          formatter: (cell) =>
            cell.getValue() ? App.ui.formatRupiah(cell.getValue()) : "-",
          cellEdited: (cell) => {
            const row = cell.getRow();
            self.handleCellEdit(row, "harga");
            row.reformat();
          },
        },

        // ============================
        // DP 🚀
        // ============================
        {
          title: "DP",
          field: "dp_amount",
          width: 110,
          editor: "number",
          hozAlign: "right",
          formatter: (cell) =>
            cell.getValue() ? App.ui.formatRupiah(cell.getValue()) : "-",
          cellEdited: (cell) => {
            const row = cell.getRow();
            self.handleCellEdit(row, "dp_amount");
            row.reformat();
          },
        },

        // ============================
        // DISKON 🚀
        // ============================
        {
          title: "Diskon",
          field: "discount",
          width: 110,
          editor: "number",
          hozAlign: "right",
          formatter: (cell) =>
            cell.getValue() ? App.ui.formatRupiah(cell.getValue()) : "-",
          cellEdited: (cell) => {
            const row = cell.getRow();
            self.handleCellEdit(row, "discount");
            row.reformat();
          },
        },

        // ============================
        // TOTAL HARGA 🚀 REALTIME
        // ============================
        {
          title: "Total",
          field: "total_harga",
          width: 140,
          hozAlign: "right",
          formatter: (cell) => {
            const r = cell.getRow().getData();
            const ukuran = parseFloat(r.ukuran) || 0;
            const qty = parseFloat(r.qty) || 0;
            const harga = parseFloat(r.harga) || 0;
            const discount = parseFloat(r.discount) || 0;
            const subtotal = ukuran * qty * harga;
            const total = subtotal - discount;
            return App.ui.formatRupiah(total);
          },
        },

        // ============================
        // NO INV
        // ============================
        {
          title: "No Inv",
          field: "no_inv",
          width: 130,
          editor: "input",
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "no_inv"),
        },

        // ============================
        // CHECKBOX STATUS
        // ============================
        {
          title: "Produksi",
          field: "di_produksi",
          width: 100,
          hozAlign: "center",
          formatter: self.productionFormatter("di_produksi", "blue"),
        },
        {
          title: "Warna",
          field: "di_warna",
          width: 90,
          hozAlign: "center",
          formatter: self.checkboxFormatter("di_warna", "green"),
        },
        {
          title: "Siap Kirim",
          field: "siap_kirim",
          width: 120,
          hozAlign: "center",
          formatter: self.checkboxFormatter("siap_kirim", "yellow"),
        },
        {
          title: "Dikirim",
          field: "di_kirim",
          width: 100,
          hozAlign: "center",
          formatter: self.checkboxFormatter("di_kirim", "purple"),
        },
        {
          title: "Pembayaran",
          field: "pembayaran",
          width: 120,
          hozAlign: "center",
          formatter: self.checkboxFormatter("pembayaran", "red"),
        },

        // ============================
        // EKSPEDISI
        // ============================
        {
          title: "Ekspedisi",
          field: "ekspedisi",
          width: 120,
          editor: "input",
          cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "ekspedisi"),
        },

        // ============================
        // COLOR MARKER
        // ============================
        {
          title: "🎨",
          field: "color_marker",
          width: 60,
          hozAlign: "center",
          formatter: (cell) => {
            const rowId = cell.getRow().getData().id;
            const color = self.state.colorMarkers.get(rowId) || "#fff";
            return `<div style="width: 20px; height: 20px; border-radius: 4px; background:${color}; margin: auto; border: 1px solid #666; cursor: pointer;"></div>`;
          },
          cellClick: (e, cell) => self.openColorPicker(cell.getRow()),
        },
      ],
    });

    // =========================================================
    // 🧊 FIXED HEADER (STICKY SAAT SCROLL)
    // =========================================================
    const header = this.elements.gridContainer.querySelector(".tabulator-header");
    if (header) {
      header.style.position = "sticky";
      header.style.top = "0";
      header.style.zIndex = "20";
      header.style.background = "#fff";
      header.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";
    }

    console.log("✅ Status Barang table initialized (freeze header + frozen columns)");
  },


  // =========================================================
  // PRODUCTION FORMATTER (WITH AMBIL BAHAN BUTTON)
  // =========================================================
  productionFormatter(field, color) {
    return function (cell) {
      const v = cell.getValue();
      const row = cell.getRow().getData();
      const id = row.id;
      const checked = v === true || v === "true";

      return `
        <div class="flex items-center justify-center gap-2">
            <input type="checkbox"
            ${checked ? "checked" : ""}
            class="w-4 h-4 text-${color}-600"
            onchange="App.pages['status-barang'].handleCheckboxChange(this,'${id}','${field}')"
            >
            <button onclick="App.ambilBahan.open('${id}')" 
                    title="Input Pengambilan Bahan"
                    class="p-1 px-2 text-[10px] bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 text-gray-700">
                🛠️
            </button>
        </div>
      `;
    };
  },

  // =========================================================
  // CHECKBOX FORMATTER
  // =========================================================
  checkboxFormatter(field, color) {
    return function (cell) {
      const v = cell.getValue();
      const row = cell.getRow().getData();
      const id = row.id;
      const checked = v === true || v === "true";

      return `
        <input type="checkbox"
          ${checked ? "checked" : ""}
          class="w-4 h-4 text-${color}-600"
          onchange="App.pages['status-barang'].handleCheckboxChange(this,'${id}','${field}')"
        >
      `;
    };
  },

  // =========================================================
  // HANDLE CHECKBOX SAVE
  // =========================================================
  async handleCheckboxChange(el, id, field) {
    const value = el.checked;
    const payload = {
      [field]: value,
      bulan: parseInt(this.state.currentMonth),
      tahun: parseInt(this.state.currentYear)
    };

    // 💰 FEATURE 1: AUTO-RECORD FINANCE ON PAYMENT RECEIVED
    if (field === 'pembayaran' && value === true) {
      const item = this.state.currentData.find(i => i.id == id);
      if (item) {
        const total = item.total || 0; // Calculated in loadData
        const dp = item.dp_amount || 0;
        const sisa = total - dp;

        // Assume if marking "Paid", we are collecting the REMAINING amount
        // If Sisa is 0 (already full DP), maybe we don't record? Or record 0?
        // Let's assume we record the 'sisa'.
        const amountToRecord = sisa > 0 ? sisa : 0;

        if (amountToRecord > 0) {
          if (confirm(`Konfirmasi: Catat pemasukan pelunasan sebesar ${App.ui.formatRupiah(amountToRecord)} ke Keuangan?`)) {
            try {
              await App.api.request('/api/keuangan/transaksi', {
                method: 'POST',
                body: {
                  tanggal: new Date(),
                  jumlah: amountToRecord,
                  tipe: 'PEMASUKAN',
                  kas_id: 1, // BCA Toto Default
                  keterangan: `Pelunasan WO #${id} (${item.nama_customer})`
                }
              });
              App.ui.showToast("💰 Pemasukan tercatat di Keuangan", "success");
            } catch (e) {
              console.error("Gagal catat keuangan:", e);
              App.ui.showToast("Gagal mencatat keuangan", "error");
            }
          }
        }
      }
    }

    // 🏭 TRIGGER STOCK DEDUCTION (FEATURE 2: AMBIL BAHAN)
    if (field === 'di_produksi' && value === true) {
      if (confirm("Ambil bahan untuk WO ini sekarang?")) {
        if (App.ambilBahan) setTimeout(() => App.ambilBahan.open(id), 200);
      }
    }

    await App.api.request(`/workorders/${id}`, {
      method: "PATCH",
      body: payload
    });

    if (App.state.socket) {
      App.state.socket.emit("wo_updated", {
        id,
        ...payload,
        updated_at: new Date().toISOString()
      });
    }

    this.updateStatus(`✅ ${field} tersimpan`);
  },

  // =========================================================
  // HANDLE TEXT EDIT SAVE
  // =========================================================
  async handleCellEdit(row, field) {
    const id = row.getData().id;
    const val = row.getData()[field];

    const payload = {
      [field]: val,
      bulan: parseInt(this.state.currentMonth),
      tahun: parseInt(this.state.currentYear)
    };

    await App.api.request(`/workorders/${id}`, {
      method: "PATCH",
      body: payload
    });

    if (App.state.socket) {
      App.state.socket.emit("wo_updated", {
        id,
        ...payload,
        updated_at: new Date().toISOString()
      });
    }

    row.reformat();
    this.updateStatus(`💾 ${field} disimpan`);
  },

  // =========================================================
  // REALTIME UPDATE
  // =========================================================
  handleRealTimeUpdate(data) {
    if (!this.state.table) return;

    const row = this.state.table.getRow(data.id);
    if (!row) return;

    row.update(data);
    row.reformat();
  },

  // =========================================================
  // COLOR MARKERS
  // =========================================================
  openColorPicker(row) {
    const rowId = row.getData().id;
    const current = this.state.colorMarkers.get(rowId) || "#fff";

    const colors = [
      "#ffffff",
      "#ffebee",
      "#fff9c4",
      "#e8f5e8",
      "#e3f2fd",
      "#f3e5f5"
    ];

    const html = `
      <div id="colorpicker" style="
        position:fixed;top:50%;left:50%;
        transform:translate(-50%,-50%);
        background:#fff;padding:15px;border-radius:10px;z-index:99999;
        box-shadow:0 0 20px rgba(0,0,0,0.3);
      ">
        <div style="display:flex;gap:8px;">
          ${colors
        .map(
          (c) => `
            <div onclick="App.pages['status-barang'].setRowColor('${rowId}','${c}')"
              style="width:28px;height:28px;background:${c};border:2px solid ${c == current ? "#000" : "#ccc"
            };
              cursor:pointer;border-radius:4px;">
            </div>`
        )
        .join("")}
        </div>
        <button onclick="document.getElementById('colorpicker').remove()"
          style="margin-top:10px;padding:6px 12px;background:#333;color:#fff;border-radius:5px;">
          Tutup
        </button>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
  },

  setRowColor(id, color) {
    this.state.colorMarkers.set(id, color);
    localStorage.setItem(
      "statusBarangColorMarkers",
      JSON.stringify(Object.fromEntries(this.state.colorMarkers))
    );

    const row = this.state.table.getRow(id);
    if (row) row.reformat();

    const picker = document.getElementById("colorpicker");
    if (picker) picker.remove();
  },

  loadColorMarkers() {
    const saved = localStorage.getItem("statusBarangColorMarkers");
    if (saved) {
      this.state.colorMarkers = new Map(Object.entries(JSON.parse(saved)));
    }
  },

  // =========================================================
  // UI STATUS BAR
  // =========================================================
  updateStatus(msg) {
    if (!this.elements.status) return;
    this.elements.status.innerText = msg;

    setTimeout(() => {
      if (this.elements.status.innerText === msg) this.elements.status.innerText = "";
    }, 2000);
  }
};


// Load color markers when page loads
App.pages["status-barang"].loadColorMarkers();






// ======================================================
// 📘 APP.DATA-KARYAWAN.JS - FINAL (Add / Edit / Delete + Kasbon + History)
// ======================================================
App.pages["data-karyawan"] = {
  state: {
    data: [],
    isEditMode: false,
    currentEditId: null,
    currentKasbonId: null
  },
  elements: {},

  async init() {
    console.log("📄 Memuat halaman Data Karyawan...");

    // element refs
    this.elements = {
      tableContainer: document.getElementById("karyawan-table-body"),
      addForm: document.getElementById("karyawan-form"),
      modal: document.getElementById("karyawan-modal"),
      addBtn: document.getElementById("add-karyawan-btn"),
      cancelBtn: document.getElementById("cancel-karyawan-btn"),
      modalTitle: document.getElementById("karyawan-modal-title"),
      hiddenId: document.getElementById("karyawan-id"),
      submitBtn: document.querySelector("#karyawan-form button[type='submit']"),

      // Kasbon modal elements
      kasbonModal: document.getElementById("kasbon-modal"),
      kasbonForm: document.getElementById("kasbon-form"),
      kasbonNominal: document.getElementById("kasbon-nominal"),
      kasbonNama: document.getElementById("kasbon-nama"),
      kasbonSaveBtn: document.getElementById("kasbon-save-btn"),
      kasbonCancelBtn: document.getElementById("kasbon-cancel-btn"),
      kasbonHistoryContainer: document.getElementById("kasbon-history"),
      kasbonHistoryList: document.getElementById("kasbon-history-list")
    };

    console.log("🔍 Elements found:", Object.keys(this.elements).filter(k => this.elements[k]));

    await this.loadData();

    // events
    this.elements.addBtn?.addEventListener("click", () => this.showAddModal());
    this.elements.cancelBtn?.addEventListener("click", () => this.hideModal());
    this.elements.addForm?.addEventListener("submit", (e) => this.handleSubmit(e));

    // kasbon events
    this.elements.kasbonCancelBtn?.addEventListener("click", () => this.hideKasbonModal());
    this.elements.kasbonForm?.addEventListener("submit", (e) => this.onKasbonFormSubmit(e));

    // socket
    this.setupSocketListeners();
  },

  setupSocketListeners() {
    if (!App.state.socket) {
      console.warn("⚠️ Socket.IO belum aktif (data-karyawan)");
      return;
    }

    try {
      App.state.socket.off("karyawan:new");
      App.state.socket.off("karyawan:update");
      App.state.socket.off("karyawan:delete");
    } catch (e) { }

    App.state.socket.on("karyawan:new", (data) => {
      this.state.data.push(data);
      this.render(this.state.data);
      App.ui.showToast(`Karyawan baru: ${data.nama_karyawan}`, "success");
    });

    App.state.socket.on("karyawan:update", (data) => {
      const idx = this.state.data.findIndex(k => k.id === data.id);
      if (idx !== -1) {
        this.state.data[idx] = { ...this.state.data[idx], ...data };
      } else {
        this.state.data.push(data);
      }
      this.render(this.state.data);
    });

    App.state.socket.on("karyawan:delete", (data) => {
      this.state.data = this.state.data.filter(k => k.id !== data.id);
      this.render(this.state.data);
      App.ui.showToast("Karyawan dihapus", "warning");
    });
  },

  async loadData() {
    try {
      this.showLoading();
      const data = await App.api.request("/karyawan");
      if (!Array.isArray(data)) this.state.data = [];
      else this.state.data = data;
      this.render(this.state.data);
    } catch (err) {
      console.error("❌ Gagal memuat data karyawan:", err);
      App.ui.showToast("Gagal memuat data karyawan: " + (err.message || err), "error");
      this.render([]);
    }
  },

  showLoading() {
    if (!this.elements.tableContainer) return;
    this.elements.tableContainer.innerHTML = `<tr><td colspan="7" class="p-6 text-center">⏳ Memuat data...</td></tr>`;
  },

  render(data) {
    if (!this.elements.tableContainer) return;
    if (!data || data.length === 0) {
      this.elements.tableContainer.innerHTML = `
        <tr><td colspan="7" class="p-6 text-center text-gray-500">Belum ada data karyawan</td></tr>
      `;
      return;
    }

    this.elements.tableContainer.innerHTML = data.map(k => `
      <tr class="hover:bg-gray-50 border-b">
        <td class="px-4 py-2 font-medium">${this.escapeHtml(k.nama_karyawan || '-')}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatRupiah(k.gaji_harian || 0)}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatRupiah(k.potongan_bpjs_kesehatan || 0)}</td>
        <td class="px-4 py-2 text-right">${App.ui.formatRupiah(k.potongan_bpjs_ketenagakerjaan || 0)}</td>
        <td class="px-4 py-2 text-right font-semibold text-blue-700">${App.ui.formatRupiah(k.kasbon || 0)}</td>
        <td class="px-4 py-2 text-center space-x-2">
          <button class="px-3 py-1 rounded text-white bg-blue-600 hover:bg-blue-700"
                  onclick="App.pages['data-karyawan'].openKasbonModal(${k.id})">Kasbon</button>
          <button class="px-3 py-1 rounded text-blue-600 border border-blue-600 hover:bg-blue-50"
                  onclick="App.pages['data-karyawan'].editKaryawan(${k.id})">Edit</button>
          <button class="px-3 py-1 rounded text-red-600 border border-red-600 hover:bg-red-50"
                  onclick="App.pages['data-karyawan'].deleteKaryawan(${k.id})">Hapus</button>
        </td>
      </tr>
    `).join('');
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : text;
    return div.innerHTML;
  },

  validateForm() {
    const form = this.elements.addForm;
    if (!form) return false;
    const nama = (form.nama_karyawan?.value || '').trim();
    if (!nama) {
      App.ui.showToast("Nama karyawan wajib diisi", "error");
      return false;
    }
    return true;
  },

  getFormData() {
    const form = this.elements.addForm;
    return {
      nama_karyawan: (form.nama_karyawan?.value || '').trim(),
      gaji_harian: parseFloat(form.gaji_harian?.value || 0) || 0,
      potongan_bpjs_kesehatan: parseFloat(form.potongan_bpjs_kesehatan?.value || 0) || 0,
      potongan_bpjs_ketenagakerjaan: parseFloat(form.potongan_bpjs_ketenagakerjaan?.value || 0) || 0,
      kasbon: parseFloat(form.kasbon?.value || 0) || 0
    };
  },

  async handleSubmit(e) {
    e.preventDefault();
    if (!this.validateForm()) return;
    const data = this.getFormData();
    try {
      this.setSubmitButtonState(true);
      if (this.state.isEditMode && this.state.currentEditId) {
        await this.updateKaryawan(data);
      } else {
        await this.addKaryawan(data);
      }
      this.hideModal();
      await this.loadData();
    } catch (err) {
      console.error("❌ Gagal menyimpan karyawan:", err);
      App.ui.showToast("Gagal menyimpan karyawan: " + (err.message || err), "error");
    } finally {
      this.setSubmitButtonState(false);
    }
  },

  async addKaryawan(data) {
    const res = await App.api.request("/karyawan", { method: "POST", body: data });
    if (App.state.socket) App.state.socket.emit("karyawan:new", res);
    App.ui.showToast("Karyawan berhasil ditambahkan", "success");
    return res;
  },

  async updateKaryawan(data) {
    const id = this.state.currentEditId;
    if (!id) throw new Error("ID karyawan tidak tersedia untuk update");
    const res = await App.api.request(`/karyawan/${id}`, { method: "PUT", body: data });
    if (App.state.socket) App.state.socket.emit("karyawan:update", res);
    App.ui.showToast("Karyawan berhasil diupdate", "success");
    return res;
  },

  editKaryawan(id) {
    const karyawan = this.state.data.find(k => +k.id === +id);
    if (!karyawan) {
      App.ui.showToast("Data karyawan tidak ditemukan", "error");
      return;
    }

    this.state.isEditMode = true;
    this.state.currentEditId = id;

    const form = this.elements.addForm;
    if (!form) return;
    form.nama_karyawan.value = karyawan.nama_karyawan || "";
    form.gaji_harian.value = karyawan.gaji_harian ?? "";
    form.potongan_bpjs_kesehatan.value = karyawan.potongan_bpjs_kesehatan ?? "";
    form.potongan_bpjs_ketenagakerjaan.value = karyawan.potongan_bpjs_ketenagakerjaan ?? "";
    form.kasbon.value = karyawan.kasbon ?? "";

    if (this.elements.modalTitle) this.elements.modalTitle.textContent = "Edit Karyawan";
    if (this.elements.hiddenId) this.elements.hiddenId.value = id;
    if (this.elements.submitBtn) this.elements.submitBtn.textContent = "Update Karyawan";

    this.showModal(false);
  },

  async deleteKaryawan(id) {
    if (!confirm("Yakin ingin menghapus data karyawan ini?")) return;
    try {
      await App.api.request(`/karyawan/${id}`, { method: "DELETE" });
      this.state.data = this.state.data.filter(k => +k.id !== +id);
      this.render(this.state.data);
      if (App.state.socket) App.state.socket.emit("karyawan:delete", { id });
      App.ui.showToast("Karyawan berhasil dihapus", "warning");
    } catch (err) {
      console.error("❌ Gagal hapus karyawan:", err);
      App.ui.showToast("Gagal menghapus data karyawan: " + (err.message || err), "error");
    }
  },

  showAddModal() {
    this.state.isEditMode = false;
    this.state.currentEditId = null;
    if (this.elements.modalTitle) this.elements.modalTitle.textContent = "Tambah Karyawan";
    if (this.elements.submitBtn) this.elements.submitBtn.textContent = "Simpan";
    this.showModal(true);
  },

  showModal(resetForm = true) {
    const modal = this.elements.modal;
    if (!modal) return;
    if (resetForm) this.resetForm();
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.remove("opacity-0"), 10);
  },

  hideModal() {
    const modal = this.elements.modal;
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => {
      modal.classList.add("hidden");
      this.resetForm();
    }, 300);
  },

  resetForm() {
    if (this.elements.addForm) this.elements.addForm.reset();
    this.state.isEditMode = false;
    this.state.currentEditId = null;
    if (this.elements.hiddenId) this.elements.hiddenId.value = "";
    if (this.elements.modalTitle) this.elements.modalTitle.textContent = "Tambah Karyawan";
    if (this.elements.submitBtn) this.elements.submitBtn.textContent = "Simpan";
  },

  setSubmitButtonState(loading) {
    if (!this.elements.submitBtn) return;
    this.elements.submitBtn.disabled = !!loading;
    this.elements.submitBtn.textContent = loading ? "Menyimpan..." : (this.state.isEditMode ? "Update Karyawan" : "Simpan");
  },

  // 1) Perbaiki openKasbonModal pada App.pages['data-karyawan']
  openKasbonModal(id) {
    const karyawan = this.state.data.find(k => +k.id === +id);
    if (!karyawan) {
      App.ui.showToast("Karyawan tidak ditemukan", "error");
      return;
    }

    this.state.currentKasbonId = +id;

    // juga sinkronkan ke App.kasbon (kalau ada implementasi lain yang pakai App.kasbon.currentId)
    if (!App.kasbon) App.kasbon = {};
    App.kasbon.currentId = +id;

    if (this.elements.kasbonNama) this.elements.kasbonNama.textContent = karyawan.nama_karyawan || '-';
    if (this.elements.kasbonNominal) this.elements.kasbonNominal.value = 0;

    this.loadKasbonHistory(id);

    if (this.elements.kasbonModal) {
      this.elements.kasbonModal.classList.remove("hidden");
      setTimeout(() => this.elements.kasbonModal.classList.remove("opacity-0"), 10);
    }
  },


  async loadKasbonHistory(id) {
    try {
      if (!this.elements.kasbonHistoryList || !this.elements.kasbonHistoryContainer) return;
      this.elements.kasbonHistoryContainer.classList.add("hidden");
      this.elements.kasbonHistoryList.innerHTML = `<div class="text-sm text-gray-500">Memuat riwayat...</div>`;

      const data = await App.api.request(`/karyawan/${id}/kasbon`);
      if (!Array.isArray(data) || data.length === 0) {
        this.elements.kasbonHistoryList.innerHTML = `<p class="text-gray-500 italic">Belum ada riwayat kasbon</p>`;
        this.elements.kasbonHistoryContainer.classList.remove("hidden");
        return;
      }

      this.elements.kasbonHistoryList.innerHTML = data.map(item => {
        const tanggal = item.tanggal ? new Date(item.tanggal).toLocaleString('id-ID') : '';
        const jenis = (item.jenis || 'PINJAM').toUpperCase();
        const label = jenis === 'PINJAM' ? '💸 Pinjam' : '✅ Bayar';
        const keterangan = item.keterangan || '';
        const nominal = App.ui.formatRupiah(item.nominal || 0);
        const colorClass = jenis === 'PINJAM' ? 'text-red-600' : 'text-green-600';
        return `<div class="flex justify-between border-b py-1 text-sm">
                  <div>${tanggal} — ${label} ${keterangan ? '&middot; ' + this.escapeHtml(keterangan) : ''}</div>
                  <div class="font-mono ${colorClass}">${nominal}</div>
                </div>`;
      }).join('');

      this.elements.kasbonHistoryContainer.classList.remove("hidden");
    } catch (err) {
      console.error("❌ Gagal ambil histori kasbon:", err);
      if (this.elements.kasbonHistoryList) this.elements.kasbonHistoryList.innerHTML = `<p class="text-gray-500 italic">Gagal memuat riwayat</p>`;
      if (this.elements.kasbonHistoryContainer) this.elements.kasbonHistoryContainer.classList.remove("hidden");
    }
  },

  async onKasbonFormSubmit(e) {
    e.preventDefault();
    const id = this.state.currentKasbonId;
    if (!id) {
      App.ui.showToast("ID karyawan tidak tersedia", "error");
      return;
    }
    const nominal = parseFloat(this.elements.kasbonNominal?.value || 0);
    if (!nominal || nominal <= 0) {
      App.ui.showToast("Nominal kasbon harus lebih besar dari 0", "error");
      return;
    }

    try {
      await App.api.request(`/karyawan/${id}/kasbon`, {
        method: "POST",
        body: { nominal, keterangan: "Pinjaman kasbon via UI" }
      });

      App.ui.showToast("Kasbon berhasil ditambahkan", "success");

      await this.loadKasbonHistory(id);
      await this.loadData();

      if (App.state.socket) {
        App.state.socket.emit("karyawan:update", { id: +id });
      }
    } catch (err) {
      console.error("❌ Gagal simpan kasbon:", err);
      App.ui.showToast("Gagal menyimpan kasbon: " + (err.message || err), "error");
    }
  },

  hideKasbonModal() {
    const modal = this.elements.kasbonModal;
    if (!modal) return;
    modal.classList.add("opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 300);
  }
};


// Note: pastikan App.api.request berfungsi mengirim JSON body.
// Jika App.api.request tidak menambahkan header "Content-Type": "application/json" untuk object bodies,
// sesuaikan App.api.request atau kirim body sebagai JSON string sesuai kebutuhan.


// ======================================================
// 💰 FUNGSI KASBON - TAMBAH, HISTORI, DAN PEMBAYARAN
// ======================================================
App.kasbon = {
  async openModal(karyawan) {
    const modal = document.getElementById("kasbon-modal");
    const namaSpan = document.getElementById("kasbon-nama");
    const inputNominal = document.getElementById("kasbon-nominal");
    const historyDiv = document.getElementById("kasbon-history");
    const historyList = document.getElementById("kasbon-history-list");

    App.kasbon.currentId = karyawan.id;
    namaSpan.textContent = karyawan.nama_karyawan;
    inputNominal.value = 0;

    // Ambil histori kasbon
    try {
      const res = await App.api.request(`/api/karyawan/${karyawan.id}/kasbon`, { method: "GET" });
      historyList.innerHTML = "";

      if (res.length === 0) {
        historyDiv.classList.add("hidden");
      } else {
        historyDiv.classList.remove("hidden");
        res.forEach((item) => {
          const warna = item.jenis === "PINJAM" ? "text-red-600" : "text-green-600";
          const sign = item.jenis === "PINJAM" ? "-" : "+";
          const el = document.createElement("div");
          el.className = "flex justify-between text-sm";
          el.innerHTML = `
            <span>${item.tanggal} — ${item.keterangan}</span>
            <span class="${warna}">${sign} Rp ${Number(item.nominal).toLocaleString()}</span>
          `;
          historyList.appendChild(el);
        });
      }
    } catch (err) {
      console.error("❌ Gagal ambil histori kasbon:", err);
      historyDiv.classList.add("hidden");
    }

    modal.classList.remove("hidden");
  },

  async saveKasbon() {
    // ambil id dari beberapa sumber supaya robust
    const id = (App.kasbon && App.kasbon.currentId)
      || (App.pages && App.pages['data-karyawan'] && App.pages['data-karyawan'].state && App.pages['data-karyawan'].state.currentKasbonId)
      || null;

    if (!id) {
      // tampilkan pesan yang ramah, dan hentikan proses — mencegah request ke /undefined
      App.ui ? App.ui.showToast("ID karyawan tidak tersedia — coba buka modal kasbon lagi.", "error")
        : alert("ID karyawan tidak tersedia — coba buka modal kasbon lagi.");
      console.error("saveKasbon: id karyawan undefined/null");
      return;
    }

    const nominalEl = document.getElementById("kasbon-nominal");
    const nominal = Number(nominalEl?.value || 0);
    if (!nominal || nominal <= 0) {
      App.ui ? App.ui.showToast("Nominal tidak valid.", "error") : alert("Nominal tidak valid.");
      return;
    }

    try {
      // gunakan App.api.request agar header JSON & auth token otomatis
      const payload = { nominal, keterangan: "Pinjaman kasbon via UI" };
      // gunakan endpoint tanpa prefix /api (App.api akan menambahkannya) OR gunakan full '/karyawan/...'
      await App.api.request(`/karyawan/${id}/kasbon`, {
        method: "POST",
        body: payload
      });

      App.ui ? App.ui.showToast("Kasbon berhasil ditambahkan", "success") : alert("Kasbon berhasil ditambahkan");

      // refresh UI: ambil histori & data karyawan lagi
      if (App.pages && App.pages['data-karyawan']) {
        await App.pages['data-karyawan'].loadKasbonHistory(id);
        await App.pages['data-karyawan'].loadData();
      }

      // hide modal
      const modal = document.getElementById("kasbon-modal");
      if (modal) {
        modal.classList.add("opacity-0");
        setTimeout(() => modal.classList.add("hidden"), 300);
      }
    } catch (err) {
      console.error('❌ Gagal update kasbon:', err);
      App.ui ? App.ui.showToast("Gagal menambah kasbon: " + (err.message || err), "error")
        : alert("Gagal menambah kasbon");
    }
  }
};





// ======================================================
// 💰 PAYROLL PAGE - FIXED CALCULATION WITH BON
// ======================================================
App.pages["payroll"] = {
  state: {
    karyawanList: [],
    isLoading: false,
    currentKaryawan: null
  },
  elements: {},

  async init() {
    console.log("💰 Payroll INIT Started");

    // Initialize elements sesuai HTML Anda
    this.initializeElements();

    if (!this.elements.karyawanSelect) {
      console.error("❌ Karyawan select element not found");
      return;
    }

    await this.loadKaryawan();
    this.setupEventListeners();
    console.log("✅ Payroll initialized successfully");
  },

  initializeElements() {
    this.elements = {
      karyawanSelect: document.getElementById("karyawan-select"),
      periodeGaji: document.getElementById("periode-gaji"),
      hariKerja: document.getElementById("hari-kerja"),
      hariLembur: document.getElementById("hari-lembur"),
      potonganBon: document.getElementById("potongan-bon"),
      calculateBtn: document.getElementById("calculate-btn"),
      payrollSummary: document.getElementById("payroll-summary"),
      slipGajiArea: document.getElementById("slip-gaji-print-area")
    };

    console.log("🔍 Payroll elements found:", Object.keys(this.elements).filter(key => this.elements[key]));
  },

  async loadKaryawan() {
    if (!this.elements.karyawanSelect) return;

    try {
      this.setLoadingState(true, "Memuat data karyawan...");

      const data = await App.api.request("/karyawan");
      this.state.karyawanList = data;

      // Clear existing options
      this.elements.karyawanSelect.innerHTML = '<option value="">Pilih Karyawan</option>';

      // Add karyawan options
      data.forEach(karyawan => {
        const option = document.createElement("option");
        option.value = karyawan.id;
        option.textContent = `${karyawan.nama_karyawan} (Gaji: ${App.ui.formatRupiah(karyawan.gaji_harian || 0)}/hari)`;
        option.setAttribute('data-gaji', karyawan.gaji_harian || 0);
        option.setAttribute('data-kasbon', karyawan.kasbon || 0);
        option.setAttribute('data-bpjs-kes', karyawan.potongan_bpjs_kesehatan || 0);
        option.setAttribute('data-bpjs-tk', karyawan.potongan_bpjs_ketenagakerjaan || 0);
        this.elements.karyawanSelect.appendChild(option);
      });

      // Set default date to today
      if (this.elements.periodeGaji) {
        const today = new Date().toISOString().split('T')[0];
        this.elements.periodeGaji.value = today;
      }

      console.log(`✅ Loaded ${data.length} karyawan`);

    } catch (err) {
      console.error("❌ Gagal load karyawan:", err);
      App.ui.showToast("Gagal memuat data karyawan", "error");
    } finally {
      this.setLoadingState(false);
    }
  },

  setLoadingState(loading, message = "") {
    this.state.isLoading = loading;

    if (this.elements.calculateBtn) {
      this.elements.calculateBtn.disabled = loading;
      this.elements.calculateBtn.textContent = loading ? "Memproses..." : "Hitung Gaji";

      if (loading) {
        this.elements.calculateBtn.classList.add("opacity-50", "cursor-not-allowed");
      } else {
        this.elements.calculateBtn.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }

    if (loading && message && this.elements.payrollSummary) {
      this.elements.payrollSummary.innerHTML = `
        <div class="text-center py-4 text-gray-500">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-[#A67B5B] mx-auto mb-2"></div>
          ${message}
        </div>
      `;
      this.elements.payrollSummary.classList.remove("hidden");
    }
  },

  setupEventListeners() {
    // Calculate button
    this.elements.calculateBtn?.addEventListener("click", () => this.calculatePayroll());

    // Enter key on input fields
    [this.elements.hariKerja, this.elements.hariLembur, this.elements.potonganBon].forEach(input => {
      input?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.calculatePayroll();
      });
    });
  },

  // ✅ FUNCTION BARU: Handle Submit untuk Save Data
  async handleSubmit(payrollData) {
    try {
      console.log("💾 Menyimpan data payroll...", payrollData);

      // Simpan data payroll ke database (jika diperlukan)
      const savedData = await App.api.request("/payroll/save", {
        method: "POST",
        body: {
          karyawan_id: payrollData.karyawanId,
          periode: payrollData.periode,
          hari_kerja: payrollData.hariKerja,
          hari_lembur: payrollData.hariLembur,
          gaji_pokok: payrollData.gajiPokok,
          gaji_lembur: payrollData.gajiLembur,
          total_gaji_kotor: payrollData.totalGajiKotor,
          potongan_bpjs_kesehatan: payrollData.bpjsKes,
          potongan_bpjs_ketenagakerjaan: payrollData.bpjsTk,
          potongan_bon: payrollData.potonganBon,
          total_potongan: payrollData.totalPotongan,
          gaji_bersih: payrollData.gajiBersih,
          kasbon_awal: payrollData.kasbonAwal,
          sisa_bon: payrollData.sisaBon
        }
      });

      console.log("✅ Data payroll tersimpan:", savedData);
      return savedData;

    } catch (err) {
      console.error("❌ Gagal menyimpan data payroll:", err);
      // Tidak throw error agar tidak mengganggu flow utama
      return null;
    }
  },

  async calculatePayroll() {
    if (this.state.isLoading) return;

    // ✅ VALIDASI ELEMENT KARYAWAN
    if (!this.elements.karyawanSelect) {
      App.ui.showToast("Elemen select karyawan tidak ditemukan", "error");
      return;
    }

    const karyawanId = this.elements.karyawanSelect.value;
    const hariKerja = parseInt(this.elements.hariKerja.value) || 0;

    // ✅ PARSING OVERTIME (MULTIPLIER / HARI LEMBUR)
    // Handle "1.5" and "1,5" -> 1.5 safely
    let overtimeInput = this.elements.hariLembur ? this.elements.hariLembur.value : "0";
    if (overtimeInput && typeof overtimeInput === 'string') {
      overtimeInput = overtimeInput.replace(',', '.');
    }
    const overtimeMultiplier = parseFloat(overtimeInput) || 0;

    const potonganBon = parseFloat(this.elements.potonganBon.value) || 0;

    // Validasi input
    if (!karyawanId) {
      App.ui.showToast("Pilih karyawan terlebih dahulu", "error");
      return;
    }

    // if (hariKerja === 0 && overtimeMultiplier === 0) {
    //   App.ui.showToast("Masukkan hari kerja atau lembur", "error");
    //   // return; // Allow 0 for valid zero-pay scenarios if needed, or keep validation
    // }

    try {
      this.setLoadingState(true, "Menghitung gaji...");

      // Get selected karyawan data safely
      const selectedOption = this.elements.karyawanSelect.options[this.elements.karyawanSelect.selectedIndex];
      if (!selectedOption) throw new Error("Karyawan tidak valid");

      const gajiHarian = parseFloat(selectedOption.getAttribute('data-gaji') || 0);
      const kasbonAwal = parseFloat(selectedOption.getAttribute('data-kasbon') || 0);
      const bpjsKes = parseFloat(selectedOption.getAttribute('data-bpjs-kes') || 0);
      const bpjsTk = parseFloat(selectedOption.getAttribute('data-bpjs-tk') || 0);
      const namaKaryawan = selectedOption.textContent.split(' (')[0];

      console.log("Calculated Payroll Vars:", { hariKerja, overtimeMultiplier, gajiHarian, namaKaryawan });

      // ✅ PERHITUNGAN GAJI
      const gajiPokok = hariKerja * gajiHarian;

      // Overtime Pay = Multiplier * Daily Wage
      // Pastikan tidak NaN
      const gajiLembur = (overtimeMultiplier * gajiHarian) || 0;

      const totalGajiKotor = gajiPokok + gajiLembur;
      const totalPotongan = bpjsKes + bpjsTk + potonganBon;
      const gajiBersih = Math.max(0, totalGajiKotor - totalPotongan); // Prevent negative salary

      // Perhitungan sisa bon
      const sisaBon = Math.max(0, kasbonAwal - potonganBon);

      const payrollData = {
        karyawanId: parseInt(karyawanId),
        periode: this.elements.periodeGaji?.value || new Date().toISOString().split('T')[0],
        hariKerja,
        overtimeMultiplier,
        gajiHarian,
        gajiPokok,
        gajiLembur,
        totalGajiKotor,
        bpjsKes,
        bpjsTk,
        potonganBon,
        totalPotongan,
        gajiBersih,
        kasbonAwal,
        sisaBon
      };

      // Simpan di state untuk akses oleh tombol Save
      this.state.currentCalculation = { ...payrollData, namaKaryawan };

      // Display results
      this.displayPayrollSummary({
        namaKaryawan,
        ...payrollData
      });

      // Generate slip gaji preview
      this.generateSlipGaji({
        namaKaryawan,
        ...payrollData
      });

      this.setLoadingState(false);
      App.ui.showToast("Perhitungan selesai.", "success");

    } catch (err) {
      console.error("❌ Gagal menghitung payroll:", err);
      App.ui.showToast("Gagal menghitung gaji: " + err.message, "error");
      this.setLoadingState(false);
    }
  },

  async saveAndPrint() {
    if (!this.state.currentCalculation) {
      App.ui.showToast("Silakan hitung gaji terlebih dahulu", "warning");
      return;
    }

    if (!confirm("Apakah Anda yakin ingin menyimpan data gaji ini?\n\nKasbon karyawan akan dipotong otomatis dan pengeluaran akan dicatat.")) {
      return;
    }

    try {
      this.setLoadingState(true, "Menyimpan data...");

      const data = this.state.currentCalculation;

      // Call Backend API
      await App.api.request('/payroll/save', {
        method: 'POST',
        body: {
          karyawan_id: data.karyawanId,
          periode: data.periode,
          hari_kerja: data.hariKerja,
          hari_lembur: data.overtimeMultiplier, // Send multiplier as hari_lembur/overtime input
          gaji_pokok: data.gajiPokok,
          gaji_lembur: data.gajiLembur,
          total_gaji_kotor: data.totalGajiKotor,
          potongan_bon: data.potonganBon,
          total_potongan: data.totalPotongan,
          gaji_bersih: data.gajiBersih,
          sisa_bon: data.sisaBon
        }
      });

      App.ui.showToast("Data gaji berhasil disimpan!", "success");

      // Print
      const printArea = document.getElementById('slip-gaji-print-area');
      if (printArea) {
        App.ui.printElement('slip-gaji-print-area');
      }

      // Refresh data karyawan (stok kasbon updated)
      this.loadKaryawan();

      // Clear calculation
      this.state.currentCalculation = null;
      this.elements.payrollSummary.innerHTML = '';
      this.elements.slipGajiArea.innerHTML = '';

    } catch (err) {
      console.error("Save payroll error:", err);
      App.ui.showToast("Gagal menyimpan: " + err.message, "error");
    } finally {
      this.setLoadingState(false);
    }
  },

  displayPayrollSummary(data) {
    if (!this.elements.payrollSummary) return;

    this.elements.payrollSummary.innerHTML = `
        <div class="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 class="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Rincian Gaji: ${data.namaKaryawan}</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div class="flex justify-between"><span>Gaji Pokok (${data.hariKerja} hari):</span> <span class="font-medium">${App.ui.formatRupiah(data.gajiPokok)}</span></div>
                <div class="flex justify-between"><span>Lembur (${data.overtimeMultiplier} x GP):</span> <span class="font-medium">${App.ui.formatRupiah(data.gajiLembur)}</span></div>
                
                <div class="flex justify-between text-yellow-700 mt-2"><span>Potongan Kasbon:</span> <span>- ${App.ui.formatRupiah(data.potonganBon)}</span></div>
                <div class="flex justify-between text-red-600"><span>BPJS:</span> <span>- ${App.ui.formatRupiah(data.bpjsKes + data.bpjsTk)}</span></div>
                
                <div class="border-t pt-2 mt-2 font-bold text-lg text-green-700 flex justify-between">
                    <span>Total Diterima:</span>
                    <span>${App.ui.formatRupiah(data.gajiBersih)}</span>
                </div>
                
                 <div class="text-xs text-gray-500 mt-1">Sisa Kasbon: ${App.ui.formatRupiah(data.sisaBon)}</div>
            </div>
            
            <div class="mt-6 flex justify-end">
                <button id="save-print-btn" class="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 flex items-center font-bold">
                    💾 Simpan & Cetak Slip
                </button>
            </div>
        </div>
      `;

    this.elements.payrollSummary.classList.remove("hidden");

    // Attach event to new button
    document.getElementById('save-print-btn')?.addEventListener('click', () => this.saveAndPrint());
  },

  generateSlipGaji(data) {
    const slipHTML = `
        <div class="font-mono text-sm border-2 border-gray-800 p-8 max-w-[210mm] mx-auto bg-white">
            <!-- Header -->
            <div class="text-center border-b-2 border-gray-800 pb-4 mb-4">
                <h1 class="text-2xl font-bold uppercase tracking-wider">SLIP GAJI</h1>
                <h2 class="text-xl font-bold">CV. TOTO ALUMINIUM MANUFACTURE</h2>
                <p class="text-xs mt-1">Jl. Raya Kletek No. 123, Sidoarjo, Jawa Timur</p>
                <p class="text-xs">Telp: (031) 12345678</p>
            </div>
            
            <!-- Info Karyawan -->
            <div class="flex justify-between mb-6">
                <div>
                    <p><strong>Nama:</strong> ${data.namaKaryawan}</p>
                    <p><strong>Jabatan:</strong> Staff</p> <!-- Bisa dinamis jika ada field jabatan -->
                </div>
                <div class="text-right">
                    <p><strong>Periode:</strong> ${App.ui.formatDate(data.periode)}</p>
                    <p><strong>Tanggal Cetak:</strong> ${App.ui.formatDate(new Date().toISOString())}</p>
                </div>
            </div>
            
            <!-- Tabel Rincian -->
            <table class="w-full mb-6 border-collapse">
                <thead>
                    <tr class="border-b border-gray-400">
                        <th class="text-left py-2">KETERANGAN</th>
                        <th class="text-right py-2">JUMLAH</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="py-1">Gaji Pokok (${data.hariKerja} hari x ${App.ui.formatRupiah(data.gajiHarian)})</td>
                        <td class="text-right">${App.ui.formatRupiah(data.gajiPokok)}</td>
                    </tr>
                    <tr>
                        <td class="py-1">Lembur (${data.overtimeMultiplier} x Upah Harian)</td>
                        <td class="text-right">${App.ui.formatRupiah(data.gajiLembur)}</td>
                    </tr>
                    <!-- Spacer -->
                    <tr><td class="py-2"></td><td></td></tr>
                    
                    <tr class="text-red-700">
                        <td class="py-1">Potongan Kasbon</td>
                        <td class="text-right">- ${App.ui.formatRupiah(data.potonganBon)}</td>
                    </tr>
                    <tr class="text-red-700">
                        <td class="py-1">Potongan BPJS</td>
                        <td class="text-right">- ${App.ui.formatRupiah(data.bpjsKes + data.bpjsTk)}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr class="border-t-2 border-gray-800 font-bold text-lg">
                        <td class="py-4">TOTAL DITERIMA</td>
                        <td class="text-right py-4">${App.ui.formatRupiah(data.gajiBersih)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Footer Infos -->
            <div class="grid grid-cols-2 gap-8 mt-8">
                <div class="border p-2 text-xs">
                    <p class="font-bold">Info Kasbon:</p>
                    <p>Sisa Awal: ${App.ui.formatRupiah(data.kasbonAwal)}</p>
                    <p>Potongan: ${App.ui.formatRupiah(data.potonganBon)}</p>
                    <p class="font-bold border-t border-gray-300 mt-1 pt-1">Sisa Akhir: ${App.ui.formatRupiah(data.sisaBon)}</p>
                </div>
                 <div class="text-center mt-4">
                    <p class="mb-16">Penerima,</p>
                    <p class="font-bold underline">${data.namaKaryawan}</p>
                </div>            
            </div>
            
            <div class="text-center text-xs mt-8 italic text-gray-500">
                Dokumen ini sah dan dicetak secara komputerisasi dari ERP Toto App.
            </div>
        </div>
      `;

    this.elements.slipGajiArea.innerHTML = slipHTML;
    this.elements.slipGajiArea.classList.remove('hidden');
  },

  // ✅ FUNCTION BARU: Update sisa bon di database dengan fallback
  // ✅ PERBAIKAN: Update function di app.js
  async updateSisaBon(karyawanId, sisaBon) {
    try {
      console.log(`💾 Menyimpan sisa bon: ${sisaBon} untuk karyawan ID: ${karyawanId}`);

      let result;

      // OPTION 1: Coba endpoint update-bon yang baru
      try {
        result = await App.api.request(`/karyawan/${karyawanId}/update-bon`, {
          method: "PUT",
          body: { kasbon: sisaBon }
        });
        console.log("✅ Sisa bon berhasil disimpan via update-bon:", result);
      } catch (error1) {
        console.warn("⚠️ Endpoint update-bon tidak tersedia, coba endpoint standar...");

        // OPTION 2: Coba endpoint update biasa
        try {
          result = await App.api.request(`/karyawan/${karyawanId}`, {
            method: "PUT",
            body: { kasbon: sisaBon }
          });
          console.log("✅ Sisa bon berhasil disimpan via endpoint standar:", result);
        } catch (error2) {
          console.warn("⚠️ Endpoint standar gagal, coba endpoint POST...");

          // OPTION 3: Coba endpoint POST alternatif
          try {
            result = await App.api.request(`/karyawan/${karyawanId}/update`, {
              method: "POST",
              body: { kasbon: sisaBon }
            });
            console.log("✅ Sisa bon berhasil disimpan via POST:", result);
          } catch (error3) {
            console.warn("⚠️ Semua endpoint gagal, gunakan localStorage");
            throw new Error("Semua endpoint gagal");
          }
        }
      }

      // Update data lokal dan trigger socket event
      this.updateLocalKaryawanData(karyawanId, sisaBon);

      return result;
    } catch (err) {
      console.error("❌ Semua metode penyimpanan gagal:", err);

      // Fallback: Simpan ke localStorage sebagai backup
      this.saveBonToLocalStorage(karyawanId, sisaBon);

      return { success: false, message: "Data disimpan sementara di browser" };
    }
  },

  // ✅ FUNCTION BARU: Fallback ke localStorage
  saveBonToLocalStorage(karyawanId, sisaBon) {
    try {
      const key = `bon_karyawan_${karyawanId}`;
      const data = {
        karyawanId: parseInt(karyawanId),
        sisaBon: sisaBon,
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(key, JSON.stringify(data));
      console.log("💾 Sisa bon disimpan ke localStorage:", data);

      // Beri warning ke user
      App.ui.showToast("Data bon disimpan sementara (server offline)", "warning");

    } catch (storageError) {
      console.error("❌ Gagal menyimpan ke localStorage:", storageError);
    }
  },

  // ✅ FUNCTION BARU: Cek dan sync data dari localStorage
  async syncBonFromLocalStorage() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('bon_karyawan_'));

      for (const key of keys) {
        const storedData = JSON.parse(localStorage.getItem(key));
        if (storedData && storedData.karyawanId) {
          console.log("🔄 Syncing bon dari localStorage:", storedData);

          try {
            // Coba sync ke server
            await App.api.request(`/karyawan/${storedData.karyawanId}`, {
              method: "PUT",
              body: {
                kasbon: storedData.sisaBon
              }
            });

            // Hapus dari localStorage jika berhasil
            localStorage.removeItem(key);
            console.log("✅ Berhasil sync bon ke server:", storedData.karyawanId);
          } catch (syncError) {
            console.warn("⚠️ Gagal sync bon, tetap simpan di localStorage:", syncError);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error saat sync bon:", error);
    }
  },

  // ✅ FUNCTION BARU: Update data lokal dan kirim socket event
  updateLocalKaryawanData(karyawanId, sisaBon) {
    // Update di local state payroll
    const karyawanIndex = this.state.karyawanList.findIndex(k => k.id == karyawanId);
    if (karyawanIndex !== -1) {
      this.state.karyawanList[karyawanIndex].kasbon = sisaBon;
    }

    // Update dropdown option
    const option = this.elements.karyawanSelect.querySelector(`option[value="${karyawanId}"]`);
    if (option) {
      const namaKaryawan = option.textContent.split(' (')[0];
      const gajiHarian = parseFloat(option.getAttribute('data-gaji') || 0);
      option.textContent = `${namaKaryawan} (Gaji: ${App.ui.formatRupiah(gajiHarian)}/hari)`;
      option.setAttribute('data-kasbon', sisaBon);
    }

    // Emit socket event untuk update realtime di data-karyawan page
    if (App.state.socket) {
      App.state.socket.emit("karyawan:update", {
        id: parseInt(karyawanId),
        kasbon: sisaBon,
        updated_at: new Date().toISOString()
      });
    }
  },

  displayPayrollSummary(data) {
    if (!this.elements.payrollSummary) return;

    this.elements.payrollSummary.innerHTML = `
      <h3 class="text-lg font-semibold mb-4 text-[#5C4033]">Rincian Gaji</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p class="text-sm text-gray-600">Nama Karyawan</p>
          <p class="font-medium">${data.namaKaryawan}</p>
        </div>
        <div>
          <p class="text-sm text-gray-600">Periode</p>
          <p class="font-medium">${data.periode}</p>
        </div>
      </div>

      <div class="border-t pt-4">
        <h4 class="font-medium mb-2">Pendapatan</h4>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span>Gaji Pokok (${data.hariKerja} hari × ${App.ui.formatRupiah(data.gajiHarian)})</span>
            <span>${App.ui.formatRupiah(data.gajiPokok)}</span>
          </div>
          <div class="flex justify-between">
            <span>Lembur (${data.hariLembur} hari × ${App.ui.formatRupiah(data.gajiHarian)})</span>
            <span>${App.ui.formatRupiah(data.gajiLembur)}</span>
          </div>
          <div class="flex justify-between border-t pt-1 font-medium">
            <span>Total Pendapatan</span>
            <span class="text-green-600">${App.ui.formatRupiah(data.totalGajiKotor)}</span>
          </div>
        </div>
      </div>

      <div class="border-t pt-4">
        <h4 class="font-medium mb-2">Potongan</h4>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span>BPJS Kesehatan</span>
            <span class="text-red-600">-${App.ui.formatRupiah(data.bpjsKes)}</span>
          </div>
          <div class="flex justify-between">
            <span>BPJS Ketenagakerjaan</span>
            <span class="text-red-600">-${App.ui.formatRupiah(data.bpjsTk)}</span>
          </div>
          <div class="flex justify-between">
            <span>Potongan Bon</span>
            <span class="text-red-600">-${App.ui.formatRupiah(data.potonganBon)}</span>
          </div>
          <div class="flex justify-between border-t pt-1 font-medium">
            <span>Total Potongan</span>
            <span class="text-red-600">-${App.ui.formatRupiah(data.totalPotongan)}</span>
          </div>
        </div>
      </div>

      <!-- ✅ TAMBAHAN: INFO BON -->
      <div class="border-t pt-4 bg-yellow-50 p-3 rounded">
        <h4 class="font-medium mb-2 text-yellow-800">Informasi Bon</h4>
        <div class="space-y-1 text-sm">
          <div class="flex justify-between">
            <span>Bon Awal</span>
            <span>${App.ui.formatRupiah(data.kasbonAwal)}</span>
          </div>
          <div class="flex justify-between">
            <span>Potongan Bon Bulan Ini</span>
            <span class="text-red-600">-${App.ui.formatRupiah(data.potonganBon)}</span>
          </div>
          <div class="flex justify-between border-t pt-1 font-medium">
            <span>Sisa Bon</span>
            <span class="${data.sisaBon > 0 ? 'text-red-600' : 'text-green-600'}">${App.ui.formatRupiah(data.sisaBon)}</span>
          </div>
        </div>
      </div>

      <div class="border-t pt-4">
        <div class="flex justify-between text-lg font-bold">
          <span>GAJI BERSIH</span>
          <span class="text-[#A67B5B]">${App.ui.formatRupiah(data.gajiBersih)}</span>
        </div>
      </div>

      <div class="mt-4 flex space-x-3">
        <button onclick="App.pages.payroll.printSlipGaji()" 
                class="flex-1 bg-[#A67B5B] text-white py-2 px-4 rounded-md hover:bg-[#8B5E34] transition">
          🖨️ Cetak Slip Gaji
        </button>
        <button onclick="App.pages.payroll.resetCalculator()" 
                class="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition">
          🔁 Reset
        </button>
      </div>
    `;

    this.elements.payrollSummary.classList.remove("hidden");
  },

  generateSlipGaji(data) {
    if (!this.elements.slipGajiArea) return;

    const today = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    this.elements.slipGajiArea.innerHTML = `
    <div class="bg-white p-8 border-2 border-gray-800">
      <!-- Kop Surat Profesional -->
      <div class="text-center border-b-2 border-gray-800 pb-4 mb-6">
        <h1 class="text-2xl font-bold uppercase tracking-wide">CV. TOTO ALUMINIUM MANUFACTURE</h1>
        <p class="text-sm text-gray-600 mt-1">Jl.Rawa Mulya, Kota Bekasi | Telp: 0813 1191 2002</p>
        <h2 class="text-xl font-bold mt-4 uppercase">Slip Gaji Karyawan</h2>
        <p class="text-sm text-gray-600">Periode: ${this.formatPeriode(data.periode)}</p>
      </div>

      <!-- Informasi Karyawan -->
      <div class="grid grid-cols-2 gap-6 mb-6">
        <div>
          <table class="w-full text-sm">
            <tr>
              <td class="py-1 font-medium w-40">Nama Karyawan</td>
              <td class="py-1">: ${data.namaKaryawan}</td>
            </tr>
            <tr>
              <td class="py-1 font-medium">Periode Gaji</td>
              <td class="py-1">: ${this.formatPeriode(data.periode)}</td>
            </tr>
            <tr>
              <td class="py-1 font-medium">Tanggal Cetak</td>
              <td class="py-1">: ${today}</td>
            </tr>
          </table>
        </div>
        <div>
          <table class="w-full text-sm">
            <tr>
              <td class="py-1 font-medium w-40">Hari Kerja</td>
              <td class="py-1">: ${data.hariKerja} hari</td>
            </tr>
            <tr>
              <td class="py-1 font-medium">Hari Lembur</td>
              <td class="py-1">: ${data.hariLembur} hari</td>
            </tr>
            <tr>
              <td class="py-1 font-medium">Gaji Harian</td>
              <td class="py-1">: ${App.ui.formatRupiah(data.gajiHarian)}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Rincian Pendapatan -->
      <div class="mb-6">
        <h3 class="font-bold text-lg border-b border-gray-300 pb-2 mb-3">PENDAPATAN</h3>
        <table class="w-full text-sm">
          <tr>
            <td class="py-2">Gaji Pokok</td>
            <td class="py-2 text-right">${data.hariKerja} hari × ${App.ui.formatRupiah(data.gajiHarian)}</td>
            <td class="py-2 text-right font-medium w-32">${App.ui.formatRupiah(data.gajiPokok)}</td>
          </tr>
          <tr>
            <td class="py-2">Uang Lembur</td>
            <td class="py-2 text-right">${data.hariLembur} hari × ${App.ui.formatRupiah(data.gajiHarian)}</td>
            <td class="py-2 text-right font-medium">${App.ui.formatRupiah(data.gajiLembur)}</td>
          </tr>
          <tr class="border-t border-gray-300">
            <td class="py-2 font-bold">Total Pendapatan</td>
            <td class="py-2 text-right"></td>
            <td class="py-2 text-right font-bold text-green-600">${App.ui.formatRupiah(data.totalGajiKotor)}</td>
          </tr>
        </table>
      </div>

      <!-- Rincian Potongan -->
      <div class="mb-6">
        <h3 class="font-bold text-lg border-b border-gray-300 pb-2 mb-3">POTONGAN</h3>
        <table class="w-full text-sm">
          <tr>
            <td class="py-2">BPJS Kesehatan</td>
            <td class="py-2 text-right"></td>
            <td class="py-2 text-right font-medium text-red-600 w-32">-${App.ui.formatRupiah(data.bpjsKes)}</td>
          </tr>
          <tr>
            <td class="py-2">BPJS Ketenagakerjaan</td>
            <td class="py-2 text-right"></td>
            <td class="py-2 text-right font-medium text-red-600">-${App.ui.formatRupiah(data.bpjsTk)}</td>
          </tr>
          <tr>
            <td class="py-2">Potongan Bon</td>
            <td class="py-2 text-right"></td>
            <td class="py-2 text-right font-medium text-red-600">-${App.ui.formatRupiah(data.potonganBon)}</td>
          </tr>
          <tr class="border-t border-gray-300">
            <td class="py-2 font-bold">Total Potongan</td>
            <td class="py-2 text-right"></td>
            <td class="py-2 text-right font-bold text-red-600">-${App.ui.formatRupiah(data.totalPotongan)}</td>
          </tr>
        </table>
      </div>

      <!-- Informasi Bon -->
      <div class="mb-6 bg-yellow-50 p-4 border border-yellow-200 rounded">
        <h3 class="font-bold text-lg border-b border-yellow-300 pb-2 mb-3">INFORMASI BON</h3>
        <table class="w-full text-sm">
          <tr>
            <td class="py-1">Bon Awal</td>
            <td class="py-1 text-right">:</td>
            <td class="py-1 text-right font-medium">${App.ui.formatRupiah(data.kasbonAwal)}</td>
          </tr>
          <tr>
            <td class="py-1">Potongan Bon Bulan Ini</td>
            <td class="py-1 text-right">:</td>
            <td class="py-1 text-right font-medium text-red-600">-${App.ui.formatRupiah(data.potonganBon)}</td>
          </tr>
          <tr class="border-t border-yellow-300">
            <td class="py-2 font-bold">Sisa Bon</td>
            <td class="py-2 text-right">:</td>
            <td class="py-2 text-right font-bold ${data.sisaBon > 0 ? 'text-red-600' : 'text-green-600'}">
              ${App.ui.formatRupiah(data.sisaBon)}
            </td>
          </tr>
        </table>
      </div>

      <!-- Total Gaji Bersih -->
      <div class="bg-gray-100 p-4 border-2 border-gray-300 rounded text-center">
        <div class="text-sm text-gray-600 mb-1">TOTAL GAJI BERSIH YANG DITERIMA</div>
        <div class="text-2xl font-bold text-[#A67B5B]">${App.ui.formatRupiah(data.gajiBersih)}</div>
        <div class="text-xs text-gray-500 mt-1">${this.terbilang(data.gajiBersih)} rupiah</div>
      </div>

    
      </div>

      <!-- Footer -->
      <div class="text-center mt-6 pt-4 border-t border-gray-300">
        <p class="text-xs text-gray-500">
          Slip gaji ini dicetak secara otomatis dan sah tanpa tanda tangan basah
        </p>
      </div>
    </div>
  `;
  },

  // ✅ Helper function untuk format periode
  formatPeriode(tanggal) {
    if (!tanggal) return '-';

    try {
      const date = new Date(tanggal);
      const bulan = date.toLocaleDateString('id-ID', { month: 'long' });
      const tahun = date.getFullYear();
      return `${bulan} ${tahun}`;
    } catch (e) {
      return tanggal;
    }
  },

  // ✅ Helper function untuk terbilang (opsional)
  terbilang(angka) {
    // Simple terbilang function - bisa dikembangkan lebih lengkap
    const bilangan = [
      '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh'
    ];

    if (angka === 0) return 'Nol';
    if (angka < 11) return bilangan[angka];
    if (angka < 20) return bilangan[angka - 10] + ' Belas';
    if (angka < 100) return bilangan[Math.floor(angka / 10)] + ' Puluh ' + (angka % 10 !== 0 ? bilangan[angka % 10] : '');

    return 'Silahkan hubungi keuangan untuk detail terbilang';
  },

  // ✅ Update juga CSS untuk print yang lebih baik
  printSlipGaji() {
    // Simpan HTML asli
    const originalHTML = this.elements.slipGajiArea.innerHTML;

    // Buat HTML khusus untuk print
    const printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Slip Gaji - ${this.state.currentKaryawan?.namaKaryawan || 'Karyawan'}</title>
      <style>
        body { 
          font-family: 'Arial', sans-serif; 
          margin: 0; 
          padding: 20px;
          color: #333;
        }
        .slip-container {
          max-width: 800px;
          margin: 0 auto;
          border: 2px solid #000;
          padding: 30px;
          background: white;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .company-address {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
        .slip-title {
          font-size: 20px;
          font-weight: bold;
          margin-top: 15px;
          text-transform: uppercase;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td {
          padding: 8px 4px;
          vertical-align: top;
        }
        .section-title {
          font-weight: bold;
          font-size: 16px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 8px;
          margin: 20px 0 10px 0;
        }
        .total-section {
          background: #f8f8f8;
          padding: 15px;
          border: 2px solid #ccc;
          text-align: center;
          margin: 20px 0;
        }
        .total-amount {
          font-size: 24px;
          font-weight: bold;
          color: #8B5E34;
        }
        .bon-info {
          background: #fff9e6;
          padding: 15px;
          border: 1px solid #ffd700;
          margin: 15px 0;
        }
        .signature-area {
          margin-top: 60px;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-green { color: #22c55e; }
        .text-red { color: #dc2626; }
        .border-top { border-top: 1px solid #ccc; }
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none; }
          .slip-container { border: none; padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="slip-container">
        ${this.elements.slipGajiArea.innerHTML}
      </div>
    </body>
    </html>
  `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHTML);
    printWindow.document.close();

    printWindow.onload = function () {
      printWindow.print();
      printWindow.onafterprint = function () {
        printWindow.close();
      };
    };
  },

  resetCalculator() {
    if (this.elements.hariKerja) this.elements.hariKerja.value = "";
    if (this.elements.hariLembur) this.elements.hariLembur.value = "";
    if (this.elements.potonganBon) this.elements.potonganBon.value = "";
    if (this.elements.payrollSummary) this.elements.payrollSummary.classList.add("hidden");

    App.ui.showToast("Kalkulator direset", "info");
  }
};

// ======================================================
// 🧱 STOK BAHAN PAGE - TETAP SAMA
// ======================================================
App.pages["stok-bahan"] = {
  state: { data: null, selectedItem: null },
  elements: {},

  async init() {
    this.elements.tableContainer = document.getElementById("stok-grid");
    this.elements.addForm = document.getElementById("stok-form");
    this.elements.updateForm = document.getElementById("update-stok-form");

    // Inject Adjustment Modal if not exists
    if (!document.getElementById("adjustment-modal")) {
      this.injectAdjustmentModal();
    }

    this.elements.adjustmentModal = document.getElementById("adjustment-modal");
    this.elements.adjustmentForm = document.getElementById("adjustment-form");

    await this.loadData();

    this.elements.addForm?.addEventListener("submit", (e) => this.addStok(e));
    this.elements.updateForm?.addEventListener("submit", (e) => this.updateStok(e));
    this.elements.adjustmentForm?.addEventListener("submit", (e) => this.submitAdjustment(e));
  },

  injectAdjustmentModal() {
    const modalHTML = `
        <div id="adjustment-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
                <h3 class="text-lg font-bold mb-4 text-gray-800">📦 Stock Opname (Penyesuaian)</h3>
                <form id="adjustment-form" class="space-y-4">
                    <input type="hidden" name="bahan_id" id="adj-bahan-id">
                    
                    <div class="bg-blue-50 p-3 rounded text-sm">
                        <p class="font-bold text-gray-700" id="adj-nama-bahan">-</p>
                        <div class="flex justify-between mt-1">
                            <span>Stok Sistem:</span>
                            <span class="font-mono font-bold" id="adj-stok-sistem">0</span>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Stok Fisik (Actual)</label>
                        <input type="number" step="0.01" name="qty_actual" id="adj-qty-actual" required
                               class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2 text-lg font-bold">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Alasan Penyesuaian</label>
                        <select name="reason" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" required>
                            <option value="Stock Opname Rutin">Stock Opname Rutin</option>
                            <option value="Rusak / Expired">Barang Rusak / Expired</option>
                            <option value="Hilang">Barang Hilang / Selisih</option>
                            <option value="Koreksi Admin">Koreksi Salah Input</option>
                            <option value="Lainnya">Lainnya</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Catatan Tambahan</label>
                        <textarea name="keterangan" rows="2" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2"></textarea>
                    </div>
                    
                    <div class="flex justify-end gap-2 mt-6">
                        <button type="button" onclick="document.getElementById('adjustment-modal').classList.add('hidden')" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Batal</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Simpan Penyesuaian</button>
                    </div>
                </form>
            </div>
        </div>
      `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  async loadData() {
    try {
      const res = await App.api.request("/stok");
      this.state.data = res; // Save for lookups
      this.render(res);
      //App.ui.showToast("Data stok berhasil dimuat", "success");
    } catch (err) {
      console.error("❌ Gagal memuat stok:", err);
      App.ui.showToast("Gagal memuat data stok", "error");
    }
  },

  render(data) {
    if (!this.elements.tableContainer) return;

    this.elements.tableContainer.innerHTML = `
      <div class="overflow-x-auto border rounded-lg shadow-sm">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Satuan</th>
              <th class="px-4 py-3 border-b text-right text-xs font-medium text-gray-500 uppercase">Stok</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase w-24">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(b => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-mono font-medium">${b.kode_bahan}</td>
                <td class="px-4 py-3 text-sm">${b.nama_bahan}</td>
                <td class="px-4 py-3 text-sm">${b.kategori || '-'}</td>
                <td class="px-4 py-3 text-sm">${b.satuan || '-'}</td>
                <td class="px-4 py-3 text-right text-sm font-bold ${Number(b.stok) < 10 ? 'text-red-600' : 'text-green-600'}">
                    ${Number(b.stok)}
                </td>
                <td class="px-4 py-3 text-sm">
                    <button onclick="App.pages['stok-bahan'].openAdjustmentModal(${b.id})" 
                            class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded text-xs font-medium transition">
                        ⚖️ Adjust
                    </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  openAdjustmentModal(id) {
    const item = this.state.data.find(i => i.id == id);
    if (!item) return;

    this.state.selectedItem = item;

    document.getElementById('adj-bahan-id').value = item.id;
    document.getElementById('adj-nama-bahan').textContent = `${item.nama_bahan} (${item.kode_bahan})`;
    document.getElementById('adj-stok-sistem').textContent = item.stok;
    document.getElementById('adj-qty-actual').value = item.stok; // Default to current

    this.elements.adjustmentModal.classList.remove('hidden');
    document.getElementById('adj-qty-actual').focus();
    document.getElementById('adj-qty-actual').select();
  },

  async submitAdjustment(e) {
    e.preventDefault();
    if (!confirm("Anda yakin ingin menyesuaikan stok ini? Perubahan akan dicatat di riwayat.")) return;

    const formData = new FormData(this.elements.adjustmentForm);
    const data = {
      bahan_id: formData.get('bahan_id'),
      qty_actual: parseFloat(formData.get('qty_actual')),
      reason: formData.get('reason'),
      keterangan: formData.get('keterangan')
    };

    try {
      await App.api.request('/stok/adjust', {
        method: 'POST',
        body: data
      });

      this.elements.adjustmentModal.classList.add('hidden');
      App.ui.showToast("✅ Stock Opname berhasil disimpan", "success");
      this.loadData(); // Refresh table

    } catch (err) {
      console.error("Adjustment error:", err);
      App.ui.showToast("Gagal update stok: " + err.message, "error");
    }
  },

  async addStok(e) {
    e.preventDefault();

    const formData = new FormData(this.elements.addForm);
    const data = {
      kode: formData.get('kode'),
      nama: formData.get('nama'),
      satuan: formData.get('satuan'),
      kategori: formData.get('kategori'),
      stok: parseFloat(formData.get('stok') || 0),
      lokasi: formData.get('lokasi')
    };

    try {
      await App.api.request("/stok", {
        method: "POST",
        body: data
      });

      this.elements.addForm.reset();
      await this.loadData();
      App.ui.showToast("Stok bahan berhasil ditambahkan", "success");
    } catch (err) {
      console.error("❌ Tambah stok error:", err);
      App.ui.showToast("Gagal menambah stok: " + err.message, "error");
    }
  },

  async updateStok(e) {
    e.preventDefault();

    const formData = new FormData(this.elements.updateForm);
    const data = {
      bahan_id: formData.get('bahan_id'),
      tipe: formData.get('tipe'),
      jumlah: parseFloat(formData.get('jumlah') || 0),
      keterangan: formData.get('keterangan')
    };

    try {
      await App.api.request("/stok/update", {
        method: "POST",
        body: data
      });

      this.elements.updateForm.reset();
      await this.loadData();
      App.ui.showToast("Stok berhasil diperbarui", "success");
    } catch (err) {
      console.error("❌ Update stok error:", err);
      App.ui.showToast("Gagal memperbarui stok: " + err.message, "error");
    }
  }
};


// ======================================================
// 🧾 PRINT PO PAGE
// ======================================================
App.pages["print-po"] = {
  state: { poData: null },
  elements: {},

  async init() {
    this.elements.container = document.getElementById("po-content");
    this.elements.printBtn = document.getElementById("print-btn");

    await this.loadData();

    this.elements.printBtn?.addEventListener("click", () => {
      App.ui.printElement("po-content");
    });
  },

  async loadData() {
    try {
      // Get PO data from sessionStorage
      const poData = JSON.parse(sessionStorage.getItem("poData") || "[]");

      if (!poData || poData.length === 0) {
        this.showMessage("Tidak ada data PO untuk dicetak", "warning");
        this.elements.container.innerHTML = `
          <div class="text-center py-8">
            <p class="text-gray-500">Tidak ada data PO</p>
            <a href="work-orders.html" class="text-blue-600 hover:underline">Kembali ke Work Orders</a>
          </div>
        `;
        return;
      }

      this.state.poData = poData;
      this.render(poData);
      App.ui.showToast("Data PO berhasil dimuat", "success");
    } catch (err) {
      console.error("❌ Gagal load PO:", err);
      this.showMessage("Gagal memuat data PO", "error");
    }
  },

  render(data) {
    if (!this.elements.container) return;

    const totalQty = data.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
    const totalValue = data.reduce((sum, item) => {
      const ukuran = parseFloat(item.ukuran) || 0;
      const qty = parseFloat(item.qty) || 0;
      const harga = parseFloat(item.harga) || 0;
      return sum + (ukuran * qty * harga);
    }, 0);

    this.elements.container.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow border">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-gray-800">PURCHASE ORDER (PO)</h1>
          <p class="text-gray-600">Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}</p>
        </div>
        
        <div class="mb-6">
          <h2 class="text-lg font-semibold mb-2">Detail PO</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="font-medium">Total Items</p>
              <p>${data.length}</p>
            </div>
            <div>
              <p class="font-medium">Total Quantity</p>
              <p>${totalQty}</p>
            </div>
            <div>
              <p class="font-medium">Total Nilai</p>
              <p>${App.ui.formatRupiah(totalValue)}</p>
            </div>
            <div>
              <p class="font-medium">Status</p>
              <p class="text-green-600">DIPRODUKSI</p>
            </div>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full border border-gray-300">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-4 py-2 border text-left text-sm font-medium">No</th>
                <th class="px-4 py-2 border text-left text-sm font-medium">Tanggal</th>
                <th class="px-4 py-2 border text-left text-sm font-medium">Customer</th>
                <th class="px-4 py-2 border text-left text-sm font-medium">Deskripsi</th>
                <th class="px-4 py-2 border text-left text-sm font-medium">Ukuran</th>
                <th class="px-4 py-2 border text-left text-sm font-medium">Qty</th>
                <th class="px-4 py-2 border text-left text-sm font-medium">Harga</th>
                <th class="px-4 py-2 border text-left text-sm font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => {
      const ukuran = parseFloat(item.ukuran) || 0;
      const qty = parseFloat(item.qty) || 0;
      const harga = parseFloat(item.harga) || 0;
      const subtotal = ukuran * qty * harga;

      return `
                  <tr>
                    <td class="px-4 py-2 border text-sm">${index + 1}</td>
                    <td class="px-4 py-2 border text-sm">${App.ui.formatDate(item.tanggal)}</td>
                    <td class="px-4 py-2 border text-sm">${item.nama_customer || '-'}</td>
                    <td class="px-4 py-2 border text-sm">${item.deskripsi || '-'}</td>
                    <td class="px-4 py-2 border text-sm text-center">${item.ukuran || '-'}</td>
                    <td class="px-4 py-2 border text-sm text-center">${item.qty || '-'}</td>
                    <td class="px-4 py-2 border text-sm text-right">${App.ui.formatRupiah(harga)}</td>
                    <td class="px-4 py-2 border text-sm text-right">${App.ui.formatRupiah(subtotal)}</td>
                  </tr>
                `;
    }).join('')}
              <tr class="bg-gray-50">
                <td colspan="7" class="px-4 py-2 border text-sm font-medium text-right">TOTAL</td>
                <td class="px-4 py-2 border text-sm font-medium text-right">${App.ui.formatRupiah(totalValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-6 text-sm text-gray-600">
          <p><strong>Catatan:</strong> PO ini telah ditandai sebagai DIPRODUKSI dalam sistem.</p>
        </div>
      </div>
    `;
  },

  showMessage(message, type = "info") {
    console.log(`Print PO: ${message}`);
    App.ui.showToast(message, type);
  }
};


// ======================================================
// 📄 SURAT JALAN PAGE - FINAL VERSION (DIPERBAIKI)
// ======================================================
App.pages["surat-jalan"] = {
  state: {
    currentTab: 'customer',
    selectedItems: [],
    workOrders: [],
    isLoading: false
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
      logTableBody: document.getElementById("sj-log-table-body")
    };
  },

  setDefaultMonthYear() {
    const now = new Date();
    this.elements.monthSelect.value = now.getMonth() + 1;
    this.elements.yearInput.value = now.getFullYear();
  },

  setupTabNavigation() {
    this.elements.tabCustomer?.addEventListener("click", () => this.switchTab('customer'));
    this.elements.tabWarna?.addEventListener("click", () => this.switchTab('warna'));
    this.elements.tabLog?.addEventListener("click", () => this.switchTab('log'));
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
      this.elements.tabCustomer.classList.add("active");
      this.elements.contentCustomer.classList.remove("hidden");
    }
    else if (tab === "warna") {
      this.elements.tabWarna.classList.add("active");
      this.elements.contentWarna.classList.remove("hidden");
      this.loadWorkOrdersForWarna();
    }
    else if (tab === "log") {
      this.elements.tabLog.classList.add("active");
      this.elements.contentLog.classList.remove("hidden");
      this.loadSuratJalanLog(); // 🔥 otomatis load log saat tab dibuka
    }
  },

  setupEventListeners() {
    // CUSTOMER
    this.elements.searchBtn?.addEventListener("click", () => this.searchByInvoice());
    this.elements.invoiceSearch?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.searchByInvoice();
    });
    this.elements.printBtn?.addEventListener("click", () => this.printSuratJalan());

    // PEWARNAAN
    this.elements.monthSelect?.addEventListener("change", () => this.loadWorkOrdersForWarna());
    this.elements.yearInput?.addEventListener("change", () => this.loadWorkOrdersForWarna());
    this.elements.customerSearch?.addEventListener("input", () => this.filterWorkOrders());
    this.elements.selectAllCheckbox?.addEventListener("change", (e) => this.toggleSelectAll(e.target.checked));
    this.elements.printWarnaBtn?.addEventListener("click", () => this.printSuratJalanWarna());
    this.elements.vendorSelect?.addEventListener("change", () => this.updateWarnaPreview());

    // LOG
    this.elements.logRefreshBtn?.addEventListener("click", () => this.loadSuratJalanLog());
    this.elements.logVendorSelect?.addEventListener("change", () => this.loadSuratJalanLog());
  },

  // ======================================================
  // 🔍 TAB CUSTOMER - SEARCH
  // ======================================================
  async searchByInvoice() {
    const invoiceNo = this.elements.invoiceSearch?.value.trim();
    if (!invoiceNo) return App.ui.showToast("Masukkan nomor invoice terlebih dahulu", "error");

    try {
      this.setLoadingState(true);
      const result = await App.api.request(`/api/invoice-search/${invoiceNo}`);

      if (result && result.length > 0) {
        this.generateCustomerPreview(result, invoiceNo);
        this.elements.printBtn.disabled = false;
      } else {
        this.elements.printArea.innerHTML = `<div class='text-center text-red-500 py-8'>Invoice <b>${invoiceNo}</b> tidak ditemukan</div>`;
        this.elements.printBtn.disabled = true;
      }
    } catch (err) {
      console.error("❌ Error searching invoice:", err);
      App.ui.showToast("Gagal mencari invoice", "error");
    }
  },
  // 🎨 TAB PEWARNAAN
  // ======================================================
  async loadWorkOrdersForWarna() {
    try {
      this.setLoadingState(true);
      const month = this.elements.monthSelect.value;
      const year = this.elements.yearInput.value;

      console.log(`🔍 Loading work orders for warna: ${month}-${year}`);

      const result = await App.api.request(`/api/workorders-warna?month=${month}&year=${year}`);
      this.state.workOrders = result || [];

      this.renderWorkOrdersTable();
      this.updateWarnaPreview();

      const statusMsg = this.state.workOrders.length > 0
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

    tbody.innerHTML = this.state.workOrders.map(wo => `
      <tr class="border-b hover:bg-gray-50">
        <td class="p-2 text-center">
          <input type="checkbox" class="item-checkbox" value="${wo.id}" ${this.state.selectedItems.includes(wo.id) ? "checked" : ""}>
        </td>
        <td class="p-2 text-sm">${wo.nama_customer || '-'}</td>
        <td class="p-2 text-sm">${wo.deskripsi || '-'}</td>
        <td class="p-2 text-sm text-center">${wo.ukuran || '-'}</td>
        <td class="p-2 text-sm text-center">${wo.qty || '-'}</td>
      </tr>
    `).join('');

    // Add event listeners to checkboxes
    tbody.querySelectorAll(".item-checkbox").forEach(cb => {
      cb.addEventListener("change", e => this.toggleItemSelection(e.target.value, e.target.checked));
    });
  },

  toggleSelectAll(checked) {
    this.state.selectedItems = checked ? this.state.workOrders.map(wo => wo.id) : [];
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
      this.state.selectedItems = this.state.selectedItems.filter(i => i !== num);
    }
    this.updateWarnaPreview();
  },

  filterWorkOrders() {
    const searchTerm = this.elements.customerSearch.value.toLowerCase();
    const rows = this.elements.tableBody.querySelectorAll('tr');

    rows.forEach(row => {
      const customerCell = row.querySelector('td:nth-child(2)');
      if (customerCell) {
        const customerName = customerCell.textContent.toLowerCase();
        row.style.display = customerName.includes(searchTerm) ? '' : 'none';
      }
    });
  },

  updateStatusInfo(msg) {
    // Create status info element if it doesn't exist
    if (!this.elements.statusInfo) {
      const statusDiv = document.createElement('div');
      statusDiv.id = 'sj-warna-status';
      statusDiv.className = 'mt-2 text-sm';
      this.elements.tableBody.parentNode.insertBefore(statusDiv, this.elements.tableBody);
      this.elements.statusInfo = statusDiv;
    }
    this.elements.statusInfo.textContent = msg;
  },

  updateWarnaPreview() {
    const selected = this.state.workOrders.filter(wo => this.state.selectedItems.includes(wo.id));
    if (!selected.length) {
      this.elements.printWarnaArea.innerHTML = `<div class="text-center text-gray-500 py-8">Belum ada item dipilih</div>`;
      this.elements.printWarnaBtn.disabled = true;
      return;
    }

    const vendor = this.elements.vendorSelect.value || "Vendor Pewarnaan";
    const today = new Date().toLocaleDateString("id-ID");
    const noSurat = this.generateNoSuratJalan();

    const adjustedData = selected.map(wo => ({
      ...wo,
      ukuran: (parseFloat(wo.ukuran || 0) - 0.20).toFixed(2)
    }));

    const totalQty = adjustedData.reduce((sum, wo) => sum + (parseFloat(wo.qty) || 0), 0);

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
            ${adjustedData.map((wo, i) => `
              <tr>
                <td class="border p-1 text-center">${i + 1}</td>
                <td class="border p-1">${wo.nama_customer || '-'}</td>
                <td class="border p-1">${wo.deskripsi || '-'}</td>
                <td class="border p-1 text-center">${wo.ukuran}</td>
                <td class="border p-1 text-center">${wo.qty || '-'}</td>
              </tr>
            `).join('')}
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

    this.elements.printWarnaBtn.disabled = false;
  },

  generateNoSuratJalan() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

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
      tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">
        <div class="flex justify-center items-center">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8B5E34] mr-2"></div>
          Memuat data...
        </div>
      </td></tr>`;

      const url = vendorFilter ? `/api/suratjalan-log?vendor=${encodeURIComponent(vendorFilter)}` : "/api/suratjalan-log";
      const result = await App.api.request(url);

      if (!result || result.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">Belum ada data surat jalan...</td></tr>`;
        return;
      }

      // Render table data
      tbody.innerHTML = result.map(log => `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-2 text-sm">${new Date(log.tanggal || log.dibuat_pada).toLocaleDateString("id-ID")}</td>
          <td class="p-2 text-sm font-medium text-[#8B5E34]">${log.no_sj}</td>
          <td class="p-2 text-sm">${log.vendor || "-"}</td>
          <td class="p-2 text-sm text-gray-600">
            <ul class="list-disc list-inside">
              ${(log.items || []).map(i => `
                <li>
                  <span class="font-medium text-gray-900">${i.deskripsi || '-'}</span> 
                  <span class="text-xs text-gray-500">(${i.nama_customer || '-'})</span>
                </li>
              `).join('')}
            </ul>
          </td>
          <td class="p-2 text-center text-sm">${log.total_item}</td>
          <td class="p-2 text-center text-sm">${log.total_qty}</td>
          <td class="p-2 text-sm">${log.dibuat_oleh || "-"}</td>
        </tr>
      `).join("");

      console.log(`✅ Loaded ${result.length} surat jalan log entries`);

    } catch (err) {
      console.error("❌ Gagal memuat log surat jalan:", err);
      const tbody = this.elements.logTableBody;
      tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">
        Gagal memuat data: ${err.message}
      </td></tr>`;
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
        App.ui.showToast("Tidak ada item yang siap dicetak", "error");
        return;
      }

      document.body.style.overflow = "hidden";
      document.body.classList.add("surat-jalan-print");
      window.print();

      setTimeout(() => {
        document.body.classList.remove("surat-jalan-print");
        document.body.style.overflow = "auto";

        // ✅ AUTO UPDATE STATUS TRIGGER
        this.triggerPostPrintUpdate();

      }, 1500);

    } catch (err) {
      console.error("❌ Gagal mencetak:", err);
      App.ui.showToast("Gagal mencetak: " + err.message, "error");
    }
  },

  // ✅ NEW: Post Print Update Logic
  triggerPostPrintUpdate() {
    // Use SweetAlert or simple Confirm
    const confirmed = confirm("🖨️ Apakah Print berhasil? \n\nKlik OK untuk menandai barang ini sebagai SEDANG DIPRODUKSI (di_produksi = true).");

    if (confirmed) {
      this.bulkUpdateProductionStatus();
    }
  },

  async bulkUpdateProductionStatus() {
    if (this.state.selectedItems.length === 0) return;

    try {
      const promises = this.state.selectedItems.map(id =>
        App.api.request(`/workorders/${id}`, {
          method: 'PATCH',
          body: { di_produksi: 'true' }
        })
      );

      await Promise.all(promises);

      App.ui.showToast("✅ Status berhasil diupdate ke 'Di Produksi'", "success");
      // Clear selection and reload
      this.state.selectedItems = [];
      this.loadWorkOrders(); // Refresh table

    } catch (err) {
      console.error("Bulk update failed", err);
      App.ui.showToast("Gagal update status otomatis", "error");
    }
  },

  async printSuratJalanWarna() {
    try {
      const content = document.getElementById("sj-warna-print-content");
      if (!content) {
        App.ui.showToast("Tidak ada surat jalan pewarnaan untuk dicetak", "error");
        return;
      }

      // Validasi ada item yang dipilih
      if (this.state.selectedItems.length === 0) {
        App.ui.showToast("Pilih minimal 1 item untuk dicetak", "error");
        return;
      }

      const vendor = this.elements.vendorSelect.value || "Vendor Pewarnaan";
      const selected = this.state.workOrders.filter(wo => this.state.selectedItems.includes(wo.id));
      const noSurat = this.generateNoSuratJalan();

      // Cetak dokumen
      document.body.classList.add("surat-jalan-print");
      window.print();
      setTimeout(() => document.body.classList.remove("surat-jalan-print"), 1500);

      // ✅ Simpan ke log database dengan error handling
      try {
        await this.saveSuratJalanLog({
          tipe: "VENDOR",
          noSurat,
          vendor,
          items: selected
        });

        // ✅ Hapus barang setelah berhasil disimpan
        this.removePrintedItems();

        App.ui.showToast(`Surat jalan ${noSurat} berhasil dicetak dan tersimpan ke log.`, "success");

        // ✅ Refresh log tab secara otomatis
        if (this.state.currentTab === 'log') {
          setTimeout(() => this.loadSuratJalanLog(), 1000);
        }

      } catch (saveError) {
        console.error("❌ Gagal menyimpan log:", saveError);
        App.ui.showToast("Surat jalan dicetak tapi gagal disimpan ke log", "warning");
      }

    } catch (err) {
      console.error("❌ Gagal mencetak surat jalan pewarnaan:", err);
      App.ui.showToast("Gagal mencetak surat jalan pewarnaan: " + err.message, "error");
    }
  },

  // ======================================================
  // 💾 SIMPAN SURAT JALAN LOG KE DATABASE - VERSI DIPERBAIKI
  // ======================================================
  async saveSuratJalanLog({ tipe = "VENDOR", noSurat, vendor, items }) {
    try {
      const totalQty = items.reduce((sum, wo) => sum + (parseFloat(wo.qty) || 0), 0);
      const totalItem = items.length;

      // ✅ DATA YANG SESUAI DENGAN BACKEND
      const payload = {
        tipe: tipe || "VENDOR",
        vendor: vendor || "-",
        customer: "-", // ✅ JANGAN null, gunakan string kosong
        no_invoice: "-",
        items: items.map(wo => ({
          id: wo.id, // ✅ WAJIB: untuk update status di_warna
          nama_customer: wo.nama_customer || "-",
          deskripsi: wo.deskripsi || "-",
          ukuran: (parseFloat(wo.ukuran || 0) - 0.2).toFixed(2),
          qty: parseFloat(wo.qty) || 0
        })),
        total_item: totalItem,
        total_qty: totalQty,
        catatan: this.elements.catatan?.value || "-",
        dibuat_oleh: App.state.user?.username || "admin" // ✅ gunakan username bukan name
      };

      console.log("📦 Saving surat jalan log:", payload);

      const result = await App.api.request("/api/suratjalan-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log(`✅ Surat Jalan ${noSurat} tersimpan ke log:`, result);
      return result;

    } catch (err) {
      console.error("❌ Gagal menyimpan log surat jalan:", err);
      throw new Error("Gagal menyimpan log surat jalan: " + err.message);
    }
  },

  removePrintedItems() {
    // Ambil semua ID barang yang sudah dicetak
    const printedIds = [...this.state.selectedItems];

    // Hapus dari state workOrders
    this.state.workOrders = this.state.workOrders.filter(wo => !printedIds.includes(wo.id));

    // Kosongkan selectedItems
    this.state.selectedItems = [];

    // Render ulang tabel
    this.renderWorkOrdersTable();

    // Reset preview area
    this.elements.printWarnaArea.innerHTML = `<div class="text-center text-gray-500 py-8">Belum ada item dipilih</div>`;
    this.elements.printWarnaBtn.disabled = true;
  },

  setLoadingState(isLoading) {
    this.state.isLoading = isLoading;
    [this.elements.printBtn, this.elements.printWarnaBtn, this.elements.searchBtn].forEach(btn => {
      if (btn) {
        btn.disabled = isLoading;
        btn.classList.toggle("opacity-50", isLoading);
      }
    });
  }
};

// ======================================================
// 💵 KEUANGAN PAGE - FIXED VERSION
// ======================================================
App.pages["keuangan"] = {
  state: { saldo: [], riwayat: [] },
  elements: {},

  async init() {
    // ✅ PERBAIKI SELECTOR - sesuaikan dengan HTML
    this.elements.saldoBcaToto = document.getElementById("saldo-bca-toto");
    this.elements.saldoBcaYanto = document.getElementById("saldo-bca-yanto");
    this.elements.saldoCash = document.getElementById("saldo-cash");
    this.elements.saldoTotal = document.getElementById("saldo-total");
    this.elements.transaksiForm = document.getElementById("keuangan-form");
    this.elements.riwayatTableBody = document.getElementById("riwayat-keuangan-table-body");
    this.elements.monthFilter = document.getElementById("keuangan-month-filter");
    this.elements.yearFilter = document.getElementById("keuangan-year-filter");
    this.elements.filterBtn = document.getElementById("filter-keuangan-btn");

    // ✅ Set tanggal default ke hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaksi-tanggal').value = today;

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.transaksiForm?.addEventListener("submit", (e) => this.submitTransaksi(e));
    this.elements.filterBtn?.addEventListener("click", () => this.loadRiwayat());

    // ➕ EXPORT BUTTON
    if (!document.getElementById('export-keuangan-btn')) {
      const filterParent = this.elements.filterBtn?.parentElement;
      if (filterParent) {
        const exportBtn = document.createElement('button');
        exportBtn.id = 'export-keuangan-btn';
        exportBtn.className = 'ml-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition flex items-center';
        exportBtn.innerHTML = '📊 Export Excel';
        exportBtn.onclick = () => this.exportData();
        filterParent.appendChild(exportBtn);
      }
    }

    await this.loadSaldo();
    await this.loadRiwayat();
  },

  async loadSaldo() {
    try {
      const data = await App.api.request("/api/keuangan/saldo");
      this.state.saldo = data;
      this.renderSaldo(data);
    } catch (err) {
      console.error("❌ Gagal load saldo:", err);
      App.ui.showToast("Gagal memuat data saldo", "error");
      // ✅ FALLBACK: Set saldo default
      this.setDefaultSaldo();
    }
  },

  renderSaldo(data) {
    if (!data || data.length === 0) {
      this.setDefaultSaldo();
      return;
    }

    console.log("📊 Data saldo dari server:", data);

    // ✅ UPDATE SALDO MANUAL berdasarkan data dari server
    let totalSaldo = 0;

    data.forEach(kas => {
      const saldo = parseFloat(kas.saldo) || 0;
      totalSaldo += saldo;

      switch (kas.id) {
        case 1: // Bank BCA Toto
          this.elements.saldoBcaToto.textContent = App.ui.formatRupiah(saldo);
          break;
        case 2: // Bank BCA Yanto
          this.elements.saldoBcaYanto.textContent = App.ui.formatRupiah(saldo);
          break;
        case 3: // Cash
          this.elements.saldoCash.textContent = App.ui.formatRupiah(saldo);
          break;
      }
    });

    // ✅ UPDATE TOTAL SALDO
    this.elements.saldoTotal.textContent = App.ui.formatRupiah(totalSaldo);
  },

  setDefaultSaldo() {
    // ✅ SET DEFAULT JIKA DATA TIDAK ADA
    this.elements.saldoBcaToto.textContent = 'Rp 0';
    this.elements.saldoBcaYanto.textContent = 'Rp 0';
    this.elements.saldoCash.textContent = 'Rp 0';
    this.elements.saldoTotal.textContent = 'Rp 0';
  },

  async submitTransaksi(e) {
    e.preventDefault();

    // ✅ PERBAIKI FORM DATA - ambil langsung dari element
    const data = {
      tanggal: document.getElementById('transaksi-tanggal').value,
      jumlah: parseFloat(document.getElementById('transaksi-jumlah').value || 0),
      tipe: document.getElementById('transaksi-tipe').value,
      kas_id: parseInt(document.getElementById('transaksi-kas').value),
      keterangan: document.getElementById('transaksi-keterangan').value.trim()
    };

    // ✅ VALIDASI INPUT
    if (!data.tanggal) {
      App.ui.showToast("Tanggal harus diisi", "error");
      return;
    }
    if (data.jumlah <= 0) {
      App.ui.showToast("Jumlah harus lebih dari 0", "error");
      return;
    }
    if (!data.keterangan) {
      App.ui.showToast("Keterangan harus diisi", "error");
      return;
    }

    try {
      console.log("📤 Mengirim transaksi:", data);

      const result = await App.api.request("/api/keuangan/transaksi", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      App.ui.showToast("Transaksi berhasil disimpan!", "success");

      // ✅ RESET FORM
      this.elements.transaksiForm.reset();

      // ✅ SET TANGGAL DEFAULT KE HARI INI SETELAH RESET
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('transaksi-tanggal').value = today;

      // ✅ RELOAD DATA SETELAH SIMPAN
      await this.loadSaldo();
      await this.loadRiwayat();

    } catch (err) {
      console.error("❌ Transaksi error:", err);
      App.ui.showToast("Gagal menyimpan transaksi: " + err.message, "error");
    }
  },

  async loadRiwayat() {
    try {
      const month = this.elements.monthFilter?.value || new Date().getMonth() + 1;
      const year = this.elements.yearFilter?.value || new Date().getFullYear();

      console.log(`📅 Loading riwayat untuk: ${month}-${year}`);

      const data = await App.api.request(`/api/keuangan/riwayat?month=${month}&year=${year}`);
      this.state.riwayat = data;
      this.renderRiwayat(data);
    } catch (err) {
      console.error("❌ Riwayat error:", err);
      App.ui.showToast("Gagal memuat riwayat transaksi", "error");
    }
  },

  renderRiwayat(data) {
    if (!this.elements.riwayatTableBody) return;

    if (!data || data.length === 0) {
      this.elements.riwayatTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-8 text-center text-[#8B5E34]">
            Tidak ada riwayat transaksi untuk periode yang dipilih
          </td>
        </tr>
      `;
      return;
    }

    // ✅ SESUAIKAN DENGAN STRUCTURE TABLE HTML ANDA
    this.elements.riwayatTableBody.innerHTML = data.map(transaksi => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 text-sm">${App.ui.formatDate(transaksi.tanggal)}</td>
        <td class="px-6 py-4 text-sm">${transaksi.keterangan || '-'}</td>
        <td class="px-6 py-4 text-sm">${transaksi.nama_kas}</td>
        <td class="px-6 py-4 text-sm">
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${transaksi.tipe === 'PEMASUKAN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }">
            ${transaksi.tipe}
          </span>
        </td>
        <td class="px-6 py-4 text-sm text-right font-medium ${transaksi.tipe === 'PEMASUKAN' ? 'text-green-600' : 'text-red-600'
      }">
          ${transaksi.tipe === 'PEMASUKAN' ? '+' : '-'}${App.ui.formatRupiah(transaksi.jumlah)}
        </td>
      </tr>
    `).join('');
  },

  exportData() {
    if (!this.state.riwayat || this.state.riwayat.length === 0) {
      App.ui.showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    try {
      // Prepare data
      const dataToExport = this.state.riwayat.map(item => ({
        Tanggal: item.tanggal ? item.tanggal.substring(0, 10) : '-',
        Keterangan: item.keterangan || '-',
        Akun_Kas: item.nama_kas,
        Tipe: item.tipe,
        Jumlah: item.jumlah,
        Dibuat_Oleh: item.username || '-'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Auto width approximation
      const wscols = [
        { wch: 15 }, // Tanggal
        { wch: 40 }, // Keterangan
        { wch: 15 }, // Kas
        { wch: 15 }, // Tipe
        { wch: 20 }, // Jumlah
        { wch: 15 }  // Dibuat Oleh
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, "Riwayat Keuangan");

      const m = this.elements.monthFilter?.value || '00';
      const y = this.elements.yearFilter?.value || '0000';
      const fileName = `Keuangan_${m}-${y}.xlsx`;

      XLSX.writeFile(wb, fileName);
      App.ui.showToast("Excel berhasil diunduh", "success");

    } catch (err) {
      console.error("Export error:", err);
      App.ui.showToast("Gagal melakukan export Excel. Pastikan library XLSX termuat.", "error");
    }
  }
};

// ======================================================
// 👑 ADMIN PAGE
// ======================================================
// ======================================================
// 🧾 INVOICE PAGE (NEW IMPLEMENTATION)
// ======================================================
App.pages["invoice"] = {
  state: {
    summary: { total: 0, paid: 0, unpaid: 0 }
  },
  elements: {},

  async init() {
    console.log("🧾 Invoice Page INIT");

    // Initialize Elements
    this.elements = {
      monthFilter: document.getElementById("invoice-month-filter"),
      yearFilter: document.getElementById("invoice-year-filter"),
      filterBtn: document.getElementById("filter-invoice-summary-btn"),

      // Summary Cards
      cardTotal: document.getElementById("total-invoice-card"),
      cardPaid: document.getElementById("paid-invoice-card"),
      cardUnpaid: document.getElementById("unpaid-invoice-card"),

      // Search & Print
      searchInput: document.getElementById("invoice-search-input"),
      searchBtn: document.getElementById("invoice-search-btn"),
      printArea: document.getElementById("invoice-print-area"),
      printBtn: document.getElementById("invoice-print-btn"),

      // DP & Diskon Fields
      dpInput: document.getElementById("dp-amount"),
      discInput: document.getElementById("discount"),
      discPercentInput: document.getElementById("discount-percentage"),
      catatanInput: document.getElementById("invoice-catatan"),

      // Actions
      clearBtn: document.getElementById("clear-fields-btn"),
      resetPaymentBtn: document.getElementById("reset-payment-btn")
    };

    // Populate Filters
    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    // Set listeners
    this.elements.filterBtn?.addEventListener("click", () => this.loadSummary());

    this.elements.searchBtn?.addEventListener("click", () => this.searchInvoice());
    this.elements.searchInput?.addEventListener("keypress", (e) => {
      if (e.key === 'Enter') this.searchInvoice();
    });

    this.elements.clearBtn?.addEventListener("click", () => this.clearForm());
    this.elements.resetPaymentBtn?.addEventListener("click", () => {
      if (this.elements.dpInput) this.elements.dpInput.value = 0;
      if (this.elements.discInput) this.elements.discInput.value = 0;
      if (this.elements.discPercentInput) this.elements.discPercentInput.value = 0;
    });

    this.elements.printBtn?.addEventListener("click", () => this.printInvoice());

    // Load initial summary
    await this.loadSummary();
  },

  async loadSummary() {
    try {
      const month = this.elements.monthFilter?.value || new Date().getMonth() + 1;
      const year = this.elements.yearFilter?.value || new Date().getFullYear();

      const summary = await App.api.request(`/api/invoices/summary?month=${month}&year=${year}`);
      this.state.summary = summary;

      if (this.elements.cardTotal) this.elements.cardTotal.querySelector("p.text-2xl").textContent = App.ui.formatRupiah(summary.total_invoice || 0);
      if (this.elements.cardPaid) this.elements.cardPaid.querySelector("p.text-2xl").textContent = App.ui.formatRupiah(summary.total_paid || 0);
      if (this.elements.cardUnpaid) this.elements.cardUnpaid.querySelector("p.text-2xl").textContent = App.ui.formatRupiah(summary.total_unpaid || 0);

    } catch (err) {
      console.error("❌ Failed to load invoice summary:", err);
    }
  },

  updateSummary(data) {
    // Legacy method kept empty
  },



  async searchInvoice() {
    const invoiceNo = this.elements.searchInput?.value.trim();
    if (!invoiceNo) return App.ui.showToast("Masukkan nomor invoice", "error");

    try {
      // Reuse existing search functionality logic or new endpoint?
      // We can use the existing search endpoint used in Surat Jalan if available or create one.
      // However, for Invoice printing, we need full details + payment info.
      // For now, let's look at `surat-jalan` searchByInvoice logic (line 5255).
      // It uses `/api/invoice-search/${invoiceNo}`. Let's use that!

      const result = await App.api.request(`/api/invoice-search/${invoiceNo}`);

      if (result && result.length > 0) {
        this.renderInvoicePreview(result, invoiceNo);
        if (this.elements.printBtn) this.elements.printBtn.disabled = false;
        App.ui.showToast("Invoice ditemukan", "success");
      } else {
        this.elements.printArea.innerHTML = `<div class="text-center py-12 text-gray-500">Invoice tidak ditemukan</div>`;
        if (this.elements.printBtn) this.elements.printBtn.disabled = true;
      }
    } catch (err) {
      console.error("❌ Search error:", err);
      App.ui.showToast("Gagal mencari invoice", "error");
    }
  },

  renderInvoicePreview(data, invoiceNo) {
    // Calculate totals
    let totalAmount = 0;
    data.forEach(item => {
      // Clean size string
      const ukuran = parseFloat(item.ukuran) || 0;
      const qty = parseFloat(item.qty) || 0;
      const harga = parseFloat(item.harga) || 0;
      totalAmount += (ukuran * qty * harga);
    });

    const dp = parseFloat(this.elements.dpInput?.value) || 0;
    let discount = parseFloat(this.elements.discInput?.value) || 0;
    const discPercent = parseFloat(this.elements.discPercentInput?.value) || 0;

    if (discPercent > 0) {
      discount = totalAmount * (discPercent / 100);
    }

    const grandTotal = totalAmount - discount;
    const sisa = grandTotal - dp;

    const customerName = data[0].nama_customer || '-';
    const today = new Date().toLocaleDateString('id-ID');

    this.elements.printArea.innerHTML = `
        <div id="invoice-content-to-print" class="p-8 bg-white text-sm">
           <div class="flex justify-between items-start mb-8 border-b pb-4">
               <div>
                   <h1 class="text-2xl font-bold text-[#5C4033] mb-1">INVOICE</h1>
                   <p class="font-bold">CV. TOTO ALUMINIUM MANUFACTURE</p>
                   <p>Jl. Rawa Mulya, Kota Bekasi</p>
                   <p>Telp: 0813 1191 2002</p>
               </div>
               <div class="text-right">
                   <p class="text-gray-600">No. Invoice</p>
                   <p class="text-xl font-bold mb-2">${invoiceNo}</p>
                   <p class="text-gray-600">Tanggal</p>
                   <p class="font-bold">${today}</p>
                   <p class="mt-2 text-gray-600">Customer</p>
                   <p class="font-bold">${customerName}</p>
               </div>
           </div>
           
           <table class="w-full mb-8">
               <thead class="bg-gray-100 border-b-2 border-gray-200">
                   <tr>
                       <th class="text-left py-2 px-2">No</th>
                       <th class="text-left py-2 px-2">Deskripsi</th>
                       <th class="text-center py-2 px-2">Ukuran</th>
                       <th class="text-center py-2 px-2">Qty</th>
                       <th class="text-right py-2 px-2">Harga</th>
                       <th class="text-right py-2 px-2">Total</th>
                   </tr>
               </thead>
               <tbody>
                   ${data.map((item, index) => {
      const ukuran = parseFloat(item.ukuran) || 0;
      const qty = parseFloat(item.qty) || 0;
      const harga = parseFloat(item.harga) || 0;
      const subtotal = ukuran * qty * harga;
      return `
                       <tr class="border-b border-gray-100">
                           <td class="py-2 px-2">${index + 1}</td>
                           <td class="py-2 px-2">${item.deskripsi || '-'}</td>
                           <td class="text-center py-2 px-2">${item.ukuran}</td>
                           <td class="text-center py-2 px-2">${qty}</td>
                           <td class="text-right py-2 px-2">${App.ui.formatRupiah(harga)}</td>
                           <td class="text-right py-2 px-2">${App.ui.formatRupiah(subtotal)}</td>
                       </tr>
                       `;
    }).join('')}
               </tbody>
           </table>
           
           <div class="flex justify-end">
               <div class="w-1/2">
                   <div class="flex justify-between mb-2">
                       <span>Total</span>
                       <span class="font-bold">${App.ui.formatRupiah(totalAmount)}</span>
                   </div>
                   ${discount > 0 ? `
                   <div class="flex justify-between mb-2 text-red-600">
                       <span>Diskon</span>
                       <span>- ${App.ui.formatRupiah(discount)}</span>
                   </div>
                   ` : ''}
                   <div class="flex justify-between mb-2 border-t pt-2">
                       <span class="font-bold">Grand Total</span>
                       <span class="font-bold text-lg">${App.ui.formatRupiah(grandTotal)}</span>
                   </div>
                   ${dp > 0 ? `
                   <div class="flex justify-between mb-2 text-green-600">
                       <span>DP / Bayar</span>
                       <span>- ${App.ui.formatRupiah(dp)}</span>
                   </div>
                   <div class="flex justify-between mb-2 border-t pt-2">
                       <span class="font-bold">Sisa Pembayaran</span>
                       <span class="font-bold text-xl text-[#A67B5B]">${App.ui.formatRupiah(sisa)}</span>
                   </div>
                   ` : ''}
                   
                   ${this.elements.catatanInput?.value ? `
                   <div class="mt-4 p-2 bg-gray-50 text-xs italic">
                       Catatan: ${this.elements.catatanInput.value}
                   </div>
                   ` : ''}
               </div>
           </div>
           
           <div class="mt-12 text-center text-xs text-gray-500">
               <p>Terima kasih atas kepercayaan Anda</p>
           </div>
        </div>
      `;
  },

  printInvoice() {
    const content = document.getElementById("invoice-content-to-print");
    if (!content) return;

    App.ui.printElement("invoice-print-area");
  },

  clearForm() {
    if (this.elements.searchInput) this.elements.searchInput.value = '';
    if (this.elements.dpInput) this.elements.dpInput.value = 0;
    if (this.elements.discInput) this.elements.discInput.value = 0;
    if (this.elements.discPercentInput) this.elements.discPercentInput.value = 0;
    this.elements.printArea.innerHTML = `
          <div class="text-center py-12">
             <div class="max-w-md mx-auto">
                 <p class="text-gray-500 text-sm">Pratinjau dibersihkan.</p>
             </div>
          </div>
      `;
    if (this.elements.printBtn) this.elements.printBtn.disabled = true;
  }
};

App.pages["admin"] = {
  state: { users: [] },
  elements: {},

  async init() {
    // Check if user is admin
    if (App.state.user?.username?.toLowerCase() !== "faisal") {
      window.location.href = "dashboard.html";
      return;
    }

    this.elements.usersContainer = document.getElementById("users-container");
    await this.loadUsers();
  },

  async loadUsers() {
    try {
      const data = await App.api.request("/users");
      this.state.users = data;
      this.renderUsers(data);
      App.ui.showToast("Data user berhasil dimuat", "success");
    } catch (err) {
      console.error("❌ Gagal load users:", err);
      App.ui.showToast("Gagal memuat data user", "error");
    }
  },

  renderUsers(data) {
    if (!this.elements.usersContainer) return;

    if (!data || data.length === 0) {
      this.elements.usersContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Tidak ada data user</p>
        </div>
      `;
      return;
    }

    this.elements.usersContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Username</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Status Langganan</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(user => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium">${user.username}</td>
                <td class="px-4 py-3 text-sm">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
      }">
                    ${user.role}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }">
                    ${user.subscription_status || 'inactive'}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm">
                  ${user.role !== 'admin' ? `
                    <div class="flex space-x-2">
                      <button onclick="App.pages.admin.activateUser(${user.id}, 'active')" 
                              class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                        Aktifkan
                      </button>
                      <button onclick="App.pages.admin.activateUser(${user.id}, 'inactive')" 
                              class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                        Nonaktifkan
                      </button>
                    </div>
                  ` : '<span class="text-gray-500">-</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async activateUser(userId, status) {
    if (!confirm(`Apakah Anda yakin ingin ${status === 'active' ? 'mengaktifkan' : 'menonaktifkan'} user ini?`)) {
      return;
    }

    try {
      await App.api.request(`/admin/users/${userId}/activate`, {
        method: "POST",
        body: { status }
      });

      App.ui.showToast(`User berhasil di${status === 'active' ? 'aktifkan' : 'nonaktifkan'}`, "success");
      await this.loadUsers();
    } catch (err) {
      console.error("❌ Activate user error:", err);
      App.ui.showToast("Gagal mengubah status user", "error");
    }
  }
};

// ======================================================
// 👤 PROFILE PAGE DISPLAY LOGIC
// ======================================================

// Helper to resolve image URL globally
App.ui.resolveImageUrl = function (url) {
  if (!url) return "https://placehold.co/128x128/F5EBDD/5C4033?text=Foto";
  if (url.startsWith("http") || url.startsWith("data:")) return url;

  // Clean URL
  const cleanUrl = url.startsWith("/") ? url : "/" + url;

  // Use current origin
  return window.location.origin + cleanUrl;
};

App.ui.updateUserDisplay = function (user) {
  const userDisplay = document.getElementById("user-display");
  const userAvatar = document.getElementById("user-avatar");

  if (userDisplay) userDisplay.textContent = user.username || "Pengguna";

  if (userAvatar) {
    if (user.profile_picture_url) {
      const imgUrl = App.ui.resolveImageUrl(user.profile_picture_url);
      userAvatar.src = imgUrl;
      userAvatar.classList.remove("hidden");

      // Add error handler to revert to placeholder if 404
      userAvatar.onerror = function () {
        this.onerror = null; // Prevent infinite loop
        this.src = "https://placehold.co/128x128/F5EBDD/5C4033?text=Error";
      };
    } else {
      // Use default if no URL
      userAvatar.src = "https://placehold.co/128x128/F5EBDD/5C4033?text=" + (user.username ? user.username.charAt(0).toUpperCase() : "U");
      userAvatar.classList.remove("hidden");
    }
  }
};

// ======================================================
// 👤 PROFILE PAGE LOGIC (Fixed)
// ======================================================
App.pages["profil"] = {
  elements: {},
  state: {
    user: null
  },

  async init() {
    console.log("👤 Profile Page INIT");

    this.elements = {
      form: document.getElementById("update-profile-form"),
      fileInput: document.getElementById("profile-picture-input"),
      previewImg: document.getElementById("profile-preview"),
      usernameInput: document.getElementById("username"),
      passwordForm: document.getElementById("change-password-form"),

      // Password inputs
      oldPass: document.getElementById("old-password"),
      newPass: document.getElementById("new-password"),
      confirmPass: document.getElementById("confirm-password")
    };

    if (!this.elements.form) {
      console.warn("❌ Profile form elements not found");
      return;
    }

    await this.loadProfile();
    this.setupEventListeners();
  },

  async loadProfile() {
    try {
      const user = await App.safeGetUser();
      if (!user) return;
      this.state.user = user;

      // Set username
      if (this.elements.usernameInput) this.elements.usernameInput.value = user.username || "";

      // Set avatar preview
      if (this.elements.previewImg) {
        this.elements.previewImg.src = this._resolveUrl(user.profile_picture_url);
      }

      // Update header too
      App.ui.updateUserDisplay(user);
    } catch (err) {
      console.error("❌ Failed to load profile:", err);
    }
  },

  setupEventListeners() {
    // 1. Preview Image on File Selection
    this.elements.fileInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        if (this.elements.previewImg) this.elements.previewImg.src = url;
      }
    });

    // 2. Handle Profile Update (Username + Photo)
    const handleUpdate = (e) => this.handleProfileUpdate(e);

    this.elements.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      handleUpdate(e);
    });

    // Backup: Catch button click just in case
    if (this.elements.saveBtn) {
      this.elements.saveBtn.type = "submit"; // Ensure it is submit
      this.elements.saveBtn.onclick = (e) => {
        // Let form submit handle it usually
      };
    }

    // 3. Handle Password Change
    this.elements.passwordForm?.addEventListener("submit", (e) => this.handleChangePassword(e));
  },

  async handleProfileUpdate(e) {
    if (e && e.preventDefault) e.preventDefault();

    const btn = this.elements.form.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Menyimpan...";
    btn.disabled = true;

    try {
      const username = this.elements.usernameInput.value.trim();
      const file = this.elements.fileInput.files[0];

      if (!file) {
        // JSON Update (Only username)
        const payload = { username };
        const res = await App.api.request("/user/profile", { method: "PUT", body: payload });
        console.log("Profile updated (JSON):", res);

        App.state.user = res;
        App.ui.showToast("Profil berhasil diperbarui", "success");
        App.ui.updateUserDisplay(res); // Sync header
      } else {
        // FormData Update (Username + File)
        const fd = new FormData();
        fd.append("username", username);
        fd.append("profilePicture", file);

        const token = App.getToken();
        const url = (App.api.baseUrl || window.location.origin) + "/api/user/profile";

        const resp = await fetch(url, {
          method: "PUT",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd
        });

        if (!resp.ok) throw new Error("Gagal upload foto");

        const data = await resp.json();
        App.state.user = data;
        App.ui.showToast("Foto profil berhasil diupload", "success");
        App.ui.updateUserDisplay(data); // Sync header

        // Update URL to verified one
        if (this.elements.previewImg) {
          this.elements.previewImg.src = this._resolveUrl(data.profile_picture_url);
        }

        // Update global avatar if exists
        const globalAvatar = document.getElementById("user-avatar");
        if (globalAvatar) globalAvatar.src = this._resolveUrl(data.profile_picture_url);
      }

    } catch (err) {
      console.error("Profile update error:", err);
      App.ui.showToast("Gagal update profil: " + err.message, "error");
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  },

  async handleChangePassword(e) {
    e.preventDefault();
    const oldPass = this.elements.oldPass.value;
    const newPass = this.elements.newPass.value;
    const confirmPass = this.elements.confirmPass.value;

    if (newPass !== confirmPass) {
      App.ui.showToast("Konfirmasi password tidak cocok", "error");
      return;
    }

    try {
      await App.api.request("/user/change-password", {
        method: "POST",
        body: { oldPassword: oldPass, newPassword: newPass }
      });
      App.ui.showToast("Password berhasil diubah", "success");
      e.target.reset();
    } catch (err) {
      console.error("Change password error:", err);
      App.ui.showToast("Gagal ubah password: " + (err.message || 'Error'), "error");
    }
  },

  _resolveUrl(url) {
    return App.ui.resolveImageUrl(url);
  }
};

// ======================================================
// 🍔 SIDEBAR SYSTEM — FINAL FIXED VERSION
// ======================================================

// 🔧 INITIALIZE SIDEBAR SYSTEM
App.ui.initSidebar = function () {
  console.log("🔧 Initializing sidebar system...");

  const container = document.getElementById("app-container");
  if (!container) {
    console.warn("⏳ app-container not found, retrying...");
    setTimeout(() => this.initSidebar(), 200);
    return;
  }

  this.setupHamburgerButton();
  this.setupBackdropHandler();
  this.setupEscapeHandler();
  this.setupResizeHandler();
  this.applyInitialSidebarState();

  console.log("✅ Sidebar system initialized");
};

// ======================================================
// 🍔 HAMBURGER BUTTON — FIXED
// ======================================================
App.ui.setupHamburgerButton = function () {
  const toggleBtn = document.getElementById("sidebar-toggle-btn");

  if (!toggleBtn) {
    console.warn("⚠️ Hamburger button not found (#sidebar-toggle-btn)");
    return;
  }

  console.log("🔧 Setting up hamburger button...");

  // Remove existing listeners
  const newToggleBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

  // Add click listener
  newToggleBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("🍔 Hamburger button clicked");
    this.toggleSidebar();
  });

  console.log("✅ Hamburger button ready");
};

// ======================================================
// 🎯 SIDEBAR TOGGLE HANDLER
// ======================================================
App.ui.toggleSidebar = function () {
  const container = document.getElementById("app-container");
  const sidebar = document.getElementById("sidebar");

  if (!container || !sidebar) return;

  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    const opening = !container.classList.contains("sidebar-open");

    if (opening) {
      container.classList.add("sidebar-open");
      this.ensureSidebarBackdrop(true);
      document.body.style.overflow = "hidden";
    } else {
      container.classList.remove("sidebar-open");
      this.ensureSidebarBackdrop(false);
      document.body.style.overflow = "";
    }
  } else {
    const collapsed = container.classList.contains("sidebar-collapsed");
    container.classList.toggle("sidebar-collapsed");

    localStorage.setItem("sidebarCollapsed", collapsed ? "0" : "1");
  }
};

// ======================================================
// 🏁 APPLY INITIAL SIDEBAR STATE
// ======================================================
App.ui.applyInitialSidebarState = function () {
  const container = document.getElementById("app-container");
  if (!container) return;

  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    container.classList.remove("sidebar-collapsed");
    container.classList.remove("sidebar-open");
    this.ensureSidebarBackdrop(false);
  } else {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "1") container.classList.add("sidebar-collapsed");
    else container.classList.remove("sidebar-collapsed");
  }
};

// ======================================================
// ◼️ BACKDROP HELPER
// ======================================================
// ======================================================
// 📦 AMBIL BAHAN LOGIC (STOCK DEDUCTION)
// ======================================================
App.ambilBahan = {
  elements: {
    modal: document.getElementById('ambil-bahan-modal'),
    title: document.getElementById('ambil-bahan-title'),
    list: document.getElementById('ambil-bahan-list'),
    search: document.getElementById('ambil-bahan-search'),
    saveBtn: document.getElementById('ambil-bahan-save-btn'),
    cancelBtn: document.getElementById('ambil-bahan-cancel-btn')
  },
  currentWOId: null,
  stockData: [],

  init() {
    this.elements = {
      modal: document.getElementById('ambil-bahan-modal'),
      title: document.getElementById('ambil-bahan-title'),
      list: document.getElementById('ambil-bahan-list'),
      search: document.getElementById('ambil-bahan-search'),
      saveBtn: document.getElementById('ambil-bahan-save-btn'),
      cancelBtn: document.getElementById('ambil-bahan-cancel-btn')
    };

    this.elements.cancelBtn?.addEventListener('click', () => this.close());
    this.elements.saveBtn?.addEventListener('click', () => this.save());
    this.elements.search?.addEventListener('input', (e) => this.renderList(e.target.value));
  },

  async open(woId) {
    this.currentWOId = woId;
    if (this.elements.title) this.elements.title.textContent = `Ambil Bahan untuk WO #${woId}`;
    if (this.elements.modal) {
      this.elements.modal.classList.remove('hidden');
      setTimeout(() => this.elements.modal.classList.remove('opacity-0'), 10);
    }

    // Load Stock Data
    this.elements.list.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm">⏳ Memuat data stok...</div>`;
    try {
      const res = await App.api.request('/api/stok');
      this.stockData = Array.isArray(res) ? res : [];
      this.renderList();
    } catch (err) {
      this.elements.list.innerHTML = `<div class="p-4 text-center text-red-500 text-sm">Gagal memuat stok.</div>`;
    }
  },

  close() {
    if (this.elements.modal) {
      this.elements.modal.classList.add('opacity-0');
      setTimeout(() => this.elements.modal.classList.add('hidden'), 300);
    }
    this.stockData = [];
    this.currentWOId = null;
    if (this.elements.search) this.elements.search.value = '';
  },

  renderList(filter = '') {
    if (!this.stockData || this.stockData.length === 0) {
      this.elements.list.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm">Stok kosong.</div>`;
      return;
    }

    const filtered = this.stockData.filter(item =>
      (item.nama_bahan || '').toLowerCase().includes(filter.toLowerCase()) ||
      (item.kode_bahan || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      this.elements.list.innerHTML = `<div class="p-4 text-center text-gray-500 text-sm">Tidak ditemukan.</div>`;
      return;
    }

    // Recommended items could be pinned to top, but for now just list all
    this.elements.list.innerHTML = filtered.map(item => `
        <div class="px-4 py-2 flex items-center border-b hover:bg-gray-50 transition-colors">
            <div class="w-1/2">
                <div class="text-xs font-bold text-gray-800">${item.nama_bahan}</div>
                <div class="text-[10px] text-gray-500">${item.kode_bahan}</div>
            </div>
            <div class="w-1/4 text-center text-xs font-medium ${item.stok <= 5 ? 'text-red-600' : 'text-gray-600'}">
                ${item.stok} ${item.satuan}
            </div>
            <div class="w-1/4 flex justify-center">
                <input type="number" 
                       data-id="${item.id}" 
                       class="ambil-qty-input w-20 border border-gray-300 rounded px-2 py-1 text-xs text-center focus:ring-[#A67B5B] focus:border-[#A67B5B]"
                       placeholder="0" min="0" max="${item.stok}">
            </div>
        </div>
    `).join('');
  },

  async save() {
    const inputs = document.querySelectorAll('.ambil-qty-input');
    const toDeduct = [];

    inputs.forEach(input => {
      const val = parseFloat(input.value);
      if (val > 0) {
        toDeduct.push({
          bahan_id: input.dataset.id,
          jumlah: val
        });
      }
    });

    if (toDeduct.length === 0) {
      App.ui.showToast("Tidak ada bahan yang dipilih.", "warning");
      return;
    }

    if (!confirm(`Konfirmasi ambil ${toDeduct.length} item bahan?`)) return;

    // Process Deductions
    this.elements.saveBtn.disabled = true;
    this.elements.saveBtn.textContent = "Menyimpan...";

    try {
      // Since we don't have a bulk endpoint yet, we loop. 
      // Ideally backend should support bulk, but loop is fine for MVP (usually < 5 items).
      for (const item of toDeduct) {
        await App.api.request('/api/stok/update', {
          method: 'POST',
          body: {
            bahan_id: item.bahan_id,
            tipe: 'KELUAR',
            jumlah: item.jumlah,
            keterangan: `Used for WO #${this.currentWOId}`
          }
        });
      }

      App.ui.showToast("✅ Bahan berhasil diambil", "success");
      this.close();
    } catch (err) {
      console.error(err);
      App.ui.showToast("Gagal menyimpan sebagian data.", "error");
      this.elements.saveBtn.disabled = false;
      this.elements.saveBtn.textContent = "Simpan Pengambilan";
    }
  }
};

// Initializer helper
document.addEventListener("DOMContentLoaded", () => {
  // Add init call
  setTimeout(() => { if (App.ambilBahan) App.ambilBahan.init(); }, 1500);
});

App.ui.ensureSidebarBackdrop = function (show) {
  let backdrop = document.getElementById("sidebar-backdrop");

  if (!backdrop && show) {
    backdrop = document.createElement("div");
    backdrop.id = "sidebar-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 40;
      display: none;
      opacity: 0;
      transition: opacity .3s ease;
    `;
    document.body.appendChild(backdrop);
  }

  if (backdrop) {
    if (show) {
      backdrop.style.display = "block";
      requestAnimationFrame(() => (backdrop.style.opacity = "1"));
    } else {
      backdrop.style.opacity = "0";
      setTimeout(() => (backdrop.style.display = "none"), 300);
    }
  }
};

// ======================================================
// ⚫ BACKDROP CLICK HANDLER
// ======================================================
App.ui.setupBackdropHandler = function () {
  document.addEventListener("click", (e) => {
    const backdrop = document.getElementById("sidebar-backdrop");
    const container = document.getElementById("app-container");

    if (backdrop && e.target === backdrop) {
      container.classList.remove("sidebar-open");
      this.ensureSidebarBackdrop(false);
      document.body.style.overflow = "";
    }
  });
};

// ======================================================
// ⎋ ESC KEY CLOSE
// ======================================================
App.ui.setupEscapeHandler = function () {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const container = document.getElementById("app-container");
      if (container.classList.contains("sidebar-open")) {
        container.classList.remove("sidebar-open");
        this.ensureSidebarBackdrop(false);
        document.body.style.overflow = "";
      }
    }
  });
};

// ======================================================
// 📱 RESIZE HANDLER
// ======================================================
App.ui.setupResizeHandler = function () {
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const container = document.getElementById("app-container");
      if (!container) return;

      if (window.innerWidth <= 1024) {
        container.classList.remove("sidebar-collapsed");
        container.classList.remove("sidebar-open");
        this.ensureSidebarBackdrop(false);
      } else {
        const saved = localStorage.getItem("sidebarCollapsed");
        if (saved === "1") container.classList.add("sidebar-collapsed");
        container.classList.remove("sidebar-open");
      }
    }, 200);
  });
};


// ======================================================
// 🚀 INITIALIZATION YANG DIPERBAIKI
// ======================================================

// PASTIKAN di bagian DOMContentLoaded menggunakan:
document.addEventListener("DOMContentLoaded", function () {
  console.log('🚀 DOM Loaded - Initializing App');

  // Initialize App
  setTimeout(() => {
    App.init();
  }, 100);
});