import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import pino from "pino";
import * as schema from "./schema";

const logger = pino({ name: "db" });

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export function getDb() {
  if (_db) return _db;

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  _pool = new Pool({ connectionString, max: 10 });
  _db = drizzle(_pool, { schema });
  logger.info("PostgreSQL connection pool created");
  return _db;
}

export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    logger.info("PostgreSQL connection pool closed");
  }
}

export { schema };
