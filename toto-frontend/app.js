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
  api: {
    baseUrl: window.location.hostname === "localhost" 
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
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      try {
        console.log(`🔗 API Request: ${options.method || 'GET'} ${fullUrl}`);
        
        const config = {
          ...options,
          headers
        };

        // Handle JSON body
        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
          config.body = JSON.stringify(options.body);
        }

        const response = await fetch(fullUrl, config);

        // Jika token expired, coba refresh otomatis
        if (response.status === 401) {
          const data = await response.json().catch(() => ({}));
          if (data.message === "EXPIRED") {
            console.warn("🔁 Token expired, mencoba refresh...");
            const refreshed = await this.refreshToken();
            if (refreshed) {
              return this.request(endpoint, options); // retry sekali lagi
            }
          }
        }

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch {
            const text = await response.text();
            errorMessage = text || errorMessage;
          }
          throw new Error(errorMessage);
        }

        return await response.json();
      } catch (err) {
        console.error("❌ API Error:", err.message, "URL:", fullUrl);
        
        // Show user-friendly error message
        if (err.name === 'AbortError') {
          throw new Error("Request timeout - periksa koneksi internet Anda");
        } else if (err.message.includes('Failed to fetch')) {
          throw new Error("Tidak dapat terhubung ke server - periksa koneksi internet");
        } else {
          throw err;
        }
      }
    },

    async refreshToken() {
      const oldToken = App.getToken();
      if (!oldToken) return false;

      try {
        const res = await fetch(`${this.baseUrl}/api/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: oldToken }),
        });
        
        if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
        
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
        window.location.href = "index.html"; // Redirect to login
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
        page.removeRowRealtime(payload.id);
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
// 📊 DASHBOARD PAGE - FIXED RENDER VERSION
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

    console.log("🔧 Dashboard init - Elements:", {
      monthFilter: !!this.elements.monthFilter,
      yearFilter: !!this.elements.yearFilter,
      summary: !!this.elements.summary,
      statusList: !!this.elements.statusList
    });

    // Validasi elemen ada
    if (!this.elements.monthFilter || !this.elements.yearFilter) {
      console.error("❌ Dashboard filter elements not found");
      return;
    }

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
    
    // Load data setelah timeout kecil untuk memastikan DOM siap
    setTimeout(() => {
      this.loadData();
    }, 500);
  },

  async loadData() {
    try {
      const month = this.elements.monthFilter?.value || new Date().getMonth() + 1;
      const year = this.elements.yearFilter?.value || new Date().getFullYear();
      
      console.log(`📊 Loading dashboard for: ${month}-${year}`);
      
      const res = await App.api.request(`/dashboard?month=${month}&year=${year}`);
      
      console.log("📦 Dashboard API Response:", res);
      
      // Handle both success and error responses
      if (res && res.success === false) {
        throw new Error(res.message || "Gagal memuat dashboard");
      }
      
      if (res && (res.summary || res.statusCounts)) {
        this.render(res);
        App.ui.showToast('Data dashboard berhasil dimuat', 'success');
      } else {
        throw new Error("Format response dashboard tidak valid");
      }
    } catch (err) {
      console.error("❌ Dashboard load error:", err);
      this.showError("Gagal memuat data dashboard: " + err.message);
    }
  },

  render(data) {
    if (!data) {
      this.showError("Data dashboard tidak tersedia");
      return;
    }

    console.log("🎨 Rendering dashboard data:", data);
    
    const { summary = {}, statusCounts = {} } = data;
    
    // Debug: Check if elements exist
    console.log("🔍 Render elements check:", {
      summaryEl: !!this.elements.summary,
      statusListEl: !!this.elements.statusList
    });

    // Render summary dengan safe fallback
    if (this.elements.summary) {
      console.log("📊 Rendering summary data:", summary);
      
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
      
      console.log("✅ Summary rendered successfully");
    } else {
      console.error("❌ Summary element not found for rendering");
    }

    // Render status counts dengan safe fallback
    if (this.elements.statusList) {
      console.log("📈 Rendering status counts:", statusCounts);
      
      const statusItems = [
        { key: 'belum_produksi', label: 'Belum Produksi', color: 'bg-red-100 text-red-800 border-red-200' },
        { key: 'sudah_produksi', label: 'Sudah Produksi', color: 'bg-blue-100 text-blue-800 border-blue-200' },
        { key: 'di_warna', label: 'Di Warna', color: 'bg-orange-100 text-orange-800 border-orange-200' },
        { key: 'siap_kirim', label: 'Siap Kirim', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        { key: 'di_kirim', label: 'Di Kirim', color: 'bg-green-100 text-green-800 border-green-200' }
      ];

      const statusHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          ${statusItems.map(item => {
            const value = statusCounts[item.key] || 0;
            console.log(`📊 Status ${item.key}:`, value);
            return `
              <div class="p-4 rounded-lg shadow border ${item.color}">
                <p class="text-sm font-medium">${item.label}</p>
                <p class="text-xl font-bold mt-1">${value}</p>
              </div>
            `;
          }).join('')}
        </div>
      `;

      this.elements.statusList.innerHTML = statusHTML;
      console.log("✅ Status list rendered successfully");
    } else {
      console.error("❌ Status list element not found for rendering");
    }
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
                <button onclick="location.reload()" class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                  Refresh Page
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
// 📦 WORK ORDERS PAGE (Simplified for stability)
// ======================================================
App.pages["work-orders"] = {
  state: { 
    table: null,
    selectedRows: [] 
  },
  elements: {},

  init() {
    this.elements.monthFilter = document.getElementById("wo-month-filter");
    this.elements.yearFilter = document.getElementById("wo-year-filter");
    this.elements.filterBtn = document.getElementById("filter-wo-btn");
    this.elements.gridContainer = document.getElementById("workorders-grid");
    this.elements.status = document.getElementById("wo-status");

    if (!this.elements.gridContainer) {
      console.error("❌ Work orders grid container not found");
      return;
    }

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
    
    // Load data initially
    setTimeout(() => this.loadData(), 500);
  },

  async loadData() {
    try {
      const month = this.elements.monthFilter?.value;
      const year = this.elements.yearFilter?.value;
      
      if (!month || !year) {
        this.updateStatus("Pilih bulan dan tahun terlebih dahulu");
        return;
      }

      this.updateStatus("Memuat data work orders...");
      
      const res = await App.api.request(`/workorders/chunk?month=${month}&year=${year}`);
      
      this.renderTable(res.data || []);
      this.updateStatus(`Data berhasil dimuat: ${(res.data || []).length} work orders`);
      
    } catch (err) {
      console.error("❌ Work orders load error:", err);
      this.updateStatus("Gagal memuat data: " + err.message);
      App.ui.showToast("Gagal memuat work orders", "error");
    }
  },

  renderTable(data) {
    if (!this.elements.gridContainer) return;

    // Simple table rendering for stability
    if (data.length === 0) {
      this.elements.gridContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Tidak ada data work orders untuk bulan dan tahun yang dipilih</p>
        </div>
      `;
      return;
    }

    const tableHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 border-b text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th class="px-4 py-2 border-b text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th class="px-4 py-2 border-b text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
              <th class="px-4 py-2 border-b text-left text-xs font-medium text-gray-500 uppercase">Ukuran</th>
              <th class="px-4 py-2 border-b text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th class="px-4 py-2 border-b text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(row => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm">${App.ui.formatDate(row.tanggal)}</td>
                <td class="px-4 py-2 text-sm font-medium">${row.nama_customer || '-'}</td>
                <td class="px-4 py-2 text-sm">${row.deskripsi || '-'}</td>
                <td class="px-4 py-2 text-sm text-center">${row.ukuran || '-'}</td>
                <td class="px-4 py-2 text-sm text-center">${row.qty || '-'}</td>
                <td class="px-4 py-2 text-sm">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    row.di_kirim === 'true' ? 'bg-green-100 text-green-800' :
                    row.siap_kirim === 'true' ? 'bg-yellow-100 text-yellow-800' :
                    row.di_warna === 'true' ? 'bg-orange-100 text-orange-800' :
                    row.di_produksi === 'true' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }">
                    ${
                      row.di_kirim === 'true' ? 'Terkirim' :
                      row.siap_kirim === 'true' ? 'Siap Kirim' :
                      row.di_warna === 'true' ? 'Di Warna' :
                      row.di_produksi === 'true' ? 'Diproduksi' :
                      'Belum Produksi'
                    }
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.elements.gridContainer.innerHTML = tableHTML;
  },

  updateStatus(message) {
    if (this.elements.status) {
      this.elements.status.textContent = message;
    }
    console.log('WO Status:', message);
  },

  // Socket handlers for realtime updates
  addRowRealtime(row) {
    this.updateStatus(`Work order baru: ${row.nama_customer}`);
    // In a real implementation, you would add the row to the table
    setTimeout(() => this.loadData(), 1000); // Reload for simplicity
  },

  updateRowRealtime(row) {
    this.updateStatus(`Work order diperbarui: ${row.nama_customer}`);
    setTimeout(() => this.loadData(), 1000); // Reload for simplicity
  },

  removeRowRealtime(id) {
    this.updateStatus(`Work order dihapus: ${id}`);
    setTimeout(() => this.loadData(), 1000); // Reload for simplicity
  }
};

// ======================================================
// 📦 STATUS BARANG PAGE
// ======================================================
App.pages["status-barang"] = {
  state: { data: null },
  elements: {},

  init() {
    this.elements.monthFilter = document.getElementById("sb-month-filter");
    this.elements.yearFilter = document.getElementById("sb-year-filter");
    this.elements.customerInput = document.getElementById("sb-customer-filter");
    this.elements.filterBtn = document.getElementById("sb-filter-btn");
    this.elements.tableContainer = document.getElementById("statusbarang-grid");

    App.ui.populateDateFilters(this.elements.monthFilter, this.elements.yearFilter);

    this.elements.filterBtn?.addEventListener("click", () => this.loadData());
    
    // Load initial data
    this.loadData();
  },

  async loadData() {
    try {
      const month = this.elements.monthFilter?.value;
      const year = this.elements.yearFilter?.value;
      const customer = this.elements.customerInput?.value.trim() || '';
      
      if (!month || !year) {
        this.showMessage("Pilih bulan dan tahun terlebih dahulu", "info");
        return;
      }

      this.showMessage("Memuat data...", "info");
      
      const res = await App.api.request(`/status-barang?month=${month}&year=${year}&customer=${encodeURIComponent(customer)}`);
      
      this.render(res);
      this.showMessage(`Data berhasil dimuat: ${res.length} items`, "success");
      
    } catch (err) {
      console.error("❌ Status Barang load error:", err);
      this.showMessage("Gagal memuat data: " + err.message, "error");
    }
  },

  render(data) {
    if (!this.elements.tableContainer) return;

    if (!data || data.length === 0) {
      this.elements.tableContainer.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Tidak ada data status barang untuk kriteria yang dipilih</p>
        </div>
      `;
      return;
    }

    this.elements.tableContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border border-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Produksi</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Warna</th>
              <th class="px-4 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase">Kirim</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${data.map(row => {
              const statusClass = 
                row.di_kirim === 'true' ? 'bg-green-50' :
                row.siap_kirim === 'true' ? 'bg-yellow-50' :
                row.di_warna === 'true' ? 'bg-orange-50' :
                row.di_produksi === 'true' ? 'bg-blue-50' : '';
              
              return `
                <tr class="${statusClass} hover:bg-gray-50">
                  <td class="px-4 py-3 text-sm">${App.ui.formatDate(row.tanggal)}</td>
                  <td class="px-4 py-3 text-sm font-medium">${row.nama_customer || '-'}</td>
                  <td class="px-4 py-3 text-sm">${row.deskripsi || '-'}</td>
                  <td class="px-4 py-3 text-sm text-center">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      row.di_produksi === 'true' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }">
                      ${row.di_produksi === 'true' ? '✓' : '○'}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-center">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      row.di_warna === 'true' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }">
                      ${row.di_warna === 'true' ? '✓' : '○'}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-center">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      row.di_kirim === 'true' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }">
                      ${row.di_kirim === 'true' ? '✓' : '○'}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  showMessage(message, type = "info") {
    console.log(`Status Barang: ${message}`);
    App.ui.showToast(message, type);
  }
};

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