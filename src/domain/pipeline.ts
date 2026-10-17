import { expiryBadge, statusGroup, summarizeApplication } from './rules'
import type { AppSummary } from './rules'
import { DOC_TYPES } from './types'
import type { ChecklistData, ChecklistDocument, IsoDate } from './types'

export type Card = 'all' | 'stalled' | 'expired' | 'expiring'
export const CARDS: Card[] = ['all', 'stalled', 'expired', 'expiring']

export interface HomeFilter {
  card: Card
  search: string
  processor: string | null
}

export type SortKey = 'id' | 'business' | 'processor' | 'idle' | 'progress' | 'outstanding'
export interface SortSpec {
  key: SortKey
  dir: 'asc' | 'desc'
}

export function buildSummaries(data: ChecklistData, asOf: IsoDate): AppSummary[] {
  const docsByApp = new Map<string, ChecklistDocument[]>()
  for (const d of data.documents) {
    const list = docsByApp.get(d.applicationId)
    if (list) list.push(d)
    else docsByApp.set(d.applicationId, [d])
  }
  return data.applications.map(a => summarizeApplication(a, docsByApp.get(a.id) ?? [], asOf))
}

export function matchesCard(s: AppSummary, card: Card): boolean {
  switch (card) {
    case 'all': return true
    case 'stalled': return s.stalled
    case 'expired': return s.expired > 0
    case 'expiring': return s.expiringSoon > 0
  }
}

function matchesSearchAndProcessor(s: AppSummary, search: string, processor: string | null): boolean {
  if (processor !== null && s.app.processor !== processor) return false
  const q = search.trim().toLowerCase()
  if (q === '') return true
  return [s.app.businessName, s.app.borrowerName, s.app.id].some(v => v.toLowerCase().includes(q))
}

export function filterSummaries(list: AppSummary[], f: HomeFilter): AppSummary[] {
  return list.filter(s => matchesCard(s, f.card) && matchesSearchAndProcessor(s, f.search, f.processor))
}

/** Card counts after search and processor filters, so the cards recount per processor. */
export function cardCounts(list: AppSummary[], f: Omit<HomeFilter, 'card'>): Record<Card, number> {
  const scoped = list.filter(s => matchesSearchAndProcessor(s, f.search, f.processor))
  return Object.fromEntries(CARDS.map(c => [c, scoped.filter(s => matchesCard(s, c)).length])) as Record<Card, number>
}

const byDefault = (a: AppSummary, b: AppSummary) =>
  Number(b.stalled) - Number(a.stalled) ||
  b.outstanding - a.outstanding ||
  b.idleDays - a.idleDays ||
  a.app.id.localeCompare(b.app.id)

const sortValue: Record<SortKey, (s: AppSummary) => string | number> = {
  id: s => s.app.id,
  business: s => s.app.businessName.toLowerCase(),
  processor: s => s.app.processor.toLowerCase(),
  idle: s => s.idleDays,
  progress: s => s.done,
  outstanding: s => s.outstanding,
}

/** `null` means the default "needs attention" order: stalled, then most outstanding. */
export function sortSummaries(list: AppSummary[], sort: SortSpec | null): AppSummary[] {
  if (!sort) return [...list].sort(byDefault)
  const value = sortValue[sort.key]
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const va = value(a), vb = value(b)
    const cmp = typeof va === 'number' ? va - (vb as number) : va.localeCompare(vb as string)
    return sign * cmp || byDefault(a, b)
  })
}

export function processorsOf(data: ChecklistData): string[] {
  return [...new Set(data.applications.map(a => a.processor))].sort((a, b) => a.localeCompare(b))
}

function attentionRank(d: ChecklistDocument, asOf: IsoDate): number {
  const group = statusGroup(d.status)
  if (group !== 'not-needed' && expiryBadge(d, asOf)) return 0
  return { outstanding: 1, 'in-progress': 2, done: 3, 'not-needed': 4 }[group]
}

/** Expiry badge → outstanding → in progress → done → not needed; ties in DOC_TYPES order. */
export function sortChecklistDocuments(docs: ChecklistDocument[], asOf: IsoDate): ChecklistDocument[] {
  return [...docs].sort((a, b) =>
    attentionRank(a, asOf) - attentionRank(b, asOf) || DOC_TYPES.indexOf(a.type) - DOC_TYPES.indexOf(b.type))
}
