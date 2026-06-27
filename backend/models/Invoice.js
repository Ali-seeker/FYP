const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  invoiceNumber: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  invoice_date: { type: Date, default: Date.now },
  delivery_status: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
  delivery_channel: { type: String, enum: ['whatsapp', 'sms', 'none'], default: 'none' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', InvoiceSchema);
