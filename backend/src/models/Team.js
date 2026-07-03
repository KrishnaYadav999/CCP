const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true, default: '' },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  operationHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  crmTeamId: { type: String, unique: true, sparse: true, trim: true },
  ccpTeamId: { type: String, unique: true, sparse: true, trim: true },
  source: { type: String, trim: true, default: 'ccp' }
}, { timestamps: true });

module.exports = mongoose.model('Team', TeamSchema);
