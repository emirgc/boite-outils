import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cheminsAvecFil } from '../integrations/pages-avec-fil.mjs'
import { jourMontreal, lirePagesAvecFil } from './fils.ts'

test('le jour suit l\'heure de Montréal, heure d\'hiver comme heure d\'été', () => {
  assert.equal(jourMontreal(new Date('2026-11-02T04:30:00Z')), '2026-11-01')
  assert.equal(jourMontreal(new Date('2026-11-02T05:30:00Z')), '2026-11-02')
  assert.equal(jourMontreal(new Date('2026-07-02T03:30:00Z')), '2026-07-01')
  assert.equal(jourMontreal(new Date('2026-07-02T04:30:00Z')), '2026-07-02')
})

test('seules les pages avec un fil sont notées', () => {
  const pages = [['index.html', '<p>a</p>'], ['droit/index.html', '<ul class="fil-nouvelles"></ul>'], ['citer/index.html', '<ul class="fil-nouvelles"></ul>']]
  assert.deepEqual(cheminsAvecFil(pages), ['/citer/', '/droit/'])
})

test('sans fichier, aucune page n\'est quotidienne et le build continue', () => {
  assert.equal(lirePagesAvecFil('/inexistant/pages.json').size, 0)
})
