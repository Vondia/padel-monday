export type PlayerStanding = {
  id: string
  name: string
  points: number
  matchesPlayed: number
  currentWinStreak: number
  wins: number
  losses: number
}

export type MatchRecord = {
  id: string
  date: string
  teamOne: [string, string]
  teamTwo: [string, string]
  team1SetsWon: number | null
  team2SetsWon: number | null
  skipped: boolean
  skipReason: string | null
}

export type SlotInput = {
  playerId: string | null
  guestName: string | null
}

export type CourtSlot = SlotInput & {
  name: string
}

export type Fixture = {
  id: string
  iso: string
  day: string
  date: string
  teamOne: [string, string]
  teamTwo: [string, string]
  slots: [CourtSlot, CourtSlot, CourtSlot, CourtSlot]
  resting: string[]
}

export type NewMatch = {
  date: string
  slots: [SlotInput, SlotInput, SlotInput, SlotInput]
  team1SetsWon: number
  team2SetsWon: number
}

export type FixtureUpdate = {
  id: string
  slots: [SlotInput, SlotInput, SlotInput, SlotInput]
}

export type FixtureCreate = {
  date: string
  time: string
  slots: [SlotInput, SlotInput, SlotInput, SlotInput]
}
