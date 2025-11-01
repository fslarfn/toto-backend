const App = {
  baseUrl: window.location.origin,
  socket: null,

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
      ...options,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async init() {
    this.socketInit();

    // inisialisasi halaman Work Orders
    if (location.pathname.endsWith("work-orders.html")) {
      this.initWorkOrders();
    }
  },

  socketInit() {
    this.socket = io(this.baseUrl, { transports: ["websocket", "polling"] });
    this.socket.on("connect", () => console.log("✅ Socket connected:", this.socket.id));
    this.socket.on("disconnect", () => console.warn("❌ Socket disconnected"));

    // sync realtime
    this.socket.on("wo_created", (row) => App.updateRowRealtime(row));
    this.socket.on("wo_updated", (row) => App.updateRowRealtime(row));
  },

  async initWorkOrders() {
    const monthSelect = document.getElementById("wo-month");
    const yearSelect = document.getElementById("wo-year");
    const filterBtn = document.getElementById("filter-btn");
    const container = document.getElementById("workorders-grid");

    // isi dropdown bulan
    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      if (i === new Date().getMonth() + 1) opt.selected = true;
      monthSelect.appendChild(opt);
    }

    // isi dropdown tahun
    const yearNow = new Date().getFullYear();
    for (let i = yearNow - 2; i <= yearNow + 1; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = i;
      if (i === yearNow) opt.selected = true;
      yearSelect.appendChild(opt);
    }

    // Tabulator
    const table = new Tabulator(container, {
      height: "600px",
      layout: "fitColumns",
      reactiveData: true,
      columns: [
        { title: "Tanggal", field: "tanggal", editor: "input", width: 130 },
        { title: "Customer", field: "nama_customer", editor: "input", widthGrow: 2 },
        { title: "Deskripsi", field: "deskripsi", editor: "input", widthGrow: 3 },
        { title: "Ukuran", field: "ukuran", editor: "input" },
        { title: "Qty", field: "qty", editor: "input", width: 100 },
        { title: "Harga", field: "harga", editor: "input", width: 100 },
        { title: "Total", field: "total", width: 120 },
        { title: "No Inv", field: "no_inv", editor: "input", width: 140 },
      ],
      cellEdited: async (cell) => {
        const data = cell.getRow().getData();
        const field = cell.getField();
        const value = cell.getValue();

        try {
          if (String(data.id).startsWith("temp-")) {
            const res = await App.request("/workorders", {
              method: "POST",
              body: JSON.stringify(data),
            });
            cell.getRow().update(res);
          } else {
            await App.request(`/workorders/${data.id}`, {
              method: "PATCH",
              body: JSON.stringify({ [field]: value }),
            });
            App.socket.emit("wo_updated", { id: data.id, [field]: value });
          }
        } catch (err) {
          console.error("Gagal menyimpan:", err);
        }
      },
    });

    // tampilkan data awal
    const loadData = async () => {
      try {
        const month = monthSelect.value;
        const year = yearSelect.value;
        const res = await App.request(`/workorders/chunk?month=${month}&year=${year}`);
        table.replaceData(res.data);
      } catch (err) {
        console.error("Gagal load data:", err);
      }
    };

    filterBtn.addEventListener("click", loadData);
    loadData();
  },

  updateRowRealtime(row) {
    const container = document.getElementById("workorders-grid");
    const tab = Tabulator.findTable("#workorders-grid")[0];
    if (!tab) return;
    const existing = tab.getRow(row.id);
    if (existing) existing.update(row);
    else tab.addRow(row);
  },
};

window.addEventListener("DOMContentLoaded", () => App.init());
