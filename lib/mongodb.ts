import { MongoClient, type Db } from "mongodb";

type MongoGlobal = typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as MongoGlobal;

export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;

  if (!uri?.trim()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!globalForMongo.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalForMongo.mongoClientPromise = client.connect().catch((error: unknown) => {
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });
  }

  const databaseName =
    process.env.MONGODB_DB?.trim() || "smart_ewaste_nosql";
  return (await globalForMongo.mongoClientPromise).db(databaseName);
}
