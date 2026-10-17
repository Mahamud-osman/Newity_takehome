import { useEffect, useRef, useState } from 'react'
import { daysBetween } from '../domain/dates'
import { sortChecklistDocuments } from '../domain/pipeline'
import { summarizeApplication } from '../domain/rules'
import type { Application, ChecklistDocument, IsoDate } from '../domain/types'
import type { Action } from '../state/reducer'
import { daysAgoText } from './ApplicationTable'
import { DocumentRow } from './DocumentRow'
import { Icon } from './Icon'

interface Props {
  app: Application
  documents: ChecklistDocument[]
  asOf: IsoDate
  dispatch(a: Action): void
  onBack(): void
  onEdit(): void
  onDelete(): void
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ChecklistPage({ app, documents, asOf, dispatch, onBack, onEdit, onDelete }: Props) {
  const summary = summarizeApplication(app, documents, asOf)
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const save = (a: Action) => {
    dispatch(a)
    setSaved(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <div className="checklist-head">
        <button className="btn btn-quiet back" onClick={onBack}>← Back to all applications</button>
        <div className="checklist-title">
          <h2>{app.businessName}</h2>
          <span className="app-id">{app.id}</span>
          <div className="checklist-actions">
            <button className="btn" onClick={onEdit}>Edit details</button>
            <button className="btn btn-danger" onClick={onDelete}>Delete application</button>
          </div>
        </div>
        <dl className="facts">
          <div><dt>Borrower</dt><dd>{app.borrowerName}</dd></div>
          <div><dt>Loan amount</dt><dd>{money.format(app.loanAmount)}</dd></div>
          <div><dt>Processor</dt><dd>{app.processor}</dd></div>
          <div><dt>Opened</dt><dd>{daysAgoText(Math.max(0, daysBetween(app.applicationDate, asOf)))}</dd></div>
          <div>
            <dt>Last activity</dt>
            <dd>
              {daysAgoText(summary.idleDays)}
              {summary.stalled && <span className="badge tone-stalled"><Icon name="stalled" size={12} />Stalled</span>}
            </dd>
          </div>
          <div><dt>Done</dt><dd>{summary.done} of 12</dd></div>
        </dl>
      </div>

      <div className="folder-body checklist-sheet">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Status</th>
              <th scope="col">Received</th>
              <th scope="col">Expires</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortChecklistDocuments(documents, asOf).map(d => (
              <DocumentRow key={d.type} doc={d} asOf={asOf} dispatch={save} />
            ))}
          </tbody>
        </table>
      </div>
      {saved && <div className="toast" role="status">Saved ✓</div>}
    </>
  )
}
