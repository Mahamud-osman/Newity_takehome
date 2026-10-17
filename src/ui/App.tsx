import { useRef, useState } from 'react'
import { exportCsv, exportFilename } from '../data/csvExport'
import { importCsv } from '../data/csvImport'
import type { ImportResult } from '../data/csvImport'
import { nextApplicationId } from '../domain/applicationForm'
import { formatLongDate, todayIso } from '../domain/dates'
import { buildWeeklySummary } from '../domain/weeklySummary'
import { ApplicationFormDialog } from './ApplicationFormDialog'
import { ChecklistPage } from './ChecklistPage'
import { ConfirmDialog } from './ConfirmDialog'
import { downloadText } from './download'
import { Header } from './Header'
import { HomePage } from './HomePage'
import { ImportDialog, ImportErrorDialog } from './ImportDialog'
import { useChecklistStore } from './useChecklistStore'
import { WeeklySummaryDialog } from './WeeklySummaryDialog'

type Dialog =
  | { kind: 'new' }
  | { kind: 'edit' }
  | { kind: 'delete' }
  | { kind: 'clear' }
  | { kind: 'summary' }
  | { kind: 'import'; result: Extract<ImportResult, { ok: true }> }
  | { kind: 'import-error'; message: string }

export function App() {
  const { state, dispatch, asOf, storage, clearData, replaceData } = useChecklistStore()
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const close = () => setDialog(null)

  const exportData = () => {
    if (!state) return
    downloadText(exportFilename(todayIso()), exportCsv(state.data))
    dispatch({ type: 'markExported', at: todayIso() })
  }

  const onFileChosen = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    const result = importCsv(await file.text())
    setDialog(result.ok ? { kind: 'import', result } : { kind: 'import-error', message: result.error })
  }

  const replaceWith = (result: Extract<ImportResult, { ok: true }>) => {
    replaceData(result.data)
    setSelectedAppId(null)
    close()
  }

  const importUi = (
    <>
      <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={e => onFileChosen(e.target.files?.[0])} />
      {dialog?.kind === 'import' && (
        <ImportDialog
          result={dialog.result}
          canExport={!!state}
          onCancel={close}
          onReplace={() => replaceWith(dialog.result)}
          onExportAndReplace={() => { exportData(); replaceWith(dialog.result) }}
        />
      )}
      {dialog?.kind === 'import-error' && <ImportErrorDialog message={dialog.message} onClose={close} />}
    </>
  )

  if (!state) {
    return (
      <main className="message-screen">
        <h1>Your saved data couldn't be read.</h1>
        <p>It has been kept as a backup. Start empty or import a CSV to keep working.</p>
        <div className="message-actions">
          <button className="btn btn-primary" onClick={clearData}>Start empty</button>
          <button className="btn" onClick={() => fileInput.current?.click()}>Import CSV</button>
        </div>
        {importUi}
      </main>
    )
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
        onImport={() => fileInput.current?.click()}
        onClear={() => setDialog({ kind: 'clear' })}
        onWeeklySummary={() => setDialog({ kind: 'summary' })}
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
            onEdit={() => setDialog({ kind: 'edit' })}
            onDelete={() => setDialog({ kind: 'delete' })}
          />
        ) : (
          <HomePage
            data={state.data}
            asOf={asOf}
            onOpen={setSelectedAppId}
            onNew={() => setDialog({ kind: 'new' })}
            onImport={() => fileInput.current?.click()}
          />
        )}
      </main>

      {importUi}
      {(dialog?.kind === 'new' || (dialog?.kind === 'edit' && selected)) && (
        <ApplicationFormDialog
          mode={dialog.kind}
          initial={dialog.kind === 'edit' ? selected ?? undefined : undefined}
          data={state.data}
          onCancel={close}
          onSave={values => {
            if (dialog.kind === 'new') {
              const id = nextApplicationId(state.data, todayIso())
              dispatch({ type: 'addApplication', id, values, asOf })
              setSelectedAppId(id)
            } else if (selected) {
              dispatch({ type: 'editApplication', appId: selected.id, values, asOf })
            }
            close()
          }}
        />
      )}
      {dialog?.kind === 'delete' && selected && (
        <ConfirmDialog
          title="Delete application"
          message={`Delete ${selected.businessName} (${selected.id}) and its 12 documents? This can't be undone.`}
          confirmLabel="Delete application"
          danger
          onCancel={close}
          onConfirm={() => {
            dispatch({ type: 'deleteApplication', appId: selected.id })
            setSelectedAppId(null)
            close()
          }}
        />
      )}
      {dialog?.kind === 'clear' && (
        <ConfirmDialog
          title="Clear all data"
          message="Delete all applications from this browser? Export first if you want to keep them."
          confirmLabel="Clear all data"
          danger
          onCancel={close}
          onConfirm={() => {
            clearData()
            setSelectedAppId(null)
            close()
          }}
        />
      )}
      {dialog?.kind === 'summary' && (
        <WeeklySummaryDialog text={buildWeeklySummary(state.data, asOf)} onClose={close} />
      )}
    </>
  )
}
