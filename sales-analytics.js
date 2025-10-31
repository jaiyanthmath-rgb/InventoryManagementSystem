// sales-analytics.js
(async function () {
  const API_ROOT = "https://inventorymanagementsystem-o1oy.onrender.com/api/sales";
  const $ = (id) => document.getElementById(id);
  const formatINR = (v) => "₹" + Number(v || 0).toLocaleString("en-IN");

  // DOM nodes
  const timeRange = $("timeRange");
  const channelFilter = $("channelFilter");
  const refreshBtn = $("refreshBtn");

  const totalRevenueNode = $("totalRevenue");
  const onlineRevenueNode = $("onlineRevenue");
  const offlineRevenueNode = $("offlineRevenue");
  const onlineOrdersNode = $("onlineOrders");
  const offlineOrdersNode = $("offlineOrders");

  // Table controls
  const typeSegment = document.getElementById("typeSegment");
  const metricSegment = document.getElementById("metricSegment");
  const topTable = document.getElementById("topTable").querySelector("tbody");
  const colTitle = document.getElementById("colTitle");
  const colMetric = document.getElementById("colMetric");
  const viewAllBtn = document.getElementById("viewAllBtn");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const modalClose = document.getElementById("modalClose");
  const modalPrint = document.getElementById("modalPrint");
  const modalTableBody = document.getElementById("modalTable").querySelector("tbody");

  const printButtons = document.querySelectorAll(".print-btn");

  // state
  let selectedType = "items"; // or 'brands'
  let selectedMetric = "quantity"; // or 'revenue'

  // charts
  let ordersChart, topItemsChart, brandsChart;

  // Helpers
  function setActiveSegment(container, key, value) {
    Array.from(container.querySelectorAll("button")).forEach((btn) => {
      if (btn.dataset[key] === value) btn.classList.add("active");
      else btn.classList.remove("active");
    });
  }

  function safeJSON(res) {
    if (!res.ok) throw new Error("Network response not ok");
    return res.json();
  }

  // Fetch analytics (KPIs + charts)
  async function loadAnalytics() {
    try {
      const range = timeRange.value;
      const channel = channelFilter.value;

      const res = await fetch(`${API_ROOT}/analytics?range=${range}&channel=${channel}`);
      const json = await safeJSON(res);

      const { kpi, data, topItems, topBrands } = json;

      // compute online/offline
      const online = kpi.find((x) => x._id === "online") || { totalRevenue: 0, totalOrders: 0 };
      const offline = kpi.find((x) => x._id === "offline") || { totalRevenue: 0, totalOrders: 0 };

      const totalRevenue = (online.totalRevenue || 0) + (offline.totalRevenue || 0);
      totalRevenueNode.textContent = formatINR(totalRevenue);
      onlineRevenueNode.textContent = formatINR(online.totalRevenue || 0);
      offlineRevenueNode.textContent = formatINR(offline.totalRevenue || 0);
      onlineOrdersNode.textContent = online.totalOrders || 0;
      offlineOrdersNode.textContent = offline.totalOrders || 0;

      // destroy existing charts
      [ordersChart, topItemsChart, brandsChart].forEach((c) => c && c.destroy());

      // orders chart (simple comparison)
      const onlineOrders = online.totalOrders || 0;
      const offlineOrders = offline.totalOrders || 0;
      ordersChart = new Chart($("ordersChart"), {
        type: "bar",
        data: {
          labels: ["Online Orders", "Offline Orders"],
          datasets: [
            {
              label: "Orders",
              data: [onlineOrders, offlineOrders],
              backgroundColor: ["#00bcd4", "#4caf50"],
              borderRadius: 8, // sharp but smooth
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: "Total Orders Comparison",
              color: "#111",
              font: { size: 16, weight: "700" },
            },
            legend: { display: false },
          },
          scales: {
            x: { ticks: { color: "#111" } },
            y: { ticks: { color: "#111" } },
          },
          layout: { padding: 10 },
        },
      });

      // top items chart
      topItemsChart = new Chart($("topItemsChart"), {
        type: "bar",
        data: {
          labels: topItems.map((x) => x._id),
          datasets: [
            {
              label: "Revenue",
              data: topItems.map((x) => x.revenue),
              backgroundColor: "#ff9800",
              borderRadius: 8,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: "Top 5 Selling Items (by revenue)",
              color: "#111",
              font: { size: 16, weight: "700" },
            },
            legend: { display: false },
          },
          scales: { x: { ticks: { color: "#111" } }, y: { ticks: { color: "#111" } } },
          layout: { padding: 10 },
        },
      });

      // brands chart (pie, reduced size)
      const brandCanvas = $("brandsChart");
      brandCanvas.parentElement.style.display = "flex";
      brandCanvas.parentElement.style.justifyContent = "center";
      brandCanvas.parentElement.style.alignItems = "center";
      brandCanvas.parentElement.style.padding = "10px";
      brandsChart = new Chart(brandCanvas, {
        type: "pie",
        data: {
          labels: topBrands.map((x) => x._id),
          datasets: [
            {
              data: topBrands.map((x) => x.revenue),
              backgroundColor: ["#00bcd4", "#4caf50", "#ff9800", "#e91e63", "#9c27b0"],
              borderColor: "#fff",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          aspectRatio: 1.2, // smaller size
          plugins: {
            title: {
              display: true,
              text: "Top Brands (Revenue Share)",
              color: "#111",
              font: { size: 16, weight: "700" },
            },
            legend: { position: "bottom", labels: { color: "#111" } },
          },
        },
      });
    } catch (err) {
      console.error("Analytics load failed", err);
    }
  }

  // Load Top table (items/brands, metric) top 5
  async function loadTopTable() {
    try {
      const range = timeRange.value;
      const channel = channelFilter.value;
      const qtype = selectedType; // items | brands
      const metric = selectedMetric; // quantity | revenue
      const res = await fetch(`${API_ROOT}/top?type=${qtype}&metric=${metric}&limit=5&range=${range}&channel=${channel}`);
      const data = await safeJSON(res);

      // adjust column title
      colTitle.textContent = selectedType === "items" ? "Item" : "Brand";
      colMetric.textContent = selectedMetric === "quantity" ? "Quantity" : "Revenue";
      document.getElementById("colOpposite").textContent =selectedMetric === "quantity" ? "Revenue" : "Quantity";


      // build rows
      topTable.innerHTML = "";
      data.forEach((r, i) => {
        const tr = document.createElement("tr");
        const name = r._id;
        const quantity = r.totalQty || r.quantity || r.quantitySold || 0;
        const revenue = Math.round(r.revenue) || 0;

        tr.innerHTML = `
          <td style="width:40px; padding:6px">${i + 1}</td>
          <td style="padding:6px">${name}</td>
          <td style="text-align:right; font-weight:700; padding:6px">${selectedMetric === "quantity" ? quantity : formatINR(revenue)}</td>
          <td style="text-align:right; color:#6b6f72; padding:6px">${selectedMetric === "quantity" ? formatINR(revenue) : quantity}</td>
        `;
        topTable.appendChild(tr);
      });
    } catch (err) {
      console.error("loadTopTable error", err);
      topTable.innerHTML = `<tr><td colspan="4">Failed to load data</td></tr>`;
    }
  }

  // View All Modal
  async function openViewAllModal() {
    modalBackdrop.style.display = "flex";
    modalTableBody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;

    try {
      const range = timeRange.value;
      const channel = channelFilter.value;
      const res = await fetch(`${API_ROOT}/top/all?type=${selectedType}&metric=${selectedMetric}&range=${range}&channel=${channel}`);
      const data = await safeJSON(res);

      modalTableBody.innerHTML = "";
      data.forEach((r, idx) => {
        const name = r._id;
        const qty = r.totalQty || r.quantity || r.quantitySold || 0;
        const rev = Math.round(r.revenue) || 0;
        const lastSold = r.lastSold ? new Date(r.lastSold).toLocaleString() : "-";
        const channel = r._idChannel || r.channel || "-";
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${idx + 1}</td><td>${name}</td><td style="text-align:right">${qty}</td><td style="text-align:right">${formatINR(rev)}</td><td>${channel}</td><td>${lastSold}</td>`;
        modalTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error("View all fetch failed", err);
      modalTableBody.innerHTML = `<tr><td colspan="6">Failed to load records</td></tr>`;
    }
  }

  // Print helpers
  function printElementById(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const newWin = window.open("", "_blank");
    const head = document.head.cloneNode(true);
    newWin.document.write(
      "<html><head>" +
        head.innerHTML +
        `<style>
          body{font-family:Inter,sans-serif;padding:20px;color:#222}
          table{width:100%;border-collapse:collapse}
          th,td{padding:6px;border:1px solid #ddd;text-align:left}
        </style></head><body>`
    );
    newWin.document.write(el.outerHTML);
    newWin.document.write("</body></html>");
    newWin.document.close();
    newWin.focus();
    setTimeout(() => {
      newWin.print();
      newWin.close();
    }, 300);
  }

  // Event Listeners
  typeSegment.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    selectedType = btn.dataset.type;
    setActiveSegment(typeSegment, "type", selectedType);
    loadTopTable();
  });
  metricSegment.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    selectedMetric = btn.dataset.metric;
    setActiveSegment(metricSegment, "metric", selectedMetric);
    loadTopTable();
  });

  viewAllBtn.addEventListener("click", openViewAllModal);
  modalClose.addEventListener("click", () => (modalBackdrop.style.display = "none"));
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) modalBackdrop.style.display = "none";
  });
  modalPrint.addEventListener("click", () => printElementById("modalTable"));

  printButtons.forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      const target = ev.currentTarget.dataset.target;
      printElementById(target);
    });
  });

  refreshBtn.addEventListener("click", () => {
    loadAnalytics();
    loadTopTable();
  });
  channelFilter.addEventListener("change", () => {
    loadAnalytics();
    loadTopTable();
  });
  timeRange.addEventListener("change", () => {
    loadAnalytics();
    loadTopTable();
  });

  setActiveSegment(typeSegment, "type", selectedType);
  setActiveSegment(metricSegment, "metric", selectedMetric);

  await loadAnalytics();
  await loadTopTable();
})();
