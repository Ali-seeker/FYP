const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  name: { type: String, required: true },
  name_ur: { type: String }, // Bilingual name in Urdu
  unit: { type: String, enum: ['kg', 'piece', 'liter'], default: 'piece' },
  price: { type: Number, required: true },
  stock_qty: { type: Number, required: true, default: 0 },
  low_stock_threshold: { type: Number, required: true, default: 5 },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
