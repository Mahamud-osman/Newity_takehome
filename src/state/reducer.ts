import type { ApplicationValues } from '../domain/applicationForm'
import { autoExpirationDate, withNotNeededReason } from '../domain/rules'
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

/**
 * Actions that change data carry `today`: the real date the change was made. It is recorded as the
 * received date and last activity. Never pass the "as of" viewing date here.
 */
export type Action =
  | { type: 'setStatus'; appId: string; docType: DocType; status: Status; today: IsoDate }
  | { type: 'updateDocument'; appId: string; docType: DocType; today: IsoDate
      patch: { dateReceived?: IsoDate | null; expirationDate?: IsoDate | null; notes?: string } }
  /** Tick (needed: true → Pending) or untick (needed: false → Not Required) a document on the checklist. */
  | { type: 'setNeeded'; appId: string; docType: DocType; needed: boolean; today: IsoDate }
  /** Why a document is not needed; '' removes the reason. */
  | { type: 'setNotNeededReason'; appId: string; docType: DocType; reason: string; today: IsoDate }
  | { type: 'addApplication'; id: string; values: ApplicationValues; today: IsoDate }
  | { type: 'editApplication'; appId: string; values: ApplicationValues; today: IsoDate }
  | { type: 'deleteApplication'; appId: string }
  | { type: 'replaceData'; data: ChecklistData }
  | { type: 'setAsOf'; date: IsoDate | null }
  | { type: 'markExported'; at: IsoDate }

/** Statuses that mean the document is in hand, so a missing received date is filled in. */
const RECEIVED_STATUSES: Status[] = ['Received', 'Under Review', 'Approved']

/**
 * Fills a missing expiration date from the received date. When a new received date replaces an old one
 * (a fresh bank statement), an expiration that was still the auto value for the old date is recomputed;
 * a manually entered expiration is kept.
 */
function withAutoExpiration(before: ChecklistDocument, doc: ChecklistDocument): ChecklistDocument {
  if (!doc.dateReceived) return doc
  const wasAuto = before.dateReceived !== null && before.expirationDate !== null &&
    doc.expirationDate === before.expirationDate &&
    autoExpirationDate(doc.type, before.dateReceived) === before.expirationDate
  if (!doc.expirationDate || (wasAuto && doc.dateReceived !== before.dateReceived)) {
    const expirationDate = autoExpirationDate(doc.type, doc.dateReceived)
    if (expirationDate) return { ...doc, expirationDate }
  }
  return doc
}

/** Applies `change` to one document and marks the application active on `today`. */
function changeDocument(state: PersistedState, appId: string, docType: DocType, today: IsoDate,
  change: (d: ChecklistDocument) => ChecklistDocument): PersistedState {
  return touch({
    ...state,
    data: {
      ...state.data,
      documents: state.data.documents.map(d =>
        d.applicationId === appId && d.type === docType ? withAutoExpiration(d, change(d)) : d),
    },
  }, appId, today)
}

/** Marks the application active on `today`, never moving last activity backwards. */
function touch(state: PersistedState, appId: string, today: IsoDate): PersistedState {
  return {
    ...state,
    data: {
      ...state.data,
      applications: state.data.applications.map(a =>
        a.id === appId && today > a.lastActivity ? { ...a, lastActivity: today } : a),
    },
  }
}

export function reducer(state: PersistedState, action: Action): PersistedState {
  switch (action.type) {
    case 'setStatus':
      return changeDocument(state, action.appId, action.docType, action.today, d => {
        const receiving = RECEIVED_STATUSES.includes(action.status)
        // Expired (replacement requested) or Pending (re-requested) → received means a new document arrived.
        if (receiving && d.dateReceived && (d.status === 'Expired' || d.status === 'Pending')) {
          return {
            ...d,
            status: action.status,
            dateReceived: action.today,
            expirationDate: autoExpirationDate(d.type, action.today),
          }
        }
        return {
          ...d,
          status: action.status,
          dateReceived: d.dateReceived ?? (receiving ? action.today : null),
        }
      })
    case 'updateDocument':
      return changeDocument(state, action.appId, action.docType, action.today, d => ({ ...d, ...action.patch }))
    case 'setNeeded':
      return changeDocument(state, action.appId, action.docType, action.today, d => ({
        ...d,
        status: action.needed ? 'Pending' : 'Not Required',
      }))
    case 'setNotNeededReason':
      return changeDocument(state, action.appId, action.docType, action.today, d => ({
        ...d,
        notes: withNotNeededReason(d.notes, action.reason),
      }))
    case 'addApplication': {
      const { id, values, today } = action
      const documents = DOC_TYPES.map((type): ChecklistDocument => ({
        applicationId: id, type, status: 'Pending', dateReceived: null, expirationDate: null, notes: '',
      }))
      return {
        ...state,
        data: {
          applications: [...state.data.applications, { ...values, id, lastActivity: today }],
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
      }, action.appId, action.today)
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
