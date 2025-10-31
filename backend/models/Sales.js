// models/sales.js
const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema({
  item_id: { type: String, required: true },
  item_name: { type: String, required: true },
  brand: { type: String },
  category: { type: String },
  quantity_sold: { type: Number, required: true },
  price_per_unit: { type: Number, required: true },
  total_price: { type: Number, required: true },
  channel: { type: String, enum: ['offline', 'online'], required: true },
  buyer_name: { type: String },
  buyer_email: { type: String },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Sale", saleSchema);
