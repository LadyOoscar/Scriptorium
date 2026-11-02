type ScriptoriumDocument = {
  id: string
  title: string
  content: string
  fontFamily?: string
  updatedAt: string
}

interface Window {
  scriptorium: {
    listDocuments(): Promise<ScriptoriumDocument[]>
    getDocument(id: string): Promise<ScriptoriumDocument | null>
    saveDocument(document: ScriptoriumDocument): Promise<ScriptoriumDocument>
    deleteDocument(id: string): Promise<boolean>
    exportBackup(): Promise<boolean>
    importBackup(): Promise<boolean>
  }
}