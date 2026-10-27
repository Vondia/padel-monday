"use server"

import { revalidatePath } from "next/cache"
import { pinsMatch } from "@/lib/admin-pin"
import { addFixture, updateFixtureLineup as saveFixtureLineup } from "@/lib/fixtures"
import { deleteMatch, insertMatch, skipMatch } from "@/lib/league"
import type { FixtureCreate, FixtureUpdate, NewMatch } from "@/lib/league-types"
import { LeagueError } from "@/lib/slots"

function pinFailure() {
  if (!process.env.ADMIN_PINCODE) {
    return { ok: false as const, error: "ADMIN_PINCODE is not set." }
  }
  return { ok: false as const, error: "Incorrect PIN." }
}

function failure(error: unknown, fallback: string) {
  console.error(fallback)
  if (error instanceof LeagueError) {
    return { ok: false as const, error: error.message }
  }
  return { ok: false as const, error: fallback }
}

export async function unlockAdmin(pin: string) {
  if (!pinsMatch(pin)) return pinFailure()
  return { ok: true as const }
}

export async function submitMatchResult(pin: string, input: NewMatch) {
  if (!pinsMatch(pin)) return pinFailure()
  try {
    await insertMatch(input)
    revalidatePath("/")
    return { ok: true as const }
  } catch (error) {
    return failure(error, "Could not save the match.")
  }
}

export async function skipMatchResult(pin: string, input: { date: string; reason: string | null }) {
  if (!pinsMatch(pin)) return pinFailure()
  try {
    await skipMatch(input)
    revalidatePath("/")
    return { ok: true as const }
  } catch (error) {
    return failure(error, "Could not skip the match.")
  }
}

export async function deleteMatchResult(pin: string, id: string) {
  if (!pinsMatch(pin)) return pinFailure()
  try {
    await deleteMatch(id)
    revalidatePath("/")
    return { ok: true as const }
  } catch (error) {
    return failure(error, "Could not remove the result.")
  }
}

export async function updateFixtureLineup(pin: string, input: FixtureUpdate) {
  if (!pinsMatch(pin)) return pinFailure()
  try {
    await saveFixtureLineup(input)
    revalidatePath("/")
    return { ok: true as const }
  } catch (error) {
    return failure(error, "Could not update the schedule.")
  }
}

export async function createFixture(pin: string, input: FixtureCreate) {
  if (!pinsMatch(pin)) return pinFailure()
  try {
    await addFixture(input)
    revalidatePath("/")
    return { ok: true as const }
  } catch (error) {
    return failure(error, "Could not add the match.")
  }
}
