const API_URL = "https://inventorymanagementsystem-o1oy.onrender.com/api";

// Sections
function showSection(id){
  document.querySelectorAll('.section').forEach(sec => sec.style.display='none');
  const el = document.getElementById(id);
  if(el) el.style.display='block';
  if(id === 'itemsList') renderItemsList();
  if(id === 'ordersHistory') renderOrdersHistory();
}

// GLOBAL state
let allItems = [];
let orderItems = [];        // { name, brand, quantity, price, total }
let nextOrderNumber = 1;

async function loadItems() {
  const res = await fetch(`${API_URL}/items`);
  allItems = await res.json();
}

async function renderItemsList(filtered = null) {
  await loadItems();
  const itemsToShow = filtered || allItems;
  const container = document.getElementById('itemsTable');
  const tbody = container.querySelector('tbody');
  tbody.innerHTML = '';

  // 🧾 Table Styling
  container.style.border = '3px solid #333';
  container.style.borderRadius = '10px';
  container.style.borderCollapse = 'collapse';
  container.style.width = '100%';
  container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

  if (!itemsToShow.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:12px; color:#777;">No items found.</td></tr>`;
    return;
  }

  itemsToShow.forEach((item, index) => {
    // 🔹 Item name header
    const itemHeader = document.createElement('tr');
    itemHeader.innerHTML = `
      <td colspan="4" style="
        background:#f2f2ff;
        font-weight:700;
        font-size:15px;
        color:#333;
        padding:10px 14px;
        border-top:${index > 0 ? '4px solid #6c63ff' : 'none'};
        border-bottom:2px solid #6c63ff;
      ">
        ${item.name}
      </td>`;
    tbody.appendChild(itemHeader);

    // 🔹 Brand rows
    item.brands.forEach((brand, i) => {
      const tr = document.createElement('tr');
      tr.style = `
        background:${i % 2 === 0 ? '#ffffff' : '#fafafa'};
        border-bottom:1px solid #ccc;
      `;
      tr.innerHTML = `
        <td style="padding:10px 14px;"></td>
        <td style="padding:10px 14px;">${brand}</td>
        <td style="padding:10px 14px; text-align:left;">₹ ${item.price[brand]}</td>
        <td style="padding:10px 14px; text-align:left;">
          ${item.offline_stock?.[brand] ?? item.quantity?.[brand] ?? 'N/A'}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // spacing
    const gapRow = document.createElement('tr');
    gapRow.innerHTML = `<td colspan="4" style="height:10px; background:#fff;"></td>`;
    tbody.appendChild(gapRow);
  });
}

// 🔍 Live search filtering logic
const searchInput = document.getElementById('searchBar');
if (searchInput) {
  searchInput.addEventListener('input', async (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!allItems.length) await loadItems();

    const filteredItems = q
      ? allItems.filter(it => it.name.toLowerCase().includes(q))
      : allItems;

    renderItemsList(filteredItems);
  });
}

// Fetch next order number from DB
async function fetchNextOrderNumber(){
  try{
    const res = await fetch(`${API_URL}/orders`);
    const orders = await res.json();
    if(orders.length > 0) nextOrderNumber = orders[orders.length-1].orderNumber + 1;
  }catch(e){ console.error(e); }
}
fetchNextOrderNumber();

// Create order
document.getElementById('createOrderBtn')?.addEventListener('click', ()=>{
  orderItems = [];
  document.getElementById('orderSection').style.display = 'block';
  document.getElementById('orderNumber').innerText = nextOrderNumber;
  renderOrderTable();
  document.getElementById('finalTotal').innerText = 0;
});

// -------- New Order search (under "Add Item") --------
const orderSearch = document.getElementById('orderSearch');
const orderSuggestionBox = document.getElementById('orderSuggestionBox');

orderSearch.addEventListener('input', async (e) => {
  const q = e.target.value.trim().toLowerCase();
  orderSuggestionBox.innerHTML = '';
  if(!q){ orderSuggestionBox.style.display = 'none'; return; }
  if(!allItems.length) await loadItems();
  const matches = allItems.filter(it => it.name.toLowerCase().includes(q));
  matches.slice(0,8).forEach(m=>{
    const d = document.createElement('div');
    d.textContent = m.name;
    d.style.padding = '8px';
    d.style.cursor = 'pointer';
    d.style.background = '#fff';
    d.addEventListener('mouseover', ()=>d.style.background='#f3f3f3');
    d.addEventListener('mouseout', ()=>d.style.background='#fff');
    d.addEventListener('click', ()=> handleOrderItemSelect(m));
    orderSuggestionBox.appendChild(d);
  });
  orderSuggestionBox.style.display = matches.length ? 'block':'none';
});

// handle Enter key on search
orderSearch.addEventListener('keydown', async (e) => {
  if(e.key === 'Enter'){
    e.preventDefault();
    const q = orderSearch.value.trim().toLowerCase();
    if(!q) return;
    if(!allItems.length) await loadItems();
    const item = allItems.find(it => it.name.toLowerCase() === q || it.name.toLowerCase().includes(q));
    if(item) handleOrderItemSelect(item);
    orderSuggestionBox.style.display = 'none';
    orderSearch.value = '';
  }
});

// Called when an item is selected from suggestions or Entered
async function handleOrderItemSelect(item){
  if(item.brands.length === 1){
    addItemToOrder(item, item.brands[0], 1);
    return;
  }
  showBrandChooser(item);
}

function showBrandChooser(item){
  orderSuggestionBox.innerHTML = '';
  orderSuggestionBox.style.display = 'block';
  const chooser = document.createElement('div');
  chooser.style.padding = '8px';
  chooser.innerHTML = `<div style="font-weight:600; margin-bottom:6px;">Select brand for ${item.name}</div>`;
  const brandWrap = document.createElement('div');
  brandWrap.style.display = 'flex';
  brandWrap.style.gap = '6px';
  item.brands.forEach(b=>{
    const btn = document.createElement('button');
    btn.textContent = b;
    btn.className = 'brand-chooser-btn';
    btn.style.padding = '6px 10px';
    btn.style.borderRadius = '6px';
    btn.style.border = '1px solid #ccc';
    btn.style.cursor = 'pointer';
    btn.addEventListener('mouseover', ()=>btn.style.background='#eee');
    btn.addEventListener('mouseout', ()=>btn.style.background='#fff');
    btn.addEventListener('click', ()=>{
      addItemToOrder(item, b, 1);
      orderSuggestionBox.style.display = 'none';
      orderSearch.value = '';
    });
    brandWrap.appendChild(btn);
  });
  chooser.appendChild(brandWrap);
  orderSuggestionBox.appendChild(chooser);
}

// Add item to order (also updates backend stock)
async function addItemToOrder(item, brand, qty){
  const price = item.price[brand];
  const total = price * qty;
  orderItems.push({ name: item.name, brand, quantity: qty, price, total });

  await fetch(`${API_URL}/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: item._id, brand, quantity: qty, type: 'offline' })
  });

  await renderItemsList();
  renderOrderTable();
}

// render order table with inline qty controls and remove
function renderOrderTable() {
  const tbody = document.querySelector('#orderTable tbody');
  tbody.innerHTML = '';

  orderItems.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.style.background = idx % 2 === 0 ? '#f9f9f9' : '#fff';
    tr.style.borderBottom = '1px solid #eee';
    tr.innerHTML = `
      <td style="text-align:left; padding:8px;">${idx + 1}</td>
      <td style="padding:8px;">${it.name}</td>
      <td style="padding:8px;">${it.brand}</td>
      <td style="text-align:left; padding:8px;">
        <div class="qty-inline" style="display:flex; align-items:center; justify-content:center; gap:6px;">
          <button class="inline-action" data-idx="${idx}" data-op="dec"
            style="background:#ff6961; border:none; color:#fff; padding:4px 8px; border-radius:4px; cursor:pointer;">-</button>
          <span id="qty-${idx}" style="font-weight:600;">${it.quantity}</span>
          <button class="inline-action" data-idx="${idx}" data-op="inc"
            style="background:#77dd77; border:none; color:#fff; padding:4px 8px; border-radius:4px; cursor:pointer;">+</button>
        </div>
      </td>
      <td style="text-align:left; padding:8px;">₹ ${it.price}</td>
      <td style="text-align:left; padding:8px;">₹ <span id="total-${idx}">${it.total}</span></td>
      <td style="text-align:left; padding:8px;">
        <button class="inline-action" data-idx="${idx}" data-op="remove"
          style="background:#f7c04a; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;">Remove</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.inline-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.idx);
      const op = btn.dataset.op;
      const orderItem = orderItems[idx];
      const item = allItems.find(ai => ai.name === orderItem.name);
      const brand = orderItem.brand;

      // 🧾 Available stock is OFFLINE stock, not total quantity
      const availableOfflineStock = item.offline_stock?.[brand] ?? 0;

      if (op === 'inc') {
        if (orderItem.quantity < availableOfflineStock) {
          orderItem.quantity++;
          orderItem.total = orderItem.quantity * orderItem.price;

          // Update backend (reduce offline stock by 1)
          await fetch(`${API_URL}/sell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item_id: item._id,
              brand,
              quantity: 1,
              type: 'offline'
            })
          });
        } else {
          // Optionally show warning when stock limit is hit
          alert(`⚠️ No more stock available for ${item.name} (${brand}) offline.`);
        }
      } 
      else if (op === 'dec') {
        if (orderItem.quantity > 1) {
          orderItem.quantity--;
          orderItem.total = orderItem.quantity * orderItem.price;
        } else {
          orderItems.splice(idx, 1);
        }
      } 
      else if (op === 'remove') {
        orderItems.splice(idx, 1);
      }

      renderOrderTable();
      await renderItemsList(); // refresh visible stock
    });
  });
}

// Calculate total
document.getElementById('calculateTotal').addEventListener('click', ()=>{
  const total = orderItems.reduce((a,b)=>a+b.total,0);
  document.getElementById('finalTotal').innerText = total.toFixed(2);
});

// ---- SAVE ORDER FUNCTION ----
async function saveOrder() {
  if(!orderItems.length) return;
  const total = orderItems.reduce((a,b)=>a+b.total,0);

  const payload = {
    orderNumber: nextOrderNumber,
    date: new Date(),
    total: total,
    items: orderItems
  };

  try {
    await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    nextOrderNumber++;
    orderItems = [];
    renderOrderTable();
    document.getElementById('finalTotal').innerText = 0;
    await renderOrdersHistory();
  } catch(e) {
    console.error('saveOrder error', e);
  }
}

// Print Bill
document.getElementById('printBill').addEventListener('click', async () => {
  if (!orderItems.length) {
    alert('No items in the order!');
    return;
  }

  // Build print table content
  const printTbody = document.querySelector('#printSection #printTable tbody');
  printTbody.innerHTML = '';
  orderItems.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;">${idx + 1}</td>
      <td style="text-align:left;">${it.name}</td>
      <td style="text-align:left;">${it.brand}</td>
      <td style="text-align:center;">${it.quantity}</td>
      <td style="text-align:right;">₹ ${it.price.toFixed(2)}</td>
      <td style="text-align:right;">₹ ${it.total.toFixed(2)}</td>
    `;
    printTbody.appendChild(tr);
  });

  // Calculate totals
  const subTotal = orderItems.reduce((a, b) => a + b.total, 0);
  const cgst = subTotal * 0.025;
  const sgst = subTotal * 0.025;
  const finalTotal = subTotal + cgst + sgst;

  document.getElementById('printTotal').innerText = subTotal.toFixed(2);
  document.getElementById('printDate').innerText = new Date().toLocaleString();

  // ✅ Open only the print section in a new window
  const printSection = document.getElementById('printSection').innerHTML;
  const printWindow = window.open('', '', 'width=800,height=600');

  printWindow.document.write(`
    <html>
      <head>
        <title>JR Stationarie's - Bill</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          h2, h3, p {
            text-align: center;
            margin: 5px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 8px;
          }
          th {
            background-color: #6c63ff;
            color: white;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .totals {
            text-align: right;
            margin-top: 20px;
            font-size: 16px;
          }
          .totals p {
            margin: 4px 0;
          }
          .thankyou {
            margin-top: 20px;
            text-align: center;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        ${printSection}

        <div class="totals">
          <p><b>Subtotal:</b> ₹ ${subTotal.toFixed(2)}</p>
          <p><b>CGST (2.5%):</b> ₹ ${cgst.toFixed(2)}</p>
          <p><b>SGST (2.5%):</b> ₹ ${sgst.toFixed(2)}</p>
          <hr>
          <p><b>Final Total:</b> ₹ ${finalTotal.toFixed(2)}</p>
        </div>

        <p class="thankyou">Thank you for shopping with JR Stationarie's!</p>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();

  await saveOrder();
});


// Clear order
document.getElementById('clearOrder').addEventListener('click', ()=>{
  if(!confirm('Clear current order?')) return;
  orderItems = [];
  renderOrderTable();
  document.getElementById('finalTotal').innerText = 0;
});

// =======================
// 📦 ORDERS HISTORY
// =======================

// ORDERS HISTORY
document.addEventListener("DOMContentLoaded", () => {
  renderOrdersHistory();
});

// --- Fetch and render all orders (with optional date filter) ---
// --- Fetch and render all orders (with optional date filter) ---
async function renderOrdersHistory() {
  try {
    const res = await fetch(`${API_URL}/orders`);
    const orders = await res.json();

    // Render the filter UI (already present in HTML but safe to re-render)
    const container = document.querySelector('#ordersHistory');
    container.querySelector('.filter-bar')?.remove?.(); // remove existing filter-bar if injected earlier
    // ensure filter inputs exist in DOM (your HTML already has them, but this keeps behavior consistent)
    // We'll reuse the existing HTML filter inputs (from your cashier.html) if present, otherwise inject minimal UI:
    if (!document.getElementById('fromDate') || !document.getElementById('toDate')) {
      container.insertAdjacentHTML('afterbegin', `
        <div class="filter-bar" style="margin-bottom:12px;">
          <label>From: <input type="date" id="fromDate" /></label>
          <label>To: <input type="date" id="toDate" /></label>
          <button id="filterBtn" class="btn">Filter</button>
          <button id="resetBtn" class="btn">Reset</button>
        </div>
      `);
    }

    const tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) {
      console.error('Orders table tbody not found (#ordersTable tbody).');
      return;
    }

    // Helper to render rows and attach view listeners
    function renderOrdersRows(orderArray) {
      tbody.innerHTML = '';
      orderArray.forEach((o) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        tr.innerHTML = `
          <td style="padding:10px;">#${o.orderNumber}</td>
          <td style="padding:10px;">${new Date(o.date).toLocaleString()}</td>
          <td style="padding:10px; text-align:center;">${Array.isArray(o.items) ? o.items.length : 0}</td>
          <td style="padding:10px; text-align:right;">₹ ${Number(o.total).toFixed(2)}</td>
          <td style="padding:10px; text-align:center;">
            <button class="view-details-btn" data-id="${o.orderNumber}"
              style="background:#6c63ff; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">
              View Details
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Attach view-details listeners (re-query after creating rows)
      document.querySelectorAll('.view-details-btn').forEach(btn => {
        // Overwrite previous handlers by using onclick
        btn.onclick = (e) => {
          const orderId = e.currentTarget.dataset.id;
          const order = orderArray.find(x => String(x.orderNumber) === String(orderId));
          if (!order) return;
          showOrderModal(order);
        };
      });
    }

    // Initially render all orders
    renderOrdersRows(orders);

    // Hook up filter and reset buttons (override previous handlers safely)
    const filterBtn = document.getElementById('filterBtn');
    const resetBtn = document.getElementById('resetBtn');

    if (filterBtn) {
      filterBtn.onclick = () => {
        const fromVal = document.getElementById('fromDate').value;
        const toVal = document.getElementById('toDate').value;
        const fromDate = fromVal ? new Date(fromVal) : null;
        const toDate = toVal ? new Date(toVal) : null;

        const filtered = orders.filter(o => {
          const orderDate = new Date(o.date);
          if (fromDate && isNaN(fromDate) === false && orderDate < fromDate) return false;
          if (toDate && isNaN(toDate) === false && orderDate > toDate) return false;
          return true;
        });
        renderOrdersRows(filtered);
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        const fd = document.getElementById('fromDate');
        const td = document.getElementById('toDate');
        if (fd) fd.value = '';
        if (td) td.value = '';
        renderOrdersRows(orders);
      };
    }

    // Ensure modal close handlers are attached once
    const modal = document.getElementById('orderModal');
    if (modal && !modal.dataset.initialized) {
      const closeEl = modal.querySelector('.close-modal');
      if (closeEl) {
        closeEl.onclick = () => modal.classList.add('hidden');
      }
      modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
      modal.dataset.initialized = '1';
    }

  } catch (e) {
    console.error(e);
  }
}

// --- Show modal with order details ---
function showOrderModal(order) {
  const modal = document.getElementById("orderModal");
  const modalInfo = document.getElementById("modalOrderInfo");
  const tbody = document.querySelector("#orderDetailsTable tbody");

  modalInfo.innerHTML = `
    <strong>Order No:</strong> #${order.orderNumber}<br>
    <strong>Date:</strong> ${new Date(order.date).toLocaleString()}<br>
    <strong>Total Items:</strong> ${order.items.length}<br>
    <strong>Total Amount:</strong> ₹ ${order.total}
  `;

  tbody.innerHTML = order.items.map((itm, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${itm.name}</td>
      <td>${itm.brand}</td>
      <td style="text-align:center;">${itm.quantity}</td>
      <td style="text-align:right;">₹ ${itm.price}</td>
      <td style="text-align:right;">₹ ${itm.total}</td>
    </tr>
  `).join('');

  modal.classList.remove("hidden");
}


// INIT
renderItemsList();
renderOrdersHistory();
