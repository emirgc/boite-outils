/* Quelles pages regénérer chaque jour pour rafraîchir leurs fils : voir integrations/pages-avec-fil.mjs */
import { readFileSync } from 'node:fs'

// Avec le cache d'Astro, qu'il accompagne : sans ce cache, tout est regénéré de toute façon
export const FICHIER_PAGES_AVEC_FIL = 'node_modules/.astro/pages-avec-fil.json'

/** Vide au premier build : les pages sont alors toutes rendues, et le fichier s'écrit à la fin */
export function lirePagesAvecFil(fichier = FICHIER_PAGES_AVEC_FIL) {
  try {
    return new Set<string>(JSON.parse(readFileSync(fichier, 'utf8')))
  } catch {
    return new Set<string>()
  }
}

/** Date à Montréal, pas en UTC : le rafraîchissement du matin doit tomber sur un nouveau jour */
export const jourMontreal = (date = new Date()) => date.toLocaleDateString('en-CA', { timeZone: 'America/Montreal' })
