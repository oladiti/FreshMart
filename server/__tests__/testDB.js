import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongo;
let uri;

export async function startTestDB() {
  mongo = await MongoMemoryServer.create({
    instance: { port: 0, timeout: 60000 },
  });
  uri = mongo.getUri();
  await mongoose.connect(uri);
  return { mongo, uri };
}

export async function stopTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongo) {
    await mongo.stop();
  }
}

export async function clearTestDB() {
  if (mongoose.connection.readyState === 0) return;
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
}
