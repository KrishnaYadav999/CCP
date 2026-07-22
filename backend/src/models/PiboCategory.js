const mongoose = require('mongoose');

const PiboCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  parent: { type: String, enum: ['PIBO', 'SIMP', 'PWP'], required: true, default: 'PIBO' },
  normalizedName: { type: String, required: true, unique: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('PiboCategory', PiboCategorySchema);
