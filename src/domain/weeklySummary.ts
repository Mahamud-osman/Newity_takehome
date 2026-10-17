import { formatLongDate } from './dates'
import { buildSummaries, processorsOf } from './pipeline'
import { expiryBadge } from './rules'
import { EXPIRING_SOON_DAYS, STALLED_DAYS } from './settings'
import type { ChecklistData, IsoDate } from './types'

/** Plain-text pipeline snapshot for the team lead's Monday email (spec §6). Ignores home-page filters. */
export function buildWeeklySummary(data: ChecklistData, asOf: IsoDate): string {
  const summaries = buildSummaries(data, asOf)
  const stalled = summaries
    .filter(s => s.stalled)
    .sort((a, b) => b.idleDays - a.idleDays || a.app.id.localeCompare(b.app.id))
  const expiredDocs = data.documents.filter(d => expiryBadge(d, asOf)?.kind === 'expired')
  const expiringDocs = data.documents.filter(d => expiryBadge(d, asOf)?.kind === 'soon')
  const expiredBank = expiredDocs.filter(d => d.type === 'Bank Statements (90 day)').length
  const volume = data.applications.reduce((n, a) => n + a.loanAmount, 0)

  const bankNote = expiredBank > 0 ? ` (${expiredBank} bank statement${expiredBank === 1 ? '' : 's'})` : ''
  const lines = [
    `SBA Pipeline Summary — as of ${formatLongDate(asOf)}`,
    '',
    'PIPELINE',
    `  ${summaries.length} active applications · $${(volume / 1_000_000).toFixed(2)}M total loan volume`,
    `  ${summaries.filter(s => s.outstanding > 0).length} waiting on documents · ${summaries.filter(s => s.complete).length} fully complete`,
    '',
    'NEEDS ATTENTION',
    `  Stalled (no documents in ${STALLED_DAYS}+ days): ${stalled.length}`,
    ...stalled.map(s =>
      `    ${s.app.id} ${s.app.businessName} — ${s.idleDays} days, ${s.outstanding} outstanding (${s.app.processor})`),
    `  Expired documents: ${expiredDocs.length}${bankNote}`,
    `  Expiring in the next ${EXPIRING_SOON_DAYS} days: ${expiringDocs.length}`,
    '',
    'BY PROCESSOR',
    ...processorsOf(data).map(p => {
      const mine = summaries.filter(s => s.app.processor === p)
      return `  ${p} — ${mine.length} applications, ${mine.filter(s => s.stalled).length} stalled`
    }),
  ]
  return lines.join('\n')
}
