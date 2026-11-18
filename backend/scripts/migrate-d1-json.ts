import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getDb } from "../src/db.js";

const tables = {
  users: ["id", "username", "display_name", "role", "password_hash", "is_active", "must_change_password", "created_at", "updated_at"],
  barangays: ["id", "name", "created_at"],
  puroks: ["id", "barangay_id", "name", "created_at"],
  assignments: ["user_id", "barangay_id"],
  purok_assignments: ["user_id", "purok_id"],
  children: ["id", "name", "birthday", "sex", "parents", "barangay_id", "purok_id", "created_by", "created_at", "updated_at"],
  settings: ["key", "value"],
} as const;

type TableName = keyof typeof tables;
type Row = Record<string, unknown>;
type Snapshot = {
  exportedAt: string;
  source: "cloudflare-d1";
  tables: Record<TableName, Row[]>;
  intentionallyOmitted: ["sessions", "login_attempts"];
};

const exportPath = () => {
  const value = process.env.D1_EXPORT_PATH;
  return resolve(process.cwd(), value || "../outputs/d1-export.json");
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function queryD1(sql: string): Promise<Row[]> {
  const accountId = requiredEnvironment("CLOUDFLARE_ACCOUNT_ID");
  const databaseId = requiredEnvironment("CLOUDFLARE_D1_DATABASE_ID");
  const token = requiredEnvironment("CLOUDFLARE_API_TOKEN");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: Array<{ results?: Row[] }>;
  } | null;
  if (!response.ok || !payload?.success) {
    const detail = payload?.errors?.map((item) => item.message).filter(Boolean).join("; ") || `HTTP ${response.status}`;
    throw new Error(`Cloudflare D1 query failed: ${detail}`);
  }
  return payload.result?.[0]?.results ?? [];
}

async function exportD1(): Promise<void> {
  const data = {} as Record<TableName, Row[]>;
  const pageSize = 500;
  for (const [table, columns] of Object.entries(tables) as Array<[TableName, readonly string[]]>) {
    const rows: Row[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await queryD1(`SELECT ${columns.join(", ")} FROM ${table} LIMIT ${pageSize} OFFSET ${offset}`);
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    data[table] = rows;
    console.log(`Exported ${rows.length} ${table}.`);
  }

  const snapshot: Snapshot = {
    exportedAt: new Date().toISOString(),
    source: "cloudflare-d1",
    tables: data,
    intentionallyOmitted: ["sessions", "login_attempts"],
  };
  const destination = exportPath();
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`Private migration snapshot written to ${destination}. Password hashes are included; keep this file private and delete it after migration.`);
}

function readRows(snapshot: Snapshot, table: TableName): Row[] {
  const rows = snapshot?.tables?.[table];
  if (!Array.isArray(rows)) throw new Error(`The migration snapshot is missing the ${table} table.`);
  return rows;
}

function assertFields(rows: Row[], table: TableName, fields: readonly string[]): void {
  rows.forEach((row, index) => {
    for (const field of fields) {
      if (!(field in row)) throw new Error(`Row ${index + 1} in ${table} is missing ${field}.`);
    }
  });
}

function keyFor(table: TableName, row: Row): Row {
  switch (table) {
    case "settings": return { key: row.key };
    case "assignments": return { user_id: row.user_id, barangay_id: row.barangay_id };
    case "purok_assignments": return { user_id: row.user_id, purok_id: row.purok_id };
    default: return { id: row.id };
  }
}

async function importD1(): Promise<void> {
  const sourcePath = exportPath();
  const raw = await readFile(sourcePath);
  const snapshot = JSON.parse(raw.toString("utf8")) as Snapshot;
  if (snapshot.source !== "cloudflare-d1") throw new Error("This file is not a Cloudflare D1 migration snapshot.");
  for (const [table, columns] of Object.entries(tables) as Array<[TableName, readonly string[]]>) assertFields(readRows(snapshot, table), table, columns);

  const fingerprint = createHash("sha256").update(raw).digest("hex");
  const db = await getDb();
  const state = db.collection<{ _id: string; fingerprint: string; status: string }>("migration_state");
  const prior = await state.findOne({ _id: "cloudflare-d1-import" });
  if (prior && prior.fingerprint !== fingerprint) throw new Error("A different D1 snapshot was already imported or started. Use a fresh MongoDB database for a different source snapshot.");
  if (prior?.status === "complete") {
    console.log("This exact snapshot has already been imported successfully; no data was changed.");
    return;
  }
  if (!prior) {
    const targetCollections = Object.keys(tables);
    const counts = await Promise.all(targetCollections.map((name) => db.collection(name).estimatedDocumentCount()));
    const occupied = targetCollections.filter((_, index) => counts[index] > 0);
    if (occupied.length) throw new Error(`MongoDB already contains data in ${occupied.join(", ")}. Import into an empty database so existing records are not overwritten.`);
    await state.insertOne({ _id: "cloudflare-d1-import", fingerprint, status: "in-progress" });
  }

  for (const table of Object.keys(tables) as TableName[]) {
    const rows = readRows(snapshot, table);
    const collection = db.collection(table);
    let upserted = 0;
    for (let offset = 0; offset < rows.length; offset += 500) {
      const batch = rows.slice(offset, offset + 500);
      const result = await collection.bulkWrite(batch.map((row) => ({
        updateOne: { filter: keyFor(table, row), update: { $setOnInsert: row }, upsert: true },
      })), { ordered: true });
      upserted += result.upsertedCount;
    }
    console.log(`Imported ${upserted} ${table} (${rows.length - upserted} already present during resume).`);
  }

  const migratedUserIds = readRows(snapshot, "users").map((user) => user.id);
  if (migratedUserIds.length) await db.collection("sessions").deleteMany({ user_id: { $in: migratedUserIds } });
  await state.updateOne({ _id: "cloudflare-d1-import" }, { $set: { status: "complete", completedAt: new Date(), exportedAt: snapshot.exportedAt } });
  console.log("D1 data import complete. Password hashes and account states are preserved; old sessions and login lockouts are not imported.");
}

const action = process.argv[2];
if (action === "export") await exportD1();
else if (action === "import") await importD1();
else throw new Error("Use the export or import command.");
