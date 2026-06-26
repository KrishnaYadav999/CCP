const mongoose = require('mongoose');

let connectionPromise = null;

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    if (connectionPromise) return connectionPromise;

    const dbName = process.env.DB_NAME || 'ccp';
    const provider = String(process.env.MONGO_PROVIDER || 'local').toLowerCase();
    const localUri = process.env.MONGO_LOCAL_URI || `mongodb://127.0.0.1:27017/${dbName}`;
    const atlasUri = process.env.MONGO_ATLAS_URI;
    const uri = process.env.MONGO_URI || (provider === 'atlas' ? atlasUri : localUri);

    if (!uri) {
      throw new Error('MongoDB URI is missing. Set MONGO_URI or configure MONGO_PROVIDER with MONGO_LOCAL_URI/MONGO_ATLAS_URI.');
    }

    const serverSelectionTimeoutMS = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000;

    connectionPromise = mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS
    });
    await connectionPromise;
    console.log(`MongoDB connected: ${dbName} (${provider})`);
    return mongoose.connection;
  } catch (err) {
    connectionPromise = null;
    console.error('MongoDB connection error', err);
    if (process.env.VERCEL) throw err;
    process.exit(1);
  }
};

module.exports = connectDB;
