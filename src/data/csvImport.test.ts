import { describe, expect, it } from 'vitest'
import { CSV_COLUMNS, importCsv } from './csvImport'
import sampleCsv from './sample.csv?raw'

const HEADER = CSV_COLUMNS.join(',')
const row = (o: Partial<Record<string, string>> = {}) =>
  [
    o.id ?? 'APP-2026-1001', o.business ?? 'Metro Dental Group', 'Elena Williams', o.loan ?? '390000',
    o.appDate ?? '12/1/2025', 'Aisha Patel', o.type ?? 'Bank Statements (90 day)', o.status ?? 'Received',
    o.received ?? '1/28/2026', o.exp ?? '4/28/2026', o.notes ?? '',
  ].join(',')

describe('importCsv', () => {
  it('normalizes to 12 documents per application', () => {
    const r = importCsv([HEADER, row()].join('\n'))
    if (!r.ok) throw new Error(r.error)
    expect(r.data.applications).toHaveLength(1)
    expect(r.data.documents).toHaveLength(12)
    expect(r.data.documents.filter(d => d.status === 'Needs Decision')).toHaveLength(11)
    expect(r.data.applications[0].lastActivity).toBe('2026-01-28')
    expect(r.data.documents[0]).toMatchObject({ type: 'Bank Statements (90 day)', dateReceived: '2026-01-28', expirationDate: '2026-04-28' })
  })

  it('falls back to application date for last activity', () => {
    const r = importCsv([HEADER, row({ status: 'Pending', received: '', exp: '' })].join('\n'))
    expect(r.ok && r.data.applications[0].lastActivity).toBe('2025-12-01')
  })

  it('uses the last_activity column when present', () => {
    const r = importCsv([HEADER + ',last_activity', row() + ',2/10/2026'].join('\n'))
    expect(r.ok && r.data.applications[0].lastActivity).toBe('2026-02-10')
  })

  it('tolerates case and whitespace', () => {
    const r = importCsv([HEADER, row({ status: ' approved ', type: 'bank statements (90 DAY)' })].join('\n'))
    expect(r.ok && r.data.documents[0].status).toBe('Approved')
  })

  it('skips and reports unknown statuses', () => {
    const r = importCsv([HEADER, row(), row({ type: 'Lease Agreement', status: 'Recieved' })].join('\n'))
    expect(r.ok && r.issues).toEqual([{ row: 3, message: 'Row 3: unknown status "Recieved"' }])
  })

  it('skips and reports unknown document types', () => {
    const r = importCsv([HEADER, row(), row({ type: 'W-9' })].join('\n'))
    expect(r.ok && r.issues).toEqual([{ row: 3, message: 'Row 3: unknown document type "W-9"' }])
  })

  it('blanks and reports bad dates', () => {
    const r = importCsv([HEADER, row({ received: '13/45/2026' })].join('\n'))
    expect(r.ok && r.data.documents[0].dateReceived).toBeNull()
    expect(r.ok && r.issues[0].message).toBe('Row 2: date "13/45/2026" isn\'t a valid date and was left blank')
  })

  it('skips rows with a bad application date', () => {
    const r = importCsv([HEADER, row(), row({ id: 'APP-2026-1002', appDate: 'soon' })].join('\n'))
    expect(r.ok && r.data.applications).toHaveLength(1)
    expect(r.ok && r.issues[0].message).toBe('Row 3: application date "soon" isn\'t a valid date')
  })

  it('reports conflicting application details and keeps the first', () => {
    const r = importCsv([HEADER, row(), row({ type: 'Lease Agreement', loan: '1' })].join('\n'))
    expect(r.ok && r.data.applications[0].loanAmount).toBe(390000)
    expect(r.ok && r.issues[0].message).toBe("Row 3: details for APP-2026-1001 differ from an earlier row; the first row's details were used")
  })

  it('blocks missing columns', () => {
    expect(importCsv('application_id,business_name\nA,B')).toEqual({
      ok: false,
      error: 'Missing column(s): borrower_name, loan_amount, application_date, assigned_processor, document_type, document_status, date_received, expiration_date, notes. Nothing was changed.',
    })
  })

  it('blocks empty files', () => {
    expect(importCsv('')).toEqual({ ok: false, error: "This file doesn't look like a document checklist. Nothing was changed." })
    expect(importCsv(HEADER + '\n')).toEqual({ ok: false, error: "This file doesn't look like a document checklist. Nothing was changed." })
  })

  it('blocks a file where every row is invalid', () => {
    const r = importCsv([HEADER, row({ status: 'nope' })].join('\n'))
    expect(r).toEqual({ ok: false, error: "This file doesn't look like a document checklist. Nothing was changed." })
  })

  it('accepts BOM and CRLF', () => {
    const r = importCsv('﻿' + [HEADER, row()].join('\r\n') + '\r\n')
    expect(r.ok).toBe(true)
  })

  it('parses currency loan amounts', () => {
    const a = importCsv([HEADER, row({ loan: '"$390,000"' })].join('\n'))
    expect(a.ok && a.data.applications[0].loanAmount).toBe(390000)
    const b = importCsv([HEADER, row({ loan: '390000.00' })].join('\n'))
    expect(b.ok && b.data.applications[0].loanAmount).toBe(390000)
    const c = importCsv([HEADER, row({ loan: 'abc' })].join('\n'))
    expect(c.ok && c.issues[0].message).toBe('Row 2: loan amount "abc" isn\'t a number')
    expect(c.ok && c.data.applications[0].loanAmount).toBe(0)
  })

  it('keeps the later duplicate and reports it', () => {
    const r = importCsv([HEADER, row({ status: 'Pending', received: '', exp: '' }), row()].join('\n'))
    expect(r.ok && r.data.documents[0].status).toBe('Received')
    expect(r.ok && r.issues).toEqual([{ row: 3, message: 'Row 3: duplicate Bank Statements (90 day) for APP-2026-1001; this row replaces the earlier one' }])
  })

  it('imports the full sample', () => {
    const r = importCsv(sampleCsv)
    expect(r.ok && [r.data.applications.length, r.data.documents.length, r.issues.length]).toEqual([60, 720, 0])
  })
})
