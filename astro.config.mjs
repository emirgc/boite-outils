// @ts-check
import { defineConfig } from 'astro/config'
import { fileURLToPath } from 'node:url'
import react from '@astrojs/react'
import indexRecherche from './src/integrations/index-recherche.mjs'

export default defineConfig({
  integrations: [react(), indexRecherche()],
  build: { concurrency: 8 },
  // Une page dont le cacheKey (voir routesGuides) et le code n'ont pas changé n'est ni rendue ni relue dans LibGuides
  experimental: { incrementalBuild: true },
  vite: {
    resolve: { alias: { '@/': fileURLToPath(new URL('./src/', import.meta.url)) } },
  },
})
