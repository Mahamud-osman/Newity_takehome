import { useRef, useState } from 'react'
import { Modal } from './ConfirmDialog'

export function WeeklySummaryDialog({ text, onClose }: { text: string; onClose(): void }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const area = useRef<HTMLTextAreaElement>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      area.current?.select()
      setCopyState('manual')
    }
  }

  return (
    <Modal title="Weekly pipeline summary" onClose={onClose} wide>
      <p>Copy this into your Monday email to leadership. It covers every application, whatever filters are set.</p>
      <textarea ref={area} className="summary-text" readOnly value={text} rows={Math.min(28, text.split('\n').length + 1)} />
      <div className="modal-actions">
        {copyState === 'copied' && <span className="copy-note" role="status">Copied ✓</span>}
        {copyState === 'manual' && <span className="copy-note" role="status">Press Ctrl+C (⌘C on Mac) to copy</span>}
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={copy} autoFocus>Copy</button>
      </div>
    </Modal>
  )
}
