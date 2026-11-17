import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function db(): D1Database {
  if (!env.DB) throw new Error("D1 database is unavailable");
  return env.DB;
}

export function getDb() {
  return drizzle(db(), { schema });
}
