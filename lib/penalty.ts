import type { MatchRecord } from "@/lib/league-types"

const TIME_ZONE = "Europe/Amsterdam"

export type MonthResult = {
  name: string
  losses: number
  points: number
}

/** A single win is not a streak worth a flame. Two in a row lights it. */
export const HOT_STREAK = 2

function monthKeyFromDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  return `${year}-${month}`
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function pointsFor(ownSets: number, otherSets: number) {
  const scored: Record<string, number> = { "2-0": 3, "2-1": 2, "1-2": 1, "0-2": 0 }
  return scored[`${ownSets}-${otherSets}`] ?? 0
}

export function monthResults(matches: MatchRecord[], playerNames: string[], month: string) {
  const stats = new Map<string, MonthResult>(playerNames.map((name) => [name, { name, losses: 0, points: 0 }]))
  for (const match of matches) {
    if (match.skipped || match.team1SetsWon == null || match.team2SetsWon == null) continue
    if (monthKeyFromDate(new Date(match.date)) !== month) continue
    const teamOneWon = match.team1SetsWon > match.team2SetsWon
    const sides = [
      { names: match.teamOne, won: teamOneWon, own: match.team1SetsWon, other: match.team2SetsWon },
      { names: match.teamTwo, won: !teamOneWon, own: match.team2SetsWon, other: match.team1SetsWon },
    ]
    for (const side of sides) {
      for (const name of side.names) {
        const row = stats.get(name)
        if (!row) continue
        row.points += pointsFor(side.own, side.other)
        if (!side.won) row.losses += 1
      }
    }
  }
  return [...stats.values()]
}

/** Most match losses. A 2-0 loss breaks a tie with a 2-1 loss, because it earned fewer points. */
export function biggestLosers(results: MonthResult[]) {
  const withLosses = results.filter((result) => result.losses > 0)
  if (withLosses.length === 0) return []
  const mostLosses = Math.max(...withLosses.map((result) => result.losses))
  const tiedOnLosses = withLosses.filter((result) => result.losses === mostLosses)
  const fewestPoints = Math.min(...tiedOnLosses.map((result) => result.points))
  return tiedOnLosses
    .filter((result) => result.points === fewestPoints)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

export function penaltySummary(matches: MatchRecord[], playerNames: string[], now = new Date()) {
  const currentMonth = monthKeyFromDate(now)
  const previousMonth = shiftMonth(currentMonth, -1)
  return {
    currentMonth,
    previousMonth,
    currentMonthLabel: monthLabel(currentMonth),
    previousMonthLabel: monthLabel(previousMonth),
    losers: biggestLosers(monthResults(matches, playerNames, currentMonth)),
    shout: biggestLosers(monthResults(matches, playerNames, previousMonth)),
  }
}
