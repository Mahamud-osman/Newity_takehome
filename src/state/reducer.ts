import type { ApplicationValues } from '../domain/applicationForm'
import { autoExpirationDate } from '../domain/rules'
import { DOC_TYPES } from '../domain/types'
import type { ChecklistData, ChecklistDocument, DocType, IsoDate, Status } from '../domain/types'

export interface PersistedState {
  version: 1
  data: ChecklistData
  /** null = use today's date. */
  asOfOverride: IsoDate | null
  lastExportedAt: IsoDate | null
}

export function initialState(data: ChecklistData): PersistedState {
  return { version: 1, data, asOfOverride: null, lastExportedAt: null }
}

export type Action =
  | { type: 'setStatus'; appId: string; docType: DocType; status: Status; asOf: IsoDate }
  | { type: 'updateDocument'; appId: string; docType: DocType; asOf: IsoDate
      patch: { dateReceived?: IsoDate | null; expirationDate?: IsoDate | null; notes?: string } }
  | { type: 'markNotRequired'; appId: string; docType: DocType; reason: string; asOf: IsoDate }
  | { type: 'addApplication'; id: string; values: ApplicationValues; asOf: IsoDate }
  | { type: 'editApplication'; appId: string; values: ApplicationValues; asOf: IsoDate }
  | { type: 'deleteApplication'; appId: string }
  | { type: 'replaceData'; data: ChecklistData }
  | { type: 'setAsOf'; date: IsoDate | null }
  | { type: 'markExported'; at: IsoDate }

/** Statuses that mean the document is in hand, so a missing received date is filled in. */
const RECEIVED_STATUSES: Status[] = ['Received', 'Under Review', 'Approved']

function withAutoExpiration(doc: ChecklistDocument): ChecklistDocument {
  if (doc.dateReceived && !doc.expirationDate) {
    const expirationDate = autoExpirationDate(doc.type, doc.dateReceived)
    if (expirationDate) return { ...doc, expirationDate }
  }
  return doc
}

/** Applies `change` to one document and marks the application active as of `asOf`. */
function changeDocument(state: PersistedState, appId: string, docType: DocType, asOf: IsoDate,
  change: (d: ChecklistDocument) => ChecklistDocument): PersistedState {
  return touch({
    ...state,
    data: {
      ...state.data,
      documents: state.data.documents.map(d =>
        d.applicationId === appId && d.type === docType ? withAutoExpiration(change(d)) : d),
    },
  }, appId, asOf)
}

function touch(state: PersistedState, appId: string, asOf: IsoDate): PersistedState {
  return {
    ...state,
    data: { ...state.data, applications: state.data.applications.map(a => (a.id === appId ? { ...a, lastActivity: asOf } : a)) },
  }
}

export function reducer(state: PersistedState, action: Action): PersistedState {
  switch (action.type) {
    case 'setStatus':
      return changeDocument(state, action.appId, action.docType, action.asOf, d => ({
        ...d,
        status: action.status,
        dateReceived: d.dateReceived ?? (RECEIVED_STATUSES.includes(action.status) ? action.asOf : null),
      }))
    case 'updateDocument':
      return changeDocument(state, action.appId, action.docType, action.asOf, d => ({ ...d, ...action.patch }))
    case 'markNotRequired':
      return changeDocument(state, action.appId, action.docType, action.asOf, d => ({
        ...d,
        status: 'Not Required',
        notes: d.notes ? `${action.reason} — ${d.notes}` : action.reason,
      }))
    case 'addApplication': {
      const { id, values, asOf } = action
      const documents = DOC_TYPES.map((type): ChecklistDocument => ({
        applicationId: id, type, status: 'Needs Decision', dateReceived: null, expirationDate: null, notes: '',
      }))
      return {
        ...state,
        data: {
          applications: [...state.data.applications, { ...values, id, lastActivity: asOf }],
          documents: [...state.data.documents, ...documents],
        },
      }
    }
    case 'editApplication':
      return touch({
        ...state,
        data: {
          ...state.data,
          applications: state.data.applications.map(a => (a.id === action.appId ? { ...a, ...action.values } : a)),
        },
      }, action.appId, action.asOf)
    case 'deleteApplication':
      return {
        ...state,
        data: {
          applications: state.data.applications.filter(a => a.id !== action.appId),
          documents: state.data.documents.filter(d => d.applicationId !== action.appId),
        },
      }
    case 'replaceData':
      return { ...state, data: action.data }
    case 'setAsOf':
      return { ...state, asOfOverride: action.date || null }
    case 'markExported':
      return { ...state, lastExportedAt: action.at }
  }
}
