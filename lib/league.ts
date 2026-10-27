import type { PoolClient } from "pg"
import { pool } from "@/lib/db"
import type { MatchRecord, NewMatch, PlayerStanding } from "@/lib/league-types"
import { amsterdamDay } from "@/lib/match-dates"
import { LeagueError, normalizeSlots } from "@/lib/slots"

export type { MatchRecord, NewMatch, PlayerStanding }

const SCORE_POINTS: Record<string, [number, number]> = {
  "2-0": [3, 0],
  "2-1": [2, 1],
  "1-2": [1, 2],
  "0-2": [0, 3],
}

export function pointsForScore(team1SetsWon: number, team2SetsWon: number) {
  const points = SCORE_POINTS[`${team1SetsWon}-${team2SetsWon}`]
  if (!points) {
    throw new LeagueError("Choose a score of 2-0, 2-1, 1-2, or 0-2.")
  }
  return { team1Points: points[0], team2Points: points[1] }
}

export async function getLeaderboard(): Promise<PlayerStanding[]> {
  const result = await pool.query<{
    id: string
    name: string
    points: number
    matches_played: number
    current_win_streak: number
    wins: number
  }>(`
    SELECT
      p.id,
      p.name,
      p.points,
      p.matches_played,
      p.current_win_streak,
      COALESCE(wins.total, 0)::int AS wins
    FROM players p
    LEFT JOIN (
      SELECT player_id, COUNT(*)::int AS total
      FROM (
        SELECT team_1_player_a_id AS player_id
        FROM matches
        WHERE team_1_sets_won > team_2_sets_won
        UNION ALL
        SELECT team_1_player_b_id
        FROM matches
        WHERE team_1_sets_won > team_2_sets_won
          AND team_1_player_b_id IS NOT NULL
        UNION ALL
        SELECT team_2_player_a_id
        FROM matches
        WHERE team_2_sets_won > team_1_sets_won
        UNION ALL
        SELECT team_2_player_b_id
        FROM matches
        WHERE team_2_sets_won > team_1_sets_won
          AND team_2_player_b_id IS NOT NULL
      ) won
      GROUP BY player_id
    ) wins ON wins.player_id = p.id
    ORDER BY p.points DESC, p.name ASC
  `)

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    points: row.points,
    matchesPlayed: row.matches_played,
    currentWinStreak: row.current_win_streak,
    wins: row.wins,
    losses: row.matches_played - row.wins,
  }))
}

export async function getMatchHistory(): Promise<MatchRecord[]> {
  const result = await pool.query<{
    id: string
    date: Date
    skipped: boolean
    skip_reason: string | null
    team_1_player_a: string | null
    team_1_player_b: string | null
    team_2_player_a: string | null
    team_2_player_b: string | null
    team_1_sets_won: number | null
    team_2_sets_won: number | null
  }>(`
    SELECT
      m.id,
      m.date,
      m.skipped,
      m.skip_reason,
      COALESCE(p1a.name, NULLIF(btrim(m.team_1_player_a_guest), '')) AS team_1_player_a,
      COALESCE(p1b.name, NULLIF(btrim(m.team_1_player_b_guest), '')) AS team_1_player_b,
      COALESCE(p2a.name, NULLIF(btrim(m.team_2_player_a_guest), '')) AS team_2_player_a,
      COALESCE(p2b.name, NULLIF(btrim(m.team_2_player_b_guest), '')) AS team_2_player_b,
      m.team_1_sets_won,
      m.team_2_sets_won
    FROM matches m
    LEFT JOIN players p1a ON p1a.id = m.team_1_player_a_id
    LEFT JOIN players p1b ON p1b.id = m.team_1_player_b_id
    LEFT JOIN players p2a ON p2a.id = m.team_2_player_a_id
    LEFT JOIN players p2b ON p2b.id = m.team_2_player_b_id
    ORDER BY m.date DESC, m.id DESC
  `)

  return result.rows.map((row) => ({
    id: row.id,
    date: new Date(row.date).toISOString(),
    teamOne: [row.team_1_player_a ?? "", row.team_1_player_b ?? ""],
    teamTwo: [row.team_2_player_a ?? "", row.team_2_player_b ?? ""],
    team1SetsWon: row.team_1_sets_won,
    team2SetsWon: row.team_2_sets_won,
    skipped: row.skipped,
    skipReason: row.skip_reason,
  }))
}

async function matchOnDay(iso: string) {
  const result = await pool.query<{ id: string; skipped: boolean }>(
    "SELECT id, skipped FROM matches WHERE amsterdam_day = $1::date",
    [amsterdamDay(iso)],
  )
  return result.rows[0] ?? null
}

function slotValues(slots: NewMatch["slots"]) {
  return slots.flatMap((slot) => [slot.playerId, slot.guestName])
}

export async function insertMatch(input: NewMatch) {
  pointsForScore(input.team1SetsWon, input.team2SetsWon)

  const playedAt = new Date(input.date)
  if (Number.isNaN(playedAt.getTime())) {
    throw new LeagueError("Choose a valid match date.")
  }

  const roster = await pool.query<{ id: string; name: string }>("SELECT id, name FROM players")
  const slots = normalizeSlots(input.slots, roster.rows)
  const existing = await matchOnDay(playedAt.toISOString())
  if (existing && !existing.skipped) {
    throw new LeagueError("This date already has a result.")
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    if (existing?.skipped) {
      await client.query("DELETE FROM matches WHERE id = $1", [existing.id])
    }
    await client.query(
      `
        INSERT INTO matches (
          date,
          amsterdam_day,
          team_1_player_a_id,
          team_1_player_a_guest,
          team_1_player_b_id,
          team_1_player_b_guest,
          team_2_player_a_id,
          team_2_player_a_guest,
          team_2_player_b_id,
          team_2_player_b_guest,
          team_1_sets_won,
          team_2_sets_won
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [playedAt.toISOString(), amsterdamDay(playedAt.toISOString()), ...slotValues(slots), input.team1SetsWon, input.team2SetsWon],
    )
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function skipMatch(input: { date: string; reason: string | null }) {
  const playedAt = new Date(input.date)
  if (Number.isNaN(playedAt.getTime())) {
    throw new LeagueError("Choose a valid match date.")
  }

  const reason = input.reason?.trim() || null
  if (reason && reason.length > 160) {
    throw new LeagueError("Keep the skip reason under 160 characters.")
  }

  const existing = await matchOnDay(playedAt.toISOString())
  if (existing?.skipped) {
    throw new LeagueError("This match is already skipped.")
  }
  if (existing) {
    throw new LeagueError("This date already has a result.")
  }

  await pool.query(
    "INSERT INTO matches (date, amsterdam_day, skipped, skip_reason) VALUES ($1, $2::date, true, $3)",
    [playedAt.toISOString(), amsterdamDay(playedAt.toISOString()), reason],
  )
}

const REBUILD_PLAYER_STATS = `
WITH events AS (
  SELECT m.date, m.id, side.player_id, side.points, side.won
  FROM matches m
  CROSS JOIN LATERAL (
    VALUES
      (
        m.team_1_player_a_id,
        CASE
          WHEN m.team_1_sets_won = 2 AND m.team_2_sets_won = 0 THEN 3
          WHEN m.team_1_sets_won = 2 AND m.team_2_sets_won = 1 THEN 2
          WHEN m.team_1_sets_won = 1 AND m.team_2_sets_won = 2 THEN 1
          ELSE 0
        END,
        m.team_1_sets_won > m.team_2_sets_won
      ),
      (
        m.team_1_player_b_id,
        CASE
          WHEN m.team_1_sets_won = 2 AND m.team_2_sets_won = 0 THEN 3
          WHEN m.team_1_sets_won = 2 AND m.team_2_sets_won = 1 THEN 2
          WHEN m.team_1_sets_won = 1 AND m.team_2_sets_won = 2 THEN 1
          ELSE 0
        END,
        m.team_1_sets_won > m.team_2_sets_won
      ),
      (
        m.team_2_player_a_id,
        CASE
          WHEN m.team_2_sets_won = 2 AND m.team_1_sets_won = 0 THEN 3
          WHEN m.team_2_sets_won = 2 AND m.team_1_sets_won = 1 THEN 2
          WHEN m.team_2_sets_won = 1 AND m.team_1_sets_won = 2 THEN 1
          ELSE 0
        END,
        m.team_2_sets_won > m.team_1_sets_won
      ),
      (
        m.team_2_player_b_id,
        CASE
          WHEN m.team_2_sets_won = 2 AND m.team_1_sets_won = 0 THEN 3
          WHEN m.team_2_sets_won = 2 AND m.team_1_sets_won = 1 THEN 2
          WHEN m.team_2_sets_won = 1 AND m.team_1_sets_won = 2 THEN 1
          ELSE 0
        END,
        m.team_2_sets_won > m.team_1_sets_won
      )
  ) AS side(player_id, points, won)
  WHERE NOT m.skipped
    AND side.player_id IS NOT NULL
),
ordered AS (
  SELECT
    player_id,
    points,
    won,
    row_number() OVER (PARTITION BY player_id ORDER BY date, id) AS rn
  FROM events
),
last_loss AS (
  SELECT player_id, MAX(rn) AS rn
  FROM ordered
  WHERE NOT won
  GROUP BY player_id
),
streaks AS (
  SELECT o.player_id, COUNT(*)::int AS streak
  FROM ordered o
  LEFT JOIN last_loss l ON l.player_id = o.player_id
  WHERE o.won AND o.rn > COALESCE(l.rn, 0)
  GROUP BY o.player_id
),
totals AS (
  SELECT player_id, SUM(points)::int AS points, COUNT(*)::int AS matches_played
  FROM ordered
  GROUP BY player_id
),
next_stats AS (
  SELECT
    base.id,
    COALESCE(t.points, 0) AS points,
    COALESCE(t.matches_played, 0) AS matches_played,
    COALESCE(s.streak, 0) AS current_win_streak
  FROM players base
  LEFT JOIN totals t ON t.player_id = base.id
  LEFT JOIN streaks s ON s.player_id = base.id
)
UPDATE players p
SET
  points = next_stats.points,
  matches_played = next_stats.matches_played,
  current_win_streak = next_stats.current_win_streak
FROM next_stats
WHERE p.id = next_stats.id
`

async function rebuildPlayerStats(client: PoolClient) {
  await client.query(REBUILD_PLAYER_STATS)
}

export async function deleteMatch(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new LeagueError("Choose a result to remove.")
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const deleted = await client.query("DELETE FROM matches WHERE id = $1", [id])
    if (deleted.rowCount !== 1) {
      throw new LeagueError("That result is already gone.")
    }
    await rebuildPlayerStats(client)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
