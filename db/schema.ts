import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "bhw"] }).notNull(),
  passwordHash: text("password_hash"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const barangays = sqliteTable("barangays", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const assignments = sqliteTable("assignments", {
  userId: text("user_id").notNull().references(() => users.id),
  barangayId: text("barangay_id").notNull().references(() => barangays.id),
}, (table) => [primaryKey({ columns: [table.userId, table.barangayId] })]);

export const children = sqliteTable("children", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  birthday: text("birthday").notNull(),
  sex: text("sex", { enum: ["F", "M"] }).notNull(),
  parents: text("parents").notNull(),
  barangayId: text("barangay_id").notNull().references(() => barangays.id),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
});

export const loginAttempts = sqliteTable("login_attempts", {
  username: text("username").primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: text("locked_until"),
});
