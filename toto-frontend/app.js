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
  // ⚡ SOCKET.IO CLIENT (Realtime Connection)
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
App.pages["dashboard"] = {
  state: { 
    data: null,
    currentTableFilter: 'siap_kirim',
    tableData: {}
  },
  elements: {},

  init() {
    this.elements.monthFilter = document.getElementById("dashboard-month-filter");
    this.elements.yearFilter = document.getElementById("dashboard-year-filter");
    this.elements.filterBtn = document.getElementById("dashboard-filter-btn");
    this.elements.summary = document.getElementById("dashboard-summary");
    this.elements.statusList = document.getElementById("dashboard-status-list");
    this.elements.itemsTable = document.getElementById("dashboard-items-table");
    this.elements.tableTitle = document.getElementById("table-title");
    this.elements.statusFilterBtns = document.querySelectorAll('.status-filter-btn');

    console.log("🔧 Dashboard init - Elements:", {
      monthFilter: !!this.elements.monthFilter,
      yearFilter: !!this.elements.yearFilter,
      summary: !!this.elements.summary,
      statusList: !!this.elements.statusList,
      itemsTable: !!this.elements.itemsTable
    });

    if (!this.elements.monthFilter || !this.elements.yearFilter) {
      console.error("❌ Dashboard filter elements not found");
      return;
    }

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    // Event listeners
    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
    
    // Status filter buttons
    this.elements.statusFilterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const status = e.target.getAttribute('data-status');
        this.setTableFilter(status);
      });
    });

    setTimeout(() => {
      this.loadData();
    }, 500);
  },

 async loadData() {
  try {
    const month = this.elements.monthFilter?.value;
    const year = this.elements.yearFilter?.value;
    
    console.log(`📊 Loading data for: ${month}-${year}`);
    
    if (!month || !year) {
      this.updateStatus("❌ Pilih bulan dan tahun terlebih dahulu");
      return;
    }

    this.state.currentMonth = month;
    this.state.currentYear = year;

    this.updateStatus("⏳ Memuat data work orders...");
    
    // ✅ PERBAIKAN: Tutup string dengan benar
    const res = await App.api.request(`/workorders/chunk?month=${month}&year=${year}`);
    
    console.log("📦 API Response:", res);
    console.log("📄 Response data:", res.data);
    
    if (res && res.data) {
      // Pastikan data memiliki struktur yang benar
      this.state.currentData = res.data.map((item, index) => ({
        ...item,
        row_num: index + 1,
        selected: false // tambah field selected untuk checkbox
      }));
      
      console.log(`✅ Processed ${this.state.currentData.length} rows`);
      console.log("📋 First row sample:", this.state.currentData[0]);
      
      this.initializeTabulator();
      this.updateStatus(`✅ Data berhasil dimuat: ${this.state.currentData.length} work orders`);
    } else {
      throw new Error("Data tidak valid dari server");
    }
    
  } catch (err) {
    console.error("❌ Work orders load error:", err);
    this.updateStatus("❌ Gagal memuat data: " + err.message);
    this.showError("Gagal memuat data: " + err.message);
  }
},

  async loadTableData() {
    try {
      const month = this.elements.monthFilter?.value;
      const year = this.elements.yearFilter?.value;
      const status = this.state.currentTableFilter;
      
      if (!month || !year) return;

      console.log(`📋 Loading table data for status: ${status}`);
      
      // Load data berdasarkan status filter
      const res = await App.api.request(`/workorders?month=${month}&year=${year}&status=${status}`);
      
      this.state.tableData[status] = res || [];
      this.renderTable();
      
    } catch (err) {
      console.error("❌ Table data load error:", err);
      this.renderTableError("Gagal memuat data tabel: " + err.message);
    }
  },

  setTableFilter(status) {
    console.log(`🔄 Setting table filter to: ${status}`);
    
    // Update active button
    this.elements.statusFilterBtns.forEach(btn => {
      if (btn.getAttribute('data-status') === status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update table title based on status
    const statusLabels = {
      'belum_produksi': 'Belum Produksi',
      'di_produksi': 'Sudah Produksi', 
      'di_warna': 'Di Warna',
      'siap_kirim': 'Siap Kirim',
      'di_kirim': 'Sudah Kirim'
    };

    if (this.elements.tableTitle) {
      this.elements.tableTitle.textContent = `Daftar Barang ${statusLabels[status] || status}`;
    }

    this.state.currentTableFilter = status;
    
    // Jika data sudah di-load sebelumnya, render langsung
    if (this.state.tableData[status]) {
      this.renderTable();
    } else {
      // Jika belum, load data
      this.loadTableData();
    }
  },

  renderTable() {
    if (!this.elements.itemsTable) return;

    const data = this.state.tableData[this.state.currentTableFilter] || [];
    
    console.log(`🎨 Rendering table with ${data.length} items for status: ${this.state.currentTableFilter}`);

    if (data.length === 0) {
      this.elements.itemsTable.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-gray-500">
            <div class="flex flex-col items-center">
              <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p>Tidak ada data untuk status ini</p>
              <p class="text-sm text-gray-400 mt-1">Pilih bulan/tahun lain atau status yang berbeda</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const tableRows = data.map(item => {
      const statusBadge = this.getStatusBadge(item);
      
      return `
        <tr class="hover:bg-gray-50">
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${App.ui.formatDate(item.tanggal)}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            ${item.nama_customer || '-'}
          </td>
          <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
            ${item.deskripsi || '-'}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
            ${item.qty || '-'}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
            ${item.ukuran || '-'}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
            ${statusBadge}
          </td>
        </tr>
      `;
    }).join('');

    this.elements.itemsTable.innerHTML = tableRows;
  },

  getStatusBadge(item) {
    if (item.di_kirim === 'true') {
      return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Terkirim</span>';
    } else if (item.siap_kirim === 'true') {
      return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Siap Kirim</span>';
    } else if (item.di_warna === 'true') {
      return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Di Warna</span>';
    } else if (item.di_produksi === 'true') {
      return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Diproduksi</span>';
    } else {
      return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Belum Produksi</span>';
    }
  },

  renderTableError(message) {
    if (!this.elements.itemsTable) return;
    
    this.elements.itemsTable.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-red-500">
          <div class="flex flex-col items-center">
            <svg class="w-12 h-12 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <p>${message}</p>
            <button onclick="App.pages.dashboard.loadTableData()" class="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
              Coba Lagi
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  render(data) {
    if (!data) {
      this.showError("Data dashboard tidak tersedia");
      return;
    }

    console.log("🎨 Rendering dashboard data:", data);
    
    const { summary = {}, statusCounts = {} } = data;
    
    // Render summary
    if (this.elements.summary) {
      this.elements.summary.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-6 bg-white rounded-lg shadow border">
            <p class="text-sm text-gray-600">Total Customer</p>
            <p class="text-2xl font-bold text-[#8B5E34]">${summary.total_customer || 0}</p>
          </div>
          <div class="p-6 bg-white rounded-lg shadow border">
            <p class="text-sm text-gray-600">Total Nilai Produksi</p>
            <p class="text-2xl font-bold text-[#8B5E34]">${App.ui.formatRupiah(summary.total_rupiah || 0)}</p>
          </div>
          <div class="p-6 bg-white rounded-lg shadow border">
            <p class="text-sm text-gray-600">Total Work Orders</p>
            <p class="text-2xl font-bold text-[#8B5E34]">${Object.values(statusCounts).reduce((a, b) => a + (parseInt(b) || 0), 0)}</p>
          </div>
          <div class="p-6 bg-white rounded-lg shadow border">
            <p class="text-sm text-gray-600">Bulan Aktif</p>
            <p class="text-2xl font-bold text-[#8B5E34]">${this.elements.monthFilter?.value || ''}/${this.elements.yearFilter?.value || ''}</p>
          </div>
        </div>
      `;
    }

    // Render status counts
    if (this.elements.statusList) {
      const statusItems = [
        { key: 'belum_produksi', label: 'Belum Produksi', color: 'bg-red-100 text-red-800 border-red-200' },
        { key: 'sudah_produksi', label: 'Sudah Produksi', color: 'bg-blue-100 text-blue-800 border-blue-200' },
        { key: 'di_warna', label: 'Di Warna', color: 'bg-orange-100 text-orange-800 border-orange-200' },
        { key: 'siap_kirim', label: 'Siap Kirim', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        { key: 'di_kirim', label: 'Di Kirim', color: 'bg-green-100 text-green-800 border-green-200' }
      ];

      const statusHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          ${statusItems.map(item => {
            const value = statusCounts[item.key] || 0;
            return `
              <div class="status-card p-4 rounded-lg shadow border ${item.color} cursor-pointer" 
                   data-status="${item.key}" 
                   onclick="App.pages.dashboard.setTableFilter('${item.key}')">
                <p class="text-sm font-medium">${item.label}</p>
                <p class="text-xl font-bold mt-1">${value}</p>
              </div>
            `;
          }).join('')}
        </div>
      `;

      this.elements.statusList.innerHTML = statusHTML;
    }

    console.log("✅ Dashboard rendered successfully");
  },

  showError(message) {
    console.error("Dashboard Error:", message);
    
    if (this.elements.summary) {
      this.elements.summary.innerHTML = `
        <div class="p-6 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Error</h3>
              <p class="text-sm text-red-600 mt-1">${message}</p>
              <div class="mt-3 space-x-2">
                <button onclick="App.pages.dashboard.loadData()" class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                  Coba Lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    App.ui.showToast(message, "error");
  }
};


// ======================================================
// 📦 WORK ORDERS PAGE (Auto-generate 10000 Rows)
// ======================================================
// ======================================================
// 📦 WORK ORDERS PAGE (Dengan Semua Method yang Diperlukan)
// ======================================================
// ======================================================
// ======================================================
// 📦 WORK ORDERS PAGE (Dengan Semua Method yang Diperlukan)
// ======================================================
// ======================================================
// 📦 WORK ORDERS PAGE (REAL-TIME PER KOLOM)
// ======================================================
// ======================================================
// 📦 WORK ORDERS PAGE (REAL-TIME PER KOLOM + AUTO LOAD BY FILTER)
// ======================================================
// ======================================================
// 📦 WORK ORDERS PAGE (OPTIMIZED VERSION)
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

  init() {
    console.log("🚀 Work Orders INIT Started");
    
    // Get elements
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

    // Setup filters
    this.setupDateFilters();
    
    // Event listeners
    this.setupEventListeners();

    // Load initial data
    this.loadDataByFilter();
  },

  setupDateFilters() {
    try {
      console.log("📅 Setting up date filters...");
      
      if (!this.elements.monthFilter || !this.elements.yearFilter) {
        console.error("❌ Filter elements not found");
        return;
      }

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
        opt.textContent = `${bulanNama[i - 1]}`;
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

      // Set current month and year
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

  setupEventListeners() {
    // Filter button
    if (this.elements.filterBtn) {
      this.elements.filterBtn.addEventListener("click", () => {
        this.loadDataByFilter();
      });
    }

    // Auto load when month/year changes
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

    // ✅ Gunakan endpoint chunk agar cepat untuk dataset besar
    const size = 10000;
    const page = 1;
    const res = await App.api.request(
      `/workorders/chunk?month=${month}&year=${year}&page=${page}&size=${size}`
    );

    // ✅ Tangani berbagai format respons API
    const rows = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    console.log("📦 Chunk data from server:", rows.length, "rows");

    // ======================================================
    // ✅ Selalu tampilkan 10.000 baris, meski ada data sedikit
    // ======================================================
    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`🔄 Data ditemukan di server: ${rows.length} baris`);

      // 1️⃣ Muat data dari database
      const loaded = rows.map((item, index) => ({
        id: item.id,
        row_num: index + 1,
        selected: false,
        tanggal: item.tanggal || new Date().toISOString().split('T')[0],
        nama_customer: item.nama_customer || '',
        deskripsi: item.deskripsi || '',
        ukuran: item.ukuran || '',
        qty: item.qty || '',
        harga: item.harga || '',
        di_produksi: item.di_produksi || 'false',
        di_warna: item.di_warna || 'false',
        siap_kirim: item.siap_kirim || 'false',
        di_kirim: item.di_kirim || 'false',
        pembayaran: item.pembayaran || 'false',
        no_inv: item.no_inv || '',
        ekspedisi: item.ekspedisi || '',
        bulan: parseInt(month),
        tahun: parseInt(year),
      }));

      // 2️⃣ Jika kurang dari 10.000 baris, tambahkan baris kosong
      const needed = 10000 - loaded.length;
      if (needed > 0) {
        console.log(`🆕 Menambahkan ${needed} baris kosong agar total 10.000`);
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

      // 3️⃣ Simpan ke state & render tabel
      this.state.currentData = loaded;
      this.initializeTabulator();
      this.updateStatus(
        `✅ Tabel dimuat total ${loaded.length} baris (${rows.length} dari DB, ${needed} kosong baru)`
      );

    } else {
      // 🔥 Tidak ada data → generate 10.000 baris baru
      console.log(`🆕 Tidak ada data untuk ${month}-${year}, membuat tabel kosong...`);
      this.generateEmptyRowsForMonth(month, year);

      // ✅ Pesan status jelas untuk user
      this.updateStatus(
        `📄 Bulan ${month}-${year} belum memiliki data — tabel baru (10.000 baris) disiapkan.`
      );
    }
  } catch (err) {
    console.error("❌ Load data error:", err);

    // Fallback: kalau error API, tetap tampilkan 10.000 baris kosong
    this.generateEmptyRowsForMonth(month, year);
    this.updateStatus(
      `⚠️ Gagal memuat data dari server — tabel kosong disiapkan untuk ${month}-${year}`
    );
  } finally {
    this.state.isLoading = false;
  }
},



  loadExistingData(databaseData) {
    console.log("🔄 Loading existing data:", databaseData.length, "rows");
    
    const month = parseInt(this.state.currentMonth);
    const year = parseInt(this.state.currentYear);
    
    // Process data from database
    this.state.currentData = databaseData.map((item, index) => ({
      id: item.id,
      row_num: index + 1,
      selected: false,
      tanggal: item.tanggal || new Date().toISOString().split('T')[0],
      nama_customer: item.nama_customer || '',
      deskripsi: item.deskripsi || '',
      ukuran: item.ukuran || '',
      qty: item.qty || '',
      harga: item.harga || '',
      di_produksi: item.di_produksi || 'false',
      di_warna: item.di_warna || 'false',
      siap_kirim: item.siap_kirim || 'false',
      di_kirim: item.di_kirim || 'false',
      pembayaran: item.pembayaran || 'false',
      no_inv: item.no_inv || '',
      ekspedisi: item.ekspedisi || '',
      bulan: month,
      tahun: year
    }));

    console.log("✅ Processed existing data:", this.state.currentData.length, "rows");
    
    // Initialize table with existing data
    this.initializeTabulator();
  },

  generateEmptyRowsForMonth(month, year) {
  console.log(`🔄 Generating empty rows for: ${month}-${year}`);

  const currentDate = new Date().toISOString().split("T")[0];
  this.state.currentData = [];

  for (let i = 0; i < 10000; i++) {
    this.state.currentData.push({
      // 🔑 Pastikan Tabulator punya unique ID meski belum disimpan
      id: `temp-${month}-${year}-${i + 1}`,
      row_num: i + 1,
      selected: false,
      tanggal: currentDate,
      nama_customer: "",
      deskripsi: "",
      ukuran: "",
      qty: "",
      harga: "",
      di_produksi: "false",
      di_warna: "false",
      siap_kirim: "false",
      di_kirim: "false",
      pembayaran: "false",
      no_inv: "",
      ekspedisi: "",
      bulan: parseInt(month),
      tahun: parseInt(year)
    });
  }

  console.log(`✅ Generated ${this.state.currentData.length} empty rows`);
  this.initializeTabulator();
},


  initializeTabulator() {
    console.log("🎯 Initializing Tabulator with", this.state.currentData.length, "rows");
    
    if (!this.elements.gridContainer) {
      console.error("❌ Grid container not available");
      return;
    }

    // Clear previous table
    if (this.state.table) {
      try {
        this.state.table.destroy();
      } catch (e) {
        console.warn("⚠️ Error destroying previous table:", e);
      }
    }

    try {
      const self = this;

      // Clear container first
      this.elements.gridContainer.innerHTML = '';

      this.state.table = new Tabulator(this.elements.gridContainer, {
        data: this.state.currentData,
        layout: "fitColumns",
        height: "70vh",
        responsiveLayout: "hide",
        addRowPos: "bottom",
        history: true,
        clipboard: true,
        selectable: true,
        keyboardNavigation: true,
        virtualDom: true, // Enable virtualization for better performance
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
            editable: false
          },
          {
            title: "Print PO",
            field: "selected",
            width: 90,
            hozAlign: "center",
            formatter: "tickCross",
            headerSort: false,
            cellClick: function(e, cell) {
              const value = cell.getValue();
              cell.setValue(!value);
              self.handleCellEdit(cell.getRow(), 'selected');
            }
          },
          {
            title: "Tanggal",
            field: "tanggal",
            width: 130,
            editor: "input",
            editorParams: {
              elementAttributes: { 
                placeholder: "YYYY-MM-DD",
                type: "date"
              }
            },
            formatter: (cell) => {
              const value = cell.getValue();
              if (!value) return "-";
              try {
                const date = new Date(value);
                return date.toLocaleDateString('id-ID');
              } catch (e) {
                return value;
              }
            },
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'tanggal');
            }
          },
          {
            title: "Customer *",
            field: "nama_customer",
            width: 200,
            editor: "input",
            editorParams: {
              elementAttributes: { placeholder: "Nama customer" }
            },
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'nama_customer');
            },
            cssClass: "required-field"
          },
          {
            title: "Deskripsi *", 
            field: "deskripsi",
            width: 300,
            editor: "input",
            editorParams: {
              elementAttributes: { placeholder: "Deskripsi barang" }
            },
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'deskripsi');
            },
            cssClass: "required-field"
          },
          {
            title: "Ukuran",
            field: "ukuran",
            width: 100,
            editor: "input",
            hozAlign: "center",
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'ukuran');
            }
          },
          {
            title: "Qty",
            field: "qty", 
            width: 90,
            editor: "number",
            editorParams: { min: 0 },
            hozAlign: "center",
            cellEdited: (cell) => {
              self.handleCellEdit(cell.getRow(), 'qty');
            }
          },
          
          
          {
            title: "Status",
            field: "di_produksi",
            width: 120,
            hozAlign: "center",
            formatter: (cell) => {
              const row = cell.getRow().getData();
              if (row.di_kirim === 'true') return '✅ Terkirim';
              if (row.siap_kirim === 'true') return '📦 Siap Kirim';
              if (row.di_warna === 'true') return '🎨 Di Warna';
              if (row.di_produksi === 'true') return '⚙️ Produksi';
              return '⏳ Menunggu';
            }
          }
        ],
        
        // Row context menu for quick actions
        rowContextMenu: [
          {
            label: "📝 Edit Row",
            action: function(e, row) {
              const cells = row.getCells();
              if (cells.length > 3) {
                cells[3].edit();
              }
            }
          },
          {
            label: "⚙️ Tandai Produksi",
            action: function(e, row) {
              row.update({ di_produksi: 'true' });
              self.handleCellEdit(row, 'di_produksi');
            }
          },
          {
            label: "📦 Tandai Siap Kirim",
            action: function(e, row) {
              row.update({ siap_kirim: 'true' });
              self.handleCellEdit(row, 'siap_kirim');
            }
          },
          { separator: true },
          {
            label: "🗑️ Hapus Row",
            action: function(e, row) {
              if (confirm("Hapus row ini?")) {
                const rowData = row.getData();
                if (rowData.id) {
                  self.deleteRow(rowData.id);
                }
                row.delete();
              }
            }
          }
        ]
      });

      // Setup keyboard navigation
      this.setupKeyboardNavigation();
      
      // Add required field styles
      this.addRequiredFieldStyles();
      
      console.log("✅ Tabulator initialized successfully");

    } catch (err) {
      console.error("❌ Tabulator initialization error:", err);
      this.showError("Gagal memuat tabel: " + err.message);
    }
  },

  async handleCellEdit(row, fieldName) {
  // Cegah tumpang tindih proses
  if (this.state.isSaving) {
    console.log("⏳ Menyimpan data lain, tunggu sebentar...");
    return;
  }

  let rowData = row.getData();
  let rowId = rowData.id;
  const value = rowData[fieldName];

  console.log(`💾 Saving ${fieldName}:`, value, "for row:", rowId);

  // 🗓️ Auto isi tanggal kalau kosong ketika nama_customer diisi
  if (fieldName === "nama_customer" && (!rowData.tanggal || rowData.tanggal === "")) {
    const today = new Date().toISOString().split("T")[0];
    row.update({ tanggal: today });
    console.log(`🗓️ Auto isi tanggal: ${today}`);
  }

  // 🔍 Jika row ID masih sementara, buat dulu di DB
  if (!rowId || rowId.startsWith("temp")) {
    console.warn("⚙️ Row belum ada ID valid, membuat data baru dulu...");

    try {
      this.state.isSaving = true;
      const created = await this.createNewRow(row);

      if (!created || !created.id) {
        throw new Error("Gagal mendapatkan ID dari server");
      }

      // Update ID di tabel agar valid untuk PATCH berikutnya
      row.update({ id: created.id });
      rowId = created.id;
      console.log("✅ Row baru dibuat dengan ID:", rowId);

      // Tunggu sedikit agar Tabulator sinkron
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error("❌ Gagal membuat row baru:", err);
      this.updateStatus("❌ Gagal membuat data baru sebelum menyimpan perubahan.");
      this.state.isSaving = false;
      return;
    } finally {
      this.state.isSaving = false;
    }
  }

  // 🔄 Debounce untuk mencegah spam update cepat
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

      // Konversi boolean ke 'true'/'false'
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

      console.log(`✅ ${fieldName} tersimpan ke server`);
      this.updateStatus(`✅ ${fieldName} tersimpan`);
    } catch (err) {
      console.error(`❌ Error saving ${fieldName}:`, err);
      this.updateStatus(`❌ ${err.message || "Gagal menyimpan perubahan"}`);
    } finally {
      this.state.isSaving = false;
      this.state.pendingSaves.delete(saveKey);
    }
  }, 700);

  this.state.pendingSaves.set(saveKey, saveTimeout);
},

async createNewRow(row) {
  const rowData = row.getData();

  if (!rowData.nama_customer?.trim() || !rowData.deskripsi?.trim()) {
    this.updateStatus("❌ Isi nama customer & deskripsi dulu sebelum buat data baru.");
    throw new Error("Nama customer & deskripsi wajib diisi");
  }

  try {
    this.updateStatus("💾 Membuat data baru di server...");
    const socketId = App.state.socket?.id || null;

    const safeNum = (val) => (val === "" || val === undefined || isNaN(Number(val)) ? null : Number(val));

    const payload = {
      tanggal: rowData.tanggal || new Date().toISOString().split("T")[0],
      nama_customer: rowData.nama_customer.trim(),
      deskripsi: rowData.deskripsi.trim(),
      ukuran: safeNum(rowData.ukuran),
      qty: safeNum(rowData.qty),
      harga: safeNum(rowData.harga),
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

    console.log("📤 POST new row:", payload);

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

    return response; // ⬅️ penting: dikembalikan untuk handleCellEdit()
  } catch (err) {
    console.error("❌ Error createNewRow:", err);
    this.updateStatus("❌ Gagal membuat data baru di server");
    throw err;
  }
},



  async deleteRow(rowId) {
    try {
      await App.api.request(`/workorders/${rowId}`, {
        method: 'DELETE'
      });
      console.log("✅ Row deleted:", rowId);
      this.updateStatus("✅ Data dihapus");
    } catch (err) {
      console.error("❌ Error deleting row:", err);
      this.updateStatus("❌ Gagal menghapus data");
    }
  },

  setupKeyboardNavigation() {
    if (!this.state.table) return;

    const table = this.state.table;

    table.element.addEventListener('keydown', (e) => {
      const activeCell = table.modules.edit?.currentCell;
      
      if (!activeCell) return;

      switch(e.key) {
        case 'Enter':
          e.preventDefault();
          this.handleEnterKey(activeCell);
          break;
        case 'Escape':
          e.preventDefault();
          activeCell.cancelEdit();
          break;
      }
    });
  },

  handleEnterKey(activeCell) {
    const row = activeCell.getRow();
    const column = activeCell.getColumn();
    const allColumns = this.state.table.getColumns();
    const currentColIndex = allColumns.indexOf(column);
    
    // Save changes
    activeCell.cancelEdit();
    
    // Move to next row
    const nextRow = row.getNextRow();
    if (nextRow) {
      const nextCell = nextRow.getCells()[currentColIndex];
      if (nextCell) {
        setTimeout(() => nextCell.edit(), 50);
      }
    }
  },

  addRequiredFieldStyles() {
    if (document.getElementById('wo-required-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'wo-required-styles';
    style.textContent = `
      .required-field .tabulator-cell {
        background-color: #fef3c7 !important;
      }
      .required-field .tabulator-cell:focus {
        background-color: #fff8e1 !important;
        border: 2px solid #f59e0b !important;
      }
    `;
    document.head.appendChild(style);
  },

  updateStatus(message) {
    if (this.elements.status) {
      this.elements.status.textContent = message;
      
      if (message.includes("❌")) {
        this.elements.status.className = "text-red-600 font-medium";
      } else if (message.includes("✅")) {
        this.elements.status.className = "text-green-600 font-medium";  
      } else if (message.includes("💾") || message.includes("⏳")) {
        this.elements.status.className = "text-blue-600 font-medium";
      } else {
        this.elements.status.className = "text-gray-600";
      }
    }
  },

    // ======================================================
  // ⚡ REALTIME SOCKET HANDLERS
  // ======================================================
  addRowRealtime(newRow) {
    try {
      if (!this.state.table) {
        console.warn("⚠️ Table belum siap untuk menerima data realtime");
        return;
      }

      // Tambahkan baris baru di paling atas
      this.state.table.addRow(newRow, true);

      // Tambahkan efek highlight pada row baru
      const rowComponent = this.state.table.getRow(newRow.id);
      if (rowComponent) {
        const el = rowComponent.getElement();
        el.style.transition = "background-color 0.5s ease";
        el.style.backgroundColor = "#dcfce7"; // Hijau muda
        setTimeout(() => {
          el.style.backgroundColor = "";
        }, 1500);
      }

      console.log("✅ Realtime row ditambahkan:", newRow);

    } catch (err) {
      console.error("❌ Gagal menambah row realtime:", err);
    }
  },

  updateRowRealtime(updatedRow) {
    try {
      if (!this.state.table) return;
      const existingRow = this.state.table.getRow(updatedRow.id);

      if (existingRow) {
        existingRow.update(updatedRow);
        console.log("🔄 Row diperbarui realtime:", updatedRow.id);
      }
    } catch (err) {
      console.error("❌ Gagal update row realtime:", err);
    }
  },

  deleteRowRealtime(rowId) {
    try {
      if (!this.state.table) return;
      const existingRow = this.state.table.getRow(rowId);

      if (existingRow) {
        existingRow.delete();
        console.log("🗑️ Row dihapus realtime:", rowId);
      }
    } catch (err) {
      console.error("❌ Gagal hapus row realtime:", err);
    }
  },


  showError(message) {
    if (this.elements.gridContainer) {
      this.elements.gridContainer.innerHTML = `
        <div class="p-8 text-center text-red-600 bg-red-50 rounded-lg">
          <div class="text-lg font-semibold mb-2">Error Loading Table</div>
          <div class="mb-4">${message}</div>
          <button onclick="App.pages['work-orders'].loadDataByFilter()" 
                  class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Coba Lagi
          </button>
        </div>
      `;
    }
    App.ui.showToast(message, "error");
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
// 👷‍♂️ DATA KARYAWAN PAGE
// ======================================================
App.pages["data-karyawan"] = {
  state: { data: null },
  elements: {},

  async init() {
    this.elements.tableContainer = document.getElementById("karyawan-grid");
    this.elements.addForm = document.getElementById("add-karyawan-form");
    
    await this.loadData();
    
    // Setup form submission
    this.elements.addForm?.addEventListener("submit", (e) => this.addKaryawan(e));
  },

  async loadData() {
    try {
      this.showMessage("Memuat data karyawan...", "info");
      const res = await App.api.request("/karyawan");
      this.render(res);
      this.showMessage(`Data berhasil dimuat: ${res.length} karyawan`, "success");
    } catch (err) {
      console.error("❌ Load karyawan error:", err);
      this.showMessage("Gagal memuat data karyawan: " + err.message, "error");
    }
  },

  render(data) {
    if (!this.elements.tableContainer) return;

    if (!data || data.length === 0) {
      this.elements.tableContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Tidak ada data karyawan</p>
        </div>
      `;
      return;
    }

    this.elements.tableContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Gaji Harian</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Kasbon</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">BPJS Kesehatan</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">BPJS Ketenagakerjaan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(k => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium">${k.nama_karyawan}</td>
                <td class="px-4 py-3 text-sm text-right">${App.ui.formatRupiah(k.gaji_harian)}</td>
                <td class="px-4 py-3 text-sm text-right">${App.ui.formatRupiah(k.kasbon)}</td>
                <td class="px-4 py-3 text-sm text-right">${App.ui.formatRupiah(k.potongan_bpjs_kesehatan)}</td>
                <td class="px-4 py-3 text-sm text-right">${App.ui.formatRupiah(k.potongan_bpjs_ketenagakerjaan)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async addKaryawan(e) {
    e.preventDefault();
    
    const formData = new FormData(this.elements.addForm);
    const data = {
      nama_karyawan: formData.get('nama_karyawan'),
      gaji_harian: parseFloat(formData.get('gaji_harian') || 0),
      kasbon: parseFloat(formData.get('kasbon') || 0),
      potongan_bpjs_kesehatan: parseFloat(formData.get('potongan_bpjs_kesehatan') || 0),
      potongan_bpjs_ketenagakerjaan: parseFloat(formData.get('potongan_bpjs_ketenagakerjaan') || 0)
    };

    try {
      await App.api.request("/karyawan", {
        method: "POST",
        body: data
      });
      
      this.elements.addForm.reset();
      await this.loadData();
      App.ui.showToast("Karyawan berhasil ditambahkan", "success");
    } catch (err) {
      console.error("❌ Add karyawan error:", err);
      App.ui.showToast("Gagal menambah karyawan: " + err.message, "error");
    }
  },

  showMessage(message, type = "info") {
    console.log(`Karyawan: ${message}`);
    App.ui.showToast(message, type);
  }
};

// ======================================================
// 💰 PAYROLL PAGE
// ======================================================
App.pages["payroll"] = {
  state: { karyawanList: [] },
  elements: {},

  async init() {
    this.elements.form = document.getElementById("payroll-form");
    this.elements.karyawanSelect = document.getElementById("karyawan-id");
    this.elements.kasbonInput = document.getElementById("potongan-kasbon");
    this.elements.kasbonInfo = document.getElementById("kasbon-info");

    await this.loadKaryawan();
    this.setupEventListeners();
  },

  async loadKaryawan() {
    try {
      const data = await App.api.request("/karyawan");
      this.state.karyawanList = data;
      
      this.elements.karyawanSelect.innerHTML = `
        <option value="">Pilih Karyawan</option>
        ${data.map(d => `
          <option value="${d.id}" data-kasbon="${d.kasbon}">${d.nama_karyawan} (Kasbon: ${App.ui.formatRupiah(d.kasbon)})</option>
        `).join('')}
      `;
    } catch (err) {
      console.error("❌ Gagal load karyawan:", err);
      App.ui.showToast("Gagal memuat data karyawan", "error");
    }
  },

  setupEventListeners() {
    // Update kasbon info when karyawan selected
    this.elements.karyawanSelect?.addEventListener("change", (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const kasbon = parseFloat(selectedOption.getAttribute('data-kasbon') || 0);
      
      if (this.elements.kasbonInfo) {
        this.elements.kasbonInfo.textContent = `Kasbon saat ini: ${App.ui.formatRupiah(kasbon)}`;
      }
      
      if (this.elements.kasbonInput) {
        this.elements.kasbonInput.max = kasbon;
        this.elements.kasbonInput.placeholder = `Maksimal: ${App.ui.formatRupiah(kasbon)}`;
      }
    });

    // Form submission
    this.elements.form?.addEventListener("submit", (e) => this.handleSubmit(e));
  },

  async handleSubmit(e) {
    e.preventDefault();
    
    const karyawan_id = this.elements.karyawanSelect.value;
    const potongan_kasbon = parseFloat(this.elements.kasbonInput.value || 0);

    if (!karyawan_id) {
      App.ui.showToast("Pilih karyawan terlebih dahulu", "error");
      return;
    }

    try {
      const res = await App.api.request("/payroll", {
        method: "POST",
        body: { karyawan_id, potongan_kasbon }
      });
      
      App.ui.showToast(res.message || "Payroll berhasil diproses.", "success");
      this.elements.form.reset();
      
      if (this.elements.kasbonInfo) {
        this.elements.kasbonInfo.textContent = "";
      }
      
      // Reload karyawan data to update kasbon info
      await this.loadKaryawan();
    } catch (err) {
      console.error("❌ Payroll submit error:", err);
      App.ui.showToast("Gagal memproses payroll: " + err.message, "error");
    }
  }
};

// ======================================================
// 🧱 STOK BAHAN PAGE
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
// 📄 SURAT JALAN PAGE
// ======================================================
App.pages["surat-jalan"] = {
  state: { workOrders: [] },
  elements: {},

  async init() {
    this.elements.form = document.getElementById("surat-jalan-form");
    this.elements.tipeSelect = document.getElementById("tipe");
    this.elements.workOrderSelect = document.getElementById("work-order-select");
    this.elements.itemsContainer = document.getElementById("items-container");
    this.elements.addItemBtn = document.getElementById("add-item-btn");

    await this.loadWorkOrders();
    this.setupEventListeners();
  },

  async loadWorkOrders() {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      
      const res = await App.api.request(`/workorders?month=${month}&year=${year}`);
      this.state.workOrders = res;
      
      this.elements.workOrderSelect.innerHTML = `
        <option value="">Pilih Work Order</option>
        ${res.map(wo => `
          <option value="${wo.id}" data-customer="${wo.nama_customer}" data-deskripsi="${wo.deskripsi}">
            ${wo.nama_customer} - ${wo.deskripsi} (${App.ui.formatDate(wo.tanggal)})
          </option>
        `).join('')}
      `;
    } catch (err) {
      console.error("❌ Gagal load work orders:", err);
      App.ui.showToast("Gagal memuat data work orders", "error");
    }
  },

  setupEventListeners() {
    // Add item button
    this.elements.addItemBtn?.addEventListener("click", () => this.addItem());
    
    // Form submission
    this.elements.form?.addEventListener("submit", (e) => this.handleSubmit(e));
    
    // Work order selection
    this.elements.workOrderSelect?.addEventListener("change", (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      if (selectedOption.value) {
        this.addItemFromWO(selectedOption.value, selectedOption.textContent);
        e.target.value = ""; // Reset selection
      }
    });
  },

  addItem() {
    if (!this.elements.itemsContainer) return;

    const itemId = Date.now();
    const itemHTML = `
      <div class="border rounded p-4 mb-3 bg-gray-50" data-item-id="${itemId}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi Barang</label>
            <input type="text" name="items[${itemId}][deskripsi]" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                   placeholder="Deskripsi barang" required>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input type="number" name="items[${itemId}][qty]" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                   placeholder="Jumlah" required min="1">
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
            <input type="text" name="items[${itemId}][keterangan]" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                   placeholder="Keterangan tambahan">
          </div>
          <div class="flex items-end">
            <button type="button" onclick="this.closest('[data-item-id]').remove()" 
                    class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">
              Hapus Item
            </button>
          </div>
        </div>
      </div>
    `;

    this.elements.itemsContainer.insertAdjacentHTML('beforeend', itemHTML);
  },

  addItemFromWO(woId, woDescription) {
    if (!this.elements.itemsContainer) return;

    const itemId = Date.now();
    const itemHTML = `
      <div class="border rounded p-4 mb-3 bg-blue-50" data-item-id="${itemId}">
        <input type="hidden" name="items[${itemId}][id]" value="${woId}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi Barang</label>
            <input type="text" name="items[${itemId}][deskripsi]" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                   value="${woDescription}" readonly>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input type="number" name="items[${itemId}][qty]" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                   placeholder="Jumlah" required min="1">
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
            <input type="text" name="items[${itemId}][keterangan]" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                   placeholder="Keterangan tambahan">
          </div>
          <div class="flex items-end">
            <button type="button" onclick="this.closest('[data-item-id]').remove()" 
                    class="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">
              Hapus Item
            </button>
          </div>
        </div>
      </div>
    `;

    this.elements.itemsContainer.insertAdjacentHTML('beforeend', itemHTML);
  },

  async handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(this.elements.form);
    const data = {
      tipe: formData.get('tipe'),
      no_invoice: formData.get('no_invoice'),
      nama_tujuan: formData.get('nama_tujuan'),
      catatan: formData.get('catatan'),
      items: []
    };

    // Collect items
    const itemElements = this.elements.itemsContainer.querySelectorAll('[data-item-id]');
    if (itemElements.length === 0) {
      App.ui.showToast("Tambahkan minimal satu item", "error");
      return;
    }

    itemElements.forEach(itemEl => {
      const itemId = itemEl.getAttribute('data-item-id');
      data.items.push({
        id: formData.get(`items[${itemId}][id]`),
        deskripsi: formData.get(`items[${itemId}][deskripsi]`),
        qty: formData.get(`items[${itemId}][qty]`),
        keterangan: formData.get(`items[${itemId}][keterangan]`)
      });
    });

    try {
      const res = await App.api.request("/surat-jalan", {
        method: "POST",
        body: data
      });
      
      App.ui.showToast("Surat jalan berhasil dibuat: " + res.no_sj, "success");
      this.elements.form.reset();
      this.elements.itemsContainer.innerHTML = "";
      
      // Optional: Redirect to print page or show success message
    } catch (err) {
      console.error("❌ Buat surat jalan error:", err);
      App.ui.showToast("Gagal membuat surat jalan: " + err.message, "error");
    }
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