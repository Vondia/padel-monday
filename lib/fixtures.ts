import { pool } from "@/lib/db"
import type { Fixture, FixtureCreate, FixtureUpdate } from "@/lib/league-types"
import { amsterdamDateTime, amsterdamDay, formatMatchDate } from "@/lib/match-dates"
import { schedule } from "@/lib/schedule"
import { LeagueError, normalizeSlots } from "@/lib/slots"

const ROSTER_ORDER = ["Karel", "Pim", "Sander", "Olivier", "Klaas"]

type FixtureRow = {
  id: string
  played_at: Date
  amsterdam_day: string
  team_1_player_a_id: string | null
  team_1_player_a_guest: string | null
  team_1_a_name: string
  team_1_player_b_id: string | null
  team_1_player_b_guest: string | null
  team_1_b_name: string
  team_2_player_a_id: string | null
  team_2_player_a_guest: string | null
  team_2_a_name: string
  team_2_player_b_id: string | null
  team_2_player_b_guest: string | null
  team_2_b_name: string
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}

async function roster() {
  const result = await pool.query<{ id: string; name: string }>("SELECT id, name FROM players ORDER BY name")
  return result.rows
}

function restingNames(playing: string[], names: string[]) {
  const onCourt = new Set(playing)
  const ordered = ROSTER_ORDER.filter((name) => names.includes(name) && !onCourt.has(name))
  const extras = names.filter((name) => !ROSTER_ORDER.includes(name) && !onCourt.has(name)).sort()
  return [...ordered, ...extras]
}

function mapFixture(row: FixtureRow, names: string[]): Fixture {
  const slots: Fixture["slots"] = [
    { playerId: row.team_1_player_a_id, guestName: row.team_1_player_a_guest, name: row.team_1_a_name },
    { playerId: row.team_1_player_b_id, guestName: row.team_1_player_b_guest, name: row.team_1_b_name },
    { playerId: row.team_2_player_a_id, guestName: row.team_2_player_a_guest, name: row.team_2_a_name },
    { playerId: row.team_2_player_b_id, guestName: row.team_2_player_b_guest, name: row.team_2_b_name },
  ]
  const iso = new Date(row.played_at).toISOString()
  return {
    id: row.id,
    iso,
    day: row.amsterdam_day,
    date: formatMatchDate(iso),
    teamOne: [slots[0].name, slots[1].name],
    teamTwo: [slots[2].name, slots[3].name],
    slots,
    resting: restingNames(slots.flatMap((slot) => (slot.playerId ? [slot.name] : [])), names),
  }
}

async function seedGeneratedFixtures() {
  const players = await roster()
  const byName = new Map(players.map((player) => [player.name, player.id]))
  const playedAt: string[] = []
  const days: string[] = []
  const team1A: string[] = []
  const team1B: string[] = []
  const team2A: string[] = []
  const team2B: string[] = []

  for (const match of schedule) {
    const ids = [match.teamOne[0], match.teamOne[1], match.teamTwo[0], match.teamTwo[1]].map((name) => byName.get(name))
    if (ids.some((id) => !id)) {
      throw new LeagueError("Choose players from the league.")
    }
    playedAt.push(match.iso)
    days.push(amsterdamDay(match.iso))
    team1A.push(ids[0]!)
    team1B.push(ids[1]!)
    team2A.push(ids[2]!)
    team2B.push(ids[3]!)
  }

  await pool.query(
    `
      INSERT INTO fixtures (
        played_at,
        amsterdam_day,
        team_1_player_a_id,
        team_1_player_b_id,
        team_2_player_a_id,
        team_2_player_b_id
      )
      SELECT played_at, amsterdam_day, team_1_a, team_1_b, team_2_a, team_2_b
      FROM unnest($1::timestamptz[], $2::date[], $3::uuid[], $4::uuid[], $5::uuid[], $6::uuid[])
        AS seed(played_at, amsterdam_day, team_1_a, team_1_b, team_2_a, team_2_b)
      WHERE NOT EXISTS (
        SELECT 1
        FROM fixtures existing
        WHERE existing.amsterdam_day = seed.amsterdam_day
      )
    `,
    [playedAt, days, team1A, team1B, team2A, team2B],
  )
}

export async function getFixtures(): Promise<Fixture[]> {
  await seedGeneratedFixtures()
  const [players, result] = await Promise.all([
    roster(),
    pool.query<FixtureRow>(`
      SELECT
        f.id,
        f.played_at,
        to_char(f.amsterdam_day, 'YYYY-MM-DD') AS amsterdam_day,
        f.team_1_player_a_id,
        f.team_1_player_a_guest,
        COALESCE(p1a.name, f.team_1_player_a_guest) AS team_1_a_name,
        f.team_1_player_b_id,
        f.team_1_player_b_guest,
        COALESCE(p1b.name, f.team_1_player_b_guest) AS team_1_b_name,
        f.team_2_player_a_id,
        f.team_2_player_a_guest,
        COALESCE(p2a.name, f.team_2_player_a_guest) AS team_2_a_name,
        f.team_2_player_b_id,
        f.team_2_player_b_guest,
        COALESCE(p2b.name, f.team_2_player_b_guest) AS team_2_b_name
      FROM fixtures f
      LEFT JOIN players p1a ON p1a.id = f.team_1_player_a_id
      LEFT JOIN players p1b ON p1b.id = f.team_1_player_b_id
      LEFT JOIN players p2a ON p2a.id = f.team_2_player_a_id
      LEFT JOIN players p2b ON p2b.id = f.team_2_player_b_id
      ORDER BY f.played_at ASC
    `),
  ])

  return result.rows.map((row) => mapFixture(row, players.map((player) => player.name)))
}

const FIXTURE_COLUMNS = `
  team_1_player_a_id,
  team_1_player_a_guest,
  team_1_player_b_id,
  team_1_player_b_guest,
  team_2_player_a_id,
  team_2_player_a_guest,
  team_2_player_b_id,
  team_2_player_b_guest
`

export async function updateFixtureLineup(input: FixtureUpdate) {
  const players = await roster()
  const slots = normalizeSlots(input.slots, players)
  const values = slots.flatMap((slot) => [slot.playerId, slot.guestName])
  const result = await pool.query(
    `
      UPDATE fixtures
      SET
        team_1_player_a_id = $2,
        team_1_player_a_guest = $3,
        team_1_player_b_id = $4,
        team_1_player_b_guest = $5,
        team_2_player_a_id = $6,
        team_2_player_a_guest = $7,
        team_2_player_b_id = $8,
        team_2_player_b_guest = $9
      WHERE id = $1
    `,
    [input.id, ...values],
  )
  if (result.rowCount !== 1) {
    throw new LeagueError("Choose a match from the schedule.")
  }
}

export async function addFixture(input: FixtureCreate) {
  let iso: string
  try {
    iso = amsterdamDateTime(input.date, input.time)
  } catch (error) {
    if (error instanceof LeagueError) throw error
    throw new LeagueError("Choose a valid match date.")
  }

  const players = await roster()
  const slots = normalizeSlots(input.slots, players)
  const values = slots.flatMap((slot) => [slot.playerId, slot.guestName])

  try {
    await pool.query(
      `
        INSERT INTO fixtures (
          played_at,
          amsterdam_day,
          ${FIXTURE_COLUMNS}
        )
        VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [iso, amsterdamDay(iso), ...values],
    )
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new LeagueError("That date is already on the schedule. Edit that match instead.")
    }
    throw error
  }
}
