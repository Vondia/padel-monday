import { LeagueApp } from "@/components/league-app"
import { getFixtures } from "@/lib/fixtures"
import { getLeaderboard, getMatchHistory } from "@/lib/league"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function Page() {
  try {
    const [players, matches, fixtures] = await Promise.all([getLeaderboard(), getMatchHistory(), getFixtures()])
    return <LeagueApp players={players} matches={matches} fixtures={fixtures} />
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    console.error("Failed to load league data:", message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]"))
    return (
      <main className="min-h-screen bg-[#08111f] px-6 py-16 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">League HQ</p>
        <h1 className="mt-2 text-2xl font-black">The database is unreachable.</h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">Refresh once the connection is back. Match results stay stored in Neon.</p>
      </main>
    )
  }
}
