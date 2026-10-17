import { describe, expect, it } from 'vitest'
import { makeApp, makeData, makeDoc } from '../test/factories'
import { initialState, reducer } from './reducer'
import type { PersistedState } from './reducer'

const asOf = '2026-02-15'
const APP = 'APP-2026-0001'

function deepFreeze<T>(o: T): T {
  Object.values(o as object).forEach(v => typeof v === 'object' && v !== null && deepFreeze(v))
  return Object.freeze(o)
}

function stateWith(...docs: Parameters<typeof makeDoc>[0][]): PersistedState {
  return deepFreeze(initialState(makeData([makeApp({ lastActivity: '2026-01-01' })], docs.map(d => makeDoc(d)))))
}
const doc = (s: PersistedState, type: string) => s.data.documents.find(d => d.type === type)!
const app = (s: PersistedState) => s.data.applications[0]

describe('reducer', () => {
  it('starts with no as-of override and never exported', () => {
    expect(stateWith()).toMatchObject({ version: 1, asOfOverride: null, lastExportedAt: null })
  })

  it('setStatus Received fills received and expiration dates and last activity', () => {
    const s = reducer(stateWith({ type: 'Bank Statements (90 day)' }),
      { type: 'setStatus', appId: APP, docType: 'Bank Statements (90 day)', status: 'Received', asOf })
    expect(doc(s, 'Bank Statements (90 day)')).toMatchObject({ status: 'Received', dateReceived: '2026-02-15', expirationDate: '2026-05-16' })
    expect(app(s).lastActivity).toBe('2026-02-15')
  })

  it('setStatus Pending keeps existing dates', () => {
    const s = reducer(stateWith({ type: 'Bank Statements (90 day)', status: 'Received', dateReceived: '2026-01-01', expirationDate: '2026-04-01' }),
      { type: 'setStatus', appId: APP, docType: 'Bank Statements (90 day)', status: 'Pending', asOf })
    expect(doc(s, 'Bank Statements (90 day)')).toMatchObject({ status: 'Pending', dateReceived: '2026-01-01', expirationDate: '2026-04-01' })
  })

  it('setStatus Approved on a non-expiring type fills only the received date', () => {
    const s = reducer(stateWith({ type: 'Lease Agreement' }), { type: 'setStatus', appId: APP, docType: 'Lease Agreement', status: 'Approved', asOf })
    expect(doc(s, 'Lease Agreement')).toMatchObject({ dateReceived: '2026-02-15', expirationDate: null })
  })

  it('updateDocument with a received date auto-fills expiration', () => {
    const s = reducer(stateWith({ type: 'Insurance Verification' }),
      { type: 'updateDocument', appId: APP, docType: 'Insurance Verification', patch: { dateReceived: '2025-12-18' }, asOf })
    expect(doc(s, 'Insurance Verification')).toMatchObject({ dateReceived: '2025-12-18', expirationDate: '2026-12-18' })
    expect(app(s).lastActivity).toBe('2026-02-15')
  })

  it('updateDocument keeps an explicitly set expiration date', () => {
    const s = reducer(stateWith({ type: 'Insurance Verification' }),
      { type: 'updateDocument', appId: APP, docType: 'Insurance Verification', patch: { dateReceived: '2025-12-18', expirationDate: '2026-06-01' }, asOf })
    expect(doc(s, 'Insurance Verification').expirationDate).toBe('2026-06-01')
  })

  it('markNotRequired puts the reason before existing notes', () => {
    const s = reducer(stateWith({ type: 'Lease Agreement', status: 'Needs Decision', notes: 'Waiting on borrower' }),
      { type: 'markNotRequired', appId: APP, docType: 'Lease Agreement', reason: 'Waived per SBA guidelines', asOf })
    expect(doc(s, 'Lease Agreement')).toMatchObject({ status: 'Not Required', notes: 'Waived per SBA guidelines — Waiting on borrower' })
    const t = reducer(stateWith({ type: 'Lease Agreement' }),
      { type: 'markNotRequired', appId: APP, docType: 'Lease Agreement', reason: 'Other', asOf })
    expect(doc(t, 'Lease Agreement').notes).toBe('Other')
  })

  it('addApplication creates 12 Needs Decision documents', () => {
    const s = reducer(stateWith(), {
      type: 'addApplication', id: 'APP-2026-0002', asOf,
      values: { businessName: 'New', borrowerName: 'B', loanAmount: 5, applicationDate: '2026-02-01', processor: 'P' },
    })
    expect(s.data.applications[1]).toMatchObject({ id: 'APP-2026-0002', businessName: 'New', lastActivity: '2026-02-15' })
    const docs = s.data.documents.filter(d => d.applicationId === 'APP-2026-0002')
    expect(docs).toHaveLength(12)
    expect(docs.every(d => d.status === 'Needs Decision')).toBe(true)
  })

  it('editApplication replaces details and updates last activity', () => {
    const s = reducer(stateWith(), {
      type: 'editApplication', appId: APP, asOf,
      values: { businessName: 'Renamed', borrowerName: 'B', loanAmount: 7, applicationDate: '2026-02-01', processor: 'Janet Morrison' },
    })
    expect(app(s)).toMatchObject({ id: APP, businessName: 'Renamed', processor: 'Janet Morrison', lastActivity: '2026-02-15' })
  })

  it('deleteApplication removes the application and its documents', () => {
    const s = reducer(stateWith({ type: 'Lease Agreement' }, { type: 'Debt Schedule' }), { type: 'deleteApplication', appId: APP })
    expect(s.data).toEqual({ applications: [], documents: [] })
  })

  it('replaceData, setAsOf, and markExported', () => {
    const base = stateWith()
    expect(reducer(base, { type: 'replaceData', data: makeData([], []) }).data.applications).toEqual([])
    expect(reducer(base, { type: 'setAsOf', date: '2026-02-15' }).asOfOverride).toBe('2026-02-15')
    expect(reducer(base, { type: 'setAsOf', date: '' }).asOfOverride).toBeNull()
    expect(reducer(base, { type: 'markExported', at: '2026-10-17' }).lastExportedAt).toBe('2026-10-17')
  })
})
