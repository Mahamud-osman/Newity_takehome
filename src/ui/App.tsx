import { useState } from 'react'
import { exportCsv, exportFilename } from '../data/csvExport'
import { nextApplicationId } from '../domain/applicationForm'
import { formatLongDate, todayIso } from '../domain/dates'
import { ApplicationFormDialog } from './ApplicationFormDialog'
import { downloadText } from './download'
import { ChecklistPage } from './ChecklistPage'
import { ConfirmDialog } from './ConfirmDialog'
import { Header } from './Header'
import { HomePage } from './HomePage'
import { useChecklistStore } from './useChecklistStore'

export function App() {
  const { state, dispatch, asOf, storage, loadSample } = useChecklistStore()
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [form, setForm] = useState<'new' | 'edit' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
          <ChecklistPage
            app={selected}
            documents={state.data.documents.filter(d => d.applicationId === selected.id)}
            asOf={asOf}
            dispatch={dispatch}
            onBack={() => setSelectedAppId(null)}
            onEdit={() => setForm('edit')}
            onDelete={() => setConfirmDelete(true)}
          />
        ) : (
          <HomePage data={state.data} asOf={asOf} onOpen={setSelectedAppId} onNew={() => setForm('new')} />
        )}
      </main>

      {form && (
        <ApplicationFormDialog
          mode={form}
          initial={form === 'edit' ? selected ?? undefined : undefined}
          data={state.data}
          onCancel={() => setForm(null)}
          onSave={values => {
            if (form === 'new') {
              const id = nextApplicationId(state.data, todayIso())
              dispatch({ type: 'addApplication', id, values, asOf })
              setSelectedAppId(id)
            } else if (selected) {
              dispatch({ type: 'editApplication', appId: selected.id, values, asOf })
            }
            setForm(null)
          }}
        />
      )}
      {confirmDelete && selected && (
        <ConfirmDialog
          title="Delete application"
          message={`Delete ${selected.businessName} (${selected.id}) and its 12 documents? This can't be undone.`}
          confirmLabel="Delete application"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: 'deleteApplication', appId: selected.id })
            setConfirmDelete(false)
            setSelectedAppId(null)
          }}
        />
      )}
    </>
  )
}
