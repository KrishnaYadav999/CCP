const mongoose = require('mongoose');

const ServiceCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  normalizedName: { type: String, required: true, unique: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ServiceCategory', ServiceCategorySchema);
