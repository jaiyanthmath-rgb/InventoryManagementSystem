// backend/models/Notification.js
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  title: String,
  message: String,
  type: { type: String, default: "info" },
  item_name: String,
  brand: String,
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

module.exports = mongoose.model("Notification", NotificationSchema);
