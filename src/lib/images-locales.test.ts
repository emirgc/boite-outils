import assert from 'node:assert/strict'
import { test } from 'node:test'
import { iconeDePolice, imageLocale } from './images-locales.ts'

const BIB = 'https://www.bib.umontreal.ca'
const LIBGUIDES = 'https://d1qywhc7l90rsa.cloudfront.net/sites/18643/icons'
const svg = (src: string) => decodeURIComponent(src.replace('data:image/svg+xml,', ''))

test('icône Phosphor : le dessin de la source, avec sa couleur et sa taille', () => {
  assert.match(svg(imageLocale(`${BIB}/images/libguides/gavel.svg`)), /fill="#f04e24" width="32" height="32"/)
  assert.match(svg(imageLocale(`${BIB}/images/libguides/bleu/gavel.svg`)), /fill="#0057ac"/)
})

test('copie locale : elle passe avant une icône du même nom', () => {
  assert.equal(imageLocale(`${BIB}/images/libguides/Oriflamme-S.svg`), '/images/bib/images/libguides/Oriflamme-S.svg')
  assert.equal(imageLocale(`${BIB}/images/libguides/check-square.svg`), '/images/bib/images/libguides/check-square.svg')
  assert.equal(imageLocale(`${BIB}/opurl/sfx.gif`), '/images/bib/opurl/sfx.gif')
})

test('icônes d\'accès de LibGuides, même sans protocole', () => {
  assert.equal(imageLocale(`${LIBGUIDES}/19170/logo-udem.png`), '/images/bib/logo-udem.png')
  assert.equal(imageLocale('//d1qywhc7l90rsa.cloudfront.net/sites/18643/icons/19170/logo-udem.png'), '/images/bib/logo-udem.png')
  assert.match(imageLocale(`${LIBGUIDES}/19146/mdp.png`), /^data:image\/svg\+xml,/)
  assert.match(imageLocale(`${LIBGUIDES}/19150/cederom.png`), /^data:image\/svg\+xml,/)
})

test('icône de la police Phosphor : le dessin du même nom, ou rien si le nom est inconnu', () => {
  assert.match(svg(iconeDePolice('ph ph-book-open-user icone-discipline', false)!), /fill="#f04e24"/)
  assert.match(svg(iconeDePolice('ph ph-gavel', true)!), /fill="#0057ac"/)
  assert.equal(iconeDePolice('ph ph-nom-inconnu', false), undefined)
  assert.equal(iconeDePolice('fa fa-book', false), undefined)
})

test('image inconnue : son adresse ne change pas', () => {
  for (const src of [`${BIB}/images/libguides/encore-questions.png`, `${BIB}/images/libguides/nom-inconnu.svg`, `${BIB}/images/libguides/vert/gavel.svg`, `${LIBGUIDES}/1/autre.png`, 'https://exemple.ca/gavel.svg', '/images/local.png']) {
    assert.equal(imageLocale(src), src)
  }
})
