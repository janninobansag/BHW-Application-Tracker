import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function db(): D1Database {
  if (!env.DB) throw new Error("D1 database is unavailable");
  return env.DB;
}

let purokSchemaReady: Promise<void> | undefined;

export function ensurePurokSchema(): Promise<void> {
  if (!purokSchemaReady) {
    purokSchemaReady = (async () => {
      const database = db();
      await database.prepare(`CREATE TABLE IF NOT EXISTS puroks (
        id TEXT PRIMARY KEY NOT NULL,
        barangay_id TEXT NOT NULL REFERENCES barangays(id),
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (barangay_id, name)
      )`).run();
      await database.prepare(`CREATE TABLE IF NOT EXISTS purok_assignments (
        user_id TEXT NOT NULL REFERENCES users(id),
        purok_id TEXT NOT NULL REFERENCES puroks(id),
        PRIMARY KEY (user_id, purok_id)
      )`).run();
      try {
        await database.prepare("ALTER TABLE children ADD COLUMN purok_id TEXT REFERENCES puroks(id)").run();
      } catch (error) {
        if (!(error instanceof Error) || !error.message.toLowerCase().includes("duplicate column")) throw error;
      }
      await database.prepare(`INSERT OR IGNORE INTO puroks (id, barangay_id, name, created_at)
        SELECT 'unspecified-' || b.id, b.id,
          CASE WHEN lower(b.name) = 'tulay' THEN 'Hermit Crab' ELSE 'Purok not specified' END,
          b.created_at FROM barangays b
        WHERE NOT EXISTS (SELECT 1 FROM puroks p WHERE p.barangay_id = b.id)`).run();
      await database.prepare(`UPDATE children SET purok_id = (
        SELECT p.id FROM puroks p WHERE p.barangay_id = children.barangay_id
        ORDER BY p.created_at, p.name LIMIT 1
      ) WHERE purok_id IS NULL`).run();
      await database.prepare(`INSERT OR IGNORE INTO purok_assignments (user_id, purok_id)
        SELECT a.user_id, p.id FROM assignments a JOIN puroks p ON p.barangay_id = a.barangay_id`).run();
    })().catch((error) => {
      purokSchemaReady = undefined;
      throw error;
    });
  }
  return purokSchemaReady;
}

export function getDb() {
  return drizzle(db(), { schema });
}
