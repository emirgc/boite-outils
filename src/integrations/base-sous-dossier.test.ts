import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prefixerHtml, prefixerIndex } from './base-sous-dossier.mjs'

test('HTML : seules les adresses à la racine reçoivent le préfixe, une seule fois', () => {
  const html = '<a href="/citer/">a</a><a href="https://x.ca/y">b</a><a href="//x.ca">c</a><a href="#z">d</a><img src="/images/i.webp" srcset="/images/a.webp 1x, /images/b.webp 2x"><form action="/resultats/">'
  const attendu = '<a href="/b/citer/">a</a><a href="https://x.ca/y">b</a><a href="//x.ca">c</a><a href="#z">d</a><img src="/b/images/i.webp" srcset="/b/images/a.webp 1x, /b/images/b.webp 2x"><form action="/b/resultats/">'
  assert.equal(prefixerHtml(html, '/b'), attendu)
  assert.equal(prefixerHtml(attendu, '/b'), attendu)
})

test('index de recherche : les adresses locales seulement', () => {
  assert.equal(prefixerIndex('[{"url":"/citer/"},{"url":"https://x.ca/"}]', '/b'), '[{"url":"/b/citer/"},{"url":"https://x.ca/"}]')
})
