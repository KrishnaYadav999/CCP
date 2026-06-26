require('dotenv').config();
const mongoose = require('mongoose');

const dbName = process.env.DB_NAME || 'ccp';
const localUri = process.env.MONGO_LOCAL_URI || `mongodb://127.0.0.1:27017/${dbName}`;
const atlasUri = process.env.MONGO_ATLAS_URI || process.env.MONGO_URI;
const dropAtlas = process.env.MIGRATION_DROP_ATLAS === 'true';
const batchSize = Number(process.env.MIGRATION_BATCH_SIZE) || 500;

if (!atlasUri) {
  console.error('MONGO_ATLAS_URI is required to migrate data to Atlas.');
  process.exit(1);
}

async function copyCollection(sourceDb, targetDb, collectionName) {
  const source = sourceDb.collection(collectionName);
  const target = targetDb.collection(collectionName);
  const total = await source.countDocuments();
  let copied = 0;
  let skipped = 0;
  let batch = [];

  if (dropAtlas) {
    await target.deleteMany({});
  }

  const cursor = source.find({});
  while (await cursor.hasNext()) {
    batch.push(await cursor.next());

    if (batch.length >= batchSize) {
      const result = await insertBatch(target, batch);
      copied += result.copied;
      skipped += result.skipped;
      batch = [];
    }
  }

  if (batch.length) {
    const result = await insertBatch(target, batch);
    copied += result.copied;
    skipped += result.skipped;
  }

  console.log(`${collectionName}: ${copied} copied, ${skipped} skipped, ${total} local`);
}

async function insertBatch(target, docs) {
  if (!docs.length) return { copied: 0, skipped: 0 };

  try {
    const result = await target.insertMany(docs, { ordered: false });
    return { copied: Object.keys(result.insertedIds || {}).length, skipped: 0 };
  } catch (err) {
    if (err.code !== 11000 && err.name !== 'MongoBulkWriteError') throw err;

    const inserted = err.result?.insertedCount || err.insertedDocs?.length || 0;
    return { copied: inserted, skipped: docs.length - inserted };
  }
}

async function run() {
  const local = await mongoose.createConnection(localUri, { dbName, serverSelectionTimeoutMS: 10000 }).asPromise();
  const atlas = await mongoose.createConnection(atlasUri, { dbName, serverSelectionTimeoutMS: 20000 }).asPromise();

  try {
    const collections = await local.db.listCollections().toArray();
    if (!collections.length) {
      console.log(`No collections found in local database "${dbName}".`);
      return;
    }

    for (const collection of collections) {
      await copyCollection(local.db, atlas.db, collection.name);
    }

    console.log(`Migration complete: local "${dbName}" -> Atlas "${dbName}".`);
  } finally {
    await local.close();
    await atlas.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
