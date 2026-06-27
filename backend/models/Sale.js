const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  items: [{
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String }, // Cached for offline/reporting purposes
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
    subtotal: { type: Number, required: true }
  }],
  total_amount: { type: Number, required: true },
  sale_date: { type: Date, default: Date.now },
  payment_status: { type: String, enum: ['paid', 'credit', 'partial'], default: 'paid' },
  sync_status: { type: String, enum: ['pending', 'synced', 'conflict'], default: 'synced' }
}, { timestamps: true });

module.exports = mongoose.model('Sale', SaleSchema);
