// server/config/db.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { describeDbConnectionError } from "../utils/dbError.js";

dotenv.config();

// Shared connection options. Fail fast enough to surface real problems, but
// tolerate brief network blips and Atlas failovers without a restart. The
// driver reconnects on its own; these bounds keep requests from hanging.
export const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 0,
  retryWrites: true,
  retryReads: true,
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, MONGO_OPTIONS);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${describeDbConnectionError(error)}`);
    process.exit(1);
  }
};

export default connectDB;
