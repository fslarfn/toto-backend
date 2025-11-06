
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
api : {
  baseUrl: window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : (window.location.origin), // atau base host produk

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('/api') ? `${this.baseUrl}${endpoint}` : `${this.baseUrl}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const fetchOpts = {
      method: options.method || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        options.headers || {}
      ),
      body: options.body && (typeof options.body === 'object') ? JSON.stringify(options.body) : options.body,
      credentials: options.credentials || 'same-origin'
    };
    const token = localStorage.getItem('authToken');
    if (token) fetchOpts.headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(url, fetchOpts);

    // baca body hanya sekali
    const text = await resp.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }

    if (!resp.ok) {
      const msg = (data && data.message) ? data.message : (typeof data === 'string' ? data : `Request failed: ${resp.status}`);
      const err = new Error(msg);
      err.status = resp.status;
      err.responseData = data;
      throw err;
    }

    return data;
  }
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
        const qty = parseFloat(d.qty) || 0;
        const harga = parseFloat(d.harga) || 0;
        return sum + qty * harga;
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
// 📦 WORK ORDERS PAGE (PART 1 - INIT, FILTERS, EVENTS) - DENGAN DP & DISKON
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
        this.loadDataByFilter();
      });
    }

    // Auto reload ketika bulan/tahun diganti
    if (this.elements.monthFilter) {
      this.elements.monthFilter.addEventListener("change", (e) => {
        this.state.currentMonth = e.target.value;
        this.loadDataByFilter();
      });
    }

    if (this.elements.yearFilter) {
      this.elements.yearFilter.addEventListener("change", (e) => {
        this.state.currentYear = e.target.value;
        this.loadDataByFilter();
      });
    }

    console.log("✅ Event listeners setup complete");
  },

// ======================================================
// 📦 DATA LOADER + TABULATOR SETUP - DENGAN DP & DISKON
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
        id: item.id,
        row_num: index + 1,
        selected: false,
        tanggal: item.tanggal || new Date().toISOString().split("T")[0],
        nama_customer: item.nama_customer || "",
        deskripsi: item.deskripsi || "",
        ukuran: item.ukuran || "",
        qty: item.qty || "",
        harga: item.harga || "",
        dp_amount: item.dp_amount || 0, // ✅ TAMBAH DP
        discount: item.discount || 0,   // ✅ TAMBAH DISKON
        di_produksi: item.di_produksi || "false",
        di_warna: item.di_warna || "false",
        siap_kirim: item.siap_kirim || "false",
        di_kirim: item.di_kirim || "false",
        pembayaran: item.pembayaran || "false",
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
            harga: "",
            dp_amount: 0, // ✅ DEFAULT DP
            discount: 0,  // ✅ DEFAULT DISKON
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
      harga: "",
      dp_amount: 0, // ✅ DEFAULT DP
      discount: 0,  // ✅ DEFAULT DISKON
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
// 🧱 TABULATOR SETUP DENGAN KOLOM DP & DISKON
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
    clipboard: true,
    clipboardPasteAction: "replace",
    clipboardCopyStyled: false,
    clipboardPasteParser: "table",
    history: true,
    selectable: true,
    clipboardCopySelector: "active",
    clipboardPasteSelector: "active",
    clipboardCopyFormatter: "plain",
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
      {
        title: "Harga",
        field: "harga",
        width: 120,
        editor: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const value = cell.getValue();
          return value ? App.ui.formatRupiah(value) : "-";
        },
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "harga"),
      },
      // ✅ KOLOM BARU: DP AMOUNT
      {
        title: "DP",
        field: "dp_amount",
        width: 110,
        editor: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const value = cell.getValue();
          return value ? App.ui.formatRupiah(value) : "-";
        },
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "dp_amount"),
      },
      // ✅ KOLOM BARU: DISCOUNT
      {
        title: "Diskon",
        field: "discount",
        width: 110,
        editor: "number",
        hozAlign: "right",
        formatter: (cell) => {
          const value = cell.getValue();
          return value ? App.ui.formatRupiah(value) : "-";
        },
        cellEdited: (cell) => self.handleCellEdit(cell.getRow(), "discount"),
      },
      // ✅ KOLOM BARU: SUBTOTAL
      {
        title: "Subtotal",
        field: "subtotal",
        width: 120,
        hozAlign: "right",
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const ukuran = parseFloat(row.ukuran) || 0;
          const qty = parseFloat(row.qty) || 0;
          const harga = parseFloat(row.harga) || 0;
          const subtotal = ukuran * qty * harga;
          return App.ui.formatRupiah(subtotal);
        }
      },
      // ✅ KOLOM BARU: TOTAL
      {
        title: "Total",
        field: "total",
        width: 120,
        hozAlign: "right",
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const ukuran = parseFloat(row.ukuran) || 0;
          const qty = parseFloat(row.qty) || 0;
          const harga = parseFloat(row.harga) || 0;
          const discount = parseFloat(row.discount) || 0;
          const subtotal = ukuran * qty * harga;
          const total = subtotal - discount;
          return App.ui.formatRupiah(total);
        }
      },
      // ✅ KOLOM BARU: SISA PEMBAYARAN
      {
        title: "Sisa Bayar",
        field: "remaining_payment",
        width: 120,
        hozAlign: "right",
        formatter: (cell) => {
          const row = cell.getRow().getData();
          const ukuran = parseFloat(row.ukuran) || 0;
          const qty = parseFloat(row.qty) || 0;
          const harga = parseFloat(row.harga) || 0;
          const discount = parseFloat(row.discount) || 0;
          const dp = parseFloat(row.dp_amount) || 0;
          const subtotal = ukuran * qty * harga;
          const total = subtotal - discount;
          const remaining = total - dp;
          
          // Warna berdasarkan status pembayaran
          const cellEl = cell.getElement();
          if (remaining <= 0) {
            cellEl.style.color = '#16a34a'; // Hijau untuk lunas
          } else if (dp > 0) {
            cellEl.style.color = '#ca8a04'; // Kuning untuk DP
          } else {
            cellEl.style.color = '#dc2626'; // Merah untuk belum bayar
          }
          
          return App.ui.formatRupiah(remaining);
        }
      },
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

    rowFormatter: function(row) {
      const data = row.getData();
      const dp = parseFloat(data.dp_amount) || 0;
      const discount = parseFloat(data.discount) || 0;
      
      // Highlight row berdasarkan status pembayaran
      const cells = row.getCells();
      if (dp > 0 || discount > 0) {
        cells.forEach(cell => {
          cell.getElement().style.backgroundColor = '#f0f9ff'; // Biru muda untuk ada DP/Diskon
        });
      }
    },

    clipboardCopied: function (data, rows) {
      console.log(`📋 ${rows.length} baris disalin ke clipboard`);
    },

    clipboardPasted: function (clipboard, rows) {
      console.log(`📥 Data di-paste:`, clipboard);
      self.updateStatus("✅ Data ditempel dari clipboard (Google Sheets style)");
    },
  });

  console.log("✅ Tabulator initialized successfully with DP & Discount columns");
},

// ======================================================
// 💾 HANDLE EDIT, AUTO SAVE, CREATE & DELETE ROW - DENGAN DP & DISKON
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

      // ✅ Handle numeric fields (DP & Discount)
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

      // ✅ Refresh calculated columns setelah save
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
// 🧩 CREATE NEW ROW - DENGAN DP & DISKON
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
      dp_amount: safeNum(rowData.dp_amount), // ✅ INCLUDE DP
      discount: safeNum(rowData.discount),   // ✅ INCLUDE DISCOUNT
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

    console.log("📤 POST new row dengan DP & Diskon:", payload);

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
// ⚡ SOCKET.IO REALTIME HANDLER - DENGAN DP & DISKON
// ======================================================
addRowRealtime(newRow) {
  if (!this.state.table) return;
  
  // ✅ Format data baru dengan DP & Diskon
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
  console.log("✅ Realtime row ditambahkan dengan DP & Diskon:", formattedRow);
},

updateRowRealtime(updatedRow) {
  if (!this.state.table) return;
  const existingRow = this.state.table.getRow(updatedRow.id);
  if (existingRow) {
    // ✅ Format update dengan DP & Diskon
    const formattedData = {
      ...updatedRow,
      dp_amount: updatedRow.dp_amount || 0,
      discount: updatedRow.discount || 0
    };
    existingRow.update(formattedData);
    existingRow.reformat(); // Refresh calculated columns
    console.log("🔄 Row diperbarui realtime dengan DP & Diskon:", updatedRow.id);
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

// ✅ METHOD BARU: Validasi DP & Diskon
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
// 🧾 INVOICE PAGE - UNTUK MANAGEMENT INVOICE
// ======================================================
App.pages["invoice"] = {
  state: {
    currentData: [],
    currentMonth: null,
    currentYear: null
  },
  elements: {},

  init() {
    console.log("🧾 Invoice Page INIT");
    
    this.elements = {
      monthFilter: document.getElementById("invoice-month-filter"),
      yearFilter: document.getElementById("invoice-year-filter"),
      filterBtn: document.getElementById("filter-invoice-btn"),
      summaryContainer: document.getElementById("invoice-summary"),
      tableContainer: document.getElementById("invoice-table"),
      status: document.getElementById("invoice-status")
    };

    console.log("🔍 Invoice elements:", this.elements);

    if (this.elements.monthFilter && this.elements.yearFilter) {
      App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
      this.state.currentMonth = this.elements.monthFilter.value;
      this.state.currentYear = this.elements.yearFilter.value;
    }

    this.setupEventListeners();
    this.loadInvoiceData();
  },

  setupEventListeners() {
    this.elements.filterBtn?.addEventListener("click", () => this.loadInvoiceData());
    
    if (this.elements.monthFilter) {
      this.elements.monthFilter.addEventListener("change", (e) => {
        this.state.currentMonth = e.target.value;
        this.loadInvoiceData();
      });
    }

    if (this.elements.yearFilter) {
      this.elements.yearFilter.addEventListener("change", (e) => {
        this.state.currentYear = e.target.value;
        this.loadInvoiceData();
      });
    }
  },

  async loadInvoiceData() {
    try {
      const month = this.state.currentMonth;
      const year = this.state.currentYear;
      
      if (!month || !year) {
        this.updateStatus("❌ Pilih bulan dan tahun terlebih dahulu");
        return;
      }

      this.updateStatus("⏳ Memuat data invoice...");

      // Load invoice summary
      const summary = await App.api.request(`/invoices/summary?month=${month}&year=${year}`);
      
      // Load invoice details
      const invoices = await App.api.request(`/workorders?month=${month}&year=${year}&no_inv=true`);

      this.renderSummary(summary);
      this.renderInvoiceTable(invoices);
      
      this.updateStatus(`✅ Data invoice ${month}-${year} dimuat`);

    } catch (err) {
      console.error("❌ Error loading invoice data:", err);
      this.updateStatus("❌ Gagal memuat data invoice: " + err.message);
    }
  },

  renderSummary(summary) {
    if (!this.elements.summaryContainer) return;

    this.elements.summaryContainer.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="p-6 bg-white rounded-lg shadow border">
          <p class="text-sm text-gray-600">Total Nilai Invoice</p>
          <p class="text-2xl font-bold text-blue-600">${App.ui.formatRupiah(summary.total || 0)}</p>
        </div>
        <div class="p-6 bg-white rounded-lg shadow border">
          <p class="text-sm text-gray-600">Sudah Dibayar</p>
          <p class="text-2xl font-bold text-green-600">${App.ui.formatRupiah(summary.paid || 0)}</p>
        </div>
        <div class="p-6 bg-white rounded-lg shadow border">
          <p class="text-sm text-gray-600">Belum Dibayar</p>
          <p class="text-2xl font-bold text-red-600">${App.ui.formatRupiah(summary.unpaid || 0)}</p>
        </div>
      </div>
    `;
  },

  renderInvoiceTable(invoices) {
    if (!this.elements.tableContainer) return;

    if (!invoices || invoices.length === 0) {
      this.elements.tableContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Tidak ada data invoice untuk periode yang dipilih</p>
        </div>
      `;
      return;
    }

    this.elements.tableContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">No. Invoice</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Status Bayar</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${invoices.map(inv => {
              const ukuran = parseFloat(inv.ukuran) || 0;
              const qty = parseFloat(inv.qty) || 0;
              const harga = parseFloat(inv.harga) || 0;
              const discount = parseFloat(inv.discount) || 0;
              const subtotal = ukuran * qty * harga;
              const total = subtotal - discount;
              
              return `
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-sm font-medium">${inv.no_inv || '-'}</td>
                  <td class="px-4 py-3 text-sm">${App.ui.formatDate(inv.tanggal)}</td>
                  <td class="px-4 py-3 text-sm">${inv.nama_customer || '-'}</td>
                  <td class="px-4 py-3 text-sm">${inv.deskripsi || '-'}</td>
                  <td class="px-4 py-3 text-sm text-right font-medium">${App.ui.formatRupiah(total)}</td>
                  <td class="px-4 py-3 text-sm">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      inv.pembayaran === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }">
                      ${inv.pembayaran === 'true' ? 'LUNAS' : 'BELUM BAYAR'}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm">
                    <button onclick="App.pages.invoice.printInvoice('${inv.no_inv}')" 
                            class="text-blue-600 hover:text-blue-800 font-medium">
                      Print
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async printInvoice(invoiceNo) {
    try {
      const invoiceData = await App.api.request(`/invoice/${invoiceNo}`);
      
      // Buka window print
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice ${invoiceNo}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .invoice-info { margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .total { font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>CV. TOTO ALUMINIUM MANUFACTURE</h1>
              <h2>INVOICE</h2>
            </div>
            <div class="invoice-info">
              <p><strong>No. Invoice:</strong> ${invoiceNo}</p>
              <p><strong>Tanggal:</strong> ${new Date().toLocaleDateString('id-ID')}</p>
            </div>
            <!-- Isi invoice disini -->
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      
    } catch (err) {
      console.error("❌ Error printing invoice:", err);
      App.ui.showToast("Gagal mencetak invoice", "error");
    }
  },

  updateStatus(message) {
    if (this.elements.status) {
      this.elements.status.textContent = message;
    }
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

    console.log("🔍 Status Barang Elements:", {
      monthFilter: !!this.elements.monthFilter,
      yearFilter: !!this.elements.yearFilter,
      customerInput: !!this.elements.customerInput,
      filterBtn: !!this.elements.filterBtn,
      gridContainer: !!this.elements.gridContainer,
      status: !!this.elements.status
    });

    if (!this.elements.gridContainer) {
      console.error("❌ statusbarang-grid container not found!");
      return;
    }

    if (this.elements.monthFilter && this.elements.yearFilter) {
      App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);
      this.state.currentMonth = this.elements.monthFilter.value;
      this.state.currentYear = this.elements.yearFilter.value;
      
      console.log("✅ Date filters initialized:", { 
        month: this.state.currentMonth, 
        year: this.state.currentYear 
      });
    } else {
      console.error("❌ Filter elements not found");
    }

    this.loadColorMarkers();
    this.setupEventListeners();
    this.setupSocketListeners();
    this.loadData();
  },

  setupEventListeners() {
    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
    
    if (this.elements.monthFilter) {
      this.elements.monthFilter.addEventListener("change", (e) => {
        this.state.currentMonth = e.target.value;
        this.loadData();
      });
    }

    if (this.elements.yearFilter) {
      this.elements.yearFilter.addEventListener("change", (e) => {
        this.state.currentYear = e.target.value;
        this.loadData();
      });
    }

    if (this.elements.customerInput) {
      this.elements.customerInput.addEventListener("input", (e) => {
        clearTimeout(this.state.customerSearchTimeout);
        this.state.customerSearchTimeout = setTimeout(() => {
          this.loadData();
        }, 500);
      });
    }
  },

  // ✅ SETUP SOCKET LISTENERS FOR REAL-TIME UPDATES
  setupSocketListeners() {
    if (!App.state.socket) {
      console.warn("⚠️ Socket not available, real-time updates disabled");
      return;
    }

    const socket = App.state.socket;
    
    socket.on("wo_updated", (data) => {
      console.log("📨 Real-time update received:", data);
      this.handleRealTimeUpdate(data);
    });

    socket.on("wo_created", (data) => {
      console.log("📨 Real-time new data received:", data);
      this.handleRealTimeNewData(data);
    });

    console.log("✅ Socket listeners setup for real-time updates");
  },

  // ✅ HANDLE REAL-TIME UPDATES FROM OTHER USERS
  handleRealTimeUpdate(updatedData) {
    if (!this.state.table) return;

    // Skip if this is our own update
    if (this.state.lastUpdateTime && updatedData.updated_at <= this.state.lastUpdateTime) {
      return;
    }

    try {
      const currentData = this.state.table.getData();
      const rowIndex = currentData.findIndex(row => row.id === updatedData.id);
      
      if (rowIndex !== -1) {
        const updatedRow = {
          ...currentData[rowIndex],
          di_produksi: updatedData.di_produksi === true || updatedData.di_produksi === 'true',
          di_warna: updatedData.di_warna === true || updatedData.di_warna === 'true',
          siap_kirim: updatedData.siap_kirim === true || updatedData.siap_kirim === 'true',
          di_kirim: updatedData.di_kirim === true || updatedData.di_kirim === 'true',
          pembayaran: updatedData.pembayaran === true || updatedData.pembayaran === 'true',
          ekspedisi: updatedData.ekspedisi || '',
          no_inv: updatedData.no_inv || '',
          tanggal: updatedData.tanggal || currentData[rowIndex].tanggal,
          nama_customer: updatedData.nama_customer || currentData[rowIndex].nama_customer,
          deskripsi: updatedData.deskripsi || currentData[rowIndex].deskripsi,
          ukuran: updatedData.ukuran || currentData[rowIndex].ukuran,
          qty: updatedData.qty || currentData[rowIndex].qty,
          harga: updatedData.harga || currentData[rowIndex].harga
        };

        this.state.table.updateData([updatedRow]);
        console.log("✅ Row updated in real-time:", updatedData.id);
        this.showRealTimeNotification(`Data diperbarui oleh user lain`);
      }
    } catch (err) {
      console.error("❌ Error handling real-time update:", err);
    }
  },

  // ✅ HANDLE REAL-TIME NEW DATA FROM OTHER USERS
  handleRealTimeNewData(newData) {
    if (!this.state.table) return;

    const currentMonth = parseInt(this.state.currentMonth);
    const currentYear = parseInt(this.state.currentYear);
    
    if (newData.bulan === currentMonth && newData.tahun === currentYear) {
      const newRowData = {
        ...newData,
        row_num: this.state.currentData.length + 1,
        di_produksi: newData.di_produksi === true || newData.di_produksi === 'true',
        di_warna: newData.di_warna === true || newData.di_warna === 'true',
        siap_kirim: newData.siap_kirim === true || newData.siap_kirim === 'true',
        di_kirim: newData.di_kirim === true || newData.di_kirim === 'true',
        pembayaran: newData.pembayaran === true || newData.pembayaran === 'true'
      };

      this.state.table.addRow(newRowData, false);
      console.log("✅ New row added in real-time:", newData.id);
      this.showRealTimeNotification(`Data baru ditambahkan oleh user lain`);
    }
  },

  // ✅ SHOW REAL-TIME NOTIFICATION
  showRealTimeNotification(message) {
    document.querySelectorAll('.realtime-notification').forEach(el => el.remove());
    
    const notification = document.createElement('div');
    notification.className = 'realtime-notification fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = `🔄 ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  },

  async loadData() {
    try {
      const month = this.state.currentMonth;
      const year = this.state.currentYear;
      const customer = this.elements.customerInput?.value.trim() || '';
      
      if (!month || !year) {
        this.updateStatus("❌ Pilih bulan dan tahun terlebih dahulu");
        return;
      }

      this.updateStatus("⏳ Memuat data...");
      
      const res = await App.api.request(`/workorders?month=${month}&year=${year}&customer=${encodeURIComponent(customer)}`);
      
      console.log("📦 Data loaded from API:", res?.length || 0, "items");
      
      this.state.currentData = res.map((item, index) => ({
        ...item,
        row_num: index + 1,
        di_produksi: item.di_produksi === true || item.di_produksi === 'true',
        di_warna: item.di_warna === true || item.di_warna === 'true',
        siap_kirim: item.siap_kirim === true || item.siap_kirim === 'true',
        di_kirim: item.di_kirim === true || item.di_kirim === 'true',
        pembayaran: item.pembayaran === true || item.pembayaran === 'true'
      }));

      this.initializeTabulator();
      this.updateStatus(`✅ Data dimuat: ${res.length} items`);
      
    } catch (err) {
      console.error("❌ Status Barang load error:", err);
      this.updateStatus("❌ Gagal memuat data: " + err.message);
    }
  },

  initializeTabulator() {
    console.log("🎯 Initializing Status Barang Tabulator");
    
    if (!this.elements.gridContainer) return;

    if (this.state.table) {
      try {
        this.state.table.destroy();
      } catch (e) {
        console.warn("⚠️ Error destroying previous table:", e);
      }
    }

    this.elements.gridContainer.innerHTML = '';

    const self = this;

    try {
      this.state.table = new Tabulator(this.elements.gridContainer, {
        data: this.state.currentData,
        layout: "fitColumns",
        height: "75vh",
        responsiveLayout: "hide",
        history: true,
        clipboard: true,
        selectable: true,
        keyboardNavigation: true,
        virtualDom: true,
        index: "id",
        
        columns: [
          {
            title: "#",
            field: "row_num",
            width: 60,
            hozAlign: "center",
            formatter: "rownum",
            headerSort: false,
            frozen: true
          },
          {
            title: "TANGGAL",
            field: "tanggal",
            width: 110,
            editor: "input",
            editorParams: {
              elementAttributes: { type: "date" }
            },
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? App.ui.formatDate(value) : "-";
            },
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'tanggal');
            }
          },
          {
            title: "CUSTOMER",
            field: "nama_customer",
            width: 150,
            editor: "input",
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'nama_customer');
            }
          },
          {
            title: "DESKRIPSI",
            field: "deskripsi",
            width: 200,
            editor: "input",
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'deskripsi');
            }
          },
          {
            title: "UKURAN",
            field: "ukuran",
            width: 80,
            editor: "input",
            hozAlign: "center",
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'ukuran');
            }
          },
          {
            title: "QTY",
            field: "qty",
            width: 70,
            editor: "number",
            hozAlign: "center",
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'qty');
            }
          },
          {
            title: "HARGA",
            field: "harga",
            width: 120,
            editor: "number",
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? App.ui.formatRupiah(value) : "-";
            },
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'harga');
            }
          },
          {
            title: "TOTAL",
            field: "total",
            width: 130,
            formatter: (cell) => {
              const row = cell.getRow().getData();
              const harga = parseFloat(row.harga) || 0;
              const qty = parseFloat(row.qty) || 0;
              const ukuran = parseFloat(row.ukuran) || 1;
              const total = harga * qty * ukuran;
              return App.ui.formatRupiah(total);
            }
          },
          {
            title: "NO. INV",
            field: "no_inv",
            width: 120,
            editor: "input",
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'no_inv');
            }
          },
          // ✅ CHECKBOX PRODUKSI
          {
            title: "PRODUKSI",
            field: "di_produksi",
            width: 90,
            hozAlign: "center",
            formatter: (cell) => {
              const value = cell.getValue();
              const checked = value === true || value === 'true';
              const rowData = cell.getRow().getData();
              const rowId = rowData.id;
              
              if (!rowId) {
                console.warn("⚠️ Row ID not found for checkbox");
                return '<div class="flex justify-center">-</div>';
              }
              
              return `
                <div class="flex justify-center">
                  <input type="checkbox" ${checked ? 'checked' : ''} 
                         class="status-checkbox w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                         onchange="App.pages['status-barang'].handleCheckboxChange(this, '${rowId}', 'di_produksi')">
                </div>
              `;
            }
          },
          // ✅ CHECKBOX WARNA
          {
            title: "WARNA",
            field: "di_warna",
            width: 80,
            hozAlign: "center",
            formatter: (cell) => {
              const value = cell.getValue();
              const checked = value === true || value === 'true';
              const rowData = cell.getRow().getData();
              const rowId = rowData.id;
              
              if (!rowId) {
                console.warn("⚠️ Row ID not found for checkbox");
                return '<div class="flex justify-center">-</div>';
              }
              
              return `
                <div class="flex justify-center">
                  <input type="checkbox" ${checked ? 'checked' : ''} 
                         class="status-checkbox w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2"
                         onchange="App.pages['status-barang'].handleCheckboxChange(this, '${rowId}', 'di_warna')">
                </div>
              `;
            }
          },
          // ✅ CHECKBOX SIAP KIRIM
          {
            title: "SIAP KIRIM",
            field: "siap_kirim",
            width: 100,
            hozAlign: "center",
            formatter: (cell) => {
              const value = cell.getValue();
              const checked = value === true || value === 'true';
              const rowData = cell.getRow().getData();
              const rowId = rowData.id;
              
              if (!rowId) {
                console.warn("⚠️ Row ID not found for checkbox");
                return '<div class="flex justify-center">-</div>';
              }
              
              return `
                <div class="flex justify-center">
                  <input type="checkbox" ${checked ? 'checked' : ''} 
                         class="status-checkbox w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 focus:ring-2"
                         onchange="App.pages['status-barang'].handleCheckboxChange(this, '${rowId}', 'siap_kirim')">
                </div>
              `;
            }
          },
          // ✅ CHECKBOX DIKIRIM
          {
            title: "DIKIRIM",
            field: "di_kirim",
            width: 80,
            hozAlign: "center",
            formatter: (cell) => {
              const value = cell.getValue();
              const checked = value === true || value === 'true';
              const rowData = cell.getRow().getData();
              const rowId = rowData.id;
              
              if (!rowId) {
                console.warn("⚠️ Row ID not found for checkbox");
                return '<div class="flex justify-center">-</div>';
              }
              
              return `
                <div class="flex justify-center">
                  <input type="checkbox" ${checked ? 'checked' : ''} 
                         class="status-checkbox w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                         onchange="App.pages['status-barang'].handleCheckboxChange(this, '${rowId}', 'di_kirim')">
                </div>
              `;
            }
          },
          // ✅ CHECKBOX PEMBAYARAN
          {
            title: "PEMBAYARAN",
            field: "pembayaran",
            width: 100,
            hozAlign: "center",
            formatter: (cell) => {
              const value = cell.getValue();
              const checked = value === true || value === 'true';
              const rowData = cell.getRow().getData();
              const rowId = rowData.id;
              
              if (!rowId) {
                console.warn("⚠️ Row ID not found for checkbox");
                return '<div class="flex justify-center">-</div>';
              }
              
              return `
                <div class="flex justify-center">
                  <input type="checkbox" ${checked ? 'checked' : ''} 
                         class="status-checkbox w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                         onchange="App.pages['status-barang'].handleCheckboxChange(this, '${rowId}', 'pembayaran')">
                </div>
              `;
            }
          },
          {
            title: "Ekspedisi",
            field: "ekspedisi",
            width: 120,
            editor: "input",
            editorParams: {
              elementAttributes: { 
                placeholder: "Nama ekspedisi",
                maxlength: "100"
              }
            },
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'ekspedisi');
            }
          },
          {
            title: "🎨 Color",
            field: "color_marker",
            width: 70,
            hozAlign: "center",
            formatter: (cell) => {
              const row = cell.getRow();
              const rowId = row.getData().id;
              const color = self.state.colorMarkers.get(rowId) || '#ffffff';
              
              return `
                <div style="
                  background: ${color}; 
                  width: 20px; 
                  height: 20px; 
                  border: 2px solid #666; 
                  border-radius: 3px;
                  cursor: pointer;
                  margin: 0 auto;
                " title="Klik untuk ganti warna"></div>
              `;
            },
            cellClick: function(e, cell) {
              self.openColorPicker(cell.getRow());
            }
          }
        ],

        rowContextMenu: [
          {
            label: "🎨 Highlight Row",
            action: function(e, row) {
              self.openColorPicker(row);
            }
          },
          {
            label: "🟥 Red Marker",
            action: function(e, row) {
              self.setRowColor(row, '#ffebee');
            }
          },
          {
            label: "🟨 Yellow Marker", 
            action: function(e, row) {
              self.setRowColor(row, '#fff9c4');
            }
          },
          {
            label: "🟩 Green Marker",
            action: function(e, row) {
              self.setRowColor(row, '#e8f5e8');
            }
          },
          {
            label: "🟦 Blue Marker",
            action: function(e, row) {
              self.setRowColor(row, '#e3f2fd');
            }
          },
          {
            label: "⬜ Clear Color",
            action: function(e, row) {
              self.clearRowColor(row);
            }
          },
          { separator: true },
          {
            label: "📊 Quick Stats",
            action: function(e, row) {
              const data = row.getData();
              const harga = parseFloat(data.harga) || 0;
              const qty = parseFloat(data.qty) || 0;
              const ukuran = parseFloat(data.ukuran) || 1;
              const total = harga * qty * ukuran;
              
              alert(`Quick Stats:\nCustomer: ${data.nama_customer}\nDeskripsi: ${data.deskripsi}\nTotal: ${App.ui.formatRupiah(total)}`);
            }
          }
        ],

        rowFormatter: function(row) {
          const data = row.getData();
          const rowId = data.id;
          const color = self.state.colorMarkers.get(rowId);
          
          if (color) {
            const cells = row.getCells();
            cells.forEach(cell => {
              cell.getElement().style.backgroundColor = color;
            });
          }
        }
      });

      console.log("✅ Status Barang Tabulator initialized successfully");

    } catch (err) {
      console.error("❌ Tabulator initialization error:", err);
      this.showError("Gagal memuat tabel: " + err.message);
    }
  },

  // ✅ HANDLE CHECKBOX CHANGE
  handleCheckboxChange(checkbox, rowId, fieldName) {
    const row = this.state.table.getRow(rowId);
    if (!row) {
      console.error(`❌ Row not found with ID: ${rowId}`);
      return;
    }

    const isChecked = checkbox.checked;
    console.log(`✅ Checkbox ${fieldName}:`, isChecked, "for row:", rowId);

    // Update data in table
    row.update({
      [fieldName]: isChecked
    });

    // Auto save to database
    this.handleCheckboxSave(row, fieldName, isChecked);
  },

  // ✅ AUTO SAVE CHECKBOX STATUS
  async handleCheckboxSave(row, fieldName, value) {
    const rowData = row.getData();
    const rowId = rowData.id;

    if (!rowId) {
      console.warn("⚠️ Row belum memiliki ID, skip save");
      return;
    }

    try {
      this.updateStatus(`💾 Menyimpan ${this.getFieldLabel(fieldName)}...`);

      // Map field names untuk database
      const databaseFieldMap = {
        'di_produksi': 'di_produksi',
        'di_warna': 'di_warna', 
        'siap_kirim': 'siap_kirim',
        'di_kirim': 'di_kirim',
        'pembayaran': 'pembayaran'
      };

      const dbFieldName = databaseFieldMap[fieldName];
      
      if (!dbFieldName) {
        throw new Error(`Field name ${fieldName} tidak valid`);
      }

      const payload = {
        [dbFieldName]: value,
        bulan: parseInt(this.state.currentMonth),
        tahun: parseInt(this.state.currentYear)
      };

      console.log(`📤 Saving ${dbFieldName}:`, payload, "to row:", rowId);

      const response = await App.api.request(`/workorders/${rowId}`, {
        method: 'PATCH',
        body: payload
      });

      this.state.lastUpdateTime = new Date().toISOString();
      this.updateStatus(`✅ ${this.getFieldLabel(fieldName)} ${value ? 'dicentang' : 'dihapus'}`);

      // EMIT SOCKET EVENT
      if (App.state.socket) {
        App.state.socket.emit('wo_updated', {
          id: rowId,
          ...payload,
          updated_at: this.state.lastUpdateTime
        });
      }

    } catch (err) {
      console.error(`❌ Error saving ${fieldName}:`, err);
      
      // Revert checkbox state on error
      const currentRow = this.state.table.getRow(rowId);
      if (currentRow) {
        currentRow.update({
          [fieldName]: !value
        });
        // Also revert the checkbox visually
        const checkbox = currentRow.getCell(fieldName).getElement().querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !value;
        }
      }
      
      this.updateStatus(`❌ Gagal menyimpan ${this.getFieldLabel(fieldName)}: ${err.message}`);
    }
  },

  // ✅ REAL-TIME AUTO SAVE untuk text fields
async handleCellEdit(row, fieldName) {
  // 🚫 Jika sedang menyimpan, tunda dulu
  if (this.state.isSaving) {
    console.log("⏳ Sedang menyimpan data lain, tunggu sebentar...");
    return;
  }

  let rowData = row.getData();
  let rowId = rowData.id;
  const value = rowData[fieldName];

  console.log(`💾 Saving ${fieldName}:`, value, "for row:", rowId);

  // 🗓️ Auto isi tanggal jika belum ada
  if (fieldName === "nama_customer" && !rowData.tanggal) {
    const today = new Date().toISOString().split("T")[0];
    row.update({ tanggal: today });
    console.log(`🗓️ Auto isi tanggal: ${today}`);
  }

  // 🧠 Jika ID masih kosong/temp, buat row baru terlebih dahulu
  if (!rowId || rowId.toString().startsWith("temp")) {
    console.warn("⚠️ Row masih temp, membuat data baru sebelum update...");

    // Lock seluruh tabel selama proses create
    this.state.isSaving = true;
    this.updateStatus("💾 Menyimpan data baru ke database...");

    try {
      await this.createNewRow(row);
      // Tunggu 200 ms agar update ID sempat tersinkron
      await new Promise((resolve) => setTimeout(resolve, 200));

      rowData = row.getData();
      rowId = rowData.id;

      if (!rowId || rowId.toString().startsWith("temp")) {
        throw new Error("Gagal mendapatkan ID dari server");
      }

      console.log("✅ Row baru berhasil dibuat di DB dengan ID:", rowId);
    } catch (err) {
      console.error("❌ Gagal createNewRow:", err);
      this.updateStatus("❌ Gagal membuat data baru, ulangi input nama & deskripsi.");
      this.state.isSaving = false;
      return;
    }

    // Unlock table
    this.state.isSaving = false;
  }

  // 🧩 Debounce (hindari spam)
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

      // Boolean field jadi 'true'/'false'
      if (
        fieldName.includes("di_") ||
        fieldName.includes("siap_") ||
        fieldName === "pembayaran"
      ) {
        payload[fieldName] = value === true ? "true" : "false";
      }

      console.log(`📤 PATCH payload for ${fieldName}:`, payload);

      await App.api.request(`/workorders/${rowId}`, {
        method: "PATCH",
        body: payload,
      });

      console.log(`✅ ${fieldName} tersimpan`);
      this.updateStatus(`✅ ${fieldName} tersimpan`);
    } catch (err) {
      console.error(`❌ Error saving ${fieldName}:`, err);
      this.updateStatus(`❌ ${err.message || "Gagal menyimpan perubahan"}`);
    } finally {
      this.state.isSaving = false;
      this.state.pendingSaves.delete(saveKey);
    }
  }, 800);

  this.state.pendingSaves.set(saveKey, saveTimeout);
},





  // ✅ GET FIELD LABEL
  getFieldLabel(fieldName) {
    const labels = {
      'di_produksi': 'Status Produksi',
      'di_warna': 'Status Warna', 
      'siap_kirim': 'Status Siap Kirim',
      'di_kirim': 'Status Dikirim',
      'pembayaran': 'Status Pembayaran'
    };
    return labels[fieldName] || fieldName;
  },

  // ✅ COLOR PICKER FUNCTIONS
  openColorPicker(row) {
    const rowId = row.getData().id;
    const currentColor = this.state.colorMarkers.get(rowId) || '#ffffff';
    
    const colors = [
      '#ffffff', '#ffebee', '#fff9c4', '#e8f5e8', '#e3f2fd', 
      '#f3e5f5', '#e0f2f1', '#fff3e0', '#fafafa', '#eceff1'
    ];
    
    const colorHTML = colors.map(color => `
      <div style="
        background: ${color}; 
        width: 30px; 
        height: 30px; 
        border: 2px solid ${color === currentColor ? '#333' : '#ccc'}; 
        border-radius: 4px;
        cursor: pointer;
        display: inline-block;
        margin: 2px;
      " onclick="App.pages['status-barang'].setRowColorByIndex(${rowId}, '${color}')"></div>
    `).join('');
    
    const picker = document.createElement('div');
    picker.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 10000;
      ">
        <h3 style="margin: 0 0 15px 0;">Pilih Warna Marker</h3>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;">
          ${colorHTML}
        </div>
        <button onclick="this.parentElement.remove()" 
                style="margin-top: 15px; padding: 5px 10px; background: #666; color: white; border: none; border-radius: 4px;">
          Tutup
        </button>
      </div>
    `;
    
    document.body.appendChild(picker);
  },

  setRowColorByIndex(rowId, color) {
    const row = this.state.table.getRow(rowId);
    if (row) {
      this.setRowColor(row, color);
    }
    document.querySelectorAll('div').forEach(el => {
      if (el.style.position === 'fixed' && el.style.top === '50%') {
        el.remove();
      }
    });
  },

  setRowColor(row, color) {
    const rowId = row.getData().id;
    
    if (color === '#ffffff') {
      this.state.colorMarkers.delete(rowId);
    } else {
      this.state.colorMarkers.set(rowId, color);
    }
    
    this.saveColorMarkers();
    row.reformat();
    this.updateStatus("🎨 Warna marker disimpan");
  },

  clearRowColor(row) {
    this.setRowColor(row, '#ffffff');
  },

  saveColorMarkers() {
    const markersObj = Object.fromEntries(this.state.colorMarkers);
    localStorage.setItem('statusBarangColorMarkers', JSON.stringify(markersObj));
  },

  loadColorMarkers() {
    try {
      const saved = localStorage.getItem('statusBarangColorMarkers');
      if (saved) {
        const markersObj = JSON.parse(saved);
        this.state.colorMarkers = new Map(Object.entries(markersObj));
        console.log("✅ Color markers loaded:", this.state.colorMarkers.size);
      }
    } catch (err) {
      console.error("❌ Error loading color markers:", err);
    }
  },

  updateStatus(message) {
    if (this.elements.status) {
      this.elements.status.textContent = message;
      
      if (message.includes("✅") || message.includes("🎨")) {
        setTimeout(() => {
          if (this.elements.status.textContent === message) {
            this.elements.status.textContent = "";
          }
        }, 3000);
      }
    }
  },

  showError(message) {
    if (this.elements.gridContainer) {
      this.elements.gridContainer.innerHTML = `
        <div class="p-8 text-center text-red-600 bg-red-50 rounded-lg">
          <div class="text-lg font-semibold mb-2">Error</div>
          <div>${message}</div>
          <button onclick="App.pages['status-barang'].loadData()" 
                  class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Coba Lagi
          </button>
        </div>
      `;
    }
    App.ui.showToast(message, "error");
  }
};

// Load color markers when page loads
App.pages["status-barang"].loadColorMarkers();






// ======================================================
// 📘 APP.DATA-KARYAWAN.JS - FIXED EDIT MODAL VERSION
// ======================================================
App.pages["data-karyawan"] = {
  state: { 
    data: [],
    isEditMode: false,
    currentEditId: null
  },
  elements: {},

  async init() {
    console.log("📄 Memuat halaman Data Karyawan...");
    
    // 🎯 Element references
    this.elements = {
      tableContainer: document.getElementById("karyawan-table-body"),
      addForm: document.getElementById("karyawan-form"),
      modal: document.getElementById("karyawan-modal"),
      addBtn: document.getElementById("add-karyawan-btn"),
      cancelBtn: document.getElementById("cancel-karyawan-btn"),
      modalTitle: document.getElementById("karyawan-modal-title"),
      hiddenId: document.getElementById("karyawan-id"),
      submitBtn: document.querySelector("#karyawan-form button[type='submit']")
    };

    console.log("🔍 Elements found:", Object.keys(this.elements).filter(key => this.elements[key]));

    // 🔄 Load data awal
    await this.loadData();

    // ⚙️ Event tombol modal
    this.elements.addBtn?.addEventListener("click", () => this.showAddModal());
    this.elements.cancelBtn?.addEventListener("click", () => this.hideModal());

    // 💾 Form submit
    this.elements.addForm?.addEventListener("submit", (e) => this.handleSubmit(e));

    // ⚡ Socket.IO Realtime Event
    this.setupSocketListeners();
  },

  setupSocketListeners() {
    if (App.state.socket) {
      console.log("⚡ Socket.IO aktif untuk data-karyawan");

      // Remove existing listeners first
      App.state.socket.off("karyawan:new");
      App.state.socket.off("karyawan:update");
      App.state.socket.off("karyawan:delete");

      // Add new listeners
      App.state.socket.on("karyawan:new", (data) => {
        console.log("👤 Realtime karyawan baru:", data);
        this.state.data.push(data);
        this.render(this.state.data);
        App.ui.showToast(`Karyawan baru: ${data.nama_karyawan}`, "success");
      });

      App.state.socket.on("karyawan:update", (data) => {
        console.log("♻️ Realtime update:", data);
        const idx = this.state.data.findIndex(k => k.id === data.id);
        if (idx !== -1) {
          this.state.data[idx] = data;
          this.render(this.state.data);
        }
      });

      App.state.socket.on("karyawan:delete", (data) => {
        console.log("🗑️ Realtime delete:", data);
        this.state.data = this.state.data.filter(k => k.id !== data.id);
        this.render(this.state.data);
        App.ui.showToast("Karyawan dihapus", "warning");
      });
    } else {
      console.warn("⚠️ Socket.IO belum aktif");
    }
  },

  // ======================================================
  // 🔄 Ambil data dari backend
  // ======================================================
  async loadData() {
    try {
      this.showLoading();
      const data = await App.api.request("/karyawan");
      this.state.data = data;
      this.render(data);
      this.showMessage(`Data berhasil dimuat (${data.length} karyawan)`, "success");
    } catch (err) {
      console.error("❌ Gagal memuat data:", err);
      this.showMessage("Gagal memuat data karyawan: " + err.message, "error");
    }
  },

  showLoading() {
    if (this.elements.tableContainer) {
      this.elements.tableContainer.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-gray-500">
            <div class="flex justify-center items-center">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-[#A67B5B] mr-2"></div>
              Memuat data...
            </div>
          </td>
        </tr>
      `;
    }
  },

  // ======================================================
  // 🧱 Render tabel karyawan
  // ======================================================
  render(data) {
    if (!this.elements.tableContainer) {
      console.error("❌ Table container not found");
      return;
    }

    if (!data || data.length === 0) {
      this.elements.tableContainer.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-gray-500">
            <div class="flex flex-col items-center">
              <span class="text-4xl mb-2">👥</span>
              <p class="text-lg font-medium">Belum ada data karyawan</p>
              <p class="text-sm">Klik "Tambah Karyawan" untuk menambahkan data</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    this.elements.tableContainer.innerHTML = data.map((k) => `
      <tr class="hover:bg-gray-50 border-b transition-colors">
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${this.escapeHtml(k.nama_karyawan) || '-'}</td>
        <td class="px-6 py-4 text-sm text-right font-mono">${App.ui.formatRupiah(k.gaji_harian || 0)}</td>
        <td class="px-6 py-4 text-sm text-right font-mono">${App.ui.formatRupiah(k.potongan_bpjs_kesehatan || 0)}</td>
        <td class="px-6 py-4 text-sm text-right font-mono">${App.ui.formatRupiah(k.potongan_bpjs_ketenagakerjaan || 0)}</td>
        <td class="px-6 py-4 text-sm text-right font-mono">${App.ui.formatRupiah(k.kasbon || 0)}</td>
        <td class="px-6 py-4 text-center text-sm space-x-3">
          <button class="text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded transition-colors" 
                  onclick="App.pages['data-karyawan'].editKaryawan(${k.id})">
            Edit
          </button>
          <button class="text-red-600 hover:text-red-800 font-medium px-3 py-1 rounded transition-colors" 
                  onclick="App.pages['data-karyawan'].deleteKaryawan(${k.id})">
            Hapus
          </button>
        </td>
      </tr>
    `).join("");
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ======================================================
  // 💾 Handle Submit untuk ADD dan EDIT
  // ======================================================
  async handleSubmit(e) {
    e.preventDefault();
    
    if (!this.validateForm()) {
      return;
    }

    const formData = this.getFormData();
    
    try {
      this.setSubmitButtonState(true);
      
      if (this.state.isEditMode && this.state.currentEditId) {
        await this.updateKaryawan(formData);
      } else {
        await this.addKaryawan(formData);
      }
      
      this.hideModal();
      await this.loadData(); // Reload data terbaru
      
    } catch (err) {
      console.error("❌ Gagal menyimpan karyawan:", err);
      App.ui.showToast("Gagal menyimpan karyawan: " + err.message, "error");
    } finally {
      this.setSubmitButtonState(false);
    }
  },

  validateForm() {
    const nama = this.elements.addForm.nama_karyawan.value.trim();
    if (!nama) {
      App.ui.showToast("Nama karyawan wajib diisi", "error");
      return false;
    }
    return true;
  },

  getFormData() {
    const form = this.elements.addForm;
    return {
      nama_karyawan: form.nama_karyawan.value.trim(),
      gaji_harian: parseFloat(form.gaji_harian.value || 0),
      potongan_bpjs_kesehatan: parseFloat(form.potongan_bpjs_kesehatan.value || 0),
      potongan_bpjs_ketenagakerjaan: parseFloat(form.potongan_bpjs_ketenagakerjaan.value || 0),
      kasbon: parseFloat(form.kasbon.value || 0)
    };
  },

  async addKaryawan(data) {
    const result = await App.api.request("/karyawan", {
      method: "POST",
      body: data
    });

    // Emit realtime event
    if (App.state.socket) {
      App.state.socket.emit("karyawan:new", result);
    }

    App.ui.showToast("Karyawan berhasil ditambahkan", "success");
    return result;
  },

  async updateKaryawan(data) {
    const result = await App.api.request(`/karyawan/${this.state.currentEditId}`, {
      method: "PUT",
      body: data
    });

    // Emit realtime event
    if (App.state.socket) {
      App.state.socket.emit("karyawan:update", result);
    }

    App.ui.showToast("Karyawan berhasil diupdate", "success");
    return result;
  },

  // ======================================================
  // ✏️ Edit karyawan - PERBAIKAN DI SINI
  // ======================================================
  editKaryawan(id) {
    console.log("✏️ Edit karyawan dengan ID:", id);
    
    const karyawan = this.state.data.find(k => k.id === id);
    if (!karyawan) {
      App.ui.showToast("Data karyawan tidak ditemukan", "error");
      return;
    }

    // Set edit mode
    this.state.isEditMode = true;
    this.state.currentEditId = id;

    console.log("📝 Mengisi form dengan data:", karyawan);

    // Populate form dengan data yang akan diedit
    const form = this.elements.addForm;
    form.nama_karyawan.value = karyawan.nama_karyawan || "";
    form.gaji_harian.value = karyawan.gaji_harian || "";
    form.potongan_bpjs_kesehatan.value = karyawan.potongan_bpjs_kesehatan || "";
    form.potongan_bpjs_ketenagakerjaan.value = karyawan.potongan_bpjs_ketenagakerjaan || "";
    form.kasbon.value = karyawan.kasbon || "";

    // Update UI untuk edit mode - JANGAN reset form!
    if (this.elements.modalTitle) {
      this.elements.modalTitle.textContent = "Edit Karyawan";
    }
    if (this.elements.hiddenId) {
      this.elements.hiddenId.value = id;
    }
    if (this.elements.submitBtn) {
      this.elements.submitBtn.textContent = "Update Karyawan";
    }

    // Tampilkan modal TANPA reset form
    this.showModal(false); // false = jangan reset form
  },

  // ======================================================
  // 🗑️ Hapus karyawan
  // ======================================================
  async deleteKaryawan(id) {
    if (!confirm("Yakin ingin menghapus data karyawan ini?")) return;

    try {
      await App.api.request(`/karyawan/${id}`, { method: "DELETE" });
      
      // Update local state
      this.state.data = this.state.data.filter(k => k.id !== id);
      this.render(this.state.data);

      // Emit realtime event
      if (App.state.socket) {
        App.state.socket.emit("karyawan:delete", { id });
      }
      
      App.ui.showToast("Karyawan berhasil dihapus", "warning");
    } catch (err) {
      console.error("❌ Gagal hapus karyawan:", err);
      App.ui.showToast("Gagal menghapus data karyawan: " + err.message, "error");
    }
  },

  // ======================================================
  // 🎭 Modal kontrol - PERBAIKAN DI SINI
  // ======================================================
  showAddModal() {
    console.log("➕ Menampilkan modal tambah karyawan");
    this.state.isEditMode = false;
    this.state.currentEditId = null;
    
    if (this.elements.modalTitle) {
      this.elements.modalTitle.textContent = "Tambah Karyawan";
    }
    if (this.elements.submitBtn) {
      this.elements.submitBtn.textContent = "Simpan";
    }
    
    this.showModal(true); // true = reset form
  },

  showModal(resetForm = true) {
    const modal = this.elements.modal;
    if (!modal) {
      console.error("❌ Modal element not found");
      return;
    }

    // Hanya reset form jika diminta (untuk tambah, bukan edit)
    if (resetForm) {
      this.resetForm();
    }

    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.classList.remove("opacity-0");
    }, 10);
  },

  hideModal() {
    const modal = this.elements.modal;
    if (!modal) return;

    modal.classList.add("opacity-0");
    setTimeout(() => {
      modal.classList.add("hidden");
      // Reset form saat modal ditutup
      this.resetForm();
    }, 300);
  },

  resetForm() {
    if (this.elements.addForm) {
      this.elements.addForm.reset();
    }
    
    // Reset state
    this.state.isEditMode = false;
    this.state.currentEditId = null;
    
    // Reset hidden field
    if (this.elements.hiddenId) {
      this.elements.hiddenId.value = "";
    }
    
    // Reset UI ke mode tambah
    if (this.elements.modalTitle) {
      this.elements.modalTitle.textContent = "Tambah Karyawan";
    }
    if (this.elements.submitBtn) {
      this.elements.submitBtn.textContent = "Simpan";
    }
  },

  setSubmitButtonState(loading) {
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = loading;
      this.elements.submitBtn.textContent = loading 
        ? "Menyimpan..." 
        : (this.state.isEditMode ? "Update Karyawan" : "Simpan");
    }
  },

  showMessage(msg, type = "info") {
    console.log("👤 Karyawan:", msg);
    App.ui.showToast(msg, type);
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

      <!-- Tanda Tangan -->
      <div class="grid grid-cols-2 gap-8 mt-8 pt-6 border-t border-gray-300">
        <div class="text-center">
          <div class="mb-16"></div>
          <div class="border-t border-gray-400 pt-1">
            <p class="text-sm font-medium">Karyawan</p>
          </div>
        </div>
        <div class="text-center">
          <div class="mb-16"></div>
          <div class="border-t border-gray-400 pt-1">
            <p class="text-sm font-medium">Keuangan</p>
          </div>
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
// 📄 SURAT JALAN PAGE - COMPLETE FIXED VERSION
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
    
    // Set default month and year
    this.setDefaultMonthYear();
    
    // Load data untuk tab pewarnaan
    await this.loadWorkOrdersForWarna();
    
    console.log("✅ Surat Jalan initialized successfully");
  },

  initializeElements() {
    this.elements = {
      // Tab navigation
      tabCustomer: document.getElementById("tab-sj-customer"),
      tabWarna: document.getElementById("tab-sj-warna"),
      contentCustomer: document.getElementById("content-sj-customer"),
      contentWarna: document.getElementById("content-sj-warna"),

      // Tab Customer elements
      invoiceSearch: document.getElementById("sj-invoice-search"),
      searchBtn: document.getElementById("sj-search-btn"),
      catatan: document.getElementById("sj-catatan"),
      printBtn: document.getElementById("sj-print-btn"),
      printArea: document.getElementById("sj-print-area"),

      // Tab Warna elements
      vendorSelect: document.getElementById("sj-warna-vendor"),
      monthSelect: document.getElementById("sj-warna-month"),
      yearInput: document.getElementById("sj-warna-year"),
      customerSearch: document.getElementById("sj-warna-customer-search"),
      selectAllCheckbox: document.getElementById("sj-warna-select-all"),
      tableBody: document.getElementById("sj-warna-table-body"),
      printWarnaBtn: document.getElementById("sj-warna-print-btn"),
      printWarnaArea: document.getElementById("sj-warna-print-area"),
      statusInfo: document.getElementById("sj-warna-status") // ✅ TAMBAHKAN INI
    };

    console.log("🔍 Surat Jalan elements found:", Object.keys(this.elements).filter(key => this.elements[key]));
  },

  // ✅ TAMBAHKAN METHOD INI
  setDefaultMonthYear() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    if (this.elements.monthSelect) {
      this.elements.monthSelect.value = currentMonth;
    }
    if (this.elements.yearInput) {
      this.elements.yearInput.value = currentYear;
    }
    
    console.log(`📅 Default set to: Month ${currentMonth}, Year ${currentYear}`);
  },

  setupTabNavigation() {
    this.elements.tabCustomer?.addEventListener("click", () => this.switchTab('customer'));
    this.elements.tabWarna?.addEventListener("click", () => this.switchTab('warna'));
  },

  switchTab(tabName) {
    this.state.currentTab = tabName;

    if (this.elements.tabCustomer && this.elements.tabWarna) {
      if (tabName === 'customer') {
        this.elements.tabCustomer.classList.add("active");
        this.elements.tabWarna.classList.remove("active");
        this.elements.contentCustomer.classList.remove("hidden");
        this.elements.contentWarna.classList.add("hidden");
      } else {
        this.elements.tabCustomer.classList.remove("active");
        this.elements.tabWarna.classList.add("active");
        this.elements.contentCustomer.classList.add("hidden");
        this.elements.contentWarna.classList.remove("hidden");
        
        console.log("🔄 Switching to warna tab, loading data...");
        this.loadWorkOrdersForWarna();
      }
    }
  },

  setupEventListeners() {
    // Tab Customer events
    this.elements.searchBtn?.addEventListener("click", () => this.searchByInvoice());
    this.elements.invoiceSearch?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.searchByInvoice();
    });
    this.elements.printBtn?.addEventListener("click", () => this.printSuratJalan());

    // Tab Warna events
    this.elements.monthSelect?.addEventListener("change", () => {
      console.log("🔄 Month changed, reloading data...");
      this.loadWorkOrdersForWarna();
    });
    this.elements.yearInput?.addEventListener("change", () => {
      console.log("🔄 Year changed, reloading data...");
      this.loadWorkOrdersForWarna();
    });
    this.elements.customerSearch?.addEventListener("input", () => this.filterWorkOrders());
    this.elements.selectAllCheckbox?.addEventListener("change", (e) => this.toggleSelectAll(e.target.checked));
    this.elements.printWarnaBtn?.addEventListener("click", () => this.printSuratJalanWarna());
    this.elements.vendorSelect?.addEventListener("change", () => this.updateWarnaPreview());
  },

  // ======================================================
  // 🔍 TAB CUSTOMER - SEARCH BY INVOICE
  // ======================================================
  async searchByInvoice() {
    const invoiceNo = this.elements.invoiceSearch?.value.trim();
    
    if (!invoiceNo) {
      App.ui.showToast("Masukkan nomor invoice terlebih dahulu", "error");
      return;
    }

    try {
      this.setLoadingState(true);
      
      // ✅ FIX: Gunakan endpoint yang benar
      const result = await App.api.request(`/api/invoice-search/${invoiceNo}`);
      
      if (result && result.length > 0) {
        this.generateCustomerPreview(result, invoiceNo);
        this.elements.printBtn.disabled = false;
      } else {
        this.elements.printArea.innerHTML = `
          <div class="text-center text-red-500 py-8">
            <p>Invoice <strong>${invoiceNo}</strong> tidak ditemukan</p>
          </div>
        `;
        this.elements.printBtn.disabled = true;
      }
    } catch (err) {
      console.error("❌ Error searching invoice:", err);
      App.ui.showToast("Gagal mencari invoice: " + err.message, "error");
      this.elements.printBtn.disabled = true;
    } finally {
      this.setLoadingState(false);
    }
  },

// ======================================================
// 🔍 TAB CUSTOMER - SIMPLE & CLEAN LAYOUT
// ======================================================
generateCustomerPreview(workOrders, invoiceNo) {
  if (!this.elements.printArea) return;

  const totalItems = workOrders.length;
  const today = new Date().toLocaleDateString('id-ID');
  const nomorSuratJalan = this.generateNomorSuratJalanCustomer();
  const totalQty = workOrders.reduce((sum, wo) => sum + (parseInt(wo.qty) || 0), 0);

  this.elements.printArea.innerHTML = `
    <div class="bg-white p-6" id="sj-customer-print-content">
      <!-- Simple Header -->
      <div class="text-center mb-6">
        <h1 class="text-xl font-bold">CV. TOTO ALUMINIUM MANUFACTURE</h1>
        <p class="text-sm">Jl. Rawa Mulya, Kota Bekasi | Telp: 0813 1191 2002</p>
        <h2 class="text-lg font-bold mt-4 border-b border-black pb-1 inline-block">SURAT JALAN</h2>
      </div>

      <!-- Simple Info -->
      <div class="mb-4 text-sm">
        <p><strong>No. Invoice:</strong> ${invoiceNo}</p>
        <p><strong>Tanggal:</strong> ${today}</p>
        <p><strong>Total Item:</strong> ${totalItems} barang</p>
        <p><strong>Total Quantity:</strong> ${totalQty}</p>
      </div>

      <!-- Simple Table -->
      <table class="w-full border border-gray-800 text-xs mb-4">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-800 p-1 text-center w-8">No</th>
            <th class="border border-gray-800 p-1 text-left">Nama Customer</th>
            <th class="border border-gray-800 p-1 text-left">Deskripsi Barang</th>
            <th class="border border-gray-800 p-1 text-center w-16">Ukuran</th>
            <th class="border border-gray-800 p-1 text-center w-16">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${workOrders.map((wo, index) => `
            <tr>
              <td class="border border-gray-800 p-1 text-center">${index + 1}</td>
              <td class="border border-gray-800 p-1">${wo.nama_customer || '-'}</td>
              <td class="border border-gray-800 p-1">${wo.deskripsi || '-'}</td>
              <td class="border border-gray-800 p-1 text-center">${wo.ukuran || '-'}</td>
              <td class="border border-gray-800 p-1 text-center">${wo.qty || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Simple Note -->
      ${this.elements.catatan?.value ? `
        <div class="mb-4 text-sm">
          <p><strong>Catatan:</strong> ${this.elements.catatan.value}</p>
        </div>
      ` : ''}

      <!-- Simple Signatures -->
      <div class="flex justify-between text-sm mt-8">
        <div class="text-center">
          <div class="mb-12"></div>
          <div class="border-t border-gray-800 pt-1">
            <p class="font-bold">Pengirim</p>
            <p class="text-xs">CV. TOTO ALUMINIUM MANUFACTURE</p>
          </div>
        </div>
        <div class="text-center">
          <div class="mb-12"></div>
          <div class="border-t border-gray-800 pt-1">
            <p class="font-bold">Penerima</p>
            <p class="text-xs">(__________________________)</p>
          </div>
        </div>
      </div>
    </div>
  `;
},

generateNomorSuratJalanCustomer() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Format: SJ/YYYY/MM/DD/XXX (SJ = Surat Jalan Customer)
  const baseNumber = `SJ/${year}/${month}/${day}`;
  const uniqueNumber = Date.now().toString().slice(-4); // 4 digit terakhir timestamp
  
  return `${baseNumber}/${uniqueNumber}`;
},

  // ======================================================
  // 🎨 TAB WARNA - FIXED VERSION
  // ======================================================
  async loadWorkOrdersForWarna() {
    try {
      this.setLoadingState(true);
      
      const month = this.elements.monthSelect?.value || (new Date().getMonth() + 1);
      const year = this.elements.yearInput?.value || new Date().getFullYear();
      
      console.log(`🔍 Loading work orders for warna - Month: ${month}, Year: ${year}`);
      
      // ✅ FIX: Gunakan endpoint yang benar
      const result = await App.api.request(`/api/workorders-warna?month=${month}&year=${year}`);
      
      console.log(`📦 Raw API data received:`, result);
      
      // ✅ SIMPLE FILTER: Handle berbagai format boolean
      this.state.workOrders = (result || []).filter(wo => {
        const isProduced = 
          wo.di_produksi === true || 
          wo.di_produksi === 'true' || 
          wo.di_produksi === 1 || 
          wo.di_produksi === '1';
        
        const isNotColored = 
          wo.di_warna === false || 
          wo.di_warna === 'false' || 
          wo.di_warna === 0 || 
          wo.di_warna === '0' || 
          wo.di_warna === null || 
          wo.di_warna === undefined;
        
        const isReady = isProduced && isNotColored;
        
        if (isReady) {
          console.log(`✅ WO ${wo.id} ready for warna:`, {
            customer: wo.nama_customer,
            di_produksi: wo.di_produksi,
            di_warna: wo.di_warna
          });
        }
        
        return isReady;
      });
      
      console.log(`📦 Final filtered: ${this.state.workOrders.length} items ready for warna`);
      
      this.renderWorkOrdersTable();
      this.updateWarnaPreview();
      
      // Update status info
      this.updateStatusInfo(`✅ ${this.state.workOrders.length} barang siap diwarna`);
      
    } catch (err) {
      console.error("❌ Error loading work orders for warna:", err);
      this.updateStatusInfo("❌ Gagal memuat data barang");
      App.ui.showToast("Gagal memuat data barang", "error");
    } finally {
      this.setLoadingState(false);
    }
  },

  // ✅ TAMBAHKAN METHOD INI
  updateStatusInfo(message) {
    if (this.elements.statusInfo) {
      this.elements.statusInfo.textContent = message;
    } else {
      console.log("ℹ️ Status info:", message);
    }
  },

  renderWorkOrdersTable() {
    if (!this.elements.tableBody) return;

    if (this.state.workOrders.length === 0) {
      this.elements.tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-4 text-center text-gray-500">
            Tidak ada barang yang siap untuk diwarna
          </td>
        </tr>
      `;
      if (this.elements.selectAllCheckbox) {
        this.elements.selectAllCheckbox.checked = false;
        this.elements.selectAllCheckbox.disabled = true;
      }
      return;
    }

    if (this.elements.selectAllCheckbox) {
      this.elements.selectAllCheckbox.disabled = false;
    }

    this.elements.tableBody.innerHTML = this.state.workOrders.map(wo => `
      <tr class="hover:bg-gray-50 border-b">
        <td class="p-2 text-center">
          <input type="checkbox" class="item-checkbox w-4 h-4" value="${wo.id}" 
                 ${this.state.selectedItems.includes(wo.id) ? 'checked' : ''}>
        </td>
        <td class="p-2 text-sm">${wo.nama_customer || '-'}</td>
        <td class="p-2 text-sm">${wo.deskripsi || '-'}</td>
        <td class="p-2 text-sm text-center">${wo.ukuran || '-'}</td>
        <td class="p-2 text-sm text-center">${wo.qty || '-'}</td>
      </tr>
    `).join('');

    // Add event listeners to checkboxes
    this.elements.tableBody.querySelectorAll('.item-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => this.toggleItemSelection(e.target.value, e.target.checked));
    });
  },

  filterWorkOrders() {
    const searchTerm = this.elements.customerSearch?.value.toLowerCase().trim();
    
    if (!searchTerm) {
      this.renderWorkOrdersTable();
      return;
    }

    const filtered = this.state.workOrders.filter(wo => 
      (wo.nama_customer?.toLowerCase().includes(searchTerm) ||
      wo.deskripsi?.toLowerCase().includes(searchTerm))
    );

    if (this.elements.tableBody) {
      this.elements.tableBody.innerHTML = filtered.map(wo => `
        <tr class="hover:bg-gray-50 border-b">
          <td class="p-2 text-center">
            <input type="checkbox" class="item-checkbox w-4 h-4" value="${wo.id}" 
                   ${this.state.selectedItems.includes(wo.id) ? 'checked' : ''}>
          </td>
          <td class="p-2 text-sm">${wo.nama_customer || '-'}</td>
          <td class="p-2 text-sm">${wo.deskripsi || '-'}</td>
          <td class="p-2 text-sm text-center">${wo.ukuran || '-'}</td>
          <td class="p-2 text-sm text-center">${wo.qty || '-'}</td>
        </tr>
      `).join('');

      // Re-add event listeners
      this.elements.tableBody.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => this.toggleItemSelection(e.target.value, e.target.checked));
      });
    }
  },

  toggleSelectAll(checked) {
    if (checked) {
      this.state.selectedItems = this.state.workOrders.map(wo => wo.id);
    } else {
      this.state.selectedItems = [];
    }
    this.renderWorkOrdersTable();
    this.updateWarnaPreview();
  },

  toggleItemSelection(itemId, checked) {
    const numericId = parseInt(itemId);
    
    if (checked) {
      if (!this.state.selectedItems.includes(numericId)) {
        this.state.selectedItems.push(numericId);
      }
    } else {
      this.state.selectedItems = this.state.selectedItems.filter(id => id !== numericId);
    }
    
    // Update select all checkbox
    if (this.elements.selectAllCheckbox) {
      const allSelected = this.state.selectedItems.length === this.state.workOrders.length;
      this.elements.selectAllCheckbox.checked = allSelected;
    }
    
    this.updateWarnaPreview();
  },

updateWarnaPreview() {
  if (!this.elements.printWarnaArea) return;

  const selectedWorkOrders = this.state.workOrders.filter(wo => 
    this.state.selectedItems.includes(wo.id)
  );

  if (selectedWorkOrders.length === 0) {
    this.elements.printWarnaArea.innerHTML = `
      <div class="text-center text-gray-500 py-16">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="mt-4 text-lg font-medium">Pilih barang untuk melihat preview surat jalan</p>
        <p class="text-sm mt-2">Gunakan checklist di tabel sebelah kiri untuk memilih barang</p>
      </div>
    `;
    this.elements.printWarnaBtn.disabled = true;
    return;
  }

  this.elements.printWarnaBtn.disabled = false;

  const vendor = this.elements.vendorSelect?.value || 'Vendor Pewarnaan';
  const today = new Date().toLocaleDateString('id-ID');
  const nomorSuratJalan = this.generateNomorSuratJalan();
  const totalQty = selectedWorkOrders.reduce((sum, wo) => sum + (parseInt(wo.qty) || 0), 0);

  this.elements.printWarnaArea.innerHTML = `
    <div class="bg-white p-6" id="sj-warna-print-content">
      <!-- Simple Header -->
      <div class="text-center mb-6">
        <h1 class="text-xl font-bold">CV. TOTO ALUMINIUM MANUFACTURE</h1>
        <p class="text-sm">Jl. Rawa Mulya, Kota Bekasi | Telp: 0813 1191 2002</p>
        <h2 class="text-lg font-bold mt-4 border-b border-black pb-1 inline-block">SURAT JALAN PEWARNAAN</h2>
      </div>

      <!-- Simple Info -->
      <div class="mb-4 text-sm">
        <p><strong>Vendor Pewarnaan:</strong> ${vendor}</p>
        <p><strong>Tanggal:</strong> ${today}</p>
        <p><strong>Total Item:</strong> ${selectedWorkOrders.length} barang</p>
        <p><strong>Total Quantity:</strong> ${totalQty}</p>
      </div>

      <!-- Simple Table -->
      <table class="w-full border border-gray-800 text-xs mb-4">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-800 p-1 text-center w-8">No</th>
            <th class="border border-gray-800 p-1 text-left">Nama Customer</th>
            <th class="border border-gray-800 p-1 text-left">Deskripsi Barang</th>
            <th class="border border-gray-800 p-1 text-center w-16">Ukuran</th>
            <th class="border border-gray-800 p-1 text-center w-16">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${selectedWorkOrders.map((wo, index) => `
            <tr>
              <td class="border border-gray-800 p-1 text-center">${index + 1}</td>
              <td class="border border-gray-800 p-1">${wo.nama_customer || '-'}</td>
              <td class="border border-gray-800 p-1">${wo.deskripsi || '-'}</td>
              <td class="border border-gray-800 p-1 text-center">${wo.ukuran || '-'}</td>
              <td class="border border-gray-800 p-1 text-center">${wo.qty || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Simple Instructions -->
      <div class="mb-6 text-sm">
        <p class="font-bold">INSTRUKSI KHUSUS:</p>
        <p>Barang-barang di atas perlu dilakukan proses pewarnaan sesuai standar kualitas CV. TOTO ALUMINIUM MANUFACTURE</p>
      </div>

      <!-- Simple Signatures -->
      <div class="flex justify-between text-sm">
        <div class="text-center">
          <div class="mb-12"></div>
          <div class="border-t border-gray-800 pt-1">
            <p class="font-bold">PT. TOTO Aluminium</p>
          </div>
        </div>
        <div class="text-center">
          <div class="mb-12"></div>
          <div class="border-t border-gray-800 pt-1">
            <p class="font-bold">${vendor}</p>
          </div>
        </div>
      </div>

      <!-- Simple Footer -->
      <div class="mt-8 text-center text-xs text-gray-500">
        <p>Surat Jalan Pewarnaan ini dibuat secara otomatis oleh sistem CV. TOTO ALUMINIUM MANUFACTURE</p>
      </div>
    </div>
  `;
},

generateNomorSuratJalan() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Format: SJW/YYYY/MM/DD/XXX (SJW = Surat Jalan Warna)
  const baseNumber = `SJW/${year}/${month}/${day}`;
  const uniqueNumber = Date.now().toString().slice(-3);
  
  return `${baseNumber}/${uniqueNumber}`;
},

  // ======================================================
  // 🖨️ PRINT FUNCTIONS
  // ======================================================
async printSuratJalanWarna() {
  if (this.state.selectedItems.length === 0) {
    App.ui.showToast("Pilih minimal satu barang untuk dicetak", "error");
    return;
  }

  try {
    this.setLoadingState(true);
    
    const vendor = this.elements.vendorSelect?.value;
    if (!vendor) {
      App.ui.showToast("Pilih vendor pewarnaan terlebih dahulu", "error");
      return;
    }

    // ✅ GENERATE NOMOR SURAT JALAN SEBELUM SIMPAN
    const nomorSuratJalan = this.generateNomorSuratJalan();
    
    console.log(`📄 Creating Surat Jalan dengan nomor: ${nomorSuratJalan}`);

    // Simpan ke database dengan nomor surat jalan
    const result = await App.api.request("/api/surat-jalan", {
      method: "POST",
      body: {
        tipe: "VENDOR",
        no_surat_jalan: nomorSuratJalan,
        no_invoice: "SJW-" + Date.now(),
        nama_tujuan: vendor,
        items: this.state.selectedItems.map(id => ({ id })),
        catatan: "Surat Jalan Pewarnaan"
      }
    });

    App.ui.showToast(`Surat Jalan ${nomorSuratJalan} berhasil dibuat untuk ${vendor}`, "success");
    
    // Print dengan styling sederhana
    const printStyles = `
      <style>
        @media print {
          body * {
            visibility: hidden;
            margin: 0;
            padding: 0;
          }
          #sj-warna-print-content, #sj-warna-print-content * {
            visibility: visible;
          }
          #sj-warna-print-content {
            position: absolute;
            left: 0.5cm;
            top: 0.5cm;
            right: 0.5cm;
            bottom: 0.5cm;
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.3;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th, td {
            border: 1px solid #000;
            padding: 3px 4px;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          h1, h2 {
            margin: 0;
            padding: 0;
          }
        }
        @page {
          margin: 0.5cm;
          size: A4;
        }
      </style>
    `;
    
    App.ui.printElement("sj-warna-print-content", printStyles);
    
    // Reset selection dan reload data
    this.state.selectedItems = [];
    await this.loadWorkOrdersForWarna();
    
  } catch (err) {
    console.error("❌ Error creating surat jalan warna:", err);
    App.ui.showToast("Gagal membuat surat jalan: " + err.message, "error");
  } finally {
    this.setLoadingState(false);
  }
},

  setLoadingState(loading) {
    this.state.isLoading = loading;
    
    const buttons = [this.elements.printBtn, this.elements.printWarnaBtn, this.elements.searchBtn];
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = loading;
        btn.classList.toggle("opacity-50", loading);
        btn.classList.toggle("cursor-not-allowed", loading);
      }
    });
  }
};

// ======================================================
// 💵 KEUANGAN PAGE
// ======================================================
App.pages["keuangan"] = {
  state: { saldo: [], riwayat: [] },
  elements: {},

  async init() {
    this.elements.saldoContainer = document.getElementById("saldo-container");
    this.elements.transaksiForm = document.getElementById("transaksi-form");
    this.elements.riwayatContainer = document.getElementById("riwayat-container");
    this.elements.monthFilter = document.getElementById("keuangan-month-filter");
    this.elements.yearFilter = document.getElementById("keuangan-year-filter");
    this.elements.filterBtn = document.getElementById("filter-keuangan-btn");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.transaksiForm?.addEventListener("submit", (e) => this.submitTransaksi(e));
    this.elements.filterBtn?.addEventListener("click", () => this.loadRiwayat());

    await this.loadSaldo();
    await this.loadRiwayat();
  },

  async loadSaldo() {
    try {
      const data = await App.api.request("/keuangan/saldo");
      this.state.saldo = data;
      this.renderSaldo(data);
    } catch (err) {
      console.error("❌ Gagal load saldo:", err);
      App.ui.showToast("Gagal memuat data saldo", "error");
    }
  },

  renderSaldo(data) {
    if (!this.elements.saldoContainer) return;

    if (!data || data.length === 0) {
      this.elements.saldoContainer.innerHTML = `
        <div class="text-center py-4 text-gray-500">
          <p>Tidak ada data kas</p>
        </div>
      `;
      return;
    }

    this.elements.saldoContainer.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${data.map(kas => `
          <div class="p-6 bg-white rounded-lg shadow border">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">${kas.nama_kas}</p>
                <p class="text-2xl font-bold text-green-600 mt-1">${App.ui.formatRupiah(kas.saldo)}</p>
              </div>
              <div class="text-3xl text-green-500">
                💰
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async submitTransaksi(e) {
    e.preventDefault();
    
    const formData = new FormData(this.elements.transaksiForm);
    const data = {
      tanggal: formData.get('tanggal'),
      jumlah: parseFloat(formData.get('jumlah') || 0),
      tipe: formData.get('tipe'),
      kas_id: formData.get('kas_id'),
      keterangan: formData.get('keterangan')
    };

    try {
      await App.api.request("/keuangan/transaksi", {
        method: "POST",
        body: data
      });
      
      App.ui.showToast("Transaksi berhasil disimpan!", "success");
      this.elements.transaksiForm.reset();
      
      // Reload data
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
      
      const data = await App.api.request(`/keuangan/riwayat?month=${month}&year=${year}`);
      this.state.riwayat = data;
      this.renderRiwayat(data);
    } catch (err) {
      console.error("❌ Riwayat error:", err);
      App.ui.showToast("Gagal memuat riwayat transaksi", "error");
    }
  },

  renderRiwayat(data) {
    if (!this.elements.riwayatContainer) return;

    if (!data || data.length === 0) {
      this.elements.riwayatContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Tidak ada riwayat transaksi untuk periode yang dipilih</p>
        </div>
      `;
      return;
    }

    this.elements.riwayatContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Kas</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Saldo</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(r => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">${App.ui.formatDate(r.tanggal)}</td>
                <td class="px-4 py-3 text-sm">${r.nama_kas}</td>
                <td class="px-4 py-3 text-sm">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    r.tipe === 'PEMASUKAN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }">
                    ${r.tipe}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-right font-medium ${
                  r.tipe === 'PEMASUKAN' ? 'text-green-600' : 'text-red-600'
                }">
                  ${r.tipe === 'PEMASUKAN' ? '+' : '-'}${App.ui.formatRupiah(r.jumlah)}
                </td>
                <td class="px-4 py-3 text-sm">${r.keterangan || '-'}</td>
                <td class="px-4 py-3 text-sm text-right">${App.ui.formatRupiah(r.saldo_sesudah)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
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