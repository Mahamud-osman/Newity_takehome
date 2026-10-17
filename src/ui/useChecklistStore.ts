import { useCallback, useEffect, useState } from 'react'
import { importCsv } from '../data/csvImport'
import sampleCsv from '../data/sample.csv?raw'
import { loadState, saveState, STORAGE_KEY } from '../data/storage'
import { todayIso } from '../domain/dates'
import type { ChecklistData, IsoDate } from '../domain/types'
import { initialState, reducer } from '../state/reducer'
import type { Action, PersistedState } from '../state/reducer'

export type StorageStatus = 'ok' | 'unavailable' | 'corrupt'

function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function sampleData(): ChecklistData {
  const r = importCsv(sampleCsv)
  if (!r.ok) throw new Error(`Bundled sample data is invalid: ${r.error}`)
  return r.data
}

function boot(): { state: PersistedState | null; storage: StorageStatus } {
  const r = loadState(browserStorage())
  switch (r.kind) {
    case 'ok': return { state: r.state, storage: 'ok' }
    case 'empty': return { state: initialState(sampleData()), storage: 'ok' }
    case 'unavailable': return { state: initialState(sampleData()), storage: 'unavailable' }
    case 'corrupt': return { state: null, storage: 'corrupt' }
  }
}

export function useChecklistStore() {
  const [initial] = useState(boot)
  const [state, setState] = useState<PersistedState | null>(initial.state)
  const [storage, setStorage] = useState<StorageStatus>(initial.storage)

  const dispatch = useCallback((a: Action) => setState(s => (s ? reducer(s, a) : s)), [])

  const replaceData = useCallback((data: ChecklistData) => {
    setState(s => (s ? reducer(s, { type: 'replaceData', data }) : initialState(data)))
    setStorage(prev => (prev === 'corrupt' ? 'ok' : prev))
  }, [])

  const loadSample = useCallback(() => {
    setState(initialState(sampleData()))
    setStorage(prev => (prev === 'corrupt' ? 'ok' : prev))
  }, [])

  // Save after every change. Corrupt data is never overwritten because state is null until the user acts.
  useEffect(() => {
    if (!state) return
    if (!saveState(browserStorage(), state)) setStorage('unavailable')
  }, [state])

  // Keep two open tabs in step: reload when the other tab saves.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const r = loadState(browserStorage())
      if (r.kind === 'ok') setState(r.state)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const asOf: IsoDate = state?.asOfOverride ?? todayIso()
  return { state, dispatch, asOf, storage, loadSample, replaceData }
}
