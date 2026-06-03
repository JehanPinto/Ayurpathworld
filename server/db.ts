import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { config as loadEnv } from "dotenv";

// Load .env only in development — on EB/production, env vars are injected by AWS
if (process.env.NODE_ENV !== "production") {
  try {
    if (typeof (process as any).loadEnvFile === "function") {
      (process as any).loadEnvFile();
    } else {
      loadEnv();
    }
  } catch {
    // .env not found, relying on environment variables
  }
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set (or PGHOST/PGUSER/PGDATABASE).",
  );
}

// Log resolved DB host/db (do NOT log password)
try {
  const url = new URL(databaseUrl);
  console.log(`Using database host=${url.hostname} db=${url.pathname.replace('/', '')}`);
} catch {
  // ignore
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });