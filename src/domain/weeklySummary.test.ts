import { describe, expect, it } from 'vitest'
import { importCsv } from '../data/csvImport'
import sampleCsv from '../data/sample.csv?raw'
import { makeApp, makeData, makeDoc } from '../test/factories'
import { buildWeeklySummary } from './weeklySummary'

const sample = importCsv(sampleCsv)
if (!sample.ok) throw new Error(sample.error)

describe('buildWeeklySummary', () => {
  it('summarizes the sample pipeline', () => {
    const lines = buildWeeklySummary(sample.data, '2026-02-15').split('\n')
    expect(lines[0]).toBe('SBA Pipeline Summary — as of Feb 15, 2026')
    for (const l of [
      '  60 active applications · $15.62M total loan volume',
      '  57 waiting on documents · 0 fully complete',
      '  Stalled (no documents in 21+ days): 11',
      '  Expired documents: 6 (6 bank statements)',
      '  Expiring in the next 14 days: 1',
      '  Applications with undecided documents: 43',
      '  Aisha Patel — 18 applications, 5 stalled',
      '  Janet Morrison — 18 applications, 2 stalled',
      '  Ricardo Fuentes — 24 applications, 4 stalled',
    ]) expect(lines).toContain(l)
    const stalled = lines.filter(l => /^ {4}APP-/.test(l))
    expect(stalled).toHaveLength(11)
    expect(stalled[0]).toBe('    APP-2026-1060 Harbor Fish Market — 67 days, 5 outstanding (Aisha Patel)')
    expect(stalled[10]).toBe('    APP-2026-1020 Silver Lining Bakery — 21 days, 5 outstanding (Janet Morrison)')
    expect(lines.indexOf('PIPELINE')).toBeLessThan(lines.indexOf('NEEDS ATTENTION'))
    expect(lines.indexOf('NEEDS ATTENTION')).toBeLessThan(lines.indexOf('BY PROCESSOR'))
  })

  it('omits stalled lines when none are stalled and uses singular bank statement', () => {
    const data = makeData(
      [makeApp({ lastActivity: '2026-02-14' })],
      [makeDoc({ type: 'Bank Statements (90 day)', status: 'Approved', expirationDate: '2026-02-01' })],
    )
    const text = buildWeeklySummary(data, '2026-02-15')
    expect(text).toContain('  Stalled (no documents in 21+ days): 0')
    expect(text).not.toMatch(/^ {4}APP-/m)
    expect(text).toContain('  Expired documents: 1 (1 bank statement)')
  })

  it('omits the bank statement note when none are expired', () => {
    const text = buildWeeklySummary(makeData([makeApp()], [makeDoc()]), '2026-02-15')
    expect(text).toContain('  Expired documents: 0\n')
  })
})
