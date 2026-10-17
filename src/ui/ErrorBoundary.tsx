import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { exportCsv, exportFilename } from '../data/csvExport'
import { STORAGE_KEY } from '../data/storage'
import { todayIso } from '../domain/dates'
import { downloadText } from './download'

/** Reads storage directly so the team can always get their data out, even when the app has crashed. */
function exportSavedData() {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    downloadText(exportFilename(todayIso()), exportCsv(JSON.parse(raw).data))
  } catch {
    if (raw) downloadText('sba-checklist-backup.json', raw, 'application/json')
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="message-screen">
        <h1>Something went wrong. Your saved data is safe.</h1>
        <p>Reload the page to keep working. If it happens again, export your data first.</p>
        <div className="message-actions">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn" onClick={exportSavedData}>Export my data</button>
        </div>
      </main>
    )
  }
}
