import { daysBetween, formatLongDate, isIsoDate, todayIso } from '../domain/dates'
import type { IsoDate } from '../domain/types'

interface Props {
  asOf: IsoDate
  asOfOverride: IsoDate | null
  lastExportedAt: IsoDate | null
  onSetAsOf(date: IsoDate | null): void
  onExport(): void
  onImport(): void
  onClear(): void
  onWeeklySummary(): void
}

function lastExportedText(at: IsoDate | null): string {
  if (!at) return 'Never exported. Export regularly: it is your only backup.'
  const days = daysBetween(at, todayIso())
  if (days <= 0) return 'Last exported today'
  return `Last exported ${days} day${days === 1 ? '' : 's'} ago`
}

export function Header({ asOf, lastExportedAt, onSetAsOf, onExport, onImport, onClear, onWeeklySummary }: Props) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <h1 className="app-title">SBA Document Checklist</h1>
        <label className="as-of">
          <span>As of {formatLongDate(asOf)}</span>
          <input
            className="input"
            type="date"
            value={asOf}
            aria-label="Change the as-of date"
            onChange={e => {
              const v = e.target.value
              if (isIsoDate(v)) onSetAsOf(v === todayIso() ? null : v)
            }}
          />
        </label>
        <div className="header-actions">
          <button className="btn" onClick={onWeeklySummary}>Weekly summary</button>
          <button className="btn" onClick={onImport}>Import CSV</button>
          <button className="btn" onClick={onExport}>Export CSV</button>
          <button className="btn btn-quiet" onClick={onClear}>Clear all data</button>
        </div>
        <p className="last-exported">{lastExportedText(lastExportedAt)}</p>
      </div>
    </header>
  )
}
