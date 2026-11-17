import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./Data/schema.ts",
  dialect: "sqlite",
});
