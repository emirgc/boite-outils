import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DUREE_CONSENTEMENT_MS, NOM_TEMOIN, formaterTemoin, lireChoix } from './consentement.ts'

const maintenant = 1_800_000_000_000
const https = { hostname: 'bib.umontreal.ca', protocol: 'https:' }

const paire = (chaine: string) => chaine.split('; ')[0]

test('un choix écrit se relit, même entouré d’autres témoins', () => {
  const temoin = paire(formaterTemoin({ statistiques: true, date: maintenant }, https, maintenant))
  assert.deepEqual(lireChoix(`autre=1; ${temoin}; encore=2`, maintenant), {
    statistiques: true,
    date: maintenant,
  })
})

test('sans témoin, ou avec un témoin illisible, il n’y a pas de choix', () => {
  assert.equal(lireChoix('autre=1', maintenant), null)
  assert.equal(lireChoix(`${NOM_TEMOIN}=%7Bpas-du-json`, maintenant), null)
  const inconnu = encodeURIComponent(JSON.stringify({ statistiques: 'accepte', date: maintenant, version: 99 }))
  assert.equal(lireChoix(`${NOM_TEMOIN}=${inconnu}`, maintenant), null)
})

test('un choix échu n’est plus valide', () => {
  const temoin = paire(formaterTemoin({ statistiques: true, date: maintenant }, https, maintenant))
  assert.ok(lireChoix(temoin, maintenant + DUREE_CONSENTEMENT_MS - 1))
  assert.equal(lireChoix(temoin, maintenant + DUREE_CONSENTEMENT_MS), null)
})

test('le témoin est partagé seulement sous bib.umontreal.ca', () => {
  const choix = { statistiques: false, date: maintenant }
  assert.match(formaterTemoin(choix, https, maintenant), /Domain=bib\.umontreal\.ca; Secure$/)
  assert.match(
    formaterTemoin(choix, { hostname: 'studio.bib.umontreal.ca', protocol: 'https:' }, maintenant),
    /Domain=bib\.umontreal\.ca/,
  )
  const local = formaterTemoin(choix, { hostname: 'localhost', protocol: 'http:' }, maintenant)
  assert.doesNotMatch(local, /Domain=|Secure/)
})

test('la durée restante suit la date du choix', () => {
  const temoin = formaterTemoin({ statistiques: true, date: maintenant }, https, maintenant + 1000)
  assert.match(temoin, new RegExp(`Max-Age=${DUREE_CONSENTEMENT_MS / 1000 - 1};`))
})
