# SBA Document Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-only web app that replaces the loan ops team's SBA document spreadsheet, surfacing stalled applications, per-application checklists, and date-based expiry.

**Architecture:** React + TypeScript single-page app built with Vite. All business rules are pure functions in `src/domain/`, CSV and storage code in `src/data/`, a single reducer in `src/state/`, and thin React components in `src/ui/`. Data loads from a bundled sample CSV on first open and is saved to `localStorage`.

**Tech Stack:** Node 20.19+ / 22.12+, Vite (react-ts template), React, TypeScript, Papa Parse, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-sba-doc-checklist-design.md` — read it alongside this plan. Section references (§) point there.

## Global Constraints

- No backend, no server code, no network calls. Data lives in `localStorage` only.
- Setup is exactly `npm install && npm run dev`; tests run with `npm test`.
- Dates are stored as ISO strings `YYYY-MM-DD` everywhere in state. Never create a `Date` from a date-only string with local-time parsing; all date arithmetic is done in UTC.
- CSV dates are `M/D/YYYY` without leading zeros (e.g. `1/28/2026`), in and out.
- `STALLED_DAYS = 21`, `EXPIRING_SOON_DAYS = 14`, `EXPIRY_DAYS = { 'Bank Statements (90 day)': 90, 'Business Tax Returns (3yr)': 1095, 'Personal Tax Returns (3yr)': 1095, 'Insurance Verification': 365 }` — defined once in `src/domain/settings.ts`, imported everywhere else.
- Exactly 12 document types per application, in the order of `DOC_TYPES` (Task 2).
- Status values are exactly: `Pending`, `Received`, `Under Review`, `Approved`, `Expired`, `Not Required`, `Needs Decision`. UI label for `Needs Decision` is "Needs decision".
- The app never changes a document's status automatically.
- User-facing copy is plain language. Messages that follow a failed or cancelled action say whether anything changed.
- Status and expiry are never conveyed by color alone (always a text label or icon). WCAG AA contrast. Click targets ≥ 32 px. Keyboard reachable.
- Tests run in `America/Los_Angeles` time zone (set in `vite.config.ts`) so UTC/local date bugs fail in CI.
- Commit after every task with the message given in the task.

## Review Focus

Input classes the spec implies but no feature test would naturally hit. Each has a test added to its owning task.

1. **Time zone off-by-one** — a user in a US time zone must see `1/28/2026` exactly as in the CSV, never `1/27/2026`. → Task 2, `dates.test.ts` "round-trips in a US time zone".
2. **"As of" earlier than an application's last activity** (demo date set to Feb 15 after edits, or a new application dated later) — idle days show 0, never negative, and the application is not stalled. → Task 3, `rules.test.ts` "clamps idle days at 0".
3. **Excel-saved CSVs** — a UTF-8 byte-order mark before `application_id` and CRLF line endings must still import. → Task 4, `csvImport.test.ts` "accepts BOM and CRLF".
4. **Currency-formatted loan amounts** (`$390,000`, `390000.00`) import as `390000`; unparseable amounts are reported, not silently zeroed without notice. → Task 4, `csvImport.test.ts` "parses currency loan amounts".
5. **Commas and quotes in business names or notes** (`Smith, Jones & "Co"`) survive export → import unchanged. → Task 5, `csvExport.test.ts` "quotes commas and quotes".

---

## File Structure

```
vite.config.ts                  Vite + Vitest config (TZ pinned)
src/
  main.tsx                      React entry
  domain/
    types.ts                    DOC_TYPES, STATUSES, Application, ChecklistDocument, ChecklistData
    settings.ts                 thresholds, EXPIRY_DAYS, NOT_REQUIRED_REASONS
    dates.ts                    parse/format/add/diff helpers (UTC only)
    rules.ts                    statusGroup, expiryBadge, autoExpirationDate, idleDays, summarizeApplication
    pipeline.ts                 home-page queries: summaries, card counts, filter, sort, processors, checklist order
    applicationForm.ts          form validation, duplicate check, next ID
    weeklySummary.ts            buildWeeklySummary
  data/
    sample.csv                  bundled sample data
    csvImport.ts                importCsv (parse, validate, normalize)
    csvExport.ts                exportCsv, exportFilename
    storage.ts                  loadState, saveState, PersistedState
  state/
    reducer.ts                  Action union, reducer, initialState
  test/
    factories.ts                makeApp, makeDoc, makeData test helpers
    golden.test.ts              sample-data golden figures
  ui/
    tokens.css, app.css         design tokens and styles
    download.ts                 downloadText
    useChecklistStore.ts        state + persistence hook
    App.tsx                     shell, navigation, banners
    ErrorBoundary.tsx
    Header.tsx
    HomePage.tsx, FilterCards.tsx, ApplicationTable.tsx
    ChecklistPage.tsx, DocumentRow.tsx
    ApplicationFormDialog.tsx, ConfirmDialog.tsx
    ImportDialog.tsx, WeeklySummaryDialog.tsx
README.md
```

Unit tests are colocated as `*.test.ts` next to the module they test.

---

### Task 1: Project scaffold, test harness, sample data

**Files:**
- Create: Vite react-ts scaffold at repo root (`package.json`, `index.html`, `tsconfig*.json`, `vite.config.ts`, `src/main.tsx`, `.gitignore`)
- Create: `src/data/sample.csv`
- Test: `src/data/sample.test.ts`

**Interfaces:**
- Produces: `import sampleCsv from './sample.csv?raw'` works in app and tests; `npm test` runs Vitest once (`vitest run`).

- [ ] **Step 1: Scaffold Vite into a temp dir and move it into the repo root** (the root already has `README.md` and `docs/`; keep both)

Run:
```bash
cd /tmp && rm -rf vite-scaffold && npm create vite@latest vite-scaffold -- --template react-ts
cp -rn /tmp/vite-scaffold/. /home/user/Newity_takehome/
cd /home/user/Newity_takehome && npm install && npm install papaparse && npm install -D vitest @types/papaparse
```
Expected: `npm install` completes with no errors. The existing `README.md` is not overwritten (`cp -n`).

- [ ] **Step 2: Remove starter content** — delete `src/App.tsx`, `src/App.css`, `src/index.css`, `src/assets/`, `public/vite.svg`; make `src/main.tsx` render `<h1>SBA Document Checklist</h1>` for now; set `<title>SBA Document Checklist</title>` in `index.html`.

- [ ] **Step 3: Configure tests** — in `vite.config.ts` add `process.env.TZ = 'America/Los_Angeles'` as the first statement and a `test: { environment: 'node' }` block (import `defineConfig` from `vitest/config`). In `package.json` set `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 4: Copy sample data**

Run: `cp "/root/.claude/uploads/0e1cfc64-6259-55f8-aa59-0aee2165f317/c47a6e2b-NEWITY_Sample_Data_A_Document_Checklist.csv" src/data/sample.csv`

- [ ] **Step 5: Write the failing test** `src/data/sample.test.ts`

```ts
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
```

If TypeScript rejects `?raw`, add `/// <reference types="vite/client" />` to `src/vite-env.d.ts` (the scaffold normally includes it).

- [ ] **Step 6: Run** `npm test` — Expected: 2 passed. Run `npm run build` — Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite React app with Vitest and bundled sample CSV"
```

---

### Task 2: Domain types, settings, and dates

**Files:**
- Create: `src/domain/types.ts`, `src/domain/settings.ts`, `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export const DOC_TYPES = ['Bank Statements (90 day)', 'Business Tax Returns (3yr)', 'Personal Tax Returns (3yr)',
    'Insurance Verification', 'Business Financial Statements', 'Business Licenses & Permits',
    'Articles of Incorporation', 'Lease Agreement', 'Debt Schedule', 'Ownership Verification',
    'SBA Form 1919', 'SBA Form 912'] as const
  export type DocType = typeof DOC_TYPES[number]
  export const STATUSES = ['Pending', 'Received', 'Under Review', 'Approved', 'Expired', 'Not Required', 'Needs Decision'] as const
  export type Status = typeof STATUSES[number]
  export type IsoDate = string // 'YYYY-MM-DD'
  export interface Application { id: string; businessName: string; borrowerName: string; loanAmount: number;
    applicationDate: IsoDate; processor: string; lastActivity: IsoDate }
  export interface ChecklistDocument { applicationId: string; type: DocType; status: Status;
    dateReceived: IsoDate | null; expirationDate: IsoDate | null; notes: string }
  export interface ChecklistData { applications: Application[]; documents: ChecklistDocument[] }
  ```
- Produces (`settings.ts`): `STALLED_DAYS`, `EXPIRING_SOON_DAYS`, `EXPIRY_DAYS: Partial<Record<DocType, number>>` (values in Global Constraints), `NOT_REQUIRED_REASONS = ['Waived per SBA guidelines', 'Exempt - sole proprietorship', 'Not applicable for this loan type', 'Other'] as const`.
- Produces (`dates.ts`):
  - `parseUsDate(s: string): IsoDate | null` — accepts `M/D/YYYY` (leading zeros optional, surrounding whitespace ignored); rejects impossible dates (`2/30/2026`) and anything else.
  - `formatUsDate(d: IsoDate): string` — `'2026-01-28'` → `'1/28/2026'`.
  - `formatLongDate(d: IsoDate): string` — `'2026-02-15'` → `'Feb 15, 2026'`.
  - `isIsoDate(s: string): boolean`
  - `addDays(d: IsoDate, n: number): IsoDate`
  - `daysBetween(from: IsoDate, to: IsoDate): number` — `to − from` in whole days, may be negative.
  - `todayIso(): IsoDate` — the user's local calendar date.

  All arithmetic via `Date.UTC(...)` and `getUTC*` methods.

- [ ] **Step 1: Write the failing tests** `src/domain/dates.test.ts`

```ts
it('parses US dates', () => {
  expect(parseUsDate('1/28/2026')).toBe('2026-01-28')
  expect(parseUsDate(' 01/05/2026 ')).toBe('2026-01-05')
  expect(parseUsDate('2/30/2026')).toBeNull()
  expect(parseUsDate('13/45/2026')).toBeNull()
  expect(parseUsDate('2026-01-28')).toBeNull()
  expect(parseUsDate('')).toBeNull()
})
it('round-trips in a US time zone', () => {   // Review Focus 1
  expect(formatUsDate(parseUsDate('1/28/2026')!)).toBe('1/28/2026')
  expect(formatLongDate('2026-02-15')).toBe('Feb 15, 2026')
})
it('adds days across a leap day', () => {
  expect(addDays('2024-01-01', 1095)).toBe('2026-12-31')
  expect(addDays('2026-01-29', 1095)).toBe('2029-01-28')   // matches APP-2026-1001 in the sample
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
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `types.ts`, `settings.ts`, `dates.ts` per Interfaces.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: domain types, settings, and UTC date helpers"`

---

### Task 3: Business rules

**Files:**
- Create: `src/domain/rules.ts`, `src/test/factories.ts`
- Test: `src/domain/rules.test.ts`

**Interfaces:**
- Consumes: Task 2 types, settings, `addDays`, `daysBetween`.
- Produces (`factories.ts`, test-only):
  - `makeApp(overrides?: Partial<Application>): Application` — defaults `id 'APP-2026-0001'`, `applicationDate '2026-01-01'`, `lastActivity '2026-01-01'`, processor `'Aisha Patel'`, loan `100000`.
  - `makeDoc(overrides?: Partial<ChecklistDocument>): ChecklistDocument` — defaults `status 'Pending'`, type `'Lease Agreement'`, null dates, empty notes, applicationId `'APP-2026-0001'`.
  - `makeData(apps: Application[], docs: ChecklistDocument[]): ChecklistData`
- Produces (`rules.ts`):
  ```ts
  export type StatusGroup = 'outstanding' | 'in-progress' | 'done' | 'needs-decision'
  export function statusGroup(s: Status): StatusGroup
  export type ExpiryBadge = { kind: 'expired'; daysAgo: number } | { kind: 'soon'; daysLeft: number } | null
  export function expiryBadge(doc: ChecklistDocument, asOf: IsoDate): ExpiryBadge
  export function autoExpirationDate(type: DocType, dateReceived: IsoDate): IsoDate | null
  export function idleDays(app: Application, asOf: IsoDate): number
  export interface AppSummary { app: Application; documents: ChecklistDocument[]; outstanding: number; done: number;
    needsDecision: number; expired: number; expiringSoon: number; idleDays: number; stalled: boolean }
  export function summarizeApplication(app: Application, docs: ChecklistDocument[], asOf: IsoDate): AppSummary
  ```
  Rules exactly as spec §5: expired if `expirationDate < asOf`; soon if `0 ≤ daysLeft ≤ EXPIRING_SOON_DAYS`; no badge for `Not Required` or no date. `idleDays = max(0, daysBetween(lastActivity, asOf))`. `stalled = outstanding ≥ 1 && idleDays ≥ STALLED_DAYS`. `expired`/`expiringSoon` count documents by badge.

- [ ] **Step 1: Write the failing tests** `src/domain/rules.test.ts`

```ts
const asOf = '2026-02-15'
it('groups statuses', () => {
  expect(statusGroup('Pending')).toBe('outstanding'); expect(statusGroup('Expired')).toBe('outstanding')
  expect(statusGroup('Received')).toBe('in-progress'); expect(statusGroup('Under Review')).toBe('in-progress')
  expect(statusGroup('Approved')).toBe('done'); expect(statusGroup('Not Required')).toBe('done')
  expect(statusGroup('Needs Decision')).toBe('needs-decision')
})
it('computes expiry badges', () => {
  expect(expiryBadge(makeDoc({ expirationDate: '2026-02-14' }), asOf)).toEqual({ kind: 'expired', daysAgo: 1 })
  expect(expiryBadge(makeDoc({ expirationDate: '2026-02-15' }), asOf)).toEqual({ kind: 'soon', daysLeft: 0 })
  expect(expiryBadge(makeDoc({ expirationDate: '2026-03-01' }), asOf)).toEqual({ kind: 'soon', daysLeft: 14 })
  expect(expiryBadge(makeDoc({ expirationDate: '2026-03-02' }), asOf)).toBeNull()
  expect(expiryBadge(makeDoc({ expirationDate: null }), asOf)).toBeNull()
  expect(expiryBadge(makeDoc({ status: 'Not Required', expirationDate: '2025-01-01' }), asOf)).toBeNull()
  expect(expiryBadge(makeDoc({ status: 'Approved', expirationDate: '2026-01-13' }), asOf)).toEqual({ kind: 'expired', daysAgo: 33 })
})
it('auto-fills expiration dates', () => {
  expect(autoExpirationDate('Bank Statements (90 day)', '2026-01-01')).toBe('2026-04-01')
  expect(autoExpirationDate('Business Tax Returns (3yr)', '2024-01-01')).toBe('2026-12-31')
  expect(autoExpirationDate('Personal Tax Returns (3yr)', '2026-01-29')).toBe('2029-01-28')
  expect(autoExpirationDate('Insurance Verification', '2025-12-18')).toBe('2026-12-18')
  expect(autoExpirationDate('Lease Agreement', '2026-01-01')).toBeNull()
})
it('flags stalled at exactly 21 idle days with outstanding docs', () => {
  const docs = [makeDoc({ status: 'Pending' })]
  expect(summarizeApplication(makeApp({ lastActivity: '2026-01-26' }), docs, asOf).stalled).toBe(false) // 20 days
  expect(summarizeApplication(makeApp({ lastActivity: '2026-01-25' }), docs, asOf).stalled).toBe(true)  // 21 days
  expect(summarizeApplication(makeApp({ lastActivity: '2026-01-16' }), [makeDoc({ status: 'Received' })], asOf).stalled).toBe(false)
})
it('clamps idle days at 0', () => {   // Review Focus 2
  const s = summarizeApplication(makeApp({ lastActivity: '2026-03-01' }), [makeDoc()], asOf)
  expect(s.idleDays).toBe(0); expect(s.stalled).toBe(false)
})
it('counts outstanding, done, needs decision', () => {
  const docs = [makeDoc({ status: 'Pending' }), makeDoc({ status: 'Expired' }), makeDoc({ status: 'Approved' }),
    makeDoc({ status: 'Not Required' }), makeDoc({ status: 'Needs Decision' }), makeDoc({ status: 'Received' })]
  const s = summarizeApplication(makeApp(), docs, asOf)
  expect([s.outstanding, s.done, s.needsDecision]).toEqual([2, 2, 1])
})
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** `factories.ts` and `rules.ts`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: stalled, expiry, and status rules"`

---

### Task 4: CSV import and normalization

**Files:**
- Create: `src/data/csvImport.ts`
- Test: `src/data/csvImport.test.ts`

**Interfaces:**
- Consumes: Task 2 types/dates.
- Produces:
  ```ts
  export const CSV_COLUMNS = ['application_id','business_name','borrower_name','loan_amount','application_date',
    'assigned_processor','document_type','document_status','date_received','expiration_date','notes'] as const
  export const LAST_ACTIVITY_COLUMN = 'last_activity'
  export interface ImportIssue { row: number; message: string }   // row = spreadsheet row number (header is row 1)
  export type ImportResult =
    | { ok: true; data: ChecklistData; issues: ImportIssue[] }
    | { ok: false; error: string }
  export function importCsv(text: string): ImportResult
  ```
- Behavior (spec §9 Import table, plus):
  - Parse with Papa Parse `header: true, skipEmptyLines: true`; strip a leading `﻿`; trim header names.
  - Status and type matched case- and whitespace-insensitively against `STATUSES` / `DOC_TYPES`; unknown → row skipped, issue `Row N: unknown status "Recieved"` / `Row N: unknown document type "W-9"`.
  - Loan amount: strip `$`, `,`, spaces; must be a number > 0. Otherwise issue `Row N: loan amount "abc" isn't a number` and loan amount stored as 0.
  - Unreadable `application_date` → row skipped, issue `Row N: application date "…" isn't a valid date`.
  - Unreadable `date_received` / `expiration_date` → stored `null`, issue `Row N: date "…" isn't a valid date and was left blank`.
  - Same type twice for one application → later row wins, issue `Row N: duplicate <type> for <id>; this row replaces the earlier one`.
  - Application fields differ from the application's first row → first row kept, issue `Row N: details for <id> differ from an earlier row; the first row's details were used`.
  - After parsing, each application gets all 12 `DOC_TYPES`; missing ones are `Needs Decision`, null dates, empty notes. Documents are ordered by application (first-appearance order) then `DOC_TYPES` order.
  - `lastActivity` = valid `last_activity` column value from the application's first row if present, else the latest `dateReceived` across its documents, else `applicationDate`.
  - Fatal errors (exact copy): empty/unparseable/no data rows → `This file doesn't look like a document checklist. Nothing was changed.`; missing columns → `Missing column(s): <comma-separated names>. Nothing was changed.`; zero valid rows after skipping → same as empty.

- [ ] **Step 1: Write the failing tests** `src/data/csvImport.test.ts`

```ts
const HEADER = CSV_COLUMNS.join(',')
const row = (o: Partial<Record<string, string>> = {}) => [
  o.id ?? 'APP-2026-1001', o.business ?? 'Metro Dental Group', 'Elena Williams', o.loan ?? '390000', o.appDate ?? '12/1/2025',
  'Aisha Patel', o.type ?? 'Bank Statements (90 day)', o.status ?? 'Received', o.received ?? '1/28/2026', o.exp ?? '4/28/2026', o.notes ?? ''].join(',')

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
it('tolerates case and whitespace', () => {
  const r = importCsv([HEADER, row({ status: ' approved ', type: 'bank statements (90 DAY)' })].join('\n'))
  expect(r.ok && r.data.documents[0].status).toBe('Approved')
})
it('skips and reports unknown statuses', () => {
  const r = importCsv([HEADER, row(), row({ type: 'Lease Agreement', status: 'Recieved' })].join('\n'))
  expect(r.ok && r.issues).toEqual([{ row: 3, message: 'Row 3: unknown status "Recieved"' }])
})
it('blanks and reports bad dates', () => {
  const r = importCsv([HEADER, row({ received: '13/45/2026' })].join('\n'))
  expect(r.ok && r.data.documents[0].dateReceived).toBeNull()
  expect(r.ok && r.issues[0].message).toContain('13/45/2026')
})
it('blocks missing columns', () => {
  expect(importCsv('application_id,business_name\nA,B')).toEqual({ ok: false, error: 'Missing column(s): borrower_name, loan_amount, application_date, assigned_processor, document_type, document_status, date_received, expiration_date, notes. Nothing was changed.' })
})
it('blocks empty files', () => {
  expect(importCsv('')).toEqual({ ok: false, error: "This file doesn't look like a document checklist. Nothing was changed." })
})
it('accepts BOM and CRLF', () => {   // Review Focus 3
  const r = importCsv('﻿' + [HEADER, row()].join('\r\n') + '\r\n')
  expect(r.ok).toBe(true)
})
it('parses currency loan amounts', () => {   // Review Focus 4
  const a = importCsv([HEADER, row({ loan: '"$390,000"' })].join('\n'))
  expect(a.ok && a.data.applications[0].loanAmount).toBe(390000)
  const b = importCsv([HEADER, row({ loan: '390000.00' })].join('\n'))
  expect(b.ok && b.data.applications[0].loanAmount).toBe(390000)
  const c = importCsv([HEADER, row({ loan: 'abc' })].join('\n'))
  expect(c.ok && c.issues[0].message).toBe('Row 2: loan amount "abc" isn\'t a number')
})
it('keeps the later duplicate and reports it', () => {
  const r = importCsv([HEADER, row({ status: 'Pending', received: '', exp: '' }), row()].join('\n'))
  expect(r.ok && r.data.documents[0].status).toBe('Received')
  expect(r.ok && r.issues[0].row).toBe(3)
})
it('imports the full sample', () => {
  const r = importCsv(sampleCsv)
  expect(r.ok && [r.data.applications.length, r.data.documents.length, r.issues.length]).toEqual([60, 720, 0])
})
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** `importCsv` per Interfaces.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: CSV import with validation and 12-document normalization"`

---

### Task 5: CSV export and round trip

**Files:**
- Create: `src/data/csvExport.ts`
- Test: `src/data/csvExport.test.ts`

**Interfaces:**
- Consumes: `CSV_COLUMNS`, `LAST_ACTIVITY_COLUMN`, `importCsv` (Task 4); `formatUsDate`.
- Produces:
  - `exportCsv(data: ChecklistData): string` — header `CSV_COLUMNS` + `last_activity`; one row per document in `data.documents` order; dates via `formatUsDate`, `null` → empty; loan amount as plain number; `Papa.unparse` with `newline: '\r\n'`.
  - `exportFilename(today: IsoDate): string` → `sba-checklist-2026-10-17.csv`.

- [ ] **Step 1: Write the failing tests** `src/data/csvExport.test.ts`

```ts
it('round-trips the sample exactly', () => {
  const a = importCsv(sampleCsv); if (!a.ok) throw new Error()
  const b = importCsv(exportCsv(a.data)); if (!b.ok) throw new Error()
  expect(b.data).toEqual(a.data); expect(b.issues).toEqual([])
})
it('writes original columns plus last_activity and US dates', () => {
  const a = importCsv(sampleCsv); if (!a.ok) throw new Error()
  const [header, first] = exportCsv(a.data).split('\r\n')
  expect(header).toBe(CSV_COLUMNS.join(',') + ',last_activity')
  expect(first).toBe('APP-2026-1001,Metro Dental Group,Elena Williams,390000,12/1/2025,Aisha Patel,Bank Statements (90 day),Under Review,1/28/2026,4/28/2026,Reviewing for completeness,1/29/2026')
})
it('quotes commas and quotes', () => {   // Review Focus 5
  const data = makeData([makeApp({ businessName: 'Smith, Jones & "Co"' })], [makeDoc({ notes: 'Called, left "voicemail"' })])
  const r = importCsv(exportCsv(data))
  expect(r.ok && r.data.applications[0].businessName).toBe('Smith, Jones & "Co"')
  expect(r.ok && r.data.documents.find(d => d.type === 'Lease Agreement')!.notes).toBe('Called, left "voicemail"')
})
it('names the file by date', () => {
  expect(exportFilename('2026-10-17')).toBe('sba-checklist-2026-10-17.csv')
})
```

(Expected `last_activity` `1/29/2026` is APP-2026-1001's latest received date in the sample.)

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement** `exportCsv`, `exportFilename`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: CSV export with lossless round trip"`

---

### Task 6: Pipeline queries and golden tests

**Files:**
- Create: `src/domain/pipeline.ts`, `src/test/golden.test.ts`
- Test: `src/domain/pipeline.test.ts`

**Interfaces:**
- Consumes: `summarizeApplication`, `AppSummary`, `statusGroup`, `expiryBadge` (Task 3).
- Produces:
  ```ts
  export type Card = 'all' | 'stalled' | 'expired' | 'expiring' | 'needs-decision'
  export interface HomeFilter { card: Card; search: string; processor: string | null }
  export type SortKey = 'id' | 'business' | 'processor' | 'idle' | 'progress' | 'outstanding'
  export interface SortSpec { key: SortKey; dir: 'asc' | 'desc' }
  export function buildSummaries(data: ChecklistData, asOf: IsoDate): AppSummary[]
  export function matchesCard(s: AppSummary, card: Card): boolean
  export function filterSummaries(list: AppSummary[], f: HomeFilter): AppSummary[]
  export function cardCounts(list: AppSummary[], f: Omit<HomeFilter, 'card'>): Record<Card, number>
  export function sortSummaries(list: AppSummary[], sort: SortSpec | null): AppSummary[]
  export function processorsOf(data: ChecklistData): string[]
  export function sortChecklistDocuments(docs: ChecklistDocument[], asOf: IsoDate): ChecklistDocument[]
  ```
  - `matchesCard`: stalled → `stalled`; expired → `expired ≥ 1`; expiring → `expiringSoon ≥ 1`; needs-decision → `needsDecision ≥ 1`.
  - Search: trimmed, case-insensitive substring of business name, borrower name, or ID; empty matches all. Processor: exact match; `null` matches all.
  - `cardCounts` counts after search + processor filters (so cards recount per processor).
  - Default sort (`null`): stalled first, then outstanding desc, then idle days desc, then ID asc. `progress` sorts by `done`.
  - `processorsOf`: unique, alphabetical.
  - `sortChecklistDocuments` rank: Needs Decision → has expiry badge → outstanding → in progress → done; ties in `DOC_TYPES` order.

- [ ] **Step 1: Write failing unit tests** `src/domain/pipeline.test.ts` — search (`'hilltop'` matches `Hilltop Dental Care`; `' app-2026-1003 '` matches by ID), processor filter, `cardCounts` recounting under a processor filter, default sort order (stalled before non-stalled; among equals, more outstanding first), `sortChecklistDocuments` putting a `Needs Decision` doc first and an `Approved` doc last.

- [ ] **Step 2: Write golden tests** `src/test/golden.test.ts` against `importCsv(sampleCsv)` with `asOf = '2026-02-15'`:

```ts
const s = buildSummaries(data, '2026-02-15')
const ids = (l: AppSummary[]) => l.map(x => x.app.id).sort()
it('outstanding', () => expect(s.filter(x => x.outstanding > 0)).toHaveLength(57))
it('needs decision', () => {
  expect(s.filter(x => x.needsDecision > 0)).toHaveLength(43)
  expect(data.documents.filter(d => d.status === 'Needs Decision')).toHaveLength(100)
})
it('stalled', () => expect(ids(s.filter(x => x.stalled))).toEqual(['APP-2026-1002','APP-2026-1005','APP-2026-1010',
  'APP-2026-1012','APP-2026-1014','APP-2026-1020','APP-2026-1035','APP-2026-1047','APP-2026-1053','APP-2026-1056','APP-2026-1060']))
it('expiry badges', () => {
  expect(s.reduce((n, x) => n + x.expired, 0)).toBe(6)
  expect(s.reduce((n, x) => n + x.expiringSoon, 0)).toBe(1)
})
it('unflagged expired bank statements', () => {
  const hits = data.documents.filter(d => d.type === 'Bank Statements (90 day)' && d.status !== 'Expired'
    && expiryBadge(d, '2026-02-15')?.kind === 'expired').map(d => d.applicationId).sort()
  expect(hits).toEqual(['APP-2026-1006', 'APP-2026-1009', 'APP-2026-1010', 'APP-2026-1021'])
})
it('stalled by processor', () => {
  for (const [p, n] of [['Aisha Patel', 5], ['Ricardo Fuentes', 4], ['Janet Morrison', 2]] as const)
    expect(cardCounts(s, { search: '', processor: p }).stalled).toBe(n)
})
it('fully complete', () => expect(s.filter(x => x.done === 12)).toHaveLength(0))
```

- [ ] **Step 3: Run** `npm test` — Expected: FAIL.
- [ ] **Step 4: Implement** `pipeline.ts`.
- [ ] **Step 5: Run** `npm test` — Expected: PASS. If a golden figure fails, fix the rule, not the figure — the figures were verified independently against the CSV.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: home-page queries and sample-data golden tests"`

---

### Task 7: Application form logic

**Files:**
- Create: `src/domain/applicationForm.ts`
- Test: `src/domain/applicationForm.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ApplicationFormInput { businessName: string; borrowerName: string; loanAmount: string;
    applicationDate: string /* ISO from <input type="date"> */; processor: string }
  export type ApplicationValues = Omit<Application, 'id' | 'lastActivity'>
  export type FormResult = { ok: true; values: ApplicationValues }
    | { ok: false; errors: Partial<Record<keyof ApplicationFormInput, string>> }
  export function validateApplicationForm(input: ApplicationFormInput): FormResult
  export function findDuplicate(data: ChecklistData, businessName: string, excludeId?: string): Application | undefined
  export function nextApplicationId(data: ChecklistData, today: IsoDate): string
  ```
  - Error copy: empty (after trim) → `Required`; loan amount not a number > 0 (after stripping `$`, `,`, spaces) → `Enter an amount greater than 0`; date not `isIsoDate` → `Enter a valid date`. Values are trimmed.
  - `findDuplicate`: trimmed, case-insensitive equality on business name, skipping `excludeId`.
  - `nextApplicationId`: highest numeric suffix + 1 keeping that ID's prefix (`APP-2026-1060` → `APP-2026-1061`); empty data → `APP-<year of today>-1001`.

- [ ] **Step 1: Write failing tests** — valid input returns trimmed values with `loanAmount: 390000` from `'$390,000'`; each field's error message above; `findDuplicate` matches `' metro dental group '` and ignores `excludeId`; `nextApplicationId(sampleData)` is `'APP-2026-1061'`, empty data in 2026 is `'APP-2026-1001'`.
- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: application form validation, duplicate check, ID generation"`

---

### Task 8: State reducer

**Files:**
- Create: `src/state/reducer.ts`
- Test: `src/state/reducer.test.ts`

**Interfaces:**
- Consumes: types, `autoExpirationDate`, `ApplicationValues`.
- Produces:
  ```ts
  export interface PersistedState { version: 1; data: ChecklistData; asOfOverride: IsoDate | null; lastExportedAt: IsoDate | null }
  export function initialState(data: ChecklistData): PersistedState
  export type Action =
    | { type: 'setStatus'; appId: string; docType: DocType; status: Status; asOf: IsoDate }
    | { type: 'updateDocument'; appId: string; docType: DocType; asOf: IsoDate;
        patch: { dateReceived?: IsoDate | null; expirationDate?: IsoDate | null; notes?: string } }
    | { type: 'markNotRequired'; appId: string; docType: DocType; reason: string; asOf: IsoDate }
    | { type: 'addApplication'; id: string; values: ApplicationValues; asOf: IsoDate }
    | { type: 'editApplication'; appId: string; values: ApplicationValues; asOf: IsoDate }
    | { type: 'deleteApplication'; appId: string }
    | { type: 'replaceData'; data: ChecklistData }
    | { type: 'setAsOf'; date: IsoDate | null }
    | { type: 'markExported'; at: IsoDate }
  export function reducer(state: PersistedState, action: Action): PersistedState
  ```
  - Every action that touches an application or its documents sets that application's `lastActivity = asOf`.
  - `setStatus` to `Received`, `Under Review`, or `Approved` when `dateReceived` is null → `dateReceived = asOf`. Whenever a document ends an action with a `dateReceived` and a null `expirationDate`, set `expirationDate = autoExpirationDate(type, dateReceived)`. No action clears dates.
  - `markNotRequired` → status `Not Required`; notes become `reason` if notes were empty, else `` `${reason} — ${notes}` ``.
  - `addApplication` → appends the application and 12 `Needs Decision` documents.
  - `setAsOf` with `''` is treated as `null`.
  - Pure: never mutates the input state.

- [ ] **Step 1: Write failing tests** covering each bullet, including: `setStatus(Received)` on a bank statement with `asOf '2026-02-15'` sets `dateReceived '2026-02-15'`, `expirationDate '2026-05-16'`, and `lastActivity '2026-02-15'`; `setStatus(Pending)` keeps existing dates; `markNotRequired` with existing notes `'Waiting on borrower'` yields `'Waived per SBA guidelines — Waiting on borrower'`; `addApplication` yields 12 `Needs Decision` docs; `deleteApplication` removes the app and its 12 docs; input state object is unchanged (`Object.freeze` it in the test).
- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: state reducer with auto-dates and last-activity tracking"`

---

### Task 9: Browser storage

**Files:**
- Create: `src/data/storage.ts`
- Test: `src/data/storage.test.ts`

**Interfaces:**
- Consumes: `PersistedState` (Task 8).
- Produces:
  ```ts
  export const STORAGE_KEY = 'sba-checklist:v1'
  export const BACKUP_KEY = 'sba-checklist:backup'
  export type LoadResult = { kind: 'empty' } | { kind: 'ok'; state: PersistedState } | { kind: 'corrupt' } | { kind: 'unavailable' }
  export function loadState(storage: Storage | null): LoadResult
  export function saveState(storage: Storage | null, state: PersistedState): boolean
  ```
  - `null` storage or a throwing `getItem` → `unavailable`. Unparseable JSON, `version !== 1`, or missing `data.applications`/`data.documents` arrays → copy the raw string to `BACKUP_KEY`, leave `STORAGE_KEY` untouched, return `corrupt`. `saveState` returns `false` on `null` storage or a throwing `setItem`.

- [ ] **Step 1: Write failing tests** with an in-memory `Storage` fake (a `Map`-backed object implementing `getItem`/`setItem`/`removeItem`/`clear`/`key`/`length`): empty → `empty`; save then load → `ok` with an equal state; `'{not json'` → `corrupt`, backup equals `'{not json'`, original key unchanged; `{"version":2,...}` → `corrupt`; `setItem` that throws → `saveState` returns `false`; `null` → `unavailable` / `false`.
- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: localStorage persistence with corruption backup"`

---

### Task 10: Weekly summary builder

**Files:**
- Create: `src/domain/weeklySummary.ts`
- Test: `src/domain/weeklySummary.test.ts`

**Interfaces:**
- Consumes: `buildSummaries`, `processorsOf` (Task 6), `formatLongDate`.
- Produces: `buildWeeklySummary(data: ChecklistData, asOf: IsoDate): string` — exact layout of spec §6 "Weekly pipeline summary", lines joined with `\n`. Loan volume `$X.XXM` (two decimals). Stalled list sorted by idle days desc then ID asc, line format `    <id> <business> — <n> days, <n> outstanding (<processor>)`; omitted when none. "Expired documents" and "Expiring" count documents by badge; the parenthetical counts bank statements among expired: `(6 bank statements)`, singular `(1 bank statement)`, omitted when 0. Processors alphabetical, `  <name> — <n> applications, <n> stalled`.

- [ ] **Step 1: Write failing tests** against the sample at `'2026-02-15'`:

```ts
const text = buildWeeklySummary(data, '2026-02-15')
const lines = text.split('\n')
expect(lines[0]).toBe('SBA Pipeline Summary — as of Feb 15, 2026')
for (const l of ['  60 active applications · $15.62M total loan volume', '  57 waiting on documents · 0 fully complete',
  '  Stalled (no documents in 21+ days): 11', '  Expired documents: 6 (6 bank statements)', '  Expiring in the next 14 days: 1',
  '  Applications with undecided documents: 43', '  Aisha Patel — 18 applications, 5 stalled',
  '  Janet Morrison — 18 applications, 2 stalled', '  Ricardo Fuentes — 24 applications, 4 stalled'])
  expect(lines).toContain(l)
const stalled = lines.filter(l => /^    APP-/.test(l))
expect(stalled).toHaveLength(11)
expect(stalled[0]).toBe('    APP-2026-1060 Harbor Fish Market — 67 days, 5 outstanding (Aisha Patel)')
expect(stalled[10]).toBe('    APP-2026-1020 Silver Lining Bakery — 21 days, 5 outstanding (Janet Morrison)')
```
Plus a small-data test: no stalled lines when none are stalled; `(1 bank statement)` singular.

- [ ] **Step 2: Run** `npm test` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: weekly pipeline summary text"`

---

### Task 11: UI shell — design direction, store hook, header, safety nets

**Files:**
- Create: `src/ui/tokens.css`, `src/ui/app.css`, `src/ui/download.ts`, `src/ui/useChecklistStore.ts`, `src/ui/App.tsx`, `src/ui/ErrorBoundary.tsx`, `src/ui/Header.tsx`
- Modify: `src/main.tsx` (render `<ErrorBoundary><App /></ErrorBoundary>`, import CSS)

**Interfaces:**
- Consumes: `reducer`, `initialState`, `PersistedState`, `Action` (Task 8); `loadState`, `saveState`, `STORAGE_KEY` (Task 9); `importCsv` (Task 4); `exportCsv`, `exportFilename` (Task 5); `todayIso`, `formatLongDate`, `daysBetween`.
- Produces:
  - `downloadText(filename: string, text: string, mime?: string): void`
  - `useChecklistStore(): { state: PersistedState | null; dispatch: (a: Action) => void; asOf: IsoDate; storage: 'ok' | 'unavailable' | 'corrupt'; loadSample: () => void; replaceData: (d: ChecklistData) => void }`
    - Load on mount: `ok` → use it; `empty` → `initialState(importCsv(sampleCsv).data)`; `unavailable` → same, in memory only; `corrupt` → `state = null` until `loadSample()` or an import.
    - `asOf = state.asOfOverride ?? todayIso()`.
    - Save after every state change; a `false` result switches `storage` to `'unavailable'`.
    - Listen for the `storage` event on `STORAGE_KEY` and reload state from it.
  - `App`: holds `selectedAppId: string | null` (no router). Renders the header, banners, and either Home (Task 12) or Checklist (Task 13) — placeholders for now. If the selected application no longer exists, returns to Home.
  - `Header` props: `asOf`, `asOfOverride`, `lastExportedAt`, `onSetAsOf(date: IsoDate | null)`, `onExport()`, `onImport()`, `onReset()`, `onWeeklySummary()`. Import/Reset/Weekly summary are wired in Task 15.

- [ ] **Step 1: Set the visual direction.** Invoke the `frontend-design` skill with this brief: *internal operations tool for three non-technical loan processors; calm and trustworthy, dense like a spreadsheet, not playful; must meet the spec §7 usability rules.* Record the result only as CSS variables in `src/ui/tokens.css` (colors incl. status/expiry colors, type scale, spacing, radius) and base styles in `src/ui/app.css`. Status/expiry colors are chosen per the `dataviz` skill's guidance and checked for AA contrast against their backgrounds.

- [ ] **Step 2: Implement** `download.ts`, `useChecklistStore.ts`, `Header.tsx`, `ErrorBoundary.tsx`, `App.tsx`.
  - Header shows the "As of" date (`formatLongDate`) with a `<input type="date">` to change it, and `Last exported: n days ago` (or `Never exported`) computed against `todayIso()`. Export calls `exportCsv` → `downloadText(exportFilename(todayIso()), …)` → `dispatch({ type: 'markExported', at: todayIso() })`.
  - Banner when `asOfOverride` is set: `Viewing as of Feb 15, 2026 · [Back to today]`.
  - Banner when `storage === 'unavailable'`: `Changes can't be saved in this browser. Use Export to keep your work.`
  - Screen when `storage === 'corrupt'`: `Your saved data couldn't be read. It has been kept as a backup.` with **[Load sample data]** and **[Import CSV]**.
  - ErrorBoundary fallback: `Something went wrong. Your saved data is safe.` with **[Reload]** and **[Export my data]** (reads `STORAGE_KEY` from `localStorage`, parses it, `exportCsv(state.data)`, downloads; if that fails, downloads the raw string as `sba-checklist-backup.json`).

- [ ] **Step 3: Verify** — `npm test` (all pass), `npm run build` (succeeds), `npm run dev` and check in the browser: header renders; changing "As of" shows the banner and survives a refresh; **Back to today** clears it; Export downloads a CSV whose first line matches the header in Task 5.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: app shell with design tokens, persistence hook, header, and safety banners"`

---

### Task 12: Home screen

**Files:**
- Create: `src/ui/HomePage.tsx`, `src/ui/FilterCards.tsx`, `src/ui/ApplicationTable.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/app.css`

**Interfaces:**
- Consumes: `buildSummaries`, `filterSummaries`, `cardCounts`, `sortSummaries`, `processorsOf`, `Card`, `SortSpec` (Task 6).
- Produces: `HomePage` props `{ data: ChecklistData; asOf: IsoDate; onOpen(appId: string): void; onNew(): void }`. Filter, search, processor and sort are local component state.

- [ ] **Step 1: Implement** per spec §6 Screen 1 and the `dataviz` skill's stat-tile guidance:
  - Cards in order All / 🐢 Stalled / 🔴 Expired docs / 🟠 Expiring soon / ❓ Needs decision, each showing its `cardCounts` number; the active card is visually selected and `aria-pressed`.
  - Search box and `Processor: [All ▾]` select (options from `processorsOf`).
  - `[+ New application]` button top-right (calls `onNew`; dialog arrives in Task 14).
  - Table columns: Application, Business / Borrower, Processor, Last activity (`n days ago`, 🐢 + "Stalled" text when stalled), Progress (bar + `done/12`), Outstanding, Flags (`🔴 n · 🟠 n · ❓ n` with accessible text). Clickable column headers toggle `SortSpec`; default `null`. Whole row is clickable and keyboard-activatable (Enter).
  - Empty result: `No applications match these filters.`

- [ ] **Step 2: Verify** — `npm test`, `npm run build`, then in the browser with "As of" set to 2026-02-15: cards read All 60 · Stalled 11 · Expired docs 6 · Expiring soon 1 · Needs decision 43; first row is APP-2026-1047 (stalled, 7 outstanding, 43 days idle); choosing Aisha Patel shows Stalled 5; searching `hilltop` shows APP-2026-1003.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: home screen with filter cards, search, processor filter, and sortable table"`

---

### Task 13: Checklist screen

**Files:**
- Create: `src/ui/ChecklistPage.tsx`, `src/ui/DocumentRow.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/app.css`

**Interfaces:**
- Consumes: `summarizeApplication`, `expiryBadge` (Task 3); `sortChecklistDocuments` (Task 6); `NOT_REQUIRED_REASONS`; `Action` (Task 8); `formatUsDate`, `isIsoDate`.
- Produces: `ChecklistPage` props `{ app: Application; documents: ChecklistDocument[]; asOf: IsoDate; dispatch(a: Action): void; onBack(): void; onEdit(): void; onDelete(): void }`.

- [ ] **Step 1: Implement** per spec §6 Screen 2:
  - Summary line: borrower · `$390,000` · processor · `Opened n days ago` · `Last activity n days ago` (🐢 Stalled when stalled) · `n/12 done`; **[Edit details]** and **[Delete application]** (wired in Task 14).
  - Rows in `sortChecklistDocuments` order. Columns Document, Status, Received, Expires (date + badge text `Expired n days ago` / `Expires in n days`), Notes.
  - Status `<select>` of the six team statuses → `setStatus`. A `Needs Decision` row shows **[Request]** (→ `setStatus` Pending) and **[Not required ▾]** (reason select → `markNotRequired`). The tooltip on status `Expired` reads `Replacement requested`.
  - Received / Expires: `<input type="date">`; an invalid value shows `Enter a valid date` and is not dispatched. Expires earlier than Received shows a ⚠ `Expires before it was received` warning but is saved.
  - Notes: text input saved on blur or Enter via `updateDocument`.
  - After any dispatch, show `Saved ✓` for ~2 s.

- [ ] **Step 2: Verify** — `npm test`, `npm run build`, then in the browser (as of 2026-02-15): open APP-2026-1006 → Bank Statements shows `Approved` with `Expired 33 days ago`; open APP-2026-1001 → the 3 Needs decision rows are first; click **Request** on one → it becomes Pending and the home page shows APP-2026-1001 active today; set a Pending bank statement to Received → Received and Expires fill in (+90 days); refresh → changes persist.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: checklist screen with inline status, dates, notes, and needs-decision actions"`

---

### Task 14: New / edit / delete application

**Files:**
- Create: `src/ui/ApplicationFormDialog.tsx`, `src/ui/ConfirmDialog.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/HomePage.tsx`, `src/ui/ChecklistPage.tsx`

**Interfaces:**
- Consumes: `validateApplicationForm`, `findDuplicate`, `nextApplicationId`, `ApplicationValues` (Task 7); `processorsOf`; `Action`.
- Produces:
  - `ApplicationFormDialog` props `{ mode: 'new' | 'edit'; initial?: Application; data: ChecklistData; onSave(values: ApplicationValues): void; onCancel(): void }`
  - `ConfirmDialog` props `{ title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm(): void; onCancel(): void }` — reused by Task 15.

- [ ] **Step 1: Implement:**
  - Native `<dialog>` with fields Business name, Borrower name, Loan amount, Application date (`type="date"`), Processor (`<select>` of `processorsOf` + `Other…`, which reveals a text input). Errors from `validateApplicationForm` show under each field; **Save** is disabled until valid.
  - On Save in `new` mode, if `findDuplicate` matches, show `<Business> already has <ID>. Create anyway?` with **[Create anyway]** / **[Cancel]**; in `edit` mode pass `excludeId`.
  - New: `dispatch({ type: 'addApplication', id: nextApplicationId(data, todayIso()), values, asOf })` then open its checklist. Edit: `editApplication`.
  - Delete: `ConfirmDialog` with message `Delete <Business> (<ID>) and its 12 documents? This can't be undone.` → `deleteApplication` → back to Home.

- [ ] **Step 2: Verify** — `npm test`, `npm run build`, then in the browser: create `Test Bakery` → lands on APP-2026-1061 with 12 Needs decision rows; try to create `metro dental group` → duplicate warning; edit the processor via **Other…** → new name appears in the home processor filter; delete Test Bakery → gone from Home and the count returns to 60.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: create, edit, and delete applications with validation and duplicate warning"`

---

### Task 15: Import, Reset, and Weekly summary dialogs

**Files:**
- Create: `src/ui/ImportDialog.tsx`, `src/ui/WeeklySummaryDialog.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/Header.tsx`

**Interfaces:**
- Consumes: `importCsv`, `ImportResult` (Task 4); `exportCsv`, `exportFilename` (Task 5); `buildWeeklySummary` (Task 10); `ConfirmDialog` (Task 14); `replaceData`, `loadSample` from `useChecklistStore` (Task 11).

- [ ] **Step 1: Implement:**
  - **Import:** hidden `<input type="file" accept=".csv,text/csv">`; read with `file.text()`. Fatal `ImportResult` → show its `error` text, nothing changes. OK → dialog `Found <n> applications and <n> documents. This will replace your current data.` plus a list of issues (if any) under `<n> rows need attention:`; buttons **[Export & replace]**, **[Replace]**, **[Cancel]**. Replace → `replaceData(result.data)` and return to Home. The corrupt-data screen's **[Import CSV]** uses the same flow.
  - **Reset:** `ConfirmDialog` `This replaces all your changes with the sample data.` → `loadSample()`.
  - **Weekly summary:** dialog with the `buildWeeklySummary(state.data, asOf)` text in a read-only `<pre>`/textarea and **[Copy]** (`navigator.clipboard.writeText`, shows `Copied ✓`; on failure selects the text and shows `Press Ctrl+C (⌘C on Mac) to copy`).

- [ ] **Step 2: Verify** — `npm test`, `npm run build`, then in the browser: Export → edit something → Import the exported file → the edit is undone and data matches the export; import a text file with a bad header → error shown, data unchanged; import a copy of the sample with one status changed to `Recieved` → preview lists `Row N: unknown status "Recieved"`; Reset restores sample counts; Weekly summary (as of 2026-02-15) matches the spec §6 example and Copy works.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: import preview, reset, and weekly summary dialogs"`

---

### Task 16: README, smoke test, final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write `README.md`** with: one-paragraph purpose; requirements (Node 20.19+ or 22.12+); setup (`npm install`, `npm run dev`, open the printed URL); `npm test`; a "Demo tip" (set **As of** to Feb 15, 2026 to see the sample data as it was); the spec §10 manual smoke-test checklist as checkboxes; a "Known limitations" list (T1 browser-only storage, T9 no undo, T11 import replaces, A10 save `.xlsx` as CSV first); a link to the spec.

- [ ] **Step 2: Full verification** — from a clean clone in a temp directory: `npm install && npm test && npm run build` all succeed; `npm run dev` serves the app; walk the README smoke-test checklist in the browser and tick each item.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "docs: README with setup, smoke test, and known limitations"`
