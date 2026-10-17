import { isIsoDate } from './dates'
import type { Application, ChecklistData, IsoDate } from './types'

export interface ApplicationFormInput {
  businessName: string
  borrowerName: string
  loanAmount: string
  /** ISO date from <input type="date">. */
  applicationDate: string
  processor: string
}

export type ApplicationValues = Omit<Application, 'id' | 'lastActivity'>

export type FormResult =
  | { ok: true; values: ApplicationValues }
  | { ok: false; errors: Partial<Record<keyof ApplicationFormInput, string>> }

export function validateApplicationForm(input: ApplicationFormInput): FormResult {
  const errors: Partial<Record<keyof ApplicationFormInput, string>> = {}
  const businessName = input.businessName.trim()
  const borrowerName = input.borrowerName.trim()
  const processor = input.processor.trim()
  const applicationDate = input.applicationDate.trim()
  const rawAmount = input.loanAmount.replace(/[$,\s]/g, '')
  const loanAmount = Number(rawAmount)

  if (!businessName) errors.businessName = 'Required'
  if (!borrowerName) errors.borrowerName = 'Required'
  if (rawAmount === '' || !Number.isFinite(loanAmount) || loanAmount <= 0) errors.loanAmount = 'Enter an amount greater than 0'
  if (!isIsoDate(applicationDate)) errors.applicationDate = 'Enter a valid date'
  if (!processor) errors.processor = 'Required'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, values: { businessName, borrowerName, loanAmount, applicationDate, processor } }
}

const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function findDuplicate(data: ChecklistData, businessName: string, excludeId?: string): Application | undefined {
  const name = normalizeName(businessName)
  return data.applications.find(a => a.id !== excludeId && normalizeName(a.businessName) === name)
}

/** Continues the highest numeric ID suffix, keeping its prefix (APP-2026-1060 → APP-2026-1061). */
export function nextApplicationId(data: ChecklistData, today: IsoDate): string {
  let best: { prefix: string; n: number } | null = null
  for (const { id } of data.applications) {
    const m = /^(.*?)(\d+)$/.exec(id)
    if (m && (!best || Number(m[2]) > best.n)) best = { prefix: m[1], n: Number(m[2]) }
  }
  return best ? `${best.prefix}${best.n + 1}` : `APP-${today.slice(0, 4)}-1001`
}
