/*
 * sitemap.xml, tiré de dist/ : @astrojs/sitemap ne verrait pas forcément les
 * pages reprises du cache par le build incrémental.
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HORS_SITEMAP = new Set(['resultats/index.html'])

export function sitemapDe(fichiers, site) {
  const adresses = fichiers
    .filter((f) => f.endsWith('index.html') && !HORS_SITEMAP.has(f))
    .sort()
    .map((f) => `<url><loc>${new URL(f.replace(/index\.html$/, ''), site).href}</loc></url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${adresses.join('\n')}\n</urlset>\n`
}

export default function sitemap() {
  let site
  return {
    name: 'sitemap',
    hooks: {
      'astro:config:done': ({ config }) => void (site = config.site),
      'astro:build:done': ({ dir }) => {
        const racine = fileURLToPath(dir)
        writeFileSync(join(racine, 'sitemap.xml'), sitemapDe(readdirSync(racine, { recursive: true }).map(String), site))
      },
    },
  }
}
