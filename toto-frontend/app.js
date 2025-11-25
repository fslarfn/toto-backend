// ==========================
// 🧩 APP.JS — PART 1 (CORE SYSTEM)
// ==========================
const App = {
  api: {
    baseUrl: "https://erptoto.up.railway.app"
  },

  state: {
    user: null,
    token: null,
    socket: null
  },

  // -----------------------------------------
  // 🚀 Ambil token & cek user saat halaman dibuka
  // -----------------------------------------
  async init() {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return this.redirectToLogin();

      this.state.token = token;
      await this.fetchUser();
      this.loadHeaderAndSidebar();
      this.initSocket();
      this.routePage(); // auto inisialisasi halaman berdasarkan file
    } catch (err) {
      console.error("Init error:", err);
      this.redirectToLogin();
    }
  },

  // -----------------------------------------
  // 👤 Ambil user login
  // -----------------------------------------
  async fetchUser() {
    const res = await fetch(`${this.api.baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${this.state.token}` }
    });

    if (!res.ok) return this.redirectToLogin();
    this.state.user = await res.json();

    // tampilkan user di header
    const el = document.querySelector("#user-display");
    if (el) el.textContent = this.state.user.username || "";
  },

  redirectToLogin() {
    localStorage.removeItem("authToken");
    window.location.href = "index.html";
  },

  // -----------------------------------------
  // 🧱 Load sidebar & header
  // -----------------------------------------
  loadHeaderAndSidebar() {
    fetch("header.html").then(r => r.text()).then(html => {
      document.querySelector("#header-container").innerHTML = html;
      this.afterHeaderLoaded();
    });

    fetch("sidebar.html").then(r => r.text()).then(html => {
      document.querySelector("#sidebar").outerHTML = html;
      this.afterSidebarLoaded();
    });
  },

  // -----------------------------------------
  // 🎯 Sidebar & Hamburger — FIX FINAL
  // -----------------------------------------
  afterSidebarLoaded() {
    const sidebar = document.querySelector("#sidebar");
    const backdrop = document.querySelector("#sidebar-backdrop");
    const toggleBtn = document.querySelector("#sidebar-toggle-btn");

    // buka / tutup sidebar
    const toggleSidebar = () => {
      sidebar.classList.toggle("collapsed");
      backdrop.classList.toggle("show");
    };

    // klik icon hamburger
    if (toggleBtn) toggleBtn.addEventListener("click", toggleSidebar);
    if (backdrop) backdrop.addEventListener("click", toggleSidebar);

    // submenu collapsible
    document.querySelectorAll(".collapsible > a").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        btn.parentElement.querySelector(".submenu").classList.toggle("hidden");
      });
    });

    // logout
    const logoutBtn = document.querySelector("#logout-button");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("authToken");
        window.location.href = "index.html";
      });
    }
  },

  afterHeaderLoaded() {
    // user avatar logic
    const avatar = document.querySelector("#user-avatar");
    if (avatar && this.state.user?.profile_picture_url) {
      avatar.src = this.state.user.profile_picture_url;
      avatar.classList.remove("hidden");
    }
  },

  // -----------------------------------------
  // 📍 Routing berdasarkan nama file HTML
  // -----------------------------------------
  routePage() {
    const file = window.location.pathname.split("/").pop();

    if (file.includes("dashboard")) this.initDashboard?.();
    if (file.includes("status-barang")) this.initStatusBarang?.();
    if (file.includes("print-po")) this.initPrintPO?.();
    if (file.includes("work-orders")) this.initWorkOrders?.();
    if (file.includes("surat-jalan")) this.initSuratJalan?.();
    if (file.includes("stok-bahan")) this.initStok?.();
    if (file.includes("data-karyawan")) this.initKaryawan?.();
    if (file.includes("payroll")) this.initPayroll?.();
  },

  // -----------------------------------------
  // 🔗 Socket Realtime
  // -----------------------------------------
  initSocket() {
    try {
      this.state.socket = io(this.api.baseUrl, { transports: ["websocket"] });
      console.log("🔗 Socket connected");
    } catch (err) {
      console.warn("Socket cannot connect:", err);
    }
  }
};

// 🚀 Jalankan app
document.addEventListener("DOMContentLoaded", () => App.init());
