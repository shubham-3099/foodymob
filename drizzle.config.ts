import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: ["./db/schema.ts", "./db/community.ts"], out: "./drizzle", dialect: "sqlite" });
