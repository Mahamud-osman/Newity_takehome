import type { Application, ChecklistData, ChecklistDocument } from '../domain/types'

export function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: 'APP-2026-0001',
    businessName: 'Test Business',
    borrowerName: 'Test Borrower',
    loanAmount: 100000,
    applicationDate: '2026-01-01',
    processor: 'Aisha Patel',
    lastActivity: '2026-01-01',
    ...overrides,
  }
}

export function makeDoc(overrides: Partial<ChecklistDocument> = {}): ChecklistDocument {
  return {
    applicationId: 'APP-2026-0001',
    type: 'Lease Agreement',
    status: 'Pending',
    dateReceived: null,
    expirationDate: null,
    notes: '',
    ...overrides,
  }
}

export function makeData(applications: Application[], documents: ChecklistDocument[]): ChecklistData {
  return { applications, documents }
}
