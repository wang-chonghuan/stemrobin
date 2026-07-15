// Unit test for the PURE extraction in restore-section-names.mjs (no DB).
// Run: node --test .intentmill/tickets/STEMROBIN-34-restore-titles/tests/extract-section-names.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { extractSectionNames, anchorNameMap, applyNames } from '../../../../.agents/skills/sr-math-lesson/scripts/restore-section-names.mjs'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const snapDir = join(root, '.intentmill/tickets/STEMROBIN-21-migrate-content-jsonb/refs/migration/snapshots')

test('extractSectionNames returns ordered anchor/name pairs from a real snapshot', () => {
  const html = readFileSync(join(snapDir, 'math-s3-07.html'), 'utf8')
  const got = extractSectionNames(html)
  // teaching sections in order + the trailing practice section
  assert.deepEqual(got, [
    { anchor: 'motivation', name: '为什么学这个' },
    { anchor: 'explain', name: '讲解' },
    { anchor: 'examples', name: '例题' },
    { anchor: 'connections', name: '与其他知识点的联系' },
    { anchor: 'oral', name: '概念口试' },
    { anchor: 'practice', name: '练习' },
  ])
})

test('extractSectionNames handles a concept-genre lesson with lesson-specific names', () => {
  const html = readFileSync(join(snapDir, 'math-s3-01.html'), 'utf8')
  const map = anchorNameMap(extractSectionNames(html))
  assert.equal(map.motivation, '先把“不知道”放到桌上')
  assert.equal(map.model, '把未知的量放进一个条件')
  assert.equal(map.boundary, '别把名字、数量和猜测混在一起')
})

test('extractSectionNames is order-robust and self-closing-section-tolerant', () => {
  const html = `
    <section data-sr-section="motivation">
      <div class="sr-sec-label"><span class="sr-sec-num">1</span><span class="sr-sec-name">起名</span></div>
      <p>x</p>
    </section>
    <section data-sr-section="explain">
      <div class="sr-sec-label"><span class="sr-sec-num">2</span><span class="sr-sec-name">讲</span></div>
    </section>`
  assert.deepEqual(extractSectionNames(html), [
    { anchor: 'motivation', name: '起名' },
    { anchor: 'explain', name: '讲' },
  ])
})

test('anchorNameMap throws on a conflicting duplicate anchor', () => {
  assert.throws(() => anchorNameMap([
    { anchor: 'motivation', name: 'A' },
    { anchor: 'motivation', name: 'B' },
  ]), /conflicting names/)
})

test('applyNames adds name by anchor, preserves other fields, reports missing', () => {
  const content = { cards: [
    { id: 'x-motivation', num: 1, anchor: 'motivation', rev: 1, body: [{ kind: 'prose', id: 'b', role: 'html' }], read_check: [] },
    { id: 'x-explain', num: 2, anchor: 'explain', rev: 1, body: [], read_check: [] },
  ] }
  const { content: next, added, missing } = applyNames(content, { motivation: '为什么学这个' })
  assert.equal(added, 1)
  assert.deepEqual(missing, ['explain'])
  assert.equal(next.cards[0].name, '为什么学这个')
  // other fields untouched, and the input object is not mutated
  assert.equal(next.cards[0].anchor, 'motivation')
  assert.equal(next.cards[0].body[0].id, 'b')
  assert.equal('name' in content.cards[0], false)
})

test('applyNames is idempotent (re-apply reports 0 added)', () => {
  const content = { cards: [{ id: 'x', num: 1, anchor: 'motivation', rev: 1, body: [], read_check: [], name: '为什么学这个' }] }
  const { added } = applyNames(content, { motivation: '为什么学这个' })
  assert.equal(added, 0)
})
