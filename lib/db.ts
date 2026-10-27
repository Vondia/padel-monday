import { attachDatabasePool } from "@vercel/functions"
import { parseEnv } from "@neon/env"
import { Pool } from "pg"
import config from "../neon"

const { postgres } = parseEnv(config, ["DATABASE_URL"])

const globalForPg = globalThis as unknown as { pool?: Pool }

function createPool() {
  const pool = new Pool({
    connectionString: postgres.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 10_000,
  })
  attachDatabasePool(pool)
  return pool
}

export const pool = globalForPg.pool ?? createPool()

if (process.env.NODE_ENV !== "production") {
  globalForPg.pool = pool
}
