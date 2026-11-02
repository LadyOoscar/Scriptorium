type ScriptoriumProject = { id: string; title: string; summary: string; createdAt: string; updatedAt: string }
type ScriptoriumDocument = {
  id: string
  projectId?: string
  title: string
  content: string
  fontFamily?: string
  fontSize?: number
  lineSpacing?: string
  pageMargin?: string
  pageFormat?: string
  orientation?: string
  pageNumbers?: boolean
  updatedAt: string
}
type ScriptoriumEntity = { id: string; projectId: string; type: string; name: string; description: string; updatedAt: string }
type ScriptoriumNote = { id: string; projectId: string; title: string; content: string; updatedAt: string }
type ScriptoriumWorkspace = {
  version: number
  projects: ScriptoriumProject[]
  documents: ScriptoriumDocument[]
  entities: ScriptoriumEntity[]
  notes: ScriptoriumNote[]
  modules: Record<string, boolean>
}
interface Window {
  scriptorium: {
    loadWorkspace(): Promise<ScriptoriumWorkspace>
    saveWorkspace(workspace: ScriptoriumWorkspace): Promise<boolean>
    exportBackup(): Promise<boolean>
    importBackup(): Promise<boolean>
  }
}
