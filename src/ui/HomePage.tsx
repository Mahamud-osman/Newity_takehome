import { useMemo, useState } from 'react'
import { buildSummaries, cardCounts, filterSummaries, processorsOf, sortSummaries } from '../domain/pipeline'
import type { Card, SortSpec } from '../domain/pipeline'
import type { ChecklistData, IsoDate } from '../domain/types'
import { ApplicationTable } from './ApplicationTable'
import { FilterCards } from './FilterCards'

interface Props {
  data: ChecklistData
  asOf: IsoDate
  onOpen(appId: string): void
  onNew(): void
  onImport(): void
}

export function HomePage({ data, asOf, onOpen, onNew, onImport }: Props) {
  const [card, setCard] = useState<Card>('all')
  const [search, setSearch] = useState('')
  const [processor, setProcessor] = useState<string | null>(null)
  const [sort, setSort] = useState<SortSpec | null>(null)

  const summaries = useMemo(() => buildSummaries(data, asOf), [data, asOf])
  const counts = cardCounts(summaries, { search, processor })
  const rows = sortSummaries(filterSummaries(summaries, { card, search, processor }), sort)
  const processors = processorsOf(data)

  if (data.applications.length === 0) {
    return (
      <div className="empty-start">
        <h2>No applications yet</h2>
        <p>Import your spreadsheet (saved as CSV) or add an application.</p>
        <div className="message-actions">
          <button className="btn btn-primary" onClick={onImport}>Import CSV</button>
          <button className="btn" onClick={onNew}>+ New application</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="toolbar">
        <input
          className="input search"
          type="search"
          placeholder="Search business, borrower, or application ID"
          aria-label="Search applications"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label className="toolbar-field">
          Processor
          <select
            className="select"
            value={processor ?? ''}
            onChange={e => setProcessor(e.target.value || null)}
          >
            <option value="">All</option>
            {processors.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <button className="btn btn-primary toolbar-new" onClick={onNew}>+ New application</button>
      </div>

      <FilterCards active={card} counts={counts} onSelect={setCard} />
      <div className="folder-body">
        {rows.length > 0 ? (
          <ApplicationTable rows={rows} sort={sort} onSort={setSort} onOpen={onOpen} />
        ) : (
          <div className="empty">
            <p>No applications match these filters.</p>
            <button className="btn" onClick={() => { setCard('all'); setSearch(''); setProcessor(null) }}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </>
  )
}
