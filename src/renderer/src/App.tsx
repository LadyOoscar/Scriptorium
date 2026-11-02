import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Archive, BookOpen, FilePlus2, Feather, FolderOpen, Search, Trash2, Download, Upload, Bold, Italic, Heading2, List, Quote, Check, PanelLeftClose, PanelLeftOpen, Printer } from 'lucide-react'

const blankContent = '<p></p>'
const newId = () => crypto.randomUUID()

export default function App() {
  const [documents, setDocuments] = useState<ScriptoriumDocument[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontSize, setFontSize] = useState(15)
  const [lineSpacing, setLineSpacing] = useState('2')
  const [pageMargin, setPageMargin] = useState('comfortable')
  const [pageFormat, setPageFormat] = useState('A4')
  const [orientation, setOrientation] = useState('portrait')
  const [pageNumbers, setPageNumbers] = useState(true)
  const activeDocument = documents.find((document) => document.id === activeId) ?? null

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'L’histoire commence ici…' })
    ],
    content: blankContent,
    editorProps: { attributes: { class: 'writing-surface', spellcheck: 'true' } },
    onUpdate: () => setDirty(true)
  })

  useEffect(() => {
    window.scriptorium.listDocuments().then((items) => {
      setDocuments(items)
      if (items[0]) setActiveId(items[0].id)
    })
  }, [])

  useEffect(() => {
    if (!editor || !activeDocument) return
    const current = editor.getHTML()
    if (current !== activeDocument.content) editor.commands.setContent(activeDocument.content || blankContent)
    const nextFont = activeDocument.fontFamily || 'Georgia'
    setFontFamily(nextFont)
    editor.view.dom.style.fontFamily = nextFont
    const nextSize = activeDocument.fontSize || 15
    const nextSpacing = activeDocument.lineSpacing || '2'
    const nextMargin = activeDocument.pageMargin || 'comfortable'
    setFontSize(nextSize)
    setLineSpacing(nextSpacing)
    setPageMargin(nextMargin)
    setPageFormat(activeDocument.pageFormat || 'A4')
    setOrientation(activeDocument.orientation || 'portrait')
    setPageNumbers(activeDocument.pageNumbers !== false)
    editor.view.dom.style.fontSize = `${nextSize}px`
    editor.view.dom.style.lineHeight = nextSpacing
  }, [activeId, editor])

  useEffect(() => {
    if (!editor || !activeId || !dirty) return
    const timer = window.setTimeout(async () => {
      const current = documents.find((item) => item.id === activeId)
      if (!current) return
      const updated = await window.scriptorium.saveDocument({
        ...current,
        content: editor.getHTML(),
        updatedAt: new Date().toISOString()
      })
      setDocuments((items) => items.map((item) => item.id === updated.id ? updated : item))
      setDirty(false)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [editor, activeId, dirty])

  const filteredDocuments = useMemo(() => documents.filter((item) =>
    item.title.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))
  ), [documents, query])

  async function createDocument() {
    const document: ScriptoriumDocument = {
      id: newId(),
      title: 'Sans titre',
      content: blankContent,
      updatedAt: new Date().toISOString()
    }
    await window.scriptorium.saveDocument(document)
    setDocuments((items) => [document, ...items])
    setActiveId(document.id)
    editor?.commands.setContent(blankContent)
  }

  async function changeFont(nextFont: string) {
    setFontFamily(nextFont)
    if (!activeDocument || !editor) return
    editor.view.dom.style.fontFamily = nextFont
    const updated = await window.scriptorium.saveDocument({ ...activeDocument, fontFamily: nextFont })
    setDocuments((items) => items.map((item) => item.id === updated.id ? updated : item))
  }

  async function changePageSetting(setting: 'fontSize' | 'lineSpacing' | 'pageMargin' | 'pageFormat' | 'orientation' | 'pageNumbers', value: string) {
    if (!activeDocument || !editor) return
    const updated = { ...activeDocument, [setting]: setting === 'fontSize' ? Number(value) : value }
    if (setting === 'fontSize') {
      setFontSize(Number(value))
      editor.view.dom.style.fontSize = `${value}px`
    }
    if (setting === 'lineSpacing') {
      setLineSpacing(value)
      editor.view.dom.style.lineHeight = value
    }
    if (setting === 'pageMargin') setPageMargin(value)
    if (setting === 'pageFormat') setPageFormat(value)
    if (setting === 'orientation') setOrientation(value)
    if (setting === 'pageNumbers') setPageNumbers(value === 'true')
    const saved = await window.scriptorium.saveDocument(updated)
    setDocuments((items) => items.map((item) => item.id === saved.id ? saved : item))
  }

  async function renameDocument(title: string) {
    if (!activeDocument) return
    const updated = await window.scriptorium.saveDocument({ ...activeDocument, title })
    setDocuments((items) => items.map((item) => item.id === updated.id ? updated : item))
  }

  async function deleteDocument() {
    if (!activeDocument) return
    if (!window.confirm('Supprimer ce manuscrit ? Cette action est définitive.')) return
    await window.scriptorium.deleteDocument(activeDocument.id)
    const remaining = documents.filter((item) => item.id !== activeDocument.id)
    setDocuments(remaining)
    setActiveId(remaining[0]?.id ?? null)
  }

  async function exportBackup() {
    await window.scriptorium.exportBackup()
  }

  async function importBackup() {
    if (!window.confirm('Importer cette sauvegarde remplacera la bibliothèque actuelle. Continuer ?')) return
    const imported = await window.scriptorium.importBackup()
    if (imported) {
      const items = await window.scriptorium.listDocuments()
      setDocuments(items)
      setActiveId(items[0]?.id ?? null)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Feather size={19} /></div><span>scriptorium</span><i>atelier d’écriture</i></div>
        <div className="topbar-right"><span className={dirty ? 'save-state pending' : 'save-state'}><span />{dirty ? 'Enregistrement…' : 'Enregistré localement'}</span><button className="icon-button" title="Exporter une sauvegarde" onClick={exportBackup}><Download size={17}/></button><button className="icon-button" title="Importer une sauvegarde" onClick={importBackup}><Upload size={17}/></button></div>
      </header>
      <div className="workspace">
        {sidebarOpen && <aside className="sidebar">
          <div className="sidebar-heading"><span>MA BIBLIOTHÈQUE</span><button className="icon-button small" title="Nouveau manuscrit" onClick={createDocument}><FilePlus2 size={17}/></button></div>
          <div className="search-box"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un manuscrit"/></div>
          <div className="library-label"><FolderOpen size={14}/> Manuscrits <span>{documents.length}</span></div>
          <div className="document-list">
            {filteredDocuments.map((document) => <button key={document.id} className={document.id === activeId ? 'document-item active' : 'document-item'} onClick={() => setActiveId(document.id)}>
              <BookOpen size={16}/><span>{document.title || 'Sans titre'}</span>
            </button>)}
            {filteredDocuments.length === 0 && <p className="empty-list">{documents.length ? 'Aucun résultat.' : 'Votre bibliothèque attend sa première histoire.'}</p>}
          </div>
          <div className="sidebar-bottom"><Archive size={14}/> Vos textes restent sur cet ordinateur.</div>
        </aside>}
        <section className="editor-area">
          <div className="editor-toolbar">
            <button className="icon-button" title="Afficher/masquer la bibliothèque" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>}</button>
            <div className="toolbar-divider"/>
            <button className="icon-button" title="Gras" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={17}/></button>
            <button className="icon-button" title="Italique" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17}/></button>
            <button className="icon-button" title="Titre" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={17}/></button>
            <button className="icon-button" title="Liste" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17}/></button>
            <button className="icon-button" title="Citation" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={17}/></button>
            <div className="toolbar-divider"/>
            <label className="font-picker-label" htmlFor="font-picker">Police</label>
            <select id="font-picker" className="font-picker" value={fontFamily} onChange={(event) => changeFont(event.target.value)} disabled={!activeDocument}>
              <option value="Georgia">Georgia</option>
              <option value="Palatino Linotype">Palatino</option>
              <option value="Garamond">Garamond</option>
              <option value="Book Antiqua">Book Antiqua</option>
              <option value="Cambria">Cambria</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
              <option value="Verdana">Verdana</option>
              <option value="Trebuchet MS">Trebuchet</option>
              <option value="Courier New">Courier New</option>
            </select>
            <label className="font-picker-label" htmlFor="size-picker">Taille</label>
            <select id="size-picker" className="compact-picker" value={fontSize} onChange={(event) => changePageSetting('fontSize', event.target.value)} disabled={!activeDocument}>
              {[11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <label className="font-picker-label" htmlFor="spacing-picker">Interligne</label>
            <select id="spacing-picker" className="compact-picker" value={lineSpacing} onChange={(event) => changePageSetting('lineSpacing', event.target.value)} disabled={!activeDocument}>
              <option value="1.3">Serré</option><option value="1.5">1,5</option><option value="1.8">Aéré</option><option value="2">Double</option>
            </select>
            <label className="font-picker-label" htmlFor="margin-picker">Marges</label>
            <select id="margin-picker" className="compact-picker" value={pageMargin} onChange={(event) => changePageSetting('pageMargin', event.target.value)} disabled={!activeDocument}>
              <option value="narrow">Étroit</option><option value="comfortable">Normal</option><option value="wide">Large</option>
            </select>
            <label className="font-picker-label" htmlFor="format-picker">Format</label>
            <select id="format-picker" className="compact-picker" value={pageFormat} onChange={(event) => changePageSetting('pageFormat', event.target.value)} disabled={!activeDocument}><option value="A4">A4</option><option value="A5">A5</option><option value="Letter">Lettre</option></select>
            <label className="font-picker-label" htmlFor="orientation-picker">Sens</label>
            <select id="orientation-picker" className="compact-picker" value={orientation} onChange={(event) => changePageSetting('orientation', event.target.value)} disabled={!activeDocument}><option value="portrait">Portrait</option><option value="landscape">Paysage</option></select>
            <label className="font-picker-label" htmlFor="numbers-picker">Pages</label>
            <select id="numbers-picker" className="compact-picker" value={String(pageNumbers)} onChange={(event) => changePageSetting('pageNumbers', event.target.value)} disabled={!activeDocument}><option value="true">Numérotées</option><option value="false">Sans numéro</option></select>
            <button className="icon-button" title="Imprimer le manuscrit" onClick={() => window.print()} disabled={!activeDocument}><Printer size={16}/></button>
            <div className="toolbar-spacer"/>
            {activeDocument && <button className="icon-button danger" title="Supprimer le manuscrit" onClick={deleteDocument}><Trash2 size={16}/></button>}
          </div>
          {activeDocument ? <div className={`page-wrap margin-${pageMargin} format-${pageFormat.toLowerCase()} orientation-${orientation} ${pageNumbers ? 'with-page-numbers' : 'without-page-numbers'}`}>
            <input className="document-title" value={activeDocument.title} onChange={(event) => renameDocument(event.target.value)} aria-label="Titre du manuscrit"/>
            <div className="page-meta">MANUSCRIT <span>·</span> MODIFIÉ {new Date(activeDocument.updatedAt).toLocaleDateString('fr-FR')}</div>
            <EditorContent editor={editor}/>
            <div className="page-footer"><span>Scriptorium</span><span>Écrivez à votre rythme.</span></div>
          </div> : <div className="welcome">
            <div className="welcome-icon"><Feather size={30}/></div>
            <p className="eyebrow">VOTRE ATELIER PERSONNEL</p>
            <h1>Les mots trouvent<br/>leur place ici.</h1>
            <p className="welcome-copy">Un espace calme pour écrire, imaginer et donner forme à vos histoires. Vos textes sont conservés sur votre ordinateur.</p>
            <button className="primary-button" onClick={createDocument}><FilePlus2 size={17}/> Créer un manuscrit</button>
          </div>}
        </section>
      </div>
      <footer className="statusbar"><span><span className="status-dot"/> Bibliothèque locale</span><span>Scriptorium · Version 0.1.0</span></footer>
    </main>
  )
}