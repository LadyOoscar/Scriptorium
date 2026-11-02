import { contextBridge, ipcRenderer } from 'electron'

type DocumentRecord = {
  id: string
  title: string
  content: string
  updatedAt: string
}

contextBridge.exposeInMainWorld('scriptorium', {
  listDocuments: (): Promise<DocumentRecord[]> => ipcRenderer.invoke('library:list'),
  getDocument: (id: string): Promise<DocumentRecord | null> => ipcRenderer.invoke('library:get', id),
  saveDocument: (document: DocumentRecord): Promise<DocumentRecord> => ipcRenderer.invoke('library:save', document),
  deleteDocument: (id: string): Promise<boolean> => ipcRenderer.invoke('library:delete', id),
  exportBackup: (): Promise<boolean> => ipcRenderer.invoke('backup:export'),
  importBackup: (): Promise<boolean> => ipcRenderer.invoke('backup:import')
})