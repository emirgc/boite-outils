import assert from 'node:assert/strict'
import { test } from 'node:test'
import { baseVisible, chercher, compterChoix, filtrerGuides, motsDe, trierResultats, urlSofia, type EntreeBase } from './recherche-guides.ts'

const guides = ['Citer selon le style Chicago', "Citer selon les normes de l'APA", 'Droit', "Droit d'auteur", 'Sciences de la santé'].map((nom) => ({ nom }))
const noms = (recherche: string) => filtrerGuides(guides, recherche).map((g) => g.nom)

test('cherche sans tenir compte des accents ni de la casse, tous les mots requis', () => {
  assert.deepEqual(noms('SANTE'), ['Sciences de la santé'])
  assert.deepEqual(noms('apa citer'), ["Citer selon les normes de l'APA"])
  assert.deepEqual(noms('  '), [])
  assert.deepEqual(noms('introuvable'), [])
})

test('les noms qui commencent par la recherche passent devant', () => {
  assert.deepEqual(noms('droit'), ['Droit', "Droit d'auteur"])
  assert.deepEqual(noms('s'), ['Sciences de la santé', 'Citer selon le style Chicago', "Citer selon les normes de l'APA"])
})

test('une base se trouve aussi par son autre nom', () => {
  const bases = [{ nom: 'Arabidopsis Information Resource', autres: 'TAIR' }]
  assert.deepEqual(filtrerGuides(bases, 'tair'), bases)
})

const fiche = (titre: string, reste = '', ids: Partial<Pick<EntreeBase, 's' | 't' | 'v' | 'groupe'>> = {}): EntreeBase => ({ titre: motsDe(titre), mots: motsDe(`${titre} ${reste}`), groupe: 'lettre-m', s: [], t: [], v: [], ...ids })
const vide = { q: '', s: '', t: '', v: '' }

test('page A à Z : recherche, lettre, sujet, type et fournisseur se cumulent', () => {
  const base = fiche('Museums of the World', 'De Gruyter', { s: ['1', '2'], t: ['3'], v: ['4'] })
  assert.ok(baseVisible(base, vide))
  assert.ok(baseVisible(base, { q: 'GRUYTER  Muséums', s: '2', t: '3', v: '4' }, 'm'))
  assert.ok(!baseVisible(base, { ...vide, q: 'museums droit' }))
  assert.ok(!baseVisible(base, vide, 'a'))
  assert.ok(!baseVisible(base, { ...vide, s: '9' }))
  assert.ok(!baseVisible(base, { ...vide, t: '9' }))
  assert.ok(!baseVisible(base, { ...vide, v: '9' }))
  assert.ok(baseVisible(base, { ...vide, v: '9' }, '', 'v'), 'un menu ne se limite pas lui-même')
})

test('page A à Z : la recherche vise le début des mots, ponctuation et accents ignorés', () => {
  const base = fiche('Documentaires de l’Institut', 'Encyclopédie')
  assert.ok(baseVisible(base, { ...vide, q: 'docum' }))
  assert.ok(baseVisible(base, { ...vide, q: 'encyclopedie' }))
  assert.ok(baseVisible(base, { ...vide, q: "l'institut" }))
  assert.ok(!baseVisible(base, { ...vide, q: 'taire' }))
})

test('page A à Z : le titre passe devant la description, l\'ordre alphabétique départage', () => {
  const bases = ['Atlas', 'Bases en droit', 'Droit civil', 'Droit pénal'].map((t) => fiche(t, t === 'Atlas' ? 'cours de droit' : ''))
  assert.deepEqual(trierResultats(bases, 'droit').map((b) => b.titre.join(' ')), ['droit civil', 'droit penal', 'bases en droit', 'atlas'])
})

test('page A à Z : les menus comptent selon les autres filtres', () => {
  const bases = [fiche('A', '', { s: ['1'], t: ['3'] }), fiche('B', '', { s: ['1'], t: ['4'] }), fiche('C', '', { s: ['2'], t: ['4'] })]
  const { s, t } = compterChoix(bases, { ...vide, s: '1' })
  assert.deepEqual([...s], [['1', 2], ['2', 1]])
  assert.deepEqual([...t], [['3', 1], ['4', 1]])
})

test('limite le nombre de suggestions', () => {
  assert.equal(filtrerGuides(Array.from({ length: 20 }, (_, i) => ({ nom: `Guide ${i}` })), 'guide').length, 8)
})

test('Sofia : requête encodée avec le préfixe kw:', () => {
  assert.ok(urlSofia('droit & société').endsWith('&queryString=kw:droit%20%26%20soci%C3%A9t%C3%A9'))
})

test('page de résultats : titre avant nom de page avant contenu, mots entiers au début', () => {
  const entrees = [
    { titre: 'Zotero', url: '/z/', mots: 'zotero droit' },
    { titre: 'Citer', page: 'Droit', url: '/c/d/', mots: 'citer droit' },
    { titre: 'Sources du droit', url: '/s/', mots: 'sources du droit' },
    { titre: 'Droit', page: 'Lois', url: '/d/l/', mots: 'droit lois' },
    { titre: 'Droit', url: '/d/', mots: 'droit' },
    { titre: 'Adroit', url: '/a/', mots: 'adroit' },
  ]
  assert.deepEqual(chercher(entrees, 'Droit').map((e) => e.url), ['/d/', '/d/l/', '/s/', '/c/d/', '/z/'])
  assert.deepEqual(chercher(entrees, 'droit lois').map((e) => e.url), ['/d/l/'])
  assert.deepEqual(chercher(entrees, '   '), [])
})

test('une ligature vaut ses deux lettres, dans les deux sens', () => {
  assert.deepEqual(motsDe('Œuvre, cœur et Cæsar'), ['oeuvre', 'coeur', 'et', 'caesar'])
  const entrees = [{ titre: 'Citer une œuvre', url: '/a/', mots: motsDe('Citer une œuvre').join(' ') }]
  assert.equal(chercher(entrees, 'oeuvre').length, 1)
  assert.equal(chercher(entrees, 'œuvre').length, 1)
})
