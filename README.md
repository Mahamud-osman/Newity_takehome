# SBA Document Checklist

A browser tool that replaces the loan operations team's SBA document spreadsheet.

- **Stalled applications first.** The home page ranks applications so the ones waiting on documents with nothing received in 21+ days are at the top. Tabs filter to Stalled, Expired documents, and Expiring soon; a processor filter shows each person's queue.
- **A checklist per application.** Status, received date, expiration date, and notes for each document, saved instantly. Untick **Needed** to hide documents a loan doesn't require.
- **Expiration tracking from the dates.** Bank statements expire 90 days after receipt, tax returns after 1,095 days, insurance after 365 days. Expired and expiring-soon warnings are calculated from those dates, independent of the status someone typed.
- **Weekly pipeline summary.** One click produces plain text for the Monday leadership email.

It runs entirely in the browser — no server, no database. It starts empty: import the spreadsheet (saved as CSV) or add applications.

## Quick start

Requires Node.js **20.19+ or 22.12+**.

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

## Try it with the sample data

1. Click **Import CSV** and choose `NEWITY_Sample_Data_A_Document_Checklist.csv` (a copy is in `src/test/fixtures/sample.csv`), then **Replace**.
2. The sample runs from July 2025 to February 2026, so against today almost everything has expired. Set **As of** in the header to **Feb 15, 2026** to see it as the team would have. A banner shows you're not viewing today; **Back to today** switches back.

"As of" only changes what you see. Dates the app records (received dates, last activity) always use today's date.

## Tests

```bash
npm test
```

Unit tests cover the business rules, CSV import and export, saving, and the weekly summary, including "golden" checks against the sample data — for example, exactly 11 stalled applications and 4 bank statements past their expiration date without being marked Expired.

### Manual smoke test

- [ ] A fresh open (or **Clear all data**) shows the empty state; importing the sample loads 60 applications.
- [ ] With As of = Feb 15, 2026 the tabs read: All 60 · Stalled 11 · Expired documents 6 · Expiring soon 1.
- [ ] Change a document's status, refresh, and the change is still there.
- [ ] Mark an expired bank statement **Received**: the received date becomes today and the expiration today + 90 days.
- [ ] Untick a document's **Needed** box; it moves to "Not needed for this loan". Tick it again to bring it back.
- [ ] Add an application, edit its details, then delete it.
- [ ] **Export CSV** → **Clear all data** → **Import CSV** the exported file → your data is back.
- [ ] Importing a file with the wrong columns shows an error and changes nothing.

## Project structure

```
src/domain/   business rules: stalled, expiry, progress, weekly summary (pure, unit-tested)
src/data/     CSV import/export and browser storage
src/state/    reducer — every change the app makes
src/ui/       React screens
```

Thresholds (21 days stalled, 14 days expiring soon, expiry rules) live in `src/domain/settings.ts`.

## Known limitations

- **Each browser keeps its own copy of the data.** Changes aren't shared between people or computers, and clearing browser data deletes them. Use **Export CSV** as a backup and to pass data along.
- **Import replaces everything.** It doesn't merge; the last import wins.
- **No undo.** Every field can be corrected by hand.
- **CSV only.** Save Excel or Google Sheets files as CSV first.
- The 21-day and 14-day thresholds are assumptions to confirm with the team.

## Design

- [Design spec](docs/superpowers/specs/2026-10-17-sba-doc-checklist-design.md) — decisions, assumptions, and tradeoffs
- [Implementation plan](docs/superpowers/plans/2026-10-17-sba-doc-checklist.md) — how it was built
