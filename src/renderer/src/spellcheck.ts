import nspell from 'nspell'

export type LocalSpellingIssue = {
  word: string
  from: number
  to: number
  suggestions: string[]
}

let spellEngine: ReturnType<typeof nspell> | null = null
let loading: Promise<ReturnType<typeof nspell>> | null = null

async function getSpellEngine() {
  if (spellEngine) return spellEngine
  if (!loading) {
    loading = Promise.all([
      fetch('/fr.aff').then(response => { if (!response.ok) throw new Error('Dictionnaire français indisponible'); return response.text() }),
      fetch('/fr.dic').then(response => { if (!response.ok) throw new Error('Dictionnaire français indisponible'); return response.text() })
    ]).then(([aff, dic]) => {
      spellEngine = nspell(aff, dic)
      return spellEngine
    })
  }
  return loading
}

export async function checkFrenchSpelling(doc: {
  descendants: (callback: (node: { isText?: boolean; text?: string }, position: number) => boolean | void) => void
} , customWords: string[] = []): Promise<LocalSpellingIssue[]> {
  const spell = await getSpellEngine()
  const personalWords = new Set(customWords.map(word => word.trim().toLocaleLowerCase('fr')).filter(Boolean))
  const issues: LocalSpellingIssue[] = []
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return
    const expression = /[\p{L}]+(?:['’][\p{L}]+)*/gu
    for (const match of node.text.matchAll(expression)) {
      const word = match[0]
      if (word.length < 2 || /^\p{Lu}+$/u.test(word) || personalWords.has(word.toLocaleLowerCase('fr'))) continue
      if (!spell.correct(word)) {
        const start = position + (match.index ?? 0)
        issues.push({ word, from: start, to: start + word.length, suggestions: spell.suggest(word).slice(0, 4) })
      }
    }
  })
  return issues
}
