/* Texte lisible d'un HTML de LibGuides : la description d'une page et l'index de recherche. */
import * as cheerio from 'cheerio'

export const BLOCS = 'p, div, li, ul, ol, dt, dd, tr, td, th, br, h1, h2, h3, h4, h5, h6, section, details, summary, blockquote, pre, figure, figcaption'
export const TITRES = 'h1, h2, h3, h4, h5, h6, summary'
/** Au-delà, les moteurs de recherche coupent la description */
const LONGUEUR_DESCRIPTION = 155
/** Une description plus courte n'apprend rien (« Guide disciplinaire ») */
const DESCRIPTION_UTILE = 50

export const espaces = (texte: string) => texte.replace(/\s+/g, ' ').trim()

export function extrait(texte: string, longueur: number) {
  const propre = espaces(texte)
  return propre.length <= longueur ? propre : `${propre.slice(0, longueur).replace(/\s+\S*$/, '')}…`
}

/** Début du texte d'un fragment, sans ses titres, qui répètent souvent le nom de la page */
function resume(html: string) {
  const $ = cheerio.load(html, null, false)
  $(`script, style, nav, form, .visuellement-masque, ${TITRES}`).remove()
  // text() colle les blocs voisins : « citoyens</h2><p>Suggestions » ferait un seul mot
  $(BLOCS).after(' ')
  return extrait($.root().text(), LONGUEUR_DESCRIPTION)
}

/** Première page d'un guide : sa description si elle dit quelque chose. Ailleurs : son propre texte, pour éviter les doublons. */
export function descriptionDe(guide: string, html: string, premierePage = true) {
  const dansGuide = extrait(guide, LONGUEUR_DESCRIPTION)
  if (premierePage && dansGuide.length >= DESCRIPTION_UTILE) return dansGuide
  return resume(html) || dansGuide
}
