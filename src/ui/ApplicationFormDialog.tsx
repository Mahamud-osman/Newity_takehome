import { useState } from 'react'
import type { ReactNode } from 'react'
import { findDuplicate, validateApplicationForm } from '../domain/applicationForm'
import type { ApplicationFormInput, ApplicationValues } from '../domain/applicationForm'
import { todayIso } from '../domain/dates'
import { processorsOf } from '../domain/pipeline'
import type { Application, ChecklistData } from '../domain/types'
import { Modal } from './ConfirmDialog'

interface Props {
  mode: 'new' | 'edit'
  initial?: Application
  data: ChecklistData
  onSave(values: ApplicationValues): void
  onCancel(): void
}

const OTHER = '__other__'
type Field = keyof ApplicationFormInput

export function ApplicationFormDialog({ mode, initial, data, onSave, onCancel }: Props) {
  const processors = processorsOf(data)
  const [businessName, setBusinessName] = useState(initial?.businessName ?? '')
  const [borrowerName, setBorrowerName] = useState(initial?.borrowerName ?? '')
  const [loanAmount, setLoanAmount] = useState(initial ? String(initial.loanAmount) : '')
  const [applicationDate, setApplicationDate] = useState(initial?.applicationDate ?? todayIso())
  const [processorChoice, setProcessorChoice] = useState(initial?.processor ?? '')
  const [otherProcessor, setOtherProcessor] = useState('')
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [duplicateOf, setDuplicateOf] = useState<Application | null>(null)

  const processor = processorChoice === OTHER ? otherProcessor : processorChoice
  const result = validateApplicationForm({ businessName, borrowerName, loanAmount, applicationDate, processor })
  const errorFor = (f: Field) => (!result.ok && touched[f] ? result.errors[f] : undefined)
  const touch = (f: Field) => () => setTouched(t => ({ ...t, [f]: true }))

  const submit = () => {
    if (!result.ok) return
    const dup = findDuplicate(data, result.values.businessName, initial?.id)
    if (dup && !duplicateOf) return setDuplicateOf(dup)
    onSave(result.values)
  }

  const field = (f: Field, label: string, input: ReactNode) => (
    <label className="form-field">
      <span>{label}</span>
      {input}
      {errorFor(f) && <span className="field-error">{errorFor(f)}</span>}
    </label>
  )
  const cls = (f: Field) => `input${errorFor(f) ? ' input-invalid' : ''}`

  if (duplicateOf) {
    return (
      <Modal title="This business is already in the list" onClose={() => setDuplicateOf(null)}>
        <p>{duplicateOf.businessName} already has {duplicateOf.id}. Create anyway?</p>
        <div className="modal-actions">
          <button className="btn" onClick={() => setDuplicateOf(null)} autoFocus>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>{mode === 'new' ? 'Create anyway' : 'Save anyway'}</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={mode === 'new' ? 'New application' : 'Edit application details'} onClose={onCancel}>
      <form className="form" onSubmit={e => { e.preventDefault(); submit() }}>
        {field('businessName', 'Business name',
          <input className={cls('businessName')} value={businessName} autoFocus
            onChange={e => setBusinessName(e.target.value)} onBlur={touch('businessName')} />)}
        {field('borrowerName', 'Borrower name',
          <input className={cls('borrowerName')} value={borrowerName}
            onChange={e => setBorrowerName(e.target.value)} onBlur={touch('borrowerName')} />)}
        {field('loanAmount', 'Loan amount',
          <input className={cls('loanAmount')} inputMode="decimal" placeholder="$250,000" value={loanAmount}
            onChange={e => setLoanAmount(e.target.value)} onBlur={touch('loanAmount')} />)}
        {field('applicationDate', 'Application date',
          <input className={cls('applicationDate')} type="date" value={applicationDate}
            onChange={e => setApplicationDate(e.target.value)} onBlur={touch('applicationDate')} />)}
        {field('processor', 'Processor',
          <select className={`select${errorFor('processor') ? ' input-invalid' : ''}`} value={processorChoice}
            onChange={e => setProcessorChoice(e.target.value)} onBlur={touch('processor')}>
            <option value="">Choose a processor</option>
            {processors.map(p => <option key={p} value={p}>{p}</option>)}
            <option value={OTHER}>Other…</option>
          </select>)}
        {processorChoice === OTHER && (
          <label className="form-field">
            <span>New processor name</span>
            <input className="input" value={otherProcessor} autoFocus
              onChange={e => setOtherProcessor(e.target.value)} onBlur={touch('processor')} />
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!result.ok}>
            {mode === 'new' ? 'Create application' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
