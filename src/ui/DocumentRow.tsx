import { useState } from 'react'
import { daysBetween, isIsoDate, todayIso } from '../domain/dates'
import { expiryBadge, splitNotNeededReason } from '../domain/rules'
import { NOT_ON_IMPORT_NOTE, NOT_REQUIRED_REASONS } from '../domain/settings'
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

/** Not Required is set with the Needed checkbox, so it isn't offered in the status dropdown. */
const TEAM_STATUSES = STATUSES.filter(s => s !== 'Not Required')

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
  // Recorded dates use the real date of the change; `asOf` only affects how badges are shown.
  const target = { appId: doc.applicationId, docType: doc.type, today: todayIso() }
  const badge = expiryBadge(doc, asOf)
  const expiresBeforeReceived = !!doc.dateReceived && !!doc.expirationDate && daysBetween(doc.dateReceived, doc.expirationDate) < 0

  return (
    <tr>
      <td className="needed-cell">
        <input
          type="checkbox"
          checked
          aria-label={`${doc.type} is needed for this loan (untick to hide)`}
          title="Untick if this loan doesn't need it"
          onChange={() => dispatch({ type: 'setNeeded', ...target, needed: false })}
        />
      </td>
      <th scope="row" className="doc-name">{doc.type}</th>
      <td>
        <CommitSelect
          className={`select status-select status-${doc.status.replace(/\s+/g, '-').toLowerCase()}`}
          aria-label={`${doc.type} status`}
          title={doc.status === 'Expired' ? 'Replacement requested' : undefined}
          value={doc.status}
          onCommit={status => dispatch({ type: 'setStatus', ...target, status: status as ChecklistDocument['status'] })}
        >
          {TEAM_STATUSES.map(s => <option key={s} value={s}>{s === 'Expired' ? 'Expired (replacement requested)' : s}</option>)}
        </CommitSelect>
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

/** A document unticked from the checklist: tick to bring it back, optionally say why it isn't needed. */
export function NotNeededRow({ doc, dispatch }: { doc: ChecklistDocument; dispatch(a: Action): void }) {
  const target = { appId: doc.applicationId, docType: doc.type, today: todayIso() }
  const { reason, rest } = splitNotNeededReason(doc.notes)
  const reasons: string[] = reason === NOT_ON_IMPORT_NOTE ? [...NOT_REQUIRED_REASONS, NOT_ON_IMPORT_NOTE] : [...NOT_REQUIRED_REASONS]
  return (
    <li className="not-needed-row">
      <label className="not-needed-name">
        <input
          type="checkbox"
          checked={false}
          onChange={() => dispatch({ type: 'setNeeded', ...target, needed: true })}
        />
        {doc.type}
      </label>
      <CommitSelect
        className="select"
        aria-label={`Why ${doc.type} isn't needed`}
        value={reason}
        onCommit={r => dispatch({ type: 'setNotNeededReason', ...target, reason: r })}
      >
        <option value="">No reason given</option>
        {reasons.map(r => <option key={r} value={r}>{r}</option>)}
      </CommitSelect>
      {rest && <span className="not-needed-note">{rest}</span>}
    </li>
  )
}
