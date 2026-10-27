/**
 * Five-player whist rotation. Each round, one player rests and the other four
 * split into two pairs. Across five rounds every player rests once, every pair
 * is teammates once, and every pair is opponents twice.
 *
 * Order is fixed so 26 Oct 2026 (Karel & Olivier vs Pim & Sander, Klaas resting)
 * is the last round of a cycle. The dates below are the following rounds, from
 * 2 Nov 2026 through 17 May 2027: 29 Mondays. Together with that played match,
 * every player rests six times and every pairing is balanced.
 */
import { amsterdamDateTime, amsterdamDay, formatMatchDate } from "@/lib/match-dates"

const PLAYERS = ["Karel", "Pim", "Sander", "Olivier", "Klaas"] as const

const SEASON_WEEKS = 29

export type ScheduledMatch = {
  iso: string
  date: string
  teamOne: [string, string]
  teamTwo: [string, string]
  resting: string
}

function civilDate(year: number, month: number, day: number, addDays: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + addDays)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

/** 19:00 Europe/Amsterdam, including the March clock change. */
function kickoff(year: number, month: number, day: number) {
  const monthText = String(month).padStart(2, "0")
  const dayText = String(day).padStart(2, "0")
  return amsterdamDateTime(`${year}-${monthText}-${dayText}`, "19:00")
}

export const schedule: ScheduledMatch[] = Array.from({ length: SEASON_WEEKS }, (_, week) => {
  const round = week % 5
  const player = (offset: number) => PLAYERS[(round + offset) % PLAYERS.length]
  const civil = civilDate(2026, 11, 2, week * 7)
  const iso = kickoff(civil.year, civil.month, civil.day)
  return {
    iso,
    date: formatMatchDate(iso),
    resting: player(0),
    teamOne: [player(1), player(4)],
    teamTwo: [player(2), player(3)],
  }
})

export function upcomingMatch(now = new Date()) {
  const today = amsterdamDay(now.toISOString())
  return schedule.find((match) => amsterdamDay(match.iso) >= today) ?? schedule[schedule.length - 1]
}
