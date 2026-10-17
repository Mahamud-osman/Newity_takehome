import { useState } from 'react'
import { daysBetween, isIsoDate } from '../domain/dates'
import { expiryBadge } from '../domain/rules'
import { NOT_REQUIRED_REASONS } from '../domain/settings'
import { STATUSES } from '../domain/types'
import type { ChecklistDocument, IsoDate } from '../domain/types'
import type { Action } from '../state/reducer'
import { CommitSelect } from './CommitSelect'
import { Icon } from './Icon'

interface Props {
  doc: ChecklistDocument
  asOf: IsoDate
  dispatch(a: Action): void
}

const TEAM_STATUSES = STATUSES.filter(s => s !== 'Needs Decision')

/** Saves on blur or Enter only: while a year is typed the field briefly reports dates like 0002-02-10. */
function DateCell({ label, value, onCommit }: { label: string; value: IsoDate | null; onCommit(v: IsoDate | null): void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const commit = (input: HTMLInputElement) => {
    if (draft === null) return
    if (input.validity.badInput || (draft !== '' && !isIsoDate(draft))) return setInvalid(true)
    setInvalid(false)
    setDraft(null)
    const next = draft || null
    if (next !== value) onCommit(next)
  }
  return (
    <div className="date-cell">
      <input
        className={`input input-date${invalid ? ' input-invalid' : ''}`}
        type="date"
        aria-label={label}
        value={draft ?? value ?? ''}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.currentTarget)}
        onKeyDown={e => e.key === 'Enter' && commit(e.currentTarget)}
      />
      {invalid && <span className="field-error">Enter a valid date</span>}
    </div>
  )
}

function NotesCell({ value, onCommit }: { value: string; onCommit(v: string): void }) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  const commit = () => {
    setEditing(false)
    if (draft.trim() !== value) onCommit(draft.trim())
  }
  return (
    <input
      className="input notes-input"
      aria-label="Notes"
      placeholder="Add a note"
      value={editing ? draft : value}
      onFocus={() => { setDraft(value); setEditing(true) }}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

export function DocumentRow({ doc, asOf, dispatch }: Props) {
  const target = { appId: doc.applicationId, docType: doc.type, asOf }
  const badge = expiryBadge(doc, asOf)
  const expiresBeforeReceived = !!doc.dateReceived && !!doc.expirationDate && daysBetween(doc.dateReceived, doc.expirationDate) < 0

  return (
    <tr className={doc.status === 'Needs Decision' ? 'is-undecided' : undefined}>
      <th scope="row" className="doc-name">{doc.type}</th>
      <td>
        {doc.status === 'Needs Decision' ? (
          <div className="decision">
            <span className="badge tone-decision"><Icon name="decision" size={12} />Needs decision</span>
            <button className="btn" onClick={() => dispatch({ type: 'setStatus', ...target, status: 'Pending' })}>Request</button>
            <CommitSelect
              className="select"
              aria-label={`Mark ${doc.type} not required`}
              value=""
              onCommit={reason => reason && dispatch({ type: 'markNotRequired', ...target, reason })}
            >
              <option value="">Not required…</option>
              {NOT_REQUIRED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </CommitSelect>
          </div>
        ) : (
          <CommitSelect
            className={`select status-select status-${doc.status.replace(/\s+/g, '-').toLowerCase()}`}
            aria-label={`${doc.type} status`}
            title={doc.status === 'Expired' ? 'Replacement requested' : undefined}
            value={doc.status}
            onCommit={status => dispatch({ type: 'setStatus', ...target, status: status as ChecklistDocument['status'] })}
          >
            {TEAM_STATUSES.map(s => <option key={s} value={s}>{s === 'Expired' ? 'Expired (replacement requested)' : s}</option>)}
          </CommitSelect>
        )}
      </td>
      <td>
        <DateCell label={`${doc.type} received date`} value={doc.dateReceived}
          onCommit={v => dispatch({ type: 'updateDocument', ...target, patch: { dateReceived: v } })} />
      </td>
      <td>
        <DateCell label={`${doc.type} expiration date`} value={doc.expirationDate}
          onCommit={v => dispatch({ type: 'updateDocument', ...target, patch: { expirationDate: v } })} />
        {badge?.kind === 'expired' && (
          <span className="badge tone-expired"><Icon name="expired" size={12} />
            Expired {badge.daysAgo} day{badge.daysAgo === 1 ? '' : 's'} ago
          </span>
        )}
        {badge?.kind === 'soon' && (
          <span className="badge tone-soon"><Icon name="soon" size={12} />
            {badge.daysLeft === 0 ? 'Expires today' : `Expires in ${badge.daysLeft} day${badge.daysLeft === 1 ? '' : 's'}`}
          </span>
        )}
        {expiresBeforeReceived && <span className="field-warning">Expires before it was received</span>}
      </td>
      <td>
        <NotesCell value={doc.notes} onCommit={notes => dispatch({ type: 'updateDocument', ...target, patch: { notes } })} />
      </td>
    </tr>
  )
}
