const API_URL = "https://inventorymanagementsystem-o1oy.onrender.com/api"; // your backend URL

// DOM Elements
const loginBtn = document.getElementById("loginBtn");
const orderBtn = document.getElementById("orderBtn");
const userSection = document.getElementById("userSection");

const authModal = document.getElementById("authModal");
const closeModal = document.getElementById("closeModal");
const authTitle = document.getElementById("authTitle");
const toggleAuth = document.getElementById("toggleAuth");
const authSubmit = document.getElementById("authSubmit");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");

const welcomeDiv = document.getElementById("welcomeMsg");
const userDropdown = document.getElementById("userDropdown");
const myAccountBtn = document.getElementById("myAccountBtn");
const notificationsBtn = document.getElementById("notificationsBtn");
const orderHistoryBtn = document.getElementById("orderHistoryBtn");
const logoutBtn = document.getElementById("logoutBtn");

// -------------------- LOAD USER ON PAGE LOAD --------------------
document.addEventListener("DOMContentLoaded", () => {
    currentUser = JSON.parse(localStorage.getItem("jr_user")) || null;
    updateUserUI();
});

// -------------------- AUTH FUNCTIONS --------------------

function showAuthModal(mode) {
    authModal.style.display = "flex";
    if (mode === "login") {
        authTitle.innerText = "Login";
        authSubmit.innerText = "Login";
        confirmPasswordInput.style.display = "none";
        nameInput.style.display = "none";
        phoneInput.style.display = "none";
        toggleAuth.innerText = "Don't have an account? Sign up";
    } else {
        authTitle.innerText = "Signup";
        authSubmit.innerText = "Signup";
        confirmPasswordInput.style.display = "block";
        nameInput.style.display = "block";
        phoneInput.style.display = "block";
        toggleAuth.innerText = "Already have an account? Login";
    }
}

loginBtn?.addEventListener("click", () => { showAuthModal("login"); });
closeModal?.addEventListener("click", () => { authModal.style.display = "none"; });
toggleAuth?.addEventListener("click", () => {
    showAuthModal(authTitle.innerText === "Login" ? "signup" : "login");
});
authSubmit?.addEventListener("click", handleAuthSubmit);
orderBtn?.addEventListener("click", () => {
    if (!currentUser) showAuthModal("login");
    else window.location.href = "order.html";
});

async function handleAuthSubmit() {
    const name = nameInput.value;
    const phone = phoneInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (authTitle.innerText === "Signup") {
        if (password !== confirmPassword) { alert("Passwords do not match!"); return; }
        if (!name || !email || !password) { alert("Please fill all required fields!"); return; }

        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, phone, email, password, confirmPassword })
            });
            const data = await res.json();
            if (data.token) {
                alert("Signup successful! Logged in as " + data.user.name);
                localStorage.setItem("jr_user", JSON.stringify(data.user));
                currentUser = data.user;
                updateUserUI();
                authModal.style.display = "none";
            } else if (data.error) { alert(data.error); } 
            else { alert("Signup failed"); }
        } catch (err) { console.error(err); }
    } else {
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data.token) {
                localStorage.setItem("jr_user", JSON.stringify(data.user));
                currentUser = data.user;
                updateUserUI();
                authModal.style.display = "none";
            } else if (data.error) { alert(data.error); } 
            else { alert("Login failed"); }
        } catch (err) { console.error(err); }
    }
}

// -------------------- USER INTERFACE --------------------

function updateUserUI() {
    if (currentUser) {
        welcomeDiv.innerHTML = `Welcome, ${currentUser.name} <span id="userIcon" class="userIcon">☰</span>`;
        userSection.style.display = "none";

        const userIcon = document.getElementById("userIcon");
        userIcon.addEventListener("click", () => {
            userDropdown.style.display = userDropdown.style.display === "block" ? "none" : "block";
        });
        document.addEventListener("click", (e) => {
            if (!userIcon.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.style.display = "none";
            }
        });

        myAccountBtn?.addEventListener("click", () => {
            alert(`Name: ${currentUser.name}\nEmail: ${currentUser.email}\nPhone: ${currentUser.phone || 'N/A'}`);
        });

        // ✅ FIXED NOTIFICATION MODAL HANDLER
        notificationsBtn?.addEventListener("click", async () => {
            // Create modal if not present
            let modal = document.getElementById("notificationModal");
            if (!modal) {
                modal = document.createElement("div");
                modal.id = "notificationModal";
                modal.style.position = "fixed";
                modal.style.top = "0";
                modal.style.left = "0";
                modal.style.width = "100%";
                modal.style.height = "100%";
                modal.style.background = "rgba(0,0,0,0.5)";
                modal.style.display = "flex";
                modal.style.justifyContent = "center";
                modal.style.alignItems = "center";
                modal.style.zIndex = "1000";

                modal.innerHTML = `
                    <div id="notificationsContainer" style="
                        background:#fff;
                        padding:20px;
                        border-radius:10px;
                        width:500px;
                        max-height:80vh;
                        overflow-y:auto;
                        box-shadow:0 4px 15px rgba(0,0,0,0.3);
                        position:relative;">
                        <button id="closeNotifModal" style="
                            position:absolute;
                            top:10px;
                            right:10px;
                            background:#ff4d4d;
                            color:white;
                            border:none;
                            border-radius:5px;
                            padding:5px 10px;
                            cursor:pointer;">X</button>
                        <div id="notifContent">Loading notifications...</div>
                    </div>
                `;
                document.body.appendChild(modal);
            } else {
                modal.style.display = "flex";
            }

            document.getElementById("closeNotifModal").onclick = () => {
                modal.style.display = "none";
            };

            await loadUserNotifications();
        });

        orderHistoryBtn?.addEventListener("click", () => {
            window.location.href = "order-history.html";
        });

        logoutBtn?.addEventListener("click", () => {
            localStorage.removeItem("jr_user");
            location.reload();
        });

    } else {
        welcomeDiv.innerText = "";
        userSection.style.display = "block";
        userSection.innerHTML = `<button id="loginBtn">Login / Signup</button>`;
        document.getElementById("loginBtn").addEventListener("click", () => { showAuthModal("login"); });
    }
}

// -------------------- NOTIFICATIONS FETCH --------------------
async function loadUserNotifications() {
  const email = currentUser?.email;
  const container = document.getElementById('notifContent');

  if (!email) {
    container.innerHTML = "<p>Please log in to view notifications.</p>";
    return;
  }

  try {
    const res = await fetch(`${API_URL}/user-negotiations/${email}`);
    const negotiations = await res.json();

    if (!negotiations.length) {
      container.innerHTML = "<p>No notifications yet.</p>";
      return;
    }

    let html = "<h3>Your Negotiation Updates</h3><ul style='list-style:none;padding:0;'>";

    negotiations.forEach(n => {
      const color = 
        n.status === 'Accepted' ? 'green' : 
        (n.status === 'Rejected' ? 'red' : 'gray');

      // 🔹 Loop through each negotiated item
      const itemsStr = n.items
        .map(i => `
          <div style="margin:6px 0;padding:6px;border:1px solid #ddd;border-radius:6px;">
            <b>${i.name}</b><br>
            Brand: <b>${i.brand || 'N/A'}</b><br>
            Quantity: <b>${i.quantity}</b><br>
            Price: ₹${i.price?.toFixed(2)}
          </div>
        `)
        .join('');

      html += `
        <li style="margin-bottom:10px;border-bottom:1px solid #ddd;padding-bottom:8px;">
          ${itemsStr}
          <b>Original Total:</b> ₹${n.originalTotal.toFixed(2)}<br>
          <b>Negotiated Total:</b> ₹${n.negotiatedTotal.toFixed(2)}<br>
          <b>Status:</b> <span style="color:${color};">${n.status}</span><br>
          <small>${new Date(n.createdAt).toLocaleString()}</small>
          ${n.status === 'Accepted'
            ? `<br><button class="deliveryBtn" 
                 style="margin-top:8px;padding:6px 12px;border:none;
                 background:#007bff;color:white;border-radius:5px;cursor:pointer;">
                 Enter Delivery Details
               </button>`
            : ''}
        </li>
      `;
    });

    html += "</ul>";
    container.innerHTML = html;

    // 🔹 Add button functionality dynamically
    document.querySelectorAll('.deliveryBtn').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const selectedNegotiation = negotiations[index];

        // ✅ Calculate per-item proportional totals
        const originalTotal = selectedNegotiation.items.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0
        );

        localStorage.setItem('orderData', JSON.stringify({
          items: selectedNegotiation.items.map(i => {
            const itemTotal = ((i.price * i.quantity) / originalTotal) * selectedNegotiation.negotiatedTotal;
            return {
              name: i.name,
              brand: i.brand,
              quantity: i.quantity,
              bundlePrice: i.price * 10,
              totalPrice: parseFloat(itemTotal.toFixed(2))
            };
          }),
          total: selectedNegotiation.negotiatedTotal
        }));

        // ✅ Redirect to payment page
        window.location.href = 'payment.html';
      });
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>Error loading notifications.</p>";
  }
}
