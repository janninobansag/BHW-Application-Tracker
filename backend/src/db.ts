import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;
let database: Db | undefined;

export async function getDb(): Promise<Db> {
  if (database) return database;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  client ??= new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  database = client.db(process.env.MONGODB_DATABASE || "bhw");
  await Promise.all([
    database.collection("users").createIndex({ id: 1 }, { unique: true }),
    database.collection("users").createIndex({ username: 1 }, { unique: true }),
    database.collection("barangays").createIndex({ id: 1 }, { unique: true }),
    database.collection("barangays").createIndex({ name: 1 }, { unique: true }),
    database.collection("sitios").createIndex({ id: 1 }, { unique: true }),
    database.collection("sitios").createIndex({ barangay_id: 1, name: 1 }, { unique: true }),
    database.collection("puroks").createIndex({ id: 1 }, { unique: true }),
    database.collection("puroks").createIndex({ barangay_id: 1, name: 1 }, { unique: true }),
    database.collection("children").createIndex({ id: 1 }, { unique: true }),
    database.collection("children").createIndex({ barangay_id: 1, purok_id: 1, name: 1 }),
    database.collection("children").createIndex({ created_by: 1, created_at: -1, id: -1 }),
    database.collection("operation_timbang").createIndex({ id: 1 }, { unique: true }),
    database.collection("operation_timbang").createIndex({ barangay_id: 1, purok_id: 1, name: 1 }),
    database.collection("operation_timbang").createIndex({ created_by: 1, created_at: -1, id: -1 }),
    database.collection("household_profiles").createIndex({ id: 1 }, { unique: true }),
    database.collection("household_profiles").createIndex({ barangayId: 1, purokId: 1, householdNumber: 1 }),
    database.collection("household_profiles").createIndex({ created_by: 1, updated_at: -1 }),
    database.collection("sessions").createIndex({ token_hash: 1 }, { unique: true }),
    database.collection("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    database.collection("assignments").createIndex({ user_id: 1, barangay_id: 1 }, { unique: true }),
    database.collection("purok_assignments").createIndex({ user_id: 1, purok_id: 1 }, { unique: true }),
    database.collection("login_attempts").createIndex({ username: 1 }, { unique: true }),
    database.collection("login_attempts").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    database.collection("security_limits").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    database.collection("notification_reads").createIndex({ user_id: 1, notice_id: 1 }, { unique: true }),
    database.collection("notification_reads").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
  ]);
  return database;
}

export async function closeDb(): Promise<void> {
  if (client) await client.close();
  client = undefined;
  database = undefined;
}
