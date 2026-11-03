import { useEffect, useMemo, useRef, useState } from 'react'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { checkFrenchSpelling, type LocalSpellingIssue } from './spellcheck'
import { Archive, BookOpen, FilePlus2, Feather, FolderOpen, Search, Trash2, Download, Upload, Bold, Italic, Heading2, List, Quote, PanelLeftClose, PanelLeftOpen, Printer, Library, Users, Lightbulb, ChartNoAxesColumn, Settings, Plus, ChevronRight, BookMarked, X, CalendarDays, GitBranch } from 'lucide-react'

const proofreadKey = new PluginKey('scriptoriumProofread')
const ProofreadDecorations = Extension.create({
  name: 'proofreadDecorations',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: proofreadKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, decorations) {
          const next = tr.getMeta(proofreadKey)
          return next ? next : decorations.map(tr.mapping, tr.doc)
        }
      },
      props: { decorations(state) { return proofreadKey.getState(state) } }
    })]
  }
})

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
  const genealogyDragging = useRef<{ id: string; x: number; y: number } | null>(null)
  const [genealogyOffsets, setGenealogyOffsets] = useState<Record<string, { x: number; y: number }>>({})
  const [genealogySearch, setGenealogySearch] = useState('')
  const [genealogyZoom, setGenealogyZoom] = useState(1)
  const [collapsedGenealogyIds, setCollapsedGenealogyIds] = useState<Set<string>>(new Set())
  const genealogyInnerRef = useRef<HTMLDivElement | null>(null)
  const genealogyCanvasRef = useRef<HTMLDivElement | null>(null)
  const genealogySvgRef = useRef<SVGSVGElement | null>(null)
  const [genealogyDraft, setGenealogyDraft] = useState<{ fromId: string; toId: string; term: string; type: string; description: string } | null>(null)


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
  const [layoutMode, setLayoutMode] = useState('writing')
  const [publisherProfile, setPublisherProfile] = useState('standard')
  const [showWritingTools, setShowWritingTools] = useState(false)
  const [languageToolBusy, setLanguageToolBusy] = useState(false)
  const [languageToolIssues, setLanguageToolIssues] = useState<Array<{ message: string; context: string; offset: number; length: number; replacements: string[]; rule: string }>>([])
  const [languageToolError, setLanguageToolError] = useState('')
  const [autoProofread, setAutoProofread] = useState(false)
  const [languageToolChecked, setLanguageToolChecked] = useState(false)
  const [localSpellingIssues, setLocalSpellingIssues] = useState<LocalSpellingIssue[]>([])
  const [localSpellBusy, setLocalSpellBusy] = useState(false)
  const [localSpellChecked, setLocalSpellChecked] = useState(false)
  const [localAutoProofread, setLocalAutoProofread] = useState(true)
  const localSpellTimer = useRef<number | null>(null)
  const activeProject = workspace?.projects.find(p => p.id === activeProjectId) ?? null
  const projectDocuments = workspace?.documents.filter(d => d.projectId === activeProjectId) ?? []
  const activeDocument = projectDocuments.find(d => d.id === activeDocumentId) ?? null

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Écrire…' }), ProofreadDecorations],
    content: blankContent,
    editorProps: { attributes: { class: 'writing-surface', spellcheck: 'true' } },
    onUpdate: () => {
      setDirty(true)
      if (localAutoProofread) {
        if (localSpellTimer.current !== null) window.clearTimeout(localSpellTimer.current)
        localSpellTimer.current = window.setTimeout(() => { void checkLocally() }, 900)
      }
    }
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
    setLayoutMode((activeDocument as any).layoutMode || 'writing')
    setPublisherProfile((activeDocument as any).publisherProfile || 'standard')
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

  async function checkLocally() {
    if (!editor) return
    setLocalSpellBusy(true)
    try {
      const issues = await checkFrenchSpelling(editor.state.doc)
      setLocalSpellingIssues(issues)
      setLocalSpellChecked(true)
      const decorations = issues.map(issue => Decoration.inline(issue.from, issue.to, { class: 'scriptorium-proofread-error', title: 'Orthographe : ' + issue.word, 'data-proofread-offset': String(issue.from) }))
      editor.view.dispatch(editor.state.tr.setMeta(proofreadKey, DecorationSet.create(editor.state.doc, decorations)))
    } catch (error) {
      window.alert(error instanceof Error ? 'Correcteur local : ' + error.message : 'Le correcteur local n’a pas pu démarrer.')
    } finally { setLocalSpellBusy(false) }
  }

  function applyLocalSuggestion(issue: LocalSpellingIssue, suggestion: string) {
    if (!editor) return
    editor.commands.insertContentAt({ from: issue.from, to: issue.to }, suggestion)
    window.setTimeout(() => { void checkLocally() }, 80)
  }

  useEffect(() => () => { if (localSpellTimer.current !== null) window.clearTimeout(localSpellTimer.current) }, [])
  async function checkWithLanguageTool() {
    if (!editor) return
    const selection = editor.state.selection
    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, '\\n')
    const textToCheck = selectedText.trim() ? selectedText : editor.getText()
    if (!textToCheck.trim()) { window.alert('Écrivez ou sélectionnez un passage avant de lancer la correction.'); return }
    if (textToCheck.length > 20000) { window.alert('LanguageTool accepte ici un maximum de 20 000 caractères. Sélectionnez un passage plus court.'); return }
    const accepted = window.confirm('Envoyer ce passage à LanguageTool pour une vérification orthographique et grammaticale ?\\n\\n' + textToCheck.slice(0, 700) + (textToCheck.length > 700 ? '…' : '') + '\\n\\nLe texte sera transmis au service LanguageTool. Consultez sa politique de confidentialité avant utilisation.');
    if (!accepted) return
    setLanguageToolBusy(true); setLanguageToolError(''); setLanguageToolIssues([])
    try {
      const body = new URLSearchParams({ text: textToCheck, language: 'fr', enabledOnly: 'false' })
      const response = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      if (!response.ok) throw new Error('Le service a répondu avec le code ' + response.status)
      const data = await response.json()
      setLanguageToolIssues((data.matches || []).map((match: any) => ({
        message: match.message,
        context: match.context?.text || '',
        offset: match.offset,
        length: match.length,
        replacements: (match.replacements || []).slice(0, 4).map((item: any) => item.value),
        rule: match.rule?.description || match.rule?.id || 'Suggestion'
      })))
    } catch (error) {
      setLanguageToolError(error instanceof Error ? error.message : 'Vérification impossible. Réessayez plus tard.')
    } finally {
      setLanguageToolBusy(false)
    }
  }
  async function runAutomaticProofread() {
    if (!editor || !autoProofread) return
    const textToCheck = editor.getText()
    if (!textToCheck.trim() || textToCheck.length > 20000) return
    try {
      const body = new URLSearchParams({ text: textToCheck, language: 'fr', enabledOnly: 'false' })
      const response = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      if (!response.ok) throw new Error('LanguageTool indisponible')
      const data = await response.json()
      const matches = (data.matches || []).map((match: any) => ({
        message: match.message, context: match.context?.text || '', offset: match.offset,
        length: match.length, replacements: (match.replacements || []).slice(0, 4).map((item: any) => item.value),
        rule: match.rule?.description || match.rule?.id || 'Suggestion'
      }))
      setLanguageToolIssues(matches)
      setLanguageToolChecked(true)
      const decorations = matches.filter((m: any) => m.length > 0).map((m: any) =>
        Decoration.inline(Math.max(1, m.offset + 1), Math.max(1, m.offset + m.length + 1), {
          class: 'scriptorium-proofread-error',
          title: m.message,
          'data-proofread-offset': String(m.offset)
        }, { inclusiveStart: false, inclusiveEnd: false })
      ).filter((d: any) => d.from < editor.state.doc.content.size && d.to <= editor.state.doc.content.size)
      editor.view.dispatch(editor.state.tr.setMeta(proofreadKey, DecorationSet.create(editor.state.doc, decorations)))
      setLanguageToolError('')
    } catch (error) {
      setLanguageToolError(error instanceof Error ? error.message : 'Vérification automatique impossible.')
    }
  }

  function enableAutomaticProofread() {
    if (autoProofread) { setAutoProofread(false); editor?.view.dispatch(editor.state.tr.setMeta(proofreadKey, DecorationSet.empty)); return }
    const accepted = window.confirm('Activer la correction automatique ? Après activation, le texte du chapitre sera envoyé à LanguageTool après une courte pause de frappe, pour détecter les erreurs. Le texte ne sera jamais modifié automatiquement. Maximum : 20 000 caractères. Confirmez-vous cet envoi automatique ?')
    if (accepted) { setAutoProofread(true); setLanguageToolError('') }
  }

  useEffect(() => {
    if (!editor || !autoProofread) return
    let timer: number | undefined
    let lastRun = 0
    const handleUpdate = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const now = Date.now()
        if (now - lastRun < 7000) return
        lastRun = now
        void runAutomaticProofread()
      }, 1800)
    }
    editor.on('update', handleUpdate)
    return () => { if (timer) window.clearTimeout(timer); editor.off('update', handleUpdate) }
  }, [editor, autoProofread, activeDocumentId])

  async function createProject() {
    if (!workspace) return
    const title = window.prompt('Nom du nouveau projet', 'Nouveau roman')
    if (!title?.trim()) return
    const now = new Date().toISOString()
    const project = { id: newId(), title: title.trim(), summary: '', createdAt: now, updatedAt: now }
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
    if (setting === 'layoutMode') setLayoutMode(value)
    if (setting === 'publisherProfile') setPublisherProfile(value)
    if (setting === 'fontFamily') { setFontFamily(value); if (editor) editor.view.dom.style.fontFamily = value }
    await save({ ...workspace, documents: workspace.documents.map(d => d.id === updated.id ? updated : d) })
  }
  async function applyLayoutMode(mode: string) {
    if (!workspace || !activeDocument || !editor) return
    const patch: Record<string, any> = { layoutMode: mode }
    if (mode === 'submission') {
      patch.fontFamily = 'Times New Roman'; patch.fontSize = 12; patch.lineSpacing = '2'
      patch.pageMargin = 'wide'; patch.pageFormat = 'A4'; patch.orientation = 'portrait'; patch.pageNumbers = true
    } else if (mode === 'novel') {
      patch.fontFamily = 'Garamond'; patch.fontSize = 12; patch.lineSpacing = '1.5'
      patch.pageMargin = 'comfortable'; patch.pageFormat = 'A5'; patch.orientation = 'portrait'; patch.pageNumbers = true
    } else {
      patch.fontFamily = 'Georgia'; patch.fontSize = 15; patch.lineSpacing = '1.8'
      patch.pageMargin = 'comfortable'; patch.pageFormat = 'A4'; patch.orientation = 'portrait'; patch.pageNumbers = false
    }
    const updated = { ...activeDocument, ...patch }
    setFontFamily(updated.fontFamily); setFontSize(updated.fontSize); setLineSpacing(updated.lineSpacing)
    setPageMargin(updated.pageMargin); setPageFormat(updated.pageFormat); setOrientation(updated.orientation); setPageNumbers(updated.pageNumbers)
    editor.view.dom.style.fontFamily = updated.fontFamily
    editor.view.dom.style.fontSize = updated.fontSize + 'px'
    editor.view.dom.style.lineHeight = updated.lineSpacing
    await save({ ...workspace, documents: workspace.documents.map(d => d.id === updated.id ? updated : d) })
  }

  async function prepareProjectForPrint() {
    if (!workspace || !activeProject) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) { window.alert('Autorise les fenêtres contextuelles pour préparer ton manuscrit.'); return }
    const docs = projectDocuments.map(doc => ({
      ...doc,
      content: doc.id === activeDocumentId && editor ? editor.getHTML() : doc.content
    })).filter(doc => doc.content && doc.content.replace(/<[^>]*>/g, '').trim())
    if (docs.length === 0) { printWindow.close(); window.alert('Ce projet ne contient aucun texte à imprimer.'); return }
    const updatedDocs = workspace.documents.map(doc => {
      const current = docs.find(item => item.id === doc.id)
      return current ? { ...doc, content: current.content, layoutMode: 'novel', fontFamily: 'Garamond', fontSize: 12, lineSpacing: '1.5', pageMargin: 'comfortable', pageFormat: 'A5', orientation: 'portrait', pageNumbers: true } : doc
    })
    await window.scriptorium.saveWorkspace({ ...workspace, documents: updatedDocs })
    setWorkspace({ ...workspace, documents: updatedDocs })
    setDirty(false)
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char] || char))
    const chapters = docs.map((doc, index) => `<section class="chapter"><h1>${escapeHtml(doc.title || 'Chapitre ' + (index + 1))}</h1>${doc.content}</section>`).join('')
    const contents = docs.map((doc, index) => `<li>${escapeHtml(doc.title || 'Chapitre ' + (index + 1))}</li>`).join('')
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(activeProject.title)} · prêt à imprimer</title><style>
      @page{size:A5;margin:19mm 17mm 20mm 20mm}
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#211f1b}
      body{font-family:Garamond,"Book Antiqua",serif;font-size:11.5pt;line-height:1.42}
      .title-page{height:165mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always}
      .title-page h1{font-size:28pt;font-weight:normal;letter-spacing:.04em;margin:0 0 16mm}
      .title-page p{font-size:12pt;color:#555}
      .contents{page-break-after:always;padding-top:12mm}.contents h1{text-align:center;font-size:18pt;font-weight:normal;margin-bottom:15mm}
      .contents ol{padding-left:8mm}.contents li{margin:0 0 5mm;font-size:12pt}
      .chapter{page-break-before:always;break-before:page}
      .chapter h1{text-align:center;font-size:18pt;font-weight:normal;line-height:1.3;margin:0 0 18mm;page-break-after:avoid}
      .chapter p{margin:0;text-indent:1.1em;text-align:justify;orphans:2;widows:2}
      .chapter h1+p,.chapter h2+p,.chapter blockquote+p,.chapter ul+p{ text-indent:0 }
      .chapter h2{text-align:center;font-size:14pt;font-weight:normal;margin:12mm 0 7mm;page-break-after:avoid}
      .chapter blockquote{margin:6mm 8mm;font-style:italic}
      .chapter ul,.chapter ol{padding-left:8mm}
      img{max-width:100%;height:auto}
      @media screen{body{max-width:148mm;margin:18px auto;padding:18mm 17mm 20mm 20mm;box-shadow:0 2px 20px #0002}.title-page,.contents,.chapter{min-height:180mm}}
      @media print{.chapter{page-break-before:always;break-before:page}}
    </style></head><body>
      <section class="title-page"><h1>${escapeHtml(activeProject.title)}</h1><p>Manuscrit</p></section>
      <section class="contents"><h1>Sommaire</h1><ol>${contents}</ol></section>
      ${chapters}
      <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),450))<\/script>
    </body></html>`)
    printWindow.document.close()
  }

  async function selectPublisherProfile(profile: string) {
    setPublisherProfile(profile)
    if (!workspace || !activeDocument) return
    const updated = { ...activeDocument, publisherProfile: profile, layoutMode: 'submission' } as any
    await save({ ...workspace, documents: workspace.documents.map(d => d.id === updated.id ? updated : d) })
    setLayoutMode('submission')
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
  async function uploadPortrait(entityId: string, file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { window.alert('Choisissez un fichier image.'); return }
    if (file.size > 15 * 1024 * 1024) { window.alert('Cette image dépasse 15 Mo. Choisissez un fichier plus léger.'); return }
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Lecture impossible'))
        reader.onerror = () => reject(new Error('Lecture impossible'))
        reader.readAsDataURL(file)
      })
      const image: HTMLImageElement = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image illisible'))
        img.src = dataUrl
      })
      const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Traitement image indisponible')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const compressed = canvas.toDataURL('image/jpeg', 0.78)
      await updateEntity(entityId, { portraitUrl: compressed })
    } catch {
      window.alert('Impossible de charger ce portrait. Essayez une autre image.')
    }
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
  async function editTimelineEvent(event: NonNullable<ScriptoriumWorkspace['timelineEvents']>[number]) {
    if (!workspace) return
    const title = window.prompt('Titre de l’événement', event.title)
    if (title === null || !title.trim()) return
    const date = window.prompt('Date ou repère chronologique', event.date)
    if (date === null || !date.trim()) return
    const period = window.prompt('Période', event.period || '') ?? ''
    const category = window.prompt('Catégorie thématique', event.category || 'Histoire') ?? event.category
    const description = window.prompt('Description', event.description || '') ?? ''
    const colors = ['Ocre', 'Bleu nuit', 'Vert sauge', 'Bordeaux', 'Violet']
    const color = window.prompt('Couleur : 1 Ocre, 2 Bleu nuit, 3 Vert sauge, 4 Bordeaux, 5 Violet', String(Math.max(1, colors.indexOf(event.color || 'Ocre') + 1)))
    const palette = ['#a77b4c', '#53677d', '#71836a', '#925d61', '#78688c']
    const updated = { ...event, title: title.trim(), date: date.trim(), period, category, description, color: color === null ? event.color : palette[Number(color) - 1] || event.color || palette[0] }
    await save({ ...workspace, timelineEvents: (workspace.timelineEvents || []).map(item => item.id === event.id ? updated : item) })
  }
  async function deleteTimelineEvent(eventId: string) {
    if (!workspace || !window.confirm('Supprimer cet événement de la frise ?')) return
    await save({ ...workspace, timelineEvents: (workspace.timelineEvents || []).filter(e => e.id !== eventId) })
  }
  function addGenealogyLink() {
    if (!activeProject) return
    const people = entities.filter(e => e.type === 'Personnage')
    if (people.length < 2) { window.alert('Créez au moins deux fiches de personnages pour établir une généalogie.'); return }
    setGenealogyDraft({ fromId: people[0].id, toId: people[1].id, term: '', type: '', description: '' })
  }
  async function confirmGenealogyLink(typeOverride?: string) {
    if (!workspace || !activeProject || !genealogyDraft) return
    const type = typeOverride || genealogyDraft.type
    if (!type.trim() || genealogyDraft.fromId === genealogyDraft.toId) return
    await save({ ...workspace, genealogyLinks: [...(workspace.genealogyLinks || []), { id: newId(), projectId: activeProject.id, fromEntityId: genealogyDraft.fromId, toEntityId: genealogyDraft.toId, type, description: genealogyDraft.description }] })
    setGenealogyDraft(null)
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

  useEffect(() => {
    if (view !== 'genealogy' || !workspace || !activeProjectId) return
    const canvas = genealogyCanvasRef.current
    const layer = genealogyInnerRef.current
    const svg = genealogySvgRef.current
    if (!canvas || !layer || !svg) return
    const people = workspace.entities.filter(e => e.projectId === activeProjectId && e.type === 'Personnage')
    const links = (workspace.genealogyLinks || []).filter(link => link.projectId === activeProjectId)
    const edges = links.map(link => {
      const type = link.type.toLocaleLowerCase('fr').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      let kind = 'custom'
      if (type.includes('adopt')) kind = 'adoptive'
      else if (type.includes('demi-frere') || type.includes('demi-frere') || type.includes('demi-soeur')) kind = 'half-sibling'
      else if (type.includes('frere') || type.includes('soeur')) kind = 'sibling'
      else if (type.includes('union') || type.includes('conjoint') || type.includes('epoux') || type.includes('epouse') || type.includes('partenaire') || type.includes('mari')) kind = 'union'
      else if (type.includes('oncle') || type.includes('tante') || type.includes('neveu') || type.includes('niece') || type.includes('cousin')) kind = 'extended'
      else if (type.includes('beau-parent') || type.includes('beau parent') || type.includes('beau-pere') || type.includes('belle mere')) kind = 'step'
      else if (type.includes('parent') || type.includes('enfant') || type.includes('grand-')) kind = 'biological'
      return { link, kind, parental: ['parent de','enfant de','grand-père de','grand-mère de','arrière-grand-père de','arrière-grand-mère de','adoptant de','enfant adopté de'].includes(link.type.toLocaleLowerCase('fr')) }
    }).filter(edge => people.some(p => p.id === edge.link.fromEntityId) && people.some(p => p.id === edge.link.toEntityId))
    const draw = () => {
      const zoom = Math.max(0.01, genealogyZoom)
      const width = Math.max(layer.scrollWidth, layer.clientWidth)
      const height = Math.max(layer.scrollHeight, layer.clientHeight)
      svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height)); svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      const bounds = layer.getBoundingClientRect()
      const nodes = new Map<string, DOMRect>()
      canvas.querySelectorAll<HTMLElement>('.genealogy-node[data-person-id]').forEach(node => {
        if (node.dataset.personId) {
          const rect = node.getBoundingClientRect()
          nodes.set(node.dataset.personId, new DOMRect(
            (rect.left - bounds.left) / zoom,
            (rect.top - bounds.top) / zoom,
            rect.width / zoom,
            rect.height / zoom
          ))
        }
      })
      const ns = 'http://www.w3.org/2000/svg'
      const paths = edges.flatMap(edge => {
        const from = nodes.get(edge.link.fromEntityId), to = nodes.get(edge.link.toEntityId)
        if (!from || !to) return []
        const fromIsChild = ['enfant de','enfant adopté de'].includes(edge.link.type.toLocaleLowerCase('fr'))
        const vertical = edge.parental
        const x1 = vertical ? from.left + from.width / 2 : (fromIsChild ? from.left : from.right)
        const y1 = vertical ? (fromIsChild ? from.top : from.bottom) : from.top + from.height / 2
        const x2 = vertical ? to.left + to.width / 2 : (fromIsChild ? to.right : to.left)
        const y2 = vertical ? (fromIsChild ? to.bottom : to.top) : to.top + to.height / 2
        const ns = 'http://www.w3.org/2000/svg'
        const path = document.createElementNS(ns, 'path')
        if (vertical) {
          const mid = y1 + (y2 - y1) / 2
          path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`)
        } else {
          const mid = x1 + (x2 - x1) / 2
          path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`)
        }
        path.setAttribute('class', `relation-${edge.kind}`)
        path.setAttribute('data-relation', edge.link.type)
        path.setAttribute('aria-label', edge.link.type)
        return [path]
      })
      svg.replaceChildren(...paths)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    canvas.querySelectorAll('.genealogy-node').forEach(node => observer.observe(node))
    window.addEventListener('resize', draw); canvas.addEventListener('scroll', draw)
    return () => { observer.disconnect(); window.removeEventListener('resize', draw); canvas.removeEventListener('scroll', draw) }
  }, [view, activeProjectId, workspace, genealogyOffsets, genealogyZoom])

  if (!workspace) return <main className="loading-screen"><Feather size={28}/><span>Chargement…</span></main>
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
  const writingText = editor?.getText() || ''
  const writingWords = writingText.match(/[\p{L}\p{N}’'-]+/gu) || []
  const writingParagraphs = writingText.split(/\n+/).filter(line => line.trim().length > 0).length
  const writingReadingMinutes = Math.max(1, Math.ceil(writingWords.length / 220))
  const writingRepeatedWords = Object.entries(writingWords.reduce((counts, word) => {
    const normalized = word.toLocaleLowerCase('fr').replace(/[’'-]/g, '')
    if (normalized.length >= 5 && !['alors','après','avait','avoir','autres','aussi','avec','cela','cette','comme','contre','dans','depuis','donc','elle','elles','encore','entre','était','être','faire','leurs','mais','même','moins','notre','parce','peut','plus','pour','quand','quelque','sans','serait','sous','toute','toutes','très','votre'].includes(normalized)) counts[normalized] = (counts[normalized] || 0) + 1
    return counts
  }, {} as Record<string, number>)).filter(([, count]) => count >= 4).sort((a,b) => b[1]-a[1]).slice(0,8)
  const genealogyLinks = (workspace.genealogyLinks || []).filter(link => link.projectId === activeProjectId)
  const genealogyPeople = entities.filter(entity => entity.type === 'Personnage')

  const parentEdges = genealogyLinks.flatMap(link => {
    const type = link.type.toLocaleLowerCase('fr')
    if (['parent de','adoptant de','grand-père de','grand-mère de','arrière-grand-père de','arrière-grand-mère de','ancêtre de'].includes(type)) return [{ parent: link.fromEntityId, child: link.toEntityId, link }]
    if (['enfant de','enfant adopté de','petit-fils de','petite-fille de','arrière-petit-fils de','arrière-petite-fille de','descendant de'].includes(type)) return [{ parent: link.toEntityId, child: link.fromEntityId, link }]
    return []
  }).filter(edge => genealogyPeople.some(p => p.id === edge.parent) && genealogyPeople.some(p => p.id === edge.child))
  const generationById: Record<string, number> = {}
  const isInParentCycle = (startId: string): boolean => {
    const visit = (id: string, visited: Set<string>): boolean => {
      for (const edge of parentEdges.filter(item => item.parent === id)) {
        if (edge.child === startId) return true
        if (!visited.has(edge.child)) {
          const next = new Set(visited)
          next.add(edge.child)
          if (visit(edge.child, next)) return true
        }
      }
      return false
    }
    return visit(startId, new Set([startId]))
  }
  const cyclicPeople = new Set(genealogyPeople.filter(person => isInParentCycle(person.id)).map(person => person.id))
  const getGeneration = (id: string, trail: Set<string> = new Set()): number => {
    if (generationById[id] !== undefined) return generationById[id]
    if (cyclicPeople.has(id)) { generationById[id] = 0; return 0 }
    if (trail.has(id)) return 0
    const nextTrail = new Set(trail)
    nextTrail.add(id)
    const parents = parentEdges.filter(edge => edge.child === id)
    const level = parents.length ? Math.min(8, Math.max(...parents.map(edge => getGeneration(edge.parent, nextTrail) + (/arrière-grand/.test(edge.link.type.toLocaleLowerCase('fr')) ? 3 : /grand-/.test(edge.link.type.toLocaleLowerCase('fr')) ? 2 : 1)))) : 0
    generationById[id] = level
    return level
  }
  genealogyPeople.forEach(person => getGeneration(person.id))
  const maxGeneration = Math.max(0, ...Object.values(generationById))
  const hiddenGenealogyIds = new Set<string>()
  const hideDescendants = (id: string, visited = new Set<string>()) => {
    if (visited.has(id)) return
    visited.add(id)
    parentEdges.filter(edge => edge.parent === id).forEach(edge => {
      hiddenGenealogyIds.add(edge.child)
      hideDescendants(edge.child, visited)
    })
  }
  collapsedGenealogyIds.forEach(id => hideDescendants(id))
  const visibleGenealogyPeople = genealogyPeople.filter(person => !hiddenGenealogyIds.has(person.id))
  const genealogyGenerations = Array.from({ length: maxGeneration + 1 }, (_, level) => visibleGenealogyPeople.filter(person => generationById[person.id] === level))
  function moveGenealogyPerson(id: string, event: React.PointerEvent<HTMLElement>) {
    const drag = genealogyDragging.current
    if (!drag || drag.id !== id) return
    const dx = (event.clientX - drag.x) / genealogyZoom
    const dy = (event.clientY - drag.y) / genealogyZoom
    drag.x = event.clientX
    drag.y = event.clientY
    setGenealogyOffsets(current => ({ ...current, [id]: { x: (current[id]?.x || 0) + dx, y: (current[id]?.y || 0) + dy } }))
  }
  async function resetGenealogyLayout() {
    if (!workspace) return
    const positions = { ...(workspace.genealogyPositions || {}) }
    genealogyPeople.forEach(person => { delete positions[person.id] })
    setGenealogyOffsets({})
    await save({ ...workspace, genealogyPositions: positions })
  }
  async function finishGenealogyPerson(id: string) {
    if (!workspace) return
    genealogyDragging.current = null
    const offset = genealogyOffsets[id]
    if (offset) await save({ ...workspace, genealogyPositions: { ...(workspace.genealogyPositions || {}), [id]: offset } })
  }
  const otherGenealogyLinks = genealogyLinks.filter(link => !['parent de','enfant de','adoptant de','enfant adopté de','grand-père de','grand-mère de','arrière-grand-père de','arrière-grand-mère de','petit-fils de','petite-fille de','arrière-petit-fils de','arrière-petite-fille de','ancêtre de','descendant de'].includes(link.type.toLocaleLowerCase('fr')))
  const nav = [{ id: 'projects', label: 'Mes projets', icon: <Library size={16}/> }, { id: 'manuscripts', label: moduleLabels.manuscripts, icon: <BookOpen size={16}/>, module: 'manuscripts' }, { id: 'encyclopedia', label: moduleLabels.encyclopedia, icon: <Users size={16}/>, module: 'encyclopedia' }, { id: 'notes', label: moduleLabels.notes, icon: <Lightbulb size={16}/>, module: 'notes' }, { id: 'progress', label: moduleLabels.progress, icon: <ChartNoAxesColumn size={16}/>, module: 'progress' }, { id: 'timeline', label: 'Frise chronologique', icon: <CalendarDays size={16}/> }, { id: 'genealogy', label: 'Arbre généalogique', icon: <GitBranch size={16}/> }]

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Feather size={19}/></div><span>scriptorium</span></div>
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
          {view === 'manuscripts' && activeDocument && <><button className="icon-button" title="Gras" onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={17}/></button><button className="icon-button" title="Italique" onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={17}/></button><button className="icon-button" title="Titre" onClick={() => editor?.chain().focus().toggleHeading({level:2}).run()}><Heading2 size={17}/></button><button className="icon-button" title="Liste" onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={17}/></button><button className="icon-button" title="Citation" onClick={() => editor?.chain().focus().toggleBlockquote().run()}><Quote size={17}/></button><button className={showWritingTools ? "icon-button active" : "icon-button"} title="Outils d’écriture" onClick={() => setShowWritingTools(value => !value)}><ChartNoAxesColumn size={17}/></button><div className="toolbar-divider"/>
            <select className="compact-picker layout-mode-picker" aria-label="Mode de mise en page" value={layoutMode} onChange={e => applyLayoutMode(e.target.value)}><option value="writing">Écriture</option><option value="submission">Soumission éditeur</option><option value="novel">Rendu roman</option></select>
            {layoutMode === 'submission' && <select className="compact-picker publisher-picker" aria-label="Profil éditeur" value={publisherProfile} onChange={e => selectPublisherProfile(e.target.value)}><option value="standard">Standard personnalisable</option><option value="saxus">Saxus</option><option value="bragelonne">Bragelonne</option><option value="calix">Calix</option></select>}
            <select className="font-picker" value={fontFamily} onChange={e => changeSetting('fontFamily', e.target.value)}><option>Georgia</option><option>Palatino Linotype</option><option>Garamond</option><option>Book Antiqua</option><option>Cambria</option><option>Times New Roman</option><option>Arial</option><option>Calibri</option><option>Verdana</option><option>Trebuchet MS</option><option>Courier New</option></select>
            <select className="compact-picker" value={fontSize} onChange={e => changeSetting('fontSize', e.target.value)}>{[11,12,13,14,15,16,18,20,22,24,28,32].map(s => <option key={s}>{s}</option>)}</select>
            <select className="compact-picker" value={lineSpacing} onChange={e => changeSetting('lineSpacing', e.target.value)}><option value="1.3">Serré</option><option value="1.5">1,5</option><option value="1.8">Aéré</option><option value="2">Double</option></select>
            <select className="compact-picker" value={pageMargin} onChange={e => changeSetting('pageMargin', e.target.value)}><option value="narrow">Étroit</option><option value="comfortable">Normal</option><option value="wide">Large</option></select>
            <select className="compact-picker" value={pageFormat} onChange={e => changeSetting('pageFormat', e.target.value)}><option>A4</option><option>A5</option><option>Letter</option></select>
            <select className="compact-picker" value={orientation} onChange={e => changeSetting('orientation', e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Paysage</option></select>
            <select className="compact-picker" value={String(pageNumbers)} onChange={e => changeSetting('pageNumbers', e.target.value)}><option value="true">Numéros oui</option><option value="false">Numéros non</option></select><button className="primary-button print-project-button" title="Assembler et préparer tous les chapitres du projet" onClick={prepareProjectForPrint}><Printer size={15}/> Préparer pour impression</button><button className="icon-button" title="Imprimer le chapitre actuel" onClick={() => window.print()}><Printer size={16}/></button><div className="toolbar-spacer"/><button className="icon-button danger" title="Supprimer le chapitre" onClick={deleteDocument}><Trash2 size={16}/></button></>}
        </div>
        {view === 'projects' && <div className="content-scroll"><div className="welcome-panel"><h1>{activeProject?.title || 'Vos projets littéraires'}</h1></div>
          {activeProject && <div className="project-summary-card"><label>PRÉSENTATION DU PROJET</label><input className="project-title-input" value={activeProject.title} onChange={e => updateProject('title', e.target.value)}/><textarea value={activeProject.summary} onChange={e => updateProject('summary', e.target.value)} placeholder="Résumé, intention, ambiance de votre œuvre…"/><div className="project-stats"><span><BookOpen size={15}/> {projectDocuments.length} chapitre(s)</span><span><Users size={15}/> {entities.length} fiche(s)</span><span><Lightbulb size={15}/> {notes.length} idée(s)</span><span><BookMarked size={15}/> {wordCount.toLocaleString('fr-FR')} mots</span></div></div>}
          <div className="section-heading"><div><h2>Projets littéraires</h2></div><button className="primary-button" onClick={createProject}><Plus size={16}/> Nouveau projet</button></div>
          <div className="project-grid">{workspace.projects.map(p => <button key={p.id} className={p.id === activeProjectId ? 'project-card selected' : 'project-card'} onClick={() => {setActiveProjectId(p.id);setActiveDocumentId(null)}}><div className="project-card-icon"><Feather size={19}/></div><strong>{p.title}</strong><span>{p.summary || 'Projet sans résumé'}</span><small>{workspace.documents.filter(d => d.projectId === p.id).length} chapitre(s)</small></button>)}</div>
        </div>}
        {view === 'manuscripts' && <>{activeDocument ? <div className={`page-wrap layout-${layoutMode} margin-${pageMargin} format-${pageFormat.toLowerCase()} orientation-${orientation} ${pageNumbers ? 'with-page-numbers' : 'without-page-numbers'}`}><input className="document-title" value={activeDocument.title} onChange={e => renameDocument(e.target.value)} aria-label="Titre du chapitre"/><div className="page-meta">{activeProject?.title.toUpperCase()} <span>·</span> MODIFIÉ {new Date(activeDocument.updatedAt).toLocaleDateString('fr-FR')}</div><EditorContent editor={editor}/>{localSpellChecked && <section aria-live="polite" style={{ margin: '14px 0', padding: '14px 16px', border: '1px solid var(--line, #ddd4c7)', borderRadius: '10px', background: 'var(--surface, #faf7f0)' }}><h3 style={{ fontSize: '16px', margin: '0 0 8px' }}>Suggestions orthographiques · {localSpellingIssues.length}</h3>{localSpellingIssues.length === 0 ? <p style={{ margin: 0, fontSize: '13px' }}>Aucune faute d’orthographe repérée.</p> : localSpellingIssues.map((issue, index) => <div key={index} style={{ padding: '10px 0', borderTop: '1px solid var(--line, #ddd4c7)' }}><div style={{ fontSize: '13px' }}>Remplacer <strong style={{ color: '#a44747' }}>{issue.word}</strong> par :</div>{issue.suggestions.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '8px' }}>{issue.suggestions.map(suggestion => <button key={suggestion} className="secondary-button" style={{ padding: '7px 11px', fontSize: '13px' }} onClick={() => applyLocalSuggestion(issue, suggestion)}>{suggestion}</button>)}</div> : <small style={{ display: 'block', marginTop: '5px', opacity: .65 }}>Aucune proposition disponible pour ce mot.</small>}</div>)}</section>}{showWritingTools && <section style={{ margin: '22px 0', padding: '18px', border: '1px solid var(--line, #ddd4c7)', borderRadius: '12px', background: 'var(--surface, #faf7f0)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}><div><strong style={{ fontFamily: 'Georgia, serif', fontSize: '18px' }}>Bureau d’analyse</strong><p style={{ margin: '4px 0 12px', opacity: .7, fontSize: '13px' }}>Un aperçu de ton passage, sans modifier ton texte.</p></div><button className="text-action" onClick={() => setShowWritingTools(false)}>Fermer</button></div><div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>{[['Mots', writingWords.length],['Caractères', writingText.length],['Paragraphes', writingParagraphs],['Lecture', writingReadingMinutes + ' min']].map(([label,value]) => <div key={String(label)} style={{ padding: '10px 13px', borderRadius: '8px', background: 'rgba(150,120,85,.10)', minWidth: '90px' }}><small style={{ display: 'block', opacity: .65 }}>{label}</small><strong>{value}</strong></div>)}</div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '12px 0' }}><button className="primary-button" onClick={checkLocally} disabled={localSpellBusy}>{localSpellBusy ? 'Analyse locale…' : 'Détecter les fautes (local)'}</button><button className="secondary-button" onClick={() => setLocalAutoProofread(v => !v)}>{localAutoProofread ? 'Désactiver la détection locale auto' : 'Activer la détection locale auto'}</button><button className="primary-button" onClick={checkWithLanguageTool} disabled={languageToolBusy}>{languageToolBusy ? 'Vérification…' : 'Corriger avec LanguageTool'}</button><button className="secondary-button" onClick={enableAutomaticProofread}>{autoProofread ? 'Désactiver la correction automatique' : 'Activer la correction automatique'}</button><span style={{ alignSelf: 'center', fontSize: '12px', opacity: .65 }}>{localAutoProofread ? 'Détection locale active · analyse après la frappe' : 'Détection locale désactivée'} · {autoProofread ? 'LanguageTool automatique actif' : 'LanguageTool uniquement sur demande'}</span></div>{languageToolError && <p role="alert" style={{ color: '#9b4545', fontSize: '13px' }}>{languageToolError}</p>}{languageToolIssues.length > 0 && <div style={{ margin: '12px 0', padding: '12px', borderRadius: '8px', background: 'rgba(150,120,85,.08)' }}><h3 style={{ fontSize: '15px', margin: '0 0 8px' }}>{languageToolIssues.length} suggestion(s) de correction</h3>{languageToolIssues.map((issue, index) => <div key={index} style={{ padding: '9px 0', borderTop: '1px solid var(--line, #ddd4c7)' }}><strong style={{ fontSize: '13px' }}>{issue.message}</strong><p style={{ margin: '4px 0', fontSize: '12px', opacity: .7 }}>{issue.context}</p>{issue.replacements.length > 0 && <p style={{ margin: 0, fontSize: '13px' }}>Suggestions : {issue.replacements.join(' · ')}</p>}<small style={{ opacity: .55 }}>{issue.rule}</small></div>)}</div>}{languageToolChecked && languageToolIssues.length === 0 && !languageToolError && <p style={{ color: '#47724e', fontSize: '13px' }}>Aucune erreur détectée dans le dernier contrôle.</p>}<p style={{ margin: '8px 0', fontSize: '11px', opacity: .55 }}>Correction fournie par <a href="https://languagetool.org/fr" target="_blank" rel="noreferrer">LanguageTool</a>. Les suggestions ne modifient jamais automatiquement ton manuscrit. Voir la <a href="https://languagetool.org/legal/privacy" target="_blank" rel="noreferrer">politique de confidentialité</a>.</p><h3 style={{ fontSize: '15px', margin: '10px 0 6px' }}>Mots qui reviennent souvent</h3>{writingRepeatedWords.length ? <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.8 }}>{writingRepeatedWords.map(([word,count]) => <span key={word} style={{ display: 'inline-block', margin: '0 7px 5px 0', padding: '3px 8px', borderRadius: '20px', background: 'rgba(150,120,85,.12)' }}>{word} · {count}</span>)}</p> : <p style={{ margin: 0, opacity: .7, fontSize: '13px' }}>Aucune répétition marquée détectée (seuil : 4 occurrences).</p>}<p style={{ margin: '12px 0 0', opacity: .6, fontSize: '12px' }}>La détection est indicative : les répétitions peuvent être volontaires et utiles au rythme.</p></section>}<div className="page-footer"><span>Scriptorium</span></div></div> : <div className="empty-module"><BookOpen size={32}/><h2>Le manuscrit attend ses mots.</h2><p>Créez un premier chapitre pour commencer à écrire.</p><button className="primary-button" onClick={createChapter}><FilePlus2 size={16}/> Créer un chapitre</button></div>}</>}
        {view === 'encyclopedia' && <div className="content-scroll">
          {!activeEntity ? <>
            <div className="module-heading"><h1>Encyclopédie de votre univers</h1><div className="character-list-actions"><button className="primary-button" onClick={createEntity}><Plus size={16}/> Nouvelle fiche</button><button className="secondary-button" onClick={() => setShowRelationshipMap(v => !v)}>{showRelationshipMap ? 'Afficher les fiches' : 'Voir la carte de l’univers'}</button></div></div>
            {showRelationshipMap ? <section className="relationship-map-section"><div className="relationship-map-heading"><div><h2>Carte des relations</h2><p>Faites glisser les fiches de votre univers pour organiser leurs liens. Leurs positions sont sauvegardées automatiquement.</p></div><div className="relationship-map-tools"><span>{entities.length} personnage(s) · {(workspace.relations || []).filter(r => r.projectId === activeProjectId).length} lien(s)</span><button className="secondary-button map-reset-button" onClick={resetRelationshipMap}>Réinitialiser la disposition</button></div></div>
              {entities.length === 0 ? <p className="empty-hint">Ajoutez des personnages pour construire votre carte.</p> : <div className="relationship-map"><svg className="relationship-lines" viewBox="0 0 800 560" role="img" aria-label="Liens entre les personnages">{(workspace.relations || []).filter(r => r.projectId === activeProjectId).map(r => { const a = graphPosition(r.fromEntityId); const b = graphPosition(r.toEntityId); return a && b ? <g key={r.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-7}>{r.fromLabel}</text></g> : null })}</svg>{graphPositions.map((p,index) => <button key={p.id} className="relationship-node" style={{left:(p.x/800*100)+'%',top:(p.y/560*100)+'%'}} onPointerDown={event => { event.preventDefault(); draggingEntityId.current = p.id; didDrag.current = false; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => moveGraphNode(p.id,event)} onPointerUp={() => finishGraphNode(p.id)} onPointerCancel={() => finishGraphNode(p.id)} onClick={() => { if (didDrag.current) return; setActiveEntityId(p.id); setShowRelationshipMap(false) }} title="Faire glisser pour déplacer"><span className="relationship-node-mark">{p.name.trim().charAt(0).toLocaleUpperCase('fr')}</span><strong>{p.name || 'Sans nom'}</strong><small>{entities[index]?.type || 'Élément'}{entities[index]?.role ? ' · ' + entities[index].role : ''}</small></button>)}</div>}
              <div className="relationship-legend"><span><i/> Personnage</span><span><i/> Relation</span><span className="map-drag-hint">↔ Déplacement à la souris ou au doigt</span></div>
            </section> : <div className="entity-grid">{entities.map(e => <article className="info-card" key={e.id}><span className="card-kicker">{e.type}</span><h3>{e.name}</h3><p>{e.role || e.description || 'Fiche à compléter.'}</p><button className="text-action" onClick={() => setActiveEntityId(e.id)}>Ouvrir la fiche <ChevronRight size={13}/></button></article>)}{entities.length === 0 && <p className="empty-hint">Aucun personnage pour le moment. Créez votre première fiche.</p>}</div>}
          </> : <>
            <div className="module-heading"><button className="text-action" onClick={() => setActiveEntityId(null)}>← Retour aux personnages</button><span className="eyebrow">FICHE · {activeEntity.type.toLocaleUpperCase('fr')}</span><input className="character-name-input" value={activeEntity.name} onChange={e => updateEntity(activeEntity.id,{name:e.target.value})} aria-label="Nom du personnage"/><p>Les champs sont facultatifs. Complétez uniquement ce qui vous est utile.</p></div>
            <div className="character-panel">
              <h2>Portrait & repères de vie</h2><div className="character-form-grid">
                <div className="wide-field portrait-upload-field">
                  <label>Importer un portrait depuis l’appareil<input type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; void uploadPortrait(activeEntity.id, file); e.currentTarget.value = '' }}/></label>
                  {activeEntity.portraitUrl && <div className="portrait-upload-preview"><img src={activeEntity.portraitUrl} alt={`Portrait de ${activeEntity.name}`}/><button type="button" className="text-action" onClick={() => updateEntity(activeEntity.id,{portraitUrl:''})}>Retirer le portrait</button></div>}
                  <label>Ou utiliser une URL d’image<input value={activeEntity.portraitUrl?.startsWith('data:') ? '' : activeEntity.portraitUrl || ''} onChange={e => updateEntity(activeEntity.id,{portraitUrl:e.target.value})} placeholder="https://…"/></label>
                </div>
                <label>Naissance<input value={activeEntity.birthDate || ''} onChange={e => updateEntity(activeEntity.id,{birthDate:e.target.value})} placeholder="Date ou année (calendrier libre)"/></label>
                <label>Décès<input value={activeEntity.deathDate || ''} onChange={e => updateEntity(activeEntity.id,{deathDate:e.target.value})} placeholder="Date, année ou vivant·e"/></label>
              </div>
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
        {view === 'timeline' && <div className="content-scroll"><div className="module-heading"><h1>Frise chronologique</h1><button className="primary-button" onClick={createTimelineEvent}><Plus size={16}/> Ajouter un événement</button></div><div className="timeline-track">{(workspace.timelineEvents || []).filter(e => e.projectId === activeProjectId).slice().sort((a,b) => a.date.localeCompare(b.date, 'fr', { numeric: true })).map(event => <article className="timeline-event" key={event.id}><div className="timeline-marker"/><div className="timeline-event-card" style={{ borderLeft: '4px solid ' + (event.color || '#a77b4c') }}><span className="card-kicker">{event.category} · {event.period || 'Chronologie'}</span><h3>{event.title}</h3><strong>{event.date}</strong>{event.description && <p>{event.description}</p>}<div className="timeline-card-actions"><button className="text-action" onClick={() => editTimelineEvent(event)}>Modifier</button><button className="text-action" onClick={() => deleteTimelineEvent(event.id)}>Supprimer</button></div></div></article>)}{!(workspace.timelineEvents || []).some(e => e.projectId === activeProjectId) && <p className="empty-hint">Votre chronologie est encore vierge. Ajoutez le premier événement fondateur.</p>}</div></div>}
        {view === 'genealogy' && <div className="content-scroll"><div className="module-heading"><h1>Arbre généalogique</h1><p className="genealogy-hint">Les liens sont indépendants : unions entre apparentés, filiations multiples et lignées qui se croisent sont autorisées. Un personnage peut appartenir à plusieurs branches.</p><div className="genealogy-actions"><button className="primary-button" onClick={addGenealogyLink}><Plus size={16}/> Ajouter un lien familial</button><button className="secondary-button" onClick={resetGenealogyLayout}>Réinitialiser la disposition</button></div><p className="genealogy-hint">Déplacez les fiches au doigt ou à la souris. Leur position est enregistrée automatiquement.</p><div className="genealogy-legend" aria-label="Légende des liens"><span><i className="relation-sample biological"/>Filiation</span><span><i className="relation-sample adoptive"/>Adoption</span><span><i className="relation-sample sibling"/>Fratrie</span><span><i className="relation-sample half-sibling"/>Demi-fratrie</span><span><i className="relation-sample union"/>Union</span><span><i className="relation-sample extended"/>Famille élargie</span><span><i className="relation-sample step"/>Belle-famille</span><span><i className="relation-sample custom"/>Autre lien</span></div><div className="genealogy-tools"><label className="genealogy-search"><Search size={16}/><input value={genealogySearch} onChange={event => setGenealogySearch(event.target.value)} placeholder="Retrouver un personnage…" aria-label="Rechercher un personnage dans l’arbre"/>{genealogySearch && <button type="button" onClick={() => setGenealogySearch('')} aria-label="Effacer la recherche"><X size={15}/></button>}</label><span className="genealogy-search-count">{genealogySearch.trim() ? genealogyPeople.filter(person => person.name.toLocaleLowerCase('fr').includes(genealogySearch.toLocaleLowerCase('fr')) || (person.role || '').toLocaleLowerCase('fr').includes(genealogySearch.toLocaleLowerCase('fr'))).length + ' résultat(s)' : genealogyPeople.length + ' personnage(s)'}</span><div className="genealogy-zoom-tools"><button type="button" onClick={() => setGenealogyZoom(value => Math.max(.2, Math.round((value - .1) * 100) / 100))} aria-label="Dézoomer">−</button><input aria-label="Niveau de zoom" type="range" min="0.2" max="2.5" step="0.05" value={genealogyZoom} onChange={event => setGenealogyZoom(Number(event.target.value))}/><button type="button" onClick={() => setGenealogyZoom(value => Math.min(2.5, Math.round((value + .1) * 100) / 100))} aria-label="Zoomer">+</button><span>{Math.round(genealogyZoom*100)} %</span><button type="button" onClick={() => { const canvas=genealogyCanvasRef.current; const inner=genealogyInnerRef.current; if(canvas && inner){ const fit=Math.min((canvas.clientWidth-32)/inner.scrollWidth,(canvas.clientHeight-32)/inner.scrollHeight,1); setGenealogyZoom(Math.max(.2,Math.min(2.5,fit))); canvas.scrollTo({left:0,top:0,behavior:"smooth"}); } }}>Tout voir</button><button type="button" onClick={() => setCollapsedGenealogyIds(new Set())} disabled={collapsedGenealogyIds.size===0}>Tout déplier</button></div></div></div>{genealogyPeople.length === 0 ? <p className="empty-hint">Créez des fiches Personnage dans l’encyclopédie pour commencer votre arbre.</p> : <div className="genealogy-canvas" ref={genealogyCanvasRef}><div className="genealogy-zoom-layer" ref={genealogyInnerRef} style={{ width: `${100/genealogyZoom}%`, minHeight: `${100/genealogyZoom}%`, transform: `scale(${genealogyZoom})` }}><svg ref={genealogySvgRef} className="genealogy-connectors" aria-hidden="true"/>{genealogyGenerations.map((generation, level) => <section className="genealogy-generation" key={level}><div className="genealogy-generation-label"><span>GÉNÉRATION {level + 1}</span><i/></div><div className="genealogy-generation-people">{generation.map(person => <article className={`genealogy-node ${genealogySearch.trim() ? ((person.name + ' ' + (person.role || '')).toLocaleLowerCase('fr').includes(genealogySearch.toLocaleLowerCase('fr')) ? 'is-match' : 'is-dimmed') : ''}`} data-person-id={person.id} key={person.id} style={{ transform: `translate(${genealogyOffsets[person.id]?.x ?? workspace.genealogyPositions?.[person.id]?.x ?? 0}px, ${genealogyOffsets[person.id]?.y ?? workspace.genealogyPositions?.[person.id]?.y ?? 0}px)` }} onPointerDown={event => { if ((event.target as HTMLElement).closest('button')) return; event.preventDefault(); genealogyDragging.current = { id: person.id, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={event => moveGenealogyPerson(person.id, event)} onPointerUp={() => finishGenealogyPerson(person.id)} onPointerCancel={() => finishGenealogyPerson(person.id)} title="Faire glisser pour déplacer ce personnage">{person.portraitUrl ? <img className="genealogy-node-portrait" src={person.portraitUrl} alt={`Portrait de ${person.name}`} loading="lazy"/> : <span className="genealogy-node-flourish">✦</span>}<strong>{person.name}</strong><small>{person.role || 'Personnage'}</small>{(person.birthDate || person.deathDate) && <small className="genealogy-node-dates">{person.birthDate || '?'} – {person.deathDate || 'Vivant·e'}</small>}<div className="genealogy-node-links">{parentEdges.filter(edge => edge.child === person.id || edge.parent === person.id).map(edge => <span key={edge.link.id}>{edge.parent === person.id ? 'Parent de' : 'Enfant de'} {genealogyPeople.find(p => p.id === (edge.parent === person.id ? edge.child : edge.parent))?.name}</span>)}</div><div className="genealogy-node-actions">{parentEdges.some(edge => edge.parent === person.id) && <button type="button" onClick={() => setCollapsedGenealogyIds(current => { const next = new Set(current); if (next.has(person.id)) next.delete(person.id); else next.add(person.id); return next })}>{collapsedGenealogyIds.has(person.id) ? '＋ Déplier' : '− Replier'}</button>}<button type="button" onClick={() => document.querySelector<HTMLElement>(`.genealogy-node[data-person-id="${person.id}"]`)?.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' })}>Centrer</button></div></article>)}</div>{level < genealogyGenerations.length - 1 && <div className="genealogy-branch-list">{parentEdges.filter(edge => generationById[edge.parent] === level && generationById[edge.child] === level + 1 && !hiddenGenealogyIds.has(edge.child)).map(edge => <div className={`genealogy-branch ${edge.link.type.toLocaleLowerCase('fr').includes('adopt') ? 'adoptive' : ''}`} key={edge.link.id}><span className="genealogy-branch-parent">{genealogyPeople.find(person => person.id === edge.parent)?.name}</span><i/><span className="genealogy-branch-joint">↓</span><i/><span className="genealogy-branch-child">{genealogyPeople.find(person => person.id === edge.child)?.name}</span><small>{edge.link.type.toLocaleLowerCase('fr').includes('adopt') ? 'FILIATION ADOPTIVE' : 'FILIATION'}</small></div>)}</div>}</section>)}</div></div>}{genealogyLinks.length > 0 && <section className="genealogy-manage"><h2>Liens familiaux enregistrés</h2>{genealogyLinks.map(link => { const from = entities.find(e => e.id === link.fromEntityId); const to = entities.find(e => e.id === link.toEntityId); return <article className="genealogy-manage-row" key={link.id}><div><strong>{from?.name || 'Personnage inconnu'}</strong><span>{link.type}</span><strong>{to?.name || 'Personnage inconnu'}</strong>{link.description && <small>{link.description}</small>}</div><button className="text-action" onClick={() => deleteGenealogyLink(link.id)}>Retirer</button></article>})}</section>}{otherGenealogyLinks.length > 0 && <section className="genealogy-manage"><h2>Unions et autres liens</h2>{otherGenealogyLinks.map(link => <article className="genealogy-manage-row" key={link.id}><div><strong>{entities.find(e => e.id === link.fromEntityId)?.name}</strong><span>{link.type}</span><strong>{entities.find(e => e.id === link.toEntityId)?.name}</strong></div><button className="text-action" onClick={() => deleteGenealogyLink(link.id)}>Retirer</button></article>)}</section>}</div>}
        {view === 'notes' && <div className="content-scroll"><div className="module-heading"><h1>Carnet d’idées</h1><button className="primary-button" onClick={createNote}><Plus size={16}/> Nouvelle idée</button></div><div className="notes-list">{notes.map(n => <article className="note-card" key={n.id}><div><h3>{n.title}</h3><p>{n.content || 'Note vide.'}</p></div><button className="text-action" onClick={() => editNote(n)}>Ouvrir</button></article>)}{notes.length === 0 && <p className="empty-hint">Aucune idée notée pour le moment.</p>}</div></div>}
        {view === 'progress' && <div className="content-scroll"><div className="module-heading"><h1>Progression</h1></div><div className="progress-grid"><div className="progress-card"><span>MOTS ÉCRITS</span><strong>{wordCount.toLocaleString('fr-FR')}</strong></div><div className="progress-card"><span>CHAPITRES</span><strong>{projectDocuments.length}</strong></div><div className="progress-card"><span>FICHES D’UNIVERS</span><strong>{entities.length}</strong></div><div className="progress-card"><span>IDÉES CONSERVÉES</span><strong>{notes.length}</strong></div></div><div className="project-summary-card"><label>VOTRE AVANCEMENT</label><p>{wordCount === 0 ? 'Aucun mot écrit.' : wordCount < 1000 ? 'Moins de 1 000 mots écrits.' : 'Données enregistrées localement.'}</p></div></div>}
        {view === 'settings' && <div className="content-scroll"><div className="module-heading"><h1>Modules & préférences</h1></div><div className="settings-list">{Object.entries(moduleLabels).map(([key,label]) => <label className="setting-row" key={key}><div><strong>{label}</strong><span>{({manuscripts:'Écriture, chapitres et scènes',encyclopedia:'Personnages, lieux et éléments du monde',notes:'Idées, fragments et inspirations',progress:'Statistiques de votre projet'} as Record<string,string>)[key]}</span></div><input type="checkbox" checked={workspace.modules[key] !== false} onChange={e => toggleModule(key,e.target.checked)}/></label>)}</div></div>}
      </section>
    </div>
    {genealogyDraft && <div className="genealogy-modal-backdrop" onClick={() => setGenealogyDraft(null)}><section className="genealogy-modal" role="dialog" aria-modal="true" aria-labelledby="genealogy-modal-title" onClick={event => event.stopPropagation()}><button className="genealogy-modal-close" onClick={() => setGenealogyDraft(null)} aria-label="Fermer"><X size={18}/></button><span className="eyebrow">NOUVEAU LIEN</span><h2 id="genealogy-modal-title">Qui est qui ?</h2><label>Premier personnage<select value={genealogyDraft.fromId} onChange={event => setGenealogyDraft({ ...genealogyDraft, fromId: event.target.value })}>{genealogyPeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Relation à reconnaître<input autoFocus value={genealogyDraft.term} onChange={event => { const term = event.target.value; const normalized = term.toLocaleLowerCase('fr').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z ]/g,' ').replace(/\\s+/g,' ').trim(); const suggestions: [string,string[]][] = [
                    ['Grand-père de',['grand p','grand-pere','grand pere','grd p']],
                    ['Grand-mère de',['grand m','grand-mere','grand mere','grd m']],
                    ['Petit-fils de',['petit fils','petit-fils','pt fils']],
                    ['Petite-fille de',['petite fille','petite-fille']],
                    ['Arrière-grand-père de',['arriere grand p','arriere grand pere']],
                    ['Arrière-grand-mère de',['arriere grand m','arriere grand mere']],
                    ['Arrière-petit-fils de',['arriere petit fils']],
                    ['Arrière-petite-fille de',['arriere petite fille']],
                    ['Parent de',['pere','papa','mere','maman','parent']],
                    ['Enfant de',['fils','fille','enfant']],
                    ['Enfant adopté de',['enfant adopte','fils adopte','fille adoptee']],
                    ['Adoptant de',['adoptant','parent adoptif']],
                    ['Frère / sœur de',['frere','soeur','frere soeur']],
                    ['Demi-frère / demi-sœur de',['demi frere','demi soeur']],
                    ['Beau-frère / belle-sœur de',['beau frere','belle soeur','beau-frere','belle-soeur']],
                    ['Oncle / tante de',['oncle','tante']],
                    ['Grand-oncle / grand-tante de',['grand oncle','grand-oncle','grand tante','grand-tante']],
                    ['Arrière-grand-oncle / arrière-grand-tante de',['arriere grand oncle','arriere grand tante']],
                    ['Neveu / nièce de',['neveu','niece']],
                    ['Petit-neveu / petite-nièce de',['petit neveu','petite niece','petit-neveu']],
                    ['Cousin / cousine de',['cousin','cousine']],
                    ['Cousin germain de',['cousin germain','cousine germaine']],
                    ['Cousin issu de germain de',['cousin issu','cousine issue']],
                    ['Demi-cousin / demi-cousine de',['demi cousin','demi cousine']],
                    ['Beau-parent de',['beau pere','belle mere','beau parent']],
                    ['Beau-fils / belle-fille de',['beau fils','belle fille']],
                    ['Beau-frère / belle-sœur de',['beau frere','belle soeur']],
                    ['Conjoint / conjointe de',['conjoint','conjointe','epoux','epouse','partenaire','mari','femme']],
                    ['Concubin / concubine de',['concubin','concubine']],
                    ['Compagnon / compagne de',['compagnon','compagne']],
                    ['Fiancé / fiancée de',['fiance','fiancee']],
                    ['Amant / amante de',['amant','amante']],
                    ['Ex-conjoint / ex-conjointe de',['ex conjoint','ex conjointe']],
                    ['Pupille de',['pupille']],
                    ['Tuteur / tutrice de',['tuteur','tutrice']],
                    ['Responsable légal de',['responsable legal']],
                    ['Parrain / marraine de',['parrain','marraine']],
                    ['Filleul / filleule de',['filleul','filleule']],
                    ['Protégé / protégée de',['protege','protegee']],
                    ['Maître / maîtresse de',['maitre','maitresse']],
                    ['Disciple de',['disciple']],
                    ['Famille d’accueil de',['famille accueil']],
                    ['Frère / sœur de lait de',['frere de lait','soeur de lait']],
                    ['Jumeau / jumelle de',['jumeau','jumelle']],
                    ['Ancêtre de',['ancetre']],
                    ['Descendant de',['descendant']],
                    ['Belle-famille de',['belle famille']],
                    ['Membre de la famille de',['famille']],
                    ['Parent biologique de',['parent biologique','pere biologique','mere biologique','geniteur','genitrice']],
                    ['Parent nourricier de',['parent nourricier','parent de coeur','parent de cœur']],
                    ['Mère porteuse de',['mere porteuse','mere gestatrice']],
                    ['Héritier / héritière de',['heritier','heritiere','successeur','successeure']],
                    ['Lignée de sang de',['lien de sang','sang de','parente de sang']],
                    ['Frère juré / sœur jurée de',['frere jure','soeur juree','fratrie juree']],
                    ['Lié·e par serment à',['lie par serment','liee par serment','serment de']],
                    ['Lié·e par destinée à',['lie par destinee','liee par destinee','destinee commune']],
                    ['Réincarnation de',['reincarnation','reincarne de','reincarnee de']],
                    ['Âme sœur de',['ame soeur','ame soeur']],
                    ['Protégé·e par un pacte de',['protege par pacte','protegee par pacte','pacte de protection']],
                    ['Créateur / créatrice de',['createur','creatrice','cree par']],
                    ['Créature de',['creature de','creation de']],
                    ['Clône / clone de',['clone','clonage']],
                    ['Double / sosie de',['double de','sosie de','alter ego']]
                  ]; const match = suggestions.find(([label, aliases]) => aliases.some(alias => alias.startsWith(normalized) || normalized.startsWith(alias))); setGenealogyDraft({ ...genealogyDraft, term, type: match?.[0] || '' }) }}/><small>Écris quelques lettres : « grand p », « cous », « demi fr »…</small></label>{genealogyDraft.term.trim() && <div className="genealogy-suggestions"><span>Suggestion</span>{genealogyDraft.type ? <button onClick={() => setGenealogyDraft({ ...genealogyDraft, term: genealogyDraft.type, type: genealogyDraft.type })}>✦ {genealogyDraft.type}</button> : <p>Relation non reconnue. Tu pourras l'enregistrer comme lien personnalisé.</p>}</div>}<label>Deuxième personnage<select value={genealogyDraft.toId} onChange={event => setGenealogyDraft({ ...genealogyDraft, toId: event.target.value })}>{genealogyPeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Précisions (facultatif)<textarea rows={2} value={genealogyDraft.description} onChange={event => setGenealogyDraft({ ...genealogyDraft, description: event.target.value })}/></label><div className="genealogy-modal-actions"><button className="secondary-button" onClick={() => setGenealogyDraft(null)}>Annuler</button><button className="primary-button" disabled={!genealogyDraft.type || genealogyDraft.fromId === genealogyDraft.toId} onClick={() => confirmGenealogyLink()}>{genealogyDraft.type ? 'Créer : ' + genealogyDraft.type : 'Saisis une relation'}</button></div></section></div>}
    <footer className="statusbar"><span><span className="status-dot"/> Stockage local · {workspace.projects.length} projet(s)</span><span>Scriptorium · Version 0.2.0</span></footer>
  </main>
}
