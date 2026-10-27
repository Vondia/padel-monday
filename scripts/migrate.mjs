import { readdirSync, readFileSync } from "node:fs"
import { Pool } from "pg"

const connectionString = process.env.DATABASE_URL_UNPOOLED
if (!connectionString) {
  console.error("DATABASE_URL_UNPOOLED is not set. Run with node --env-file=.env.local")
  process.exit(1)
}

const migrations = new URL("../db/migrations/", import.meta.url)
const files = readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()
const pool = new Pool({ connectionString, max: 1 })

try {
  for (const file of files) {
    const sql = readFileSync(new URL(file, migrations), "utf8")
    await pool.query(sql)
    console.log(`Applied ${file}`)
  }
  const players = await pool.query(
    "SELECT name, points, matches_played, current_win_streak FROM players ORDER BY name",
  )
  console.log(`Migration applied. ${players.rowCount} players:`)
  for (const row of players.rows) {
    console.log(`- ${row.name}: ${row.points} pts, ${row.matches_played} played, streak ${row.current_win_streak}`)
  }
} finally {
  await pool.end()
}
