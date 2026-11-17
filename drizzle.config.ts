import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./Data/migrations",
  schema: "./Data/schema.ts",
  dialect: "sqlite",
});
