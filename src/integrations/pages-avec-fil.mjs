/*
 * Note après le build quelles pages affichent un fil : le build suivant les
 * regénère chaque jour (cacheKey dans lib/libguides.ts). Tiré de dist/ plutôt
 * que de l'API, qui demanderait un appel par guide à chaque build.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FICHIER_PAGES_AVEC_FIL } from '../lib/fils.ts'

export const cheminsAvecFil = (pages) =>
  pages.filter(([, html]) => html.includes('class="fil-nouvelles"')).map(([f]) => `/${f.replace(/index\.html$/, '')}`).sort()

export default function pagesAvecFil() {
  return {
    name: 'pages-avec-fil',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const racine = fileURLToPath(dir)
        const fichiers = readdirSync(racine, { recursive: true }).map(String).filter((f) => f.endsWith('index.html'))
        const chemins = cheminsAvecFil(fichiers.map((f) => [f, readFileSync(join(racine, f), 'utf8')]))
        mkdirSync('node_modules/.astro', { recursive: true })
        writeFileSync(FICHIER_PAGES_AVEC_FIL, JSON.stringify(chemins))
        logger.info(`${chemins.length} pages à regénérer chaque jour`)
      },
    },
  }
}
