import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

type Project = { id: string; title: string; summary: string; createdAt: string; updatedAt: string }
type DocumentRecord = { id: string; projectId?: string; title: string; content: string; fontFamily?: string; fontSize?: number; lineSpacing?: string; pageMargin?: string; pageFormat?: string; orientation?: string; pageNumbers?: boolean; updatedAt: string }
type StoryEntity = { id: string; projectId: string; type: string; name: string; description: string; [key: string]: unknown; updatedAt: string }
type CharacterRelation = { id: string; projectId: string; fromEntityId: string; toEntityId: string; fromLabel: string; toLabel: string; description: string }
type IdeaNote = { id: string; projectId: string; title: string; content: string; updatedAt: string }
type Workspace = { version: number; projects: Project[]; documents: DocumentRecord[]; entities: StoryEntity[]; notes: IdeaNote[]; relations?: CharacterRelation[]; modules: Record<string, boolean> }

const defaultModules = { manuscripts: true, encyclopedia: true, notes: true, progress: true }
const workspacePath = () => join(app.getPath('userData'), 'scriptorium-library.json')

async function readWorkspace(): Promise<Workspace> {
  try {
    const raw = JSON.parse(await readFile(workspacePath(), 'utf8'))
    const now = new Date().toISOString()
    const projects: Project[] = Array.isArray(raw.projects) ? raw.projects : [{
      id: 'project-default',
      title: 'Mon premier projet',
      summary: 'Votre espace de création littéraire.',
      createdAt: now,
      updatedAt: now
    }]
    const projectId = projects[0]?.id ?? 'project-default'
    const documents: DocumentRecord[] = Array.isArray(raw.documents) ? raw.documents.map((doc: DocumentRecord) => ({ ...doc, projectId: doc.projectId || projectId })) : []
    return {
      version: 2,
      projects,
      documents,
      entities: Array.isArray(raw.entities) ? raw.entities : [],
      notes: Array.isArray(raw.notes) ? raw.notes : [],
      relations: Array.isArray(raw.relations) ? raw.relations : [],
      modules: { ...defaultModules, ...(raw.modules || {}) }
    }
  } catch {
    const now = new Date().toISOString()
    return { version: 2, projects: [{ id: 'project-default', title: 'Mon premier projet', summary: 'Votre espace de création littéraire.', createdAt: now, updatedAt: now }], documents: [], entities: [], notes: [], relations: [], modules: defaultModules }
  }
}

async function writeWorkspace(workspace: Workspace) {
  await writeFile(workspacePath(), JSON.stringify({ ...workspace, version: 2 }, null, 2), 'utf8')
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 900, minHeight: 640,
    backgroundColor: '#f5f1e8', title: 'Scriptorium',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
}

ipcMain.handle('workspace:load', async () => readWorkspace())
ipcMain.handle('workspace:save', async (_event, workspace: Workspace) => { await writeWorkspace(workspace); return true })
ipcMain.handle('backup:export', async () => {
  const result = await dialog.showSaveDialog({ title: 'Exporter la bibliothèque Scriptorium', defaultPath: 'scriptorium-sauvegarde.json', filters: [{ name: 'Sauvegarde Scriptorium', extensions: ['json'] }] })
  if (result.canceled || !result.filePath) return false
  await writeFile(result.filePath, JSON.stringify(await readWorkspace(), null, 2), 'utf8')
  return true
})
ipcMain.handle('backup:import', async () => {
  const result = await dialog.showOpenDialog({ title: 'Importer une sauvegarde Scriptorium', properties: ['openFile'], filters: [{ name: 'Sauvegarde Scriptorium', extensions: ['json'] }] })
  if (result.canceled || !result.filePaths[0]) return false
  const imported = JSON.parse(await readFile(result.filePaths[0], 'utf8'))
  if (!imported || !Array.isArray(imported.documents)) throw new Error('Fichier de sauvegarde invalide.')
  const now = new Date().toISOString()
  const normalized: Workspace = {
    version: 2,
    projects: Array.isArray(imported.projects) ? imported.projects : [{ id: 'project-default', title: 'Mon premier projet', summary: '', createdAt: now, updatedAt: now }],
    documents: imported.documents.map((doc: DocumentRecord) => ({ ...doc, projectId: doc.projectId || (imported.projects?.[0]?.id ?? 'project-default') })),
    entities: Array.isArray(imported.entities) ? imported.entities : [],
    notes: Array.isArray(imported.notes) ? imported.notes : [],
    relations: Array.isArray(imported.relations) ? imported.relations : [],
    modules: { ...defaultModules, ...(imported.modules || {}) }
  }
  await writeWorkspace(normalized)
  return true
})
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
