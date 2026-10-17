import type { SortKey, SortSpec } from '../domain/pipeline'
import type { AppSummary } from '../domain/rules'
import { Icon } from './Icon'

interface Props {
  rows: AppSummary[]
  sort: SortSpec | null
  onSort(sort: SortSpec | null): void
  onOpen(appId: string): void
}

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'id', label: 'Application' },
  { key: 'business', label: 'Business / borrower' },
  { key: 'processor', label: 'Processor' },
  { key: 'idle', label: 'Last activity', numeric: true },
  { key: 'progress', label: 'Progress', numeric: true },
  { key: 'outstanding', label: 'Outstanding', numeric: true },
]

/** Click cycles: first direction → reverse → back to the default "needs attention" order. */
function nextSort(current: SortSpec | null, key: SortKey, numeric: boolean): SortSpec | null {
  const first: SortSpec['dir'] = numeric ? 'desc' : 'asc'
  if (current?.key !== key) return { key, dir: first }
  return current.dir === first ? { key, dir: first === 'asc' ? 'desc' : 'asc' } : null
}

export function daysAgoText(days: number): string {
  if (days === 0) return 'Today'
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function ApplicationTable({ rows, sort, onSort, onOpen }: Props) {
  return (
    <table className="app-table">
      <thead>
        <tr>
          {COLUMNS.map(c => (
            <th
              key={c.key}
              scope="col"
              className={c.numeric ? 'num' : undefined}
              aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button type="button" className="sort-button" onClick={() => onSort(nextSort(sort, c.key, !!c.numeric))}>
                {c.label}
                <span className="sort-arrow" aria-hidden="true">
                  {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                </span>
              </button>
            </th>
          ))}
          <th scope="col">Flags</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(s => (
          <tr
            key={s.app.id}
            tabIndex={0}
            className={s.stalled ? 'is-stalled' : undefined}
            onClick={() => onOpen(s.app.id)}
            onKeyDown={e => e.key === 'Enter' && onOpen(s.app.id)}
            aria-label={`Open ${s.app.businessName}, ${s.app.id}`}
          >
            <td className="app-id">{s.app.id}</td>
            <td>
              <div className="business">{s.app.businessName}</div>
              <div className="borrower">{s.app.borrowerName}</div>
            </td>
            <td>{s.app.processor}</td>
            <td className="num">
              <div className="activity">
                {daysAgoText(s.idleDays)}
                {s.stalled && (
                  <span className="badge tone-stalled"><Icon name="stalled" size={12} />Stalled</span>
                )}
              </div>
            </td>
            <td className="num">
              <div className="progress">
                <span className="progress-track" aria-hidden="true">
                  <span className="progress-fill" style={{ width: `${s.needed ? (s.done / s.needed) * 100 : 0}%` }} />
                </span>
                <span>{s.done}/{s.needed}</span>
              </div>
            </td>
            <td className="num">{s.outstanding}</td>
            <td>
              <div className="flags">
                {s.expired > 0 && (
                  <span className="badge tone-expired"><Icon name="expired" size={12} />{s.expired} expired</span>
                )}
                {s.expiringSoon > 0 && (
                  <span className="badge tone-soon"><Icon name="soon" size={12} />{s.expiringSoon} expiring</span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
