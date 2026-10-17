import Papa from 'papaparse'
import { formatUsDate } from '../domain/dates'
import type { ChecklistData, IsoDate } from '../domain/types'
import { CSV_COLUMNS, LAST_ACTIVITY_COLUMN } from './csvImport'

/** Same columns and date format as the team's spreadsheet, plus a trailing last_activity column. */
export function exportCsv(data: ChecklistData): string {
  const appsById = new Map(data.applications.map(a => [a.id, a]))
  const date = (d: IsoDate | null) => (d ? formatUsDate(d) : '')
  const rows = data.documents.map(d => {
    const a = appsById.get(d.applicationId)!
    return [
      a.id, a.businessName, a.borrowerName, String(a.loanAmount), date(a.applicationDate), a.processor,
      d.type, d.status, date(d.dateReceived), date(d.expirationDate), d.notes, date(a.lastActivity),
    ]
  })
  return Papa.unparse({ fields: [...CSV_COLUMNS, LAST_ACTIVITY_COLUMN], data: rows }, { newline: '\r\n' })
}

export function exportFilename(today: IsoDate): string {
  return `sba-checklist-${today}.csv`
}
