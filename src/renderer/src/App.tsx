import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Archive, BookOpen, FilePlus2, Feather, FolderOpen, Search, Trash2, Download, Upload, Bold, Italic, Heading2, List, Quote, PanelLeftClose, PanelLeftOpen, Printer, Library, Users, Lightbulb, ChartNoAxesColumn, Settings, Plus, ChevronRight, BookMarked } from 'lucide-react'

const blankContent = '<p></p>'
const newId = () => crypto.randomUUID()
const moduleLabels: Record<string, string> = { manuscripts: 'Manuscrits', encyclopedia: 'Encyclopédie', notes: 'Carnet d’idées', progress: 'Progression' }

export default function App() {
  const [workspace, setWorkspace] = useState<ScriptoriumWorkspace | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
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
    const name = window.prompt('Nom du personnage, lieu, peuple, objet…')
    if (!name?.trim()) return
    const type = window.prompt('Type de fiche : Personnage, Lieu, Peuple, Objet, Créature…', 'Personnage') || 'Autre'
    const entity: ScriptoriumEntity = { id: newId(), projectId: activeProject.id, type, name: name.trim(), description: '', updatedAt: new Date().toISOString() }
    await save({ ...workspace, entities: [entity, ...workspace.entities] })
  }
  async function editEntity(entity: ScriptoriumEntity) {
    if (!workspace) return
    const description = window.prompt('Description / notes', entity.description)
    if (description === null) return
    await save({ ...workspace, entities: workspace.entities.map(e => e.id === entity.id ? { ...e, description, updatedAt: new Date().toISOString() } : e) })
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
  const notes = workspace.notes.filter(n => n.projectId === activeProjectId)
  const wordCount = projectDocuments.reduce((sum, doc) => sum + ((doc.content.replace(/<[^>]*>/g, ' ').match(/[\p{L}\p{N}’'-]+/gu) || []).length), 0)
  const nav = [{ id: 'projects', label: 'Mes projets', icon: <Library size={16}/> }, { id: 'manuscripts', label: moduleLabels.manuscripts, icon: <BookOpen size={16}/>, module: 'manuscripts' }, { id: 'encyclopedia', label: moduleLabels.encyclopedia, icon: <Users size={16}/>, module: 'encyclopedia' }, { id: 'notes', label: moduleLabels.notes, icon: <Lightbulb size={16}/>, module: 'notes' }, { id: 'progress', label: moduleLabels.progress, icon: <ChartNoAxesColumn size={16}/>, module: 'progress' }]

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Feather size={19}/></div><span>scriptorium</span><i>atelier de création littéraire</i></div>
      <div className="topbar-right"><span className={dirty ? 'save-state pending' : 'save-state'}><span/>{dirty ? 'Enregistrement…' : 'Bibliothèque locale'}</span><button className="icon-button" title="Exporter une sauvegarde" onClick={() => window.scriptorium.exportBackup()}><Download size={17}/></button><button className="icon-button" title="Importer une sauvegarde" onClick={importBackup}><Upload size={17}/></button></div>
    </header>
    <div className="workspace">
      {sidebarOpen && <aside className="sidebar">
        <div className="sidebar-heading"><span>ESPACE DE TRAVAIL</span><button className="icon-button small" title="Nouveau projet" onClick={createProject}><Plus size={17}/></button></div>
        <div className="project-switcher"><label>PROJET ACTUEL</label><select value={activeProjectId || ''} onChange={e => { setActiveProjectId(e.target.value); setActiveDocumentId(null); setView('projects') }}>{workspace.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
        <nav className="side-nav">{nav.filter(item => !item.module || workspace.modules[item.module] !== false).map(item => <button key={item.id} className={view === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span><ChevronRight size={14}/></button>)}</nav>
        {view === 'manuscripts' && <><div className="sidebar-heading subheading"><span>CHAPITRES & SCÈNES</span><button className="icon-button small" title="Ajouter un chapitre" onClick={createChapter}><FilePlus2 size={16}/></button></div><div className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher"/></div><div className="document-list">{filteredDocuments.map(doc => <button key={doc.id} className={doc.id === activeDocumentId ? 'document-item active' : 'document-item'} onClick={() => setActiveDocumentId(doc.id)}><BookOpen size={15}/><span>{doc.title || 'Sans titre'}</span></button>)}{filteredDocuments.length === 0 && <p className="empty-list">Aucun chapitre pour le moment.</p>}</div></>}
        <div className="sidebar-bottom"><button className="nav-item settings-link" onClick={() => setView('settings')}><Settings size={15}/><span>Modules & préférences</span></button><span className="local-note"><Archive size={13}/> Données conservées sur cet ordinateur</span></div>
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
        {view === 'encyclopedia' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">BÂTIR VOTRE UNIVERS</span><h1>Encyclopédie</h1><p>Gardez en mémoire les personnages, lieux, peuples, objets et créatures de votre histoire.</p><button className="primary-button" onClick={createEntity}><Plus size={16}/> Ajouter une fiche</button></div><div className="entity-grid">{entities.map(e => <article className="info-card" key={e.id}><span className="card-kicker">{e.type}</span><h3>{e.name}</h3><p>{e.description || 'Aucune note pour le moment.'}</p><button className="text-action" onClick={() => editEntity(e)}>Modifier la fiche</button></article>)}{entities.length === 0 && <p className="empty-hint">Votre encyclopédie est encore vierge. Donnez un visage à votre univers.</p>}</div></div>}
        {view === 'notes' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">CAPTURER L’ÉTINCELLE</span><h1>Carnet d’idées</h1><p>Fragments, inspirations, scènes à venir et pensées à ne pas laisser filer.</p><button className="primary-button" onClick={createNote}><Plus size={16}/> Nouvelle idée</button></div><div className="notes-list">{notes.map(n => <article className="note-card" key={n.id}><div><h3>{n.title}</h3><p>{n.content || 'Note encore vide. Cliquez pour la développer.'}</p></div><button className="text-action" onClick={() => editNote(n)}>Ouvrir</button></article>)}{notes.length === 0 && <p className="empty-hint">Aucune idée notée pour le moment.</p>}</div></div>}
        {view === 'progress' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">MESURER LE CHEMIN PARCOURU</span><h1>Progression</h1><p>Un aperçu de la matière déjà écrite dans ce projet.</p></div><div className="progress-grid"><div className="progress-card"><span>MOTS ÉCRITS</span><strong>{wordCount.toLocaleString('fr-FR')}</strong></div><div className="progress-card"><span>CHAPITRES</span><strong>{projectDocuments.length}</strong></div><div className="progress-card"><span>FICHES D’UNIVERS</span><strong>{entities.length}</strong></div><div className="progress-card"><span>IDÉES CONSERVÉES</span><strong>{notes.length}</strong></div></div><div className="project-summary-card"><label>VOTRE AVANCEMENT</label><p>{wordCount === 0 ? 'La page est encore blanche. Chaque grande histoire commence quelque part.' : wordCount < 1000 ? 'Les premières pages prennent forme. Continuez à faire grandir votre histoire.' : 'Votre univers prend de l’ampleur. Votre travail est conservé localement.'}</p></div></div>}
        {view === 'settings' && <div className="content-scroll"><div className="module-heading"><span className="eyebrow">UN ATELIER À VOTRE MESURE</span><h1>Modules & préférences</h1><p>Activez uniquement les outils dont vous avez besoin. Vos données restent conservées même si vous masquez un module.</p></div><div className="settings-list">{Object.entries(moduleLabels).map(([key,label]) => <label className="setting-row" key={key}><div><strong>{label}</strong><span>{({manuscripts:'Écriture, chapitres et scènes',encyclopedia:'Personnages, lieux et éléments du monde',notes:'Idées, fragments et inspirations',progress:'Statistiques de votre projet'} as Record<string,string>)[key]}</span></div><input type="checkbox" checked={workspace.modules[key] !== false} onChange={e => toggleModule(key,e.target.checked)}/></label>)}</div></div>}
      </section>
    </div>
    <footer className="statusbar"><span><span className="status-dot"/> Stockage local · {workspace.projects.length} projet(s)</span><span>Scriptorium · Version 0.2.0</span></footer>
  </main>
}
