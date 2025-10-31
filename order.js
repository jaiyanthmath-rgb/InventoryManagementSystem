const API_URL = "https://inventorymanagementsystem-o1oy.onrender.com/api";
let items = [];
let selectedItem = null;
let selectedBrand = null;
let orderList = [];

// Fetch items
async function fetchItems() {
    const res = await fetch(`${API_URL}/items`);
    items = await res.json();
}
fetchItems();

// DOM elements
const searchInput = document.getElementById("searchInput");
const suggestions = document.getElementById("suggestions");
const brandButtonsDiv = document.getElementById("brandButtons");
const itemsTableBody = document.querySelector("#itemsTable tbody");
const totalDiv = document.getElementById("totalDiv");
const buyBtn = document.getElementById("buyBtn");
const negotiateBtn = document.getElementById("negotiateBtn");
const negMsg = document.getElementById("negMsg");

// Autocomplete
searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    suggestions.innerHTML = "";
    if (!query) return;
    const filtered = items.filter(i => i.name.toLowerCase().includes(query));
    filtered.forEach(i => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.innerText = i.name;
        div.addEventListener("click", () => {
            selectedItem = i;
            searchInput.value = i.name;
            suggestions.innerHTML = "";
            showBrands(i);
        });
        suggestions.appendChild(div);
    });
});

// Show brands
function showBrands(item) {
  brandButtonsDiv.innerHTML = "";
  selectedBrand = null;

  Object.keys(item.quantity).forEach(brand => {
    const btn = document.createElement("button");
    btn.className = "brand-btn";
    btn.innerText = brand;

    btn.addEventListener("click", async () => {
      selectedBrand = brand;
      const qty = prompt(`Enter number of bundles for ${item.name} (${brand}):`);
      if (qty && !isNaN(qty)) {
        const requestedQty = Number(qty);

        try {
          const res = await fetch(`${API_URL}/checkStock`, {
            method: "POST", // ✅ POST since you’re sending data
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemName: item.name,
              brand: selectedBrand,
              quantity: requestedQty
            })
          });

          const data = await res.json();

          if (data.success) {
            alert("✅ Stock available! Item added successfully.");
            addItemToTable(item, selectedBrand, requestedQty);
          } else {
            let msg = "❌ Insufficient stock for this brand.";
            if (data.alternatives?.length > 0) {
              msg += `\nTry other brands: ${data.alternatives.join(", ")}`;
            }
            alert(msg);
          }
        } catch (error) {
          console.error("Error checking stock:", error);
          alert("Server error. Please try again later.");
        }

        // Reset UI
        selectedItem = null;
        selectedBrand = null;
        brandButtonsDiv.innerHTML = "";
        searchInput.value = "";
      }
    });

    brandButtonsDiv.appendChild(btn);
  });
}

// Add item to table
function addItemToTable(item, brand, bundles) {
    const bundleSize = item.bundle || 10;
    const singleBundlePrice = item.price[brand] * bundleSize;
    let discounted = false;
    let finalBundlePrice = singleBundlePrice;
    if (bundles >= 10) {
        discounted = true;
        finalBundlePrice = singleBundlePrice * 0.9;
    }
    const totalPrice = finalBundlePrice * bundles;
    const orderItem = {
        name: item.name,
        brand,
        quantity: bundles * bundleSize,
        bundlePrice: singleBundlePrice,
        finalBundlePrice,
        bundles,
        totalPrice,
        bundleSize,
        discounted
    };
    orderList.push(orderItem);

    const tr = document.createElement("tr");
    let priceHTML = discounted
        ? `<span class="strike">₹${singleBundlePrice.toFixed(2)}</span> <span class="discounted-price">₹${finalBundlePrice.toFixed(2)}</span>`
        : `₹${singleBundlePrice.toFixed(2)}`;

    tr.innerHTML = `
        <td>${orderItem.name}</td>
        <td>${orderItem.brand}</td>
        <td>${priceHTML} / ${bundleSize} pcs</td>
        <td style="display:flex; align-items:center; gap:5px;">
            <button class="dec-btn">-</button>
            <input type="number" class="qty-input" value="${bundles}" min="1"/>
            <button class="inc-btn">+</button>
        </td>
        <td>₹${totalPrice.toFixed(2)}</td>
    `;
    itemsTableBody.appendChild(tr);

    const qtyInput = tr.querySelector(".qty-input");
    const incBtn = tr.querySelector(".inc-btn");
    const decBtn = tr.querySelector(".dec-btn");

    function updateQty(newQty) {
        if (newQty < 1) newQty = 1;
        orderItem.bundles = newQty;
        orderItem.discounted = newQty >= 10;
        orderItem.finalBundlePrice = orderItem.discounted
            ? orderItem.bundlePrice * 0.9
            : orderItem.bundlePrice;
        orderItem.totalPrice = orderItem.finalBundlePrice * newQty;
        tr.cells[2].innerHTML = orderItem.discounted
            ? `<span class="strike">₹${orderItem.bundlePrice.toFixed(2)}</span> <span class="discounted-price">₹${orderItem.finalBundlePrice.toFixed(2)}</span> / ${bundleSize} pcs`
            : `₹${orderItem.bundlePrice.toFixed(2)} / ${bundleSize} pcs`;
        tr.cells[4].innerText = `₹${orderItem.totalPrice.toFixed(2)}`;
        qtyInput.value = newQty;
        updateTotal();
    }

    qtyInput.addEventListener("change", () => updateQty(Number(qtyInput.value)));
    incBtn.addEventListener("click", () => updateQty(orderItem.bundles + 1));
    decBtn.addEventListener("click", () => updateQty(orderItem.bundles - 1));
    updateTotal();
}

// Update total
function updateTotal() {
    const total = orderList.reduce((sum, i) => sum + i.totalPrice, 0);
    totalDiv.innerText = `Total: ₹${total.toFixed(2)}`;
}

// ✅ Fixed Buy button (was using non-existent cartItems)
buyBtn.addEventListener("click", () => {
    if (!orderList || orderList.length === 0) {
        alert("Your cart is empty!");
        return;
    }

    const totalPrice = orderList.reduce((sum, i) => sum + i.totalPrice, 0);

    const orderData = {
        items: orderList,
        total: totalPrice
    };

    // Save to localStorage for payment page
    localStorage.setItem("orderData", JSON.stringify({ items: orderList }));
    window.location.href = "payment.html";
});

// Negotiate
negotiateBtn.addEventListener("click", async () => {
    const amount = prompt("Enter your requested total amount:");
    if (!amount) return;
    const user = JSON.parse(localStorage.getItem("jr_user"));
    if (!user) {
        alert("Please login first");
        return;
    }
    try {
        await fetch(`${API_URL}/negotiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                customer: user,
                items: orderList,
                originalTotal: orderList.reduce((a, b) => a + b.totalPrice, 0),
                negotiatedTotal: Number(amount)
            })
        });
        negMsg.innerHTML = `We received your request and will reach you shortly. Please check the website repeatedly and stay tuned.<br><button class="backBtn" onclick="window.location.href='online.html'">Back to Home</button>`;
        negMsg.style.display = "block";
    } catch (err) {
        console.error(err);
    }
});
