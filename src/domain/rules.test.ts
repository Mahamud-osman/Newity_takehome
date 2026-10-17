import { describe, expect, it } from 'vitest'
import { makeApp, makeDoc } from '../test/factories'
import { autoExpirationDate, expiryBadge, statusGroup, summarizeApplication } from './rules'

const asOf = '2026-02-15'

describe('rules', () => {
  it('groups statuses', () => {
    expect(statusGroup('Pending')).toBe('outstanding')
    expect(statusGroup('Expired')).toBe('outstanding')
    expect(statusGroup('Received')).toBe('in-progress')
    expect(statusGroup('Under Review')).toBe('in-progress')
    expect(statusGroup('Approved')).toBe('done')
    expect(statusGroup('Not Required')).toBe('not-needed')
  })

  it('computes expiry badges', () => {
    expect(expiryBadge(makeDoc({ expirationDate: '2026-02-14' }), asOf)).toEqual({ kind: 'expired', daysAgo: 1 })
    expect(expiryBadge(makeDoc({ expirationDate: '2026-02-15' }), asOf)).toEqual({ kind: 'soon', daysLeft: 0 })
    expect(expiryBadge(makeDoc({ expirationDate: '2026-03-01' }), asOf)).toEqual({ kind: 'soon', daysLeft: 14 })
    expect(expiryBadge(makeDoc({ expirationDate: '2026-03-02' }), asOf)).toBeNull()
    expect(expiryBadge(makeDoc({ expirationDate: null }), asOf)).toBeNull()
    expect(expiryBadge(makeDoc({ status: 'Not Required', expirationDate: '2025-01-01' }), asOf)).toBeNull()
    expect(expiryBadge(makeDoc({ status: 'Approved', expirationDate: '2026-01-13' }), asOf)).toEqual({ kind: 'expired', daysAgo: 33 })
  })

  it('auto-fills expiration dates', () => {
    expect(autoExpirationDate('Bank Statements (90 day)', '2026-01-01')).toBe('2026-04-01')
    expect(autoExpirationDate('Business Tax Returns (3yr)', '2024-01-01')).toBe('2026-12-31')
    expect(autoExpirationDate('Personal Tax Returns (3yr)', '2026-01-29')).toBe('2029-01-28')
    expect(autoExpirationDate('Insurance Verification', '2025-12-18')).toBe('2026-12-18')
    expect(autoExpirationDate('Lease Agreement', '2026-01-01')).toBeNull()
  })

  it('flags stalled at exactly 21 idle days with outstanding docs', () => {
    const docs = [makeDoc({ status: 'Pending' })]
    expect(summarizeApplication(makeApp({ lastActivity: '2026-01-26' }), docs, asOf).stalled).toBe(false)
    expect(summarizeApplication(makeApp({ lastActivity: '2026-01-25' }), docs, asOf).stalled).toBe(true)
    expect(summarizeApplication(makeApp({ lastActivity: '2026-01-16' }), [makeDoc({ status: 'Received' })], asOf).stalled).toBe(false)
  })

  it('clamps idle days at 0', () => {
    const s = summarizeApplication(makeApp({ lastActivity: '2026-03-01' }), [makeDoc()], asOf)
    expect(s.idleDays).toBe(0)
    expect(s.stalled).toBe(false)
  })

  it('counts progress against needed documents only', () => {
    const docs = [
      makeDoc({ status: 'Pending' }),
      makeDoc({ status: 'Expired' }),
      makeDoc({ status: 'Approved', expirationDate: '2026-02-01' }),
      makeDoc({ status: 'Not Required' }),
      makeDoc({ status: 'Received', expirationDate: '2026-02-20' }),
    ]
    const s = summarizeApplication(makeApp(), docs, asOf)
    expect([s.outstanding, s.done, s.needed, s.expired, s.expiringSoon]).toEqual([2, 1, 4, 1, 1])
  })

  it('is complete when every needed document is approved', () => {
    const docs = [makeDoc({ status: 'Approved' }), makeDoc({ status: 'Not Required' })]
    expect(summarizeApplication(makeApp(), docs, asOf).complete).toBe(true)
    expect(summarizeApplication(makeApp(), [makeDoc({ status: 'Not Required' })], asOf).complete).toBe(false)
  })
})
