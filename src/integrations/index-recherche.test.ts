import assert from 'node:assert/strict'
import { test } from 'node:test'
import { entreesDe } from './index-recherche.mjs'

const page = (titre: string, h1: string, corps: string) => `<html><head><title>${titre}</title></head><body><nav>Menu</nav><main><h1>${h1}</h1><div class="guide-contenu">${corps}<script>code()</script><span class="visuellement-masque"> (nouvelle fenêtre)</span></div></main></body></html>`

test('une page de guide : guide, page, extrait et mots normalisés sans menu ni texte masqué', () => {
  const [e] = entreesDe(page('Thèses | Droit | Boîte à outils | Les bibliothèques UdeM', 'Droit', '<p>Mémoires québécois</p>'), '/droit/theses/')
  assert.deepEqual(e, { titre: 'Droit', page: 'Thèses', url: '/droit/theses/', extrait: 'Mémoires québécois', mots: 'droit theses memoires quebecois' })
})

test('les blocs voisins ne collent pas leurs mots, et l\'extrait saute les titres', () => {
  const [e] = entreesDe(page('A | B | Boîte à outils', 'B', '<h2>Jardins</h2><p>Suggestions<br>de lecture</p><ul><li>Un</li><li>Deux</li></ul>'), '/b/a/')
  assert.equal(e.mots, 'b a jardins suggestions de lecture un deux')
  assert.equal(e.extrait, 'Suggestions de lecture Un Deux')
})

test('un h1 aux espaces doublés garde le nom de sa page', () => {
  const [e] = entreesDe(page('Thèses | Droit civil | Boîte à outils', 'Droit  civil', 'x'), '/d/t/')
  assert.equal(e.titre, 'Droit civil')
  assert.equal(e.page, 'Thèses')
})

test('un portail n\'a pas de nom de page', () => {
  assert.equal(entreesDe(page('Droit | Boîte à outils | Les bibliothèques UdeM', 'Droit', 'x'), '/droit/')[0].page, undefined)
})

test('la page A à Z donne une entrée par base, sans ce qui ne porte pas data-cherche', () => {
  const html = '<li data-base><a class="base-nom" href="https://x.org/"><span data-cherche>Érudit</span><span class="visuellement-masque"> (nouvelle fenêtre)</span></a><span class="base-pastille">Nouveau</span><div class="ressource-description" data-cherche><p>Revues</p></div></li>'
  assert.deepEqual(entreesDe(html, '/bases-de-donnees/'), [{ titre: 'Érudit', url: 'https://x.org/', extrait: 'Revues', mots: 'erudit revues', base: true }])
})

test('la page de résultats ne s\'indexe pas elle-même', () => {
  assert.deepEqual(entreesDe(page('Résultats', 'Résultats', 'x'), '/resultats/'), [])
})
