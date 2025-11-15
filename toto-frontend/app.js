
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
      
      if (sidebarEl) sidebarEl.innerHTML = sidebarHTML;
      if (headerEl) headerEl.innerHTML = headerHTML;

      // Setup user data
      const user = await this.safeGetUser();
      if (!user) return;

      // Update user display
      const userDisplay = document.getElementById("user-display");
      const userAvatar = document.getElementById("user-avatar");
      
      if (userDisplay) userDisplay.textContent = user.username || "Pengguna";
      if (userAvatar) {
        if (user.profile_picture_url) {
          userAvatar.src = user.profile_picture_url;
          userAvatar.classList.remove("hidden");
        } else {
          userAvatar.classList.add("hidden");
        }
      }

      // Setup sidebar toggle
      this.setupSidebarToggle();

      // Setup page title
      this.setupPageTitle();

      // Setup sidebar navigation - FIXED VERSION
      this.setupSidebarNavigation();

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
        </div>
      `;
    }
  },

  // ======================================================
  // 🧭 SIDEBAR NAVIGATION SETUP - FIXED VERSION
  // ======================================================
  setupSidebarNavigation() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    // 1. Setup submenu toggle - FIXED
    sidebar.querySelectorAll(".collapsible > a").forEach((menuLink) => {
      // Skip if already has event listener
      if (menuLink.hasAttribute('data-has-listener')) return;
      
      menuLink.setAttribute('data-has-listener', 'true');
      
      menuLink.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const parent = menuLink.parentElement;
        const submenu = parent.querySelector(".submenu");
        const toggleIcon = parent.querySelector(".submenu-toggle");

        if (submenu) {
          const isHidden = submenu.classList.contains("hidden");
          
          // Close all other submenus first
          sidebar.querySelectorAll(".submenu").forEach((s) => {
            if (s !== submenu) {
              s.classList.add("hidden");
            }
          });
          
          sidebar.querySelectorAll(".submenu-toggle").forEach((icon) => {
            if (icon !== toggleIcon) {
              icon.style.transform = "rotate(0deg)";
            }
          });

          // Toggle current submenu
          if (isHidden) {
            submenu.classList.remove("hidden");
            if (toggleIcon) toggleIcon.style.transform = "rotate(180deg)";
          } else {
            submenu.classList.add("hidden");
            if (toggleIcon) toggleIcon.style.transform = "rotate(0deg)";
          }
        }
      });
    });

    // 2. Highlight active menu - FIXED
    const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";
    sidebar.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (href && (currentPath === href || currentPath.includes(href.replace('.html', '')))) {
        link.classList.add("bg-[#A67B5B]", "text-white", "font-semibold");
        link.classList.remove("text-gray-700", "hover:bg-gray-200");
        
        // Also highlight parent if in submenu
        const submenuItem = link.closest('.submenu');
        if (submenuItem) {
          const parentLink = submenuItem.previousElementSibling;
          if (parentLink && parentLink.tagName === 'A') {
            parentLink.classList.add("bg-[#A67B5B]", "text-white", "font-semibold");
            parentLink.classList.remove("text-gray-700", "hover:bg-gray-200");
          }
        }
      }
    });

    // 3. Hide admin menu if not admin
    const adminMenu = document.getElementById("admin-menu");
    if (this.state.user?.username?.toLowerCase() !== "faisal" && adminMenu) {
      adminMenu.style.display = "none";
    }

    // 4. Setup navigation clicks - FIXED
    sidebar.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (!link) return;

      const href = link.getAttribute("href");
      
      // Ignore # links and submenu toggles
      if (href === "#" || link.closest('.collapsible')) {
        return; // Let the submenu toggle handle it
      }

      // Handle actual page navigation
      if (href && href.endsWith(".html")) {
        e.preventDefault();
        console.log("🔄 Navigating to:", href);
        window.location.href = href;
      }
    });
  },

  setupSidebarToggle() {
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    const sidebar = document.getElementById("sidebar");

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("-translate-x-full");
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        
        // Save state to localStorage
        localStorage.setItem("sidebarCollapsed", this.state.sidebarCollapsed);
      });

      // Load saved state
      const savedState = localStorage.getItem("sidebarCollapsed");
      if (savedState === "true") {
        sidebar.classList.add("-translate-x-full");
        this.state.sidebarCollapsed = true;
      }
    }
  },

  setupPageTitle() {
    const pageTitle = document.getElementById("page-title");
    if (pageTitle) {
      const currentPage = window.location.pathname.split("/").pop().replace(".html", "") || "dashboard";
      const formatTitle = currentPage
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      pageTitle.textContent = formatTitle;
    }
  },

  setupLogoutButton() {
    const logoutBtn = document.getElementById("logout-button");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Apakah Anda yakin ingin logout?")) {
          this.clearToken();
          sessionStorage.clear();
          window.location.href = "index.html";
        }
      });
    }
  },

  // ======================================================
  // 🚀 APP INITIALIZATION
  // ======================================================
  async init() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    console.log('🚀 App.init -> page:', path);

    // If index (login) page
    if (path === 'index.html' || path === '' || path === 'login.html') {
      await this.initLoginPage();
      return;
    }

    // For other pages: must have token
    const token = this.getToken();
    if (!token) {
      console.warn('❌ Token tidak ditemukan, redirect ke login');
      window.location.href = 'index.html';
      return;
    }

    try {
      // Start socket early
      this.socketInit();

      // Load layout (sidebar + header)
      await this.loadLayout();

      // Initialize specific page
      await this.initCurrentPage(path);
      
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      this.ui.showToast('Gagal memuat aplikasi', 'error');
    }
  },

  async initLoginPage() {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    // If token exists and valid, redirect to dashboard
    const token = this.getToken();
    if (token) {
      try {
        // Quick token validation
        const user = await this.safeGetUser();
        if (user) {
          window.location.href = 'dashboard.html';
          return;
        }
      } catch (e) {
        // Token invalid, continue with login
        this.clearToken();
      }
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput?.value?.trim();
        const password = passwordInput?.value?.trim();
        
        if (!username || !password) {
          this.showLoginError('Username & password wajib diisi');
          return;
        }

        try {
          // Show loading state
          const submitBtn = loginForm.querySelector('button[type="submit"]');
          const originalText = submitBtn.textContent;
          submitBtn.textContent = 'Loading...';
          submitBtn.disabled = true;

          const res = await this.api.request('/login', { 
            method: 'POST', 
            body: { username, password } 
          });
          
          if (res.token) {
            this.setToken(res.token);
            localStorage.setItem('username', res.user.username);
            localStorage.setItem('role', res.user.role);
            this.ui.showToast('Login berhasil!', 'success');
            
            setTimeout(() => {
              window.location.href = 'dashboard.html';
            }, 1000);
          } else {
            throw new Error('Token tidak diterima');
          }
        } catch (err) {
          console.error('❌ Login failed:', err);
          this.showLoginError(err.message || 'Login gagal');
        } finally {
          // Reset button state
          const submitBtn = loginForm.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
          }
        }
      });
    }

    // Clear any existing errors on input
    [usernameInput, passwordInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          if (loginError) {
            loginError.classList.add('hidden');
          }
        });
      }
    });
  },

  showLoginError(message) {
    const loginError = document.getElementById('login-error');
    if (loginError) {
      loginError.textContent = message;
      loginError.classList.remove('hidden');
    }
    this.ui.showToast(message, 'error');
  },

  async initCurrentPage(path) {
    const pageName = path.replace('.html', '');
    console.log('📄 Load page:', pageName);

    if (this.pages[pageName] && typeof this.pages[pageName].init === 'function') {
      try {
        await this.pages[pageName].init();
        console.log(`✅ Page ${pageName} initialized successfully`);
      } catch (err) {
        console.error(`❌ Error initializing page ${pageName}:`, err);
        this.ui.showToast(`Gagal memuat halaman ${pageName}`, 'error');
      }
    } else {
      console.warn(`⚠️ No page handler found for: ${pageName}`);
    }
  }
};

// ======================================================
// 📄 PAGE DEFINITIONS - SEMUA PAGE LENGKAP
// ======================================================

// ======================================================
// 📊 DASHBOARD PAGE - WITH TABLE FILTERS
// ======================================================
// ======================================================
// 📊 DASHBOARD PAGE - DENGAN STATUS AKURAT & FILTER OTOMATIS
// ======================================================
App.pages["dashboard"] = {
  state: {
    currentData: [],
    currentTableFilter: "siap_kirim",
    tableData: {},
  },
  elements: {},

  // 🔹 Helper untuk normalisasi flag status
  normalizeStatusFlags(item) {
    const toBool = (v) =>
      v === true || v === "true" || v === "t" || v === 1 || v === "1";
    return {
      ...item,
      __status: {
        produksi: toBool(item.di_produksi),
        warna: toBool(item.di_warna),
        siap: toBool(item.siap_kirim),
        kirim: toBool(item.di_kirim),
      },
    };
  },

  init() {
    this.elements.monthFilter = document.getElementById("dashboard-month-filter");
    this.elements.yearFilter = document.getElementById("dashboard-year-filter");
    this.elements.filterBtn = document.getElementById("dashboard-filter-btn");
    this.elements.summary = document.getElementById("dashboard-summary");
    this.elements.statusList = document.getElementById("dashboard-status-list");
    this.elements.itemsTable = document.getElementById("dashboard-items-table");
    this.elements.tableTitle = document.getElementById("table-title");
    this.elements.statusFilterBtns = document.querySelectorAll(".status-filter-btn");
     this.elements.monthFilter?.addEventListener("change", () => this.loadData());
    this.elements.yearFilter?.addEventListener("change", () => this.loadData());

    console.log("🔧 Dashboard init - Elements:", this.elements);

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
    this.elements.statusFilterBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const status = e.target.getAttribute("data-status");
        this.setTableFilter(status);
      });
    });

    

    setTimeout(() => this.loadData(), 500);
  },

  async loadData() {
    try {
      const month = this.elements.monthFilter?.value;
      const year = this.elements.yearFilter?.value;

      if (!month || !year) {
        this.updateStatus("❌ Pilih bulan dan tahun terlebih dahulu");
        return;
      }

      console.log(`📊 Memuat data untuk: ${month}-${year}`);
      this.updateStatus("⏳ Memuat data work orders...");

      const res = await App.api.request(`/workorders/chunk?month=${month}&year=${year}`);
      if (!res || !Array.isArray(res.data)) throw new Error("Data tidak valid dari server");

      // 🔹 Normalisasi data
      this.state.currentData = res.data.map((d, i) =>
        this.normalizeStatusFlags({ ...d, row_num: i + 1 })
      );

      // 🔹 Hitung total per status
      const counts = {
        belum_produksi: 0,
        di_produksi: 0,
        di_warna: 0,
        siap_kirim: 0,
        di_kirim: 0,
      };

      this.state.currentData.forEach((d) => {
        const s = d.__status;
        if (s.kirim) counts.di_kirim++;
        else if (s.siap) counts.siap_kirim++;
        else if (s.warna) counts.di_warna++;
        else if (s.produksi) counts.di_produksi++;
        else counts.belum_produksi++;
      });

      const totalCustomer = new Set(
        this.state.currentData.map((d) => d.nama_customer)
      ).size;
const totalRupiah = this.state.currentData.reduce((sum, d) => {
  const ukuran = parseFloat(String(d.ukuran || "0").replace(/,/g, "")) || 0;
  const qty = parseFloat(d.qty) || 0;
  const harga = parseFloat(d.harga) || 0;

  const subtotal = ukuran * qty * harga;
  return sum + subtotal;
}, 0);



      this.render({
        summary: {
          total_customer: totalCustomer,
          total_rupiah: totalRupiah,
        },
        statusCounts: counts,
      });

      this.renderTable();
      this.updateStatus(`✅ Data berhasil dimuat: ${this.state.currentData.length} Work Orders`);

      // Realtime listener
      if (App.socket) {
        App.socket.off("workorder:new");
        App.socket.on("workorder:new", (newRow) => {
          const normalized = this.normalizeStatusFlags(newRow);
          this.state.currentData.push(normalized);
          this.renderTable();
          this.updateStatus(`📡 Data baru ditambahkan: ${newRow.nama_customer}`);
        });
      }
    } catch (err) {
      console.error("❌ Work orders load error:", err);
      this.updateStatus("❌ Gagal memuat data: " + err.message);
      this.showError(err.message);
    }
  },

  updateStatus(msg) {
    const el = document.getElementById("dashboard-status-message");
    if (el) el.textContent = msg;
    console.log("📢 Status:", msg);
  },

  async loadTableData() {
    try {
      const month = this.elements.monthFilter?.value;
      const year = this.elements.yearFilter?.value;
      const status = this.state.currentTableFilter;
      if (!month || !year) return;

      console.log(`📋 Loading table data for status: ${status}`);
      const res = await App.api.request(`/workorders?month=${month}&year=${year}&status=${status}`);
      const rows = Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : [];
      this.state.tableData[status] = rows.map((r) => this.normalizeStatusFlags(r));
      this.renderTable();
    } catch (err) {
      console.error("❌ Table data load error:", err);
      this.renderTableError(err.message);
    }
  },

  // Dalam App.pages["dashboard"].init() - tambahkan setelah setup existing
setupDashboardAutoFilter() {
  if (this.elements.monthFilter) {
    this.elements.monthFilter.addEventListener("change", () => {
      console.log("📊 Dashboard - Month filter changed");
      this.loadData();
    });
  }
  
  if (this.elements.yearFilter) {
    this.elements.yearFilter.addEventListener("change", () => {
      console.log("📊 Dashboard - Year filter changed");
      this.loadData();
    });
  }
},

  setTableFilter(status) {
    console.log(`🔄 Ubah filter tabel ke: ${status}`);
    this.state.currentTableFilter = status;

    this.elements.statusFilterBtns.forEach((btn) =>
      btn.getAttribute("data-status") === status
        ? btn.classList.add("active")
        : btn.classList.remove("active")
    );

    const labels = {
      belum_produksi: "Belum Produksi",
      di_produksi: "Sudah Produksi",
      di_warna: "Di Warna",
      siap_kirim: "Siap Kirim",
      di_kirim: "Sudah Kirim",
    };
    if (this.elements.tableTitle)
      this.elements.tableTitle.textContent = `Daftar Barang ${labels[status] || status}`;

    this.renderTable();
  },

  renderTable() {
    if (!this.elements.itemsTable) return;
    const status = this.state.currentTableFilter;
    const allData = this.state.currentData || [];

    const filtered = allData.filter((item) => {
      const s = item.__status;
      switch (status) {
        case "belum_produksi":
          return !s.produksi && !s.warna && !s.siap && !s.kirim;
        case "di_produksi":
          return s.produksi && !s.warna && !s.siap && !s.kirim;
        case "di_warna":
          return s.warna && !s.siap && !s.kirim;
        case "siap_kirim":
          return s.siap && !s.kirim;
        case "di_kirim":
          return s.kirim;
        default:
          return true;
      }
    });

    console.log(`🎨 Menampilkan ${filtered.length} item untuk status: ${status}`);

    if (filtered.length === 0) {
      this.elements.itemsTable.innerHTML = `
        <tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">
        <p>Tidak ada data untuk status <strong>${status.replace("_", " ")}</strong></p>
        </td></tr>`;
      return;
    }

    const rows = filtered
      .map((item) => {
        const badge = this.getStatusBadge(item);
        return `
          <tr class="hover:bg-gray-50 border-b">
            <td class="px-6 py-3 text-sm">${App.ui.formatDate(item.tanggal)}</td>
            <td class="px-6 py-3 text-sm font-medium">${item.nama_customer || "-"}</td>
            <td class="px-6 py-3 text-sm text-gray-700 truncate">${item.deskripsi || "-"}</td>
            <td class="px-6 py-3 text-sm text-center">${item.qty || "-"}</td>
            <td class="px-6 py-3 text-sm text-center">${item.ukuran || "-"}</td>
            <td class="px-6 py-3 text-sm text-center">${badge}</td>
          </tr>`;
      })
      .join("");

    this.elements.itemsTable.innerHTML = rows;
  },

  getStatusBadge(item) {
    const s = item.__status;
    if (s.kirim)
      return `<span class="inline-flex px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Terkirim</span>`;
    if (s.siap)
      return `<span class="inline-flex px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Siap Kirim</span>`;
    if (s.warna)
      return `<span class="inline-flex px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">Di Warna</span>`;
    if (s.produksi)
      return `<span class="inline-flex px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">Diproduksi</span>`;
    return `<span class="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">Belum Produksi</span>`;
  },

  renderTableError(msg) {
    if (!this.elements.itemsTable) return;
    this.elements.itemsTable.innerHTML = `
      <tr><td colspan="6" class="text-center text-red-500 py-6">${msg}</td></tr>`;
  },

  render(data) {
    if (!data) return;
    const { summary, statusCounts } = data;

    this.elements.summary.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-6 bg-white rounded-lg shadow border">
          <p class="text-sm text-gray-600">Total Customer</p>
          <p class="text-2xl font-bold text-[#8B5E34]">${summary.total_customer}</p>
        </div>
        <div class="p-6 bg-white rounded-lg shadow border">
          <p class="text-sm text-gray-600">Total Nilai Produksi</p>
          <p class="text-2xl font-bold text-[#8B5E34]">${App.ui.formatRupiah(summary.total_rupiah)}</p>
        </div>
        <div class="p-6 bg-white rounded-lg shadow border">
          <p class="text-sm text-gray-600">Total Work Orders</p>
          <p class="text-2xl font-bold text-[#8B5E34]">${Object.values(statusCounts).reduce((a,b)=>a+b,0)}</p>
        </div>
        <div class="p-6 bg-white rounded-lg shadow border">
          <p class="text-sm text-gray-600">Bulan Aktif</p>
          <p class="text-2xl font-bold text-[#8B5E34]">${this.elements.monthFilter.value}/${this.elements.yearFilter.value}</p>
        </div>
      </div>`;

    this.elements.statusList.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        ${[
          { k: "belum_produksi", l: "Belum Produksi", c: "bg-red-100 text-red-800" },
          { k: "di_produksi", l: "Sudah Produksi", c: "bg-blue-100 text-blue-800" },
          { k: "di_warna", l: "Di Warna", c: "bg-orange-100 text-orange-800" },
          { k: "siap_kirim", l: "Siap Kirim", c: "bg-yellow-100 text-yellow-800" },
          { k: "di_kirim", l: "Di Kirim", c: "bg-green-100 text-green-800" },
        ]
          .map(
            (x) => `
          <div class="p-4 rounded-lg shadow border ${x.c}" 
               onclick="App.pages.dashboard.setTableFilter('${x.k}')">
            <p class="text-sm font-medium">${x.l}</p>
            <p class="text-xl font-bold mt-1">${statusCounts[x.k] || 0}</p>
          </div>`
          )
          .join("")}
      </div>`;
  },

  showError(msg) {
    console.error("Dashboard error:", msg);
    if (this.elements.summary)
      this.elements.summary.innerHTML = `<div class="p-4 text-red-500">⚠️ ${msg}</div>`;
  },
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

    console.log("🔍 Elements found:", this.elements);

    if (!this.elements.gridContainer) {
      console.error("❌ workorders-grid container not found!");
      this.showError("Container tabel tidak ditemukan!");
      return;
    }

    // Jalankan setup filter dan event
    this.setupDateFilters();
    this.setupEventListeners();

    // Muat data awal otomatis
    this.loadDataByFilter();
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
   if (this.elements.filterBtn) {
    this.elements.filterBtn.addEventListener("click", () => {
      console.log("🔘 Filter button clicked");
      this.loadDataByFilter();
    });
    }

   if (this.elements.yearFilter) {
    this.elements.yearFilter.addEventListener("change", (e) => {
      const newYear = e.target.value;
      console.log("🔄 Work Orders - Year changed to:", newYear);
      this.state.currentYear = newYear;
      this.loadDataByFilter(); // Langsung load data
    });
  }

    if (this.elements.yearFilter) {
    this.elements.yearFilter.addEventListener("change", (e) => {
      console.log("🔄 Year changed to:", e.target.value);
      this.state.currentYear = e.target.value;
      this.loadDataByFilter();
    });
  }

    console.log("✅ Event listeners setup complete");
  },

// ======================================================
// 📦 DATA LOADER + TABULATOR SETUP - CLEAN VIEW
// ======================================================

async loadDataByFilter() {
  if (this.state.isLoading) return;

  const month = this.state.currentMonth;
  const year = this.state.currentYear;

  if (!month || !year) {
    this.updateStatus("❌ Pilih bulan dan tahun terlebih dahulu");
    return;
  }

  try {
    this.state.isLoading = true;
    this.updateStatus(`⏳ Memuat data untuk ${month}-${year}...`);
    console.log(`📥 Loading chunk data for: ${month}-${year}`);

    const size = 10000;
    const page = 1;
    const res = await App.api.request(
      `/workorders/chunk?month=${month}&year=${year}&page=${page}&size=${size}`
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
            id: `temp-${month}-${year}-${loaded.length + 1}`,
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
        `✅ Tabel dimuat total ${loaded.length} baris (${rows.length} dari DB, ${needed} kosong baru)`
      );
    } else {
      console.log("🆕 Tidak ada data, membuat tabel kosong...");
      this.generateEmptyRowsForMonth(month, year);
      this.updateStatus(
        `📄 Bulan ${month}-${year} belum memiliki data — tabel kosong (10.000 baris) disiapkan.`
      );
    }
  } catch (err) {
    console.error("❌ Load data error:", err);
    this.generateEmptyRowsForMonth(month, year);
    this.updateStatus(
      `⚠️ Gagal memuat data dari server — tabel kosong disiapkan untuk ${month}-${year}`
    );
  } finally {
    this.state.isLoading = false;
  }
},

generateEmptyRowsForMonth(month, year) {
  console.log(`🔄 Membuat 10.000 baris kosong untuk ${month}-${year}`);
  const currentDate = new Date().toISOString().split("T")[0];
  this.state.currentData = [];

  for (let i = 0; i < 10000; i++) {
    this.state.currentData.push({
      id: `temp-${month}-${year}-${i + 1}`,
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

  this.initializeTabulator();
},

// ======================================================
// 🧱 TABULATOR SETUP (CLEAN VIEW) + GOOGLE SHEETS COPY/PASTE
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

  this.state.table = new Tabulator(this.elements.gridContainer, {
    data: this.state.currentData,
    layout: "fitColumns",
    height: "70vh",
    responsiveLayout: "hide",
    addRowPos: "bottom",

    // ---------- enable full google-sheets like copy/paste ----------
    clipboard: true,
    clipboardCopyStyled: false,
    clipboardPasteParser: "table",
    clipboardPasteAction: "update", // update existing cells with pasted values
    clipboardCopyFormatter: "plain",
    clipboardCopySelector: "active",
    clipboardPasteSelector: "active",
    // -------------------------------------------------------------

    history: true,
    selectable: true,
    keyboardNavigation: true,
    virtualDom: true,
    index: "id",

    columns: [
      {
        title: "#",
        field: "row_num",
        width: 70,
        hozAlign: "center",
        formatter: "rownum",
        headerSort: false,
        frozen: true,
      },
      {
        title: "Tanggal",
        field: "tanggal",
        width: 120,
        editor: "input",
        editorParams: { elementAttributes: { type: "date" } },
        formatter: (cell) => {
          const value = cell.getValue();
          if (!value) return "-";
          try {
            const date = new Date(value);
            return date.toLocaleDateString("id-ID");
          } catch {
            return value;
          }
        },
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "tanggal"),
      },
      {
        title: "Customer *",
        field: "nama_customer",
        width: 180,
        editor: "input",
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "nama_customer"),
        cssClass: "required-field",
      },
      {
        title: "Deskripsi *",
        field: "deskripsi",
        width: 250,
        editor: "input",
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "deskripsi"),
        cssClass: "required-field",
      },
      {
        title: "Ukuran",
        field: "ukuran",
        width: 90,
        editor: "input",
        hozAlign: "center",
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "ukuran"),
      },
      {
        title: "Qty",
        field: "qty",
        width: 80,
        editor: "number",
        hozAlign: "center",
        editorParams: { min: 0, step: "any" },
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "qty"),
      },

      // NOTE: Harga / DP / Discount kept in data model but NOT displayed in this view.
      // If you want to show them later, re-add the column definitions here.

      {
        title: "Status",
        field: "di_produksi",
        width: 120,
        hozAlign: "center",
        formatter: (cell) => {
          const row = cell.getRow().getData();
          if (row.di_kirim === "true") return "✅ Terkirim";
          if (row.siap_kirim === "true") return "📦 Siap Kirim";
          if (row.di_warna === "true") return "🎨 Di Warna";
          if (row.di_produksi === "true") return "⚙️ Produksi";
          return "⏳ Menunggu";
        },
      },
      {
        title: "No. Inv",
        field: "no_inv",
        width: 120,
        editor: "input",
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "no_inv"),
      },
      {
        title: "Ekspedisi",
        field: "ekspedisi",
        width: 120,
        editor: "input",
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "ekspedisi"),
      },
    ],

    // after a paste (Tabulator will already update the cells because clipboardPasteAction = "update")
    // we call handleCellEdit for common fields so our auto-save debounce will persist changes to server
    clipboardPasted: function(clipboard, rows) {
      // rows is an array of RowComponents when action succeeded
      try {
        console.log("📥 clipboardPasted:", clipboard, rows);
        // small delay to ensure table cells already updated
        setTimeout(() => {
          const fieldsToTrigger = ["tanggal","nama_customer","deskripsi","ukuran","qty","no_inv","ekspedisi"];
          rows.forEach((rowComp) => {
            // rowComp could be RowComponent or raw object; handle both
            const row = (typeof rowComp.getData === "function") ? rowComp : self.state.table.getRow(rowComp.id);
            if (!row) return;
            fieldsToTrigger.forEach((f) => {
              try {
                // trigger save flow - handleCellEdit expects a RowComponent
                self.handleCellEdit(row, f);
              } catch (e) {
                // ignore individual errors
              }
            });
          });
          self.updateStatus("✅ Paste berhasil — perubahan sedang disimpan");
        }, 350);
      } catch (err) {
        console.warn("⚠️ clipboardPasted handler error:", err);
      }
    },

    rowFormatter: function(row) {
      // keep visual highlight minimal for performance
      const data = row.getData();
      // if DP or discount exist, slightly tint row (optional)
      const dp = parseFloat(data.dp_amount) || 0;
      const discount = parseFloat(data.discount) || 0;
      if (dp > 0 || discount > 0) {
        row.getElement().style.backgroundColor = '#f8fbff';
      } else {
        row.getElement().style.backgroundColor = '';
      }
    },

    clipboardCopied: function (data, rows) {
      console.log(`📋 ${rows.length} baris disalin ke clipboard`);
    },

    clipboardPastedFailure: function(err) {
      console.warn("❌ Paste failed:", err);
      self.updateStatus("❌ Paste gagal: " + (err && err.message ? err.message : "format tidak cocok"));
    }
  });

  console.log("✅ Tabulator initialized successfully (clean view + sheets paste)");
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

  console.log(`💾 Saving ${fieldName}:`, value, "for row:", rowId);

  // 🗓️ Auto isi tanggal jika kosong ketika customer diisi
  if (fieldName === "nama_customer" && (!rowData.tanggal || rowData.tanggal === "")) {
    const today = new Date().toISOString().split("T")[0];
    row.update({ tanggal: today });
    console.log(`🗓️ Auto isi tanggal: ${today}`);
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
  const saveKey = `${rowId}-${fieldName}`;
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

      console.log(`📤 PATCH payload for ${fieldName}:`, payload);

      await App.api.request(`/workorders/${rowId}`, {
        method: "PATCH",
        body: payload,
      });

      console.log(`✅ ${fieldName} tersimpan ke server`);
      this.updateStatus(`✅ ${fieldName} tersimpan`);

      // Refresh view
      row.reformat();

    } catch (err) {
      console.error(`❌ Error saving ${fieldName}:`, err);
      this.updateStatus(`❌ ${err.message || "Gagal menyimpan perubahan"}`);
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
    await App.api.request(`/workorders/${rowId}`, { method: "DELETE" });
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
      const result = await App.api.request(`/invoice-search/${invoiceNo}`);
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
      console.log(`💰 DP updated: ${e.target.value}`);
    });
  }
  
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      if (e.target.value < 0) e.target.value = 0;
      console.log(`💸 Discount updated: ${e.target.value}`);
      
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
      console.log(`📊 Discount % updated: ${e.target.value}`);
      
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

      console.log(`📊 Loading invoice summary for: ${month}-${year}`);

      // ✅ PERBAIKI PATH: tambahkan /api/
      const summary = await App.api.request(`/api/invoices/summary?month=${month}&year=${year}`);
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
        progressBar.style.width = `${percentage}%`;
        progressBar.textContent = `${percentage.toFixed(1)}%`;
      }
      
      // Update status text
      const statusEl = document.getElementById('payment-status-text');
      if (statusEl) {
        if (percentage >= 100) {
          statusEl.textContent = 'LUNAS 100%';
          statusEl.className = 'text-green-600 font-bold';
        } else if (percentage > 0) {
          statusEl.textContent = `SEBAGIAN (${percentage.toFixed(1)}%)`;
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
      console.log(`🔍 Searching invoice: ${invoiceNo}`);
      console.log(`💰 DP dari input: ${dpAmount}`);
      console.log(`💸 Diskon nominal: ${discount}`);
      console.log(`📊 Diskon persentase: ${discountPercentage}`);
      
      // ✅ PERBAIKI PATH: tambahkan /api/
      const result = await App.api.request(`/api/invoice-search/${invoiceNo}`);
      
      if (result && result.length > 0) {
        // ✅ TERAPKAN DP & DISKON KE WORK ORDERS
        const updatedWorkOrders = result.map(wo => ({
          ...wo,
          dp_amount: parseFloat(dpAmount) || 0, // GUNAKAN DP DARI INPUT
          discount: this.calculateDiscount(wo, discount, discountPercentage) // HITUNG DISKON
        }));
        
        console.log(`✅ Work orders setelah update:`, updatedWorkOrders[0]?.dp_amount);
        
        this.state.currentInvoiceData = updatedWorkOrders;
        this.generateInvoicePreview(updatedWorkOrders, invoiceNo);
        this.elements.printBtn.disabled = false;
        App.ui.showToast(`Invoice ${invoiceNo} ditemukan`, "success");
        
        // ✅ TAMBAHKAN: Simpan data untuk real-time updates
        this.state.currentInvoiceNo = invoiceNo;
        
      } else {
        this.elements.printArea.innerHTML = `
          <div class="text-center text-red-500 py-8">
            <p>Invoice <strong>${invoiceNo}</strong> tidak ditemukan</p>
          </div>
        `;
        this.elements.printBtn.disabled = true;
        App.ui.showToast("Invoice tidak ditemukan", "error");
      }
    } catch (err) {
      console.error("❌ Error searching invoice:", err);
      this.elements.printArea.innerHTML = `
        <div class="text-center text-red-500 py-8">
          <p>Error: ${err.message}</p>
        </div>
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
        console.log(`💰 DP updated: ${e.target.value}`);
        // ✅ AUTO-APPLY ke invoice preview
        this.applyPaymentUpdates();
      });
    }
    
    if (discountInput) {
      discountInput.addEventListener('input', (e) => {
        if (e.target.value < 0) e.target.value = 0;
        console.log(`💸 Discount updated: ${e.target.value}`);
        
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
        console.log(`📊 Discount % updated: ${e.target.value}`);
        
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
  console.log(`🧮 Invoice Calculation:`);
  console.log(`- Subtotal: ${totalSubtotal}`);
  console.log(`- Discount: ${totalDiscount}`);
  console.log(`- Grand Total: ${grandTotal}`);
  console.log(`- Total DP: ${totalDP}`);
  console.log(`- Remaining: ${remainingPayment}`);

  this.elements.printArea.innerHTML = `
    <div class="max-w-4xl mx-auto" id="invoice-print-content">
      <!-- Header -->
      <div class="text-center mb-8 border-b-2 border-[#A67B5B] pb-4">
        <h1 class="text-3xl font-bold text-[#5C4033]">CV. TOTO ALUMINIUM MANUFACTURE</h1>
        <p class="text-[#9B8C7C] text-sm mt-1">Jl. Rawa Mulya, Kota Bekasi | Telp: 0813 1191 2002</p>
        <h2 class="text-2xl font-bold text-[#5C4033] mt-4">INVOICE</h2>
      </div>

      <!-- Invoice Info -->
      <div class="grid grid-cols-2 gap-8 mb-6 text-sm">
        <div>
          <table class="w-full">
            <tr><td class="font-semibold w-32">No. Invoice</td><td>: ${invoiceNo}</td></tr>
            <tr><td class="font-semibold">Tanggal</td><td>: ${today}</td></tr>
            <tr><td class="font-semibold">Customer</td><td>: ${workOrders[0]?.nama_customer || '-'}</td></tr>
          </table>
        </div>
        <div>
          <table class="w-full">
            <tr><td class="font-semibold w-32">Total Items</td><td>: ${totalItems}</td></tr>
            <tr><td class="font-semibold">Total Quantity</td><td>: ${totalQty}</td></tr>
            <tr><td class="font-semibold">Status</td><td class="${remainingPayment <= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}">: ${remainingPayment <= 0 ? 'LUNAS' : 'BELUM BAYAR'}</td></tr>
          </table>
        </div>
      </div>

      <!-- Items Table dengan DP & Diskon -->
      <table class="w-full border border-[#D1BFA3] text-sm mb-6">
        <thead>
          <tr class="bg-[#F9F4EE]">
            <th class="border border-[#D1BFA3] p-2 text-left">No</th>
            <th class="border border-[#D1BFA3] p-2 text-left">Deskripsi</th>
            <th class="border border-[#D1BFA3] p-2 text-center">Ukuran</th>
            <th class="border border-[#D1BFA3] p-2 text-center">Qty</th>
            <th class="border border-[#D1BFA3] p-2 text-right">Harga</th>
            <th class="border border-[#D1BFA3] p-2 text-right">Subtotal</th>
            <th class="border border-[#D1BFA3] p-2 text-right">Diskon</th>
            <th class="border border-[#D1BFA3] p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${workOrders.map((wo, index) => {
            const ukuran = parseFloat(wo.ukuran) || 0;
            const qty = parseFloat(wo.qty) || 0;
            const harga = parseFloat(wo.harga) || 0;
            const discount = parseFloat(wo.discount) || 0;
            const dp = parseFloat(wo.dp_amount) || 0;
            
            const subtotal = ukuran * qty * harga;
            const totalAfterDiscount = subtotal - discount;
            
            return `
              <tr>
                <td class="border border-[#D1BFA3] p-2">${index + 1}</td>
                <td class="border border-[#D1BFA3] p-2">${wo.deskripsi || '-'}</td>
                <td class="border border-[#D1BFA3] p-2 text-center">${wo.ukuran || '-'}</td>
                <td class="border border-[#D1BFA3] p-2 text-center">${wo.qty || '-'}</td>
                <td class="border border-[#D1BFA3] p-2 text-right">${App.ui.formatRupiah(harga)}</td>
                <td class="border border-[#D1BFA3] p-2 text-right">${App.ui.formatRupiah(subtotal)}</td>
                <td class="border border-[#D1BFA3] p-2 text-right ${discount > 0 ? 'text-red-600' : ''}">
                  ${discount > 0 ? `-${App.ui.formatRupiah(discount)}` : '-'}
                </td>
                <td class="border border-[#D1BFA3] p-2 text-right font-semibold">
                  ${App.ui.formatRupiah(totalAfterDiscount)}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Summary Section dengan DP & Diskon -->
      <div class="flex justify-end mb-6">
        <div class="w-80">
          <!-- Subtotal -->
          <div class="flex justify-between border-b border-[#D1BFA3] py-2">
            <span class="font-semibold">Subtotal:</span>
            <span class="font-semibold">${App.ui.formatRupiah(totalSubtotal)}</span>
          </div>
          
          <!-- Diskon -->
          ${totalDiscount > 0 ? `
            <div class="flex justify-between border-b border-[#D1BFA3] py-2 text-red-600">
              <span class="font-semibold">Diskon:</span>
              <span class="font-semibold">-${App.ui.formatRupiah(totalDiscount)}</span>
            </div>
          ` : ''}
          
          <!-- Total Setelah Diskon -->
          <div class="flex justify-between border-b border-[#D1BFA3] py-2 font-semibold">
            <span>Total Tagihan:</span>
            <span>${App.ui.formatRupiah(grandTotal)}</span>
          </div>
          
          <!-- DP -->
          ${totalDP > 0 ? `
            <div class="flex justify-between border-b border-[#D1BFA3] py-2 text-green-600">
              <span class="font-semibold">DP Dibayar:</span>
              <span class="font-semibold">-${App.ui.formatRupiah(totalDP)}</span>
            </div>
          ` : ''}
          
          <!-- Sisa Pembayaran -->
          <div class="flex justify-between border-b-2 border-[#5C4033] py-3 font-bold text-lg ${
            remainingPayment <= 0 ? 'text-green-600' : 'text-red-600'
          }">
            <span>${remainingPayment <= 0 ? 'LUNAS' : 'SISA BAYAR'}:</span>
            <span>${App.ui.formatRupiah(Math.abs(remainingPayment))}</span>
          </div>
        </div>
      </div>

      <!-- Payment Status Info -->
      <div class="bg-[#F9F4EE] p-4 rounded-lg mb-6 text-sm">
        <h3 class="font-semibold mb-2 text-[#5C4033]">Informasi Pembayaran:</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p>• Transfer Bank: BCA 123-456-7890</p>
            <p>• A/N: CV. TOTO ALUMINIUM MANUFACTURE</p>
            <p>• Jatuh tempo: 14 hari setelah invoice</p>
          </div>
          <div>
            ${totalDP > 0 ? `<p>• DP sudah diterima: ${App.ui.formatRupiah(totalDP)}</p>` : ''}
            ${totalDiscount > 0 ? `<p>• Diskon: ${App.ui.formatRupiah(totalDiscount)}</p>` : ''}
            <p>• Total Tagihan: ${App.ui.formatRupiah(grandTotal)}</p>
            <p class="font-semibold ${remainingPayment <= 0 ? 'text-green-600' : 'text-red-600'}">
              • Status: ${remainingPayment <= 0 ? '✅ LUNAS' : '⏳ BELUM LUNAS'}
            </p>
            ${remainingPayment > 0 ? `
              <p class="font-semibold text-red-600">
                • Sisa Pembayaran: ${App.ui.formatRupiah(remainingPayment)}
              </p>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Payment Info & Notes -->
      <div class="grid grid-cols-2 gap-8 text-sm mb-8">
        <div>
          <h3 class="font-semibold mb-2 text-[#5C4033]">Metode Pembayaran:</h3>
          <p>• Transfer Bank BCA: 123-456-7890</p>
          <p>• A/N: CV. TOTO ALUMINIUM MANUFACTURE</p>
          <p>• Jatuh tempo: 14 hari setelah invoice diterima</p>
          ${totalDP > 0 ? `
            <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded">
              <p class="text-green-700 font-semibold">DP sudah diterima: ${App.ui.formatRupiah(totalDP)}</p>
            </div>
          ` : ''}
        </div>
        <div>
          <h3 class="font-semibold mb-2 text-[#5C4033]">Catatan:</h3>
          <p class="mb-2">${catatan || 'Terima kasih atas pesanan Anda.'}</p>
          ${remainingPayment > 0 ? `
            <div class="p-2 bg-red-50 border border-red-200 rounded">
              <p class="text-red-600 font-semibold">
                Sisa pembayaran: ${App.ui.formatRupiah(remainingPayment)}
              </p>
              <p class="text-red-600 text-xs mt-1">Harap lunasi sebelum jatuh tempo</p>
            </div>
          ` : ''}
          ${remainingPayment <= 0 ? `
            <div class="p-2 bg-green-50 border border-green-200 rounded">
              <p class="text-green-700 font-semibold">✅ Invoice sudah lunas</p>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Signatures -->
      <div class="flex justify-between pt-8 border-t border-[#D1BFA3]">
        <div class="text-center">
          <div class="mb-12"></div>
          <div class="border-t border-[#5C4033] pt-2 w-48 mx-auto">
            <p class="font-semibold">Penerima</p>
            <p class="text-xs text-[#9B8C7C]">(__________________________)</p>
          </div>
        </div>
        <div class="text-center">
          <div class="mb-12"></div>
          <div class="border-t border-[#5C4033] pt-2 w-48 mx-auto">
            <p class="font-semibold">CV. TOTO ALUMINIUM</p>
            <p class="text-xs text-[#9B8C7C]">Authorized Signature</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center mt-8 pt-4 border-t border-[#D1BFA3] text-xs text-[#9B8C7C]">
        <p>Invoice ini dibuat secara otomatis dan sah tanpa tanda tangan basah</p>
        ${totalDP > 0 || totalDiscount > 0 ? `
          <p class="mt-1">Termasuk informasi DP dan Diskon</p>
        ` : ''}
        <p class="mt-1">Generated on ${new Date().toLocaleString('id-ID')}</p>
      </div>
    </div>
  `;
},

  printInvoice() {
    if (!this.state.currentInvoiceData) {
      App.ui.showToast("Tidak ada data invoice untuk dicetak", "error");
      return;
    }

   const printStyles = `
  <style>
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        margin: 0;
        padding: 0;
        background: #f5ebdd;
      }

      #sj-customer-print-content {
        visibility: visible !important;
        position: absolute;
        left: 1.5cm;
        top: 1cm;
        right: 1.5cm;
        font-family: "Inter", Arial, sans-serif;
        font-size: 12px;
        color: #3a2d22;
        background-color: #ffffff;
        border-radius: 6px;
        box-shadow: 0 0 0.5cm rgba(0, 0, 0, 0.1);
        padding: 24px 32px;
      }

      #sj-customer-print-content h1 {
        font-size: 18px;
        color: #3a2d22;
        font-weight: bold;
        margin-bottom: 2px;
      }

      #sj-customer-print-content p {
        margin: 2px 0;
      }

      #sj-customer-print-content h2 {
        font-size: 14px;
        font-weight: bold;
        color: #4a3a2d;
        margin-top: 10px;
        margin-bottom: 6px;
        border-bottom: 1px solid #4a3a2d;
        display: inline-block;
        padding-bottom: 2px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 11px;
        color: #2f1e10;
      }

      th {
        background-color: #f5ebdd !important;
        color: #3a2d22;
        font-weight: bold;
        border: 1px solid #bfa98a;
        padding: 5px 6px;
      }

      td {
        border: 1px solid #d4bfa3;
        padding: 5px 6px;
      }

      .text-center {
        text-align: center;
      }

      .text-right {
        text-align: right;
      }

      .font-bold {
        font-weight: 600;
      }

      .signature {
        display: flex;
        justify-content: space-between;
        margin-top: 36px;
        font-size: 12px;
      }

      .signature div {
        width: 45%;
        text-align: center;
      }

      .signature p {
        margin: 4px 0;
      }

      .signature .line {
        border-top: 1px solid #3a2d22;
        margin-top: 36px;
        padding-top: 4px;
      }

      @page {
        size: A4;
        margin: 1cm;
      }

      body *:not(#sj-customer-print-content):not(#sj-customer-print-content *) {
        visibility: hidden !important;
      }
    }
  </style>
`;


    App.ui.printElement("invoice-print-content", printStyles);
  }
};


// ======================================================
// 📦 STATUS BARANG PAGE - COMPLETE FIXED VERSION
// ======================================================
// ======================================================
// 📦 STATUS BARANG PAGE - FIXED BASED ON EXISTING LOGIC
// ======================================================
// ======================================================
// 📦 STATUS BARANG PAGE - DEBUG VERSION
// ======================================================
// ======================================================
// 📦 STATUS BARANG PAGE - CLEAN WORKING VERSION
// ======================================================
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
        `/workorders?month=${month}&year=${year}&customer=${encodeURIComponent(
          customer
        )}`
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
  initializeTabulator() {
    if (!this.elements.gridContainer) return;

    if (this.state.table) {
      try {
        this.state.table.destroy();
      } catch (e) {}
    }

    const self = this;
    this.elements.gridContainer.innerHTML = "";

    this.state.table = new Tabulator(this.elements.gridContainer, {
      data: this.state.currentData,
      layout: "fitColumns",
      height: "75vh",
      rowHeight: 35,
      clipboard: true,
      responsiveLayout: "hide",
      index: "id",

      columns: [
        // ============================
        // NUMBERING
        // ============================
        {
          title: "#",
          field: "row_num",
          width: 60,
          hozAlign: "center",
          formatter: "rownum",
          frozen: true
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
          cellEdited: (cell) =>
            self.handleCellEdit(cell.getRow(), "tanggal")
        },

        // ============================
        // CUSTOMER
        // ============================
        {
          title: "Customer",
          field: "nama_customer",
          width: 150,
          editor: "input",
          cellEdited: (cell) =>
            self.handleCellEdit(cell.getRow(), "nama_customer")
        },

        // ============================
        // DESKRIPSI
        // ============================
        {
          title: "Deskripsi",
          field: "deskripsi",
          width: 200,
          editor: "input",
          cellEdited: (cell) =>
            self.handleCellEdit(cell.getRow(), "deskripsi")
        },

        // ============================
        // UKURAN
        // ============================
        {
          title: "Ukuran",
          field: "ukuran",
          width: 90,
          editor: "input",
          hozAlign: "center",
          cellEdited: (cell) =>
            self.handleCellEdit(cell.getRow(), "ukuran")
        },

        // ============================
        // QTY
        // ============================
        {
          title: "Qty",
          field: "qty",
          width: 90,
          editor: "number",
          hozAlign: "center",
          cellEdited: (cell) =>
            self.handleCellEdit(cell.getRow(), "qty")
        },

        // ============================
        // HARGA 🚀
        // ============================
        {
          title: "Harga",
          field: "harga",
          width: 110,
          editor: "number",
          formatter: (cell) =>
            cell.getValue()
              ? App.ui.formatRupiah(cell.getValue())
              : "-",
          cellEdited: (cell) => {
            const row = cell.getRow();
            self.handleCellEdit(row, "harga");
            row.reformat();
          }
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
            cell.getValue()
              ? App.ui.formatRupiah(cell.getValue())
              : "-",
          cellEdited: (cell) => {
            const row = cell.getRow();
            self.handleCellEdit(row, "dp_amount");
            row.reformat();
          }
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
            cell.getValue()
              ? App.ui.formatRupiah(cell.getValue())
              : "-",
          cellEdited: (cell) => {
            const row = cell.getRow();
            self.handleCellEdit(row, "discount");
            row.reformat();
          }
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
          }
        },

        // ============================
        // NO INV
        // ============================
        {
          title: "No Inv",
          field: "no_inv",
          width: 130,
          editor: "input",
          cellEdited: (cell) =>
            self.handleCellEdit(cell.getRow(), "no_inv")
        },

        // ============================
        // CHECKBOX STATUS
        // ============================
        {
          title: "Produksi",
          field: "di_produksi",
          width: 100,
          formatter: self.checkboxFormatter("di_produksi", "blue")
        },
        {
          title: "Warna",
          field: "di_warna",
          width: 90,
          formatter: self.checkboxFormatter("di_warna", "green")
        },
        {
          title: "Siap Kirim",
          field: "siap_kirim",
          width: 120,
          formatter: self.checkboxFormatter("siap_kirim", "yellow")
        },
        {
          title: "Dikirim",
          field: "di_kirim",
          width: 100,
          formatter: self.checkboxFormatter("di_kirim", "purple")
        },
        {
          title: "Pembayaran",
          field: "pembayaran",
          width: 120,
          formatter: self.checkboxFormatter("pembayaran", "red")
        },

        // ============================
        // EKSPEDISI
        // ============================
        {
          title: "Ekspedisi",
          field: "ekspedisi",
          width: 120,
          editor: "input",
          cellEdited: (cell) =>
            self.handleCellEdit(cell.getRow(), "ekspedisi")
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
            return `
              <div style="
                width:22px;height:22px;border-radius:4px;
                background:${color};margin:auto;border:1px solid #666;
              "></div>`;
          },
          cellClick: (e, cell) => {
            self.openColorPicker(cell.getRow());
          }
        }
      ]
    });
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
              style="width:28px;height:28px;background:${c};border:2px solid ${
                c == current ? "#000" : "#ccc"
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
    } catch (e) {}

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

    const karyawanId = this.elements.karyawanSelect.value;
    const hariKerja = parseInt(this.elements.hariKerja.value) || 0;
    const hariLembur = parseInt(this.elements.hariLembur.value) || 0;
    const potonganBon = parseFloat(this.elements.potonganBon.value) || 0;

    // Validasi
    if (!karyawanId) {
      App.ui.showToast("Pilih karyawan terlebih dahulu", "error");
      return;
    }

    if (hariKerja === 0 && hariLembur === 0) {
      App.ui.showToast("Masukkan hari kerja atau lembur", "error");
      return;
    }

    try {
      this.setLoadingState(true, "Menghitung gaji...");

      // Get selected karyawan data
      const selectedOption = this.elements.karyawanSelect.options[this.elements.karyawanSelect.selectedIndex];
      const gajiHarian = parseFloat(selectedOption.getAttribute('data-gaji') || 0);
      const kasbonAwal = parseFloat(selectedOption.getAttribute('data-kasbon') || 0);
      const bpjsKes = parseFloat(selectedOption.getAttribute('data-bpjs-kes') || 0);
      const bpjsTk = parseFloat(selectedOption.getAttribute('data-bpjs-tk') || 0);
      const namaKaryawan = selectedOption.textContent.split(' (')[0];

      // Perhitungan gaji
      const gajiPokok = hariKerja * gajiHarian;
      const gajiLembur = hariLembur * gajiHarian;
      const totalGajiKotor = gajiPokok + gajiLembur;
      const totalPotongan = bpjsKes + bpjsTk + potonganBon;
      const gajiBersih = totalGajiKotor - totalPotongan;
      
      // Perhitungan sisa bon
      const sisaBon = kasbonAwal - potonganBon;

      // ✅ SIMPAN SISA BON KE DATABASE JIKA ADA POTONGAN
      if (potonganBon > 0) {
        await this.updateSisaBon(karyawanId, sisaBon);
      }

      // ✅ SIMPAN DATA PAYROLL KE DATABASE
      const payrollData = {
        karyawanId: parseInt(karyawanId),
        periode: this.elements.periodeGaji?.value || new Date().toISOString().split('T')[0],
        hariKerja,
        hariLembur,
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

      // Save payroll data (async - tidak perlu tunggu)
      //this.handleSubmit(payrollData);

      // Display results
      this.displayPayrollSummary({
        namaKaryawan,
        ...payrollData
      });

      // Generate slip gaji
      this.generateSlipGaji({
        namaKaryawan,
        ...payrollData
      });

      App.ui.showToast("Perhitungan gaji berhasil" + (potonganBon > 0 ? " dan bon diperbarui" : ""), "success");

    } catch (err) {
      console.error("❌ Gagal menghitung payroll:", err);
      App.ui.showToast("Gagal menghitung gaji: " + err.message, "error");
    } finally {
      this.setLoadingState(false);
    }
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
  
  printWindow.onload = function() {
    printWindow.print();
    printWindow.onafterprint = function() {
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
  state: { data: null },
  elements: {},

  async init() {
    this.elements.tableContainer = document.getElementById("stok-grid");
    this.elements.addForm = document.getElementById("stok-form");
    this.elements.updateForm = document.getElementById("update-stok-form");

    await this.loadData();
    
    this.elements.addForm?.addEventListener("submit", (e) => this.addStok(e));
    this.elements.updateForm?.addEventListener("submit", (e) => this.updateStok(e));
  },

  async loadData() {
    try {
      const res = await App.api.request("/stok");
      this.render(res);
      App.ui.showToast("Data stok berhasil dimuat", "success");
    } catch (err) {
      console.error("❌ Gagal memuat stok:", err);
      App.ui.showToast("Gagal memuat data stok", "error");
    }
  },

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
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Satuan</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Lokasi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(b => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-mono font-medium">${b.kode_bahan}</td>
                <td class="px-4 py-3 text-sm">${b.nama_bahan}</td>
                <td class="px-4 py-3 text-sm">${b.kategori || '-'}</td>
                <td class="px-4 py-3 text-sm">${b.satuan || '-'}</td>
                <td class="px-4 py-3 text-sm text-right font-medium ${
                  b.stok < 10 ? 'text-red-600' : 'text-green-600'
                }">${b.stok}</td>
                <td class="px-4 py-3 text-sm">${b.lokasi || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
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
    this.elements.container = document.getElementById("invoice-container");
    this.elements.printBtn = document.getElementById("print-btn");
    
    await this.loadData();
    
    this.elements.printBtn?.addEventListener("click", () => {
      App.ui.printElement("invoice-container");
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
    } finally {
      this.setLoadingState(false);
    }
  },

  generateCustomerPreview(data, invoiceNo) {
    const totalQty = data.reduce((sum, wo) => sum + (parseFloat(wo.qty) || 0), 0);
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
            ${data.map((wo, i) => `
              <tr>
                <td class="border p-1 text-center">${i + 1}</td>
                <td class="border p-1">${wo.nama_customer || '-'}</td>
                <td class="border p-1">${wo.deskripsi || '-'}</td>
                <td class="border p-1 text-center">${wo.ukuran || '-'}</td>
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
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">
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
          <td class="p-2 text-center text-sm">${log.total_item}</td>
          <td class="p-2 text-center text-sm">${log.total_qty}</td>
          <td class="p-2 text-sm">${log.dibuat_oleh || "-"}</td>
        </tr>
      `).join("");

      console.log(`✅ Loaded ${result.length} surat jalan log entries`);

    } catch (err) {
      console.error("❌ Gagal memuat log surat jalan:", err);
      const tbody = this.elements.logTableBody;
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">
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
        App.ui.showToast("Tidak ada surat jalan yang siap dicetak", "error");
        return;
      }

      document.body.style.overflow = "hidden";
      document.body.classList.add("surat-jalan-print");
      window.print();

      setTimeout(() => {
        document.body.classList.remove("surat-jalan-print");
        document.body.style.overflow = "auto";
      }, 1500);

    } catch (err) {
      console.error("❌ Gagal mencetak surat jalan:", err);
      App.ui.showToast("Gagal mencetak surat jalan: " + err.message, "error");
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
      
      switch(kas.id) {
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
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            transaksi.tipe === 'PEMASUKAN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }">
            ${transaksi.tipe}
          </span>
        </td>
        <td class="px-6 py-4 text-sm text-right font-medium ${
          transaksi.tipe === 'PEMASUKAN' ? 'text-green-600' : 'text-red-600'
        }">
          ${transaksi.tipe === 'PEMASUKAN' ? '+' : '-'}${App.ui.formatRupiah(transaksi.jumlah)}
        </td>
      </tr>
    `).join('');
  }
};

// ======================================================
// 👑 ADMIN PAGE
// ======================================================
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
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                  }">
                    ${user.role}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    user.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  // Small delay to ensure all DOM is ready
  setTimeout(() => {
    App.init();
  }, 100);
});

// Export for global access
window.App = App;