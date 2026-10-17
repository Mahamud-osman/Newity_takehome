import Papa from 'papaparse'
import { parseUsDate } from '../domain/dates'
import { DOC_TYPES, STATUSES } from '../domain/types'
import type { Application, ChecklistData, ChecklistDocument, DocType, IsoDate, Status } from '../domain/types'

export const CSV_COLUMNS = [
  'application_id', 'business_name', 'borrower_name', 'loan_amount', 'application_date',
  'assigned_processor', 'document_type', 'document_status', 'date_received', 'expiration_date', 'notes',
] as const
export const LAST_ACTIVITY_COLUMN = 'last_activity'

export interface ImportIssue {
  /** Spreadsheet row number; the header is row 1. */
  row: number
  message: string
}

export type ImportResult =
  | { ok: true; data: ChecklistData; issues: ImportIssue[] }
  | { ok: false; error: string }

const NOT_A_CHECKLIST = "This file doesn't look like a document checklist. Nothing was changed."

const normalizeKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
const STATUS_BY_KEY = new Map<string, Status>(STATUSES.map(s => [normalizeKey(s), s]))
const TYPE_BY_KEY = new Map<string, DocType>(DOC_TYPES.map(t => [normalizeKey(t), t]))

function parseLoanAmount(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ''))
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

type Row = Record<string, string | undefined>

export function importCsv(text: string): ImportResult {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.replace(/^﻿/, '').trim(),
  })
  const fields = parsed.meta.fields ?? []
  if (fields.length === 0) return { ok: false, error: NOT_A_CHECKLIST }
  const missing = CSV_COLUMNS.filter(c => !fields.includes(c))
  if (missing.length > 0) return { ok: false, error: `Missing column(s): ${missing.join(', ')}. Nothing was changed.` }

  const issues: ImportIssue[] = []
  const apps = new Map<string, { app: Application; lastActivityCol: IsoDate | null }>()
  const docs = new Map<string, Map<DocType, ChecklistDocument>>()

  parsed.data.forEach((r, i) => {
    const rowNum = i + 2
    const cell = (c: string) => (r[c] ?? '').trim()
    const report = (message: string) => issues.push({ row: rowNum, message: `Row ${rowNum}: ${message}` })

    const id = cell('application_id')
    const applicationDate = parseUsDate(cell('application_date'))
    if (!applicationDate) return report(`application date "${cell('application_date')}" isn't a valid date`)
    const status = STATUS_BY_KEY.get(normalizeKey(cell('document_status')))
    if (!status) return report(`unknown status "${cell('document_status')}"`)
    const type = TYPE_BY_KEY.get(normalizeKey(cell('document_type')))
    if (!type) return report(`unknown document type "${cell('document_type')}"`)

    const readDate = (c: string): IsoDate | null => {
      const raw = cell(c)
      if (raw === '') return null
      const d = parseUsDate(raw)
      if (!d) report(`date "${raw}" isn't a valid date and was left blank`)
      return d
    }

    const loanAmount = parseLoanAmount(cell('loan_amount'))
    const candidate: Application = {
      id,
      businessName: cell('business_name'),
      borrowerName: cell('borrower_name'),
      loanAmount: loanAmount ?? 0,
      applicationDate,
      processor: cell('assigned_processor'),
      lastActivity: applicationDate,
    }
    const existing = apps.get(id)
    if (!existing) {
      if (loanAmount === null) report(`loan amount "${cell('loan_amount')}" isn't a number`)
      const lastActivityCol = fields.includes(LAST_ACTIVITY_COLUMN) ? parseUsDate(cell(LAST_ACTIVITY_COLUMN)) : null
      apps.set(id, { app: candidate, lastActivityCol })
      docs.set(id, new Map())
    } else {
      const a = existing.app
      if (a.businessName !== candidate.businessName || a.borrowerName !== candidate.borrowerName ||
          a.loanAmount !== candidate.loanAmount || a.applicationDate !== candidate.applicationDate ||
          a.processor !== candidate.processor) {
        report(`details for ${id} differ from an earlier row; the first row's details were used`)
      }
    }

    const byType = docs.get(id)!
    if (byType.has(type)) report(`duplicate ${type} for ${id}; this row replaces the earlier one`)
    byType.set(type, {
      applicationId: id,
      type,
      status,
      dateReceived: readDate('date_received'),
      expirationDate: readDate('expiration_date'),
      notes: cell('notes'),
    })
  })

  if (apps.size === 0) return { ok: false, error: NOT_A_CHECKLIST }

  const applications: Application[] = []
  const documents: ChecklistDocument[] = []
  for (const [id, { app, lastActivityCol }] of apps) {
    const byType = docs.get(id)!
    const appDocs = DOC_TYPES.map(type => byType.get(type) ?? {
      applicationId: id, type, status: 'Needs Decision' as const, dateReceived: null, expirationDate: null, notes: '',
    })
    const received = appDocs.map(d => d.dateReceived).filter((d): d is IsoDate => d !== null).sort()
    applications.push({ ...app, lastActivity: lastActivityCol ?? received.at(-1) ?? app.applicationDate })
    documents.push(...appDocs)
  }
  return { ok: true, data: { applications, documents }, issues }
}
