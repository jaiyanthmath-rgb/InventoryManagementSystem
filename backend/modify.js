// recalc_stock_split.js
require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("🔗 Connected to MongoDB");

    const col = mongoose.connection.collection('items'); // collection name used in your DB
    const cursor = col.find({});
    let updatedCount = 0;
    let processed = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      processed++;

      const docId = doc._id;
      const brands = Array.isArray(doc.brands) ? doc.brands : [];
      const quantity = doc.quantity || {}; // expected: { BrandA: 300, BrandB: 250, ... }
      const ratio = typeof doc.stock_ratio === 'number' ? doc.stock_ratio : (doc.stock_ratio ? Number(doc.stock_ratio) : 0.8);

      const online_stock = {};
      const offline_stock = {};
      let madeChange = false;

      for (const brand of brands) {
        // ensure numbers
        const qtyRaw = quantity?.[brand];
        const qty = Number(qtyRaw) || 0;

        // split per brand (floor online to avoid fractions)
        const onlineQty = Math.floor(qty * ratio);
        const offlineQty = qty - onlineQty; // ensures online + offline == qty

        // if stored values differ, mark to update
        const prevOnline = (doc.online_stock && typeof doc.online_stock[brand] !== 'undefined') ? Number(doc.online_stock[brand]) : undefined;
        const prevOffline = (doc.offline_stock && typeof doc.offline_stock[brand] !== 'undefined') ? Number(doc.offline_stock[brand]) : undefined;

        online_stock[brand] = onlineQty;
        offline_stock[brand] = offlineQty;

        if (prevOnline !== onlineQty || prevOffline !== offlineQty) {
          madeChange = true;
        }
      }

      if (madeChange) {
        await col.updateOne(
          { _id: docId },
          { $set: { online_stock, offline_stock } }
        );
        console.log(`✅ Updated item: ${doc.name || doc.item_id || docId}`);
        updatedCount++;
      } else {
        // optionally log unchanged
        // console.log(`- No change: ${doc.name || doc.item_id || docId}`);
      }
    }

    console.log(`\n🎯 Done. Processed ${processed} items. Updated ${updatedCount} item(s).`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    try { await mongoose.disconnect(); } catch(e) {}
    process.exit(1);
  }
}

run();
