import mongoose, { Mongoose } from "mongoose";

/**
 * Cached connection interface to store the Mongoose instance
 * and any in-progress connection promise across module reloads.
 */
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

/**
 * In development, Next.js clears the Node module cache on every hot reload,
 * which would otherwise cause multiple simultaneous Mongoose connections.
 * Attaching the cache to the global object persists it across reloads.
 */
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

// Persist the cache on the global object in development
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Connects to MongoDB using Mongoose and returns the cached connection.
 * Reuses an existing connection or pending promise to avoid opening
 * multiple connections in development (due to hot module replacement).
 */
export async function connectToDatabase(): Promise<Mongoose> {
  // Read and validate at connection time so process.env is fully populated
  // and importing this module never throws (e.g. during builds or tests).
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable in .env.local"
    );
  }

  // Return the existing connection if already established
  if (cached.conn) {
    return cached.conn;
  }

  // Reuse an in-progress connection attempt instead of starting a new one
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false, // Disable command buffering; fail fast if not connected
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset the promise so the next call can retry the connection
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
