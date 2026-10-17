export const DOC_TYPES = [
  'Bank Statements (90 day)',
  'Business Tax Returns (3yr)',
  'Personal Tax Returns (3yr)',
  'Insurance Verification',
  'Business Financial Statements',
  'Business Licenses & Permits',
  'Articles of Incorporation',
  'Lease Agreement',
  'Debt Schedule',
  'Ownership Verification',
  'SBA Form 1919',
  'SBA Form 912',
] as const
export type DocType = (typeof DOC_TYPES)[number]

export const STATUSES = [
  'Pending',
  'Received',
  'Under Review',
  'Approved',
  'Expired',
  'Not Required',
] as const
export type Status = (typeof STATUSES)[number]

/** Calendar date as 'YYYY-MM-DD'. */
export type IsoDate = string

export interface Application {
  id: string
  businessName: string
  borrowerName: string
  loanAmount: number
  applicationDate: IsoDate
  processor: string
  lastActivity: IsoDate
}

export interface ChecklistDocument {
  applicationId: string
  type: DocType
  status: Status
  dateReceived: IsoDate | null
  expirationDate: IsoDate | null
  notes: string
}

export interface ChecklistData {
  applications: Application[]
  documents: ChecklistDocument[]
}
