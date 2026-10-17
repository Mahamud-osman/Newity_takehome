import type { ImportResult } from '../data/csvImport'
import { Modal } from './ConfirmDialog'

type Ok = Extract<ImportResult, { ok: true }>

interface Props {
  result: Ok
  canExport: boolean
  onExportAndReplace(): void
  onReplace(): void
  onCancel(): void
}

export function ImportDialog({ result, canExport, onExportAndReplace, onReplace, onCancel }: Props) {
  const { data, issues } = result
  return (
    <Modal title="Replace your data with this file?" onClose={onCancel} wide>
      <p>
        Found {data.applications.length} applications and {data.documents.length} documents.
        This will <strong>replace</strong> your current data.
      </p>
      {issues.length > 0 && (
        <>
          <p className="field-warning">{issues.length} row{issues.length === 1 ? '' : 's'} need attention:</p>
          <ul className="issue-list">
            {issues.map(i => <li key={`${i.row}-${i.message}`}>{i.message}</li>)}
          </ul>
        </>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onCancel} autoFocus>Cancel</button>
        {canExport && <button className="btn" onClick={onExportAndReplace}>Export &amp; replace</button>}
        <button className="btn btn-primary" onClick={onReplace}>{issues.length > 0 ? 'Replace anyway' : 'Replace'}</button>
      </div>
    </Modal>
  )
}

export function ImportErrorDialog({ message, onClose }: { message: string; onClose(): void }) {
  return (
    <Modal title="That file couldn't be imported" onClose={onClose}>
      <p>{message}</p>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose} autoFocus>OK</button>
      </div>
    </Modal>
  )
}
