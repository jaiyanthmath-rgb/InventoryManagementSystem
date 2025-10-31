const mongoose = require('mongoose');

const negotiationSchema = new mongoose.Schema({
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: 'N/A' }
  },
  items: [
    {
      name: { type: String, required: true },
      brand: { type: String },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }
    }
  ],
  originalTotal: { type: Number, required: true },
  negotiatedTotal: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Waiting', 'Accepted', 'Rejected'],
    default: 'Waiting'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Negotiation', negotiationSchema);
