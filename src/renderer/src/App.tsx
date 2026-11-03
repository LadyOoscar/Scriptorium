import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Archive, BookOpen, FilePlus2, Feather, FolderOpen, Search, Trash2, Download, Upload, Bold, Italic, Heading2, List, Quote, PanelLeftClose, PanelLeftOpen, Printer, Library, Users, Lightbulb, ChartNoAxesColumn, Settings, Plus, ChevronRight, BookMarked, X, CalendarDays, GitBranch } from 'lucide-react'

const blankContent = '<p></p>'
const newId = () => crypto.randomUUID()
const moduleLabels: Record<string, string> = { manuscripts: 'Manuscrits', encyclopedia: 'Encyclopédie', notes: 'Carnet d’idées', progress: 'Progression' }

export default function App() {
  const [workspace, setWorkspace] = useState<ScriptoriumWorkspace | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null)
  const [showRelationshipMap, setShowRelationshipMap] = useState(false)
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const draggingEntityId = useRef<string | null>(null)
  const didDrag = useRef(false)
  const [view, setView] = useState('projects')
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontSize, setFontSize] = useState(15)
  const [lineSpacing, setLineSpacing] = useState('1.8')
  const [pageMargin, setPageMargin] = useState('comfortable')
  const [pageFormat, setPageFormat] = useState('A4')
  const [orientation, setOrientation] = useState('portrait')
  const [pageNumbers, setPageNumbers] = useState(true)
  const activeProject = workspace?.projects.find(p => p.id === activeProjectId) ?? null
  const projectDocuments = workspace?.documents.filter(d => d.projectId === activeProjectId) ?? []
  const activeDocument = projectDocuments.find(d => d.id === activeDocumentId) ?? null

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'L’histoire commence ici…' })],
    content: blankContent,
    editorProps: { attributes: { class: 'writing-surface', spellcheck: 'true' } },
    onUpdate: () => setDirty(true)
  })

  useEffect(() => {
    window.scriptorium.loadWorkspace().then(data => {
      setWorkspace(data)
      if (data.projects[0]) setActiveProjectId(data.projects[0].id)
      const first = data.documents[0]
      if (first) { setActiveDocumentId(first.id); setView('manuscripts') }
    })
  }, [])

  useEffect(() => {
    if (!editor || !activeDocument) return
    if (editor.getHTML() !== activeDocument.content) editor.commands.setContent(activeDocument.content || blankContent)
    const font = activeDocument.fontFamily || 'Georgia'
    const size = activeDocument.fontSize || 15
    const spacing = activeDocument.lineSpacing || '1.8'
    setFontFamily(font); setFontSize(size); setLineSpacing(spacing)
    setPageMargin(activeDocument.pageMargin || 'comfortable')
    setPageFormat(activeDocument.pageFormat || 'A4')
    setOrientation(activeDocument.orientation || 'portrait')
    setPageNumbers(activeDocument.pageNumbers !== false)
    editor.view.dom.style.fontFamily = font
    editor.view.dom.style.fontSize = size + 'px'
    editor.view.dom.style.lineHeight = spacing
  }, [activeDocumentId, activeProjectId, editor])

  useEffect(() => {
    if (!workspace || !dirty || !editor || !activeDocument) return
    const timer = window.setTimeout(async () => {
      const updated = { ...activeDocument, content: editor.getHTML(), updatedAt: new Date().toISOString() }
      const next = { ...workspace, documents: workspace.documents.map(d => d.id === updated.id ? updated : d) }
      await window.scriptorium.saveWorkspace(next)
      setWorkspace(next); setDirty(false)
    }, 650)
    return () => window.clearTimeout(timer)
  }, [dirty, editor, activeDocumentId, workspace])

  const save = async (next: ScriptoriumWorkspace) => {
    setWorkspace(next)
    await window.scriptorium.saveWorkspace(next)
  }
  const filteredDocuments = useMemo(() => projectDocuments.filter(d => d.title.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))), [projectDocuments, query])

  async function createProject() {
    if (!workspace) return
    const title = window.prompt('Nom du nouveau projet', 'Nouveau roman')
    if (!title?.trim()) return
    const now = new Date().toISOString()
    const project = { id: newId(), title: title.trim(), summary: 'Un nouvel univers à faire vivre.', createdAt: now, updatedAt: now }
    await save({ ...workspace, projects: [project, ...workspace.projects] })
    setActiveProjectId(project.id); setActiveDocumentId(null); setView('projects')
  }
  async function updateProject(field: 'title' | 'summary', value: string) {
    if (!workspace || !activeProject) return
    await save({ ...workspace, projects: workspace.projects.map(p => p.id === activeProject.id ? { ...p, [field]: value, updatedAt: new Date().toISOString() } : p) })
  }
  async function createChapter() {
    if (!workspace || !activeProject) return
    const title = window.prompt('Titre du chapitre ou de la scène', 'Nouveau chapitre')
    if (!title?.trim()) return
    const doc: ScriptoriumDocument = { id: newId(), projectId: activeProject.id, title: title.trim(), content: blankContent, updatedAt: new Date().toISOString() }
    await save({ ...workspace, documents: [doc, ...workspace.documents] })
    setActiveDocumentId(doc.id); setView('manuscripts')
  }
  async function renameDocument(title: string) {
    if (!workspace || !activeDocument) return
    const next = { ...workspace, documents: workspace.documents.map(d => d.id === activeDocument.id ? { ...d, title } : d) }
    setWorkspace(next)
    await window.scriptorium.saveWorkspace(next)
  }
  async function deleteDocument() {
    if (!workspace || !activeDocument || !window.confirm('Supprimer définitivement ce chapitre ?')) return
    const nextDocs = workspace.documents.filter(d => d.id !== activeDocument.id)
    await save({ ...workspace, documents: nextDocs })
    setActiveDocumentId(nextDocs.find(d => d.projectId === activeProjectId)?.id ?? null)
  }
  async function changeSetting(setting: string, value: string) {
    if (!workspace || !activeDocument) return
    const updated = { ...activeDocument, [setting]: setting === 'fontSize' ? Number(value) : setting === 'pageNumbers' ? value === 'true' : value }
    if (setting === 'fontSize') { setFontSize(Number(value)); if (editor) editor.view.dom.style.fontSize = value + 'px' }
    if (setting === 'lineSpacing') { setLineSpacing(value); if (editor) editor.view.dom.style.lineHeight = value }
    if (setting === 'pageMargin') setPageMargin(value)
    if (setting === 'pageFormat') setPageFormat(value)
    if (setting === 'orientation') setOrientation(value)
    if (setting === 'pageNumbers') setPageNumbers(value === 'true')
    if (setting === 'fontFamily') { setFontFamily(value); if (editor) editor.view.dom.style.fontFamily = value }
    await save({ ...workspace, documents: workspace.documents.map(d => d.id === updated.id ? updated : d) })
  }
  async function createEntity() {
    if (!workspace || !activeProject) return
    const categories = ['Personnage', 'Lieu', 'Peuple / civilisation', 'Créature', 'Objet / artefact', 'Événement', 'Organisation', 'Concept / magie']
    const choice = window.prompt('Type de fiche :\n' + categories.map((label, i) => (i + 1) + '. ' + label).join('\n') + '\n\nSaisissez un numéro.', '1')
    if (choice === null) return
    const type = categories[Number(choice) - 1]
    if (!type) { window.alert('Catégorie invalide.'); return }
    const name = window.prompt('Nom : ' + type.toLocaleLowerCase('fr'))
    if (!name?.trim()) return
    const entity: ScriptoriumEntity = { id: newId(), projectId: activeProject.id, type, name: name.trim(), description: '', customFields: [], updatedAt: new Date().toISOString() }
    await save({ ...workspace, entities: [entity, ...workspace.entities] })
    setActiveEntityId(entity.id)
  }
  async function updateEntity(entityId: string, patch: Partial<ScriptoriumEntity>) {
    if (!workspace) return
    const next = { ...workspace, entities: workspace.entities.map(e => e.id === entityId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e) }
    await save(next)
  }
  async function addCustomField(entity: ScriptoriumEntity) {
    const label = window.prompt('Nom du nouveau champ')
    if (!label?.trim()) return
    await updateEntity(entity.id, { customFields: [...(entity.customFields || []), { id: newId(), label: label.trim(), value: '' }] })
  }
  async function addCharacterRelation(entity: ScriptoriumEntity) {
    if (!workspace) return
    const candidates = entities.filter(e => e.id !== entity.id)
    if (!candidates.length) { window.alert('Créez d’abord une autre fiche dans votre encyclopédie pour établir une relation.'); return }
    const choices = candidates.map((e, i) => (i + 1) + '. [' + e.type + '] ' + e.name).join('\n')
    const choice = window.prompt('Avec quel personnage créer un lien ?\n' + choices + '\n\nSaisissez son numéro.')
    const target = candidates[Number(choice) - 1]
    if (!target) return
    const fromLabel = window.prompt('Quel lien ' + entity.name + ' (' + entity.type + ') entretient-il avec ' + target.name + ' (' + target.type + ') ?', 'Ami·e')
    if (!fromLabel?.trim()) return
    const toLabel = window.prompt('Et quel lien ' + target.name + ' entretient-il avec ' + entity.name + ' ?', fromLabel.trim())
    if (toLabel === null) return
    const description = window.prompt('Précisions sur leur relation (facultatif)', '') ?? ''
    const relation: ScriptoriumRelation = { id: newId(), projectId: entity.projectId, fromEntityId: entity.id, toEntityId: target.id, fromLabel: fromLabel.trim(), toLabel: toLabel.trim() || fromLabel.trim(), description }
    await save({ ...workspace, relations: [...(workspace.relations || []), relation] })
  }
  async function deleteRelation(relationId: string) {
    if (!workspace || !window.confirm('Supprimer cette relation ?')) return
    await save({ ...workspace, relations: (workspace.relations || []).filter(r => r.id !== relationId) })
  }
  async function createTimelineEvent() {
    if (!workspace || !activeProject) return
    const title = window.prompt('Nom de l’événement')
    if (!title?.trim()) return
    const date = window.prompt('Date ou repère chronologique (ex. -1200, An 45, Printemps 302)', '')
    if (date === null || !date.trim()) return
    const period = window.prompt('Période (facultatif)', '') ?? ''
    const category = window.prompt('Catégorie / couleur thématique', 'Histoire') ?? 'Histoire'
    const description = window.prompt('Description de l’événement', '') ?? ''
    const event = { id: newId(), projectId: activeProject.id, title: title.trim(), date: date.trim(), period, category, description }
    await save({ ...workspace, timelineEvents: [...(workspace.timelineEvents || []), event] })
  }
  async function deleteTimelineEvent(eventId: string) {
    if (!workspace || !window.confirm('Supprimer cet événement de la frise ?')) return
    await save({ ...workspace, timelineEvents: (workspace.timelineEvents || []).filter(e => e.id !== eventId) })
  }
  async function addGenealogyLink() {
    if (!workspace || !activeProject) return
    const people = entities.filter(e => e.type === 'Personnage')
    if (people.length < 2) { window.alert('Créez au moins deux fiches de personnages pour établir une généalogie.'); return }
    const choices = people.map((e, i) => (i + 1) + '. ' + e.name).join('\\n')
    const from = window.prompt('Personnage de départ (numéro) :\\n' + choices)
    if (from === null) return
    const parent = people[Number(from) - 1]
    if (!parent) return
    const to = window.prompt('Personnage lié à ' + parent.name + ' (numéro) :\\n' + choices)
    if (to === null) return
    const child = people[Number(to) - 1]
    if (!child || child.id === parent.id) return
    const types = ['Parent de', 'Enfant de', 'Frère / sœur de', 'Demi-frère / demi-sœur de', 'Adoptant de', 'Enfant adopté de', 'Union avec', 'Lien personnalisé']
    const typeChoice = window.prompt('Type de lien :\\n' + types.map((t, i) => (i + 1) + '. ' + t).join('\\n'), '1')
    if (typeChoice === null) return
    const type = types[Number(typeChoice) - 1]
    if (!type) return
    const description = window.prompt('Précisions (facultatif)', '') ?? ''
    await save({ ...workspace, genealogyLinks: [...(workspace.genealogyLinks || []), { id: newId(), projectId: activeProject.id, fromEntityId: parent.id, toEntityId: child.id, type, description }] })
  }
  async function deleteGenealogyLink(linkId: string) {
    if (!workspace || !window.confirm('Supprimer ce lien familial ?')) return
    await save({ ...workspace, genealogyLinks: (workspace.genealogyLinks || []).filter(link => link.id !== linkId) })
  }
  async function createNote() {
    if (!workspace || !activeProject) return
    const title = window.prompt('Titre de votre idée', 'Nouvelle idée')
    if (!title?.trim()) return
    const note: ScriptoriumNote = { id: newId(), projectId: activeProject.id, title: title.trim(), content: '', updatedAt: new Date().toISOString() }
    await save({ ...workspace, notes: [note, ...workspace.notes] })
  }
  async function editNote(note: ScriptoriumNote) {
    if (!workspace) return
    const content = window.prompt('Votre idée', note.content)
    if (content === null) return
    await save({ ...workspace, notes: workspace.notes.map(n => n.id === note.id ? { ...n, content, updatedAt: new Date().toISOString() } : n) })
  }
  async function toggleModule(key: string, enabled: boolean) {
    if (!workspace) return
    const next = { ...workspace, modules: { ...workspace.modules, [key]: enabled } }
    await save(next)
    if (!enabled && view === key) setView('projects')
  }
  async function importBackup() {
    if (!window.confirm('Importer cette sauvegarde remplacera la bibliothèque actuelle. Continuer ?')) return
    if (await window.scriptorium.importBackup()) {
      const data = await window.scriptorium.loadWorkspace()
      setWorkspace(data); setActiveProjectId(data.projects[0]?.id ?? null); setActiveDocumentId(null); setView('projects')
    }
  }

  if (!workspace) return <main className="loading-screen"><Feather size={28}/><span>Ouverture de votre atelier…</span></main>
  const entities = workspace.entities.filter(e => e.projectId === activeProjectId)
  const activeEntity = entities.find(e => e.id === activeEntityId) ?? null
  const entityRelations = activeEntity ? (workspace.relations || []).filter(r => r.fromEntityId === activeEntity.id || r.toEntityId === activeEntity.id) : []
  const graphPositions = entities.map((entity, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index / Math.max(entities.length, 1))
    const radius = entities.length <= 1 ? 0 : entities.length <= 4 ? 145 : 205
    const saved = workspace.graphPositions?.[entity.id]
    const temporary = dragPositions[entity.id]
    return { id: entity.id, name: entity.name, x: temporary?.x ?? saved?.x ?? 400 + Math.cos(angle) * radius, y: temporary?.y ?? saved?.y ?? 280 + Math.sin(angle) * radius }
  })
  const graphPosition = (id: string) => graphPositions.find(p => p.id === id)
  function moveGraphNode(entityId: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (draggingEntityId.current !== entityId) return
    const map = event.currentTarget.parentElement
    if (!map) return
    const rect = map.getBoundingClientRect()
    const x = Math.max(48, Math.min(752, (event.clientX - rect.left) / rect.width * 800))
    const y = Math.max(48, Math.min(512, (event.clientY - rect.top) / rect.height * 560))
    setDragPositions(current => ({ ...current, [entityId]: { x, y } }))
    didDrag.current = true
  }
  async function finishGraphNode(entityId: string) {
    if (!workspace) return
    draggingEntityId.current = null
    const position = dragPositions[entityId]
    if (position) {
      const next = { ...workspace, graphPositions: { ...(workspace.graphPositions || {}), [entityId]: position } }
      await save(next)
    }
    window.setTimeout(() => { didDrag.current = false }, 0)
  }
  async function resetRelationshipMap() {
    if (!workspace) return
    const nextPositions = { ...(workspace.graphPositions || {}) }
    entities.forEach(entity => { delete nextPositions[entity.id] })
    setDragPositions({})
    await save({ ...workspace, graphPositions: nextPositions })
  }
  const notes = workspace.notes.filter(n => n.projectId === activeProjectId)
  const wordCount = projectDocuments.reduce((sum, doc) => sum + ((doc.content.replace(/<[^>]*>/g, ' ').match(/[\p{L}\p{N}’'-]+/gu) || []).length), 0)
  const nav = [{ id: 'projects', label: 'Mes projets', icon: <Library size={16}/> }, { id: 'manuscripts', label: moduleLabels.manuscripts, icon: <BookOpen size={16}/>, module: 'manuscripts' }, { id: 'encyclopedia', label: moduleLabels.encyclopedia, icon: <Users size={16}/>, module: 'encyclopedia' }, { id: 'notes', label: moduleLabels.notes, icon: <Lightbulb size={16}/>, module: 'notes' }, { id: 'progress', label: moduleLabels.progress, icon: <ChartNoAxesColumn size={16}/>, module: 'progress' }, { id: 'timeline', label: 'Frise chronologique', icon: <CalendarDays size={16}/> }, { id: 'genealogy', label: 'Arbre généalogique', icon: <GitBranch size={16}/> }]

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Feather size={19}/></div><span>scriptorium</span><i>atelier de création littéraire</i></div>
      <div className="topbar-right"><span className={dirty ? 'save-state pending' : 'save-state'}><span/>{dirty ? 'Enregistrement…' : 'Bibliothèque locale'}</span><button className="icon-button" title="Exporter une sauvegarde" onClick={() => window.scriptorium.exportBackup()}><Download size={17}/></button><button className="icon-button" title="Importer une sauvegarde" onClick={importBackup}><Upload size={17}/></button></div>
    </header>
    <div className="workspace">
      {sidebarOpen && <aside className="sidebar">
        <div className="sidebar-heading"><span>ESPACE DE TRAVAIL</span><div className="sidebar-heading-actions"><button className="icon-button small" title="Nouveau projet" onClick={createProject}><Plus size={17}/></button><button className="icon-button small mobile-sidebar-close" title="Fermer le menu" onClick={() => setSidebarOpen(false)}><X size={17}/></button></div></div>
        <div className="project-switcher"><label>PROJET ACTUEL</label><select value={activeProjectId || ''} onChange={e => { setActiveProjectId(e.target.value); setActiveDocumentId(null); setView('projects') }}>{workspace.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
        <nav className="side-nav">{nav.filter(item => !item.module || workspace.modules[item.module] !== false).map(item => <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(item.id); if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false) }}>{item.icon}<span>{item.label}</span><ChevronRight size={14}/></button>)}</nav>
        {view === 'manuscripts' && <><div className="sidebar-heading subheading"><span>CHAPITRES & SCÈNES</span><button className="icon-button small" title="Ajouter un chapitre" onClick={createChapter}><FilePlus2 size={16}/></button></div><div className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher"/></div><div className="document-list">{filteredDocuments.map(doc => <button key={doc.id} className={doc.id === activeDocumentId ? 'document-item active' : 'document-item'} onClick={() => setActiveDocumentId(doc.id)}><BookOpen size={15}/><span>{doc.title || 'Sans titre'}</span></button>)}{filteredDocuments.length === 0 && <p className="empty-list">Aucun chapitre pour le moment.</p>}</div></>}
        <div className="sidebar-bottom"><button className="nav-item settings-link" onClick={() => { setView('settings'); if (window.matchMedia('(max-width: 760px)').matches) setSidebarOpen(false) }}><Settings size={15}/><span>Modules & préférences</span></button><span className="local-note"><Archive size={13}/> Données conservées sur cet ordinateur</span></div>
      </aside>}
      <section className="editor-area">
        <div className="editor-toolbar"><button className="icon-button" title="Afficher/masquer le panneau latéral" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button><div className="toolbar-divider"/>
          {view === 'manuscripts' && activeDocument && <><button className="icon-button" title="Gras" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={17}/></button><button className="icon-button" title="Italique" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17}/></button><button className="icon-button" title="Titre" onClick={() => editor?.chain().focus().toggleHeading({level:2}).run()}><Heading2 size={17}/></button><button className="icon-button" title="Liste" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17}/></button><button className="icon-button" title="Citation" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={17}/></button><div className="toolbar-divider"/>
            <select className="font-picker" value={fontFamily} onChange={e => changeSetting('fontFamily', e.target.value)}><option>Georgia</option><option>Palatino Linotype</option><option>Garamond</option><option>Book Antiqua</option><option>Cambria</option><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Verdana</option><option>Trebuchet MS</option><option>Courier New</option></select>
            <select className="compact-picker" value={fontSize} onChange={e => changeSetting('fontSize', e.target.value)}>{[11,12,13,14,15,16,18,20,22,24,28,32].map(s => <option key={s}>{s}</option>)}</select>
            <select className="compact-picker" value={lineSpacing} onChange={e => changeSetting('lineSpacing', e.target.value)}><option value="1.3">Serré</option><option value="1.5">1,5</option><option value="1.8">Aéré</option><option value="2">Double</option></select>
            <select className="compact-picker" value={pageMargin} onChange={e => changeSetting('pageMargin', e.target.value)}><option value="narrow">Étroit</option><option value="comfortable">Normal</option><option value="wide">Large</option></select>
            <select className="compact-picker" value={pageFormat} onChange={e => changeSetting('pageFormat', e.target.value)}><option>A4</option><option>A5</option><option>Letter</option></select>
            <select className="compact-picker" value={orientation} onChange={e => changeSetting('orientation', e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Paysage</option></select>
            <select className="compact-picker" value={String(pageNumbers)} onChange={e => changeSetting('pageNumbers', e.target.value)}><option value="true">Numéros oui</option><option value="false">Numéros non</option></select><button className="icon-button" title="Imprimer" onClick={() => window.print()}><Printer size={16}/></button><div className="toolbar-spacer"/><button className="icon-button danger" title="Supprimer le chapitre" onClick={deleteDocument}><Trash2 size={16}/></button></>}
        </div>
        {view === 'projects' && <div className="content-scroll"><div className="welcome-panel"><p className="eyebrow">VOTRE ESPACE DE CRÉATION</p><h1>{activeProject?.title || 'Vos projets littéraires'}</h1><p>Un atelier organisé pour faire grandir vos histoires, de la première idée au dernier chapitre.</p></div>
          {activeProject && <div className="project-summary-card"><label>PRÉSENTATION DU PROJET</label><input className="project-title-input" value={activeProject.title} onChange={e => updateProject('title', e.target.value)}/><textarea value={activeProject.summary} onChange={e => updateProject('summary', e.target.value)} placeholder="Résumé, intention, ambiance de votre œuvre…"/><div className="project-stats"><span><BookOpen size={15}/> {projectDocuments.length} chapitre(s)</span><span><Users size={15}/> {entities.length} fiche(s)</span><span><Lightbulb size={15}/> {notes.length} idée(s)</span><span><BookMarked size={15}/> {wordCount.toLocaleString('fr-FR')} mots</span></div></div>}
          <div className="section-heading"><div><span className="eyebrow">VOTRE BIBLIOTHÈQUE</span><h2>Projets littéraires</h2></div><button className="primary-button" onClick={createProject}><Plus size={16}/> Nouveau projet</button></div>
          <div className="project-grid">{workspace.projects.map(p => <button key={p.id} className={p.id === activeProjectId ? 'project-card selected' : 'project-card'} onClick={() => {setActiveProjectId(p.id);setActiveDocumentId(null)}}><div className="project-card-icon"><Feather size={19}/></div><strong>{p.title}</strong><span>{p.summary || 'Projet sans résumé'}</span><small>{workspace.documents.filter(d => d.projectId === p.id).length} chapitre(s)</small></button>)}</div>
        </div>}
        {view === 'manuscripts' && <>{activeDocument ? <div className={`page-wrap margin-${pageMargin} format-${pageFormat.toLowerCase()} orientation-${orientation} ${pageNumbers ? 'with-page-numbers' : 'without-page-numbers'}`}><input className="document-title" value={activeDocument.title} onChange={e => renameDocument(e.target.value)} aria-label="Titre du chapitre"/><div className="page-meta">{activeProject?.title.toUpperCase()} <span>·</span> MODIFIÉ {new Date(activeDocument.updatedAt).toLocaleDateString('fr-FR')}</div><EditorContent editor={editor}/><div className="page-footer"><span>Scriptorium</span><span>Écrivez à votre rythme.</span></div></div> : <div className="empty-module"><BookOpen size={32}/><h2>Le manuscrit attend ses mots.</h2><p>Créez un premier chapitre pour commencer à écrire.</p><button className="primary-button" onClick={createChapter}><FilePlus2 size={16}/> Créer un chapitre</button></div>}</>}
        {view === 'encyclopedia' && <div className="content-scroll">
          {!activeEntity ? <>
            <div className="module-heading"><span className="eyebrow">BÂTIR VOTRE UNIVERS</span><h1>Encyclopédie de votre univers</h1><p>Personnages, lieux, peuples, créatures, objets et événements : rassemblez toute la matière de votre monde et reliez ses éléments.</p><div className="character-list-actions"><button className="primary-button" onClick={createEntity}><Plus size={16}/> Nouvelle fiche<button className="secondary-button" onClick={() => setShowRelationshipMap(v => !v)}>{showRelationshipMap ? 'Afficher les fiches' : 'Voir la carte de l’univers'}</button></div></div>
            {showRelationshipMap ? <section className="relationship-map-section"><div className="relationship-map-heading"><div><h2>Carte des relations</h2><p>Faites glisser les fiches de votre univers pour organiser leurs liens. Leurs positions sont sauvegardées automatiquement.</p></div><div className="relationship-map-tools"><span>{entities.length} personnage(s) · {(workspace.relations || []).filter(r => r.projectId === activeProjectId).length} lien(s)</span><button className="secondary-button map-reset-button" onClick={resetRelationshipMap}>Réinitialiser la disposition</button></div></div>
              {entities.length === 0 ? <p className="empty-hint">Ajoutez des personnages pour construire votre carte.</p> : <div className="relationship-map"><svg className="relationship-lines" viewBox="0 0 800 560" role="img" aria-label="Liens entre les personnages">{(workspace.relations || []).filter(r => r.projectId === activeProjectId).map(r => { const a = graphPosition(r.fromEntityId); const b = graphPosition(r.toEntityId); return a && b ? <g key={r.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-7}>{r.fromLabel}</text></g> : null })}</svg>{graphPositions.map((p,index) => <button key={p.id} className="relationship-node" style={{left:(p.x/800*100)+'%',top:(p.y/560*100)+'%'}} onPointerDown={event => { event.preventDefault(); draggingEntityId.current = p.id; didDrag.current = false; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => moveGraphNode(p.id,event)} onPointerUp={() => finishGraphNode(p.id)} onPointerCancel={() => finishGraphNode(p.id)} onClick={() => { if (didDrag.current) return; setActiveEntityId(p.id); setShowRelationshipMap(false) }} title="Faire glisser pour déplacer"><span className="relationship-node-mark">{p.name.trim().charAt(0).toLocaleUpperCase('fr')}</span><strong>{p.name || 'Sans nom'}</strong><small>{entities[index]?.type || 'Élément'}{entities[index]?.role ? ' · ' + entities[index].role : ''}</small></button>)}</div>}
              <div className="relationship-legend"><span><i/> Personnage</span><span><i/> Relation</span><span className="map-drag-hint">↔ Déplacement à la souris ou au doigt</span></div>
            </section> : <div className="entity-grid">{entities.map(e => <article className="info-card" key={e.id}><span className="card-kicker">{e.type}</span><h3>{e.name}</h3><p>{e.role || e.description || 'Fiche à compléter.'}</p><button className="text-action" onClick={() => setActiveEntityId(e.id)}>Ouvrir la fiche <ChevronRight size={13}/></button></article>)}{entities.length === 0 && <p className="empty-hint">Aucun personnage pour le moment. Créez votre première fiche.</p>}</div>}
          </> : <>
            <div className="module-heading"><button className="text-action" onClick={() => setActiveEntityId(null)}>← Retour aux personnages</button><span className="eyebrow">FICHE · {activeEntity.type.toLocaleUpperCase('fr')}</span><input className="character-name-input" value={activeEntity.name} onChange={e => updateEntity(activeEntity.id,{name:e.target.value})} aria-label="Nom du personnage"/><p>Les champs sont facultatifs. Complétez uniquement ce qui vous est utile.</p></div>
            <div className="character-panel">
              <h2>Informations générales</h2><div className="character-form-grid">
                <label>Âge<input value={activeEntity.age || ''} onChange={e => updateEntity(activeEntity.id,{age:e.target.value})} placeholder="Âge ou tranche d’âge"/></label>
                <label>Genre<input value={activeEntity.gender || ''} onChange={e => updateEntity(activeEntity.id,{gender:e.target.value})} placeholder="Genre"/></label>
                <label>Origine<input value={activeEntity.origin || ''} onChange={e => updateEntity(activeEntity.id,{origin:e.target.value})} placeholder="Origine, peuple…"/></label>
                <label>Rôle dans l’histoire<input value={activeEntity.role || ''} onChange={e => updateEntity(activeEntity.id,{role:e.target.value})} placeholder="Héroïne, antagoniste…"/></label>
              </div>
              <h2>Description détaillée</h2><textarea value={activeEntity.appearance || ''} onChange={e => updateEntity(activeEntity.id,{appearance:e.target.value})} placeholder="Description physique, vêtements, voix, signes distinctifs…"/>
              <h2>Personnalité</h2><div className="character-form-grid">
                <label>Traits dominants<input value={activeEntity.personality || ''} onChange={e => updateEntity(activeEntity.id,{personality:e.target.value})} placeholder="Tempérament…"/></label>
                <label>Qualités<input value={activeEntity.qualities || ''} onChange={e => updateEntity(activeEntity.id,{qualities:e.target.value})} placeholder="Ses forces…"/></label>
                <label>Défauts<input value={activeEntity.flaws || ''} onChange={e => updateEntity(activeEntity.id,{flaws:e.target.value})} placeholder="Ses faiblesses…"/></label>
                <label>Peurs<input value={activeEntity.fears || ''} onChange={e => updateEntity(activeEntity.id,{fears:e.target.value})} placeholder="Ce qui l’effraie…"/></label>
                <label className="wide-field">Motivations<input value={activeEntity.motivations || ''} onChange={e => updateEntity(activeEntity.id,{motivations:e.target.value})} placeholder="Ce qu’il ou elle désire profondément…"/></label>
              </div>
              <h2>Histoire & récit</h2><textarea value={activeEntity.history || ''} onChange={e => updateEntity(activeEntity.id,{history:e.target.value})} placeholder="Passé, événements fondateurs, blessures, secrets…"/>
              <label className="character-block-label">Objectif dans l’histoire<textarea value={activeEntity.goal || ''} onChange={e => updateEntity(activeEntity.id,{goal:e.target.value})} placeholder="Que cherche ce personnage ? Qu’est-ce qui l’en empêche ?"/></label>
              <h2>Relations dans l’univers</h2><p className="character-help">Reliez librement cette fiche à un personnage, un lieu, un peuple, une créature, un objet ou tout autre élément. Chaque extrémité du lien possède son propre libellé.</p>
              <button className="primary-button" onClick={() => addCharacterRelation(activeEntity)}><Plus size={15}/> Ajouter une relation</button>
              <div className="character-relations">{entityRelations.map(r => { const outgoing = r.fromEntityId === activeEntity.id; const other = entities.find(e => e.id === (outgoing ? r.toEntityId : r.fromEntityId)); return <article className="relation-card" key={r.id}><div><strong>{other?.name || 'Personnage inconnu'}</strong><span>{outgoing ? r.fromLabel : r.toLabel} · {outgoing ? r.toLabel : r.fromLabel}</span>{r.description && <p>{r.description}</p>}</div><button className="text-action" onClick={() => deleteRelation(r.id)}>Supprimer</button></article> })}{entityRelations.length === 0 && <p className="empty-hint">Aucune relation définie pour le moment.</p>}</div>
              <h2>Notes personnelles</h2><textarea value={activeEntity.notes || activeEntity.description || ''} onChange={e => updateEntity(activeEntity.id,{notes:e.target.value,description:e.target.value})} placeholder="Tout ce que vous souhaitez garder en mémoire…"/>
              <div className="custom-fields-heading"><h2>Champs personnalisés</h2><button className="text-action" onClick={() => addCustomField(activeEntity)}><Plus size={14}/> Ajouter un champ</button></div>
              {(activeEntity.customFields || []).map(field => <label className="custom-field" key={field.id}><span>{field.label}</span><input value={field.value} onChange={e => updateEntity(activeEntity.id,{customFields:(activeEntity.customFields || []).map(f => f.id === field.id ? {...f,value:e.target.value} : f)})}/><button className="text-action" onClick={() => updateEntity(activeEntity.id,{customFields:(activeEntity.customFields || []).filter(f => f.id !== field.id)})}>Retirer</button></label>)}
            </div>
          </>}
        </div>}
        {view === 'timeline' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">MÉMOIRE DE VOTRE UNIVERS</span><h1>Frise chronologique</h1><p>Les grands tournants, les petites tragédies et les événements qui façonnent votre monde.</p><button className="primary-button" onClick={createTimelineEvent}><Plus size={16}/> Ajouter un événement</button></div><div className="timeline-track">{(workspace.timelineEvents || []).filter(e => e.projectId === activeProjectId).slice().sort((a,b) => a.date.localeCompare(b.date, 'fr', { numeric: true })).map(event => <article className="timeline-event" key={event.id}><div className="timeline-marker"/><div className="timeline-event-card"><span className="card-kicker">{event.category} · {event.period || 'Chronologie'}</span><h3>{event.title}</h3><strong>{event.date}</strong>{event.description && <p>{event.description}</p>}<button className="text-action" onClick={() => deleteTimelineEvent(event.id)}>Supprimer</button></div></article>)}{!(workspace.timelineEvents || []).some(e => e.projectId === activeProjectId) && <p className="empty-hint">Votre chronologie est encore vierge. Ajoutez le premier événement fondateur.</p>}</div></div>}
        {view === 'genealogy' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">HÉRITAGES & DESCENDANCES</span><h1>Arbre généalogique</h1><p>Cartographiez les lignées, les unions, les adoptions et les liens de parenté de vos personnages.</p><button className="primary-button" onClick={addGenealogyLink}><Plus size={16}/> Ajouter un lien familial</button></div><div className="genealogy-tree">{(workspace.genealogyLinks || []).filter(link => link.projectId === activeProjectId).map(link => { const from = entities.find(e => e.id === link.fromEntityId); const to = entities.find(e => e.id === link.toEntityId); return <article className="genealogy-link-card" key={link.id}><div className="genealogy-person"><span>✦</span><strong>{from?.name || 'Personnage inconnu'}</strong></div><div className="genealogy-connector"><span>{link.type}</span><i/></div><div className="genealogy-person"><span>✦</span><strong>{to?.name || 'Personnage inconnu'}</strong></div>{link.description && <p>{link.description}</p>}<button className="text-action" onClick={() => deleteGenealogyLink(link.id)}>Retirer ce lien</button></article> })}{!(workspace.genealogyLinks || []).some(link => link.projectId === activeProjectId) && <p className="empty-hint">Aucun lien familial pour le moment. Créez des fiches Personnage puis reliez-les ici.</p>}</div></div>}
        {view === 'notes' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">CAPTURER L’ÉTINCELLE</span><h1>Carnet d’idées</h1><p>Fragments, inspirations, scènes à venir et pensées à ne pas laisser filer.</p><button className="primary-button" onClick={createNote}><Plus size={16}/> Nouvelle idée</button></div><div className="notes-list">{notes.map(n => <article className="note-card" key={n.id}><div><h3>{n.title}</h3><p>{n.content || 'Note encore vide. Cliquez pour la développer.'}</p></div><button className="text-action" onClick={() => editNote(n)}>Ouvrir</button></article>)}{notes.length === 0 && <p className="empty-hint">Aucune idée notée pour le moment.</p>}</div></div>}
        {view === 'progress' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">MESURER LE CHEMIN PARCOURU</span><h1>Progression</h1><p>Un aperçu de la matière déjà écrite dans ce projet.</p></div><div className="progress-grid"><div className="progress-card"><span>MOTS ÉCRITS</span><strong>{wordCount.toLocaleString('fr-FR')}</strong></div><div className="progress-card"><span>CHAPITRES</span><strong>{projectDocuments.length}</strong></div><div className="progress-card"><span>FICHES D’UNIVERS</span><strong>{entities.length}</strong></div><div className="progress-card"><span>IDÉES CONSERVÉES</span><strong>{notes.length}</strong></div></div><div className="project-summary-card"><label>VOTRE AVANCEMENT</label><p>{wordCount === 0 ? 'La page est encore blanche. Chaque grande histoire commence quelque part.' : wordCount < 1000 ? 'Les premières pages prennent forme. Continuez à faire grandir votre histoire.' : 'Votre univers prend de l’ampleur. Votre travail est conservé localement.'}</p></div></div>}
        {view === 'settings' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">UN ATELIER À VOTRE MESURE</span><h1>Modules & préférences</h1><p>Activez uniquement les outils dont vous avez besoin. Vos données restent conservées même si vous masquez un module.</p></div><div className="settings-list">{Object.entries(moduleLabels).map(([key,label]) => <label className="setting-row" key={key}><div><strong>{label}</strong><span>{({manuscripts:'Écriture, chapitres et scènes',encyclopedia:'Personnages, lieux et éléments du monde',notes:'Idées, fragments et inspirations',progress:'Statistiques de votre projet'} as Record<string,string>)[key]}</span></div><input type="checkbox" checked={workspace.modules[key] !== false} onChange={e => toggleModule(key,e.target.checked)}/></label>)}</div></div>}
      </section>
    </div>
    <footer className="statusbar"><span><span className="status-dot"/> Stockage local · {workspace.projects.length} projet(s)</span><span>Scriptorium · Version 0.2.0</span></footer>
  </main>
}
