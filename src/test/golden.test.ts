import { describe, expect, it } from 'vitest'
import { importCsv } from '../data/csvImport'
import sampleCsv from './fixtures/sample.csv?raw'
import { buildSummaries, cardCounts } from '../domain/pipeline'
import type { AppSummary } from '../domain/rules'
import { expiryBadge } from '../domain/rules'

// Figures verified independently against the sample CSV (spec §10). If one fails, fix the rule, not the figure.
const result = importCsv(sampleCsv)
if (!result.ok) throw new Error(result.error)
const data = result.data
const asOf = '2026-02-15'
const s = buildSummaries(data, asOf)
const ids = (l: AppSummary[]) => l.map(x => x.app.id).sort()

describe('golden figures (sample data as of 2026-02-15)', () => {
  it('outstanding', () => expect(s.filter(x => x.outstanding > 0)).toHaveLength(57))

  it('not needed', () => {
    expect(data.documents.filter(d => d.status === 'Not Required')).toHaveLength(126)
    expect(s.filter(x => x.needed < 12)).toHaveLength(48)
  })

  it('stalled', () =>
    expect(ids(s.filter(x => x.stalled))).toEqual([
      'APP-2026-1002', 'APP-2026-1005', 'APP-2026-1010', 'APP-2026-1012', 'APP-2026-1014', 'APP-2026-1020',
      'APP-2026-1035', 'APP-2026-1047', 'APP-2026-1053', 'APP-2026-1056', 'APP-2026-1060',
    ]))

  it('expiry badges', () => {
    expect(s.reduce((n, x) => n + x.expired, 0)).toBe(6)
    expect(s.reduce((n, x) => n + x.expiringSoon, 0)).toBe(1)
  })

  it('unflagged expired bank statements', () => {
    const hits = data.documents
      .filter(d => d.type === 'Bank Statements (90 day)' && d.status !== 'Expired' && expiryBadge(d, asOf)?.kind === 'expired')
      .map(d => d.applicationId)
      .sort()
    expect(hits).toEqual(['APP-2026-1006', 'APP-2026-1009', 'APP-2026-1010', 'APP-2026-1021'])
  })

  it('stalled by processor', () => {
    for (const [p, n] of [['Aisha Patel', 5], ['Ricardo Fuentes', 4], ['Janet Morrison', 2]] as const)
      expect(cardCounts(s, { search: '', processor: p }).stalled).toBe(n)
  })

  it('card counts', () =>
    expect(cardCounts(s, { search: '', processor: null })).toEqual({ all: 60, stalled: 11, expired: 6, expiring: 1 }))

  it('fully complete', () => expect(s.filter(x => x.complete)).toHaveLength(0))
})
