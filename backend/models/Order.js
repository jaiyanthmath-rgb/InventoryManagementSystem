const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    orderNumber: { type: Number, required: true, unique: true },
    items: [
        {
            name: String,
            brand: String,
            quantity: Number,
            price: Number,
            total: Number
        }
    ],
    total: Number,
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
