import { useEffect, useRef, useState } from 'react'
import { daysBetween } from '../domain/dates'
import { sortChecklistDocuments } from '../domain/pipeline'
import { summarizeApplication } from '../domain/rules'
import type { Application, ChecklistDocument, IsoDate } from '../domain/types'
import type { Action } from '../state/reducer'
import { daysAgoText } from './ApplicationTable'
import { DocumentRow, NotNeededRow } from './DocumentRow'
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
  const sorted = sortChecklistDocuments(documents, asOf)
  const needed = sorted.filter(d => d.status !== 'Not Required')
  const notNeeded = sorted.filter(d => d.status === 'Not Required')
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
          <div><dt>Approved</dt><dd>{summary.done} of {summary.needed} needed</dd></div>
        </dl>
      </div>

      <div className="folder-body checklist-sheet">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col" className="needed-cell">Needed</th>
              <th scope="col">Document</th>
              <th scope="col">Status</th>
              <th scope="col">Received</th>
              <th scope="col">Expires</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {needed.map(d => <DocumentRow key={d.type} doc={d} asOf={asOf} dispatch={save} />)}
          </tbody>
        </table>
        {notNeeded.length > 0 && (
          <details className="not-needed">
            <summary>Not needed for this loan ({notNeeded.length})</summary>
            <ul>
              {notNeeded.map(d => <NotNeededRow key={d.type} doc={d} dispatch={save} />)}
            </ul>
          </details>
        )}
      </div>
      {saved && <div className="toast" role="status">Saved ✓</div>}
    </>
  )
}
