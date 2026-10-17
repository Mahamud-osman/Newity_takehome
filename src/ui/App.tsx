import { useState } from 'react'
import { exportCsv, exportFilename } from '../data/csvExport'
import { formatLongDate, todayIso } from '../domain/dates'
import { downloadText } from './download'
import { Header } from './Header'
import { HomePage } from './HomePage'
import { useChecklistStore } from './useChecklistStore'

export function App() {
  const { state, dispatch, asOf, storage, loadSample } = useChecklistStore()
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)

  if (!state) {
    return (
      <main className="message-screen">
        <h1>Your saved data couldn't be read.</h1>
        <p>It has been kept as a backup. Load the sample data or import a CSV to keep working.</p>
        <div className="message-actions">
          <button className="btn btn-primary" onClick={loadSample}>Load sample data</button>
        </div>
      </main>
    )
  }

  const exportData = () => {
    downloadText(exportFilename(todayIso()), exportCsv(state.data))
    dispatch({ type: 'markExported', at: todayIso() })
  }

  const selected = state.data.applications.find(a => a.id === selectedAppId) ?? null

  return (
    <>
      <Header
        asOf={asOf}
        asOfOverride={state.asOfOverride}
        lastExportedAt={state.lastExportedAt}
        onSetAsOf={date => dispatch({ type: 'setAsOf', date })}
        onExport={exportData}
        onImport={() => {}}
        onReset={() => {}}
        onWeeklySummary={() => {}}
      />
      {state.asOfOverride && (
        <div className="banner banner-info" role="status">
          <span>Viewing as of {formatLongDate(state.asOfOverride)}, not today.</span>
          <button className="btn" onClick={() => dispatch({ type: 'setAsOf', date: null })}>Back to today</button>
        </div>
      )}
      {storage === 'unavailable' && (
        <div className="banner banner-error" role="alert">
          Changes can't be saved in this browser. Use Export to keep your work.
        </div>
      )}
      <main className="page">
        {selected ? (
          <button className="btn" onClick={() => setSelectedAppId(null)}>Back</button>
        ) : (
          <HomePage data={state.data} asOf={asOf} onOpen={setSelectedAppId} onNew={() => {}} />
        )}
      </main>
    </>
  )
}
