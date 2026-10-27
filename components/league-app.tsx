"use client"

import { useEffect, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, CalendarDays, Check, ChevronRight, LockKeyhole, ShieldCheck, Trophy, X, Zap } from "lucide-react"
import { createFixture, deleteMatchResult, skipMatchResult, submitMatchResult, unlockAdmin, updateFixtureLineup } from "@/app/actions"
import { formatMatchDate } from "@/lib/match-dates"
import { HOT_STREAK, joinNames, penaltySummary } from "@/lib/penalty"
import type { Fixture, MatchRecord, PlayerStanding, SlotInput } from "@/lib/league-types"

const GUEST = "guest"

const PLAYER_STYLES: Record<string, { initials: string; color: string }> = {
  Olivier: { initials: "OL", color: "from-lime-300 to-emerald-500" },
  Karel: { initials: "KA", color: "from-cyan-300 to-blue-500" },
  Sander: { initials: "SA", color: "from-orange-300 to-amber-500" },
  Klaas: { initials: "KL", color: "from-fuchsia-300 to-purple-500" },
  Pim: { initials: "PI", color: "from-rose-300 to-red-500" },
}

function styleFor(name: string) {
  return PLAYER_STYLES[name] ?? {
    initials: name.slice(0, 2).toUpperCase(),
    color: "from-slate-300 to-slate-500",
  }
}

function NameWithStreak({ name, streak }: { name: string; streak: number }) {
  const hot = streak >= HOT_STREAK
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-white">
      {name}
      {hot && <span title={`${streak} wins in a row`} aria-label={`${streak} wins in a row`}>🔥</span>}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  const player = styleFor(name)
  return (
    <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${player.color} text-xs font-black text-slate-950`}>
      {player.initials}
    </span>
  )
}

function Header({ active, setActive }: { active: string; setActive: (value: string) => void }) {
  const items = [
    { id: "home", label: "Home", icon: Zap },
    { id: "rankings", label: "Rankings", icon: Trophy },
    { id: "admin", label: "Admin", icon: ShieldCheck },
  ]
  return (
    <>
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-lime-300 text-lg font-black text-slate-950">P</div>
          <div>
            <p className="text-sm font-black tracking-tight text-white">PADEL<span className="text-lime-300">MONDAY</span></p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">League HQ</p>
          </div>
        </div>
      </header>
      <nav className="mb-8 hidden gap-1 rounded-2xl border border-white/10 bg-white/3 p-1 sm:flex">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActive(id)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${active === id ? "bg-lime-300 text-slate-950" : "text-slate-400 hover:text-white"}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </nav>
      <nav aria-label="Primary navigation" className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-md items-center justify-around rounded-2xl border border-white/10 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-xl sm:hidden">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActive(id)} className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-black ${active === id ? "bg-lime-300 text-slate-950" : "text-slate-400"}`}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </nav>
    </>
  )
}

function SectionHeader({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">{eyebrow}</p>
        <h2 className="text-xl font-black tracking-tight text-white">{title}</h2>
      </div>
      {action && (
        <button onClick={onAction} className="group flex cursor-pointer items-center gap-1 text-xs font-bold text-slate-400 hover:text-lime-300">
          {action}<ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      )}
    </div>
  )
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="glass-card max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[28px] p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">{eyebrow}</p>
            <h2 className="text-2xl font-black text-white">{title}</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-full border border-white/10 p-2 text-slate-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

function CalendarModal({ fixtures, onClose }: { fixtures: Fixture[]; onClose: () => void }) {
  const first = fixtures[0]
  const last = fixtures[fixtures.length - 1]
  return (
    <Modal title="Full match calendar" eyebrow={first && last ? `${first.date} — ${last.date}` : "No matches yet"} onClose={onClose}>
      <p className="mb-6 text-sm text-slate-400">Plan ahead with every Monday matchup and resting week.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fixtures.map((match) => (
          <div key={match.id} className="rounded-2xl border border-white/10 bg-white/3 p-4">
            <p className="mb-3 font-black text-white">{match.date}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-lime-300/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-lime-300">Team 1</p>
                <p className="mt-1 text-sm font-bold text-white">{match.teamOne.join(" & ")}</p>
              </div>
              <div className="rounded-xl bg-cyan-300/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">Team 2</p>
                <p className="mt-1 text-sm font-bold text-white">{match.teamTwo.join(" & ")}</p>
              </div>
            </div>
            <p className="mt-3 rounded-xl border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-xs font-bold text-orange-200">
              <span className="text-orange-300">Resting Week: </span>{match.resting.length > 0 ? joinNames(match.resting) : "Nobody"}
            </p>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function upcomingFixture(fixtures: Fixture[]) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  return fixtures.find((match) => match.day >= today) ?? fixtures[fixtures.length - 1]
}

function HomeView({ goRankings, players, matches, fixtures }: { goRankings: () => void; players: PlayerStanding[]; matches: MatchRecord[]; fixtures: Fixture[] }) {
  const [calendar, setCalendar] = useState(false)
  const match = upcomingFixture(fixtures)
  const penalty = penaltySummary(matches, players.map((player) => player.name))
  const podium = players.slice(0, 3)
  const lossLabel = (count: number) => `${count} loss${count === 1 ? "" : "es"}`
  return (
    <div className="flex flex-col gap-8">
      {calendar && <CalendarModal fixtures={fixtures} onClose={() => setCalendar(false)} />}
      <section className="hero-grid relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-900 px-6 py-8 sm:px-9">
        <div className="relative z-10 max-w-xl">
          <span className="inline-flex rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Season 04 · Week 08</span>
          <h1 className="mt-5 text-4xl font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-6xl">Padel<br /><span className="text-lime-300">Monday</span> League.</h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">Five players. One court. Zero excuses. Keep your eye on the ball and your name at the top.</p>
          <button onClick={goRankings} className="group mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-xs font-black text-slate-950 hover:bg-lime-200">VIEW SEASON STATS <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></button>
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="Next up" title="Match scheduler" action="Full calendar" onAction={() => setCalendar(true)} />
        <div className="glass-card rounded-3xl p-5 sm:p-6">
          {!match ? (
            <p className="text-sm text-slate-400">No matches on the schedule yet.</p>
          ) : (
          <>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-lime-300 text-slate-950"><CalendarDays className="size-5" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-lime-300">{match.date}</p>
              <p className="text-sm text-slate-400">{new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(match.iso))} · Court 02</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-lime-300/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-lime-300">Team 1</p>
              <div className="mt-3 flex items-center gap-2">{match.teamOne.map((name) => <div key={name} className="flex items-center gap-2"><Avatar name={name} /><span className="text-sm font-bold text-white">{name}</span></div>)}</div>
            </div>
            <div className="rounded-2xl bg-cyan-300/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Team 2</p>
              <div className="mt-3 flex items-center gap-2">{match.teamTwo.map((name) => <div key={name} className="flex items-center gap-2"><Avatar name={name} /><span className="text-sm font-bold text-white">{name}</span></div>)}</div>
            </div>
          </div>
          <p className="mt-4 text-sm font-bold text-orange-200">Resting Week: <span className="text-white">{match.resting.length > 0 ? joinNames(match.resting) : "Nobody"}</span></p>
          </>
          )}
        </div>
      </section>
      <section className="glass-card rounded-3xl border border-orange-300/10 bg-orange-300/4 p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Penalty box · {penalty.currentMonthLabel}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-orange-300/20 bg-orange-300/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">{penalty.shout.length > 1 ? "Last month's biggest losers" : "Last month's biggest loser"}</p>
            {penalty.shout.length > 0 ? (
              <>
                <p className="mt-2 text-lg font-black text-white">{joinNames(penalty.shout.map((player) => player.name))}</p>
                <p className="mt-1 text-sm text-orange-100/80">Lost the most in {penalty.previousMonthLabel}. They buy the round through {penalty.currentMonthLabel}.</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-black text-white">Nobody</p>
                <p className="mt-1 text-sm text-orange-100/80">No matches in {penalty.previousMonthLabel}, so nobody carries a penalty into {penalty.currentMonthLabel}.</p>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-lime-300">On the hot seat</p>
            {penalty.losers.length > 0 ? (
              <>
                <p className="mt-2 text-lg font-black text-white">{joinNames(penalty.losers.map((player) => player.name))}</p>
                <p className="mt-1 text-sm text-slate-400">{penalty.losers.length > 1 ? "Tied for " : ""}{lossLabel(penalty.losers[0].losses)} in {penalty.currentMonthLabel}.</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-black text-white">Nobody yet</p>
                <p className="mt-1 text-sm text-slate-400">No losses in {penalty.currentMonthLabel} so far.</p>
              </>
            )}
          </div>
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="All-time" title="Podium" action="Rankings" onAction={goRankings} />
        <div className="glass-card overflow-hidden rounded-3xl">
          {podium.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No players in the league yet.</p>
          ) : podium.map((player, index) => (
            <div key={player.id} className="grid grid-cols-[2fr_1fr_auto] items-center border-b border-white/5 px-5 py-4 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-4 text-xs font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                <Avatar name={player.name} />
                <NameWithStreak name={player.name} streak={player.currentWinStreak} />
              </div>
              <span className="text-center text-xs font-bold text-slate-300">{player.wins}/{player.losses}</span>
              <span className="text-sm font-black text-lime-300">{player.points} pts</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function RankingsView({ players, matches }: { players: PlayerStanding[]; matches: MatchRecord[] }) {
  const [history, setHistory] = useState(false)
  return (
    <div className="flex flex-col gap-8">
      {history && (
        <Modal title="Match History" eyebrow="Season 04 · Past results" onClose={() => setHistory(false)}>
          {matches.length === 0 ? (
            <p className="text-sm text-slate-400">No matches yet. Submit a result from Admin and it will show up here.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-[1fr_2fr_auto] gap-4 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Date</span><span>Match</span><span>Score</span>
              </div>
              {matches.map((result) => (
                <div key={result.id} className="grid grid-cols-[1fr_2fr_auto] items-center gap-4 border-b border-white/5 px-4 py-4 last:border-0">
                  <span className="text-xs font-bold text-slate-400">{formatMatchDate(result.date)}</span>
                  <span className="text-sm font-bold text-white">{result.skipped && !result.teamOne[0] ? (result.skipReason || "No result") : `${result.teamOne.join(" & ")} vs ${result.teamTwo.join(" & ")}`}</span>
                  {result.skipped ? (
                    <span className="text-xs font-bold text-slate-400">Skipped</span>
                  ) : (
                    <span className="rounded-lg bg-lime-300/10 px-2 py-1 text-sm font-black text-lime-300">{result.team1SetsWon}-{result.team2SetsWon}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      <section>
        <SectionHeader eyebrow="Season standings" title="Rankings & Stats" action="Match History" onAction={() => setHistory(true)} />
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>Player</span><span className="text-center">W/L</span><span className="text-right">Pts</span>
          </div>
          {players.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No players in the league yet.</p>
          ) : players.map((player, index) => (
            <div key={player.id} className="grid grid-cols-[2fr_1fr_1fr] items-center border-b border-white/5 px-5 py-4 last:border-0">
              <div className="flex items-center gap-3">
                <span className="w-4 text-xs font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                <Avatar name={player.name} />
                <NameWithStreak name={player.name} streak={player.currentWinStreak} />
              </div>
              <span className="text-center text-xs font-bold text-slate-300">{player.wins}/{player.losses}</span>
              <span className="text-right text-sm font-black text-lime-300">{player.points}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

type SlotValue = { playerId: string; guestName: string }

const COURT_LABELS = ["Team 1 · Player 1", "Team 1 · Player 2", "Team 2 · Player 1", "Team 2 · Player 2"]
const fieldClass = "rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none [color-scheme:dark]"

function emptySlots(): SlotValue[] {
  return COURT_LABELS.map(() => ({ playerId: "", guestName: "" }))
}

function slotsFromFixture(fixture: Fixture | undefined): SlotValue[] {
  if (!fixture) return emptySlots()
  return fixture.slots.map((slot) => ({
    playerId: slot.playerId ?? GUEST,
    guestName: slot.guestName ?? "",
  }))
}

function slotProblem(slots: SlotValue[]) {
  const ids = slots.map((slot) => slot.playerId).filter((id) => id && id !== GUEST)
  if (slots.some((slot) => !slot.playerId)) return "Each slot needs a player or a guest."
  if (new Set(ids).size !== ids.length) return "A player cannot be selected twice in the same match."
  if (slots.some((slot) => slot.playerId === GUEST && slot.guestName.trim() === "")) return "Enter a name for each guest."
  if (ids.length === 0) return "A match needs at least one league player. Skip it if it should not count."
  return ""
}

function toSlotInputs(slots: SlotValue[]): [SlotInput, SlotInput, SlotInput, SlotInput] {
  return slots.map((slot) => (
    slot.playerId === GUEST
      ? { playerId: null, guestName: slot.guestName.trim() }
      : { playerId: slot.playerId, guestName: null }
  )) as [SlotInput, SlotInput, SlotInput, SlotInput]
}

function resultSummary(result: MatchRecord) {
  const match = result.skipped && !result.teamOne[0]
    ? (result.skipReason || "No result")
    : `${result.teamOne.filter(Boolean).join(" & ")} vs ${result.teamTwo.filter(Boolean).join(" & ")}`
  const score = result.skipped ? "Skipped" : `${result.team1SetsWon}-${result.team2SetsWon}`
  return `${formatMatchDate(result.date)} · ${match} · ${score}`
}

function restingFromSlots(slots: SlotValue[], players: PlayerStanding[]) {
  if (slots.some((slot) => !slot.playerId)) return []
  const playing = new Set(slots.map((slot) => slot.playerId).filter((id) => id !== GUEST))
  return players.filter((player) => !playing.has(player.id)).map((player) => player.name)
}

function CourtFields({ slots, onChange, players }: { slots: SlotValue[]; onChange: (slots: SlotValue[]) => void; players: PlayerStanding[] }) {
  const resting = restingFromSlots(slots, players)
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {COURT_LABELS.map((label, index) => {
          const slot = slots[index]
          const taken = new Set(slots.filter((item, slotIndex) => slotIndex !== index && item.playerId && item.playerId !== GUEST).map((item) => item.playerId))
          const available = players.filter((player) => player.id === slot.playerId || !taken.has(player.id))
          return (
            <label key={label} className="flex flex-col gap-2 text-xs font-bold text-slate-400">
              {label}
              <select
                value={slot.playerId}
                onChange={(event) => {
                  const playerId = event.target.value
                  onChange(slots.map((item, slotIndex) => slotIndex === index ? { playerId, guestName: playerId === GUEST ? item.guestName : "" } : item))
                }}
                className={fieldClass}
              >
                <option value="">Choose</option>
                <option value={GUEST}>Guest</option>
                {available.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
              {slot.playerId === GUEST && (
                <input
                  aria-label={`${label} guest name`}
                  value={slot.guestName}
                  onChange={(event) => onChange(slots.map((item, slotIndex) => slotIndex === index ? { ...item, guestName: event.target.value } : item))}
                  placeholder="Guest name"
                  className="rounded-xl border border-lime-300/30 bg-white/5 px-3 py-3 text-sm text-white outline-none"
                />
              )}
            </label>
          )
        })}
      </div>
      {resting.length > 0 && <p className="mt-4 text-sm font-bold text-orange-200">Resting: <span className="text-white">{joinNames(resting)}</span></p>}
    </div>
  )
}

function AdminView({ players, fixtures, matches }: { players: PlayerStanding[]; fixtures: Fixture[]; matches: MatchRecord[] }) {
  const router = useRouter()
  const nextMatch = upcomingFixture(fixtures)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<null | "lineup" | "add" | "result" | "skip" | "remove">(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState("")
  const [unlocking, startUnlock] = useTransition()
  const [dialog, setDialog] = useState<"edit" | "add" | null>(null)
  const [notice, setNotice] = useState("")
  const [editId, setEditId] = useState(nextMatch?.id ?? "")
  const [editSlots, setEditSlots] = useState<SlotValue[]>(() => slotsFromFixture(nextMatch))
  const [editError, setEditError] = useState("")
  const [addDate, setAddDate] = useState("")
  const [addTime, setAddTime] = useState("19:00")
  const [addSlots, setAddSlots] = useState<SlotValue[]>(emptySlots)
  const [addError, setAddError] = useState("")
  const [resultSaved, setResultSaved] = useState("")
  const [resultError, setResultError] = useState("")
  const [resultDate, setResultDate] = useState(nextMatch?.iso ?? "")
  const [resultSlots, setResultSlots] = useState<SlotValue[]>(() => slotsFromFixture(nextMatch))
  const [skipReason, setSkipReason] = useState("")
  const [score, setScore] = useState("2-0")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState("")

  const selectedLineup = fixtures.find((item) => item.iso === resultDate)?.slots.map((slot) => `${slot.playerId ?? ""}:${slot.guestName ?? ""}`).join("|") ?? ""
  useEffect(() => {
    const fixture = fixtures.find((item) => item.iso === resultDate)
    if (fixture) setResultSlots(slotsFromFixture(fixture))
  }, [selectedLineup])

  const resultIssue = slotProblem(resultSlots)
  const editIssue = slotProblem(editSlots)
  const addIssue = slotProblem(addSlots)

  function showNotice(message: string) {
    setNotice(message)
    setTimeout(() => setNotice(""), 2500)
  }

  function selectEdit(id: string) {
    const fixture = fixtures.find((item) => item.id === id)
    setEditId(id)
    setEditSlots(slotsFromFixture(fixture))
    setEditError("")
  }

  function selectResultDate(iso: string) {
    const fixture = fixtures.find((item) => item.iso === iso)
    setResultDate(iso)
    setResultSlots(slotsFromFixture(fixture))
    setResultError("")
    setResultSaved("")
  }

  function unlock() {
    setPinError("")
    startUnlock(async () => {
      const result = await unlockAdmin(pin)
      if (!result.ok) {
        setPinError(result.error)
        return
      }
      setUnlocked(true)
    })
  }

  function saveLineup() {
    setEditError(editIssue)
    if (editIssue) return
    setBusy("lineup")
    startTransition(async () => {
      const result = await updateFixtureLineup(pin, { id: editId, slots: toSlotInputs(editSlots) })
      setBusy(null)
      if (!result.ok) {
        setEditError(result.error)
        return
      }
      setDialog(null)
      showNotice("Lineup saved")
      router.refresh()
    })
  }

  function saveAddedMatch() {
    if (!addDate) {
      setAddError("Choose a valid match date.")
      return
    }
    if (fixtures.some((fixture) => fixture.day === addDate)) {
      setAddError("That date is already on the schedule. Edit that match instead.")
      return
    }
    setAddError(addIssue)
    if (addIssue) return
    setBusy("add")
    startTransition(async () => {
      const result = await createFixture(pin, { date: addDate, time: addTime, slots: toSlotInputs(addSlots) })
      setBusy(null)
      if (!result.ok) {
        setAddError(result.error)
        return
      }
      setDialog(null)
      setAddDate("")
      setAddSlots(emptySlots())
      showNotice("Match added")
      router.refresh()
    })
  }

  function saveResult() {
    const fixture = fixtures.find((item) => item.iso === resultDate)
    setResultError(resultIssue)
    if (!fixture || resultIssue) return
    const [team1SetsWon, team2SetsWon] = score.split("-").map(Number)
    setBusy("result")
    startTransition(async () => {
      const result = await submitMatchResult(pin, {
        date: fixture.iso,
        slots: toSlotInputs(resultSlots),
        team1SetsWon,
        team2SetsWon,
      })
      setBusy(null)
      if (!result.ok) {
        setResultError(result.error)
        setResultSaved("")
        return
      }
      setResultSaved("Result saved")
      setResultError("")
      router.refresh()
      setTimeout(() => setResultSaved(""), 2500)
    })
  }

  function skipResult() {
    const fixture = fixtures.find((item) => item.iso === resultDate)
    if (!fixture) {
      setResultError("Choose a valid match date.")
      return
    }
    setBusy("skip")
    startTransition(async () => {
      const result = await skipMatchResult(pin, { date: fixture.iso, reason: skipReason.trim() || null })
      setBusy(null)
      if (!result.ok) {
        setResultError(result.error)
        setResultSaved("")
        return
      }
      setResultSaved("Match skipped")
      setResultError("")
      setSkipReason("")
      router.refresh()
      setTimeout(() => setResultSaved(""), 2500)
    })
  }

  function removeResult(id: string) {
    setBusy("remove")
    setRemoveError("")
    startTransition(async () => {
      const result = await deleteMatchResult(pin, id)
      setBusy(null)
      if (!result.ok) {
        setRemoveError(result.error)
        return
      }
      setConfirmId(null)
      showNotice("Result removed")
      router.refresh()
    })
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md py-8">
        <div className="glass-card rounded-3xl p-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-lime-300 text-slate-950"><LockKeyhole className="size-6" /></div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">Restricted area</p>
          <h2 className="mt-2 text-2xl font-black text-white">Captain&apos;s corner</h2>
          <input aria-label="League PIN" type="password" autoComplete="current-password" maxLength={64} value={pin} onChange={(event) => setPin(event.target.value)} className="mt-7 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-2xl font-black tracking-[0.4em] text-white outline-none" placeholder="••••" />
          {pinError && <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200">{pinError}</p>}
          <button disabled={!pin || unlocking} onClick={unlock} className="mt-3 w-full rounded-2xl bg-lime-300 px-4 py-3.5 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{unlocking ? "CHECKING…" : "UNLOCK ADMIN"}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {dialog === "edit" && (
        <Modal title="Edit schedule" eyebrow="Change a lineup" onClose={() => setDialog(null)}>
          <label className="flex flex-col gap-2 text-xs font-bold text-slate-400">
            Match
            <select value={editId} onChange={(event) => selectEdit(event.target.value)} className={fieldClass}>
              {fixtures.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixture.date}</option>)}
            </select>
          </label>
          <div className="mt-5">
            <CourtFields slots={editSlots} onChange={setEditSlots} players={players} />
          </div>
          {editError && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200">{editError}</p>}
          <button disabled={Boolean(editIssue) || pending} onClick={saveLineup} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {busy === "lineup" ? "Saving…" : "Save lineup"}
          </button>
        </Modal>
      )}
      {dialog === "add" && (
        <Modal title="Add match to schedule" eyebrow="A date that is not on the list yet" onClose={() => setDialog(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs font-bold text-slate-400">
              Date
              <input aria-label="Match date" type="date" value={addDate} onChange={(event) => { setAddDate(event.target.value); setAddError("") }} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-2 text-xs font-bold text-slate-400">
              Time
              <input aria-label="Match time" type="time" value={addTime} onChange={(event) => setAddTime(event.target.value)} className={fieldClass} />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Time is Europe/Amsterdam. 19:00 is the usual kickoff.</p>
          <div className="mt-5">
            <CourtFields slots={addSlots} onChange={setAddSlots} players={players} />
          </div>
          {addError && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200">{addError}</p>}
          <button disabled={Boolean(addIssue) || !addDate || pending} onClick={saveAddedMatch} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {busy === "add" ? "Saving…" : "Add match"}
          </button>
        </Modal>
      )}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">League management</p>
        <h2 className="mt-1 text-2xl font-black text-white">Admin dashboard</h2>
      </div>
      <section className="glass-card rounded-3xl p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">Last-minute changes</p>
        <h3 className="mt-1 text-xl font-black text-white">Match schedule</h3>
        <p className="mt-2 text-sm text-slate-400">Change the lineup of a planned match, or add one that is not on the Monday list.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => { selectEdit(editId || nextMatch?.id || ""); setDialog("edit") }} className="rounded-xl bg-lime-300 px-4 py-3 text-xs font-black text-slate-950">Edit schedule</button>
          <button onClick={() => { setAddError(""); setDialog("add") }} className="rounded-xl border border-lime-300/40 px-4 py-3 text-xs font-black text-lime-200">Add match to schedule</button>
        </div>
        {notice && <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-lime-300"><Check className="size-4" /> {notice}</p>}
      </section>
      <section className="glass-card rounded-3xl p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">After the final whistle</p>
        <h3 className="mt-1 text-xl font-black text-white">Submit Match Result</h3>
        <div className="mt-6">
          <label className="flex flex-col gap-2 text-xs font-bold text-slate-400">
            Date
            <select value={resultDate} onChange={(event) => selectResultDate(event.target.value)} className={fieldClass}>
              {fixtures.map((fixture) => <option key={fixture.id} value={fixture.iso}>{fixture.date}</option>)}
            </select>
          </label>
          <div className="mt-4">
            <CourtFields slots={resultSlots} onChange={setResultSlots} players={players} />
          </div>
        </div>
        <label className="mt-4 flex flex-col gap-2 text-xs font-bold text-slate-400">
          Sets won
          <select value={score} onChange={(event) => setScore(event.target.value)} className={fieldClass}>
            {["2-0", "2-1", "1-2", "0-2"].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        {resultIssue && <p className="mt-4 text-xs font-bold text-slate-500">{resultIssue}</p>}
        {resultError && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200">{resultError}</p>}
        <button disabled={Boolean(resultIssue) || pending} onClick={saveResult} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
          {resultSaved === "Result saved" ? <><Check className="size-4" /> Result saved</> : busy === "result" ? "Saving…" : "Save Result"}
        </button>
        <div className="mt-6 rounded-2xl border border-white/10 p-4">
          <p className="text-xs font-black text-white">No real result</p>
          <p className="mt-1 text-xs text-slate-500">Skip the week when it was called off, or when it should not count.</p>
          <label className="mt-4 flex flex-col gap-2 text-xs font-bold text-slate-400">
            Reason
            <input aria-label="Skip reason" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} placeholder="Optional, like called off" className={fieldClass} />
          </label>
          <button disabled={pending || !resultDate} onClick={skipResult} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
            {resultSaved === "Match skipped" ? <><Check className="size-4" /> Match skipped</> : busy === "skip" ? "Skipping…" : "Skip this match"}
          </button>
        </div>
      </section>
      <section className="glass-card rounded-3xl p-5 sm:p-7">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-red-300">Corrections</p>
        <h3 className="mt-1 text-xl font-black text-white">Remove a result</h3>
        <p className="mt-2 text-sm text-slate-400">Takes the score off the board and puts the points back. The match stays on the schedule.</p>
        {matches.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No results saved yet.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {matches.map((result) => (
              <div key={result.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-white">{resultSummary(result)}</p>
                {confirmId === result.id ? (
                  <div className="flex shrink-0 gap-2">
                    <button disabled={pending} onClick={() => removeResult(result.id)} className="rounded-xl bg-red-400 px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{busy === "remove" ? "Removing…" : "Remove it"}</button>
                    <button disabled={pending} onClick={() => { setConfirmId(null); setRemoveError("") }} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Keep it</button>
                  </div>
                ) : (
                  <button onClick={() => { setConfirmId(result.id); setRemoveError("") }} className="shrink-0 rounded-xl border border-red-400/40 px-3 py-2 text-xs font-black text-red-200">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}
        {removeError && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200">{removeError}</p>}
      </section>
    </div>
  )
}

export function LeagueApp({ players, matches, fixtures }: { players: PlayerStanding[]; matches: MatchRecord[]; fixtures: Fixture[] }) {
  const [active, setActive] = useState("home")
  return (
    <main className="min-h-screen bg-[#08111f] pb-24 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Header active={active} setActive={setActive} />
        {active === "home" ? <HomeView goRankings={() => setActive("rankings")} players={players} matches={matches} fixtures={fixtures} /> : active === "rankings" ? <RankingsView players={players} matches={matches} /> : <AdminView players={players} fixtures={fixtures} matches={matches} />}
      </div>
    </main>
  )
}
