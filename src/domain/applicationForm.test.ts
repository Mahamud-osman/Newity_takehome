import { describe, expect, it } from 'vitest'
import { importCsv } from '../data/csvImport'
import sampleCsv from '../data/sample.csv?raw'
import { makeData } from '../test/factories'
import { findDuplicate, nextApplicationId, validateApplicationForm } from './applicationForm'
import type { ApplicationFormInput } from './applicationForm'

const valid: ApplicationFormInput = {
  businessName: ' Test Bakery ', borrowerName: 'Sam Lee', loanAmount: '$390,000', applicationDate: '2026-02-01', processor: 'Aisha Patel',
}
const sample = importCsv(sampleCsv)
if (!sample.ok) throw new Error(sample.error)

describe('validateApplicationForm', () => {
  it('returns trimmed values with a parsed loan amount', () => {
    expect(validateApplicationForm(valid)).toEqual({
      ok: true,
      values: { businessName: 'Test Bakery', borrowerName: 'Sam Lee', loanAmount: 390000, applicationDate: '2026-02-01', processor: 'Aisha Patel' },
    })
  })

  it('reports each invalid field', () => {
    expect(validateApplicationForm({ businessName: ' ', borrowerName: '', loanAmount: '0', applicationDate: '2026-02-30', processor: '' })).toEqual({
      ok: false,
      errors: {
        businessName: 'Required', borrowerName: 'Required', loanAmount: 'Enter an amount greater than 0',
        applicationDate: 'Enter a valid date', processor: 'Required',
      },
    })
    expect(validateApplicationForm({ ...valid, loanAmount: 'abc' })).toEqual({ ok: false, errors: { loanAmount: 'Enter an amount greater than 0' } })
  })
})

describe('findDuplicate', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(findDuplicate(sample.data, ' metro dental group ')?.id).toBe('APP-2026-1001')
  })
  it('ignores the application being edited', () => {
    expect(findDuplicate(sample.data, 'Metro Dental Group', 'APP-2026-1001')).toBeUndefined()
  })
})

describe('nextApplicationId', () => {
  it('continues the highest ID', () => expect(nextApplicationId(sample.data, '2026-10-17')).toBe('APP-2026-1061'))
  it('starts a sequence for empty data', () => expect(nextApplicationId(makeData([], []), '2026-10-17')).toBe('APP-2026-1001'))
})
