const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  quantity: { type: Number, required: true, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Inventory', InventorySchema);
