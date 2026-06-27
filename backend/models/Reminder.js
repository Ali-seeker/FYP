const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true },
  channel: { type: String, enum: ['whatsapp', 'sms'], required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Reminder', ReminderSchema);
