import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile, copyFile } from 'node:fs/promises'

type DocumentRecord = {
  id: string
  title: string
  content: string
  updatedAt: string
}

type Library = { documents: DocumentRecord[] }

const libraryPath = () => join(app.getPath('userData'), 'scriptorium-library.json')

async function readLibrary(): Promise<Library> {
  try {
    return JSON.parse(await readFile(libraryPath(), 'utf8')) as Library
  } catch {
    return { documents: [] }
  }
}

async function writeLibrary(library: Library) {
  await writeFile(libraryPath(), JSON.stringify(library, null, 2), 'utf8')
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f5f1e8',
    title: 'Scriptorium',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('library:list', async () => (await readLibrary()).documents)
ipcMain.handle('library:get', async (_event, id: string) => {
  const library = await readLibrary()
  return library.documents.find((document) => document.id === id) ?? null
})
ipcMain.handle('library:save', async (_event, document: DocumentRecord) => {
  const library = await readLibrary()
  const record = { ...document, updatedAt: new Date().toISOString() }
  const index = library.documents.findIndex((item) => item.id === record.id)
  if (index >= 0) library.documents[index] = record
  else library.documents.unshift(record)
  await writeLibrary(library)
  return record
})
ipcMain.handle('library:delete', async (_event, id: string) => {
  const library = await readLibrary()
  library.documents = library.documents.filter((document) => document.id !== id)
  await writeLibrary(library)
  return true
})
ipcMain.handle('backup:export', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Exporter la bibliothèque Scriptorium',
    defaultPath: 'scriptorium-sauvegarde.json',
    filters: [{ name: 'Sauvegarde Scriptorium', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return false
  await copyFile(libraryPath(), result.filePath).catch(async () => {
    await writeFile(result.filePath!, JSON.stringify(await readLibrary(), null, 2), 'utf8')
  })
  return true
})
ipcMain.handle('backup:import', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Importer une sauvegarde Scriptorium',
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde Scriptorium', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePaths[0]) return false
  const imported = JSON.parse(await readFile(result.filePaths[0], 'utf8')) as Library
  if (!imported || !Array.isArray(imported.documents)) throw new Error('Fichier de sauvegarde invalide.')
  await writeLibrary(imported)
  return true
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})