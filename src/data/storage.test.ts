import { describe, expect, it } from 'vitest'
import { initialState } from '../state/reducer'
import { makeApp, makeData, makeDoc } from '../test/factories'
import { BACKUP_KEY, loadState, saveState, STORAGE_KEY } from './storage'

function memoryStorage(opts: { throwOnSet?: boolean } = {}): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: k => m.get(k) ?? null,
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => void m.delete(k),
    setItem: (k, v) => {
      if (opts.throwOnSet) throw new Error('QuotaExceededError')
      m.set(k, v)
    },
  }
}

const state = initialState(makeData([makeApp()], [makeDoc()]))

describe('storage', () => {
  it('reports empty storage', () => expect(loadState(memoryStorage())).toEqual({ kind: 'empty' }))

  it('saves and loads', () => {
    const s = memoryStorage()
    expect(saveState(s, state)).toBe(true)
    expect(loadState(s)).toEqual({ kind: 'ok', state })
  })

  it('backs up unparseable data without overwriting it', () => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, '{not json')
    expect(loadState(s)).toEqual({ kind: 'corrupt' })
    expect(s.getItem(BACKUP_KEY)).toBe('{not json')
    expect(s.getItem(STORAGE_KEY)).toBe('{not json')
  })

  it('treats unknown versions and missing arrays as corrupt', () => {
    const s = memoryStorage()
    s.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: 2 }))
    expect(loadState(s)).toEqual({ kind: 'corrupt' })
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data: {} }))
    expect(loadState(s)).toEqual({ kind: 'corrupt' })
  })

  it('converts Needs Decision documents saved by an earlier version', () => {
    const s = memoryStorage()
    const old = { ...state, data: { ...state.data, documents: [{ ...makeDoc(), status: 'Needs Decision' }] } }
    s.setItem(STORAGE_KEY, JSON.stringify(old))
    const r = loadState(s)
    expect(r.kind === 'ok' && r.state.data.documents[0]).toMatchObject({ status: 'Not Required', notes: 'Not on imported checklist' })
  })

  it('reports save failures', () => {
    expect(saveState(memoryStorage({ throwOnSet: true }), state)).toBe(false)
  })

  it('handles unavailable storage', () => {
    expect(loadState(null)).toEqual({ kind: 'unavailable' })
    expect(saveState(null, state)).toBe(false)
    const throwing = { ...memoryStorage(), getItem: () => { throw new Error('SecurityError') } } as Storage
    expect(loadState(throwing)).toEqual({ kind: 'unavailable' })
  })
})
