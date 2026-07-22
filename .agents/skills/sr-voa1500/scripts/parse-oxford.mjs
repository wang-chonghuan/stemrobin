// Oxford 3000 parser, v2. Verification of v1 found it silently dropping ~45 entries —
// including light, minute and can — because the PDF uses three shapes I had not handled:
//   ① a disambiguating gloss in parentheses, sometimes with the POS/level continuing on
//      the NEXT line:  "light (from the sun/a lamp) n.,"  /  "adj. A1, v. A2"
//   ② superscript homograph numbers flattened into the word: "minute1 n. A1"
//   ③ entries whose neighbour in the joined stream swallowed them when the preceding
//      entry carried no level of its own.
// The fix: strip parenthetical glosses and trailing homograph digits before matching,
// and treat a piece that STARTS with a POS as a continuation of the previous headword.
import { readFileSync, writeFileSync } from 'node:fs'
const SP = '/private/tmp/claude-501/-Users-yong-work-stemrobin-ws-stemrobin/452cca05-f420-4415-b257-9c51e54b69d5/scratchpad'
const DIR = '/private/tmp/claude-501/-Users-yong-work-stemrobin-ws-stemrobin/452cca05-f420-4315-b257-9c51e54b69d5/scratchpad'
const POS = 'n|v|adj|adv|prep|pron|det|conj|exclam|number|modal|indefinite article|definite article|infinitive marker|auxiliary verb|ordinal number'
const RANK = { A1: 1, A2: 2, B1: 3, B2: 4 }

export function parseOxford(raw) {
  const txt = raw
    .split('\n')
    .filter((l) => !/^(©|The Oxford|\s*\d+ \/ 11)/.test(l))
    .filter((l) => !/^\s*\|?[\s|:-]+\|?\s*$/.test(l))
    .map((l) => l.replace(/\|/g, '  '))
    .join(' ')
    .replace(/\([^)]*\)/g, ' ')          // ① drop disambiguating glosses
    .replace(/\s+/g, ' ')

  const pieces = txt.split(/(?<=\b(?:A1|A2|B1|B2))(?=\s+)/)
  const out = new Map()
  const HEAD = new RegExp(`^([a-zA-Z][a-zA-Z' -]*?)\\d?\\s+((?:${POS})\\b[^]*)$`)
  const CONT = new RegExp(`^((?:${POS})\\b[^]*)$`)   // ① continuation line: POS first
  let lastWord = null

  const record = (word, pos, s) => {
    const levels = [...s.matchAll(/\b(A1|A2|B1|B2)\b/g)].map((x) => x[1])
    if (!levels.length) return
    const level = levels.sort((a, b) => RANK[a] - RANK[b])[0]   // easiest sense wins
    const prev = out.get(word)
    if (!prev || RANK[level] < RANK[prev.level]) {
      out.set(word, { word, pos: pos.replace(/\b(A1|A2|B1|B2)\b/g, '').replace(/[,\s]+$/, '').replace(/\s+/g, ' ').trim(), level })
    }
  }

  for (const p of pieces) {
    const s = p.trim()
    if (!s) continue
    const h = s.match(HEAD)
    if (h) {
      const word = h[1].trim().toLowerCase().replace(/[,.]$/, '')
      if (!/^[a-z][a-z' -]*$/.test(word)) continue
      lastWord = word
      record(word, h[2], s)
      continue
    }
    const c = s.match(CONT)                       // ① "adj. A1, v. A2" continuing the previous head
    if (c && lastWord) record(lastWord, c[1], s)
  }
  return out
}

if (process.argv[1]?.endsWith('build-oxford2.mjs')) {
  const a = parseOxford(readFileSync(`${DIR}/ox.txt`, 'utf8'))
  const b = parseOxford(readFileSync(`${DIR}/ox_markitdown.md`, 'utf8'))
  const eq = a.size === b.size && [...a.keys()].every((w) => b.has(w) && b.get(w).level === a.get(w).level)
  console.log(`pdftotext ${a.size} | markitdown ${b.size} | 一致: ${eq ? '是' : '否'}`)
  const by = {}
  for (const e of a.values()) by[e.level] = (by[e.level] || 0) + 1
  console.log('CEFR:', JSON.stringify(by))
  console.log('\n=== 之前丢失的词现在有没有 ===')
  for (const w of ['light', 'minute', 'can', 'do', 'like', 'a', 'close', 'kind', 'long', 'live', 'rest', 'cool', 'act'])
    console.log(' ', w.padEnd(8), a.get(w) ? `${a.get(w).level}` : '❌ 仍缺')
  const a12 = [...a.values()].filter((e) => e.level === 'A1' || e.level === 'A2')
  console.log(`\nA1+A2 = ${a12.length}`)
  writeFileSync(`${DIR}/oxford-v2.json`, JSON.stringify({ count: a.size, entries: [...a.values()].sort((x, y) => x.word.localeCompare(y.word)) }, null, 1))
}
