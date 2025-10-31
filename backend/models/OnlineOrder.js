const mongoose = require('mongoose');

const OnlineOrderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  items: [
    {
      itemName: String,
      brand: String,
      quantity: Number,
      bundlePrice: Number,
      totalPrice: Number
    }
  ],
  subtotal: { type: Number, default: 0 },
  delivery: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  orderDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('OnlineOrder', OnlineOrderSchema);
