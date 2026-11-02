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
type ScriptoriumCustomField = { id: string; label: string; value: string }
type ScriptoriumEntity = { id: string; projectId: string; type: string; name: string; description: string; age?: string; gender?: string; origin?: string; role?: string; appearance?: string; personality?: string; qualities?: string; flaws?: string; fears?: string; motivations?: string; history?: string; goal?: string; notes?: string; customFields?: ScriptoriumCustomField[]; updatedAt: string }
type ScriptoriumRelation = { id: string; projectId: string; fromEntityId: string; toEntityId: string; fromLabel: string; toLabel: string; description: string }
type ScriptoriumNote = { id: string; projectId: string; title: string; content: string; updatedAt: string }
type ScriptoriumWorkspace = {
  version: number
  projects: ScriptoriumProject[]
  documents: ScriptoriumDocument[]
  entities: ScriptoriumEntity[]
  notes: ScriptoriumNote[]
  relations?: ScriptoriumRelation[]
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
