const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  name: { type: String, required: true },
  name_ur: { type: String }, // Bilingual name in Urdu
  phone: { type: String, required: true, index: true },
  credit_balance: { type: Number, required: true, default: 0 }
}, { timestamps: true });

// Ensure unique phone number per business
CustomerSchema.index({ businessId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Customer', CustomerSchema);
