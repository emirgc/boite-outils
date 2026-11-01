import assert from 'node:assert/strict'
import { test } from 'node:test'
import { marquerLiensExternes } from './liens-externes.ts'

const MARQUE = '<span class="lien-externe"><span class="visuellement-masque"> (nouvelle fenêtre)</span></span>'

test('un lien absolu s\'ouvre dans une autre fenêtre, annoncée', () => {
  assert.equal(marquerLiensExternes('<a href="https://x.org/?a=1&amp;b=2">X</a>'), `<a href="https://x.org/?a=1&amp;b=2" target="_blank" rel="noopener">X${MARQUE}</a>`)
  assert.equal(marquerLiensExternes('<a class="c" href="http://x.org" rel="me"><b>X</b></a>'), `<a class="c" href="http://x.org" rel="me" target="_blank"><b>X</b>${MARQUE}</a>`)
})

test('liens du site, courriels, téléphones et ancres restent tels quels', () => {
  for (const lien of ['<a href="/droit/">D</a>', '<a href="#x">D</a>', '<a href="mailto:a@b.ca">D</a>', '<a href="tel:+1">D</a>', '<a id="x"></a>', '<a href="https://x.org" target="_self">D</a>']) assert.equal(marquerLiensExternes(lien), lien)
})

test('un > dans un attribut ne coupe pas la balise ; plusieurs liens sont traités un à un', () => {
  assert.ok(marquerLiensExternes('<a title="a > b" href="https://x.org">X</a>').startsWith('<a title="a > b" href="https://x.org" target="_blank"'))
  assert.equal(marquerLiensExternes('<a href="/a">A</a> <a href="https://x.org">B</a>').match(/target=/g)?.length, 1)
})

test('un lien sans nom ne reçoit pas de nom par l\'annonce', () => {
  assert.equal(marquerLiensExternes('<a href="https://x.org"><img alt="" src="a.png"></a>'), '<a href="https://x.org" target="_blank" rel="noopener"><img alt="" src="a.png"></a>')
  const image = marquerLiensExternes('<a href="https://x.org"><img alt="Logo" src="a.png"></a>')
  assert.ok(image.includes('(nouvelle fenêtre)') && !image.includes('lien-externe'), 'une image annoncée, sans flèche à côté')
})
