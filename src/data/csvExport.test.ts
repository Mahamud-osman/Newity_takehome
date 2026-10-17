import { describe, expect, it } from 'vitest'
import { makeApp, makeData, makeDoc } from '../test/factories'
import { exportCsv, exportFilename } from './csvExport'
import { CSV_COLUMNS, importCsv } from './csvImport'
import sampleCsv from './sample.csv?raw'

describe('exportCsv', () => {
  it('round-trips the sample exactly', () => {
    const a = importCsv(sampleCsv)
    if (!a.ok) throw new Error(a.error)
    const b = importCsv(exportCsv(a.data))
    if (!b.ok) throw new Error(b.error)
    expect(b.data).toEqual(a.data)
    expect(b.issues).toEqual([])
  })

  it('writes original columns plus last_activity and US dates', () => {
    const a = importCsv(sampleCsv)
    if (!a.ok) throw new Error(a.error)
    const [header, first] = exportCsv(a.data).split('\r\n')
    expect(header).toBe(CSV_COLUMNS.join(',') + ',last_activity')
    expect(first).toBe('APP-2026-1001,Metro Dental Group,Elena Williams,390000,12/1/2025,Aisha Patel,Bank Statements (90 day),Under Review,1/28/2026,4/28/2026,Reviewing for completeness,1/29/2026')
  })

  it('quotes commas and quotes', () => {
    const data = makeData([makeApp({ businessName: 'Smith, Jones & "Co"' })], [makeDoc({ notes: 'Called, left "voicemail"' })])
    const r = importCsv(exportCsv(data))
    expect(r.ok && r.data.applications[0].businessName).toBe('Smith, Jones & "Co"')
    expect(r.ok && r.data.documents.find(d => d.type === 'Lease Agreement')!.notes).toBe('Called, left "voicemail"')
  })

  it('names the file by date', () => {
    expect(exportFilename('2026-10-17')).toBe('sba-checklist-2026-10-17.csv')
  })
})
