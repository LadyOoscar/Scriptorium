import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('scriptorium', {
  loadWorkspace: () => ipcRenderer.invoke('workspace:load'),
  saveWorkspace: (workspace: unknown) => ipcRenderer.invoke('workspace:save', workspace),
  exportBackup: (): Promise<boolean> => ipcRenderer.invoke('backup:export'),
  importBackup: (): Promise<boolean> => ipcRenderer.invoke('backup:import')
})
