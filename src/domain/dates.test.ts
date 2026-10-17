import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatLongDate, formatUsDate, isIsoDate, parseUsDate } from './dates'

describe('dates', () => {
  it('parses US dates', () => {
    expect(parseUsDate('1/28/2026')).toBe('2026-01-28')
    expect(parseUsDate(' 01/05/2026 ')).toBe('2026-01-05')
    expect(parseUsDate('2/30/2026')).toBeNull()
    expect(parseUsDate('13/45/2026')).toBeNull()
    expect(parseUsDate('2026-01-28')).toBeNull()
    expect(parseUsDate('')).toBeNull()
  })

  it('round-trips in a US time zone', () => {
    expect(formatUsDate(parseUsDate('1/28/2026')!)).toBe('1/28/2026')
    expect(formatLongDate('2026-02-15')).toBe('Feb 15, 2026')
  })

  it('adds days across a leap day', () => {
    expect(addDays('2024-01-01', 1095)).toBe('2026-12-31')
    expect(addDays('2026-01-29', 1095)).toBe('2029-01-28')
    expect(addDays('2025-12-18', 365)).toBe('2026-12-18')
  })

  it('counts days between dates', () => {
    expect(daysBetween('2026-01-25', '2026-02-15')).toBe(21)
    expect(daysBetween('2026-02-15', '2026-02-10')).toBe(-5)
  })

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-15')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })

  it('handles years below 100 without mapping them to the 1900s', () => {
    expect(addDays('0002-02-10', 90)).toBe('0002-05-11')
  })

  it('rejects implausible years that a half-typed date input produces', () => {
    expect(isIsoDate('0002-02-10')).toBe(false)
    expect(isIsoDate('0202-02-10')).toBe(false)
    expect(isIsoDate('1900-01-01')).toBe(true)
  })
})
