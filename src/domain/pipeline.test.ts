import { describe, expect, it } from 'vitest'
import { makeApp, makeData, makeDoc } from '../test/factories'
import { buildSummaries, cardCounts, filterSummaries, processorsOf, sortChecklistDocuments, sortSummaries } from './pipeline'

const asOf = '2026-02-15'
const data = makeData(
  [
    makeApp({ id: 'APP-1', businessName: 'Hilltop Dental Care', borrowerName: 'Priya White', processor: 'Janet Morrison', lastActivity: '2026-02-10' }),
    makeApp({ id: 'APP-2', businessName: 'Bluebird Cafe', processor: 'Aisha Patel', lastActivity: '2026-01-01' }),
    makeApp({ id: 'APP-3', businessName: 'Zenith', processor: 'Aisha Patel', lastActivity: '2026-02-14' }),
  ],
  [
    makeDoc({ applicationId: 'APP-1', status: 'Pending' }),
    makeDoc({ applicationId: 'APP-1', status: 'Expired', type: 'Debt Schedule' }),
    makeDoc({ applicationId: 'APP-2', status: 'Pending' }),
    makeDoc({ applicationId: 'APP-3', status: 'Needs Decision' }),
  ],
)
const summaries = buildSummaries(data, asOf)
const ids = (l: { app: { id: string } }[]) => l.map(s => s.app.id)
const all = { card: 'all' as const, search: '', processor: null }

describe('pipeline', () => {
  it('searches business, borrower, and ID', () => {
    expect(ids(filterSummaries(summaries, { ...all, search: 'hilltop' }))).toEqual(['APP-1'])
    expect(ids(filterSummaries(summaries, { ...all, search: ' app-2 ' }))).toEqual(['APP-2'])
    expect(ids(filterSummaries(summaries, { ...all, search: 'priya' }))).toEqual(['APP-1'])
  })

  it('filters by processor and card', () => {
    expect(ids(filterSummaries(summaries, { ...all, processor: 'Aisha Patel' }))).toEqual(['APP-2', 'APP-3'])
    expect(ids(filterSummaries(summaries, { ...all, card: 'stalled' }))).toEqual(['APP-2'])
    expect(ids(filterSummaries(summaries, { ...all, card: 'needs-decision' }))).toEqual(['APP-3'])
  })

  it('recounts cards under a processor filter', () => {
    expect(cardCounts(summaries, { search: '', processor: null })).toMatchObject({ all: 3, stalled: 1, 'needs-decision': 1 })
    expect(cardCounts(summaries, { search: '', processor: 'Janet Morrison' })).toMatchObject({ all: 1, stalled: 0, 'needs-decision': 0 })
  })

  it('sorts stalled first, then most outstanding', () => {
    expect(ids(sortSummaries(summaries, null))).toEqual(['APP-2', 'APP-1', 'APP-3'])
    expect(ids(sortSummaries(summaries, { key: 'business', dir: 'asc' }))).toEqual(['APP-2', 'APP-1', 'APP-3'])
    expect(ids(sortSummaries(summaries, { key: 'outstanding', dir: 'desc' }))[0]).toBe('APP-1')
  })

  it('lists processors alphabetically', () => {
    expect(processorsOf(data)).toEqual(['Aisha Patel', 'Janet Morrison'])
  })

  it('orders checklist documents by what needs attention', () => {
    const docs = [
      makeDoc({ type: 'Bank Statements (90 day)', status: 'Approved' }),
      makeDoc({ type: 'SBA Form 912', status: 'Received' }),
      makeDoc({ type: 'Lease Agreement', status: 'Pending' }),
      makeDoc({ type: 'Debt Schedule', status: 'Approved', expirationDate: '2026-01-01' }),
      makeDoc({ type: 'SBA Form 1919', status: 'Needs Decision' }),
    ]
    expect(sortChecklistDocuments(docs, asOf).map(d => d.type)).toEqual([
      'SBA Form 1919', 'Debt Schedule', 'Lease Agreement', 'SBA Form 912', 'Bank Statements (90 day)',
    ])
  })
})
