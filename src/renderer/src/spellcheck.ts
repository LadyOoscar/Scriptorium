import nspell from 'nspell'
import aff from 'dictionary-fr/index.aff?raw'
import dic from 'dictionary-fr/index.dic?raw'

export type LocalSpellingIssue = {
  word: string
  from: number
  to: number
  suggestions: string[]
}

let spellEngine: ReturnType<typeof nspell> | null = null

function getSpellEngine() {
  if (!spellEngine) spellEngine = nspell(aff, dic)
  return spellEngine
}

export async function checkFrenchSpelling(doc: {
  descendants: (callback: (node: { isText?: boolean; text?: string }, position: number) => boolean | void) => void
}): Promise<LocalSpellingIssue[]> {
  const spell = getSpellEngine()
  const issues: LocalSpellingIssue[] = []
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return
    const expression = /[\p{L}]+(?:['’][\p{L}]+)*/gu
    for (const match of node.text.matchAll(expression)) {
      const word = match[0]
      if (word.length < 2 || /^\p{Lu}+$/u.test(word)) continue
      if (!spell.correct(word)) {
        const start = position + (match.index ?? 0)
        issues.push({ word, from: start, to: start + word.length, suggestions: spell.suggest(word).slice(0, 4) })
      }
    }
  })
  return issues
}
