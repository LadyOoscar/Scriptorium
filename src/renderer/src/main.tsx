import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Browser fallback used by the Android-installable PWA.
// Electron continues to use its secure preload bridge on Windows.
if (!window.scriptorium) {
  const STORAGE_KEY = 'scriptorium-workspace-v2'
  const load = async (): Promise<ScriptoriumWorkspace> => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ScriptoriumWorkspace
    const now = new Date().toISOString()
    const initial: ScriptoriumWorkspace = {
      version: 2,
      projects: [{ id: 'project-default', title: 'Mon premier projet', summary: 'Votre espace de création littéraire.', createdAt: now, updatedAt: now }],
      documents: [], entities: [], notes: [],
      modules: { manuscripts: true, encyclopedia: true, notes: true, progress: true }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
  const save = async (workspace: ScriptoriumWorkspace) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...workspace, version: 2 }))
    return true
  }
  const downloadBackup = async () => {
    const blob = new Blob([JSON.stringify(await load(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'scriptorium-sauvegarde.json'
    anchor.click()
    URL.revokeObjectURL(url)
    return true
  }
  const importBackup = async () => new Promise<boolean>((resolve) => {
    const picker = document.createElement('input')
    picker.type = 'file'
    picker.accept = 'application/json,.json'
    picker.onchange = async () => {
      try {
        const file = picker.files?.[0]
        if (!file) return resolve(false)
        const imported = JSON.parse(await file.text())
        if (!imported || !Array.isArray(imported.documents)) throw new Error('Fichier de sauvegarde invalide.')
        const now = new Date().toISOString()
        const workspace: ScriptoriumWorkspace = {
          version: 2,
          projects: Array.isArray(imported.projects) ? imported.projects : [{ id: 'project-default', title: 'Mon premier projet', summary: '', createdAt: now, updatedAt: now }],
          documents: imported.documents.map((doc: ScriptoriumDocument) => ({ ...doc, projectId: doc.projectId || (imported.projects?.[0]?.id ?? 'project-default') })),
          entities: Array.isArray(imported.entities) ? imported.entities : [],
          notes: Array.isArray(imported.notes) ? imported.notes : [],
          modules: { manuscripts: true, encyclopedia: true, notes: true, progress: true, ...(imported.modules || {}) }
        }
        await save(workspace)
        resolve(true)
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Impossible de lire cette sauvegarde.')
        resolve(false)
      }
    }
    picker.oncancel = () => resolve(false)
    picker.click()
  })
  window.scriptorium = { loadWorkspace: load, saveWorkspace: save, exportBackup: downloadBackup, importBackup }
}

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
