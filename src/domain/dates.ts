import type { IsoDate } from './types'

// All arithmetic is done in UTC on date-only values so the user's time zone
// can never shift a date by a day.

const DAY_MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** Earliest year accepted as real input; a half-typed date field briefly reports years like 0002. */
const MIN_YEAR = 1900

// Date.UTC maps years 0–99 to 1900–1999, so set the year explicitly.
function utcMs(year: number, monthIndex: number, day: number): number {
  const d = new Date(0)
  d.setUTCFullYear(year, monthIndex, day)
  return d.getTime()
}

function toIso(year: number, month: number, day: number): IsoDate | null {
  if (year < MIN_YEAR) return null
  const d = new Date(utcMs(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

function toUtcMs(d: IsoDate): number {
  const [y, m, day] = d.split('-').map(Number)
  return utcMs(y, m - 1, day)
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms)
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Parses 'M/D/YYYY' (leading zeros optional). Returns null for anything else or impossible dates. */
export function parseUsDate(s: string): IsoDate | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  return m ? toIso(Number(m[3]), Number(m[1]), Number(m[2])) : null
}

/** '2026-01-28' → '1/28/2026' */
export function formatUsDate(d: IsoDate): string {
  const [y, m, day] = d.split('-').map(Number)
  return `${m}/${day}/${y}`
}

/** '2026-02-15' → 'Feb 15, 2026' */
export function formatLongDate(d: IsoDate): string {
  const [y, m, day] = d.split('-').map(Number)
  return `${MONTHS[m - 1]} ${day}, ${y}`
}

export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m !== null && toIso(Number(m[1]), Number(m[2]), Number(m[3])) === s
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS)
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
}

/** The user's local calendar date. */
export function todayIso(): IsoDate {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
