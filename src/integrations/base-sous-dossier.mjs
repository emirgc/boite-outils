/*
 * Publication dans un sous-dossier (GitHub Pages : /boite-outils/). Repris de
 * bibweb : en fin de build, préfixe les adresses « à la racine » du HTML et des
 * index de recherche. Sans BASE_PATH, cette intégration ne fait rien.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Déjà préfixées (fichiers d'Astro), externes, « // » et ancres restent telles quelles
const prefixer = (adresse, base) => (adresse.startsWith('/') && !adresse.startsWith('//') && !adresse.startsWith(`${base}/`) ? `${base}${adresse}` : adresse)

export const prefixerHtml = (html, base) =>
  html
    .replace(/(\s(?:href|src|action|poster)=)(["'])(\/[^"']*)\2/g, (_, attribut, guillemet, adresse) => `${attribut}${guillemet}${prefixer(adresse, base)}${guillemet}`)
    .replace(/(\ssrcset=)(["'])([^"']*)\2/g, (_, attribut, guillemet, liste) => `${attribut}${guillemet}${liste.replace(/(^|,\s*)(\/[^\s,]+)/g, (__, sep, adresse) => `${sep}${prefixer(adresse, base)}`)}${guillemet}`)

export const prefixerIndex = (json, base) => json.replace(/("url":")([^"]*)"/g, (_, debut, adresse) => `${debut}${prefixer(adresse, base)}"`)

export default function baseSousDossier() {
  let base = ''
  return {
    name: 'base-sous-dossier',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base.replace(/\/$/, '')
      },
      'astro:build:done': ({ dir, logger }) => {
        if (!base) return
        const racine = fileURLToPath(dir)
        const fichiers = readdirSync(racine, { recursive: true }).map(String)
        for (const f of fichiers.filter((f) => f.endsWith('.html'))) writeFileSync(join(racine, f), prefixerHtml(readFileSync(join(racine, f), 'utf8'), base))
        for (const f of ['guides.json', 'index-recherche.json']) writeFileSync(join(racine, f), prefixerIndex(readFileSync(join(racine, f), 'utf8'), base))
        logger.info(`Adresses préfixées par « ${base} »`)
      },
    },
  }
}
