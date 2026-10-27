const TIME_ZONE = "Europe/Amsterdam"

export function formatMatchDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(iso))
}

export function amsterdamDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

/** Civil date (YYYY-MM-DD) and time (HH:MM) in Europe/Amsterdam, as an ISO instant. */
export function amsterdamDateTime(date: string, time: string) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const clock = /^(\d{2}):(\d{2})$/.exec(time)
  if (!day || !clock) {
    throw new Error("Choose a valid match date.")
  }

  const year = Number(day[1])
  const month = Number(day[2])
  const dateNumber = Number(day[3])
  const hour = Number(clock[1])
  const minute = Number(clock[2])
  if (month < 1 || month > 12 || dateNumber < 1 || dateNumber > 31 || hour > 23 || minute > 59) {
    throw new Error("Choose a valid match date.")
  }

  for (const offsetHours of [1, 2]) {
    const instant = new Date(Date.UTC(year, month - 1, dateNumber, hour - offsetHours, minute, 0))
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant)
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    if (value("year") === year && value("month") === month && value("day") === dateNumber && value("hour") === hour && value("minute") === minute) {
      return instant.toISOString()
    }
  }

  throw new Error("Choose a valid match date.")
}
