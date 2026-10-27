import type { SlotInput } from "@/lib/league-types"

export class LeagueError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LeagueError"
  }
}

export type { SlotInput }

export function normalizeSlots(
  slots: SlotInput[],
  roster: { id: string; name: string }[],
): [SlotInput, SlotInput, SlotInput, SlotInput] {
  if (slots.length !== 4) {
    throw new LeagueError("Each team needs two players.")
  }

  const ids = new Set(roster.map((player) => player.id))
  const names = new Map(roster.map((player) => [player.name.toLowerCase(), player.name]))
  const normalized = slots.map((slot) => {
    const playerId = slot.playerId?.trim() || null
    const guestName = slot.guestName?.trim() || null
    if (playerId && guestName) {
      throw new LeagueError("A slot cannot be both a player and a guest.")
    }
    if (!playerId && !guestName) {
      throw new LeagueError("Each slot needs a player or a guest.")
    }
    if (playerId && !ids.has(playerId)) {
      throw new LeagueError("Choose players from the league.")
    }
    if (guestName) {
      const leagueName = names.get(guestName.toLowerCase())
      if (leagueName) {
        throw new LeagueError(`${leagueName} is already in the league. Pick them from the list.`)
      }
    }
    return { playerId, guestName: playerId ? null : guestName }
  })

  const playing = normalized.flatMap((slot) => (slot.playerId ? [slot.playerId] : []))
  if (new Set(playing).size !== playing.length) {
    throw new LeagueError("A player cannot be selected twice in the same match.")
  }
  if (playing.length === 0) {
    throw new LeagueError("A match needs at least one league player. Skip it if it should not count.")
  }

  return normalized as [SlotInput, SlotInput, SlotInput, SlotInput]
}
