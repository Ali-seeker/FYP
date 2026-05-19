const mongoose = require('mongoose');

const BusinessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String }, // e.g., 'retail', 'workshop'
  contactDetails: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Business', BusinessSchema);
