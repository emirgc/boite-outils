// @ts-check
import { defineConfig } from 'astro/config'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import react from '@astrojs/react'
import baseSousDossier from './src/integrations/base-sous-dossier.mjs'
import indexRecherche from './src/integrations/index-recherche.mjs'
import pagesAvecFil from './src/integrations/pages-avec-fil.mjs'
import sitemap from './src/integrations/sitemap.mjs'

// Comme bibweb : seule la branche production est indexée (robots.txt, balise robots) ; SITE_ENV peut le forcer
const branche = () => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}
process.env.SITE_ENV ||= branche() === 'production' ? 'production' : 'preprod'

export default defineConfig({
  site: 'https://boite-outils.bib.umontreal.ca',
  // GitHub Pages publie dans un sous-dossier ; baseSousDossier en dernier, après la création des index
  base: process.env.BASE_PATH || '/',
  integrations: [react(), indexRecherche(), sitemap(), pagesAvecFil(), baseSousDossier()],
  build: { concurrency: 8 },
  // Une page dont le cacheKey (voir routesGuides) et le code n'ont pas changé n'est ni rendue ni relue dans LibGuides
  experimental: { incrementalBuild: true },
  vite: {
    resolve: { alias: { '@/': fileURLToPath(new URL('./src/', import.meta.url)) } },
  },
})
