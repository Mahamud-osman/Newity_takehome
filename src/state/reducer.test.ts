import { describe, expect, it } from 'vitest'
import { makeApp, makeData, makeDoc } from '../test/factories'
import { initialState, reducer } from './reducer'
import type { PersistedState } from './reducer'

const today = '2026-02-15'
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
      { type: 'setStatus', appId: APP, docType: 'Bank Statements (90 day)', status: 'Received', today })
    expect(doc(s, 'Bank Statements (90 day)')).toMatchObject({ status: 'Received', dateReceived: '2026-02-15', expirationDate: '2026-05-16' })
    expect(app(s).lastActivity).toBe('2026-02-15')
  })

  it('setStatus Pending keeps existing dates', () => {
    const s = reducer(stateWith({ type: 'Bank Statements (90 day)', status: 'Received', dateReceived: '2026-01-01', expirationDate: '2026-04-01' }),
      { type: 'setStatus', appId: APP, docType: 'Bank Statements (90 day)', status: 'Pending', today })
    expect(doc(s, 'Bank Statements (90 day)')).toMatchObject({ status: 'Pending', dateReceived: '2026-01-01', expirationDate: '2026-04-01' })
  })

  it('marking an expired document received treats it as a new document', () => {
    const s = reducer(stateWith({ type: 'Bank Statements (90 day)', status: 'Expired', dateReceived: '2025-09-29', expirationDate: '2025-12-28' }),
      { type: 'setStatus', appId: APP, docType: 'Bank Statements (90 day)', status: 'Received', today })
    expect(doc(s, 'Bank Statements (90 day)')).toMatchObject({ status: 'Received', dateReceived: '2026-02-15', expirationDate: '2026-05-16' })
  })

  it('marking a re-requested (Pending) document approved records a new receipt', () => {
    const s = reducer(stateWith({ type: 'Insurance Verification', status: 'Pending', dateReceived: '2025-01-10', expirationDate: '2026-01-10' }),
      { type: 'setStatus', appId: APP, docType: 'Insurance Verification', status: 'Approved', today })
    expect(doc(s, 'Insurance Verification')).toMatchObject({ dateReceived: '2026-02-15', expirationDate: '2027-02-15' })
  })

  it('moving between Received, Under Review, and Approved keeps the dates', () => {
    const s = reducer(stateWith({ type: 'Bank Statements (90 day)', status: 'Received', dateReceived: '2026-01-01', expirationDate: '2026-04-01' }),
      { type: 'setStatus', appId: APP, docType: 'Bank Statements (90 day)', status: 'Approved', today })
    expect(doc(s, 'Bank Statements (90 day)')).toMatchObject({ dateReceived: '2026-01-01', expirationDate: '2026-04-01' })
  })

  it('a new receipt of a non-expiring document clears the old expiration date', () => {
    const s = reducer(stateWith({ type: 'Business Licenses & Permits', status: 'Expired', dateReceived: '2025-01-01', expirationDate: '2025-12-31' }),
      { type: 'setStatus', appId: APP, docType: 'Business Licenses & Permits', status: 'Received', today })
    expect(doc(s, 'Business Licenses & Permits')).toMatchObject({ dateReceived: '2026-02-15', expirationDate: null })
  })

  it('setStatus Approved on a non-expiring type fills only the received date', () => {
    const s = reducer(stateWith({ type: 'Lease Agreement' }), { type: 'setStatus', appId: APP, docType: 'Lease Agreement', status: 'Approved', today })
    expect(doc(s, 'Lease Agreement')).toMatchObject({ dateReceived: '2026-02-15', expirationDate: null })
  })

  it('updateDocument with a received date auto-fills expiration', () => {
    const s = reducer(stateWith({ type: 'Insurance Verification' }),
      { type: 'updateDocument', appId: APP, docType: 'Insurance Verification', patch: { dateReceived: '2025-12-18' }, today })
    expect(doc(s, 'Insurance Verification')).toMatchObject({ dateReceived: '2025-12-18', expirationDate: '2026-12-18' })
    expect(app(s).lastActivity).toBe('2026-02-15')
  })

  it('updateDocument keeps an explicitly set expiration date', () => {
    const s = reducer(stateWith({ type: 'Insurance Verification' }),
      { type: 'updateDocument', appId: APP, docType: 'Insurance Verification', patch: { dateReceived: '2025-12-18', expirationDate: '2026-06-01' }, today })
    expect(doc(s, 'Insurance Verification').expirationDate).toBe('2026-06-01')
  })

  it('unticking marks a document not needed and keeps its notes', () => {
    const s = reducer(stateWith({ type: 'Lease Agreement', status: 'Pending', notes: 'Waiting on borrower' }),
      { type: 'setNeeded', appId: APP, docType: 'Lease Agreement', needed: false, today })
    expect(doc(s, 'Lease Agreement')).toMatchObject({ status: 'Not Required', notes: 'Waiting on borrower' })
    expect(app(s).lastActivity).toBe('2026-02-15')
  })

  it('re-ticking puts a document back on the checklist as Pending', () => {
    const s = reducer(stateWith({ type: 'Lease Agreement', status: 'Not Required', notes: 'Not on imported checklist' }),
      { type: 'setNeeded', appId: APP, docType: 'Lease Agreement', needed: true, today })
    expect(doc(s, 'Lease Agreement').status).toBe('Pending')
  })

  it('setting a not-needed reason replaces an earlier reason instead of stacking', () => {
    const base = stateWith({ type: 'Lease Agreement', status: 'Not Required', notes: 'Waiting on borrower' })
    const reason = (s: PersistedState, r: string) =>
      reducer(s, { type: 'setNotNeededReason', appId: APP, docType: 'Lease Agreement', reason: r, today })
    const a = reason(base, 'Waived per SBA guidelines')
    expect(doc(a, 'Lease Agreement').notes).toBe('Waived per SBA guidelines — Waiting on borrower')
    const b = reason(a, 'Exempt - sole proprietorship')
    expect(doc(b, 'Lease Agreement').notes).toBe('Exempt - sole proprietorship — Waiting on borrower')
    expect(doc(reason(b, ''), 'Lease Agreement').notes).toBe('Waiting on borrower')
    const imported = stateWith({ type: 'Debt Schedule', status: 'Not Required', notes: 'Not on imported checklist' })
    expect(doc(reducer(imported, { type: 'setNotNeededReason', appId: APP, docType: 'Debt Schedule', reason: 'Other', today }), 'Debt Schedule').notes).toBe('Other')
  })

  it('addApplication creates 12 Pending documents', () => {
    const s = reducer(stateWith(), {
      type: 'addApplication', id: 'APP-2026-0002', today,
      values: { businessName: 'New', borrowerName: 'B', loanAmount: 5, applicationDate: '2026-02-01', processor: 'P' },
    })
    expect(s.data.applications[1]).toMatchObject({ id: 'APP-2026-0002', businessName: 'New', lastActivity: '2026-02-15' })
    const docs = s.data.documents.filter(d => d.applicationId === 'APP-2026-0002')
    expect(docs).toHaveLength(12)
    expect(docs.every(d => d.status === 'Pending')).toBe(true)
  })

  it('editApplication replaces details and updates last activity', () => {
    const s = reducer(stateWith(), {
      type: 'editApplication', appId: APP, today,
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

  it('never moves last activity backwards when editing at a past as-of date', () => {
    const base = deepFreeze(initialState(makeData([makeApp({ lastActivity: '2026-10-10' })], [makeDoc()])))
    const s = reducer(base, { type: 'updateDocument', appId: APP, docType: 'Lease Agreement', patch: { notes: 'x' }, today: '2026-02-15' })
    expect(app(s).lastActivity).toBe('2026-10-10')
  })

  it('recomputes an auto-filled expiration when a new received date replaces the old one', () => {
    const s = reducer(stateWith({ type: 'Bank Statements (90 day)', status: 'Expired', dateReceived: '2025-07-18', expirationDate: '2025-10-16' }),
      { type: 'updateDocument', appId: APP, docType: 'Bank Statements (90 day)', patch: { dateReceived: '2026-02-10' }, today })
    expect(doc(s, 'Bank Statements (90 day)').expirationDate).toBe('2026-05-11')
  })

  it('keeps a manually set expiration when the received date changes', () => {
    const s = reducer(stateWith({ type: 'Bank Statements (90 day)', dateReceived: '2025-07-18', expirationDate: '2025-12-01' }),
      { type: 'updateDocument', appId: APP, docType: 'Bank Statements (90 day)', patch: { dateReceived: '2026-02-10' }, today })
    expect(doc(s, 'Bank Statements (90 day)').expirationDate).toBe('2025-12-01')
  })
})
