import type { DocType } from './types'

/** An application with outstanding documents is stalled after this many idle days (assumption A1). */
export const STALLED_DAYS = 21

/** A document is "expiring soon" within this many days of its expiration date (assumption A2). */
export const EXPIRING_SOON_DAYS = 14

/** Days from receipt to expiration for time-sensitive documents (assumptions A3, A12). */
export const EXPIRY_DAYS: Partial<Record<DocType, number>> = {
  'Bank Statements (90 day)': 90,
  'Business Tax Returns (3yr)': 1095,
  'Personal Tax Returns (3yr)': 1095,
  'Insurance Verification': 365,
}

export const NOT_REQUIRED_REASONS = [
  'Waived per SBA guidelines',
  'Exempt - sole proprietorship',
  'Not applicable for this loan type',
  'Other',
] as const
