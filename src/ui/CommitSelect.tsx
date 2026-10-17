import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  value: string
  onCommit(value: string): void
  className?: string
  title?: string
  'aria-label': string
  children: ReactNode
}

/**
 * A <select> that saves immediately on a mouse choice, but while the keyboard is used (arrow keys
 * change a closed select's value in many browsers) holds the choice until Enter or leaving the field.
 * Escape reverts.
 */
export function CommitSelect({ value, onCommit, children, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const usingKeyboard = useRef(false)

  const commitDraft = () => {
    if (draft !== null && draft !== value) onCommit(draft)
    setDraft(null)
    usingKeyboard.current = false
  }

  return (
    <select
      {...rest}
      value={draft ?? value}
      onPointerDown={() => { usingKeyboard.current = false }}
      onKeyDown={e => {
        if (e.key === 'Enter') return commitDraft()
        if (e.key === 'Escape') { setDraft(null); usingKeyboard.current = false; return }
        if (e.key !== 'Tab') usingKeyboard.current = true
      }}
      onChange={e => (usingKeyboard.current ? setDraft(e.target.value) : onCommit(e.target.value))}
      onBlur={commitDraft}
    >
      {children}
    </select>
  )
}
