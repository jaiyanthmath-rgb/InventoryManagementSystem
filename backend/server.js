require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Notification = require('./models/Notification');

// Models
const Item = require('./models/Items');
const User = require('./models/User');
const Order = require('./models/Order');
const OnlineOrder = require('./models/OnlineOrder');
const Sale = require('./models/Sales');   

const app = express();
app.use(express.json());
app.use(cors());

// Nodemailer transporter (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.OWNER_EMAIL,
    pass: process.env.OWNER_EMAIL_PASS
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// ===================== ITEMS ROUTES =====================
// ✅ Get all items
// ✅ GET all items
function recalcStocks(item) {
  if (!item.quantity || !item.brands) return item;
  const ratio = typeof item.stock_ratio === "number" ? item.stock_ratio : 0.8;
  const online_stock = {};
  const offline_stock = {};

  for (const brand of item.brands) {
    const qty = Number(item.quantity?.[brand]) || 0;
    const onlineQty = Math.floor(qty * ratio);
    const offlineQty = qty - onlineQty;

    online_stock[brand] = onlineQty;
    offline_stock[brand] = offlineQty;
  }

  item.online_stock = online_stock;
  item.offline_stock = offline_stock;
  return item;
}

/* --------------------------------------------------------------------------
   ✅ ROUTES
   -------------------------------------------------------------------------- */

// GET all items
app.get("/api/items", async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADD new item
app.post("/api/items", async (req, res) => {
  try {
    const newItem = new Item(req.body);
    recalcStocks(newItem);
    await newItem.save();
    res.status(201).json({ message: "Item added successfully", item: newItem });
  } catch (err) {
    res.status(500).json({ message: "Error adding item", error: err.message });
  }
});

// UPDATE existing item
app.put("/api/items/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (req.body.name) item.name = req.body.name;
    if (req.body.category) item.category = req.body.category;

    if (req.body.price) {
      const [brand, value] = Object.entries(req.body.price)[0];
      item.price = { ...item.price, [brand]: value };
    }

    if (req.body.quantity) {
      const [brand, value] = Object.entries(req.body.quantity)[0];
      item.quantity = { ...item.quantity, [brand]: value };
    }

    recalcStocks(item);
    await item.save();
    res.json({ message: "Item updated successfully", item });
  } catch (err) {
    res.status(500).json({ message: "Error updating item", error: err.message });
  }
});

// ADD brand
app.put("/api/items/:id/add-brand", async (req, res) => {
  try {
    const { brand, price, stock } = req.body;
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (!item.brands.includes(brand)) item.brands.push(brand);
    item.price = { ...item.price, [brand]: price };
    item.quantity = { ...item.quantity, [brand]: stock };

    recalcStocks(item);
    await item.save();
    res.json({ message: "Brand added successfully", item });
  } catch (err) {
    res.status(500).json({ message: "Error adding brand", error: err.message });
  }
});

// DELETE brand
app.put("/api/items/:id/delete-brand", async (req, res) => {
  try {
    const { brand } = req.body;
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.brands = item.brands.filter(b => b !== brand);
    delete item.price[brand];
    delete item.quantity[brand];
    delete item.online_stock[brand];
    delete item.offline_stock[brand];

    await item.save();
    res.json({ message: "Brand deleted successfully", item });
  } catch (err) {
    res.status(500).json({ message: "Error deleting brand", error: err.message });
  }
});

// DELETE item
app.delete("/api/items/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting item", error: err.message });
  }
});

/* --------------------------------------------------------------------------
   ✅ NEW ROUTES — FIXED ONLINE/OFFLINE RE-CALCULATION
   -------------------------------------------------------------------------- */

// 1️⃣ Edit stock
app.put("/api/items/:id/edit-stock", async (req, res) => {
  try {
    const { brand, newStock } = req.body;
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.quantity[brand] = Number(newStock);
    recalcStocks(item);

    await item.save();
    res.json({ message: "Stock updated successfully", item });
  } catch (err) {
    res.status(500).json({ message: "Error editing stock", error: err.message });
  }
});

// 2️⃣ Edit stock ratio
app.put("/api/items/:id/edit-stock-ratio", async (req, res) => {
  try {
    const { newRatio } = req.body;
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.stock_ratio = Number(newRatio);
    recalcStocks(item);

    await item.save();
    res.json({ message: "Stock ratio updated successfully", item });
  } catch (err) {
    res.status(500).json({ message: "Error updating stock ratio", error: err.message });
  }
});

// 3️⃣ Set brand limits
// --- Edit Online Limit ---
app.put("/api/items/:id/edit-online-limit", async (req, res) => {
  try {
    const { brand, newLimit } = req.body;
    if (!brand) return res.status(400).json({ message: "Brand is required" });

    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (!Array.isArray(item.limits)) item.limits = [];

    // find brand entry or create a new one
    let limitEntry = item.limits.find(l => l.brand === brand);
    if (limitEntry) {
      limitEntry.online_limit = Number(newLimit);
    } else {
      item.limits.push({
        brand,
        online_limit: Number(newLimit),
        offline_limit: 10 // default offline limit if not provided
      });
    }

    await item.save();
    res.json({ message: `Online limit updated for ${brand}`, limits: item.limits });
  } catch (err) {
    console.error("❌ Error updating online limit:", err);
    res.status(500).json({ message: "Error updating online limit", error: err.message });
  }
});


// --- Edit Offline Limit ---
app.put("/api/items/:id/edit-offline-limit", async (req, res) => {
  try {
    const { brand, newLimit } = req.body;
    if (!brand) return res.status(400).json({ message: "Brand is required" });

    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    if (!Array.isArray(item.limits)) item.limits = [];

    // find brand entry or create new one
    let limitEntry = item.limits.find(l => l.brand === brand);
    if (limitEntry) {
      limitEntry.offline_limit = Number(newLimit);
    } else {
      item.limits.push({
        brand,
        online_limit: 50, // default online limit if not provided
        offline_limit: Number(newLimit)
      });
    }

    await item.save();
    res.json({ message: `Offline limit updated for ${brand}`, limits: item.limits });
  } catch (err) {
    console.error("❌ Error updating offline limit:", err);
    res.status(500).json({ message: "Error updating offline limit", error: err.message });
  }
});


module.exports = app;


// ===================== ORDERS ROUTES =====================

// Save a new offline order
app.post('/api/orders', async (req, res) => {
  try {
    const { items, total, buyer_name, buyer_email } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' });
    }

    // ✅ Auto-generate next order number
    const lastOrder = await Order.findOne().sort({ orderNumber: -1 }).lean();
    const nextOrderNumber = lastOrder ? lastOrder.orderNumber + 1 : 1;

    // ✅ Save order first with unique orderNumber
    const order = new Order({
      orderNumber: nextOrderNumber,
      items,
      total,
      date: new Date(),
    });
    await order.save();

    const salesRecords = [];
    const stockUpdates = [];

    // ✅ Configure email transporter once
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.OWNER_EMAIL,
        pass: process.env.OWNER_EMAIL_PASS,
      },
    });

    for (const it of items) {
      const name = it.name || it.itemName || it.item_name;
      const brand = (it.brand || '').trim();
      const quantitySold = Number(it.quantity ?? it.qty ?? it.bundles ?? 0);

      if (!name || !brand) continue;
      if (!Number.isFinite(quantitySold) || quantitySold <= 0) continue;

      const itemDoc = await Item.findOne({ name: name });
      if (!itemDoc) continue;

      const unitPrice = Number(
        itemDoc.price?.[brand] ?? it.price ?? it.price_per_unit ?? 0
      );

      // ✅ Add sales record
      salesRecords.push({
        item_id: itemDoc.item_id || itemDoc._id.toString(),
        item_name: name,
        brand,
        category: itemDoc.category,
        quantity_sold: quantitySold,
        price_per_unit: unitPrice,
        total_price: quantitySold * unitPrice,
        channel: buyer_email ? 'online' : 'offline',
        buyer_name: buyer_name || 'N/A',
        buyer_email: buyer_email || 'N/A',
        date: new Date(),
      });

      // ✅ Update stock
      const qtyKey = `quantity.${brand}`;
      const onlineKey = `online_stock.${brand}`;
      const offlineKey = `offline_stock.${brand}`;

      const updated = await Item.findByIdAndUpdate(
        itemDoc._id,
        { $inc: { [qtyKey]: -quantitySold } },
        { new: true, useFindAndModify: false }
      );

      if (!updated) continue;

      // ✅ Adjust online/offline stock
      if (buyer_email) {
        await Item.findByIdAndUpdate(itemDoc._id, {
          $inc: { [onlineKey]: -quantitySold },
        });
      } else {
        await Item.findByIdAndUpdate(itemDoc._id, {
          $inc: { [offlineKey]: -quantitySold },
        });
      }

      // ✅ Re-fetch item for latest values
      const refreshed = await Item.findById(itemDoc._id);

      // Clamp negative stock
      const newQty = Number(refreshed.quantity?.[brand] ?? 0);
      if (newQty < 0) {
        await Item.findByIdAndUpdate(itemDoc._id, { $set: { [qtyKey]: 0 } });
      }

      // ✅ Check stock limits
      const brandLimit = refreshed.limits.find((l) => l.brand === brand);
      if (brandLimit) {
        const offlineStock = refreshed.offline_stock?.[brand] ?? 0;
        const onlineStock = refreshed.online_stock?.[brand] ?? 0;

        // Compare with limits
        if (offlineStock < brandLimit.offline_limit) {
          const subject = `⚠️ Low Offline Stock Alert for ${name} (${brand})`;
          const body = `
            <h3>Low Offline Stock Alert</h3>
            <p>Item: <b>${name}</b></p>
            <p>Brand: <b>${brand}</b></p>
            <p>Current Offline Stock: <b>${offlineStock}</b></p>
            <p>Offline Limit: <b>${brandLimit.offline_limit}</b></p>
            <p>Please restock soon.</p>
          `;

          try {
            await transporter.sendMail({
              from: process.env.OWNER_EMAIL,
              to: process.env.OWNER_EMAIL,
              subject,
              html: body,
            });
            console.log(`📩 Offline stock alert sent for ${name} (${brand})`);
          } catch (err) {
            console.error('❌ Failed to send offline stock alert:', err);
          }
        }

        if (onlineStock < brandLimit.online_limit) {
          const subject = `⚠️ Low Online Stock Alert for ${name} (${brand})`;
          const body = `
            <h3>Low Online Stock Alert</h3>
            <p>Item: <b>${name}</b></p>
            <p>Brand: <b>${brand}</b></p>
            <p>Current Online Stock: <b>${onlineStock}</b></p>
            <p>Online Limit: <b>${brandLimit.online_limit}</b></p>
            <p>Please restock soon.</p>
          `;

          try {
            await transporter.sendMail({
              from: process.env.OWNER_EMAIL,
              to: process.env.OWNER_EMAIL,
              subject,
              html: body,
            });
            console.log(`📩 Online stock alert sent for ${name} (${brand})`);
          } catch (err) {
            console.error('❌ Failed to send online stock alert:', err);
          }
        }
      }

      stockUpdates.push({ name, brand, decreasedBy: quantitySold });
    }

    // ✅ Insert sales records
    if (salesRecords.length) {
      await Sale.insertMany(salesRecords);
    }

    console.log('✅ Order and sales saved successfully.');
    return res.json({
      message: 'Order + sales saved successfully',
      orderId: order._id,
      orderNumber: nextOrderNumber,
      salesCount: salesRecords.length,
      stockUpdates,
    });
  } catch (err) {
    console.error('❌ Order Save Error:', err);
    return res.status(500).json({
      message: 'Error saving order',
      error: err.message,
      stack: err.stack,
    });
  }
});


// ✅ Get all online orders
app.get('/api/orders/online', async (req, res) => {
  try {
    const onlineOrders = await OnlineOrder.find().sort({ orderDate: -1 });
    res.json(onlineOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching online orders' });
  }
});

// (Keep the general route if needed)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderNumber: 1 });
    res.json(orders);
  } catch (err) {
    res.status(500).send(err);
  }
});

// ===================== AUTH ROUTES =====================

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;
    if (!name || !email || !password || !confirmPassword)
      return res.status(400).json({ error: 'Please fill all fields' });

    if (password !== confirmPassword)
      return res.status(400).json({ error: 'Passwords do not match' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, phone, passwordHash });
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Please provide email and password' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

const Negotiation = require('./models/Negotiations');

// ===================== NEGOTIATION =====================
app.post('/api/negotiate', async (req, res) => {
  try {
    const { customer, items, originalTotal, negotiatedTotal } = req.body;

    await Negotiation.create({
      customer,
      items: items.map(i => ({
        name: i.name,
        brand: i.brand,
        quantity: i.quantity || i.bundles || 0,
        price: i.totalPrice / (i.quantity || i.bundles || 1)
      })),
      originalTotal,
      negotiatedTotal
    });

    await transporter.sendMail({
      from: `"${customer.name}" <${process.env.OWNER_EMAIL}>`,
      replyTo: customer.email,
      to: process.env.OWNER_EMAIL,
      subject: `Negotiation Request from ${customer.name}`,
      html: `
        <h3>Negotiation Request</h3>
        <p><b>Name:</b> ${customer.name}</p>
        <p><b>Email:</b> ${customer.email}</p>
        <p><b>Phone:</b> ${customer.phone || 'N/A'}</p>
        <p><b>Original Total:</b> ₹${originalTotal}</p>
        <p><b>Requested Total:</b> ₹${negotiatedTotal}</p>
        <p><b>Items:</b> ${items.map(i => `${i.name} (${i.brand}) x ${i.quantity || i.bundles}`).join(', ')}</p>
        <p>Reply to this email to contact the customer.</p>
      `
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error saving negotiation or sending email' });
  }
});

// ===================== GET ALL NEGOTIATIONS (OWNER VIEW) =====================
app.get('/api/negotiations', async (req, res) => {
  try {
    const negotiations = await Negotiation.find().sort({ createdAt: -1 });
    res.json(negotiations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching negotiations' });
  }
});

// ===================== UPDATE NEGOTIATION STATUS (ACCEPT/REJECT) =====================
app.put('/api/negotiations/:id', async (req, res) => {
  try {
    const { accept } = req.body;
    const status = accept ? 'Accepted' : 'Rejected';
    const negotiation = await Negotiation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!negotiation) return res.status(404).json({ error: 'Negotiation not found' });

    res.json({ success: true, negotiation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating negotiation status' });
  }
});

// ✅ Fetch all negotiations for a specific user (for notifications)
app.get('/api/user-negotiations/:email', async (req, res) => {
  try {
    const email = req.params.email;

    // Find all negotiations linked to this user's email, sorted newest first
    const negotiations = await Negotiation.find({ 'customer.email': email })
      .sort({ createdAt: -1 });

    if (!negotiations || negotiations.length === 0) {
      return res.json([]); // return empty array if no records found
    }

    // Return all negotiations (Accepted, Rejected, Waiting)
    res.json(negotiations);

  } catch (err) {
    console.error("❌ Error fetching user negotiations:", err);
    res.status(500).json({ error: 'Failed to fetch user negotiations' });
  }
});

// ===================== ONLINE ORDERS =====================

// Save a new online order
app.post('/api/online-orders', async (req, res) => {
  try {
    const { name, address, items, subtotal, delivery, tax, total } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Cart is empty' });

    // 1️⃣ Save the order (subtotal already reflects negotiation if applicable)
    const newOrder = new OnlineOrder({
      name: name || 'Anonymous',
      address: address || 'N/A',
      items: items.map(it => ({
        itemName: it.itemName || it.name || 'Unnamed Item',
        brand: it.brand || 'N/A',
        quantity: Number(it.quantity) || 0,
        bundlePrice: Number(it.bundlePrice) || 0,
        totalPrice: Number(it.totalPrice) || 0
      })),
      subtotal: Number(subtotal) || 0,
      delivery: Number(delivery) || 0,
      tax: Number(tax) || 0,
      total: Number(total) || 0
    });

    await newOrder.save();

    // 2️⃣ Mail transporter (for alerts)
    const ownerEmail = process.env.OWNER_EMAIL;
    const ownerEmailPass = process.env.OWNER_EMAIL_PASS;
    let transporter = null;
    if (ownerEmail && ownerEmailPass) {
      const nodemailer = require("nodemailer");
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: ownerEmail, pass: ownerEmailPass },
      });
    }

    // 3️⃣ Compute negotiation ratio
    let originalTotal = 0;
    const itemDocs = {}; // cache to avoid repeated DB hits

    for (const it of items) {
      const itemName = it.itemName || it.name;
      const brand = it.brand || 'N/A';
      const quantity = Number(it.quantity) || 0;

      const itemDoc = await Item.findOne({ name: itemName });
      if (!itemDoc) continue;
      itemDocs[itemName] = itemDoc;

      const unitPrice = Number(itemDoc.price?.[brand] ?? it.bundlePrice ?? 0);
      originalTotal += unitPrice * quantity;
    }

    const negotiationRatio = originalTotal > 0 ? (Number(subtotal) / originalTotal) : 1;

    // 4️⃣ Prepare sales records and update stock
    const salesRecords = [];

    for (const it of items) {
      const itemName = it.itemName || it.name;
      const brand = (it.brand || '').trim();
      const quantitySold = Number(it.quantity) || 0;

      if (!itemName || !brand || quantitySold <= 0) {
        console.warn('⚠️ Skipping invalid item:', it);
        continue;
      }

      const itemDoc = itemDocs[itemName] || await Item.findOne({ name: itemName });
      if (!itemDoc) {
        console.warn(`⚠️ Item not found in DB: ${itemName}`);
        continue;
      }

      const unitPrice = Number(itemDoc.price?.[brand] ?? it.bundlePrice ?? 0);
      const adjustedUnitPrice = unitPrice * negotiationRatio;
      const adjustedTotal = adjustedUnitPrice * quantitySold;

      salesRecords.push({
        item_id: (itemDoc.item_id || itemDoc._id).toString(),
        item_name: itemName,
        brand: brand,
        category: itemDoc.category || 'Uncategorized',
        quantity_sold: quantitySold,
        price_per_unit: adjustedUnitPrice,
        total_price: adjustedTotal,
        channel: 'online',
        buyer_name: name || 'Anonymous',
        buyer_email: 'N/A',
        date: new Date()
      });

      // 5️⃣ Update stock & online stock
      const qtyKey = `quantity.${brand}`;
      const onlineKey = `online_stock.${brand}`;

      const updated = await Item.findByIdAndUpdate(
        itemDoc._id,
        {
          $inc: {
            [qtyKey]: -quantitySold,
            [onlineKey]: -quantitySold
          }
        },
        { new: true }
      );

      if (updated) {
        const newQty = updated.quantity?.[brand] ?? 0;
        const newOnline = updated.online_stock?.[brand] ?? 0;
        if (newQty < 0) await Item.findByIdAndUpdate(itemDoc._id, { $set: { [qtyKey]: 0 } });
        if (newOnline < 0) await Item.findByIdAndUpdate(itemDoc._id, { $set: { [onlineKey]: 0 } });

        // 🔔 Check for low online stock and send alert
        const refreshed = await Item.findById(itemDoc._id);
        const brandLimit = refreshed.limits?.find(l => l.brand === brand);
        if (brandLimit && refreshed.online_stock?.[brand] < brandLimit.online_limit) {
          const currentOnline = refreshed.online_stock[brand];
          const subject = `⚠️ Low Online Stock for ${itemName} (${brand})`;
          const html = `
            <h3>Low Online Stock Alert</h3>
            <p><b>Item:</b> ${itemName}</p>
            <p><b>Brand:</b> ${brand}</p>
            <p><b>Current Online Stock:</b> ${currentOnline}</p>
            <p><b>Online Limit:</b> ${brandLimit.online_limit}</p>
          `;

          if (transporter) {
            try {
              await transporter.sendMail({
                from: ownerEmail,
                to: ownerEmail,
                subject,
                html,
              });
              console.log(`📩 Low online stock alert sent for ${itemName} (${brand})`);
            } catch (err) {
              console.error('❌ Failed to send online stock alert:', err);
            }
          }
        }
      }
    }

    // 6️⃣ Insert into Sales collection
    if (salesRecords.length > 0) {
      try {
        await Sale.insertMany(salesRecords);
      } catch (err) {
        console.error('⚠️ Failed to insert some sales records:', err.message);
      }
    }

    // 7️⃣ Respond success
    res.status(201).json({
      message: 'Online order saved successfully',
      order: newOrder,
      salesSaved: salesRecords.length,
      negotiationApplied: negotiationRatio !== 1
    });

  } catch (err) {
    console.error('❌ Error saving online order:', err);
    res.status(500).json({ message: 'Error saving order', error: err.message });
  }
});

// Fetch all online orders
app.get('/api/online-orders', async (req, res) => {
  try {
    const orders = await OnlineOrder.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch online orders' });
  }
});

// Fetch all offline orders
app.get('/api/offline-orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offline orders' });
  }
});

// ✅ Dashboard Analytics Route
// =============================
// 📊 Dashboard API
// =============================
// Fetch sales statistics (combined from online + offline)
app.get('/api/sales/dashboard', async (req, res) => {
  try {
    // 1️⃣ Total Revenue
    const totalRevenueAgg = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: "$total_price" } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    // 2️⃣ Top Selling Item (Online)
    const topOnline = await Sale.aggregate([
      { $match: { channel: "online" } },
      { $group: { _id: "$item_name", totalQty: { $sum: "$quantity_sold" } } },
      { $sort: { totalQty: -1 } },
      { $limit: 1 },
    ]);

    // 3️⃣ Top Selling Item (Offline)
    const topOffline = await Sale.aggregate([
      { $match: { channel: "offline" } },
      { $group: { _id: "$item_name", totalQty: { $sum: "$quantity_sold" } } },
      { $sort: { totalQty: -1 } },
      { $limit: 1 },
    ]);

    // 4️⃣ Top Brand (Online)
    const topBrandOnline = await Sale.aggregate([
      { $match: { channel: "online" } },
      { $group: { _id: "$brand", totalQty: { $sum: "$quantity_sold" } } },
      { $sort: { totalQty: -1 } },
      { $limit: 1 },
    ]);

    // 5️⃣ Top Brand (Offline)
    const topBrandOffline = await Sale.aggregate([
      { $match: { channel: "offline" } },
      { $group: { _id: "$brand", totalQty: { $sum: "$quantity_sold" } } },
      { $sort: { totalQty: -1 } },
      { $limit: 1 },
    ]);

    // ✅ Response
    res.json({
      totalRevenue,
      topItemOnline: topOnline[0]?._id || "N/A",
      topBrandOnline: topBrandOnline[0]?._id || "N/A",
      topItemOffline: topOffline[0]?._id || "N/A",
      topBrandOffline: topBrandOffline[0]?._id || "N/A",
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// ===================== NOTIFICATIONS =====================

app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications", error: err.message });
  }
});

app.put("/api/notifications/:id/read", async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Error updating notification" });
  }
});


 // ===================== Sale Analytics =====================
 // ===================== Sale Analytics =====================
 // ===================== Sale Analytics =====================

app.get("/api/sales/analytics", async (req, res) => {
  try {
    // range is number of days (7,30,365)
    const { range = "30", channel } = req.query;
    const days = parseInt(range, 10) || 30;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const match = { date: { $gte: dateFrom } };
    if (channel && channel !== "all") match.channel = channel;

    // KPIs grouped by channel
    const kpi = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$channel",
          totalRevenue: { $sum: "$total_price" },
          totalOrders: { $sum: 1 },
          uniqueBuyers: { $addToSet: "$buyer_email" },
        },
      },
    ]);

    // Daily data for charts
    const data = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: "$date" },
            month: { $month: "$date" },
            year: { $year: "$date" },
            channel: "$channel",
          },
          totalRevenue: { $sum: "$total_price" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Top items (by revenue) limited to 5
    const topItems = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$item_name",
          revenue: { $sum: "$total_price" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    // Top brands (by revenue) limited to 5
    const topBrands = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$brand",
          revenue: { $sum: "$total_price" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    res.json({ kpi, data, topItems, topBrands });
  } catch (err) {
    console.error("analytics error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- New route: Top grouped (items / brands) ---
/*
  Query params:
    type = items | brands
    metric = quantity | revenue
    limit = number (optional)
    range = number of days
    channel = all | online | offline
*/
app.get("/api/sales/top", async (req, res) => {
  try {
    const { type = "items", metric = "quantity", limit = 5, range = "30", channel } = req.query;
    const days = parseInt(range, 10) || 30;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const match = { date: { $gte: dateFrom } };
    if (channel && channel !== "all") match.channel = channel;

    // choose field to group by
    const groupField = type === "brands" ? "$brand" : "$item_name";

    // If metric is quantity -> totalQty = sum(quantity_sold) OR sum(quantity_sold) fallback to sum(quantity) etc.
    const pipeline = [{ $match: match }];

    if (metric === "quantity") {
      pipeline.push({
        $group: {
          _id: groupField,
          totalQty: { $sum: "$quantity_sold" },
          revenue: { $sum: "$total_price" },
        },
      });
      pipeline.push({ $sort: { totalQty: -1 } });
    } else {
      // revenue
      pipeline.push({
        $group: {
          _id: groupField,
          revenue: { $sum: "$total_price" },
          totalQty: { $sum: "$quantity_sold" },
        },
      });
      pipeline.push({ $sort: { revenue: -1 } });
    }

    pipeline.push({ $limit: parseInt(limit, 10) || 5 });

    const results = await Sale.aggregate(pipeline);
    res.json(results);
  } catch (err) {
    console.error("top route error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// --- New route: return ALL grouped records (for View All modal) ---
app.get("/api/sales/top/all", async (req, res) => {
  try {
    const { type = "items", metric = "quantity", range = "365", channel } = req.query;
    const days = parseInt(range, 10) || 365;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const match = { date: { $gte: dateFrom } };
    if (channel && channel !== "all") match.channel = channel;

    const groupField = type === "brands" ? "$brand" : "$item_name";

    // Also include lastSold date and optionally channel in output
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: groupField,
          totalQty: { $sum: "$quantity_sold" },
          revenue: { $sum: "$total_price" },
          lastSold: { $max: "$date" },
          // If you want channel included (not meaningful when grouping by item across channels),
          // we can collect channels into array:
          channels: { $addToSet: "$channel" }
        }
      },
      // Sort according to metric
      { $sort: metric === "quantity" ? { totalQty: -1 } : { revenue: -1 } },
    ];

    const results = await Sale.aggregate(pipeline);
    res.json(results);
  } catch (err) {
    console.error("top all route error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/sales/analytics", async (req, res) => {
  try {
    const { range = "30", channel } = req.query;
    const days = parseInt(range);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const match = { date: { $gte: dateFrom } };
    if (channel && channel !== "all") match.channel = channel;

    const kpi = await Sale.aggregate([
      { $match: match },
      { $group: { _id: "$channel", totalRevenue: { $sum: "$total_price" }, totalOrders: { $sum: 1 } } },
    ]);

    const topItemsByQuantity = await Sale.aggregate([
      { $match: match },
      { $group: { _id: "$item_name", totalQuantity: { $sum: "$quantity_sold" } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    const topBrandsByQuantity = await Sale.aggregate([
      { $match: match },
      { $group: { _id: "$brand", totalQuantity: { $sum: "$quantity_sold" } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    const topItemsByRevenue = await Sale.aggregate([
      { $match: match },
      { $group: { _id: "$item_name", revenue: { $sum: "$total_price" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topBrandsByRevenue = await Sale.aggregate([
      { $match: match },
      { $group: { _id: "$brand", revenue: { $sum: "$total_price" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    res.json({ kpi, topItemsByQuantity, topBrandsByQuantity, topItemsByRevenue, topBrandsByRevenue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// 🔹 Brand comparison route
// ✅ Compare brands for a specific item
app.get('/api/compare/:itemName', async (req, res) => {
  try {
    const itemName = req.params.itemName;

    // Step 1: Find the item document
    const item = await Item.findOne({ name: itemName });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Step 2: Aggregate sales for each brand of that item
    const salesData = await Sale.aggregate([
      { $match: { item_name: itemName } },
      {
        $group: {
          _id: "$brand",
          totalQuantity: { $sum: "$quantity_sold" },
          totalRevenue: { $sum: "$total_price" },
        }
      },
      { $project: { _id: 0, brand: "$_id", totalQuantity: 1, totalRevenue: 1 } }
    ]);

    // Step 3: Include brand list from Items even if no sales yet
    const fullBrandStats = item.brands.map(brand => {
      const found = salesData.find(b => b.brand === brand);
      return {
        brand,
        totalQuantity: found ? found.totalQuantity : 0,
        totalRevenue: found ? found.totalRevenue : 0
      };
    });

    res.json({ itemName, brands: fullBrandStats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching brand comparison data' });
  }
});

app.get('/api/items/names', async (req, res) => {
  try {
    const items = await Item.find({}, 'name');
    res.json(items.map(i => i.name));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching item names' });
  }
});

// 🔹 Check stock availability before confirming order
app.post("/api/checkStock", async (req, res) => {
  try {
    const { itemName, brand, quantity } = req.body;

    if (!itemName || !brand || !quantity) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const item = await Item.findOne({ name: itemName });
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const availableQty = item.online_stock?.[brand] || 0;

    if (availableQty >= (quantity*10)) {
      // ✅ Optionally deduct the quantity here if you want to reserve stock
      item.online_stock[brand] -= quantity;
      await item.save();

      return res.json({ success: true, message: "Stock available and updated" });
    } else {
      // ❌ Suggest other brands
      const alternatives = (item.brands || []).filter(
        b => item.online_stock?.[b] >= quantity
      );
      return res.json({
        success: false,
        message: "Insufficient stock for selected brand",
        alternatives
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===================== SERVER =====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
