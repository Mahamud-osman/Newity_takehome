# SBA Document Checklist — Design Spec

**Date:** 2026-10-17
**Status:** Draft for review
**Source material:** NEWITY Assessment brief (A — Document Checklist), `NEWITY_Sample_Data_A_Document_Checklist.csv` (620 rows, 60 applications, 12 document types)

---

## 1. Problem & Users

The loan operations team tracks SBA document checklists in a shared spreadsheet. Each application needs up to 12 document types; there are 50–75 active applications at any time.

**Users:** two loan processors and one team lead. Not technical. *"If it's harder than the spreadsheet, they won't use it."* All three work one shared pool of applications.

**Biggest pain:** *"Not knowing which applications are stalled waiting on documents. Things fall through the cracks."*

**Most rework:** expired documents — bank statements (90 days) and tax returns (3 years).

**Success looks like:**
- A user opens the tool and within seconds sees which applications are stalled, what each is missing, and what has expired or is about to.
- Updating a document's status is no harder than editing a spreadsheet cell.
- The tool can fully replace the spreadsheet for day-to-day work (add, edit, and remove applications), with CSV export as an exit ramp.

## 2. Priorities

Built around the biggest pain point first, then the area with the most rework:

1. **Stalled / outstanding applications** — the home page.
2. **Document status tracking per application** — the checklist screen.
3. **Expiration tracking** — date-derived badges, bank statements first.

## 3. What the Sample Data Told Us

All figures use an "as of" date of **Feb 15, 2026** (the end of the sample data's activity) unless noted.

| Finding | Number | Design consequence |
|---|---|---|
| Applications with at least one Pending or Expired document | 57 of 60 | Filtering to "has outstanding" alone hides almost nothing → home page must *prioritize*, not just filter |
| Applications listing fewer than 12 document types | 43 of 60 (72%), 100 documents total | Unlisted types are normal, spread across every type, not tied to loan size → listed documents are the checklist; unlisted types are "not needed" (hidden) |
| "Not Required" rows, all with a reason note | 26, every type waived at least once | "Optional" is a per-application decision the team already records |
| Applications fully complete (all Approved / Not Required) | 0 | No evidence for what a "complete" application looks like |
| Stored "Expired" rows with note "replacement requested" | 35 of 37 | "Expired" is a manual workflow flag, not a date check |
| Stored "Expired" rows on document types that have no expiration | 27 of 37 | Same as above |
| Bank statements past their expiration date but **not** marked Expired | 4 (APP-2026-1006 *Approved*, 1009, 1010, 1021) | The spreadsheet misses date-based expiry → compute it |
| Expiration date − received date | Exactly 90 / 1,095 / 365 days for bank / tax / insurance, no exceptions | Expiry rules are reliable and can auto-fill new dates |
| Applications with outstanding docs and no document received for 14+ / 21+ / 30+ days | 23 / 11 / 6 | Stalled threshold = 21 days |
| Application age ≥ 60 days | 48 of 60 | Age alone flags everything → not used for "stalled" |

## 4. Architecture

- **Single-page web app, browser only, no backend.** React + TypeScript + Vite. Papa Parse for CSV. Vitest for tests.
- The app ships with **no data**: it opens empty and the team imports their spreadsheet (as CSV) or adds applications. The sample CSV is a test fixture only (`src/test/fixtures/`), never bundled into the app.
- All data is saved in the browser (localStorage). Each browser holds its own copy.
- Setup for a reviewer: `npm install && npm run dev` (Node 20.19+ or 22.12+, required by current Vite).

### Code layout

```
src/
  domain/   types, rules (stalled, expiry, counts), settings   ← pure functions, unit-tested
  data/     CSV parse / export, normalize, storage             ← unit-tested (incl. round-trip)
  state/    reducer + actions                                  ← unit-tested
  ui/       Home, Checklist, Header, forms                     ← React only, thin
```

Business rules live in `domain/` as pure functions so every decision in this spec is directly testable. React components only render state and dispatch actions.

## 5. Data Model & Rules

### Records

**Application**
- `id` (e.g. `APP-2026-1003`; generated for new applications by continuing the sequence; never editable)
- business name, borrower name, loan amount, application date, assigned processor

The processor is shown as a column and can be used as a filter on the home page. The pool stays shared: anyone can open and edit any application.

**Document** — exactly **12 per application**, one per document type:
- type, status, date received, expiration date, notes
- Each application also tracks a **last activity** date.

**Document types (fixed list of 12):** Bank Statements (90 day), Business Tax Returns (3yr), Personal Tax Returns (3yr), Insurance Verification, Business Financial Statements, Business Licenses & Permits, Articles of Incorporation, Lease Agreement, Debt Schedule, Ownership Verification, SBA Form 1919, SBA Form 912.

**Status values:** the team's six — Pending, Received, Under Review, Approved, Expired, Not Required.

**Needed vs. not needed:** a document is *needed* unless its status is **Not Required**. Not Required documents are unticked from the application's checklist and hidden. Document types not listed for an application in an imported CSV come in as Not Required with the note *"Not on imported checklist"*. (Earlier versions used a "Needs Decision" status for these; it is converted on import and when loading saved data.)

### Rules

All rules are pure functions that take the "as of" date as an input.

| Rule | Definition |
|---|---|
| **Outstanding** | Status is Pending or Expired |
| **In progress** | Status is Received or Under Review |
| **Done** | Status is Approved |
| **Not needed** | Status is Not Required. Hidden from the checklist and excluded from progress, outstanding, stalled, and expiry. |
| **Progress** | Approved ÷ needed (e.g. "5/9") |
| **Complete** | Every needed document is approved |
| **Expiry badge** | Only when the document has an expiration date and status is not Not Required. 🔴 **Expired** if the date is before "as of"; 🟠 **Expiring soon** if within the next 14 days; otherwise none. |
| **Last activity** | Latest of: any document's received date, or any change made in the app to that application or its documents. Falls back to the application date. Never moves backwards (an edit made while viewing a past "as of" date doesn't reset it). |
| **Stalled** | Application has ≥1 outstanding document **and** "as of" − last activity ≥ 21 days |
| **Auto expiration date** | When a time-sensitive document gets a received date and has no expiration date, set it to received + 90 days (bank statements), + 1,095 days (business and personal tax returns), or + 365 days (insurance). Day counts match the sample data exactly. The user can edit it. If a new received date replaces an old one (a fresh bank statement) and the expiration date was still the automatic value, it is recalculated; a manually entered expiration date is kept. |

### Status vs. expiry

Status and expiry are deliberately separate:
- **Status** is the team's workflow and is only ever changed by a person. The stored "Expired" status keeps its meaning of "replacement requested" (a tooltip says so).
- **Expiry** is a badge computed from the expiration date. The app never changes a status automatically.

A document can therefore show both, e.g. "Approved · 🔴 Expired 12 days ago" — exactly the rework case the team described.

### Settings (one file)

```
STALLED_DAYS        = 21
EXPIRING_SOON_DAYS  = 14
EXPIRY_DAYS         = { Bank Statements (90 day): 90, Business Tax Returns (3yr): 1095, Personal Tax Returns (3yr): 1095, Insurance Verification: 365 }
```

Every threshold assumption lives in exactly one place.

### Dates

CSV dates (`1/28/2026`) are converted to ISO dates on load and back to the original format on export.

## 6. Screens

Two screens plus a header. Navigation is "click a row" and "← Back".

### Header (always visible)

```
SBA Document Checklist     As of: Oct 17, 2026 [change]     Weekly summary · Import CSV · Export CSV · Clear all data
                                                            Last exported: 6 days ago
```

- **As of** defaults to today. Changing it recalculates all badges and flags. When it isn't today, a banner shows: *"Viewing as of Feb 15, 2026 · [Back to today]"*.
- **Last exported** reminder, because Export is the only backup.
- **Clear all data** asks for confirmation: *"Delete all applications from this browser? Export first if you want to keep them."*
- **Empty state:** with no applications, the home page shows *"No applications yet — Import your spreadsheet (saved as CSV) or add an application."* with **Import CSV** and **+ New application**.

### Screen 1 — Home

**Filter cards** (each counts applications; one active at a time; clicking filters the table):

```
[ All ]  [ 🐢 Stalled ]  [ 🔴 Expired docs ]  [ 🟠 Expiring soon ]
```

| Card | Counts applications with… |
|---|---|
| All | — |
| 🐢 Stalled | the Stalled rule |
| 🔴 Expired docs | ≥1 document with a 🔴 expiry **badge** (date-based, not the stored "Expired" status) |
| 🟠 Expiring soon | ≥1 document with a 🟠 expiry badge |

**Search** by business name, borrower name, or application ID.

**Processor filter:** a `Processor: [All ▾]` dropdown next to the search, listing every processor in the data. It combines with the cards and search: choosing a processor recounts the cards for that processor's applications only (e.g. Aisha Patel → Stalled 5), and a card click narrows further.

**[+ New application]** button, top-right above the table.

**Application table:**

| Column | Example |
|---|---|
| Application | APP-2026-1003 |
| Business / Borrower | Hilltop Dental Care · Priya White |
| Processor | Janet Morrison |
| Last activity | 22 days ago 🐢 |
| Progress | ███░░░ 4/12 |
| Outstanding | 5 |
| Flags | 🔴 1 · 🟠 0 · ❓ 1 |

- Default sort: stalled first, then most outstanding documents. Column headers re-sort.
- Clicking a row opens that application's checklist.

### Screen 2 — Application checklist

**Summary:**

```
← Back   Hilltop Dental Care — APP-2026-1003                  [Edit details] [Delete application]
Priya White · $90,000 · Janet Morrison · Opened 76 days ago · Last activity 22 days ago 🐢 · 4/12 done
```

**Needed documents**, each with a ticked **Needed** checkbox, sorted by what needs attention: 🔴/🟠 expiry → Pending/Expired → In progress → Approved. Below the table, a collapsed **"Not needed for this loan (n) ▸"** section lists the unticked documents.

| Needed | Document | Status | Received | Expires | Notes |
|---|---|---|---|---|---|
| ☑ | Bank Statements (90 day) | [Expired ▾] | 7/18/2025 | 10/16/2025 🔴 | Needs updated statements |
| ☑ | SBA Form 1919 | [Pending ▾] | — | — | Requested from borrower 2/3 |

```
Not needed for this loan (1) ▾
  ☐ Lease Agreement      [Not on imported checklist ▾]
```

**Editing:**
- **Status** is a dropdown; changes save instantly with a brief "Saved ✓" confirmation.
- **Unticking Needed** marks the document Not Required and moves it to the hidden section. **Re-ticking** puts it back on the checklist as Pending. The status dropdown does not offer Not Required (the checkbox is the one way to set it).
- **Reason (optional):** each hidden document has a reason dropdown with the team's existing list (*Waived per SBA guidelines*, *Exempt – sole proprietorship*, *Not applicable for this loan type*, *Other*). The reason sits at the start of the notes and replaces an earlier reason rather than stacking.
- **Setting a status of Received, Under Review, or Approved** on a document with no received date fills the received date with **today's date** (the day the change is made), and the expiration date via the auto-expiry rule. **Re-receipt:** if the document was **Expired** (replacement requested) or **Pending** (re-requested) and already had a received date, the new receipt replaces it — received date = today, expiration recalculated (cleared for types with no expiry rule). Moving between Received, Under Review, and Approved keeps the dates.
- **Received date, expiration date, and notes** are edited inline. A date saves as soon as the field holds a complete, plausible date (picked from the calendar or typed); half-typed values such as `0002-10-10` are ignored; clearing a date saves when the user leaves the field or presses Enter.
- **Expires field:** shown for the four time-sensitive types. The other eight types show **"— Add date"** (a processor can still enter a fixed end date, e.g. a license renewal or lease end); once a date is entered it stays visible.
- **Dropdowns** save immediately on a mouse choice; with the keyboard, the choice is saved on Enter or on leaving the field, so arrowing through options never saves by accident.
- **Every change** updates the application's last activity.

### Application management

- **New application:** a form for business name, borrower name, loan amount, application date, processor (all required). The ID is generated. Saving opens the new checklist with all 12 documents ticked as Pending; the processor unticks the ones the loan doesn't need.
- **Processor input:** a dropdown of the processors already in the data plus **Other…**, which reveals a text box for a new name. A dropdown prevents spelling variants ("Aisha Patel" / "aisha patel") from splitting the filter and the weekly summary.
- **Duplicate warning:** if the business name matches an existing application: *"Metro Dental Group already has APP-2026-1001. Create anyway?"*
- **Edit details:** the same form, pre-filled.
- **Delete application:** behind a confirmation: *"Delete Hilltop Dental Care (APP-2026-1003) and its 12 documents? This can't be undone."*

### Weekly pipeline summary

Replaces the team lead's manual Monday email. **[Weekly summary]** in the header opens a panel with ready-to-paste plain text and a **Copy** button. The text is a snapshot as of the "as of" date and always covers all applications (it ignores the home page filters).

Example (sample data, as of Feb 15, 2026):

```
SBA Pipeline Summary — as of Feb 15, 2026

PIPELINE
  60 active applications · $15.62M total loan volume
  57 waiting on documents · 0 fully complete

NEEDS ATTENTION
  Stalled (no documents in 21+ days): 11
    APP-2026-1060 Harbor Fish Market — 67 days, 5 outstanding (Aisha Patel)
    APP-2026-1056 FreshCo Grocery — 47 days, 1 outstanding (Aisha Patel)
    ...
  Expired documents: 6 (6 bank statements)
  Expiring in the next 14 days: 1

BY PROCESSOR
  Aisha Patel — 18 applications, 5 stalled
  Janet Morrison — 18 applications, 2 stalled
  Ricardo Fuentes — 24 applications, 4 stalled
```

- Stalled applications are listed in full, longest idle first.
- Loan volume is shown in millions with two decimals.
- Processors are listed alphabetically.

## 7. UI & Usability

The users are non-technical and will abandon anything harder than the spreadsheet. Visual design follows the **frontend-design** skill (a deliberate, consistent visual direction recorded as CSS variables in one tokens file); the filter cards, progress bars, and expiry badges follow the **dataviz** skill's color and stat-tile guidance.

Usability rules, which apply to every screen:
- Plain-language labels; no jargon or codes beyond the application ID.
- Status and expiry are never shown by color alone — always with a text label or icon.
- Text and badge colors meet WCAG AA contrast.
- Click targets are at least 32 px tall; every control is reachable by keyboard.
- The home table reads like a spreadsheet: dense rows, left-aligned text, right-aligned numbers.
- Confirmations only for destructive actions (Delete, Clear all data, Import); everything else saves instantly.

## 8. Data Flow & Saving

```
 CSV file ──parse──► normalize ──► App state ──save──► localStorage
 (sample or import)  (dates, 12 docs,  │   ▲
                      last activity)   │   │ actions (setStatus, updateDocument,
                                       ▼   │  addApplication, editApplication,
                       rules (stalled, expiry, counts) ──► screens     deleteApplication, import, clear, setAsOf)
```

- **State** is held in one React `useReducer`. Every change is a named action handled by a pure reducer.
- **Derived values** (stalled, expiry badges, counts) are computed from state + "as of" on render, never stored.

### First open
If localStorage has no saved data, the app starts with no applications and shows the empty state. Nothing is seeded.

### Normalizing imported data
Convert dates; add unlisted document types as Not Required ("Not on imported checklist"); set each application's last activity to its latest received date (or application date).

### Saving
- One localStorage entry containing applications, documents, the "as of" override, and the last-exported time (~150 KB).
- Saved after every change.
- Includes `version: 1` so future versions can migrate saved data.

### "As of" date
- Stored as an override; empty means "use today".
- It only changes how data is **viewed** (badges, stalled, counts, weekly summary). Dates the app records — received date, auto expiration, last activity — always use the real date of the change.
- The override survives refresh (for demos) and is always shown in a banner with **Back to today**.

### Import CSV (replaces all data)
1. User picks a file; it is parsed and validated (see §9).
2. Preview and confirm: *"Found 60 applications and 620 documents. This will **replace** your current data. [Export & replace] [Replace] [Cancel]"*
3. Replace and save.

### Export CSV
- The original columns in the original order, dates in the original format, one row per document — all 12 per application, so hidden (Not Required) documents are included and stay hidden after a re-import.
- Extra trailing column `last_activity` so in-app activity survives a round trip. Extra columns are optional on import; the original CSV imports cleanly and last activity is computed.
- Filename `sba-checklist-YYYY-MM-DD.csv`. Updates the "Last exported" reminder.

### Clear all data
Confirm, then start over with no applications (also clears the "as of" override and last-exported time).

## 9. Error Handling

**Rule:** every message is plain language and says whether anything changed. No blank screens or raw technical errors.

### Import

| Problem | Behavior |
|---|---|
| Not a CSV / empty file | Blocked: *"This file doesn't look like a document checklist. Nothing was changed."* |
| Required column missing | Blocked; names the missing columns. Nothing changed. |
| Case / whitespace differences in status or type | Normalized silently |
| Unknown status or document type | Row skipped and listed in the preview (with row number) |
| Unreadable date | Date left blank; row kept; listed in the preview |
| Same document type twice for one application | Later row kept; listed in the preview |
| Application fields differ across rows | First row's values used; listed in the preview |

Row-level problems are never silent: the preview lists every issue before anything is replaced, and the user chooses **Replace anyway** or **Cancel**.

### Saving

| Problem | Behavior |
|---|---|
| localStorage unavailable or full | App keeps working in memory; persistent banner: *"Changes can't be saved in this browser. Use Export to keep your work."* |
| Saved data corrupted or unknown version | Not overwritten; raw data kept as a backup; user offered **Start empty** or **Import CSV** |
| App open in two tabs | Each tab reloads state when the other saves (browser `storage` event) |

### Forms and fields
- New / edit application: required fields, loan amount a positive number, valid date; inline errors; Save disabled until valid.
- Document dates: unreadable date → inline error, not saved. Expiration before received → warning, allowed.

### Crashes
A React error boundary shows *"Something went wrong. Your saved data is safe. [Reload] [Export my data]"*. Export works from this screen by reading localStorage directly.

### Not handled
- Very large files (team has 50–75 applications).
- `.xlsx` import — README instructs users to save as CSV first.

## 10. Testing

### Automated (Vitest), written test-first

**Rules (`domain/`)**
- Stalled: 20 days idle → not stalled; 21 days → stalled; 30 days idle with 0 outstanding → not stalled.
- Expiry badge: expired yesterday → 🔴; expires in 14 days → 🟠; in 15 days → none; no date → none; Not Required with a past date → none.
- Auto expiration: bank +90 days; tax +1,095 days, including a span over Feb 29 (received 1/1/2024 → 12/31/2026); insurance +365 days; non-expiring types → no date.
- Outstanding / progress: Pending and Expired are outstanding; progress is Approved ÷ needed; Not Required is excluded; complete = every needed document approved.
- Last activity: latest received date; in-app change updates it; falls back to application date.

**Data (`data/`)**
- Round-trip: sample CSV → import → export → re-import is identical.
- Normalize: an application with 8 listed types becomes 12 documents, 4 Not Required with "Not on imported checklist"; legacy "Needs Decision" rows are converted the same way.
- Import problems: missing column → blocked; `approved` → Approved; `Recieved` → skipped and reported; bad date → blank and reported.
- Storage: corrupted data is not overwritten and is backed up.

**Application form (`domain/`)**
- Missing field, non-numeric or zero loan amount, or invalid date → field error.
- Duplicate check is case- and whitespace-insensitive and ignores the application being edited.

**State (`state/`)**
- `setStatus(Received)` fills received and expiration dates and updates last activity.
- `addApplication` creates 12 Pending documents with the next ID.
- `setNeeded` false → Not Required, true → Pending; `setNotNeededReason` replaces rather than stacks reasons.
- `deleteApplication` removes the application and its 12 documents.

**Golden tests against the sample data** (as of 2026-02-15)

| Check | Expected |
|---|---|
| Applications with outstanding documents | 57 |
| Not needed documents | 126 (100 unlisted + 26 Not Required) across 48 applications |
| Fully complete applications | 0 |
| Stalled applications (21 days) | 11 — APP-2026-1002, 1005, 1010, 1012, 1014, 1020, 1035, 1047, 1053, 1056, 1060 |
| Documents with 🔴 expiry badge | 6 |
| Documents with 🟠 expiry badge | 1 |
| Bank statements past expiration, not marked Expired | 4 — APP-2026-1006, 1009, 1010, 1021 |
| Stalled applications by processor | Aisha Patel 5 · Ricardo Fuentes 4 · Janet Morrison 2 |
| Weekly summary | Contains the figures above, $15.62M, and the 11 stalled applications in idle order (1060 first at 67 days, 1020 last at 21 days) |

### Manual smoke test (README checklist)
1. Fresh open is empty; Import CSV of the sample loads 60 applications.
2. Each filter card shows the expected count.
3. Change a status → refresh → still changed.
4. Add, edit, then delete an application.
5. Export → Clear all data → Import the export → data matches.
6. Change "as of" → badges change → Back to today.
7. Import a broken CSV; open in a private window.

### QA plan before real rollout (demo discussion, not built)
- **User testing:** each of the 3 users completes 3 real tasks unaided (find stalled applications, record a received bank statement, add an application).
- **Parallel run:** 1–2 weeks alongside the spreadsheet, comparing the stalled and expired lists each Monday.
- **Browsers:** whatever the team actually uses (Chrome / Edge / Safari).
- **Validate assumptions A1–A4** with the team.

## 11. Assumptions & Tradeoffs

### Assumptions
Made without input from the ops team; each is a question to raise with them.

| # | Assumption | Basis |
|---|---|---|
| A1 | An application is stalled after 21+ days with no document activity while it has outstanding documents | The data breaks naturally at about 3 weeks; flags 11 of 60; nearly a quarter of a bank statement's 90-day window |
| A2 | "Expiring soon" means within 14 days | Two weeks to obtain fresh bank statements |
| A3 | Insurance expires 1 year after receipt | Inferred from the data (all 33 insurance rows); the brief names only bank statements and tax returns |
| A4 | The documents listed for an application are its checklist; an unlisted type is not needed for that loan | SBA requirements vary by program, entity type, and loan size; 72% of applications have gaps, across every type; processors set up each file knowing the deal |
| A5 | The stored "Expired" status means "replacement requested" | 35 of 37 Expired rows carry that note; 27 are on non-expiring types |
| A6 | All three users share one pool of applications | Confirmed in brainstorming |
| A7 | Knowing *who* made a change isn't needed for v1 | Three users; no user identity in the data |
| A8 | The 12 document types are the complete list | Brief: "up to 12 different document types" |
| A9 | CSV export is an acceptable exit ramp back to the spreadsheet | Same columns and date format; only additions are Not Required rows for unlisted types (note "Not on imported checklist") and a trailing `last_activity` column |
| A10 | The team can save their spreadsheet as CSV | Standard in Excel and Google Sheets |
| A11 | The weekly summary leadership wants is a snapshot of current pipeline health | Brief: "a weekly pipeline summary … compiled manually into an email every Monday" |
| A12 | Tax returns expire after 1,095 days and insurance after 365 days, not on the calendar anniversary | Matches every row in the sample data; differs from "3 calendar years" by one day when the span includes Feb 29 (e.g. 1/29/2026 → 1/28/2029). Confirm with the ops team whether policy means calendar years. |

### Tradeoffs

| # | Chose | Over | Gave up |
|---|---|---|---|
| T1 | Browser-only storage | A backend with a shared database | **Sharing between users and protection against a cleared browser.** Export/Import is the manual workaround. The biggest v1 limitation. |
| T2 | Adjustable "as of" date | Always using the real date | One extra control on screen |
| T3 | Listed documents are the checklist; unlisted are hidden as not needed (a Needed checkbox on each document) | A "Needs decision" status on every unlisted type, or counting them as Pending | An imported application with a genuinely forgotten document is not flagged — the same risk as the spreadsheet. v2: required checklists per loan program and entity type. |
| T4 | Status and expiry kept separate | Dates changing status automatically | Two signals on one document |
| T5 | Last document activity as the stalled signal | Application age | It's a proxy until in-app edits build real activity history |
| T6 | No email alerts | Building a bank-statement expiry alert | Proactive warnings; badges only help when someone opens the app |
| T7 | No leadership dashboard | Building charts | Leadership visibility |
| T8 | React + TypeScript + Vite | A single HTML file | ~10 minutes of setup; reviewers run `npm install` |
| T9 | Instant saving, no undo | One-step undo (~20–30 min) | One-click recovery. Every field can be corrected by hand **except last activity**: a mis-click marks the application active and hides it from the stalled list for up to 21 days. |
| T10 | Delete only, no archive | Archiving funded/closed applications | Closed applications stay in the list until deleted |
| T11 | Import replaces all data | Merging imports | Last import wins; one user's import can overwrite another's work |
| T12 | Automated tests on rules, data, and state only | Screen and end-to-end tests | UI regressions are caught only by the manual smoke test |
| T13 | Weekly summary as a snapshot with Copy | Week-over-week trends, or sending the email | No "stalled went from 14 to 11"; the team lead still pastes it into their email |
| T14 | Processor chosen from a dropdown | Free text | One extra click ("Other…") to add a new processor |

## 12. Not in This Design

Considered during brainstorming and left out:

- Email alerts (bank-statement expiry was the preferred first alert)
- Leadership dashboard / charts
- Week-over-week trends in the weekly summary, and sending it by email
- Shared storage / backend
- Undo and edit history
- Archiving applications
- Application-level notes and a ⭐ pin for applications needing special attention
- Bulk editing
- Custom document types
- `.xlsx` import
- Screen and end-to-end tests
