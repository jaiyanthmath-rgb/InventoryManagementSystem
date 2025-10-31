const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  item_id: String,
  name: String,
  category: String,
  brands: [String],
  quantity: mongoose.Schema.Types.Mixed,  // { brand: quantity }
  price: mongoose.Schema.Types.Mixed,     // { brand: price }

  // 🔹 Stock ratio - determines online/offline stock split
  stock_ratio: { type: Number, default: 0.8 }, // 80% online by default

  limits: [
    {
      brand: String,
      online_limit: { type: Number, default: 50 },
      offline_limit: { type: Number, default: 10 }
    }
  ],

  // 🔹 New Fields for better stock tracking
  online_stock: mongoose.Schema.Types.Mixed,   // { brand: number }
  offline_stock: mongoose.Schema.Types.Mixed   // { brand: number }
});

// 🧠 Automatically compute online/offline stock if missing
// 🧠 Automatically compute or update online/offline stock
itemSchema.pre('save', function (next) {
  if (this.quantity) {
    this.online_stock = this.online_stock || {};
    this.offline_stock = this.offline_stock || {};

    for (const brand of this.brands || []) {
      const qty = this.quantity[brand] || 0;
      const ratio = this.stock_ratio ?? 0.8;

      // ✅ Always recalculate (not only when undefined)
      this.online_stock[brand] = Math.round(qty * ratio);
      this.offline_stock[brand] = qty - this.online_stock[brand];
    }
  }
  next();
});
module.exports = mongoose.model('Item', itemSchema);
