const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const dbName = process.env.DB_NAME || 'ccp';
    const provider = String(process.env.MONGO_PROVIDER || 'local').toLowerCase();
    const localUri = process.env.MONGO_LOCAL_URI || `mongodb://127.0.0.1:27017/${dbName}`;
    const atlasUri = process.env.MONGO_ATLAS_URI;
    const uri = process.env.MONGO_URI || (provider === 'atlas' ? atlasUri : localUri);

    if (!uri) {
      throw new Error('MongoDB URI is missing. Set MONGO_URI or configure MONGO_PROVIDER with MONGO_LOCAL_URI/MONGO_ATLAS_URI.');
    }

    await mongoose.connect(uri, { dbName });
    console.log(`MongoDB connected: ${dbName} (${provider})`);
  } catch (err) {
    console.error('MongoDB connection error', err);
    process.exit(1);
  }
};

module.exports = connectDB;
