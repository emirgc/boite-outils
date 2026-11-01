import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sitemapDe } from './sitemap.mjs'

test('le sitemap liste les pages indexables, pas les résultats, la 404 ni les fichiers', () => {
  const xml = sitemapDe(['index.html', 'citer/apa/index.html', 'resultats/index.html', '404.html', 'guides.json', 'images/a.webp'], 'https://exemple.ca')
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]), ['https://exemple.ca/citer/apa/', 'https://exemple.ca/'])
})
