import { addDays, daysBetween } from './dates'
import { EXPIRING_SOON_DAYS, EXPIRY_DAYS, STALLED_DAYS } from './settings'
import type { Application, ChecklistDocument, DocType, IsoDate, Status } from './types'

export type StatusGroup = 'outstanding' | 'in-progress' | 'done' | 'needs-decision'

export function statusGroup(s: Status): StatusGroup {
  switch (s) {
    case 'Pending':
    case 'Expired':
      return 'outstanding'
    case 'Received':
    case 'Under Review':
      return 'in-progress'
    case 'Approved':
    case 'Not Required':
      return 'done'
    case 'Needs Decision':
      return 'needs-decision'
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
  done: number
  needsDecision: number
  expired: number
  expiringSoon: number
  idleDays: number
  stalled: boolean
}

export function summarizeApplication(app: Application, docs: ChecklistDocument[], asOf: IsoDate): AppSummary {
  let outstanding = 0, done = 0, needsDecision = 0, expired = 0, expiringSoon = 0
  for (const d of docs) {
    const group = statusGroup(d.status)
    if (group === 'outstanding') outstanding++
    else if (group === 'done') done++
    else if (group === 'needs-decision') needsDecision++
    const badge = expiryBadge(d, asOf)
    if (badge?.kind === 'expired') expired++
    else if (badge?.kind === 'soon') expiringSoon++
  }
  const idle = idleDays(app, asOf)
  return {
    app, documents: docs, outstanding, done, needsDecision, expired, expiringSoon,
    idleDays: idle,
    stalled: outstanding > 0 && idle >= STALLED_DAYS,
  }
}
