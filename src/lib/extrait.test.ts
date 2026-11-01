import assert from 'node:assert/strict'
import { test } from 'node:test'
import { descriptionDe, extrait } from './extrait.ts'

const LONGUE = 'Des ressources et des conseils pour citer vos sources selon le bon style.'

test('la première page garde une description utile du guide', () => {
  assert.equal(descriptionDe(LONGUE, '<p>Autre texte</p>'), LONGUE)
})

test('une description trop courte cède la place au texte de la page, sans ses titres', () => {
  assert.equal(descriptionDe('Guide disciplinaire', '<h2>Titre</h2><p>Premier</p><p>Second</p><script>x()</script>'), 'Premier Second')
})

test('les autres pages décrivent leur propre texte, et se rabattent sur le guide si elles n\'en ont pas', () => {
  assert.equal(descriptionDe(LONGUE, '<p>Ma page</p>', false), 'Ma page')
  assert.equal(descriptionDe(LONGUE, '<img src="x" alt="">', false), LONGUE)
  assert.equal(descriptionDe('', '<img src="x" alt="">', false), '')
})

test('un texte trop long est coupé entre deux mots', () => {
  assert.equal(extrait('un deux trois quatre', 9), 'un deux…')
})
