import { addDays, daysBetween } from './dates'
import { EXPIRING_SOON_DAYS, EXPIRY_DAYS, NOT_ON_IMPORT_NOTE, NOT_REQUIRED_REASONS, STALLED_DAYS } from './settings'
import type { Application, ChecklistDocument, DocType, IsoDate, Status } from './types'

/** 'not-needed' = Not Required: unticked from this application's checklist and excluded from progress. */
export type StatusGroup = 'outstanding' | 'in-progress' | 'done' | 'not-needed'

export function statusGroup(s: Status): StatusGroup {
  switch (s) {
    case 'Pending':
    case 'Expired':
      return 'outstanding'
    case 'Received':
    case 'Under Review':
      return 'in-progress'
    case 'Approved':
      return 'done'
    case 'Not Required':
      return 'not-needed'
  }
}

export type ExpiryBadge = { kind: 'expired'; daysAgo: number } | { kind: 'soon'; daysLeft: number } | null

/** Date-based expiry, independent of the stored status (spec §5 "Status vs. expiry"). */
export function expiryBadge(doc: ChecklistDocument, asOf: IsoDate): ExpiryBadge {
  if (!doc.expirationDate || doc.status === 'Not Required') return null
  const daysLeft = daysBetween(asOf, doc.expirationDate)
  if (daysLeft < 0) return { kind: 'expired', daysAgo: -daysLeft }
  if (daysLeft <= EXPIRING_SOON_DAYS) return { kind: 'soon', daysLeft }
  return null
}

const NOT_NEEDED_REASONS: string[] = [...NOT_REQUIRED_REASONS, NOT_ON_IMPORT_NOTE]

/** Splits a not-needed document's notes into its reason (one of the known reasons, if it leads) and the rest. */
export function splitNotNeededReason(notes: string): { reason: string; rest: string } {
  const reason = NOT_NEEDED_REASONS.find(r => notes === r || notes.startsWith(`${r} — `))
  return reason ? { reason, rest: notes.slice(reason.length).replace(/^ — /, '') } : { reason: '', rest: notes }
}

/** Puts `reason` at the start of the notes, replacing an earlier reason rather than stacking them. */
export function withNotNeededReason(notes: string, reason: string): string {
  const { rest } = splitNotNeededReason(notes)
  if (!reason) return rest
  return rest ? `${reason} — ${rest}` : reason
}

export function autoExpirationDate(type: DocType, dateReceived: IsoDate): IsoDate | null {
  const days = EXPIRY_DAYS[type]
  return days === undefined ? null : addDays(dateReceived, days)
}

export function idleDays(app: Application, asOf: IsoDate): number {
  return Math.max(0, daysBetween(app.lastActivity, asOf))
}

export interface AppSummary {
  app: Application
  documents: ChecklistDocument[]
  outstanding: number
  /** Approved documents among the needed ones. */
  done: number
  /** Documents on the checklist (everything except Not Required). */
  needed: number
  /** Every needed document is approved. */
  complete: boolean
  expired: number
  expiringSoon: number
  idleDays: number
  stalled: boolean
}

export function summarizeApplication(app: Application, docs: ChecklistDocument[], asOf: IsoDate): AppSummary {
  let outstanding = 0, done = 0, needed = 0, expired = 0, expiringSoon = 0
  for (const d of docs) {
    const group = statusGroup(d.status)
    if (group !== 'not-needed') needed++
    if (group === 'outstanding') outstanding++
    else if (group === 'done') done++
    const badge = expiryBadge(d, asOf)
    if (badge?.kind === 'expired') expired++
    else if (badge?.kind === 'soon') expiringSoon++
  }
  const idle = idleDays(app, asOf)
  return {
    app, documents: docs, outstanding, done, needed, expired, expiringSoon,
    complete: needed > 0 && done === needed,
    idleDays: idle,
    stalled: outstanding > 0 && idle >= STALLED_DAYS,
  }
}
