const API_URL = "https://inventorymanagementsystem-o1oy.onrender.com/api"; // Backend URL


// Profile dropdown toggle
const profileIcon = document.querySelector('.profile-icon');
const dropdownMenu = document.querySelector('.dropdown-menu');

if (profileIcon) {
    profileIcon.addEventListener('click', () => {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });
}

async function loadSection(section) {
    switch (section) {
        case 'dashboard':
            await loadDashboard();
            break;

        case 'stock':
            contentArea.innerHTML = `<h2>Stock / Inventory</h2><div id="stockTableContainer"><p>Loading stock details...</p></div>`;
            await loadStock();
            break;

        case 'orders':
            contentArea.innerHTML = `
            <h2>Orders</h2>
            <div id="onlineOrdersTable" style="display:none;"></div>
            <div id="offlineOrdersTable" style="display:none;"></div>
            `;
            break;

        case 'negotiations':
            contentArea.innerHTML = `<h2>Negotiations</h2><div id="negotiationsContainer"><p>Loading negotiation requests...</p></div>`;
            await loadNegotiations();
            break;

        case 'notifications':
            contentArea.innerHTML = `
            <h2>Notifications</h2>
            <div id="notificationsContainer"><p>Loading notifications...</p></div>`;
            await loadNotifications(); // 👈 add this line
            break;

        case 'profile':
            contentArea.innerHTML = `<h2>My Account</h2><p>Owner profile details here.</p>`;
            break;
    }
}

// --- DASHBOARD ---
// --- DASHBOARD ---

// --- DASHBOARD DATA FETCH + CHART ---
// ==========================
// DASHBOARD FUNCTIONALITY
// ==========================
// 🔹 Load Dashboard Section
async function loadDashboard() {
  try {
    contentArea.innerHTML = `
      <div class="dashboard-container">
        <h2>Dashboard Overview</h2>

        <!-- 🔹 Big Revenue Card -->
        <div class="revenue-main-card">
          <h3>Total Revenue</h3>
          <p id="totalRevenue">Loading...</p>
          <button id="viewSalesBtn">View Sales Analytics</button>
        </div>

        <!-- 🔹 Row of Smaller Cards -->
        <div class="dashboard-row">
          <div class="card"><h3>Top Selling Item (Online)</h3><p id="topItemOnline">Loading...</p></div>
          <div class="card"><h3>Top Brand (Online)</h3><p id="topBrandOnline">Loading...</p></div>
          <div class="card"><h3>Top Selling Item (Offline)</h3><p id="topItemOffline">Loading...</p></div>
          <div class="card"><h3>Top Brand (Offline)</h3><p id="topBrandOffline">Loading...</p></div>
        </div>
      </div>
    `;

    // Fetch data
    const response = await fetch(`${API_URL}/sales/dashboard`);
    if (!response.ok) throw new Error("Failed to fetch dashboard data");
    const data = await response.json();

    // Update values
    document.getElementById("totalRevenue").textContent = `₹ ${data.totalRevenue.toLocaleString()}`;
    document.getElementById("topItemOnline").textContent = data.topItemOnline || "N/A";
    document.getElementById("topBrandOnline").textContent = data.topBrandOnline || "N/A";
    document.getElementById("topItemOffline").textContent = data.topItemOffline || "N/A";
    document.getElementById("topBrandOffline").textContent = data.topBrandOffline || "N/A";

    // Redirect to analytics page
    document.getElementById("viewSalesBtn").addEventListener("click", () => {
      window.location.href = "sales-analytics.html";
    });

  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}


// --- STOCK SECTION ---
// --- STOCK SECTION ---
// --- STOCK SECTION ---  
async function loadStock() {
    const container = document.getElementById('stockTableContainer');

    try {
        const res = await fetch(`${API_URL}/items`);
        const items = await res.json();

        if (!items.length) {
            container.innerHTML = "<p>No stock available.</p>";
            return;
        }

        // --- UI Layout ---
        container.innerHTML = `
            <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                <button id="addNewItemBtn" style="background:#4CAF50;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:bold;">
                    ➕ Add Item
                </button>

                <input 
                    type="text" 
                    id="stockSearch" 
                    placeholder="🔍 Search item..." 
                    style="width:55%; padding:10px 12px; border-radius:10px; border:1px solid #ccc; font-size:16px; outline:none;"
                />
            </div>

            <div id="itemActionBtns" style="display:none; margin-bottom:10px; gap:10px; flex-wrap:wrap;">
                <button id="addBrandBtn" style="background:#009688;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">➕ Add Brand</button>
                <button id="editPriceBtn" style="background:#2196F3;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">✏️ Edit Price</button>
                <button id="editStockBtn" style="background:#FF9800;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">📦 Edit Stock</button>
                <button id="editStockRatioBtn" style="background:#795548;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">⚖️ Edit Stock Ratio</button>
                <button id="editOnlineLimitBtn" style="background:#3F51B5;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🌐 Edit Online Limit</button>
                <button id="editOfflineLimitBtn" style="background:#8BC34A;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🏬 Edit Offline Limit</button>
                <button id="deleteBrandBtn" style="background:#f44336;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">❌ Delete Brand</button>
                <button id="deleteItemBtn" style="background:#9C27B0;color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🗑️ Delete Item</button>
            </div>

            <div id="stockTableWrapper"></div>
        `;

        const tableWrapper = document.getElementById('stockTableWrapper');
        const searchInput = document.getElementById('stockSearch');
        const actionBtns = document.getElementById('itemActionBtns');

        // --- Render Stock Table ---
        function renderTable(filteredItems) {
            let tableHTML = `
                <table border="1" cellpadding="10" cellspacing="0" 
                    style="width:100%; border-collapse: collapse; text-align:center; color:black; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <thead style="background:#ff9800; color:white;">
                        <tr>
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Brand</th>
                            <th>Total Stock</th>
                            <th>Price</th>
                            <th>Online Stock</th>
                            <th>Online Limit</th>
                            <th>Offline Stock</th>
                            <th>Offline Limit</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            filteredItems.forEach(item => {
                const brands = item.brands || [];
                const quantities = item.quantity || {};
                const prices = item.price || {};
                const onlineStocks = item.online_stock || {};
                const offlineStocks = item.offline_stock || {};
                const limits = item.limits || [];

                brands.forEach((brand, idx) => {
                    const brandLimit = limits.find(l => l.brand === brand) || {};
                    const onlineLimit = brandLimit.online_limit ?? 0;
                    const offlineLimit = brandLimit.offline_limit ?? 0;

                    tableHTML += `
                        <tr>
                            ${idx === 0 ? `<td rowspan="${brands.length}" style="font-weight:bold;">${item.name}</td>` : ''}
                            ${idx === 0 ? `<td rowspan="${brands.length}">${item.category || '-'}</td>` : ''}
                            <td>${brand}</td>
                            <td>${quantities[brand] ?? 0}</td>
                            <td>₹${prices[brand] ?? 0}</td>
                            <td>${onlineStocks[brand] ?? 0}</td>
                            <td>${onlineLimit}</td>
                            <td>${offlineStocks[brand] ?? 0}</td>
                            <td>${offlineLimit}</td>
                        </tr>
                    `;
                });
            });

            tableHTML += "</tbody></table>";
            tableWrapper.innerHTML = tableHTML;
        }

        // --- Initial Render ---
        renderTable(items);

        // --- Search + Filter ---
        let selectedItem = null;
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            if (!query) {
                actionBtns.style.display = "none";
                renderTable(items);
                selectedItem = null;
                return;
            }

            const matched = items.filter(item => 
                item.name.toLowerCase().includes(query)
            );

            if (matched.length === 1) {
                selectedItem = matched[0];
                actionBtns.style.display = "flex";
                renderTable(matched);
            } else {
                actionBtns.style.display = "none";
                selectedItem = null;
                renderTable(matched);
            }
        });

        // --- Add New Item ---
        document.getElementById('addNewItemBtn').addEventListener('click', async () => {
            const name = prompt("Enter Item Name:");
            if (!name) return alert("Item name is required!");

            const brand = prompt("Enter Brand:");
            const category = prompt("Enter Category:");
            const price = parseFloat(prompt("Enter Price:"));
            const stock = parseInt(prompt("Enter Stock Count:"));

            if (!brand || isNaN(price) || isNaN(stock))
                return alert("Invalid input.");

            await fetch(`${API_URL}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    category,
                    brands: [brand],
                    price: { [brand]: price },
                    quantity: { [brand]: stock },
                })
            });
            alert("✅ New Item Added!");
            loadStock();
        });

        // --- Add Brand ---
        document.getElementById('addBrandBtn').addEventListener('click', async () => {
            if (!selectedItem) return alert("Search and select an item first!");
            const brand = prompt("Enter new brand name:");
            const price = parseFloat(prompt("Enter price for this brand:"));
            const stock = parseInt(prompt("Enter stock count:"));
            if (!brand || isNaN(price) || isNaN(stock)) return alert("Invalid input.");

            await fetch(`${API_URL}/items/${selectedItem._id}/add-brand`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brand, price, stock })
            });
            alert("✅ Brand added!");
            loadStock();
        });

        // --- Edit Price ---
        document.getElementById('editPriceBtn').addEventListener('click', async () => {
            if (!selectedItem) return alert("Select an item first!");
            const brand = prompt("Enter brand to edit price:");
            const newPrice = parseFloat(prompt(`Enter new price for ${brand}:`));
            if (!brand || isNaN(newPrice)) return alert("Invalid input.");
            await fetch(`${API_URL}/items/${selectedItem._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ price: { [brand]: newPrice } })
            });
            alert("💰 Price updated!");
            loadStock();
        });

        // --- Edit Stock ---
        document.getElementById('editStockBtn').addEventListener('click', async () => {
            if (!selectedItem) return alert("Select an item first!");
            const brand = prompt("Enter brand to edit stock:");
            const newStock = parseInt(prompt(`Enter new stock for ${brand}:`));
            if (!brand || isNaN(newStock)) return alert("Invalid input.");
            await fetch(`${API_URL}/items/${selectedItem._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quantity: { [brand]: newStock } })
            });
            alert("📦 Stock updated!");
            loadStock();
        });

        // --- Edit Stock Ratio ---
document.getElementById('editStockRatioBtn').addEventListener('click', async () => {
    if (!selectedItem) return alert("Select an item first!");
    const newRatio = parseFloat(prompt("Enter new stock ratio (0–1):"));
    if (isNaN(newRatio) || newRatio < 0 || newRatio > 1) return alert("Invalid ratio!");
    await fetch(`${API_URL}/items/${selectedItem._id}/edit-stock-ratio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newRatio })
    });
    alert("⚙️ Stock ratio updated!");
    loadStock();
});

// --- Edit Online Limit ---
document.getElementById('editOnlineLimitBtn').addEventListener('click', async () => {
    if (!selectedItem) return alert("Select an item first!");
    const brand = prompt("Enter brand name to edit online limit:");
    const newLimit = parseInt(prompt(`Enter new online limit for ${brand}:`));
    if (!brand || isNaN(newLimit)) return alert("Invalid input.");
    await fetch(`${API_URL}/items/${selectedItem._id}/edit-online-limit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, newLimit })
    });
    alert("🌐 Online limit updated!");
    loadStock();
});

// --- Edit Offline Limit ---
document.getElementById('editOfflineLimitBtn').addEventListener('click', async () => {
    if (!selectedItem) return alert("Select an item first!");
    const brand = prompt("Enter brand name to edit offline limit:");
    const newLimit = parseInt(prompt(`Enter new offline limit for ${brand}:`));
    if (!brand || isNaN(newLimit)) return alert("Invalid input.");
    await fetch(`${API_URL}/items/${selectedItem._id}/edit-offline-limit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, newLimit })
    });
    alert("🏪 Offline limit updated!");
    loadStock();
});


        // --- Delete Brand ---
        document.getElementById('deleteBrandBtn').addEventListener('click', async () => {
            if (!selectedItem) return alert("Select an item first!");
            const brand = prompt("Enter brand name to delete:");
            if (!brand) return alert("Brand name required.");
            if (!confirm(`Delete brand '${brand}' from ${selectedItem.name}?`)) return;

            await fetch(`${API_URL}/items/${selectedItem._id}/delete-brand`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brand })
            });
            alert("🗑️ Brand deleted!");
            loadStock();
        });

        // --- Delete Entire Item ---
        document.getElementById('deleteItemBtn').addEventListener('click', async () => {
            if (!selectedItem) return alert("Select an item first!");
            if (!confirm(`Delete item '${selectedItem.name}' completely?`)) return;
            await fetch(`${API_URL}/items/${selectedItem._id}`, { method: "DELETE" });
            alert("🚮 Item deleted!");
            loadStock();
        });

    } catch (err) {
        console.error("Error loading stock:", err);
        container.innerHTML = "<p>Error loading stock.</p>";
    }
}

function initOrderDropdown() {
  // Buttons that are inside the Orders section
  const onlineBtn = document.getElementById("showOnlineOrders");
  const offlineBtn = document.getElementById("showOfflineOrders");
  const onlineTbl = document.getElementById("onlineOrdersTable");
  const offlineTbl = document.getElementById("offlineOrdersTable");

  if (!onlineBtn || !offlineBtn || !onlineTbl || !offlineTbl) {
    // if any missing, nothing to init (maybe not on Orders page)
    return;
  }

  // Clear previous listeners by replacing nodes (safe, avoids duplicates)
  function replaceWithClone(el) {
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }

  const onlineBtnClean = replaceWithClone(onlineBtn);
  const offlineBtnClean = replaceWithClone(offlineBtn);

  onlineBtnClean.addEventListener("click", async (e) => {
    e.stopPropagation();
    onlineTbl.style.display = "block";
    offlineTbl.style.display = "none";
    try { await loadOnlineOrders(); } catch (err) { console.error("loadOnlineOrders error:", err); }
  });

  offlineBtnClean.addEventListener("click", async (e) => {
    e.stopPropagation();
    offlineTbl.style.display = "block";
    onlineTbl.style.display = "none";
    try { await loadOfflineOrders(); } catch (err) { console.error("loadOfflineOrders error:", err); }
  });
}
// --- FETCH ONLINE ORDERS ---
// --- FETCH ONLINE ORDERS ---
async function loadOnlineOrders() {
  const container = document.getElementById('onlineOrdersTable');
  container.innerHTML = "<p>Loading online orders...</p>";

  try {
    const res = await fetch(`${API_URL}/online-orders`);
    const orders = await res.json();

    if (!orders || orders.length === 0) {
      container.innerHTML = "<p>No online orders yet.</p>";
      return;
    }

    let html = `
      <h3>Online Orders</h3>
      <table border="1" cellpadding="8" cellspacing="0" 
          style="width:100%; border-collapse: collapse; text-align:center;">
        <thead style="background:#ff9800; color:white;">
          <tr>
            <th>Customer</th>
            <th>Address</th>
            <th>Items</th>
            <th>Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    orders.forEach(order => {
      // Format item details with brand & quantity
      const itemsStr = order.items
        .map(i => `
          <div style="margin-bottom:8px;">
            <b>${i.itemName || 'Unknown Item'}</b><br>
            Brand: <b>${i.brand || 'N/A'}</b><br>
            Quantity: <b>${i.quantity || 0}</b><br>
            Bundle Price: ₹${i.bundlePrice?.toFixed(2) || 0}<br>
            Total Price: ₹${i.totalPrice?.toFixed(2) || 0}
          </div>
        `)
        .join("<hr style='border: 0; border-top: 1px solid #ccc;'>");

      html += `
        <tr>
          <td>${order.name}</td>
          <td>${order.address}</td>
          <td style="text-align:left;">${itemsStr}</td>
          <td><b>₹${order.subtotal?.toFixed(2) || order.total?.toFixed(2) || 0}</b></td>
          <td>${new Date(order.orderDate).toLocaleString()}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;

  } catch (err) {
    console.error("Error loading online orders:", err);
    container.innerHTML = "<p>Error loading online orders.</p>";
  }
}

// --- FETCH OFFLINE ORDERS ---
async function loadOfflineOrders() {
    const container = document.getElementById("offlineOrdersTable");
    container.innerHTML = "<p>Loading offline orders...</p>";

    try {
        const res = await fetch(`${API_URL}/offline-orders`);
        const orders = await res.json();

        if (!orders || orders.length === 0) {
            container.innerHTML = "<p>No offline orders found.</p>";
            return;
        }

        let html = `
        <h3>Offline Orders</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; text-align:center;">
            <thead style="background:#ff9800; color:white;">
                <tr>
                    <th>Order #</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
        `;

        orders.forEach(order => {
            const itemsStr = order.items.map(i => `${i.name} (${i.brand}) x${i.quantity}`).join("<br>");
            html += `
                <tr>
                    <td>${order.orderNumber}</td>
                    <td>${itemsStr}</td>
                    <td>₹${order.total}</td>
                    <td>${new Date(order.date).toLocaleString()}</td>
                </tr>
            `;
        });

        html += "</tbody></table>";
        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading offline orders.</p>";
    }
}


// --- NEGOTIATIONS ---
async function loadNegotiations() {
    const container = document.getElementById('negotiationsContainer');
    try {
        const res = await fetch(`${API_URL}/negotiations`);
        const negotiations = await res.json();

        if (!negotiations || negotiations.length === 0) {
            container.innerHTML = "<p>No negotiation requests yet.</p>";
            return;
        }

        let html = `
        <table border="1" cellpadding="8" cellspacing="0" 
               style="width:100%; border-collapse:collapse; text-align:center;">
            <thead style="background:#ff9800; color:white;">
                <tr>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Original Total</th>
                    <th>Negotiated Total</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
        `;

        negotiations.forEach(req => {
            const itemsStr = req.items
                .map(i => `${i.name} (${i.brand || 'N/A'}) x${i.quantity}`)
                .join("<br>");
            
            const statusColor = 
                req.status === "Accepted" ? "green" :
                req.status === "Rejected" ? "red" : "orange";

            html += `
                <tr data-id="${req._id}">
                    <td>${req.customer.name}</td>
                    <td>${itemsStr}</td>
                    <td>₹${req.originalTotal}</td>
                    <td>₹${req.negotiatedTotal}</td>
                    <td style="color:${statusColor}; font-weight:bold;">${req.status}</td>
                    <td>
                        ${req.status === "Waiting" ? `
                            <button class="acceptBtn">Accept</button>
                            <button class="rejectBtn">Reject</button>
                        ` : '-'}
                    </td>
                </tr>
            `;
        });

        html += "</tbody></table>";
        container.innerHTML = html;

        document.querySelectorAll('.acceptBtn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tr = e.target.closest('tr');
                const reqId = tr.getAttribute('data-id');
                await respondNegotiation(reqId, true);
                loadNegotiations();
            });
        });

        document.querySelectorAll('.rejectBtn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const tr = e.target.closest('tr');
                const reqId = tr.getAttribute('data-id');
                await respondNegotiation(reqId, false);
                loadNegotiations();
            });
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading negotiations.</p>";
    }
}

// Respond to negotiation
async function respondNegotiation(id, accept) {
    try {
        await fetch(`${API_URL}/negotiations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accept })
        });
    } catch (err) {
        console.error(err);
    }
}

// -------------------- NOTIFICATIONS SECTION (Safe version) --------------------
async function loadNotifications() {
    const container = document.getElementById('notificationsContainer');
    try {
        const res = await fetch(`${API_URL}/notifications`);
        const notifications = await res.json();

        if (!notifications || notifications.length === 0) {
            container.innerHTML = "<p>No notifications yet.</p>";
            return;
        }

        let html = `
        <table border="1" cellpadding="8" cellspacing="0"
               style="width:100%; border-collapse:collapse; text-align:center;">
            <thead style="background:#ff9800; color:white;">
                <tr>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Item</th>
                    <th>Brand</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
        `;

        notifications.forEach(n => {
            html += `
                <tr data-id="${n._id}">
                    <td>${n.title || '-'}</td>
                    <td>${n.message || '-'}</td>
                    <td>${n.item_name || '-'}</td>
                    <td>${n.brand || '-'}</td>
                    <td>${n.type || '-'}</td>
                    <td>${new Date(n.createdAt).toLocaleString()}</td>
                    <td>${n.read ? '✅ Read' : '📩 Unread'}</td>
                </tr>
            `;
        });

        html += "</tbody></table>";
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading notifications.</p>";
    }
}


// Logout
const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('jr_user');
        window.location.href = '../owner.html';
    });
}


// ---------- Robust sidebar handler (paste at the end of owner.js) ----------
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) {
    console.error("Sidebar not found");
    return;
  }

  sidebar.addEventListener("click", async (e) => {
    const li = e.target.closest("li");
    if (!li || !sidebar.contains(li)) return;

    // If the click was on the submenu items in the sidebar (ids: online-orders, offline-orders)
    const liId = li.id || "";
    if (liId === "online-orders") {
      // load Orders section then open online table
      await loadSection("orders");
      initOrderDropdown();
      // show online table
      const onlineTbl = document.getElementById("onlineOrdersTable");
      const offlineTbl = document.getElementById("offlineOrdersTable");
      if (onlineTbl) onlineTbl.style.display = "block";
      if (offlineTbl) offlineTbl.style.display = "none";
      await loadOnlineOrders();
      return;
    }
    if (liId === "offline-orders") {
      await loadSection("orders");
      initOrderDropdown();
      const onlineTbl = document.getElementById("onlineOrdersTable");
      const offlineTbl = document.getElementById("offlineOrdersTable");
      if (offlineTbl) offlineTbl.style.display = "block";
      if (onlineTbl) onlineTbl.style.display = "none";
      await loadOfflineOrders();
      return;
    }

    // Otherwise, main items use data-section attribute
    const section = li.getAttribute("data-section");
    if (section) {
      await loadSection(section);
    }
  });
});
