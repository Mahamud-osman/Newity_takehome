import { expect, it } from 'vitest'
import sampleCsv from './sample.csv?raw'

it('bundles the sample CSV', () => {
  const lines = sampleCsv.trim().split(/\r?\n/)
  expect(lines[0]).toBe('application_id,business_name,borrower_name,loan_amount,application_date,assigned_processor,document_type,document_status,date_received,expiration_date,notes')
  expect(lines).toHaveLength(621)
})

it('runs tests in a US time zone', () => {
  expect(process.env.TZ).toBe('America/Los_Angeles')
})
