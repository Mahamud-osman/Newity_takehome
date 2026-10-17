import { NOT_ON_IMPORT_NOTE } from '../domain/settings'
import type { PersistedState } from '../state/reducer'

export const STORAGE_KEY = 'sba-checklist:v1'
export const BACKUP_KEY = 'sba-checklist:backup'

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; state: PersistedState }
  | { kind: 'corrupt' }
  | { kind: 'unavailable' }

function isPersistedState(v: unknown): v is PersistedState {
  const s = v as PersistedState | null
  return typeof s === 'object' && s !== null && s.version === 1 &&
    Array.isArray(s.data?.applications) && Array.isArray(s.data?.documents)
}

/** Earlier versions saved unlisted documents as "Needs Decision"; they now mean not needed. */
function migrate(state: PersistedState): PersistedState {
  const legacy = (status: string) => status === 'Needs Decision'
  if (!state.data.documents.some(d => legacy(d.status))) return state
  return {
    ...state,
    data: {
      ...state.data,
      documents: state.data.documents.map(d =>
        legacy(d.status) ? { ...d, status: 'Not Required', notes: d.notes || NOT_ON_IMPORT_NOTE } : d),
    },
  }
}

/** Never overwrites unreadable data: it is copied to BACKUP_KEY and left in place. */
export function loadState(storage: Storage | null): LoadResult {
  if (!storage) return { kind: 'unavailable' }
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { kind: 'unavailable' }
  }
  if (raw === null) return { kind: 'empty' }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isPersistedState(parsed)) return { kind: 'ok', state: migrate(parsed) }
  } catch {
    // fall through to backup
  }
  try {
    storage.setItem(BACKUP_KEY, raw)
  } catch {
    // backup is best-effort; the original stays untouched either way
  }
  return { kind: 'corrupt' }
}

export function saveState(storage: Storage | null, state: PersistedState): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
