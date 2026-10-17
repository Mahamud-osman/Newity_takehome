# SBA Document Checklist

A browser tool that replaces the loan operations team's SBA document spreadsheet. It shows which applications are **stalled** waiting on documents, gives each application a 12-document **checklist** that can be updated with one click, and flags documents that have **expired or are about to expire**, using their expiration dates rather than a status someone typed. Bank statements expire after 90 days, tax returns after 1,095 days and insurance after 365 days.

It runs entirely in the browser. There is no server and no database. It starts empty: import your spreadsheet (saved as CSV) or add applications.

## Requirements

- Node.js **20.19+ or 22.12+** (required by Vite)

## Run it

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

## Run the tests

```bash
npm test
```

The tests cover the business rules, CSV import and export, saving, and the weekly summary. They include "golden" checks against the sample data, for example that exactly 11 applications are stalled and 4 bank statements are past their expiration date without being marked Expired.

## Demo tip

Click **Import CSV** and choose `NEWITY_Sample_Data_A_Document_Checklist.csv` (a copy is in `src/test/fixtures/sample.csv`). The sample data runs from July 2025 to February 2026, so measured against today almost everything has expired. Set **As of** in the header to **Feb 15, 2026** to see the data as the team would have seen it. A banner reminds you that you aren't viewing today's date, and **Back to today** switches back.

For a larger, current dataset, import `demo-data/sba_checklist_demo_75.csv`: 75 applications with expiration dates from June 2026 to June 2029. Viewed as of Oct 17, 2026, about 23 are stalled and two dozen have an expired document. Leave **As of** on today for this file.

## Manual smoke test

- [ ] A fresh open (or **Clear all data**) shows the empty state. **Import CSV** with the sample file loads 60 applications.
- [ ] With As of = Feb 15, 2026 the tabs read: All 60 · Stalled 11 · Expired documents 6 · Expiring soon 1 · Needs decision 43.
- [ ] Change a document's status, refresh the page, and the change is still there.
- [ ] Add an application, edit its details, then delete it.
- [ ] **Export CSV** → **Clear all data** → **Import CSV** the exported file → your changes are back.
- [ ] Change **As of** and the badges change. **Back to today** returns to today's date.
- [ ] Importing a file with the wrong columns shows an error and changes nothing. Opening the app in a private window still works, with a warning that changes can't be saved.

## Known limitations

- **Each browser keeps its own copy of the data.** Changes aren't shared between people or computers. Use Export / Import to pass data along, and export regularly, because clearing browser data deletes it.
- **Import replaces everything.** It doesn't merge, so the last import wins.
- **There's no undo.** Every field can be corrected by hand, except "last activity": a mistaken change marks the application as active today.
- **Only CSV files can be imported.** Save Excel or Google Sheets files as CSV first.
- The "stalled" (21 days) and "expiring soon" (14 days) thresholds are assumptions to confirm with the team. Both are set in `src/domain/settings.ts`.

## Design

See the [design spec](docs/superpowers/specs/2026-10-17-sba-doc-checklist-design.md) for the decisions, assumptions and tradeoffs, and the [implementation plan](docs/superpowers/plans/2026-10-17-sba-doc-checklist.md) for how it was built.
